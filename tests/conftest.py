# tests/conftest.py
# Shared fixtures for the OrbitWatch test suite.
#
# Isolation strategy:
#   - Every test function gets a fresh temporary SQLite database.
#   - backend.database.DATABASE_PATH is monkeypatched to point at it.
#   - run_pipeline() and start_scheduler() are patched to no-ops so
#     tests never make network requests or spin up background threads.
#   - monkeypatch restores all patches automatically after each test.

import pytest
import sqlite3
import sys
import os

# Ensure the project root is on sys.path so `import config`,
# `from backend.xxx import yyy` etc. work from any working directory.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


# ── Database fixture ───────────────────────────────────────

@pytest.fixture()
def initialized_db(tmp_path, monkeypatch):
    """
    Creates a fresh temporary SQLite database with the full schema,
    then patches backend.database.DATABASE_PATH to point at it.

    All database operations performed during the test — including those
    made by routes via get_db() — use this isolated temp database.
    The real data/orbitwatch.db is never touched.

    Returns the path string so tests that need direct DB access
    (e.g. to insert fixtures) can open it with sqlite3.connect().
    """
    db_path = str(tmp_path / "test_orbitwatch.db")

    import backend.database as db_module
    monkeypatch.setattr(db_module, "DATABASE_PATH", db_path)

    from backend.database import init_db
    init_db()

    return db_path


# ── TestClient fixture ─────────────────────────────────────

@pytest.fixture()
def client(initialized_db, monkeypatch):
    """
    Returns a FastAPI TestClient backed by the isolated test database.

    run_pipeline and start_scheduler are patched to no-ops:
    - Tests must never make live CelesTrak network requests.
    - Tests must not leave background scheduler threads running.

    The startup event fires (via TestClient context manager), calls
    init_db() again (idempotent — no harm), then the two no-ops.
    Routes work against the already-initialized test database.
    """
    import backend.main as main_module
    monkeypatch.setattr(main_module, "run_pipeline",    lambda: None)
    monkeypatch.setattr(main_module, "start_scheduler", lambda: None)

    from backend.main import app
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        yield c


# ── Sample data fixtures ───────────────────────────────────
# Using real TLE format lines so tests are representative of
# actual data the application handles in production.

_TLE1 = "1 44713U 19074A   20034.51536257  .00001659  00000-0  13101-3 0  9993"
_TLE2 = "2 44713  52.9972   8.5268 0001479  79.6990 280.4394 15.06393999 13523"
_TS   = "2024-01-01T00:00:00"


@pytest.fixture()
def sample_satellite(initialized_db):
    """Inserts one satellite record; returns its database id."""
    conn = sqlite3.connect(initialized_db)
    conn.execute(
        "INSERT INTO satellites (name, tle_line1, tle_line2, last_updated) VALUES (?,?,?,?)",
        ("STARLINK-TEST", _TLE1, _TLE2, _TS)
    )
    sat_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.commit()
    conn.close()
    return sat_id


@pytest.fixture()
def sample_conjunction(initialized_db, sample_satellite):
    """
    Inserts a second satellite and a conjunction between the two.
    Returns the conjunction id.
    """
    conn = sqlite3.connect(initialized_db)
    conn.execute(
        "INSERT INTO satellites (name, tle_line1, tle_line2, last_updated) VALUES (?,?,?,?)",
        ("STARLINK-TEST-2", _TLE1, _TLE2, _TS)
    )
    sat2_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.execute("""
        INSERT INTO conjunctions
            (sat1_id, sat2_id, miss_distance_km, relative_velocity_km_s,
             risk_score, tca_seconds, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (sample_satellite, sat2_id, 12.5, 9.3, 0.012, 45.0, _TS))
    conj_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.commit()
    conn.close()
    return conj_id


@pytest.fixture()
def sample_maneuver(initialized_db, sample_conjunction):
    """Inserts a maneuver recommendation for the sample conjunction."""
    conn = sqlite3.connect(initialized_db)
    conn.execute(
        "INSERT INTO maneuvers (conjunction_id, delta_v_m_s, recommendation_text) VALUES (?,?,?)",
        (sample_conjunction, 2.5, "Execute prograde burn of 2.5 m/s to increase separation.")
    )
    man_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.commit()
    conn.close()
    return man_id