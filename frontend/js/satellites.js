// satellites.js

const SAT_SCALE = 1.0 / 6371.0;

// Shell view radius in scene units.
// Earth surface = 1.0. Starlink real orbits ≈ 1.085 (540km altitude).
// Shell is set to 2.2 — visually above real orbits so the constellation
// pattern is clearly distinct from Earth's surface.
const SHELL_RADIUS = 2.2;

let satellitePoints = null;
let satPositions    = null;
let satColors       = null;
let satRecords      = [];
let conjunctionSet  = new Set();
const flashingIndices = new Set();

// ── Risk halo state ────────────────────────────────────
let haloPoints      = null;
let haloPositions   = null;
let haloColors      = null;
let _haloTex        = null;
let _haloSatIndices = [];
let _haloRiskLevels = [];

function _createHaloTexture() {
  const S  = 64;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0.00, "rgba(255,255,255,1.00)");
  g.addColorStop(0.15, "rgba(255,255,255,0.90)");
  g.addColorStop(0.40, "rgba(255,255,255,0.40)");
  g.addColorStop(0.70, "rgba(255,255,255,0.08)");
  g.addColorStop(1.00, "rgba(255,255,255,0.00)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(cv);
}

function buildHaloGeometry() {
  if (haloPoints) {
    earthGroup.remove(haloPoints);
    haloPoints.geometry.dispose();
    haloPoints.material.dispose();
    haloPoints    = null;
    haloPositions = null;
    haloColors    = null;
  }

  const count = _haloSatIndices.length;
  if (count === 0) return;

  haloPositions = new Float32Array(count * 3);
  haloColors    = new Float32Array(count * 3);

  for (let i = 0; i < count * 3; i++) haloPositions[i] = 5000;

  if (!_haloTex) _haloTex = _createHaloTexture();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(haloPositions, 3));
  geometry.setAttribute("color",    new THREE.BufferAttribute(haloColors, 3));

  const material = new THREE.PointsMaterial({
    size:            0.038,
    vertexColors:    true,
    map:             _haloTex,
    alphaTest:       0.01,
    transparent:     true,
    opacity:         1.0,
    blending:        THREE.AdditiveBlending,
    depthWrite:      false,
    sizeAttenuation: true
  });

  haloPoints = new THREE.Points(geometry, material);
  earthGroup.add(haloPoints);
}

function _projectToShell(tx, ty, tz) {
  const mag = Math.sqrt(tx * tx + ty * ty + tz * tz);
  if (mag < 0.01) return [tx, ty, tz];
  const scale = SHELL_RADIUS / mag;
  return [tx * scale, ty * scale, tz * scale];
}

function updateHaloPositions() {
  if (!haloPoints || !haloPositions || !_haloSatIndices.length) return;

  const now   = getSimTime();
  const R     = 6371.0;
  const s     = SAT_SCALE;
  const pulse = 0.40 + 0.60 * Math.abs(Math.sin(Date.now() * 0.0028));
  const shell = typeof isShellViewEnabled === "function" && isShellViewEnabled();

  for (let h = 0; h < _haloSatIndices.length; h++) {
    const idx = _haloSatIndices[h];
    const lvl = _haloRiskLevels[h];

    try {
      const pv = satellite.propagate(satRecords[idx].satrec, now);
      if (!pv || !pv.position || pv.position === false) {
        haloPositions[h * 3] = haloPositions[h * 3 + 1] = haloPositions[h * 3 + 2] = 5000;
        continue;
      }

      const p   = pv.position;
      const alt = Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2) - R;

      if (!passesFilters(alt, true)) {
        haloPositions[h * 3] = haloPositions[h * 3 + 1] = haloPositions[h * 3 + 2] = 5000;
        continue;
      }

      let tx =  p.x * s;
      let ty =  p.z * s;
      let tz = -p.y * s;

      if (shell) {
        [tx, ty, tz] = _projectToShell(tx, ty, tz);
      }

      haloPositions[h * 3 + 0] = tx;
      haloPositions[h * 3 + 1] = ty;
      haloPositions[h * 3 + 2] = tz;

    } catch(e) {
      haloPositions[h * 3] = haloPositions[h * 3 + 1] = haloPositions[h * 3 + 2] = 5000;
      continue;
    }

    if (lvl === 2) {
      haloColors[h * 3 + 0] = pulse;
      haloColors[h * 3 + 1] = pulse * 0.15;
      haloColors[h * 3 + 2] = pulse * 0.10;
    } else if (lvl === 1) {
      haloColors[h * 3 + 0] = 1.00;
      haloColors[h * 3 + 1] = 0.62;
      haloColors[h * 3 + 2] = 0.26;
    } else {
      haloColors[h * 3 + 0] = 1.00;
      haloColors[h * 3 + 1] = 0.85;
      haloColors[h * 3 + 2] = 0.30;
    }
  }

  haloPoints.geometry.attributes.position.needsUpdate = true;
  haloPoints.geometry.attributes.color.needsUpdate    = true;
}

