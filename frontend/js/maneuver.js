// maneuver.js

function renderManeuvers(maneuvers) {
  // Set export data immediately
  setExportData(maneuvers);

  const list = document.getElementById("maneuver-list");
  list.innerHTML = "";

  maneuvers.forEach(m => {
    const dist = m.miss_distance_km != null ? m.miss_distance_km.toFixed(2) : "—";
    const vel  = m.relative_velocity_km_s != null ? m.relative_velocity_km_s.toFixed(2) : "—";
    let lvl    = m.risk_score > 0.00007 ? "critical" : m.risk_score > 0.00003 ? "high" : "medium";

    const card = document.createElement("div");
    card.className = "maneuver-card";
    card.innerHTML = `
      <div class="maneuver-header">
        <div class="maneuver-sats">
          ${m.sat1_name}
          <span style="color:#303858;margin:0 8px;font-weight:300">↔</span>
          ${m.sat2_name}
        </div>
        <div class="maneuver-deltav">${m.delta_v_m_s.toFixed(4)}<span>m/s delta-V</span></div>
      </div>
      <div class="maneuver-stats">
        <span>Miss distance: <b>${dist} km</b></span>
        <span>Rel. velocity: <b>${vel} km/s</b></span>
        <span>Risk: <b>${m.risk_score.toExponential(2)}</b></span>
        <span class="risk-badge risk-${lvl}">${lvl}</span>
      </div>
      <div class="maneuver-text">${m.recommendation_text}</div>
    `;
    list.appendChild(card);
  });
}