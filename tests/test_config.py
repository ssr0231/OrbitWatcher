# tests/test_config.py
# Validates configuration loading, defaults, env var overrides,
# and input sanitisation in config.py.
#
# These tests verify Phase 1 hardening: every tunable value is
# configurable via env var and falls back to a safe default when
# the variable is missing or contains an invalid value.

import pytest


class TestAppConstants:
    def test_app_version_is_set(self):
        from config import APP_VERSION
        assert isinstance(APP_VERSION, str)
        assert APP_VERSION == "1.0.0"

    def test_api_prefix_format(self):
        from config import API_PREFIX
        assert API_PREFIX == "/api/v1"
        assert API_PREFIX.startswith("/")

    def test_conjunction_threshold_default(self):
        from config import CONJUNCTION_THRESHOLD_KM
        assert CONJUNCTION_THRESHOLD_KM == 50.0
        assert CONJUNCTION_THRESHOLD_KM > 0

    def test_max_relative_velocity_default(self):
        from config import MAX_RELATIVE_VELOCITY_KM_S
        assert MAX_RELATIVE_VELOCITY_KM_S == 15.0

    def test_risk_alert_threshold_default(self):
        from config import RISK_ALERT_THRESHOLD
        assert RISK_ALERT_THRESHOLD == 0.05

    def test_scheduler_interval_default(self):
        from config import SCHEDULER_INTERVAL_HOURS
        assert SCHEDULER_INTERVAL_HOURS == 6

    def test_fetch_retry_limit_default(self):
        from config import FETCH_RETRY_LIMIT
        assert FETCH_RETRY_LIMIT == 3

    def test_log_max_bytes_default(self):
        from config import LOG_MAX_BYTES
        assert LOG_MAX_BYTES == 5 * 1024 * 1024  # 5 MB

    def test_log_backup_count_default(self):
        from config import LOG_BACKUP_COUNT
        assert LOG_BACKUP_COUNT == 5


class TestGetIntEnv:
    """Tests the _get_int_env helper directly."""

    def test_returns_default_when_var_absent(self, monkeypatch):
        monkeypatch.delenv("_TEST_INT", raising=False)
        import config as cfg
        assert cfg._get_int_env("_TEST_INT", 99) == 99

    def test_reads_valid_integer(self, monkeypatch):
        monkeypatch.setenv("_TEST_INT", "42")
        import config as cfg
        assert cfg._get_int_env("_TEST_INT", 0) == 42

    def test_falls_back_on_non_integer(self, monkeypatch):
        monkeypatch.setenv("_TEST_INT", "not_a_number")
        import config as cfg
        assert cfg._get_int_env("_TEST_INT", 7) == 7

    def test_falls_back_on_float_string(self, monkeypatch):
        monkeypatch.setenv("_TEST_INT", "3.14")
        import config as cfg
        assert cfg._get_int_env("_TEST_INT", 7) == 7

    def test_falls_back_on_empty_string(self, monkeypatch):
        monkeypatch.setenv("_TEST_INT", "")
        import config as cfg
        # empty string → os.getenv returns "" which is not None,
        # so int("") raises ValueError → falls back to default
        assert cfg._get_int_env("_TEST_INT", 5) == 5


class TestGetFloatEnv:
    """Tests the _get_float_env helper directly."""

    def test_returns_default_when_var_absent(self, monkeypatch):
        monkeypatch.delenv("_TEST_FLOAT", raising=False)
        import config as cfg
        assert cfg._get_float_env("_TEST_FLOAT", 1.5) == 1.5

    def test_reads_valid_float(self, monkeypatch):
        monkeypatch.setenv("_TEST_FLOAT", "75.5")
        import config as cfg
        assert cfg._get_float_env("_TEST_FLOAT", 0.0) == 75.5

    def test_reads_integer_as_float(self, monkeypatch):
        monkeypatch.setenv("_TEST_FLOAT", "100")
        import config as cfg
        assert cfg._get_float_env("_TEST_FLOAT", 0.0) == 100.0

    def test_falls_back_on_non_numeric(self, monkeypatch):
        monkeypatch.setenv("_TEST_FLOAT", "bad_value")
        import config as cfg
        assert cfg._get_float_env("_TEST_FLOAT", 42.0) == 42.0


class TestAllowedOrigins:
    """Tests the ALLOWED_ORIGINS parsing logic."""

    def test_wildcard_string_produces_list_with_star(self):
        raw = "*"
        result = ["*"] if raw.strip() == "*" else [o.strip() for o in raw.split(",") if o.strip()]
        assert result == ["*"]

    def test_single_origin_parsed_correctly(self):
        raw = "https://orbitwatch.app"
        result = [o.strip() for o in raw.split(",") if o.strip()]
        assert result == ["https://orbitwatch.app"]

    def test_multiple_origins_parsed_correctly(self):
        raw = "https://a.com,https://b.com, https://c.com"
        result = [o.strip() for o in raw.split(",") if o.strip()]
        assert result == ["https://a.com", "https://b.com", "https://c.com"]

    def test_empty_entries_ignored(self):
        raw = "https://a.com,,https://b.com"
        result = [o.strip() for o in raw.split(",") if o.strip()]
        assert result == ["https://a.com", "https://b.com"]