// satellites.js

const SAT_SCALE = 1.0 / 6371.0;

let satellitePoints = null;
let satPositions    = null;
let satColors       = null;
let satRecords      = [];
let conjunctionSet  = new Set();
const flashingIndices = new Set();

async function loadSatellites() {
  setStatus("Fetching TLE data from backend...");
  const tles = await fetchTLEs();
  if (!tles.length) { setStatus("Warning: no TLE data received."); return; }

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
    satColors[i * 3 + 0] = 0.38;
    satColors[i * 3 + 1] = 0.62;
    satColors[i * 3 + 2] = 1.0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(satPositions, 3));
  geometry.setAttribute("color",    new THREE.BufferAttribute(satColors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.007, vertexColors: true,
    transparent: true, opacity: 0.85, sizeAttenuation: true
  });

  satellitePoints = new THREE.Points(geometry, material);
  earthGroup.add(satellitePoints);
}

function updateSatellitePositions() {
  if (!satRecords.length || !satPositions) return;
  const now = new Date();

  for (let i = 0; i < satRecords.length; i++) {
    if (flashingIndices.has(i)) continue;
    try {
      const pv = satellite.propagate(satRecords[i].satrec, now);
      if (!pv || !pv.position) continue;
      const p = pv.position;
      const s = SAT_SCALE;
      satPositions[i*3+0] =  p.x * s;
      satPositions[i*3+1] =  p.z * s;
      satPositions[i*3+2] = -p.y * s;

      if (conjunctionSet.has(satRecords[i].id)) {
        satColors[i*3+0] = 1.0; satColors[i*3+1] = 0.18; satColors[i*3+2] = 0.18;
      } else {
        satColors[i*3+0] = 0.38; satColors[i*3+1] = 0.62; satColors[i*3+2] = 1.0;
      }
    } catch (e) {}
  }

  satellitePoints.geometry.attributes.position.needsUpdate = true;
  satellitePoints.geometry.attributes.color.needsUpdate    = true;
}

function markHighRiskSatellites(conjunctions) {
  conjunctionSet.clear();
  for (const c of conjunctions) {
    conjunctionSet.add(c.sat1_id);
    conjunctionSet.add(c.sat2_id);
  }

  clearTrails();
  const topIds = new Set();
  conjunctions.slice(0, 10).forEach(c => {
    topIds.add(c.sat1_id);
    topIds.add(c.sat2_id);
  });

  for (const rec of satRecords) {
    if (topIds.has(rec.id)) drawOrbitTrail(rec);
  }
}