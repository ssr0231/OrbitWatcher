# backend/routes/analytics.py

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter
from backend.database import get_connection
from logger import get_logger

log = get_logger(__name__)
router = APIRouter()


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

    # Altitude distribution of all satellites
    cursor.execute("""
        SELECT
            CASE
                WHEN CAST(SUBSTR(tle_line2, 45, 8) AS REAL) * 86400 / 6.283185 > 0
                THEN 'LEO'
                ELSE 'OTHER'
            END as shell,
            COUNT(*) as count
        FROM satellites
        GROUP BY shell
    """)

    conn.close()
    log.info("Served analytics.")

    return {
        "status": "success",
        "data": {
            "total_satellites":   total_satellites,
            "total_conjunctions": total_conjunctions,
            "high_risk_count":    high_risk_count,
            "average_risk_score": round(avg_risk, 8),
            "max_risk_score":     round(max_risk, 8),
            "min_miss_distance":  round(min_distance, 3),
            "top_satellites":     top_satellites,
            "risk_distribution":  risk_distribution
        }
    }