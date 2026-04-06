// maneuver.js
// Renders the maneuver suggestions panel.

function renderManeuvers(maneuvers) {
  const list = document.getElementById("maneuver-list");
  list.innerHTML = `
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;
    color:#7090ff;margin-bottom:20px;padding-bottom:12px;
    border-bottom:1px solid rgba(100,120,255,0.2);">
      Maneuver Recommendations — ${maneuvers.length} active
    </div>
  `;

  for (const m of maneuvers) {
    const dist = m.miss_distance_km
      ? m.miss_distance_km.toFixed(2)
      : "—";
    const vel = m.relative_velocity_km_s
      ? m.relative_velocity_km_s.toFixed(2)
      : "—";

    let riskLevel = "medium";
    if (m.risk_score > 0.00007)      riskLevel = "critical";
    else if (m.risk_score > 0.00003) riskLevel = "high";

    const card = document.createElement("div");
    card.className = "maneuver-card";
    card.innerHTML = `
      <div class="maneuver-header">
        <div class="maneuver-sats">
          ${m.sat1_name}
          <span style="color:#5060a0;font-size:11px;margin:0 6px">↔</span>
          ${m.sat2_name}
        </div>
        <div class="maneuver-deltav">
          ${m.delta_v_m_s.toFixed(4)}
          <span>m/s delta-V</span>
        </div>
      </div>
      <div class="maneuver-stats">
        <span>Miss distance: <b style="color:#c0d0ff">${dist} km</b></span>
        <span>Rel. velocity: <b style="color:#c0d0ff">${vel} km/s</b></span>
        <span>Risk score: <b style="color:#c0d0ff">${m.risk_score.toExponential(2)}</b></span>
        <span class="risk-badge risk-${riskLevel}">${riskLevel}</span>
      </div>
      <div class="maneuver-text">${m.recommendation_text}</div>
    `;
    list.appendChild(card);
  }
}