# backend/routes/analytics.py

import os
import sys
import math
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter, HTTPException
from backend.database import get_db
from logger import get_logger

log = get_logger(__name__)
router = APIRouter()

EARTH_RADIUS_KM = 6371.0
MU_EARTH = 398600.4418

ALTITUDE_BANDS = [
    ("> 560 km",     560.0, float("inf")),
    ("530 - 560 km", 530.0, 560.0),
    ("500 - 530 km", 500.0, 530.0),
    ("470 - 500 km", 470.0, 500.0),
    ("< 470 km",     float("-inf"), 470.0),
]


def estimate_altitude_km(tle_line2: str) -> float | None:
    """
    Estimates a satellite's altitude directly from its TLE Mean Motion
    field, using Kepler's Third Law, without running SGP4.
    """
    try:
        mean_motion_rev_per_day = float(tle_line2[52:63])
        if mean_motion_rev_per_day <= 0:
            return None
        n_rad_per_s = mean_motion_rev_per_day * 2 * math.pi / 86400.0
        semi_major_axis_km = (MU_EARTH / (n_rad_per_s ** 2)) ** (1.0 / 3.0)
        return semi_major_axis_km - EARTH_RADIUS_KM
    except (ValueError, IndexError):
        return None


def bucket_altitude(altitude_km: float) -> str:
    for label, lo, hi in ALTITUDE_BANDS:
        if lo <= altitude_km < hi:
            return label
    return "< 470 km"


@router.get("/analytics")
def get_analytics():
    try:
        with get_db() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT COUNT(*) as c FROM satellites")
            total_satellites = cursor.fetchone()["c"]

            cursor.execute("SELECT COUNT(*) as c FROM conjunctions")
            total_conjunctions = cursor.fetchone()["c"]

            cursor.execute("""
                SELECT COUNT(*) as c FROM conjunctions
                WHERE risk_score >= 0.00005
            """)
            high_risk_count = cursor.fetchone()["c"]

            cursor.execute("SELECT AVG(risk_score) as avg FROM conjunctions")
            avg_risk = cursor.fetchone()["avg"] or 0.0

            cursor.execute("SELECT MAX(risk_score) as m FROM conjunctions")
            max_risk = cursor.fetchone()["m"] or 0.0

            cursor.execute("SELECT MIN(miss_distance_km) as m FROM conjunctions")
            min_distance = cursor.fetchone()["m"] or 0.0

            cursor.execute("""
                SELECT s.name,
                       COUNT(*) as appearances,
                       ROUND(SUM(c.risk_score), 8) as total_risk
                FROM (
                    SELECT sat1_id as sid, risk_score FROM conjunctions
                    UNION ALL
                    SELECT sat2_id as sid, risk_score FROM conjunctions
                ) c
                JOIN satellites s ON s.id = c.sid
                GROUP BY s.id
                ORDER BY total_risk DESC
                LIMIT 10
            """)
            top_satellites = [dict(row) for row in cursor.fetchall()]

            cursor.execute("""
                SELECT
                    CASE
                        WHEN miss_distance_km < 10  THEN 'critical'
                        WHEN miss_distance_km < 25  THEN 'high'
                        WHEN miss_distance_km < 50  THEN 'medium'
                        ELSE 'low'
                    END as level,
                    COUNT(*) as count
                FROM conjunctions
                GROUP BY level
                ORDER BY
                    CASE level
                        WHEN 'critical' THEN 1
                        WHEN 'high'     THEN 2
                        WHEN 'medium'   THEN 3
                        ELSE 4
                    END
            """)
            risk_distribution = [dict(row) for row in cursor.fetchall()]

            cursor.execute("SELECT tle_line2 FROM satellites")
            band_counts  = {label: 0 for label, _, _ in ALTITUDE_BANDS}
            unparseable  = 0

            for row in cursor.fetchall():
                altitude = estimate_altitude_km(row["tle_line2"])
                if altitude is None:
                    unparseable += 1
                    continue
                band_counts[bucket_altitude(altitude)] += 1

        altitude_distribution = [
            {"band": label, "count": band_counts[label]}
            for label, _, _ in ALTITUDE_BANDS
        ]
        if unparseable:
            log.warning(f"Altitude distribution: {unparseable} satellites had unparseable TLE data.")

        log.info("Served analytics.")
        return {
            "status": "success",
            "data": {
                "total_satellites":      total_satellites,
                "total_conjunctions":    total_conjunctions,
                "high_risk_count":       high_risk_count,
                "average_risk_score":    round(avg_risk, 8),
                "max_risk_score":        round(max_risk, 8),
                "min_miss_distance":     round(min_distance, 3),
                "top_satellites":        top_satellites,
                "risk_distribution":     risk_distribution,
                "altitude_distribution": altitude_distribution
            }
        }

    except Exception as e:
        log.error(f"Failed to compute analytics: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail="Analytics data temporarily unavailable.")