"""
Run this standalone: python backend/benchmark.py
Produces all data for Tables 1, 2, 3.
"""
import sys, os, time, json, random
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
from scipy.spatial import KDTree
from datetime import datetime, timezone

from backend.services.propagator import get_all_satellite_positions
from backend.services.conjunction_bruteforce import brute_force_screen
from config import CONJUNCTION_THRESHOLD_KM

N_VALUES    = [1000, 2000, 3000, 5000, 7500, 10000, 12500, 15000]
THRESHOLDS  = [50, 30, 20, 10]
REPEATS     = 5

def kdtree_screen(positions, threshold_km):
    t0     = time.perf_counter()
    coords = np.array([[s["x"], s["y"], s["z"]] for s in positions])
    tree   = KDTree(coords)
    pairs  = tree.query_pairs(r=threshold_km)
    t1     = time.perf_counter()
    return set(pairs), (t1 - t0) * 1000

def run_scalability_benchmark():
    print("Loading all satellite positions...")
    all_positions = get_all_satellite_positions()
    print(f"Total available: {len(all_positions)}")

    results = []
    for n in N_VALUES:
        if n > len(all_positions):
            break
        sample = random.sample(all_positions, n)

        bf_times, kd_times, bf_counts, kd_counts = [], [], [], []

        for _ in range(REPEATS):
            bf_pairs, bf_ms = brute_force_screen(sample, CONJUNCTION_THRESHOLD_KM)
            kd_pairs, kd_ms = kdtree_screen(sample, CONJUNCTION_THRESHOLD_KM)
            bf_times.append(bf_ms)
            kd_times.append(kd_ms)
            bf_counts.append(len(bf_pairs))
            kd_counts.append(len(kd_pairs))

        row = {
            "n":          n,
            "bf_ms_mean": round(np.mean(bf_times), 1),
            "bf_ms_std":  round(np.std(bf_times), 1),
            "kd_ms_mean": round(np.mean(kd_times), 1),
            "kd_ms_std":  round(np.std(kd_times), 1),
            "speedup":    round(np.mean(bf_times) / np.mean(kd_times), 1),
            "bf_pairs":   int(np.mean(bf_counts)),
            "kd_pairs":   int(np.mean(kd_counts)),
        }
        print(f"n={n:6d} | BF: {row['bf_ms_mean']:8.1f}ms | "
              f"KD: {row['kd_ms_mean']:6.1f}ms | "
              f"Speedup: {row['speedup']:5.1f}x")
        results.append(row)

    with open("benchmark_scalability.json", "w") as f:
        json.dump(results, f, indent=2)
    print("\nSaved: benchmark_scalability.json")
    return results

def run_completeness_benchmark():
    all_positions = get_all_satellite_positions()
    sample = random.sample(all_positions, min(10000, len(all_positions)))

    print("\nDetection completeness at different thresholds:")
    completeness_results = []

    for threshold in THRESHOLDS:
        bf_pairs, _ = brute_force_screen(sample, threshold)
        kd_pairs, _ = kdtree_screen(sample, threshold)

        bf_set = set((min(a,b), max(a,b)) for a,b,_ in bf_pairs)
        kd_set = kd_pairs  # already a set of tuples

        if len(bf_set) == 0:
            completeness = 100.0
        else:
            found     = len(kd_set & bf_set)
            completeness = round(100.0 * found / len(bf_set), 3)
            false_neg    = len(bf_set - kd_set)

        row = {
            "threshold_km": threshold,
            "bf_pairs":     len(bf_set),
            "kd_pairs":     len(kd_set),
            "completeness": completeness,
            "false_negatives": false_neg if len(bf_set) > 0 else 0
        }
        print(f"Threshold {threshold:3d} km | BF: {len(bf_set):5d} | "
              f"KD: {len(kd_set):5d} | Completeness: {completeness:.3f}%")
        completeness_results.append(row)

    with open("benchmark_completeness.json", "w") as f:
        json.dump(completeness_results, f, indent=2)
    print("Saved: benchmark_completeness.json")

if __name__ == "__main__":
    run_scalability_benchmark()
    run_completeness_benchmark()