# backend/routes/analytics.py

import os
import sys
import math
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter
from backend.database import get_connection
from logger import get_logger

log = get_logger(__name__)
router = APIRouter()

# Earth's radius in km — matches the constant used in propagator.py
# and the frontend's SCALE_FACTOR (1/6371), so altitude figures here
# agree exactly with what the 3D globe and conjunction screening use.
EARTH_RADIUS_KM = 6371.0

# Standard gravitational parameter of Earth (km^3/s^2), WGS-84 value.
# Used with Kepler's Third Law to convert a TLE's Mean Motion field
# (orbits per day) directly into an orbital altitude — without needing
# a full SGP4 propagation just to bucket satellites by altitude band.
MU_EARTH = 398600.4418

# Altitude bands — intentionally identical to the color thresholds
# used for satellites on the 3D globe (frontend/js/satellites.js),
# so this chart and the globe always tell the same visual story.
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

    TLE Line 2 has a fixed-width format. Columns 53-63 (11 characters)
    always hold Mean Motion in revolutions per day, regardless of the
    satellite. Reading that fixed position is reliable — this is the
    same approach the previous version of this function attempted, but
    it pointed at columns 45-52, which is the Mean Anomaly field, not
    Mean Motion. Mean Anomaly is an angle (0-360 degrees) and has
    nothing to do with orbital altitude, so the old calculation was
    operating on the wrong number entirely.

    Returns None if the line is malformed or too short to parse.
    """
    try:
        mean_motion_rev_per_day = float(tle_line2[52:63])
        if mean_motion_rev_per_day <= 0:
            return None

        # Convert orbits/day -> radians/second
        n_rad_per_s = mean_motion_rev_per_day * 2 * math.pi / 86400.0

        # Kepler's Third Law: a^3 = mu / n^2  ->  a = (mu / n^2)^(1/3)
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
    conn = get_connection()
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

    # Top satellites ranked by total combined risk score
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

    # Altitude distribution of all satellites — computed in Python from
    # each TLE's Mean Motion field via Kepler's Third Law (see
    # estimate_altitude_km above). Bucketed into the same 5 bands used
    # for satellite coloring on the 3D globe.
    cursor.execute("SELECT tle_line2 FROM satellites")
    band_counts = {label: 0 for label, _, _ in ALTITUDE_BANDS}
    unparseable = 0

    for row in cursor.fetchall():
        altitude = estimate_altitude_km(row["tle_line2"])
        if altitude is None:
            unparseable += 1
            continue
        band_counts[bucket_altitude(altitude)] += 1

    # Preserve band order (highest altitude first) for consistent chart display
    altitude_distribution = [
        {"band": label, "count": band_counts[label]}
        for label, _, _ in ALTITUDE_BANDS
    ]
    if unparseable:
        log.warning(f"Altitude distribution: {unparseable} satellites had unparseable TLE data.")

    conn.close()
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