# Changelog

All notable changes to OrbitWatch are documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-07-31

### Added

- FastAPI REST API for satellite, conjunction, analytics, maneuver, and forecast data.
- Live Starlink TLE ingestion from CelesTrak with validation, timeout handling, retries, and stored-data fallback.
- SGP4-based orbital propagation for 10,000+ Starlink satellites.
- KDTree-based conjunction screening for scalable close-approach detection.
- Collision-risk scoring using miss distance, relative velocity, and time to closest approach.
- Delta-V maneuver recommendation generation for high-risk conjunctions.
- 24-hour conjunction forecasting pipeline.
- SQLite persistence for satellites, conjunctions, maneuvers, and forecast events.
- APScheduler-based automatic pipeline refresh.
- Interactive Three.js 3D globe and mission-control interface.
- Satellite search, filtering, inspection, orbit visualization, collision alerts, analytics, maneuver, forecast, and export interfaces.
- Environment-based configuration with documented `.env.example`.
- Centralized application logging with log rotation.
- `/health` endpoint for application and database health monitoring.
- Dockerfile and Docker Compose configuration for portable deployment.
- Docker health checks, persistent local database/log volumes, and non-root container execution.
- Automated pytest suite covering configuration, database behavior, API routes, validation, security headers, cache behavior, and health checks.
- Reproducible benchmark and research tooling under `docs/research/`.
- Public deployment validated on Render.

### Changed

- Centralized application configuration and version management.
- Improved database connection lifecycle and exception safety.
- Improved API validation and consistent response handling.
- Improved frontend API failure handling and resilience.
- Improved TLE retrieval behavior for hosted deployment environments.
- Improved application startup and graceful shutdown behavior.
- Improved logging and operational diagnostics.
- Updated project documentation for configuration, testing, deployment, architecture, benchmarking, and production considerations.

### Fixed

- Corrected time-to-closest-approach calculations used by conjunction analysis.
- Corrected maneuver recommendation behavior associated with conjunction timing.
- Fixed database health checking so connection failures return an unhealthy state instead of raising.
- Fixed frontend reliability issues affecting satellite loading and API error handling.
- Fixed satellite search behavior encountered during mission-control UI development.
- Fixed panel interaction behavior so major floating interfaces do not conflict.

### Security

- Added configurable CORS origin handling.
- Added HTTP security headers.
- Added cache-control behavior for API responses.
- Added API input validation and request limits.
- Added non-root Docker container execution.

### Performance

- Processes 10,000+ satellites through the benchmarked pipeline.
- End-to-end pipeline benchmark: 472.6 ms, excluding network retrieval.
- SGP4 propagation benchmark: 208.2 ms.
- Conjunction screening benchmark: 87.7 ms.
- Maneuver generation benchmark: 17.1 ms.
- KDTree screening achieved a measured 11,275.8× speedup over the benchmarked brute-force implementation.

### Testing

- Added `pytest.ini` and a structured automated test suite under `tests/`.
- Added isolated temporary-database fixtures to prevent tests from modifying production data.
- Added coverage for configuration parsing, database initialization and cleanup, health checks, API endpoints, validation, security headers, and cache behavior.
- OrbitWatch v1.0.0 release candidate validated with **94 passing automated tests**.

### Deployment

- OrbitWatch v1.0.0 release candidate successfully deployed and validated on Render.
- Verified application startup, database health, API availability, frontend loading, satellite data retrieval, and visualization in the hosted environment.
- Documented Render free-tier cold-start and ephemeral-filesystem limitations.

### Known Limitations

- Collision risk is an interpretable prioritization heuristic, not a certified collision-probability model.
- Maneuver recommendations are analytical suggestions and are not intended as operational spacecraft commands.
- Current catalog coverage is focused on Starlink satellites.
- The public Render free-tier deployment may cold-start after inactivity.
- The Render free-tier filesystem is not intended for persistent SQLite storage across service recreation or redeployment.

[1.0.0]: https://github.com/ssr0231/OrbitWatcher/releases/tag/v1.0.0