// alerts.js
// Renders the collision alert list in the side panel.

function renderAlerts(conjunctions) {
  const list = document.getElementById("alert-list");
  list.innerHTML = "";

  const top = conjunctions.slice(0, 50);

  for (const c of top) {
    const dist = c.miss_distance_km.toFixed(2);
    const vel  = c.relative_velocity_km_s.toFixed(2);
    const risk = c.risk_score.toExponential(2);

    let level = "medium";
    let riskClass = "alert-risk-medium";
    if (c.miss_distance_km < 10) {
      level = "critical";
      riskClass = "alert-risk-critical";
    } else if (c.miss_distance_km < 25) {
      level = "high";
      riskClass = "alert-risk-high";
    }

    const item = document.createElement("div");
    item.className = `alert-item alert-${level}`;
    item.innerHTML = `
      <div class="alert-name">${c.sat1_name}</div>
      <div class="alert-name">${c.sat2_name}</div>
      <div class="alert-detail">Distance: ${dist} km</div>
      <div class="alert-detail">Rel. velocity: ${vel} km/s</div>
      <div class="alert-risk ${riskClass}">Risk: ${risk}</div>
    `;
    list.appendChild(item);
  }
}