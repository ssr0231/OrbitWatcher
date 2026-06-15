# OrbitWatch

**Real-time Starlink satellite collision risk intelligence platform.**

Live tracking of 10,000+ Starlink satellites with automated conjunction
detection, risk scoring, and maneuver recommendations — built on real
orbital data from CelesTrak.

---

## Live Demo

Run locally — see setup below.

---

## Features

- **3D Globe** — 10,000+ real Starlink satellites rendered at 60 FPS
  using Three.js + satellite.js SGP4 propagation in the browser
- **Collision Detection** — k-d tree spatial screening identifies
  close-approach pairs in milliseconds
- **Risk Scoring** — physically grounded formula using miss distance,
  relative velocity, and time to closest approach
- **Maneuver Recommendations** — delta-V burn suggestions for each
  high-risk conjunction pair
- **Analytics Dashboard** — real-time charts for risk distribution,
  top satellites, miss distance, and velocity profiles
- **Search** — find any satellite by name, zoom to its position
- **Inspector** — click any alert or satellite to view live orbital data
- **Export** — download conjunction reports as CSV or JSON

---

## Architecture

CelesTrak GP Endpoint (internet)
        │
        │ HTTP GET (every 6 hours via APScheduler)
        │ retry logic: 3 attempts, 10s delay, fallback to cached data
        ▼
tle_fetcher.py
        │ parse + validate + upsert to database
        │ 159.6 ms
        ▼
SQLite: satellites table
        │
        ▼
propagator.py
        │ SGP4 batch propagation → ECI positions + velocities (km, km/s)
        │ 208.2 ms  ← pipeline bottleneck (44% of total)
        ▼
conjunction.py
        │ Stage 1: Altitude shell filter (100 km bands) — eliminates ~98% of pairs
        │ Stage 2: scipy KDTree.query_pairs(r=50 km) on surviving candidates
        │ Stage 3: Risk score + TCA estimation for each detected pair
        │ 87.7 ms
        ▼
SQLite: conjunctions table
        │
        ▼
optimizer.py
        │ Delta-V computation for high-risk pairs
        │ Recommendation text generation
        │ 17.1 ms
        ▼
SQLite: maneuvers table
        │
        ▼ (read-only, no computation per request)
FastAPI REST API — 4 endpoints
        │
        ├── GET /api/v1/tles          → all 10,303 TLE records (for browser)
        ├── GET /api/v1/conjunctions  → top-N pairs sorted by risk DESC
        ├── GET /api/v1/analytics     → summary statistics
        └── GET /api/v1/maneuvers     → delta-V recommendations
        │
        ▼
Browser (single HTML page, no build toolchain)
        │
        ├── satellite.js 4.1.3   → SGP4 propagation in browser @ 60 FPS
        ├── Three.js r128        → 3D globe, BufferGeometry (1 GPU draw call)
        └── Chart.js 4.4.0       → Analytics charts
---

## Database Schema

SQLite location: C:/OrbitWatchData/orbitwatch.db
Log file:        C:/OrbitWatchData/orbitwatch.log
Mode:            WAL (Write-Ahead Logging — allows concurrent reads during writes)

TABLE: satellites
  id            INTEGER PRIMARY KEY AUTOINCREMENT
  name          TEXT            (e.g. "STARLINK-1234")
  tle_line1     TEXT
  tle_line2     TEXT
  last_updated  TEXT            (ISO 8601 UTC)

TABLE: conjunctions
  id                     INTEGER PRIMARY KEY AUTOINCREMENT
  sat1_id                INTEGER FK → satellites.id
  sat2_id                INTEGER FK → satellites.id
  miss_distance_km       REAL
  relative_velocity_km_s REAL
  risk_score             REAL
  timestamp              TEXT

TABLE: maneuvers
  id                  INTEGER PRIMARY KEY AUTOINCREMENT
  conjunction_id      INTEGER FK → conjunctions.id
  delta_v_m_s         REAL
  recommendation_text TEXT

INDEXES (5 total):
  idx_conjunctions_risk      ON conjunctions(risk_score DESC)
  idx_conjunctions_sat1      ON conjunctions(sat1_id)
  idx_conjunctions_sat2      ON conjunctions(sat2_id)
  idx_satellites_name        ON satellites(name)
  idx_maneuvers_conjunction  ON maneuvers(conjunction_id)
