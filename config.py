# config.py
# Every constant used anywhere in the system lives here.
# Nothing is hardcoded in any other file.

# ── Data source ────────────────────────────────────────────
CELESTRAK_STARLINK_URL = (
    "https://celestrak.org/SOCRATES/query.php"
)

CELESTRAK_STARLINK_TLE_URL = (
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle"
)

# ── Scheduler ──────────────────────────────────────────────
SCHEDULER_INTERVAL_HOURS = 6
FETCH_RETRY_LIMIT = 3
FETCH_RETRY_DELAY_SECONDS = 10

# ── Conjunction screening ──────────────────────────────────
ORBITAL_SHELL_THICKNESS_KM = 100
CONJUNCTION_THRESHOLD_KM = 50

# ── Risk scoring ───────────────────────────────────────────
MAX_RELATIVE_VELOCITY_KM_S = 15.0
RISK_ALERT_THRESHOLD = 0.05

# ── Database ───────────────────────────────────────────────
DATABASE_PATH = "data/orbitwatch.db"

# ── API ────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

# ── Logging ────────────────────────────────────────────────
LOG_FILE = "logs/orbitwatch.log"
LOG_LEVEL = "INFO"