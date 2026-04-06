// satellites.js
// Fetches TLE data from the API.
// Uses satellite.js to propagate positions every frame.
// Renders all satellites as a single BufferGeometry Points object.
// This is why 10,000+ satellites run at 60 FPS —
// one draw call for all satellites instead of one per satellite.

const SAT_SCALE = 1.0 / 6371.0;

let satellitePoints = null;
let satPositions = null;
let satColors = null;
let satRecords = [];
let conjunctionSet = new Set();

async function loadSatellites() {
  setStatus("Fetching TLE data from backend...");
  const tles = await fetchTLEs();
  setStatus(`Parsing ${tles.length} satellite TLEs...`);

  // Parse each TLE into a satrec object using satellite.js
  satRecords = [];
  for (const sat of tles) {
    try {
      const satrec = satellite.twoline2satrec(sat.tle_line1, sat.tle_line2);
      satRecords.push({
        satrec: satrec,
        name: sat.name,
        id: sat.id
      });
    } catch (e) {
      // Skip malformed TLEs
    }
  }

  setStatus(`Building geometry for ${satRecords.length} satellites...`);
  buildSatelliteGeometry();
  setStatus(`${satRecords.length} Starlink satellites active.`);

  // Update stats bar
  document.getElementById("stat-sats").textContent =
    `Satellites: ${satRecords.length.toLocaleString()}`;
}

function buildSatelliteGeometry() {
  const count = satRecords.length;

  // All satellite positions in one flat array [x,y,z, x,y,z, ...]
  satPositions = new Float32Array(count * 3);
  satColors    = new Float32Array(count * 3);

  // Default color: dim white-blue
  for (let i = 0; i < count; i++) {
    satColors[i * 3 + 0] = 0.4;  // R
    satColors[i * 3 + 1] = 0.6;  // G
    satColors[i * 3 + 2] = 1.0;  // B
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

function updateSatellitePositions() {
  if (!satRecords.length || !satPositions) return;

  const now = new Date();

  for (let i = 0; i < satRecords.length; i++) {
    const rec = satRecords[i];

    try {
      // Propagate to current time using satellite.js SGP4
      const posVel = satellite.propagate(rec.satrec, now);
      if (!posVel.position) continue;

      const pos = posVel.position; // ECI km

      // Convert ECI km to scene units
      const scale = SAT_SCALE;
      satPositions[i * 3 + 0] = pos.x * scale;
      satPositions[i * 3 + 1] = pos.z * scale; // Y-up in Three.js
      satPositions[i * 3 + 2] = -pos.y * scale;

      // Color by risk level
      if (conjunctionSet.has(rec.id)) {
        // High risk — red
        satColors[i * 3 + 0] = 1.0;
        satColors[i * 3 + 1] = 0.2;
        satColors[i * 3 + 2] = 0.2;
      } else {
        // Normal — blue-white
        satColors[i * 3 + 0] = 0.4;
        satColors[i * 3 + 1] = 0.65;
        satColors[i * 3 + 2] = 1.0;
      }

    } catch (e) {
      // Keep last position on error
    }
  }

  // Tell Three.js the buffers changed
  satellitePoints.geometry.attributes.position.needsUpdate = true;
  satellitePoints.geometry.attributes.color.needsUpdate = true;
}

function markHighRiskSatellites(conjunctions) {
  conjunctionSet.clear();
  for (const c of conjunctions) {
    conjunctionSet.add(c.sat1_id);
    conjunctionSet.add(c.sat2_id);
  }
}