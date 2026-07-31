import numpy as np
from datetime import datetime, timezone
import time

def brute_force_screen(positions, threshold_km):
    """
    O(n²) brute-force conjunction screening.
    Returns same format as k-d tree method.
    Used ONLY for benchmarking — never in production.
    """
    t_start = time.perf_counter()
    pairs   = []
    n       = len(positions)
    coords  = np.array([[s["x"], s["y"], s["z"]] for s in positions])

    for i in range(n):
        for j in range(i + 1, n):
            dist = np.linalg.norm(coords[i] - coords[j])
            if dist <= threshold_km:
                pairs.append((i, j, float(dist)))

    t_end = time.perf_counter()
    return pairs, (t_end - t_start) * 1000  # return ms