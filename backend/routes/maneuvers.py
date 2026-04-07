# backend/routes/maneuvers.py

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter, HTTPException
from backend.database import get_connection
from logger import get_logger

log = get_logger(__name__)
router = APIRouter()


@router.get("/maneuvers/{conjunction_id}")
def get_maneuver(conjunction_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            m.id,
            m.conjunction_id,
            m.delta_v_m_s,
            m.recommendation_text,
            c.miss_distance_km,
            c.relative_velocity_km_s,
            c.risk_score,
            s1.name as sat1_name,
            s2.name as sat2_name
        FROM maneuvers m
        JOIN conjunctions c ON m.conjunction_id = c.id
        JOIN satellites s1  ON c.sat1_id = s1.id
        JOIN satellites s2  ON c.sat2_id = s2.id
        WHERE m.conjunction_id = ?
    """, (conjunction_id,))

    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"No maneuver found for conjunction ID {conjunction_id}"
        )

    log.info(f"Served maneuver for conjunction {conjunction_id}.")
    return {
        "status": "success",
        "data": dict(row)
    }


@router.get("/maneuvers")
def get_all_maneuvers(limit: int = 50):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            m.id,
            m.conjunction_id,
            m.delta_v_m_s,
            m.recommendation_text,
            c.risk_score,
            c.miss_distance_km,
            c.relative_velocity_km_s,
            s1.name as sat1_name,
            s2.name as sat2_name
        FROM maneuvers m
        JOIN conjunctions c ON m.conjunction_id = c.id
        JOIN satellites s1  ON c.sat1_id = s1.id
        JOIN satellites s2  ON c.sat2_id = s2.id
        ORDER BY c.risk_score DESC
        LIMIT ?
    """, (limit,))

    rows = cursor.fetchall()
    conn.close()

    return {
        "status": "success",
        "count": len(rows),
        "data": [dict(row) for row in rows]
    }