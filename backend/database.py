# backend/database.py

import sqlite3
import os
import sys
from contextlib import contextmanager

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import DATABASE_PATH
from logger import get_logger

log = get_logger(__name__)

# How long to wait (seconds) for a locked database before raising
# OperationalError. Default SQLite Python value is 5 — being explicit
# here makes the intent clear and allows future env-var exposure.
_DB_TIMEOUT = 5


def get_connection() -> sqlite3.Connection:
    """
    Opens a raw SQLite connection with performance PRAGMAs applied.
    Prefer get_db() (context manager) over calling this directly —
    get_db() guarantees the connection is closed even if an exception
    is raised inside the caller.
    """
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH, timeout=_DB_TIMEOUT)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA cache_size=-32000")
    conn.execute("PRAGMA temp_store=MEMORY")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


@contextmanager
def get_db():
    """
    Context manager for database connections.

    Guarantees the connection is closed when the block exits,
    whether it exits normally or via an exception. This prevents
    connection leaks when routes or services raise errors mid-query.

    Usage:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(...)
            rows = cursor.fetchall()
        # conn is closed here automatically
    """
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def check_database() -> bool:
    """
    Lightweight database liveness check.
    Executes a trivial query — if this succeeds the DB file exists,
    is readable, and SQLite can open it. Used by the /health endpoint.
    Returns True on success, False on any error.
    """
    try:
        with get_db() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception as e:
        log.error(f"Database health check failed: {e}")
        return False


def init_db():
    log.info("Initialising database...")
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("PRAGMA journal_mode=WAL")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS satellites (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT NOT NULL,
            tle_line1    TEXT NOT NULL,
            tle_line2    TEXT NOT NULL,
            last_updated TEXT NOT NULL
        )
    """)

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

    try:
        cursor.execute("ALTER TABLE conjunctions ADD COLUMN tca_seconds REAL")
        log.info("Migrated existing database: added tca_seconds column.")
    except sqlite3.OperationalError:
        pass

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS maneuvers (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            conjunction_id      INTEGER NOT NULL,
            delta_v_m_s         REAL NOT NULL,
            recommendation_text TEXT NOT NULL,
            FOREIGN KEY (conjunction_id) REFERENCES conjunctions(id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS forecast (
            id                     INTEGER PRIMARY KEY AUTOINCREMENT,
            sat1_id                INTEGER NOT NULL,
            sat2_id                INTEGER NOT NULL,
            approach_time          TEXT NOT NULL,
            predicted_miss_km      REAL NOT NULL,
            relative_velocity_km_s REAL NOT NULL,
            risk_score             REAL NOT NULL,
            created_at             TEXT NOT NULL,
            FOREIGN KEY (sat1_id) REFERENCES satellites(id),
            FOREIGN KEY (sat2_id) REFERENCES satellites(id)
        )
    """)

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
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_forecast_approach
        ON forecast(approach_time ASC)
    """)

    conn.commit()
    conn.close()
    log.info("Database ready — 4 tables, 6 indexes confirmed.")