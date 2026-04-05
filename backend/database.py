# backend/database.py
# Creates the SQLite database, enables WAL mode,
# and sets up all three tables on first run.

import sqlite3
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import DATABASE_PATH
from logger import get_logger

log = get_logger(__name__)

def get_connection():
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    log.info("Initialising database...")
    conn = get_connection()
    cursor = conn.cursor()

    # Enable WAL mode — prevents read/write conflicts
    cursor.execute("PRAGMA journal_mode=WAL")

    # Table 1: satellites
    # Stores the latest TLE for each Starlink satellite
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS satellites (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT NOT NULL,
            tle_line1    TEXT NOT NULL,
            tle_line2    TEXT NOT NULL,
            last_updated TEXT NOT NULL
        )
    """)

    # Table 2: conjunctions
    # Stores pre-computed collision risk pairs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conjunctions (
            id                     INTEGER PRIMARY KEY AUTOINCREMENT,
            sat1_id                INTEGER NOT NULL,
            sat2_id                INTEGER NOT NULL,
            miss_distance_km       REAL NOT NULL,
            relative_velocity_km_s REAL NOT NULL,
            risk_score             REAL NOT NULL,
            timestamp              TEXT NOT NULL,
            FOREIGN KEY (sat1_id) REFERENCES satellites(id),
            FOREIGN KEY (sat2_id) REFERENCES satellites(id)
        )
    """)

    # Table 3: maneuvers
    # Stores delta-V suggestions linked to a conjunction
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS maneuvers (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            conjunction_id      INTEGER NOT NULL,
            delta_v_m_s         REAL NOT NULL,
            recommendation_text TEXT NOT NULL,
            FOREIGN KEY (conjunction_id) REFERENCES conjunctions(id)
        )
    """)

    conn.commit()
    conn.close()
    log.info("Database ready — 3 tables confirmed.")

if __name__ == "__main__":
    init_db()