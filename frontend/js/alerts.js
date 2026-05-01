// alerts.js

function renderAlerts(conjunctions) {
  const list = document.getElementById("alert-list");
  list.innerHTML = "";

  conjunctions.slice(0, 50).forEach(c => {
    const dist  = c.miss_distance_km.toFixed(2);
    const vel   = c.relative_velocity_km_s.toFixed(2);
    const risk  = c.risk_score.toExponential(2);

    let level = "medium", riskClass = "alert-risk-medium";
    if (c.miss_distance_km < 10)      { level = "critical"; riskClass = "alert-risk-critical"; }
    else if (c.miss_distance_km < 25) { level = "high";     riskClass = "alert-risk-high"; }

    const item = document.createElement("div");
    item.className = `alert-item alert-${level}`;
    item.innerHTML = `
      <div class="alert-name">${c.sat1_name}</div>
      <div class="alert-name">${c.sat2_name}</div>
      <div class="alert-detail">Distance: ${dist} km</div>
      <div class="alert-detail">Rel. velocity: ${vel} km/s</div>
      <div class="alert-risk ${riskClass}">Risk: ${risk}</div>
    `;

    item.addEventListener("click", () => {
      document.querySelectorAll(".alert-item")
        .forEach(el => el.classList.remove("selected"));
      item.classList.add("selected");

      // Find both satellite records
      const rec1 = satRecords.find(r => r.name === c.sat1_name);
      const rec2 = satRecords.find(r => r.name === c.sat2_name);

      // Clear any existing trails first
      clearSelectionTrail();

      // Draw teal orbit trail for sat1, open inspector for it
      if (rec1) {
        openInspector(c.sat1_name, rec1, [c]);
        drawSelectionTrail(rec1);
      }

      // Draw red orbit trail for sat2
      if (rec2) {
        drawSecondaryTrail(rec2);
      }
    });

    list.appendChild(item);
  });
}