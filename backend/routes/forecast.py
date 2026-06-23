# backend/routes/forecast.py

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter, Query
from datetime import datetime, timezone
from backend.database import get_connection
from logger import get_logger

log = get_logger(__name__)
router = APIRouter()


@router.get("/forecast")
def get_forecast(limit: int = Query(default=200, le=500)):
    """
    Returns upcoming conjunction events, sorted soonest-first.
    Default limit 200, max 500. Events already past are excluded.
    seconds_from_now is computed at request time so it is always accurate.
    """
    conn   = get_connection()
    cursor = conn.cursor()
    now    = datetime.now(timezone.utc)

    cursor.execute("""
        SELECT
            f.id,
            f.approach_time,
            f.predicted_miss_km,
            f.relative_velocity_km_s,
            f.risk_score,
            f.created_at,
            s1.name AS sat1_name,
            s2.name AS sat2_name
        FROM forecast f
        JOIN satellites s1 ON f.sat1_id = s1.id
        JOIN satellites s2 ON f.sat2_id = s2.id
        ORDER BY f.approach_time ASC
        LIMIT ?
    """, (limit,))

    rows = cursor.fetchall()
    conn.close()

    data = []
    forecast_generated_at = None

    for row in rows:
        d = dict(row)
        if forecast_generated_at is None:
            forecast_generated_at = d.get("created_at")
        try:
            approach_dt = datetime.fromisoformat(d["approach_time"])
            if approach_dt.tzinfo is None:
                approach_dt = approach_dt.replace(tzinfo=timezone.utc)
            secs = (approach_dt - now).total_seconds()
            if secs < 0:
                continue
            d["seconds_from_now"] = round(secs, 1)
        except Exception:
            continue
        data.append(d)

    log.info(f"Served {len(data)} forecast events.")
    return {
        "status":                "success",
        "forecast_generated_at": forecast_generated_at,
        "count":                 len(data),
        "data":                  data
    }