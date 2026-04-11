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

CelesTrak (free TLE feed)
│
▼
FastAPI Backend
├── tle_fetcher.py    →  fetch + retry logic
├── propagator.py     →  SGP4 orbital position computation
├── conjunction.py    →  k-d tree screening + risk scoring
├── optimizer.py      →  delta-V maneuver recommendations
├── scheduler.py      →  runs pipeline every 6 hours
└── SQLite database   →  WAL mode, satellites/conjunctions/maneuvers
│
▼
REST API  (FastAPI)
├── GET /api/v1/tles
├── GET /api/v1/conjunctions
├── GET /api/v1/analytics
└── GET /api/v1/maneuvers
│
▼
Browser Frontend
├── Three.js      →  3D Earth globe + starfield
├── satellite.js  →  client-side SGP4 propagation (60 FPS)
└── Chart.js      →  analytics dashboard
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
├── config.py                        ← all constants
├── logger.py                        ← logging setup
├── requirements.txt
├── backend/
│   ├── main.py                      ← FastAPI app, CORS, startup
│   ├── database.py                  ← SQLite schema, WAL mode
│   ├── scheduler.py                 ← 6-hour pipeline orchestrator
│   ├── services/
│   │   ├── tle_fetcher.py           ← CelesTrak fetch + retry
│   │   ├── propagator.py            ← SGP4 batch propagation
│   │   ├── conjunction.py           ← k-d tree screening + risk
│   │   └── optimizer.py             ← delta-V maneuver logic
│   └── routes/
│       ├── satellites.py
│       ├── conjunctions.py
│       ├── analytics.py
│       └── maneuvers.py
└── frontend/
├── index.html
├── css/
│   └── style.css
└── js/
├── api.js                   ← backend fetch calls
├── globe.js                 ← Three.js scene + Earth texture
├── satellites.js            ← SGP4 propagation loop
├── conjunctions.js          ← risk color overlay
├── alerts.js                ← collision alert panel
├── dashboard.js             ← Chart.js analytics
├── maneuver.js              ← delta-V recommendation cards
├── search.js                ← satellite search + zoom
├── inspector.js             ← satellite detail overlay
├── export.js                ← CSV/JSON export
├── router.js                ← view switching
└── main.js                  ← entry point

---

## Built With

Developed as a final year major project demonstrating real-world
application of orbital mechanics, spatial algorithms, and full-stack
engineering on live satellite data.

