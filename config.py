# config.py

import os
from dotenv import load_dotenv

load_dotenv()

# ── Application ────────────────────────────────────────────
# Single source of truth for the application version.
# Referenced by main.py (FastAPI metadata, /health endpoint)
# and run.py (startup banner). Update here only.
APP_VERSION = "1.0.0"


def _get_int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _get_float_env(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


# ── Data source ────────────────────────────────────────────
CELESTRAK_STARLINK_TLE_URL = (
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle"
)

# ── Server ─────────────────────────────────────────────────
# HOST: network interface to bind to.
#   0.0.0.0 = all interfaces (required for Docker / hosted platforms)
#   127.0.0.1 = localhost only (safer for local dev)
# PORT: injected automatically by Render, Railway, Fly.io, etc.
#   If not set, defaults to 8000.
HOST = os.getenv("HOST", "0.0.0.0")
PORT = _get_int_env("PORT", 8000)

# ── CORS ───────────────────────────────────────────────────
# Comma-separated list of allowed origins.
#   Development:  ALLOWED_ORIGINS=*
#   Production:   ALLOWED_ORIGINS=https://orbitwatch.app
#   Multiple:     ALLOWED_ORIGINS=https://a.com,https://b.com
# Defaults to "*" so local development requires no configuration.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS: list[str] = (
    ["*"] if _raw_origins.strip() == "*"
    else [o.strip() for o in _raw_origins.split(",") if o.strip()]
)

# ── Scheduler ──────────────────────────────────────────────
SCHEDULER_INTERVAL_HOURS  = _get_int_env("SCHEDULER_INTERVAL_HOURS", 6)
FETCH_RETRY_LIMIT         = _get_int_env("FETCH_RETRY_LIMIT", 3)
FETCH_RETRY_DELAY_SECONDS = _get_int_env("FETCH_RETRY_DELAY_SECONDS", 10)

# ── Conjunction screening ──────────────────────────────────
# Distance threshold below which a satellite pair is classified
# as a conjunction. Exposed as env var so operators can tune
# screening sensitivity without a code change.
CONJUNCTION_THRESHOLD_KM = _get_float_env("CONJUNCTION_THRESHOLD_KM", 50.0)

# Not currently used by conjunction.py. An altitude-band partitioning
# approach using this width was implemented and correctness-tested,
# but measured slower than a single global k-d tree against real
# Starlink altitude data (satellites cluster too tightly into one
# band for partitioning to help) — so screening reverted to the
# simpler single-tree approach. Kept here, documented, in case
# partitioning is worth revisiting for a more vertically-dispersed
# catalog in the future (e.g. combined multi-operator data).
ORBITAL_SHELL_THICKNESS_KM = _get_float_env("ORBITAL_SHELL_THICKNESS_KM", 100.0)

# ── Risk scoring ───────────────────────────────────────────
MAX_RELATIVE_VELOCITY_KM_S = _get_float_env("MAX_RELATIVE_VELOCITY_KM_S", 15.0)
RISK_ALERT_THRESHOLD       = _get_float_env("RISK_ALERT_THRESHOLD", 0.05)

# ── Database ───────────────────────────────────────────────
DATABASE_PATH = os.getenv("DATABASE_PATH", "data/orbitwatch.db")

# ── API ────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

# ── Logging ────────────────────────────────────────────────
LOG_FILE         = os.getenv("LOG_FILE",  "logs/orbitwatch.log")
LOG_LEVEL        = os.getenv("LOG_LEVEL", "INFO")
# RotatingFileHandler settings — log rotates when it reaches
# LOG_MAX_BYTES, keeping LOG_BACKUP_COUNT old files.
# Defaults: 5 MB per file, 5 backups = max 30 MB of log storage.
LOG_MAX_BYTES    = _get_int_env("LOG_MAX_BYTES",    5 * 1024 * 1024)  # 5 MB
LOG_BACKUP_COUNT = _get_int_env("LOG_BACKUP_COUNT", 5)


def _ensure_parent_dir(path: str) -> None:
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)


_ensure_parent_dir(DATABASE_PATH)
_ensure_parent_dir(LOG_FILE)