# backend/routes/satellites.py
# GET /api/v1/tles
# Returns all satellite TLE data for the frontend.
# The browser uses this to run satellite.js propagation.

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter
from backend.database import get_connection
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
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, tle_line1, tle_line2, last_updated
        FROM satellites
        ORDER BY name
    """)
    rows = cursor.fetchall()
    conn.close()

    satellites = [dict(row) for row in rows]
    log.info(f"Served {len(satellites)} TLEs.")

    return {
        "status": "success",
        "count": len(satellites),
        "data": satellites
    }