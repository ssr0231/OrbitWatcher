# tests/test_routes.py
# End-to-end API tests for every route in OrbitWatch.
#
# Uses a fresh isolated SQLite database per test (via conftest.py).
# No real network requests are made — run_pipeline is patched to a no-op.
#
# Validates:
#   - HTTP status codes (200, 404, 422, 503)
#   - Response envelope structure (status, count, data)
#   - Query parameter validation (limit bounds)
#   - Data integrity (inserted records appear in responses)
#   - Business logic (conjunctions sorted DESC by risk, past forecasts excluded)
#   - Security headers on every response (Phase 3 hardening)
#   - Cache-Control headers on API routes (Phase 1 hardening)

import pytest
import sqlite3

_TS  = "2024-01-01T00:00:00"
_TLE1 = "1 44713U 19074A   20034.51536257  .00001659  00000-0  13101-3 0  9993"
_TLE2 = "2 44713  52.9972   8.5268 0001479  79.6990 280.4394 15.06393999 13523"


# ── /health ───────────────────────────────────────────────────────────────────

class TestHealth:
    def test_returns_200(self, client):
        assert client.get("/health").status_code == 200

    def test_response_has_required_fields(self, client):
        data = client.get("/health").json()
        assert "status" in data
        assert "version" in data
        assert "database" in data

    def test_version_matches_app_version_constant(self, client):
        from config import APP_VERSION
        assert client.get("/health").json()["version"] == APP_VERSION

    def test_status_is_ok_with_accessible_database(self, client):
        data = client.get("/health").json()
        assert data["status"] == "ok"
        assert data["database"] == "ok"


# ── Security headers (Phase 3) ────────────────────────────────────────────────

class TestSecurityHeaders:
    """
    Every response — API and non-API — must carry the four security
    headers added in Phase 3 backend hardening.
    """

    @pytest.fixture(autouse=True)
    def response(self, client):
        self._r = client.get("/health")

    def test_x_content_type_options(self):
        assert self._r.headers.get("x-content-type-options") == "nosniff"

    def test_x_frame_options(self):
        assert self._r.headers.get("x-frame-options") == "DENY"

    def test_referrer_policy(self):
        assert self._r.headers.get("referrer-policy") == "strict-origin-when-cross-origin"

    def test_x_xss_protection(self):
        assert self._r.headers.get("x-xss-protection") == "1; mode=block"

    def test_headers_also_present_on_api_response(self, client):
        r = client.get("/api/v1/tles")
        assert r.headers.get("x-content-type-options") == "nosniff"
        assert r.headers.get("x-frame-options") == "DENY"


# ── Cache-Control (Phase 1) ───────────────────────────────────────────────────

class TestCacheControl:
    """
    API responses (/api/v1/*) must have no-store cache headers.
    Non-API responses (/, /health) must NOT have these headers so
    static assets can be cached by the browser.
    """

    def test_api_response_has_no_store(self, client):
        r = client.get("/api/v1/tles")
        cc = r.headers.get("cache-control", "")
        assert "no-store" in cc

    def test_api_conjunctions_has_no_cache(self, client):
        r = client.get("/api/v1/conjunctions")
        cc = r.headers.get("cache-control", "")
        assert "no-store" in cc

    def test_health_endpoint_not_no_store(self, client):
        """
        /health is not under /api/v1/ — it must NOT have no-store
        so load balancers can cache liveness results if they choose.
        """
        r = client.get("/health")
        cc = r.headers.get("cache-control", "")
        assert "no-store" not in cc


# ── GET /api/v1/tles ──────────────────────────────────────────────────────────

class TestTLEs:
    def test_returns_200(self, client):
        assert client.get("/api/v1/tles").status_code == 200

    def test_envelope_structure(self, client):
        data = client.get("/api/v1/tles").json()
        assert data["status"] == "success"
        assert "count" in data
        assert isinstance(data["data"], list)

    def test_empty_on_fresh_database(self, client):
        data = client.get("/api/v1/tles").json()
        assert data["count"] == 0
        assert data["data"] == []

    def test_returns_inserted_satellite(self, client, sample_satellite):
        data = client.get("/api/v1/tles").json()
        assert data["count"] == 1
        sat = data["data"][0]
        assert sat["name"] == "STARLINK-TEST"
        assert sat["tle_line1"] == _TLE1
        assert sat["tle_line2"] == _TLE2
        assert "id" in sat
        assert "last_updated" in sat

    def test_count_matches_data_length(self, client, sample_satellite):
        data = client.get("/api/v1/tles").json()
        assert data["count"] == len(data["data"])


# ── GET /api/v1/conjunctions ──────────────────────────────────────────────────

