# backend/main.py

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = PROJECT_ROOT / "frontend"
INDEX_FILE = FRONTEND_DIR / "index.html"
sys.path.append(str(PROJECT_ROOT))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import API_PREFIX
from logger import get_logger
from backend.database import init_db
from backend.scheduler import start_scheduler, run_pipeline
from backend.routes import satellites, conjunctions, analytics, maneuvers, forecast

log = get_logger(__name__)

app = FastAPI(
    title="OrbitWatch API",
    description="Starlink satellite collision risk intelligence platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"]
)


@app.middleware("http")
async def no_cache_headers(request: Request, call_next):
    response = await call_next(request)
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
    log.info("OrbitWatch API starting...")
    init_db()
    log.info("Running initial pipeline on startup...")
    run_pipeline()
    start_scheduler()
    log.info("OrbitWatch API ready.")


@app.get("/")
def root():
    return FileResponse(str(INDEX_FILE))


@app.get("/health")
def health():
    return {"status": "ok"}