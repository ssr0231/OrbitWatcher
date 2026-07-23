# run.py
# Production entrypoint for OrbitWatch.
#
# Usage:
#   python run.py                    # uses HOST/PORT from .env or defaults
#   PORT=8080 python run.py          # override port via env var
#   uvicorn backend.main:app ...     # identical result, alternative syntax
#
# Why this file exists:
#   1. Every hosted platform (Render, Railway, Fly.io, Heroku) expects
#      a single start command. "python run.py" works everywhere.
#   2. PORT is injected as an env var by hosted platforms at runtime.
#      Uvicorn invoked directly (uvicorn backend.main:app --port 8000)
#      ignores the PORT env var. This file reads it from config.py.
#   3. Docker CMD can be: ["python", "run.py"] — no platform-specific
#      config needed inside the image.
#   4. Developers who don't know uvicorn can still start the app.
#
# workers=1 is intentional:
#   APScheduler's BackgroundScheduler runs inside the application process.
#   Multiple workers = multiple schedulers = multiple concurrent pipelines
#   writing to the same SQLite database = locking errors.
#   Scale horizontally (multiple containers / dynos) rather than
#   vertically (multiple workers per process) if throughput requires it.

import uvicorn
from config import HOST, PORT, APP_VERSION

if __name__ == "__main__":
    print(f"Starting OrbitWatch v{APP_VERSION} on {HOST}:{PORT}")
    uvicorn.run(
        "backend.main:app",
        host=HOST,
        port=PORT,
        workers=1,
        access_log=True,
    )