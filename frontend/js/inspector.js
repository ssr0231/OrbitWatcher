// inspector.js

function openInspector(name, rec, conjunctions) {
  const panel = document.getElementById("inspector");
  const title = document.getElementById("inspector-name");
  const body  = document.getElementById("inspector-body");
  if (!panel || !title || !body) return;

  title.textContent = name;

  let posHTML = "";
  try {
    const pv = satellite.propagate(rec.satrec, getSimTime());
    if (pv && pv.position && pv.position !== false) {
      const p   = pv.position;
      const v   = pv.velocity;
      const r   = Math.sqrt(p.x**2 + p.y**2 + p.z**2);
      const alt = (r - 6371.0).toFixed(1);
      const spd = v ? Math.sqrt(v.x**2 + v.y**2 + v.z**2).toFixed(3) : "—";
      const altN = parseFloat(alt);
      const orbitType = altN < 2000 ? "LEO" : altN < 35786 ? "MEO" : "GEO";

      posHTML = `
        <div class="insp-section">
          <div class="insp-label">Live Position</div>
          <div class="insp-row">
            <span class="insp-key">Altitude</span>
            <span class="insp-val">${alt} km<span class="insp-pill">${orbitType}</span></span>
          </div>
          <div class="insp-row">
            <span class="insp-key">Speed</span>
            <span class="insp-val">${spd} km/s</span>
          </div>
          <div class="insp-row">
            <span class="insp-key">ECI</span>
            <span class="insp-val-dim">${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)} km</span>
          </div>
        </div>`;
    } else {
      posHTML = `<div class="insp-section"><div class="insp-error">Decayed or stale TLE</div></div>`;
    }
  } catch(e) {
    posHTML = `<div class="insp-section"><div class="insp-error">Propagation error</div></div>`;
  }

  let orbitHTML = "";
  try {
    const s   = rec.satrec;
    const R2D = 180 / Math.PI;
    const incDeg  = s.inclo != null ? (s.inclo  * R2D).toFixed(2) : "—";
    const raanDeg = s.nodeo != null ? (s.nodeo  * R2D).toFixed(2) : "—";
    const argpDeg = s.argpo != null ? (s.argpo  * R2D).toFixed(2) : "—";
    const ecc     = s.ecco  != null ? s.ecco.toFixed(6)            : "—";
    const n       = s.no;

    let periodHTML = "";
    if (n && n > 0) {
      const periodMin = ((2 * Math.PI) / n).toFixed(1);
      const periodHr  = (periodMin / 60).toFixed(2);
      periodHTML = `
        <div class="insp-row">
          <span class="insp-key">Period</span>
          <span class="insp-val">${periodMin} min<span class="insp-pill">${periodHr} hr</span></span>
        </div>`;
    }

    orbitHTML = `
      <div class="insp-section">
        <div class="insp-label">Orbital Parameters</div>
        <div class="insp-row"><span class="insp-key">Inclination</span><span class="insp-val">${incDeg}°</span></div>
        <div class="insp-row"><span class="insp-key">RAAN</span><span class="insp-val">${raanDeg}°</span></div>
        <div class="insp-row"><span class="insp-key">Arg. of Perigee</span><span class="insp-val">${argpDeg}°</span></div>
        <div class="insp-row"><span class="insp-key">Eccentricity</span><span class="insp-val">${ecc}</span></div>
        ${periodHTML}
      </div>`;
  } catch(e) { orbitHTML = ""; }

  let conjHTML = "";
  if (conjunctions && conjunctions.length > 0) {
    const items = conjunctions.slice(0, 4).map(c => {
      const other    = c.sat1_name === name ? c.sat2_name : c.sat1_name;
      const isCritical = c.miss_distance_km < 10;
      return `
        <div class="insp-conj-card ${isCritical ? '' : 'insp-conj-high'}">
          <div class="insp-conj-name">${other}</div>
          <div class="insp-conj-detail">${c.miss_distance_km.toFixed(2)} km away · Risk ${c.risk_score.toExponential(2)}</div>
        </div>`;
    }).join("");
    conjHTML = `
      <div class="insp-section">
        <div class="insp-label">Active Conjunctions</div>
        ${items}
      </div>`;
  } else {
    conjHTML = `
      <div class="insp-section">
        <div class="insp-label">Active Conjunctions</div>
        <div class="insp-empty">None detected</div>
      </div>`;
  }

  let simHTML = "";
  if (conjunctions && conjunctions.length > 0) {
    const topConj    = conjunctions[0];
    const partnerName = topConj.sat1_name === name
      ? topConj.sat2_name : topConj.sat1_name;
    const baseRisk   = topConj.risk_score;
    const baseDist   = topConj.miss_distance_km;

    simHTML = `
      <div id="sim-block">
        <div class="sim-title">Maneuver Simulation</div>
        <div class="sim-partner">Partner: <span>${partnerName}</span></div>

        <div class="sim-slider-labels">
          <span>← Retrograde (−300 s)</span>
          <span>Prograde (+300 s) →</span>
        </div>
        <input type="range" id="sim-slider"
          min="-300" max="300" step="5" value="0"
          oninput="updateManeuverSim(this.value, '${name}', '${partnerName}',
            ${baseDist}, ${baseRisk})">
        <div class="sim-offset-display">
          Offset: <span id="sim-offset-label">0 s (no burn)</span>
        </div>

        <div id="sim-results">
          <div class="sim-grid">
            <div class="sim-stat-box">
              <div class="sim-stat-label">CURRENT SEPARATION</div>
              <div class="sim-stat-value">${baseDist.toFixed(1)} km</div>
            </div>
            <div class="sim-stat-box">
              <div class="sim-stat-label">SIMULATED</div>
              <div class="sim-stat-value" id="sim-new-dist" style="color:var(--text-tertiary)">— km</div>
            </div>
          </div>

          <div class="sim-meta-row">
            <div>Risk: <b style="color:var(--risk-critical)">${baseRisk.toExponential(2)}</b></div>
            <div>New risk: <b id="sim-new-risk">—</b></div>
          </div>

          <div class="sim-footer">
            <div class="sim-deltav-label">Δv estimate: <span class="sim-deltav-value" id="sim-deltav">0.0 m/s</span></div>
            <div id="sim-status" class="sim-status-badge sim-status-unsafe">UNSAFE</div>
          </div>
        </div>
      </div>`;
  }

  body.innerHTML = posHTML + orbitHTML + conjHTML + simHTML;
  panel.classList.remove("hidden");
}


