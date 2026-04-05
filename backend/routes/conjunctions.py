# backend/routes/conjunctions.py
# GET /api/v1/conjunctions
# Returns pre-computed collision risk pairs.

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter, Query
from backend.database import get_connection
from logger import get_logger

log = get_logger(__name__)
router = APIRouter()


@router.get("/conjunctions")
def get_conjunctions(limit: int = Query(default=100, le=500)):
    """
    Returns top conjunction pairs sorted by risk score.
    Optional limit parameter (default 100, max 500).
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            c.id,
            c.miss_distance_km,
            c.relative_velocity_km_s,
            c.risk_score,
            c.timestamp,
            s1.name as sat1_name,
            s2.name as sat2_name,
            s1.id   as sat1_id,
            s2.id   as sat2_id
        FROM conjunctions c
        JOIN satellites s1 ON c.sat1_id = s1.id
        JOIN satellites s2 ON c.sat2_id = s2.id
        ORDER BY c.risk_score DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()

    data = [dict(row) for row in rows]
    log.info(f"Served {len(data)} conjunctions.")

    return {
        "status": "success",
        "count": len(data),
        "data": data
    }