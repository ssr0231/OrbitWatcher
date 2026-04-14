// inspector.js

function openInspector(name, rec, conjunctions) {
  const panel = document.getElementById("inspector");
  const title = document.getElementById("inspector-name");
  const body  = document.getElementById("inspector-body");
  if (!panel || !title || !body) return;

  title.textContent = name;

  let posHTML = "";
  try {
    const pv = satellite.propagate(rec.satrec, new Date());
    if (pv && pv.position) {
      const p   = pv.position;
      const v   = pv.velocity;
      const alt = (Math.sqrt(p.x**2 + p.y**2 + p.z**2) - 6371.0).toFixed(1);
      const spd = v ? Math.sqrt(v.x**2 + v.y**2 + v.z**2).toFixed(3) : "—";
      const altNum = parseFloat(alt);
      const orbitType = altNum < 2000 ? "LEO" : altNum < 35786 ? "MEO" : "GEO";
      posHTML = `
        <div>Altitude: <b>${alt} km</b> <span style="color:#404a70;font-size:10px">${orbitType}</span></div>
        <div>Speed: <b>${spd} km/s</b></div>
        <div style="font-size:10px;color:#303858;margin-top:2px">
          ECI: ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)} km
        </div>`;
    }
  } catch(e) {
    posHTML = `<div style="color:#404a70">Position unavailable</div>`;
  }

  let conjHTML = "";
  if (conjunctions && conjunctions.length > 0) {
    conjHTML = conjunctions.slice(0, 4).map(c => {
      const other = c.sat1_name === name ? c.sat2_name : c.sat1_name;
      const color = c.miss_distance_km < 10 ? "#ff4040" : "#ff8c00";
      return `
        <div style="margin-top:6px;padding:7px 10px;
          background:rgba(255,50,50,0.06);border-radius:6px;
          border-left:2px solid ${color}">
          <div style="color:#b8c8ff;font-weight:600;font-size:11px">${other}</div>
          <div style="color:#5a6a90;font-size:10px;margin-top:2px">
            ${c.miss_distance_km.toFixed(2)} km · Risk ${c.risk_score.toExponential(2)}
          </div>
        </div>`;
    }).join("");
  } else {
    conjHTML = `<div style="color:#303858;font-size:11px;margin-top:4px">No active conjunctions</div>`;
  }

  body.innerHTML = `
    <div style="margin-bottom:10px">${posHTML}</div>
    <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;
      color:#303858;margin-bottom:4px;margin-top:10px">Active Conjunctions</div>
    ${conjHTML}
  `;
  panel.classList.remove("hidden");
}

function closeInspector() {
  const panel = document.getElementById("inspector");
  if (panel) panel.classList.add("hidden");
  const s = document.getElementById("sat-search");
  if (s) s.value = "";
}

function flashSatellite(id) {
  if (!satRecords || !satColors) return;
  const idx = satRecords.findIndex(r => r.id === id);
  if (idx === -1) return;

  flashingIndices.add(idx);
  satColors[idx*3+0] = 1.0;
  satColors[idx*3+1] = 1.0;
  satColors[idx*3+2] = 1.0;
  if (satellitePoints) satellitePoints.geometry.attributes.color.needsUpdate = true;

  setTimeout(() => {
    flashingIndices.delete(idx);
    if (idx >= satRecords.length || !satColors) return;
    const isRisky = conjunctionSet && conjunctionSet.has(satRecords[idx].id);
    satColors[idx*3+0] = isRisky ? 1.0 : 0.38;
    satColors[idx*3+1] = isRisky ? 0.18 : 0.62;
    satColors[idx*3+2] = isRisky ? 0.18 : 1.0;
    if (satellitePoints) satellitePoints.geometry.attributes.color.needsUpdate = true;
  }, 2500);
}