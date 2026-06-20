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

  // Default: dim orange-yellow until first position update
  for (let i = 0; i < count; i++) {
    satColors[i * 3 + 0] = 0.8;
    satColors[i * 3 + 1] = 0.5;
    satColors[i * 3 + 2] = 0.1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(satPositions, 3));
  geometry.setAttribute("color",    new THREE.BufferAttribute(satColors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.008,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true
  });

  satellitePoints = new THREE.Points(geometry, material);
  earthGroup.add(satellitePoints);
}

// Returns RGB color based on altitude — matches reference image palette
function _altitudeColor(altKm) {
  if (altKm > 560) {
    // High shell — green (like new gen-2 Starlinks)
    return [0.1, 0.9, 0.2];
  } else if (altKm > 530) {
    // Upper-mid shell — yellow-green
    return [0.6, 0.9, 0.1];
  } else if (altKm > 500) {
    // Mid shell — yellow
    return [1.0, 0.85, 0.0];
  } else if (altKm > 470) {
    // Lower-mid shell — orange-yellow
    return [1.0, 0.65, 0.05];
  } else {
    // Low shell / raising orbit — orange
    return [1.0, 0.4, 0.05];
  }
}

function updateSatellitePositions() {
  if (!satRecords.length || !satPositions) return;
  const now = getSimTime();
  const R   = 6371.0;

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
        // High risk — bright red, overrides altitude color
        satColors[i*3+0] = 1.0;
        satColors[i*3+1] = 0.1;
        satColors[i*3+2] = 0.1;
      } else {
        // Color by altitude
        const alt = Math.sqrt(p.x**2 + p.y**2 + p.z**2) - R;
        const [r, g, b] = _altitudeColor(alt);
        satColors[i*3+0] = r;
        satColors[i*3+1] = g;
        satColors[i*3+2] = b;
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
  // No auto-drawn trails — globe stays clean on load
}