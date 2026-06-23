# backend/services/forecaster.py

import os
import sys
import time
from datetime import datetime, timezone, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import numpy as np
from scipy.spatial import KDTree

from config import CONJUNCTION_THRESHOLD_KM, MAX_RELATIVE_VELOCITY_KM_S
from logger import get_logger
from backend.database import get_connection
from backend.services.propagator import get_all_satellite_positions

log = get_logger(__name__)

FORECAST_HOURS      = 24
SAMPLE_INTERVAL_MIN = 15

# Pairs with relative velocity below this threshold are near-parallel
# orbits with negligible collision risk — not worth storing or displaying.
# At 0.5 km/s, two satellites within 50 km would take 100+ seconds to
# cross, giving plenty of maneuver time, and the probability of an actual
# impact is essentially zero. Filtering these out eliminates ~60-70% of
# raw detections that have no operational significance.
MIN_RELATIVE_VELOCITY_KM_S = 0.5

# Hard cap on stored forecast events. After filtering, sort by risk score
# and keep only the most significant events — the goal of this feature is
# "give operators a manageable list of upcoming events to watch" not
# "enumerate every possible pair interaction over 24 hours."
# 500 is enough to fill several screens and covers all genuinely elevated
# risk events with room to spare.
MAX_FORECAST_EVENTS = 500


def _risk_score(distance_km: float, rel_velocity_km_s: float) -> float:
    return (1.0 / (distance_km + 1.0)) * (rel_velocity_km_s / MAX_RELATIVE_VELOCITY_KM_S)


def run_forecast() -> int:
    t_start = time.perf_counter()
    now     = datetime.now(timezone.utc)

    n_epochs = int(FORECAST_HOURS * 60 / SAMPLE_INTERVAL_MIN)
    epochs   = [
        now + timedelta(minutes=(i + 1) * SAMPLE_INTERVAL_MIN)
        for i in range(n_epochs)
    ]

    log.info(
        f"Forecast: sampling {n_epochs} epochs over {FORECAST_HOURS}h "
        f"at {SAMPLE_INTERVAL_MIN}-min intervals..."
    )

    best: dict = {}

    for epoch in epochs:
        try:
            positions = get_all_satellite_positions(epoch)
            if len(positions) < 2:
                continue

            coords = np.array([[p["x"], p["y"], p["z"]] for p in positions])
            tree   = KDTree(coords)
            pairs  = tree.query_pairs(r=CONJUNCTION_THRESHOLD_KM)

            for i, j in pairs:
                s1, s2 = positions[i], positions[j]

                rv = float(np.linalg.norm(np.array([
                    s1["vx"] - s2["vx"],
                    s1["vy"] - s2["vy"],
                    s1["vz"] - s2["vz"]
                ])))

                # Skip near-parallel orbit pairs — low rv means low
                # collision risk regardless of miss distance.
                if rv < MIN_RELATIVE_VELOCITY_KM_S:
                    continue

                dist = float(np.linalg.norm(np.array([
                    s1["x"] - s2["x"],
                    s1["y"] - s2["y"],
                    s1["z"] - s2["z"]
                ])))

                key = (min(s1["id"], s2["id"]), max(s1["id"], s2["id"]))

                if key not in best or dist < best[key]["predicted_miss_km"]:
                    best[key] = {
                        "sat1_id":                s1["id"],
                        "sat2_id":                s2["id"],
                        "approach_time":          epoch.isoformat(),
                        "predicted_miss_km":      round(dist, 4),
                        "relative_velocity_km_s": round(rv, 4),
                        "risk_score":             round(_risk_score(dist, rv), 8),
                        "created_at":             now.isoformat()
                    }

        except Exception as e:
            log.warning(f"Forecast epoch {epoch.strftime('%H:%M')} failed: {e}")
            continue

    # Sort by risk score descending and keep only the top MAX_FORECAST_EVENTS.
    # This ensures the database always stays small and the API response is fast.
    top_events = sorted(
        best.values(),
        key=lambda x: x["risk_score"],
        reverse=True
    )[:MAX_FORECAST_EVENTS]

    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM forecast")

    if top_events:
        cursor.executemany("""
            INSERT INTO forecast
                (sat1_id, sat2_id, approach_time, predicted_miss_km,
                 relative_velocity_km_s, risk_score, created_at)
            VALUES
                (:sat1_id, :sat2_id, :approach_time, :predicted_miss_km,
                 :relative_velocity_km_s, :risk_score, :created_at)
        """, top_events)

    conn.commit()
    conn.close()

    elapsed = (time.perf_counter() - t_start) * 1000
    log.info(
        f"Forecast complete: {len(top_events)} events stored "
        f"(filtered from {len(best)} unique pairs) in {elapsed/1000:.1f}s."
    )
    return len(top_events)