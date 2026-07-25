# backend/main.py

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = PROJECT_ROOT / "frontend"
INDEX_FILE   = FRONTEND_DIR / "index.html"
sys.path.append(str(PROJECT_ROOT))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from config import API_PREFIX, ALLOWED_ORIGINS, APP_VERSION
from logger import get_logger
from backend.database import init_db, check_database
from backend.scheduler import start_scheduler, run_pipeline
from backend.routes import satellites, conjunctions, analytics, maneuvers, forecast

log = get_logger(__name__)

app = FastAPI(
    title="OrbitWatch API",
    description="Starlink satellite collision risk intelligence platform",
    version=APP_VERSION,
)

# ── CORS ──────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Cache control ──────────────────────────────────────────
# Applied only to /api/* routes. Static assets (Three.js, Chart.js,
# textures) should be cached — forcing no-store on them would cause
# the browser to re-download several MB on every page load.
@app.middleware("http")
async def no_cache_api_responses(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith(API_PREFIX):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"]        = "no-cache"
        response.headers["Expires"]       = "0"
    return response

# ── Global exception handler ───────────────────────────────
# Catches any unhandled exception that propagates out of a route.
# Without this, FastAPI's default handler returns the Python exception
# message in the response body — exposing internal paths, table names,
# and query structure to clients. This handler:
#   - Logs the full traceback internally (exc_info=True)
#   - Returns a generic JSON error to the client (no internal details)
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    log.error(
        f"Unhandled exception on {request.method} {request.url.path}: {exc}",
        exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "detail": "An internal error occurred. Please try again later."
        }
    )


app.include_router(satellites.router,   prefix=API_PREFIX)
app.include_router(conjunctions.router, prefix=API_PREFIX)
app.include_router(analytics.router,    prefix=API_PREFIX)
app.include_router(maneuvers.router,    prefix=API_PREFIX)
app.include_router(forecast.router,     prefix=API_PREFIX)

app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.on_event("startup")
async def on_startup():
    log.info("=" * 56)
    log.info(f"  OrbitWatch v{APP_VERSION} — starting up")
    log.info("=" * 56)
    log.info(f"  CORS allowed origins : {ALLOWED_ORIGINS}")
    log.info(f"  API prefix           : {API_PREFIX}")
    log.info(f"  Frontend directory   : {FRONTEND_DIR}")
    log.info(f"  Docs                 : /docs")
    log.info("-" * 56)

    log.info("[1/3] Initialising database...")
    init_db()
    log.info("[1/3] Database ready.")

    log.info("[2/3] Running initial data pipeline...")
    run_pipeline()
    log.info("[2/3] Initial pipeline complete.")

    log.info("[3/3] Starting background scheduler...")
    start_scheduler()
    log.info("[3/3] Scheduler running.")

    log.info("-" * 56)
    log.info("  OrbitWatch is ready to accept requests.")
    log.info("=" * 56)


@app.get("/")
def root():
    return FileResponse(str(INDEX_FILE))


@app.get("/health")
def health():
    """
    Liveness + readiness probe endpoint.

    Checks both process health (always true if we reach here) and
    database connectivity (SELECT 1 via check_database()).

    Returns 200 with status "ok" if everything is healthy.
    Returns 200 with status "degraded" if the database is unreachable
    — still 200 so the process isn't killed, but the body signals
    degraded state to monitoring tools that inspect the response body.

    Load balancers that only check the status code will keep routing
    traffic; monitoring tools that check the JSON body will alert.
    This is intentional — the app can still serve cached/static
    content even if the DB is temporarily unavailable.
    """
    db_ok = check_database()
    return {
        "status":   "ok" if db_ok else "degraded",
        "version":  APP_VERSION,
        "database": "ok" if db_ok else "unavailable",
    }