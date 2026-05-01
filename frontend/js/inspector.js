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
    const pv = satellite.propagate(rec.satrec, new Date());

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
      posHTML = `
        <div style="margin-bottom:12px;color:#ff8866;font-size:11px">
          Decayed or stale TLE
        </div>`;
    }
  } catch(e) {
    posHTML = `
      <div style="margin-bottom:12px;color:#ff8866;font-size:11px">
        Propagation error
      </div>`;
  }

  // ── Orbital parameters ─────────────────────────────────
  // satellite.js 4.1.3 satrec field names:
  //   inclo  = inclination (radians)
  //   nodeo  = RAAN (radians)
  //   argpo  = argument of perigee (radians)
  //   ecco   = eccentricity
  //   no     = mean motion (radians/minute)
  let orbitHTML = "";
  try {
    const s = rec.satrec;
    const R2D = 180 / Math.PI;

    const incDeg  = s.inclo  != null ? (s.inclo  * R2D).toFixed(2) : "—";
    const raanDeg = s.nodeo  != null ? (s.nodeo  * R2D).toFixed(2) : "—";
    const argpDeg = s.argpo  != null ? (s.argpo  * R2D).toFixed(2) : "—";
    const ecc     = s.ecco   != null ? s.ecco.toFixed(6)            : "—";
    const n       = s.no;   // rad/min — this field is always present in sgp4 satrec

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
  } catch(e) {
    orbitHTML = "";
  }

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
      <div>
        <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;
          color:#404a70;margin-bottom:4px">Active Conjunctions</div>
        ${items}
      </div>`;
  } else {
    conjHTML = `
      <div>
        <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;
          color:#404a70;margin-bottom:4px">Active Conjunctions</div>
        <div style="color:#303858;font-size:11px">None detected</div>
      </div>`;
  }

  body.innerHTML = posHTML + orbitHTML + conjHTML;
  panel.classList.remove("hidden");
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