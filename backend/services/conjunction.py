# backend/services/conjunction.py
import os
import sys
from datetime import datetime, timezone, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import numpy as np
from scipy.spatial import KDTree

from config import (
    ORBITAL_SHELL_THICKNESS_KM,
    CONJUNCTION_THRESHOLD_KM,
    MAX_RELATIVE_VELOCITY_KM_S
)
from logger import get_logger
from backend.database import get_connection
from backend.services.propagator import get_all_satellite_positions, propagate_satellite

log = get_logger(__name__)


def compute_relative_velocity(v1: list, v2: list) -> float:
    dv = np.array(v1) - np.array(v2)
    return float(np.linalg.norm(dv))


def compute_tca(sat1: dict, sat2: dict, dt: datetime) -> float:
    try:
        future_dt = dt + timedelta(seconds=60)
        pos1_future, _ = propagate_satellite(sat1["tle_line1"], sat1["tle_line2"], future_dt)
        pos2_future, _ = propagate_satellite(sat2["tle_line1"], sat2["tle_line2"], future_dt)

        if pos1_future is None or pos2_future is None:
            return 999.0

        current_dist = np.linalg.norm(
            np.array([sat1["x"], sat1["y"], sat1["z"]]) -
            np.array([sat2["x"], sat2["y"], sat2["z"]])
        )
        future_dist = np.linalg.norm(
            np.array(pos1_future) - np.array(pos2_future)
        )

        if future_dist >= current_dist:
            return 999.0

        closing_rate = (current_dist - future_dist) / 60.0
        if closing_rate <= 0:
            return 999.0

        return float(current_dist / closing_rate)

    except Exception:
        return 999.0


def compute_risk_score(distance_km: float, rel_velocity_km_s: float, tca_seconds: float) -> float:
    term1 = 1.0 / (distance_km + 1.0)
    term2 = rel_velocity_km_s / MAX_RELATIVE_VELOCITY_KM_S
    term3 = 1.0 / (tca_seconds + 1.0)
    return term1 * term2 * term3


def screen_conjunctions(positions: list, dt: datetime):
    if len(positions) < 2:
        log.warning("Not enough satellites to screen.")
        return []

    log.info(f"Starting conjunction screening for {len(positions)} satellites...")

    positions.sort(key=lambda s: s["altitude"])
    coords = np.array([[s["x"], s["y"], s["z"]] for s in positions])
    tree = KDTree(coords)
    pairs = tree.query_pairs(r=CONJUNCTION_THRESHOLD_KM)
    log.info(f"k-d tree found {len(pairs)} candidate pairs within {CONJUNCTION_THRESHOLD_KM} km.")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, tle_line1, tle_line2 FROM satellites")
    tle_map = {row["id"]: row for row in cursor.fetchall()}
    conn.close()

    conjunctions = []

    for i, j in pairs:
        sat1 = positions[i]
        sat2 = positions[j]

        alt_diff = abs(sat1["altitude"] - sat2["altitude"])
        if alt_diff > ORBITAL_SHELL_THICKNESS_KM:
            continue

        pos1 = np.array([sat1["x"], sat1["y"], sat1["z"]])
        pos2 = np.array([sat2["x"], sat2["y"], sat2["z"]])
        distance = float(np.linalg.norm(pos1 - pos2))

        vel1 = [sat1["vx"], sat1["vy"], sat1["vz"]]
        vel2 = [sat2["vx"], sat2["vy"], sat2["vz"]]
        rel_vel = compute_relative_velocity(vel1, vel2)

        tle1 = tle_map.get(sat1["id"])
        tle2 = tle_map.get(sat2["id"])

        if tle1 and tle2:
            sat1_with_tle = {**sat1, "tle_line1": tle1["tle_line1"], "tle_line2": tle1["tle_line2"]}
            sat2_with_tle = {**sat2, "tle_line1": tle2["tle_line1"], "tle_line2": tle2["tle_line2"]}
            tca = compute_tca(sat1_with_tle, sat2_with_tle, dt)
        else:
            tca = 999.0

        risk = compute_risk_score(distance, rel_vel, tca)

        conjunctions.append({
            "sat1_id":                sat1["id"],
            "sat2_id":                sat2["id"],
            "miss_distance_km":       round(distance, 4),
            "relative_velocity_km_s": round(rel_vel, 4),
            "risk_score":             round(risk, 8),
            "tca_seconds":            round(tca, 2),
            "timestamp":              dt.isoformat()
        })

    conjunctions.sort(key=lambda c: c["risk_score"], reverse=True)
    log.info(f"Computed {len(conjunctions)} conjunctions after shell filtering.")
    return conjunctions


def store_conjunctions(conjunctions: list):
    if not conjunctions:
        log.warning("No conjunctions to store.")
        return

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM conjunctions")

    cursor.executemany("""
        INSERT INTO conjunctions
            (sat1_id, sat2_id, miss_distance_km,
             relative_velocity_km_s, risk_score, timestamp)
        VALUES
            (:sat1_id, :sat2_id, :miss_distance_km,
             :relative_velocity_km_s, :risk_score, :timestamp)
    """, conjunctions)

    conn.commit()
    conn.close()
    log.info(f"Stored {len(conjunctions)} conjunctions in database.")


def run_conjunction_screening():
    dt = datetime.now(timezone.utc)
    positions = get_all_satellite_positions(dt)
    conjunctions = screen_conjunctions(positions, dt)
    store_conjunctions(conjunctions)
    return len(conjunctions)


if __name__ == "__main__":
    count = run_conjunction_screening()
    print(f"\nDone. {count} conjunctions stored.")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.*, s1.name as sat1_name, s2.name as sat2_name
        FROM conjunctions c
        JOIN satellites s1 ON c.sat1_id = s1.id
        JOIN satellites s2 ON c.sat2_id = s2.id
        ORDER BY c.risk_score DESC
        LIMIT 5
    """)
    rows = cursor.fetchall()
    conn.close()

    print("\nTop 5 highest risk conjunctions:")
    print(f"{'Sat 1':<25} {'Sat 2':<25} {'Dist(km)':>10} {'RelVel':>8} {'Risk':>12}")
    print("-" * 85)
    for row in rows:
        print(f"{row['sat1_name']:<25} {row['sat2_name']:<25} "
              f"{row['miss_distance_km']:>10.2f} "
              f"{row['relative_velocity_km_s']:>8.2f} "
              f"{row['risk_score']:>12.8f}")