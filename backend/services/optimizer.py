# backend/services/optimizer.py
# Computes maneuver suggestions for high-risk conjunctions.
#
# For each conjunction, we calculate the minimum delta-V
# (velocity change in m/s) needed to increase the miss
# distance above a safe threshold.
#
# Delta-V is the real metric operators use — it determines
# how much fuel a satellite needs to burn.

import os
import sys
from datetime import datetime, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import numpy as np

from config import RISK_ALERT_THRESHOLD, CONJUNCTION_THRESHOLD_KM
from logger import get_logger
from backend.database import get_connection

log = get_logger(__name__)

# Safe miss distance we want to achieve after maneuver (km)
SAFE_MISS_DISTANCE_KM = 5.0

# Minimum risk score that triggers a maneuver suggestion
MANEUVER_RISK_THRESHOLD = 0.00001


def compute_delta_v(miss_distance_km: float, rel_velocity_km_s: float) -> float:
    """
    Estimates the minimum delta-V in m/s needed to avoid a conjunction.

    Physics:
    To move a satellite by delta_d km perpendicular to its orbit,
    you need a burn of approximately:

        delta_v = delta_d / (2 * T / (2*pi))

    Where T is the orbital period. For LEO (~550 km altitude):
        T ≈ 5760 seconds (96 minutes)

    We compute the gap needed (safe distance - current distance)
    and derive the burn required to create that separation.

    Returns delta_v in m/s (standard unit for maneuvers).
    """
    gap_needed_km = max(SAFE_MISS_DISTANCE_KM - miss_distance_km, 0.1)

    # Orbital period for Starlink LEO (~550 km altitude) in seconds
    orbital_period_s = 5760.0

    # delta-V formula for out-of-plane separation maneuver
    delta_v_km_s = (gap_needed_km * 2 * np.pi) / orbital_period_s

    # Convert to m/s
    delta_v_m_s = delta_v_km_s * 1000.0

    return round(delta_v_m_s, 4)


def generate_recommendation_text(
    sat1_name: str,
    sat2_name: str,
    miss_distance_km: float,
    rel_velocity_km_s: float,
    tca_seconds: float,
    delta_v_m_s: float
) -> str:
    """
    Generates a human-readable maneuver recommendation.
    This is what gets shown in the UI alert panel.
    """
    if tca_seconds < 999:
        tca_str = f"{tca_seconds:.0f} seconds"
    else:
        tca_str = "undetermined"

    return (
        f"CONJUNCTION ALERT: {sat1_name} and {sat2_name} "
        f"are predicted to pass within {miss_distance_km:.2f} km of each other "
        f"(relative velocity: {rel_velocity_km_s:.2f} km/s, "
        f"time to closest approach: {tca_str}). "
        f"Recommended action: execute a prograde burn of "
        f"{delta_v_m_s:.4f} m/s to increase miss distance "
        f"above {SAFE_MISS_DISTANCE_KM} km safe threshold."
    )


def generate_maneuvers():
    """
    Reads high-risk conjunctions from the database,
    computes delta-V for each, stores maneuver suggestions.
    Called by scheduler after conjunction screening.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Fetch high-risk conjunctions joined with satellite names
    cursor.execute("""
        SELECT
            c.id as conjunction_id,
            c.miss_distance_km,
            c.relative_velocity_km_s,
            c.risk_score,
            s1.name as sat1_name,
            s2.name as sat2_name
        FROM conjunctions c
        JOIN satellites s1 ON c.sat1_id = s1.id
        JOIN satellites s2 ON c.sat2_id = s2.id
        WHERE c.risk_score >= ?
        ORDER BY c.risk_score DESC
    """, (MANEUVER_RISK_THRESHOLD,))

    high_risk = cursor.fetchall()
    log.info(f"Generating maneuvers for {len(high_risk)} high-risk conjunctions...")

    if not high_risk:
        log.info("No conjunctions above maneuver threshold.")
        conn.close()
        return 0

    # Clear old maneuvers
    cursor.execute("DELETE FROM maneuvers")

    maneuvers = []
    for row in high_risk:
        delta_v = compute_delta_v(
            row["miss_distance_km"],
            row["relative_velocity_km_s"]
        )

        # TCA is not stored in DB yet — using 999 as placeholder
        # (will be added in a future schema update)
        rec_text = generate_recommendation_text(
            sat1_name=row["sat1_name"],
            sat2_name=row["sat2_name"],
            miss_distance_km=row["miss_distance_km"],
            rel_velocity_km_s=row["relative_velocity_km_s"],
            tca_seconds=999.0,
            delta_v_m_s=delta_v
        )

        maneuvers.append({
            "conjunction_id": row["conjunction_id"],
            "delta_v_m_s":    delta_v,
            "recommendation_text": rec_text
        })

    cursor.executemany("""
        INSERT INTO maneuvers (conjunction_id, delta_v_m_s, recommendation_text)
        VALUES (:conjunction_id, :delta_v_m_s, :recommendation_text)
    """, maneuvers)

    conn.commit()
    conn.close()
    log.info(f"Stored {len(maneuvers)} maneuver suggestions.")
    return len(maneuvers)


if __name__ == "__main__":
    count = generate_maneuvers()
    print(f"\nDone. {count} maneuvers generated.")

    # Show top 3
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT m.delta_v_m_s, m.recommendation_text
        FROM maneuvers m
        ORDER BY m.delta_v_m_s DESC
        LIMIT 3
    """)
    rows = cursor.fetchall()
    conn.close()

    print("\nTop 3 maneuver recommendations:")
    print("-" * 60)
    for row in rows:
        print(f"Delta-V: {row['delta_v_m_s']} m/s")
        print(f"{row['recommendation_text']}")
        print()