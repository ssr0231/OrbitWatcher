// alerts.js

let _alertsExpanded = false;

// Expands the alert list — called by toggleAlertsPanel and PanelManager.
function _expandAlerts() {
  _alertsExpanded = true;
  const list    = document.getElementById("alert-list");
  const chevron = document.getElementById("alerts-chevron");
  if (list)    list.classList.add("expanded");
  if (chevron) chevron.classList.add("expanded");
}

// Collapses the alert list — called directly and by PanelManager
// when another panel opens. Exposed without underscore prefix so
// panel-manager.js can call it by name in its registered close function.
function collapseAlerts() {
  _alertsExpanded = false;
  const list    = document.getElementById("alert-list");
  const chevron = document.getElementById("alerts-chevron");
  if (list)    list.classList.remove("expanded");
  if (chevron) chevron.classList.remove("expanded");
}

// Called by #panel-title onclick. Toggles expanded/collapsed state.
// When expanding: uses PanelManager to close other panels first.
function toggleAlertsPanel() {
  if (_alertsExpanded) {
    collapseAlerts();
  } else {
    if (window.PanelManager) {
      PanelManager.open("alerts", _expandAlerts);
    } else {
      _expandAlerts();
    }
  }
}

function renderAlerts(conjunctions) {
  const list = document.getElementById("alert-list");
  list.innerHTML = "";

  conjunctions.slice(0, 50).forEach(c => {
    const dist  = c.miss_distance_km.toFixed(2);
    const vel   = c.relative_velocity_km_s.toFixed(2);
    const risk  = c.risk_score.toExponential(2);

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