class TestConjunctions:
    def test_returns_200(self, client):
        assert client.get("/api/v1/conjunctions").status_code == 200

    def test_envelope_structure(self, client):
        data = client.get("/api/v1/conjunctions").json()
        assert data["status"] == "success"
        assert "count" in data
        assert isinstance(data["data"], list)

    def test_empty_on_fresh_database(self, client):
        assert client.get("/api/v1/conjunctions").json()["count"] == 0

    def test_returns_inserted_conjunction(self, client, sample_conjunction):
        data = client.get("/api/v1/conjunctions").json()
        assert data["count"] == 1
        item = data["data"][0]
        assert item["sat1_name"] == "STARLINK-TEST"
        assert item["sat2_name"] == "STARLINK-TEST-2"
        assert item["miss_distance_km"] == pytest.approx(12.5)
        assert item["relative_velocity_km_s"] == pytest.approx(9.3)
        assert "risk_score" in item
        assert "tca_seconds" in item

    def test_limit_default_accepted(self, client):
        assert client.get("/api/v1/conjunctions").status_code == 200

    def test_limit_minimum_accepted(self, client):
        assert client.get("/api/v1/conjunctions?limit=1").status_code == 200

    def test_limit_maximum_accepted(self, client):
        assert client.get("/api/v1/conjunctions?limit=500").status_code == 200

    def test_limit_above_maximum_rejected(self, client):
        assert client.get("/api/v1/conjunctions?limit=501").status_code == 422

    def test_limit_zero_rejected(self, client):
        assert client.get("/api/v1/conjunctions?limit=0").status_code == 422

    def test_limit_negative_rejected(self, client):
        assert client.get("/api/v1/conjunctions?limit=-1").status_code == 422

    def test_sorted_by_risk_score_descending(self, client, initialized_db):
        """
        The most dangerous conjunction must be first. This is the
        primary sort contract that the frontend alert panel depends on.
        """
        conn = sqlite3.connect(initialized_db)
        # Insert three satellites
        for name in ("SAT-A", "SAT-B", "SAT-C"):
            conn.execute(
                "INSERT INTO satellites (name, tle_line1, tle_line2, last_updated) VALUES (?,?,?,?)",
                (name, _TLE1, _TLE2, _TS)
            )
        # Two conjunctions with deliberate risk ordering
        conn.execute(
            "INSERT INTO conjunctions (sat1_id, sat2_id, miss_distance_km, relative_velocity_km_s, risk_score, tca_seconds, timestamp) VALUES (1,2,5.0,10.0,0.08,5.0,?)", (_TS,)
        )
        conn.execute(
            "INSERT INTO conjunctions (sat1_id, sat2_id, miss_distance_km, relative_velocity_km_s, risk_score, tca_seconds, timestamp) VALUES (2,3,20.0,8.0,0.01,30.0,?)", (_TS,)
        )
        conn.commit()
        conn.close()

        data = client.get("/api/v1/conjunctions").json()
        scores = [item["risk_score"] for item in data["data"]]
        assert scores == sorted(scores, reverse=True)


# ── GET /api/v1/analytics ─────────────────────────────────────────────────────

class TestAnalytics:
    def test_returns_200(self, client):
        assert client.get("/api/v1/analytics").status_code == 200

    def test_envelope_structure(self, client):
        data = client.get("/api/v1/analytics").json()
        assert data["status"] == "success"
        assert "data" in data

    def test_contains_all_expected_keys(self, client):
        inner = client.get("/api/v1/analytics").json()["data"]
        required = {
            "total_satellites", "total_conjunctions", "high_risk_count",
            "average_risk_score", "max_risk_score", "min_miss_distance",
            "top_satellites", "risk_distribution", "altitude_distribution",
        }
        for key in required:
            assert key in inner, f"Missing analytics key: {key}"

    def test_total_satellites_reflects_inserted_count(self, client, sample_satellite):
        data = client.get("/api/v1/analytics").json()["data"]
        assert data["total_satellites"] == 1

    def test_total_conjunctions_reflects_inserted_count(self, client, sample_conjunction):
        data = client.get("/api/v1/analytics").json()["data"]
        assert data["total_conjunctions"] == 1

    def test_altitude_distribution_has_five_bands(self, client):
        data = client.get("/api/v1/analytics").json()["data"]
        assert len(data["altitude_distribution"]) == 5

    def test_risk_distribution_is_list(self, client):
        data = client.get("/api/v1/analytics").json()["data"]
        assert isinstance(data["risk_distribution"], list)


# ── GET /api/v1/maneuvers ─────────────────────────────────────────────────────

