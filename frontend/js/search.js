// search.js
// Satellite search — find by name, highlight on globe, open inspector.

let allSatelliteNames = [];
let conjunctionLookup = {};

function initSearch(conjunctions) {
  // Build a lookup: satellite name → conjunction data
  for (const c of conjunctions) {
    if (!conjunctionLookup[c.sat1_name]) conjunctionLookup[c.sat1_name] = [];
    if (!conjunctionLookup[c.sat2_name]) conjunctionLookup[c.sat2_name] = [];
    conjunctionLookup[c.sat1_name].push(c);
    conjunctionLookup[c.sat2_name].push(c);
  }
  allSatelliteNames = satRecords.map(r => r.name);
}

function handleSearch(query) {
  const box     = document.getElementById("search-results");
  const trimmed = query.trim().toUpperCase();

  if (trimmed.length < 2) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  const matches = allSatelliteNames
    .filter(n => n.toUpperCase().includes(trimmed))
    .slice(0, 10);

  if (matches.length === 0) {
    box.style.display = "none";
    return;
  }

  box.innerHTML = matches.map(name => {
    const isRisky = conjunctionLookup[name] && conjunctionLookup[name].length > 0;
    const badge   = isRisky
      ? `<span class="search-badge-risk risk-critical">RISK</span>`
      : "";
    return `<div class="search-result-item" onclick="selectSatellite('${name}')">
              <span>${name}</span>${badge}
            </div>`;
  }).join("");

  box.style.display = "block";
}

function selectSatellite(name) {
  // Hide search results
  document.getElementById("search-results").style.display = "none";
  document.getElementById("sat-search").value = name;

  // Find the satellite record
  const rec = satRecords.find(r => r.name === name);
  if (!rec) return;

  // Get its current position
  const pv = satellite.propagate(rec.satrec, new Date());
  if (!pv || !pv.position) return;

  const p = pv.position;
  const scale = 1.0 / 6371.0;

  // Zoom camera toward the satellite
  const targetX =  p.x * scale;
  const targetY =  p.z * scale;
  const targetZ = -p.y * scale;

  const dist = Math.sqrt(targetX**2 + targetY**2 + targetZ**2);
  camera.position.set(
    targetX / dist * 2.2,
    targetY / dist * 2.2,
    targetZ / dist * 2.2
  );

  // Open inspector
  openInspector(name, rec, conjunctionLookup[name] || []);

  // Mark it as highlighted
  highlightSatellite(rec.id);
}

function highlightSatellite(id) {
  // Temporarily make the target satellite bright white
  for (let i = 0; i < satRecords.length; i++) {
    if (satRecords[i].id === id) {
      satColors[i * 3 + 0] = 1.0;
      satColors[i * 3 + 1] = 1.0;
      satColors[i * 3 + 2] = 1.0;
    }
  }
  if (satellitePoints) {
    satellitePoints.geometry.attributes.color.needsUpdate = true;
  }
}

// Close search results when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest("#search-bar")) {
    document.getElementById("search-results").style.display = "none";
  }
});