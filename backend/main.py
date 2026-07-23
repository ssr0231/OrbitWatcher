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
from fastapi.responses import FileResponse

from config import API_PREFIX, ALLOWED_ORIGINS, APP_VERSION
from logger import get_logger
from backend.database import init_db
from backend.scheduler import start_scheduler, run_pipeline
from backend.routes import satellites, conjunctions, analytics, maneuvers, forecast

log = get_logger(__name__)

app = FastAPI(
    title="OrbitWatch API",
    description="Starlink satellite collision risk intelligence platform",
    version=APP_VERSION,
)

# ── CORS ──────────────────────────────────────────────────
# ALLOWED_ORIGINS is read from the ALLOWED_ORIGINS env var in config.py.
# Defaults to ["*"] (open) for local development.
# In production set: ALLOWED_ORIGINS=https://your-domain.com
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Cache control ──────────────────────────────────────────
# No-cache headers are applied to API responses ONLY (/api/v1/*).
#
# Reason for scoping: during development this middleware covered all
# responses including static files. In production, applying no-store
# to /static/* forces the browser to re-download Three.js, Chart.js,
# satellite.js, and all textures on every page load (~3-4 MB per visit).
# API data changes every 6 hours and must never be served stale —
# static assets are immutable between deployments and should be cached.
@app.middleware("http")
async def no_cache_api_responses(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith(API_PREFIX):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"]        = "no-cache"
        response.headers["Expires"]       = "0"
    return response


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
    Liveness probe endpoint.
    Used by load balancers, Docker HEALTHCHECK, and uptime monitors.
    Always returns 200 OK as long as the process is alive.
    Does NOT check database connectivity — that is a readiness concern
    and will be added in Phase 2 if needed.
    """
    return {"status": "ok", "version": APP_VERSION}