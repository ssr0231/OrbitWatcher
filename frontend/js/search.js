// search.js

let allSatelliteNames = [];
let conjunctionLookup = {};

function initSearch(conjunctions) {
  conjunctionLookup = {};
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
    box.innerHTML     = "";
    return;
  }

  if (allSatelliteNames.length === 0) {
    box.innerHTML     = `<div class="search-result-item" style="color:#404a70">Still loading...</div>`;
    box.style.display = "block";
    return;
  }

  const matches = allSatelliteNames
    .filter(n => n.toUpperCase().includes(trimmed))
    .slice(0, 12);

  if (matches.length === 0) {
    box.innerHTML     = `<div class="search-result-item" style="color:#404a70">No results found</div>`;
    box.style.display = "block";
    return;
  }

  box.innerHTML = matches.map(name => {
    const isRisky = !!(conjunctionLookup[name] && conjunctionLookup[name].length > 0);
    const badge   = isRisky
      ? `<span style="background:rgba(255,50,50,0.2);color:#ff6666;
           padding:2px 7px;border-radius:10px;font-size:9px;font-weight:700">RISK</span>`
      : "";
    return `<div class="search-result-item" onclick="selectSatellite('${name}')">
              <span>${name}</span>${badge}
            </div>`;
  }).join("");

  box.style.display = "block";
}

function selectSatellite(name) {
  document.getElementById("search-results").style.display = "none";
  document.getElementById("sat-search").value = name;

  const rec = satRecords.find(r => r.name === name);
  if (!rec) return;

  const conjs = conjunctionLookup[name] || [];

  // Open inspector with orbital parameters
  openInspector(name, rec, conjs);

  // Clear previous trails
  clearSelectionTrail();

  // Draw teal orbit trail for this satellite
  drawSelectionTrail(rec);

  // If it has a conjunction partner, draw that in red too
  if (conjs.length > 0) {
    const partnerName = conjs[0].sat1_name === name
      ? conjs[0].sat2_name
      : conjs[0].sat1_name;
    const partner = satRecords.find(r => r.name === partnerName);
    if (partner) drawSecondaryTrail(partner);
  }

  // Rotate globe to face the satellite's current longitude
  try {
    const pv = satellite.propagate(rec.satrec, new Date());
    if (pv && pv.position) {
      const p   = pv.position;
      const lon = Math.atan2(p.y, p.x);
      earthGroup.rotation.y = -lon;
    }
  } catch(e) {}
}

document.addEventListener("click", e => {
  if (!e.target.closest("#search-bar")) {
    const box = document.getElementById("search-results");
    if (box) box.style.display = "none";
  }
});