function updateManeuverSim(offsetStr, primaryName, partnerName,
                            baseDist, baseRisk) {
  const offset = parseFloat(offsetStr);

  document.getElementById("sim-offset-label").textContent =
    offset === 0 ? "0 s (no burn)"
    : offset > 0 ? `+${offset} s prograde`
    : `${offset} s retrograde`;

  const deltaV = (Math.abs(offset) * 0.440).toFixed(1);
  document.getElementById("sim-deltav").textContent = `${deltaV} m/s`;

  const distEl   = document.getElementById("sim-new-dist");
  const riskEl   = document.getElementById("sim-new-risk");
  const statusEl = document.getElementById("sim-status");

  if (offset === 0) {
    distEl.textContent = "— km";
    distEl.style.color = "var(--text-tertiary)";
    riskEl.textContent = "—";
    riskEl.style.color = "";
    statusEl.textContent = "UNSAFE";
    statusEl.className   = "sim-status-badge sim-status-unsafe";
    return;
  }

  const primaryRec = satRecords.find(r => r.name === primaryName);
  const partnerRec = satRecords.find(r => r.name === partnerName);
  if (!primaryRec || !partnerRec) {
    distEl.textContent = "N/A";
    return;
  }

  try {
    const simTime = new Date(getSimTime().getTime() + offset * 1000);
    const pv1 = satellite.propagate(primaryRec.satrec, simTime);
    const pv2 = satellite.propagate(partnerRec.satrec, getSimTime());

    if (!pv1 || !pv1.position || pv1.position === false ||
        !pv2 || !pv2.position || pv2.position === false) {
      distEl.textContent = "Error";
      return;
    }

    const dx   = pv1.position.x - pv2.position.x;
    const dy   = pv1.position.y - pv2.position.y;
    const dz   = pv1.position.z - pv2.position.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

    const dvx = pv1.velocity.x - pv2.velocity.x;
    const dvy = pv1.velocity.y - pv2.velocity.y;
    const dvz = pv1.velocity.z - pv2.velocity.z;
    const rv  = Math.sqrt(dvx*dvx + dvy*dvy + dvz*dvz);

    const newRisk = (1.0 / (dist + 1.0)) * (rv / 15.0);

    distEl.textContent = `${dist.toFixed(1)} km`;
    riskEl.textContent = newRisk.toExponential(2);

    const improved = dist > baseDist;
    const improvedColor = "var(--risk-low)";
    const worseColor    = "var(--risk-critical)";
    distEl.style.color = improved ? improvedColor : worseColor;
    riskEl.style.color = improved ? improvedColor : worseColor;

    if (dist > 50) {
      statusEl.textContent = "SAFE";
      statusEl.className   = "sim-status-badge sim-status-safe";
    } else if (dist > 25) {
      statusEl.textContent = "REDUCED";
      statusEl.className   = "sim-status-badge sim-status-reduced";
    } else if (improved) {
      statusEl.textContent = "IMPROVING";
      statusEl.className   = "sim-status-badge sim-status-improving";
    } else {
      statusEl.textContent = "UNSAFE";
      statusEl.className   = "sim-status-badge sim-status-unsafe";
    }

  } catch(e) {
    distEl.textContent = "Error";
  }
}


function closeInspector() {
  const panel = document.getElementById("inspector");
  if (panel) panel.classList.add("hidden");
  clearSelectionTrail();
  const s = document.getElementById("sat-search");
  if (s) s.value = "";
}

function flashSatellite(id) {
  const rec = satRecords.find(r => r.id === id);
  if (rec) drawSelectionTrail(rec);
}