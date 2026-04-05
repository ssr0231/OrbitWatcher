# backend/services/tle_fetcher.py
# Fetches real Starlink TLE data from CelesTrak.
# Retries up to FETCH_RETRY_LIMIT times if the request fails.
# Stores results in the satellites table.

import time
import sqlite3
from datetime import datetime, timezone
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import requests
from config import (
    CELESTRAK_STARLINK_TLE_URL,
    FETCH_RETRY_LIMIT,
    FETCH_RETRY_DELAY_SECONDS
)
from logger import get_logger
from backend.database import get_connection

log = get_logger(__name__)


def fetch_tles_from_celestrak():
    """
    Fetches raw TLE text from CelesTrak with retry logic.
    Returns list of {name, line1, line2} dicts, or empty list on failure.
    """
    for attempt in range(1, FETCH_RETRY_LIMIT + 1):
        try:
            log.info(f"Fetching TLEs from CelesTrak (attempt {attempt}/{FETCH_RETRY_LIMIT})...")
            response = requests.get(CELESTRAK_STARLINK_TLE_URL, timeout=30)

            if response.status_code != 200:
                raise ValueError(f"HTTP {response.status_code}")

            lines = response.text.strip().splitlines()

            if len(lines) < 3:
                raise ValueError("Response too short — likely an empty feed")

            satellites = []
            for i in range(0, len(lines) - 2, 3):
                name  = lines[i].strip()
                line1 = lines[i + 1].strip()
                line2 = lines[i + 2].strip()

                # Basic TLE format validation
                if not line1.startswith("1 ") or not line2.startswith("2 "):
                    continue

                satellites.append({
                    "name":  name,
                    "line1": line1,
                    "line2": line2
                })

            log.info(f"Fetched {len(satellites)} Starlink satellites.")
            return satellites

        except Exception as e:
            log.error(f"Fetch attempt {attempt} failed: {e}")
            if attempt < FETCH_RETRY_LIMIT:
                log.info(f"Retrying in {FETCH_RETRY_DELAY_SECONDS} seconds...")
                time.sleep(FETCH_RETRY_DELAY_SECONDS)

    log.error("All fetch attempts failed. Using last known data from database.")
    return []


def store_tles(satellites: list):
    """
    Clears the satellites table and inserts fresh TLE data.
    This is a full refresh — old data is replaced entirely.
    """
    if not satellites:
        log.warning("No satellites to store — skipping database write.")
        return

    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()

    # Full refresh: delete old data, insert new
    cursor.execute("DELETE FROM satellites")

    cursor.executemany("""
        INSERT INTO satellites (name, tle_line1, tle_line2, last_updated)
        VALUES (:name, :line1, :line2, :updated)
    """, [
        {"name": s["name"], "line1": s["line1"], "line2": s["line2"], "updated": now}
        for s in satellites
    ])

    conn.commit()
    conn.close()
    log.info(f"Stored {len(satellites)} satellites in database.")


def fetch_and_store():
    """
    Main entry point called by the scheduler.
    Fetches TLEs and stores them in one step.
    """
    satellites = fetch_tles_from_celestrak()
    store_tles(satellites)
    return len(satellites)


if __name__ == "__main__":
    count = fetch_and_store()
    print(f"\nDone. {count} satellites stored.")