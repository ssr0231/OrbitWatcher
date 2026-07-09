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
    if (window.PanelManager) PanelManager.close("search");
    else {
      box.style.display = "none";
      box.innerHTML     = "";
    }
    return;
  }

  if (allSatelliteNames.length === 0) {
    box.innerHTML     = `<div class="search-result-item" style="color:#404a70">Still loading...</div>`;
    if (window.PanelManager) PanelManager.open("search", () => { box.style.display = "block"; });
    else box.style.display = "block";
    return;
  }

  const matches = allSatelliteNames
    .filter(n => n.toUpperCase().includes(trimmed))
    .slice(0, 12);

  if (matches.length === 0) {
    box.innerHTML     = `<div class="search-result-item" style="color:#404a70">No results found</div>`;
    if (window.PanelManager) PanelManager.open("search", () => { box.style.display = "block"; });
    else box.style.display = "block";
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

  if (window.PanelManager) PanelManager.open("search", () => { box.style.display = "block"; });
  else box.style.display = "block";
}

function selectSatellite(name) {
  if (window.PanelManager) PanelManager.close("search");
  else document.getElementById("search-results").style.display = "none";
  document.getElementById("sat-search").value = name;

  const rec = satRecords.find(r => r.name === name);
  if (!rec) return;

  const conjs = conjunctionLookup[name] || [];

  openInspector(name, rec, conjs);
  clearSelectionTrail();
  drawSelectionTrail(rec);

  if (conjs.length > 0) {
    const partnerName = conjs[0].sat1_name === name
      ? conjs[0].sat2_name
      : conjs[0].sat1_name;
    const partner = satRecords.find(r => r.name === partnerName);
    if (partner) drawSecondaryTrail(partner);
  }

  // Point the camera toward the selected satellite.
  // globeFaceSatellite() is defined in globe.js — it converts the
  // satellite's ECI position to camera spherical angles (theta/phi)
  // so the camera rotates to face the satellite rather than rotating
  // the earthGroup as the old model did.
  try {
    const pv = satellite.propagate(rec.satrec, new Date());
    if (pv && pv.position) {
      globeFaceSatellite(pv.position);
    }
  } catch(e) {}
}

document.addEventListener("click", e => {
  if (!e.target.closest("#search-bar")) {
    if (window.PanelManager) PanelManager.close("search");
    else {
      const box = document.getElementById("search-results");
      if (box) box.style.display = "none";
    }
  }
});