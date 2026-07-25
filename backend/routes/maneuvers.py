# backend/routes/maneuvers.py

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter, HTTPException, Query
from backend.database import get_db
from logger import get_logger

log = get_logger(__name__)
router = APIRouter()


@router.get("/maneuvers/{conjunction_id}")
def get_maneuver(conjunction_id: int):
    try:
        with get_db() as conn:
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
                    c.tca_seconds,
                    s1.name as sat1_name,
                    s2.name as sat2_name
                FROM maneuvers m
                JOIN conjunctions c ON m.conjunction_id = c.id
                JOIN satellites s1  ON c.sat1_id = s1.id
                JOIN satellites s2  ON c.sat2_id = s2.id
                WHERE m.conjunction_id = ?
            """, (conjunction_id,))
            row = cursor.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail=f"No maneuver found for conjunction ID {conjunction_id}"
            )

        log.info(f"Served maneuver for conjunction {conjunction_id}.")
        return {"status": "success", "data": dict(row)}

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Failed to fetch maneuver {conjunction_id}: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail="Maneuver data temporarily unavailable.")


@router.get("/maneuvers")
def get_all_maneuvers(
    # Phase 2 fix: added ge=1 and le=500 upper bound.
    # Previously `limit: int = 50` had no constraint — a caller could
    # pass limit=999999 and load the entire maneuvers table into memory.
    # The other two paginated endpoints already had Query(le=500).
    limit: int = Query(default=50, ge=1, le=500)
):
    try:
        with get_db() as conn:
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
                    c.tca_seconds,
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

        log.info(f"Served {len(rows)} maneuvers.")
        return {
            "status": "success",
            "count":  len(rows),
            "data":   [dict(row) for row in rows]
        }

    except Exception as e:
        log.error(f"Failed to fetch maneuvers: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail="Maneuver data temporarily unavailable.")