// inspector.js

function openInspector(name, rec, conjunctions) {
  const panel = document.getElementById("inspector");
  const title = document.getElementById("inspector-name");
  const body  = document.getElementById("inspector-body");
  if (!panel || !title || !body) return;

  title.textContent = name;

  // ── Live position ──────────────────────────────────────
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
        <div style="margin-bottom:12px">
          <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;
            color:#404a70;margin-bottom:6px">Live Position</div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;
            border-bottom:1px solid rgba(90,110,255,0.07)">
            <span style="color:#5a6a90;font-size:10px">Altitude</span>
            <span style="color:#b0c8ff;font-weight:500;font-size:11px">
              ${alt} km
              <span style="color:#6b8aff;font-size:9px;margin-left:4px;
                background:rgba(107,138,255,0.12);padding:1px 5px;
                border-radius:4px">${orbitType}</span>
            </span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;
            border-bottom:1px solid rgba(90,110,255,0.07)">
            <span style="color:#5a6a90;font-size:10px">Speed</span>
            <span style="color:#b0c8ff;font-weight:500;font-size:11px">${spd} km/s</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0">
            <span style="color:#5a6a90;font-size:10px">ECI</span>
            <span style="color:#404a70;font-size:10px">
              ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)} km
            </span>
          </div>
        </div>`;
    } else {
      posHTML = `<div style="margin-bottom:12px;color:#ff8866;font-size:11px">
        Decayed or stale TLE</div>`;
    }
  } catch(e) {
    posHTML = `<div style="margin-bottom:12px;color:#ff8866;font-size:11px">
      Propagation error</div>`;
  }

  // ── Orbital parameters ─────────────────────────────────
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
        <div style="display:flex;justify-content:space-between;padding:4px 0;
          border-bottom:1px solid rgba(90,110,255,0.07)">
          <span style="color:#5a6a90;font-size:10px">Period</span>
          <span style="color:#b0c8ff;font-weight:500;font-size:11px">
            ${periodMin} min
            <span style="color:#5a6a90;font-size:10px"> (${periodHr} hr)</span>
          </span>
        </div>`;
    }

    orbitHTML = `
      <div style="margin-bottom:12px">
        <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;
          color:#404a70;margin-bottom:6px">Orbital Parameters</div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;
          border-bottom:1px solid rgba(90,110,255,0.07)">
          <span style="color:#5a6a90;font-size:10px">Inclination</span>
          <span style="color:#b0c8ff;font-weight:500;font-size:11px">${incDeg}°</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;
          border-bottom:1px solid rgba(90,110,255,0.07)">
          <span style="color:#5a6a90;font-size:10px">RAAN</span>
          <span style="color:#b0c8ff;font-weight:500;font-size:11px">${raanDeg}°</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;
          border-bottom:1px solid rgba(90,110,255,0.07)">
          <span style="color:#5a6a90;font-size:10px">Arg. of Perigee</span>
          <span style="color:#b0c8ff;font-weight:500;font-size:11px">${argpDeg}°</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;
          border-bottom:1px solid rgba(90,110,255,0.07)">
          <span style="color:#5a6a90;font-size:10px">Eccentricity</span>
          <span style="color:#b0c8ff;font-weight:500;font-size:11px">${ecc}</span>
        </div>
        ${periodHTML}
      </div>`;
  } catch(e) { orbitHTML = ""; }

  // ── Active conjunctions ────────────────────────────────
  let conjHTML = "";
  if (conjunctions && conjunctions.length > 0) {
    const items = conjunctions.slice(0, 4).map(c => {
      const other = c.sat1_name === name ? c.sat2_name : c.sat1_name;
      const color = c.miss_distance_km < 10 ? "#ff4040" : "#ff8c00";
      return `
        <div style="margin-top:5px;padding:7px 10px;
          background:rgba(255,50,50,0.06);border-radius:6px;
          border-left:2px solid ${color}">
          <div style="color:#b8c8ff;font-weight:600;font-size:11px">${other}</div>
          <div style="color:#5a6a90;font-size:10px;margin-top:2px">
            ${c.miss_distance_km.toFixed(2)} km away
            &nbsp;·&nbsp; Risk ${c.risk_score.toExponential(2)}
          </div>
        </div>`;
    }).join("");
    conjHTML = `
      <div style="margin-bottom:12px">
        <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;
          color:#404a70;margin-bottom:4px">Active Conjunctions</div>
        ${items}
      </div>`;
  } else {
    conjHTML = `
      <div style="margin-bottom:12px">
        <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;
          color:#404a70;margin-bottom:4px">Active Conjunctions</div>
        <div style="color:#303858;font-size:11px">None detected</div>
      </div>`;
  }

  // ── Maneuver simulation ────────────────────────────────
  // Only shown when there is at least one active conjunction.
  // Simulates an along-track burn: offsetting the primary satellite
  // forward or backward in time (equivalent to a prograde/retrograde
  // phasing burn) and showing how separation and risk change.
  let simHTML = "";
  if (conjunctions && conjunctions.length > 0) {
    const topConj    = conjunctions[0];
    const partnerName = topConj.sat1_name === name
      ? topConj.sat2_name : topConj.sat1_name;
    const baseRisk   = topConj.risk_score;
    const baseDist   = topConj.miss_distance_km;

    simHTML = `
      <div id="sim-block" style="margin-top:4px;padding:12px;
        background:rgba(107,138,255,0.06);border-radius:8px;
        border:1px solid rgba(90,110,255,0.15)">
        <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;
          color:#6b8aff;margin-bottom:8px">Maneuver Simulation</div>
        <div style="font-size:10px;color:#404a70;margin-bottom:8px">
          Partner: <span style="color:#8090b8">${partnerName}</span>
        </div>

        <div style="display:flex;justify-content:space-between;
          font-size:9px;color:#303858;margin-bottom:3px">
          <span>← Retrograde (−300 s)</span>
          <span>Prograde (+300 s) →</span>
        </div>
        <input type="range" id="sim-slider"
          min="-300" max="300" step="5" value="0"
          style="width:100%;margin-bottom:10px;accent-color:#6b8aff;cursor:pointer"
          oninput="updateManeuverSim(this.value, '${name}', '${partnerName}',
            ${baseDist}, ${baseRisk})">
        <div style="text-align:center;font-size:10px;color:#5a6a90;margin-bottom:10px">
          Offset: <span id="sim-offset-label" style="color:#a0b4ff;font-weight:600">
            0 s (no burn)
          </span>
        </div>

        <div id="sim-results">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <div style="background:rgba(0,0,0,0.2);border-radius:6px;padding:8px;
              text-align:center">
              <div style="font-size:9px;color:#404a70;margin-bottom:3px">
                CURRENT SEPARATION
              </div>
              <div style="font-size:13px;font-weight:700;color:#ff6060">
                ${baseDist.toFixed(1)} km
              </div>
            </div>
            <div style="background:rgba(0,0,0,0.2);border-radius:6px;padding:8px;
              text-align:center">
              <div style="font-size:9px;color:#404a70;margin-bottom:3px">
                SIMULATED
              </div>
              <div id="sim-new-dist" style="font-size:13px;font-weight:700;
                color:#8090b8">
                — km
              </div>
            </div>
          </div>

          <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;
            gap:6px">
            <div style="font-size:10px;color:#5a6a90">
              Risk: <span style="color:#ff6060">
                ${baseRisk.toExponential(2)}
              </span>
            </div>
            <div style="font-size:10px;color:#5a6a90">
              New risk: <span id="sim-new-risk">—</span>
            </div>
          </div>

          <div style="margin-top:8px;display:flex;justify-content:space-between;
            align-items:center">
            <div style="font-size:10px;color:#5a6a90">
              Δv estimate: <span id="sim-deltav"
                style="color:#a0b4ff;font-weight:600">0.0 m/s</span>
            </div>
            <div id="sim-status" style="font-size:9px;font-weight:700;
              letter-spacing:1px;padding:2px 8px;border-radius:4px;
              background:rgba(255,60,60,0.15);color:#ff6060">
              UNSAFE
            </div>
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

  // Delta-V estimate for a circular-orbit along-track phasing maneuver.
  // For a LEO orbit (~550 km, T ≈ 5760 s, v_orbit ≈ 7.6 km/s):
  //   delta_v = |offset_s| × v_orbit / (3 × T)
  //           = |offset_s| × 7600 / (3 × 5760)
  //           = |offset_s| × 0.440 m/s
  const deltaV = (Math.abs(offset) * 0.440).toFixed(1);
  document.getElementById("sim-deltav").textContent = `${deltaV} m/s`;

  if (offset === 0) {
    document.getElementById("sim-new-dist").textContent = "— km";
    document.getElementById("sim-new-risk").textContent  = "—";
    const s = document.getElementById("sim-status");
    s.textContent         = "UNSAFE";
    s.style.background    = "rgba(255,60,60,0.15)";
    s.style.color         = "#ff6060";
    return;
  }

  // Look up both satrecs from the global satellite record array
  const primaryRec = satRecords.find(r => r.name === primaryName);
  const partnerRec = satRecords.find(r => r.name === partnerName);
  if (!primaryRec || !partnerRec) {
    document.getElementById("sim-new-dist").textContent = "N/A";
    return;
  }

  try {
    // Primary: propagate at simulated time + along-track offset
    const simTime = new Date(getSimTime().getTime() + offset * 1000);
    const pv1 = satellite.propagate(primaryRec.satrec, simTime);
    // Partner: unchanged at current sim time
    const pv2 = satellite.propagate(partnerRec.satrec, getSimTime());

    if (!pv1 || !pv1.position || pv1.position === false ||
        !pv2 || !pv2.position || pv2.position === false) {
      document.getElementById("sim-new-dist").textContent = "Error";
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

    const distEl  = document.getElementById("sim-new-dist");
    const riskEl  = document.getElementById("sim-new-risk");
    const statusEl = document.getElementById("sim-status");

    distEl.textContent  = `${dist.toFixed(1)} km`;
    riskEl.textContent  = newRisk.toExponential(2);

    // Color the simulated distance: green if improving, red if worsening
    const improved = dist > baseDist;
    distEl.style.color = improved ? "#50dd80" : "#ff6060";
    riskEl.style.color = improved ? "#50dd80" : "#ff6060";

    // Safety status badge
    if (dist > 50) {
      statusEl.textContent    = "SAFE";
      statusEl.style.background = "rgba(50,220,100,0.15)";
      statusEl.style.color      = "#50dd80";
    } else if (dist > 25) {
      statusEl.textContent    = "REDUCED";
      statusEl.style.background = "rgba(240,180,0,0.15)";
      statusEl.style.color      = "#f0b800";
    } else if (improved) {
      statusEl.textContent    = "IMPROVING";
      statusEl.style.background = "rgba(255,160,0,0.15)";
      statusEl.style.color      = "#ffa040";
    } else {
      statusEl.textContent    = "UNSAFE";
      statusEl.style.background = "rgba(255,60,60,0.15)";
      statusEl.style.color      = "#ff6060";
    }

  } catch(e) {
    document.getElementById("sim-new-dist").textContent = "Error";
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