FROM python:3.12-slim

# Python container settings
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# curl is used by Docker's health check
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Install production dependencies first for Docker layer caching
COPY requirements.prod.txt .
RUN pip install --no-cache-dir -r requirements.prod.txt

# Copy application files
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY config.py logger.py run.py ./

# Run OrbitWatcher as a non-root user
RUN useradd --create-home --shell /bin/bash orbitwatch \
    && mkdir -p data logs \
    && chown -R orbitwatch:orbitwatch /app

USER orbitwatch

EXPOSE 8000

# Give OrbitWatcher enough time to complete its startup pipeline
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

CMD ["python", "run.py"]