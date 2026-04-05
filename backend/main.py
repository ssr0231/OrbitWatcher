# backend/main.py
# FastAPI application entry point.
# Registers all routes, starts the scheduler,
# and serves the API.

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import API_PREFIX
from logger import get_logger
from backend.database import init_db
from backend.scheduler import start_scheduler, run_pipeline
from backend.routes import satellites, conjunctions, analytics, maneuvers

log = get_logger(__name__)

app = FastAPI(
    title="OrbitWatch API",
    description="Starlink satellite collision risk intelligence platform",
    version="1.0.0"
)

# CORS — allows the frontend (browser) to call this API
# Without this, the browser blocks every request
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"]
)

# Register all route groups under /api/v1
app.include_router(satellites.router,   prefix=API_PREFIX)
app.include_router(conjunctions.router, prefix=API_PREFIX)
app.include_router(analytics.router,    prefix=API_PREFIX)
app.include_router(maneuvers.router,    prefix=API_PREFIX)


@app.on_event("startup")
async def on_startup():
    """
    Runs once when the server starts.
    1. Initialises the database (creates tables if missing)
    2. Runs the pipeline once immediately
    3. Starts the 6-hour scheduler in the background
    """
    log.info("OrbitWatch API starting...")
    init_db()

    # Run pipeline once on startup so API has data immediately
    log.info("Running initial pipeline on startup...")
    run_pipeline()

    # Start the background scheduler for future cycles
    start_scheduler()
    log.info("OrbitWatch API ready.")


@app.get("/")
def root():
    return {
        "status": "success",
        "message": "OrbitWatch API is running.",
        "docs": "/docs"
    }


@app.get("/health")
def health():
    return {"status": "ok"}