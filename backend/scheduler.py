# backend/scheduler.py

import os
import sys
import time
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from config import SCHEDULER_INTERVAL_HOURS
from logger import get_logger
from backend.services.tle_fetcher import fetch_and_store
from backend.services.conjunction import run_conjunction_screening
from backend.services.optimizer import generate_maneuvers
from backend.services.forecaster import run_forecast

log = get_logger(__name__)


def run_pipeline():
    log.info("=" * 50)
    log.info("Pipeline started.")

    # Step 1 — Fetch TLEs
    try:
        sat_count = fetch_and_store()
        log.info(f"Step 1 complete: {sat_count} satellites stored.")
    except Exception as e:
        log.error(f"Step 1 failed (TLE fetch): {e}")
        log.warning("Continuing with existing TLE data.")

    # Step 2+3 — Propagate + screen conjunctions
    try:
        conj_count = run_conjunction_screening()
        log.info(f"Step 2+3 complete: {conj_count} conjunctions stored.")
    except Exception as e:
        log.error(f"Step 2+3 failed (conjunction screening): {e}")

    # Step 4 — Generate maneuvers
    try:
        man_count = generate_maneuvers()
        log.info(f"Step 4 complete: {man_count} maneuvers generated.")
    except Exception as e:
        log.error(f"Step 4 failed (optimizer): {e}")

    # Step 5 — 24-hour forecast
    # Runs last so it uses the freshest satellite IDs from Step 1.
    # Wrapped in try/except so a forecast failure never blocks the
    # rest of the pipeline — the app still works without forecast data.
    try:
        fc_count = run_forecast()
        log.info(f"Step 5 complete: {fc_count} forecast events stored.")
    except Exception as e:
        log.error(f"Step 5 failed (forecaster): {e}")

    log.info("Pipeline complete.")
    log.info("=" * 50)


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        func=run_pipeline,
        trigger=IntervalTrigger(hours=SCHEDULER_INTERVAL_HOURS),
        id="main_pipeline",
        name="OrbitWatch main pipeline",
        replace_existing=True
    )
    scheduler.start()
    log.info(f"Scheduler started — pipeline runs every {SCHEDULER_INTERVAL_HOURS} hours.")
    return scheduler


def run_pipeline_timed():
    """
    Research timing tool — measures each pipeline stage independently.
    Run manually only. Never called by the scheduler.
    """
    from backend.services.tle_fetcher import fetch_tles_from_celestrak, store_tles
    from backend.services.propagator import get_all_satellite_positions
    from backend.services.conjunction import screen_conjunctions, store_conjunctions
    from datetime import datetime, timezone

    timings = {}
    results = {}

    log.info("Timing Stage 1a: TLE network fetch...")
    t0 = time.perf_counter()
    satellites = fetch_tles_from_celestrak()
    timings["tle_network_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    results["n_fetched"] = len(satellites)

    log.info("Timing Stage 1b: TLE parse + store...")
    t0 = time.perf_counter()
    store_tles(satellites)
    timings["tle_store_ms"] = round((time.perf_counter() - t0) * 1000, 1)

    log.info("Timing Stage 2: SGP4 propagation...")
    dt = datetime.now(timezone.utc)
    t0 = time.perf_counter()
    positions = get_all_satellite_positions(dt)
    timings["sgp4_propagation_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    results["n_propagated"] = len(positions)

    log.info("Timing Stage 3: Conjunction screening...")
    t0 = time.perf_counter()
    conjunctions = screen_conjunctions(positions, dt)
    store_conjunctions(conjunctions)
    timings["screening_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    results["n_conjunctions"] = len(conjunctions)

    log.info("Timing Stage 4: Maneuver generation...")
    t0 = time.perf_counter()
    generate_maneuvers()
    timings["maneuver_ms"] = round((time.perf_counter() - t0) * 1000, 1)

    timings["total_excl_network_ms"] = round(
        timings["tle_store_ms"] + timings["sgp4_propagation_ms"] +
        timings["screening_ms"] + timings["maneuver_ms"], 1
    )
    timings["total_incl_network_ms"] = round(
        timings["tle_network_ms"] + timings["total_excl_network_ms"], 1
    )

    output = {**results, **timings}
    with open("pipeline_timing.json", "w") as f:
        json.dump(output, f, indent=2)

    print("\n" + "=" * 56)
    print("  ORBITWATCH PIPELINE TIMING — TABLE 3 DATA")
    print("=" * 56)
    print(f"  Satellites fetched:       {results.get('n_fetched', 0):>8,}")
    print(f"  Satellites propagated:    {results.get('n_propagated', 0):>8,}")
    print(f"  Conjunctions detected:    {results.get('n_conjunctions', 0):>8,}")
    print("-" * 56)
    print(f"  TLE network fetch:        {timings['tle_network_ms']:>8.1f} ms  ← network, excluded")
    print(f"  TLE parse + DB write:     {timings['tle_store_ms']:>8.1f} ms")
    print(f"  SGP4 propagation:         {timings['sgp4_propagation_ms']:>8.1f} ms")
    print(f"  Conjunction screening:    {timings['screening_ms']:>8.1f} ms")
    print(f"  Maneuver generation:      {timings['maneuver_ms']:>8.1f} ms")
    print("-" * 56)
    print(f"  TOTAL (excl. network):    {timings['total_excl_network_ms']:>8.1f} ms  ← paper result")
    print(f"  TOTAL (incl. network):    {timings['total_incl_network_ms']:>8.1f} ms")
    print("=" * 56)
    print("  Saved: pipeline_timing.json")
    return output


if __name__ == "__main__":
    log.info("Running pipeline once for testing...")
    run_pipeline()
    print("\nPipeline test complete.")