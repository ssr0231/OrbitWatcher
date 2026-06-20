# backend/services/conjunction.py
import os
import sys
from datetime import datetime, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import numpy as np
from scipy.spatial import KDTree

from config import (
    CONJUNCTION_THRESHOLD_KM,
    MAX_RELATIVE_VELOCITY_KM_S
)
from logger import get_logger
from backend.database import get_connection
from backend.services.propagator import get_all_satellite_positions

log = get_logger(__name__)


def compute_relative_velocity(v1: list, v2: list) -> float:
    dv = np.array(v1) - np.array(v2)
    return float(np.linalg.norm(dv))


def compute_tca(sat1: dict, sat2: dict) -> float:
    """
    Estimates time to closest approach (TCA) in seconds, directly from
    each satellite's CURRENT position and velocity vectors — no forward
    propagation needed.

    Why this replaces the old 60-second-lookahead method:
    At the relative velocities seen between Starlink satellites
    (commonly 5-15 km/s), the entire 50 km screening window is crossed
    in just a few seconds. Jumping 60 seconds into the future to check
    "closer or farther?" almost always landed long after the encounter
    was over, so that method reported "undetermined" for nearly every
    real pair.

    This version instead treats relative motion as a straight line over
    the short timescale that matters (valid here since the conjunction
    window is seconds, vs. a ~90-minute orbital period) and solves
    directly for the time that minimizes separation distance:

        time_to_closest_approach = -(p_rel . v_rel) / |v_rel|^2

    where p_rel and v_rel are the relative position and velocity
    vectors between the two satellites right now.

    Returns:
        Positive seconds -> closest approach is still ahead.
        Negative seconds -> closest approach already happened that
                             many seconds ago.
        999.0            -> relative velocity is ~0 (satellites moving
                             together), or the estimate exceeds one
                             orbital period and is no longer reliable.
    """
    p_rel = np.array([
        sat1["x"] - sat2["x"],
        sat1["y"] - sat2["y"],
        sat1["z"] - sat2["z"]
    ])
    v_rel = np.array([
        sat1["vx"] - sat2["vx"],
        sat1["vy"] - sat2["vy"],
        sat1["vz"] - sat2["vz"]
    ])

    v_rel_sq = float(np.dot(v_rel, v_rel))
    if v_rel_sq < 1e-6:
        return 999.0

    tca = float(-np.dot(p_rel, v_rel) / v_rel_sq)

    # Beyond roughly one LEO orbital period, the straight-line
    # assumption this estimate relies on is no longer meaningful —
    # report undetermined rather than a falsely precise-looking number.
    if abs(tca) > 5400.0:
        return 999.0

    return tca


def compute_risk_score(distance_km: float, rel_velocity_km_s: float, tca_seconds: float) -> float:
    term1 = 1.0 / (distance_km + 1.0)
    term2 = rel_velocity_km_s / MAX_RELATIVE_VELOCITY_KM_S
    # tca_seconds can now be negative (closest approach already passed) —
    # use magnitude, since "3 seconds from now" and "3 seconds ago" are
    # equally significant for risk ranking purposes.
    term3 = 1.0 / (abs(tca_seconds) + 1.0)
    return term1 * term2 * term3


def screen_conjunctions(positions: list, dt: datetime):
    """
    Conjunction candidate screening using a single k-d tree over the
    full catalog.

    Note on design: an earlier version of this function attempted
    altitude-band pre-partitioning (grouping satellites into shells
    before building the tree) on the theory that it would reduce the
    search space. That was tested and measured against real Starlink
    altitude data: because the live constellation flies in tight,
    deliberately-maintained shells, the vast majority of satellites
    cluster into a single ~100km band anyway, so partitioning provided
    no speed benefit (it was measurably slower, due to the overhead of
    building several smaller tree objects instead of one). It was
    removed in favor of this simpler, faster, single-tree approach.
    If the catalog being screened is ever much more vertically
    dispersed (e.g. a combined multi-operator catalog spanning many
    distinct shells), partitioning would be worth revisiting.
    """
    if len(positions) < 2:
        log.warning("Not enough satellites to screen.")
        return []

    log.info(f"Starting conjunction screening for {len(positions)} satellites...")

    coords = np.array([[s["x"], s["y"], s["z"]] for s in positions])
    tree = KDTree(coords)
    pairs = tree.query_pairs(r=CONJUNCTION_THRESHOLD_KM)
    log.info(f"k-d tree found {len(pairs)} candidate pairs within {CONJUNCTION_THRESHOLD_KM} km.")

    conjunctions = []

    for i, j in pairs:
        sat1 = positions[i]
        sat2 = positions[j]

        pos1 = np.array([sat1["x"], sat1["y"], sat1["z"]])
        pos2 = np.array([sat2["x"], sat2["y"], sat2["z"]])
        distance = float(np.linalg.norm(pos1 - pos2))

        vel1 = [sat1["vx"], sat1["vy"], sat1["vz"]]
        vel2 = [sat2["vx"], sat2["vy"], sat2["vz"]]
        rel_vel = compute_relative_velocity(vel1, vel2)

        tca = compute_tca(sat1, sat2)

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
    log.info(f"Computed {len(conjunctions)} conjunctions.")
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
             relative_velocity_km_s, risk_score, tca_seconds, timestamp)
        VALUES
            (:sat1_id, :sat2_id, :miss_distance_km,
             :relative_velocity_km_s, :risk_score, :tca_seconds, :timestamp)
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