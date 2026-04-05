# backend/services/propagator.py
# Converts TLE data into 3D positions and velocities using SGP4.
# SGP4 is the industry-standard orbital propagator used by
# every space agency and tracking system in the world.

import os
import sys
from datetime import datetime, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import numpy as np
from sgp4.api import Satrec, jday

from logger import get_logger
from backend.database import get_connection

log = get_logger(__name__)

# Earth's radius in km — used to compute altitude
EARTH_RADIUS_KM = 6371.0


def propagate_satellite(tle_line1: str, tle_line2: str, dt: datetime):
    """
    Takes TLE lines and a datetime, returns position and velocity.

    Position is in ECI coordinates (Earth-Centered Inertial) in km.
    ECI means the origin is Earth's center, axes point to fixed stars.
    This is the correct 3D coordinate system for orbital mechanics.

    Returns:
        position (x, y, z) in km
        velocity (vx, vy, vz) in km/s
        or None, None if propagation fails
    """
    try:
        satellite = Satrec.twoline2rv(tle_line1, tle_line2)

        # Convert datetime to Julian date — what SGP4 requires
        jd, fr = jday(
            dt.year, dt.month, dt.day,
            dt.hour, dt.minute, dt.second + dt.microsecond / 1e6
        )

        # e = error code (0 means success)
        # r = position vector [x, y, z] in km
        # v = velocity vector [vx, vy, vz] in km/s
        e, r, v = satellite.sgp4(jd, fr)

        if e != 0:
            return None, None

        return r, v

    except Exception as ex:
        log.warning(f"SGP4 propagation failed: {ex}")
        return None, None


def compute_altitude(position: list) -> float:
    """
    Converts ECI position vector to altitude above Earth's surface.

    Altitude = distance from Earth's center - Earth's radius
    """
    distance_from_center = np.sqrt(
        position[0]**2 + position[1]**2 + position[2]**2
    )
    return distance_from_center - EARTH_RADIUS_KM


def get_all_satellite_positions(dt: datetime = None):
    """
    Loads all satellites from the database and propagates
    each one to the given datetime.

    Returns a list of dicts with position, velocity, altitude
    for every satellite that propagates successfully.

    This is called by conjunction.py to get current positions
    for collision screening.
    """
    if dt is None:
        dt = datetime.now(timezone.utc)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, tle_line1, tle_line2 FROM satellites")
    rows = cursor.fetchall()
    conn.close()

    log.info(f"Propagating {len(rows)} satellites to {dt.isoformat()}...")

    results = []
    failed = 0

    for row in rows:
        pos, vel = propagate_satellite(row["tle_line1"], row["tle_line2"], dt)

        if pos is None:
            failed += 1
            continue

        altitude = compute_altitude(pos)

        # Skip satellites with unrealistic altitudes
        # (decayed or not yet launched)
        if altitude < 100 or altitude > 60000:
            failed += 1
            continue

        results.append({
            "id":       row["id"],
            "name":     row["name"],
            "x":        pos[0],
            "y":        pos[1],
            "z":        pos[2],
            "vx":       vel[0],
            "vy":       vel[1],
            "vz":       vel[2],
            "altitude": altitude
        })

    log.info(f"Propagated {len(results)} satellites successfully. {failed} failed or skipped.")
    return results


if __name__ == "__main__":
    positions = get_all_satellite_positions()
    print(f"\nTotal propagated: {len(positions)}")
    print("\nSample (first 3):")
    for sat in positions[:3]:
        print(f"  {sat['name']:<30} alt={sat['altitude']:.1f} km  "
              f"pos=({sat['x']:.1f}, {sat['y']:.1f}, {sat['z']:.1f})")