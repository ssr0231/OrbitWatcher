// alerts.js

function renderAlerts(conjunctions) {
  const list = document.getElementById("alert-list");
  list.innerHTML = "";

  conjunctions.slice(0, 50).forEach(c => {
    const dist  = c.miss_distance_km.toFixed(2);
    const vel   = c.relative_velocity_km_s.toFixed(2);
    const risk  = c.risk_score.toExponential(2);

    // Four-tier risk classification — thresholds match the CSS design
    // system tokens, the KPI strip in dashboard.js, and the backend
    // analytics.py risk_distribution query exactly.
    // Critical: < 10 km   → red
    // High:     10–25 km  → orange
    // Medium:   25–50 km  → yellow
    // Low:      ≥ 50 km   → green  (was previously shown as medium)
    let level, riskClass;
    if      (c.miss_distance_km < 10) { level = "critical"; riskClass = "alert-risk-critical"; }
    else if (c.miss_distance_km < 25) { level = "high";     riskClass = "alert-risk-high";     }
    else if (c.miss_distance_km < 50) { level = "medium";   riskClass = "alert-risk-medium";   }
    else                               { level = "low";      riskClass = "alert-risk-low";      }

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

      const rec1 = satRecords.find(r => r.name === c.sat1_name);
      const rec2 = satRecords.find(r => r.name === c.sat2_name);

      clearSelectionTrail();

      if (rec1) {
        openInspector(c.sat1_name, rec1, [c]);
        drawSelectionTrail(rec1);
      }

      if (rec2) {
        drawSecondaryTrail(rec2);
      }
    });

    list.appendChild(item);
  });
}