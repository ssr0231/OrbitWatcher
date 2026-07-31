# backend/routes/satellites.py
# GET /api/v1/tles
# Returns all satellite TLE data for the frontend.

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter, HTTPException
from backend.database import get_db
from logger import get_logger

log = get_logger(__name__)
router = APIRouter()


@router.get("/tles")
def get_tles():
    """
    Returns all satellites with their TLE lines.
    Frontend uses these to compute real-time positions
    using satellite.js — no positions are stored server-side.
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, name, tle_line1, tle_line2, last_updated
                FROM satellites
                ORDER BY name
            """)
            rows = cursor.fetchall()

        satellites = [dict(row) for row in rows]
        log.info(f"Served {len(satellites)} TLEs.")
        return {
            "status": "success",
            "count":  len(satellites),
            "data":   satellites
        }

    except Exception as e:
        log.error(f"Failed to fetch TLEs: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail="Satellite data temporarily unavailable.")