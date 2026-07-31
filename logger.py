# logger.py
# Single logging setup for the entire system.
# Every module imports get_logger() instead of configuring logging itself.
#
# Changes from dev version:
#   - FileHandler replaced with RotatingFileHandler so log files never
#     grow unboundedly in production. Rotates at LOG_MAX_BYTES (default
#     5 MB), keeps LOG_BACKUP_COUNT (default 5) backups.
#     Maximum log storage: 5 MB × 6 files = 30 MB.
#   - LOG_LEVEL validated with .upper() and a safe fallback to INFO
#     so a misconfigured LOG_LEVEL=debug (lowercase) still works.

import logging
import os
from logging.handlers import RotatingFileHandler

from config import LOG_FILE, LOG_LEVEL, LOG_MAX_BYTES, LOG_BACKUP_COUNT

# Ensure the log directory exists before any handler tries to open the file.
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)


def get_logger(name: str) -> logging.Logger:
    """
    Returns a named logger that writes to both stdout and a rotating
    log file simultaneously.

    The first call for a given name creates and attaches handlers.
    Subsequent calls return the same logger (the `if logger.handlers`
    guard prevents duplicate handlers when the same module is imported
    multiple times, which happens in larger FastAPI apps).
    """
    logger = logging.getLogger(name)

    if logger.handlers:
        return logger

    # Validate LOG_LEVEL — if misconfigured, fall back to INFO rather
    # than raising an AttributeError at startup.
    level = getattr(logging, LOG_LEVEL.upper(), logging.INFO)
    logger.setLevel(level)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # Console handler — always active so stdout/stderr streaming works
    # in Docker, systemd journald, and hosted platform log views.
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    # Rotating file handler — replaces the plain FileHandler used in
    # development. Rotates the log when it reaches LOG_MAX_BYTES and
    # keeps LOG_BACKUP_COUNT numbered backups (.log.1, .log.2, …).
    # If the log directory is read-only (e.g., a restrictive container),
    # this will raise at startup — intentional: fail loudly, not silently.
    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=LOG_MAX_BYTES,
        backupCount=LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    return logger