class TestManeuvers:
    def test_returns_200(self, client):
        assert client.get("/api/v1/maneuvers").status_code == 200

    def test_envelope_structure(self, client):
        data = client.get("/api/v1/maneuvers").json()
        assert data["status"] == "success"
        assert "count" in data
        assert isinstance(data["data"], list)

    def test_empty_on_fresh_database(self, client):
        assert client.get("/api/v1/maneuvers").json()["count"] == 0

    def test_returns_inserted_maneuver(self, client, sample_maneuver):
        data = client.get("/api/v1/maneuvers").json()
        assert data["count"] == 1
        item = data["data"][0]
        assert "delta_v_m_s" in item
        assert "recommendation_text" in item
        assert "sat1_name" in item
        assert "sat2_name" in item
        assert "risk_score" in item

    def test_limit_minimum_accepted(self, client):
        assert client.get("/api/v1/maneuvers?limit=1").status_code == 200

    def test_limit_maximum_accepted(self, client):
        assert client.get("/api/v1/maneuvers?limit=500").status_code == 200

    def test_limit_above_maximum_rejected(self, client):
        # This was the unconstrained limit fixed in Phase 2
        assert client.get("/api/v1/maneuvers?limit=501").status_code == 422

    def test_limit_zero_rejected(self, client):
        assert client.get("/api/v1/maneuvers?limit=0").status_code == 422

    def test_limit_negative_rejected(self, client):
        assert client.get("/api/v1/maneuvers?limit=-1").status_code == 422


# ── GET /api/v1/maneuvers/{conjunction_id} ───────────────────────────────────

class TestManeuverById:
    def test_returns_404_for_nonexistent_id(self, client):
        assert client.get("/api/v1/maneuvers/99999").status_code == 404

    def test_returns_200_for_existing_maneuver(self, client, sample_maneuver, sample_conjunction):
        r = client.get(f"/api/v1/maneuvers/{sample_conjunction}")
        assert r.status_code == 200

    def test_response_envelope(self, client, sample_maneuver, sample_conjunction):
        data = client.get(f"/api/v1/maneuvers/{sample_conjunction}").json()
        assert data["status"] == "success"
        assert "data" in data

    def test_response_data_fields(self, client, sample_maneuver, sample_conjunction):
        item = client.get(f"/api/v1/maneuvers/{sample_conjunction}").json()["data"]
        assert item["delta_v_m_s"] == pytest.approx(2.5)
        assert "recommendation_text" in item
        assert "sat1_name" in item
        assert "sat2_name" in item
        assert "miss_distance_km" in item
        assert "risk_score" in item


# ── GET /api/v1/forecast ──────────────────────────────────────────────────────

class TestForecast:
    def test_returns_200(self, client):
        assert client.get("/api/v1/forecast").status_code == 200

    def test_envelope_structure(self, client):
        data = client.get("/api/v1/forecast").json()
        assert data["status"] == "success"
        assert "count" in data
        assert isinstance(data["data"], list)

    def test_empty_on_fresh_database(self, client):
        assert client.get("/api/v1/forecast").json()["count"] == 0

    def test_limit_maximum_accepted(self, client):
        assert client.get("/api/v1/forecast?limit=500").status_code == 200

    def test_limit_above_maximum_rejected(self, client):
        assert client.get("/api/v1/forecast?limit=501").status_code == 422

    def test_limit_zero_rejected(self, client):
        assert client.get("/api/v1/forecast?limit=0").status_code == 422

    def test_past_events_are_excluded(self, client, initialized_db, sample_satellite):
        """
        Events with approach_time in the past must not appear.
        This is a route-level business rule in forecast.py:
        it filters out negative seconds_from_now values.
        """
        conn = sqlite3.connect(initialized_db)
        conn.execute("""
            INSERT INTO forecast
                (sat1_id, sat2_id, approach_time, predicted_miss_km,
                 relative_velocity_km_s, risk_score, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (sample_satellite, sample_satellite,
              "2000-01-01T00:00:00",   # definitely in the past
              15.0, 9.0, 0.005, _TS))
        conn.commit()
        conn.close()

        data = client.get("/api/v1/forecast").json()
        assert data["count"] == 0

    def test_future_events_are_included(self, client, initialized_db, sample_satellite):
        """Events with approach_time in the future must appear."""
        conn = sqlite3.connect(initialized_db)
        conn.execute("""
            INSERT INTO forecast
                (sat1_id, sat2_id, approach_time, predicted_miss_km,
                 relative_velocity_km_s, risk_score, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (sample_satellite, sample_satellite,
              "2099-12-31T23:59:59",   # definitely in the future
              15.0, 9.0, 0.005, _TS))
        conn.commit()
        conn.close()

        data = client.get("/api/v1/forecast").json()
        assert data["count"] == 1
        assert "seconds_from_now" in data["data"][0]
        assert data["data"][0]["seconds_from_now"] > 0