async function loadSatellites() {
  setStatus("Fetching TLE data from backend...");
  const tles = await fetchTLEs();

  // null means fetchTLEs() caught a network/timeout error — the API
  // call itself failed. Distinct from an empty array, which would mean
  // the API responded successfully with zero satellites.
  if (tles === null) {
    setStatus("⚠ Satellite data unavailable — retry later.", true);
    return;
  }

  if (!tles.length) {
    setStatus("Warning: no TLE data received.");
    return;
  }

  setStatus(`Parsing ${tles.length} satellite TLEs...`);
  satRecords = [];
  for (const sat of tles) {
    try {
      const satrec = satellite.twoline2satrec(sat.tle_line1, sat.tle_line2);
      satRecords.push({ satrec, name: sat.name, id: sat.id });
    } catch (e) {}
  }

  setStatus(`Building geometry for ${satRecords.length} satellites...`);
  buildSatelliteGeometry();
  document.getElementById("stat-sats").textContent =
    `Satellites: ${satRecords.length.toLocaleString()}`;
}

function buildSatelliteGeometry() {
  const count  = satRecords.length;
  satPositions = new Float32Array(count * 3);
  satColors    = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    satColors[i * 3 + 0] = 0.8;
    satColors[i * 3 + 1] = 0.5;
    satColors[i * 3 + 2] = 0.1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(satPositions, 3));
  geometry.setAttribute("color",    new THREE.BufferAttribute(satColors, 3));

  const material = new THREE.PointsMaterial({
    size:         0.008,
    vertexColors: true,
    transparent:  true,
    opacity:      0.9,
    sizeAttenuation: true
  });

  satellitePoints = new THREE.Points(geometry, material);
  earthGroup.add(satellitePoints);
}

function _altitudeColor(altKm) {
  switch (altitudeBandKey(altKm)) {
    case "gt560":    return [0.1, 0.9, 0.2];
    case "530-560":  return [0.6, 0.9, 0.1];
    case "500-530":  return [1.0, 0.85, 0.0];
    case "470-500":  return [1.0, 0.65, 0.05];
    default:         return [1.0, 0.4, 0.05];
  }
}

let _lastVisibleCount = -1;

function updateSatellitePositions() {
  if (!satRecords.length || !satPositions) return;
  const now   = getSimTime();
  const R     = 6371.0;
  const shell = typeof isShellViewEnabled === "function" && isShellViewEnabled();
  let visibleCount = 0;

  for (let i = 0; i < satRecords.length; i++) {
    if (flashingIndices.has(i)) continue;
    try {
      const pv = satellite.propagate(satRecords[i].satrec, now);
      if (!pv || !pv.position) continue;
      const p = pv.position;
      const s = SAT_SCALE;

      const alt        = Math.sqrt(p.x**2 + p.y**2 + p.z**2) - R;
      const isHighRisk = conjunctionSet.has(satRecords[i].id);

      if (!passesFilters(alt, isHighRisk)) {
        satPositions[i*3+0] = 5000;
        satPositions[i*3+1] = 5000;
        satPositions[i*3+2] = 5000;
        continue;
      }

      visibleCount++;

      let tx =  p.x * s;
      let ty =  p.z * s;
      let tz = -p.y * s;

      if (shell) {
        [tx, ty, tz] = _projectToShell(tx, ty, tz);
      }

      satPositions[i*3+0] = tx;
      satPositions[i*3+1] = ty;
      satPositions[i*3+2] = tz;

      if (isHighRisk) {
        satColors[i*3+0] = 1.0;
        satColors[i*3+1] = 0.1;
        satColors[i*3+2] = 0.1;
      } else {
        const [r, g, b] = _altitudeColor(alt);
        satColors[i*3+0] = r;
        satColors[i*3+1] = g;
        satColors[i*3+2] = b;
      }
    } catch (e) {}
  }

  satellitePoints.geometry.attributes.position.needsUpdate = true;
  satellitePoints.geometry.attributes.color.needsUpdate    = true;

  if (visibleCount !== _lastVisibleCount) {
    _lastVisibleCount = visibleCount;
    updateFilterCount(visibleCount, satRecords.length);
  }
}

function markHighRiskSatellites(conjunctions) {
  conjunctionSet.clear();
  for (const c of conjunctions) {
    conjunctionSet.add(c.sat1_id);
    conjunctionSet.add(c.sat2_id);
  }

  const worstMiss = new Map();
  for (const c of conjunctions) {
    const update = (id) => {
      const prev = worstMiss.get(id);
      if (prev === undefined || c.miss_distance_km < prev) {
        worstMiss.set(id, c.miss_distance_km);
      }
    };
    update(c.sat1_id);
    update(c.sat2_id);
  }

  const riskLevel = (missKm) => {
    if (missKm < 10) return 2;
    if (missKm < 25) return 1;
    return 0;
  };

  _haloSatIndices = [];
  _haloRiskLevels = [];

  for (let i = 0; i < satRecords.length; i++) {
    const id = satRecords[i].id;
    if (!worstMiss.has(id)) continue;
    _haloSatIndices.push(i);
    _haloRiskLevels.push(riskLevel(worstMiss.get(id)));
  }

  buildHaloGeometry();
}