---

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Backend    | Python 3.12, FastAPI, Uvicorn     |
| Orbital math | python-sgp4, numpy, scipy       |
| Database   | SQLite (WAL mode)                 |
| Scheduler  | APScheduler (6-hour refresh)      |
| 3D Globe   | Three.js r128                     |
| Propagation | satellite.js (browser SGP4)      |
| Charts     | Chart.js 4                        |
| Fonts      | Inter, Space Mono (Google Fonts)  |
| Data source | CelesTrak (free, no account)     |

---

## Setup

### Requirements
- Python 3.10+
- Git

### Installation

```bash
git clone https://github.com/ssr0231/OrbitWatcher.git
cd OrbitWatcher
pip install -r requirements.txt
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000` in your browser.

On first startup the system automatically:
1. Fetches live Starlink TLEs from CelesTrak
2. Propagates all satellites using SGP4
3. Runs conjunction screening
4. Computes risk scores and maneuver recommendations

Data refreshes every 6 hours automatically.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tles` | All Starlink TLE data |
| GET | `/api/v1/conjunctions` | Risk-sorted conjunction pairs |
| GET | `/api/v1/analytics` | Summary statistics |
| GET | `/api/v1/maneuvers` | Maneuver recommendations |
| GET | `/api/v1/maneuvers/{id}` | Single conjunction maneuver |

Interactive API docs at `/docs`.

---

## Risk Formula
risk_score = (1 / (distance_km + 1))
× (relative_velocity_km_s / 15)
× (1 / (time_to_closest_approach_s + 1))

Each term is physically grounded:
- **Distance** — closer approach = higher risk
- **Velocity** — faster closing speed = more dangerous
- **TCA** — sooner encounter = higher urgency

---

## Project Structure

OrbitWatcher/
├── config.py                    ← ALL constants (thresholds, paths, URLs)
├── logger.py                    ← Centralized logging (writes to C:/OrbitWatchData/)
├── requirements.txt
│
├── backend/
│   ├── main.py                  ← FastAPI app entry, CORS, static files, scheduler start
│   ├── database.py              ← SQLite init, WAL mode, 3 tables, 5 indexes
│   ├── scheduler.py             ← APScheduler 6-hour pipeline + run_pipeline_timed()
│   │
│   ├── services/
│   │   ├── tle_fetcher.py       ← CelesTrak fetch, parse, validate, store
│   │   ├── propagator.py        ← SGP4 batch propagation, altitude filtering
│   │   ├── conjunction.py       ← Altitude shell + k-d tree screening, risk scoring
│   │   ├── conjunction_bruteforce.py  ← O(n²) oracle (RESEARCH ONLY, never in prod)
│   │   └── optimizer.py         ← Delta-V maneuver computation
│   │
│   └── routes/
│       ├── satellites.py        ← GET /api/v1/tles
│       ├── conjunctions.py      ← GET /api/v1/conjunctions
│       ├── analytics.py         ← GET /api/v1/analytics
│       └── maneuvers.py         ← GET /api/v1/maneuvers
│
├── frontend/
│   ├── index.html               ← Single page app, script load order is critical
│   ├── css/style.css
│   └── js/
│       ├── api.js               ← window.location.origin base URL, 4 fetch functions
│       ├── globe.js             ← Three.js scene, dark Earth, trails, rotation toggle
│       ├── satellites.js        ← BufferGeometry, altitude colors, markHighRisk
│       ├── inspector.js         ← Satellite detail panel, orbital params, flashSatellite→trail
│       ├── alerts.js            ← Collision alert panel, alert→trail integration
│       ├── conjunctions.js      ← Load conjunctions, updateConjunctionStats
│       ├── dashboard.js         ← Chart.js 4 charts
│       ├── maneuver.js          ← Maneuver cards panel
│       ├── search.js            ← Autocomplete search, RISK badge
│       ├── router.js            ← View switching (Globe/Analytics/Maneuvers)
│       ├── export.js            ← CSV and JSON download
│       └── main.js              ← Init sequence, clock, animation loop
│
├── benchmark.py                 ← Scalability experiment (n=1k–10k, 5 repeats)
├── generate_figures.py          ← 4 matplotlib paper figures
├── benchmark_scalability.json   ← Raw experiment data
├── benchmark_completeness.json  ← Raw experiment data
├── pipeline_timing.json         ← Raw experiment data
├── fig1_runtime_scaling.pdf/.png
├── fig2_speedup.pdf/.png
├── fig3_completeness.pdf/.png
└── fig4_pipeline_breakdown.pdf/.png

---

## Built With

Developed as a final year major project demonstrating real-world
application of orbital mechanics, spatial algorithms, and full-stack
engineering on live satellite data.

