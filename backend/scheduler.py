# backend/scheduler.py
# Orchestrates the full data pipeline on a 6-hour cycle.
#
# Order every cycle:
#   1. Fetch fresh TLEs from CelesTrak
#   2. Propagate + screen conjunctions using k-d tree
#   3. Generate maneuver suggestions
#
# The API never triggers this — it only reads results.

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from config import SCHEDULER_INTERVAL_HOURS
from logger import get_logger
from backend.services.tle_fetcher import fetch_and_store
from backend.services.conjunction import run_conjunction_screening
from backend.services.optimizer import generate_maneuvers

log = get_logger(__name__)


def run_pipeline():
    """
    Full data pipeline — runs every SCHEDULER_INTERVAL_HOURS.
    Each step is wrapped in try/except so one failure
    does not stop the rest of the pipeline.
    """
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

    log.info("Pipeline complete.")
    log.info("=" * 50)


def start_scheduler():
    """
    Starts the background scheduler.
    Repeats every SCHEDULER_INTERVAL_HOURS automatically.
    """
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


if __name__ == "__main__":
    log.info("Running pipeline once for testing...")
    run_pipeline()
    print("\nPipeline test complete.")