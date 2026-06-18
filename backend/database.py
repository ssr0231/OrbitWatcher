# backend/database.py

import sqlite3
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import DATABASE_PATH
from logger import get_logger

log = get_logger(__name__)


def get_connection():
    """
    Opens a new SQLite connection for each request.
    Database is stored outside OneDrive to avoid 2-second sync overhead.
    WAL mode and memory settings are applied per connection.
    """
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row

    # Performance settings
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA cache_size=-32000")   # 32 MB page cache
    conn.execute("PRAGMA temp_store=MEMORY")
    conn.execute("PRAGMA synchronous=NORMAL")

    return conn


def init_db():
    log.info("Initialising database...")
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("PRAGMA journal_mode=WAL")

    # Table 1: satellites
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
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conjunctions (
            id                     INTEGER PRIMARY KEY AUTOINCREMENT,
            sat1_id                INTEGER NOT NULL,
            sat2_id                INTEGER NOT NULL,
            miss_distance_km       REAL NOT NULL,
            relative_velocity_km_s REAL NOT NULL,
            risk_score             REAL NOT NULL,
            tca_seconds            REAL,
            timestamp              TEXT NOT NULL,
            FOREIGN KEY (sat1_id) REFERENCES satellites(id),
            FOREIGN KEY (sat2_id) REFERENCES satellites(id)
        )
    """)

    # Migration: if upgrading from a database created before TCA was
    # tracked, the table above already existed without this column and
    # CREATE TABLE IF NOT EXISTS will not have added it. Add it now.
    # Safe to run every startup — silently no-ops once the column exists.
    try:
        cursor.execute("ALTER TABLE conjunctions ADD COLUMN tca_seconds REAL")
        log.info("Migrated existing database: added tca_seconds column.")
    except sqlite3.OperationalError:
        pass  # column already exists

    # Table 3: maneuvers
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS maneuvers (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            conjunction_id      INTEGER NOT NULL,
            delta_v_m_s         REAL NOT NULL,
            recommendation_text TEXT NOT NULL,
            FOREIGN KEY (conjunction_id) REFERENCES conjunctions(id)
        )
    """)

    # Indexes for fast API queries
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_conjunctions_risk
        ON conjunctions(risk_score DESC)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_conjunctions_sat1
        ON conjunctions(sat1_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_conjunctions_sat2
        ON conjunctions(sat2_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_satellites_name
        ON satellites(name)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_maneuvers_conjunction
        ON maneuvers(conjunction_id)
    """)

    conn.commit()
    conn.close()
    log.info("Database ready — 3 tables, 5 indexes confirmed.")