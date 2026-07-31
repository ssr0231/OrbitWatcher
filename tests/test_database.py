# tests/test_database.py
# Validates database initialisation, schema correctness, the
# get_db() context manager, and the check_database() health probe.
#
# These tests verify Phase 2 hardening: connection safety,
# guaranteed close on exceptions, and the health check that
# backs the /health endpoint.

import pytest
import sqlite3


class TestInitDb:
    def test_creates_satellites_table(self, initialized_db):
        conn = sqlite3.connect(initialized_db)
        tables = {
            r[0]
            for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        conn.close()
        assert "satellites" in tables

    def test_creates_conjunctions_table(self, initialized_db):
        conn = sqlite3.connect(initialized_db)
        tables = {
            r[0]
            for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        conn.close()
        assert "conjunctions" in tables

    def test_creates_maneuvers_table(self, initialized_db):
        conn = sqlite3.connect(initialized_db)
        tables = {
            r[0]
            for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        conn.close()
        assert "maneuvers" in tables

    def test_creates_forecast_table(self, initialized_db):
        conn = sqlite3.connect(initialized_db)
        tables = {
            r[0]
            for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        conn.close()
        assert "forecast" in tables

    def test_creates_all_six_indexes(self, initialized_db):
        conn = sqlite3.connect(initialized_db)
        indexes = {
            r[0]
            for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index'"
            )
        }
        conn.close()

        required = {
            "idx_conjunctions_risk",
            "idx_conjunctions_sat1",
            "idx_conjunctions_sat2",
            "idx_satellites_name",
            "idx_maneuvers_conjunction",
            "idx_forecast_approach",
        }

        assert required <= indexes

    def test_is_idempotent(self, initialized_db):
        """Calling init_db() twice must not raise or duplicate tables."""
        from backend.database import init_db

        init_db()

        conn = sqlite3.connect(initialized_db)
        count = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master "
            "WHERE type='table' AND name='satellites'"
        ).fetchone()[0]
        conn.close()

        assert count == 1

    def test_satellites_has_required_columns(self, initialized_db):
        conn = sqlite3.connect(initialized_db)
        cols = {
            r[1]
            for r in conn.execute("PRAGMA table_info(satellites)")
        }
        conn.close()

        assert {
            "id",
            "name",
            "tle_line1",
            "tle_line2",
            "last_updated",
        } <= cols

    def test_conjunctions_has_tca_seconds_column(self, initialized_db):
        """
        tca_seconds was added via ALTER TABLE migration
        and must always be present.
        """
        conn = sqlite3.connect(initialized_db)
        cols = {
            r[1]
            for r in conn.execute("PRAGMA table_info(conjunctions)")
        }
        conn.close()

        assert "tca_seconds" in cols

    def test_conjunctions_has_all_required_columns(self, initialized_db):
        conn = sqlite3.connect(initialized_db)
        cols = {
            r[1]
            for r in conn.execute("PRAGMA table_info(conjunctions)")
        }
        conn.close()

        required = {
            "id",
            "sat1_id",
            "sat2_id",
            "miss_distance_km",
            "relative_velocity_km_s",
            "risk_score",
            "tca_seconds",
            "timestamp",
        }

        assert required <= cols


class TestGetDbContextManager:
    """
    Verifies that get_db() guarantees connection cleanup in all
    code paths — the Phase 2 fix for connection leak risk in routes.
    """

    def test_connection_closed_on_normal_exit(self, initialized_db):
        from backend.database import get_db

        with get_db() as conn:
            conn.execute("SELECT 1")
            held = conn

        with pytest.raises(Exception, match="closed"):
            held.execute("SELECT 1")

    def test_connection_closed_when_exception_raised(self, initialized_db):
        """Connection must close even when the caller raises an exception."""
        from backend.database import get_db

        held = None

        try:
            with get_db() as conn:
                held = conn
                raise RuntimeError("simulated application error")
        except RuntimeError:
            pass

        assert held is not None

        with pytest.raises(Exception):
            held.execute("SELECT 1")

    def test_yields_usable_connection(self, initialized_db):
        from backend.database import get_db

        with get_db() as conn:
            result = conn.execute("SELECT 1").fetchone()

        assert result[0] == 1

    def test_row_factory_set_on_connection(
        self,
        initialized_db,
        sample_satellite,
    ):
        """Connections must use sqlite3.Row so dict(row) works in routes."""
        from backend.database import get_db

        with get_db() as conn:
            row = conn.execute(
                "SELECT name FROM satellites LIMIT 1"
            ).fetchone()

        assert row["name"] == "STARLINK-TEST"


class TestCheckDatabase:
    def test_returns_true_when_db_accessible(self, initialized_db):
        from backend.database import check_database

        assert check_database() is True

    def test_returns_false_when_connection_fails(self, monkeypatch):
        """
        check_database() must return False when the database
        connection cannot be established.
        """
        import backend.database as db_mod

        def raise_connection_error():
            raise sqlite3.OperationalError(
                "simulated database connection failure"
            )

        monkeypatch.setattr(
            db_mod,
            "get_connection",
            raise_connection_error,
        )

        assert db_mod.check_database() is False

    def test_does_not_raise_on_failure(self, monkeypatch):
        """
        check_database() must remain exception-safe when the
        database connection fails.
        """
        import backend.database as db_mod

        def raise_connection_error():
            raise sqlite3.OperationalError(
                "simulated database connection failure"
            )

        monkeypatch.setattr(
            db_mod,
            "get_connection",
            raise_connection_error,
        )

        try:
            result = db_mod.check_database()
        except Exception as exc:
            pytest.fail(
                f"check_database() raised unexpectedly: {exc}"
            )

        assert result is False