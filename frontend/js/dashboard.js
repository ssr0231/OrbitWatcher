// dashboard.js
// Chart.js charts — resize loop fixed by constraining canvas height in CSS.

let chartsBuilt   = false;
let chartInstances = [];

function renderKPIStrip(conjunctions, analytics) {
  const el = document.getElementById("kpi-strip");
  if (!el) return;

  const totalSats   = analytics.total_satellites ?? satRecords.length ?? 0;
  const activeAlerts = conjunctions.length;
  const criticalCount = conjunctions.filter(c => c.miss_distance_km < 10).length;
  const highCount      = conjunctions.filter(c => c.miss_distance_km >= 10 && c.miss_distance_km < 25).length;

  let health = "NOMINAL", healthClass = "kpi-nominal";
  if (criticalCount >= 5)      { health = "CRITICAL"; healthClass = "kpi-critical"; }
  else if (criticalCount >= 1) { health = "ELEVATED"; healthClass = "kpi-elevated"; }

  const topSat = (analytics.top_satellites && analytics.top_satellites[0])
    ? analytics.top_satellites[0].name.replace("STARLINK-", "SL-")
    : "—";

  el.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Total Satellites</div>
      <div class="kpi-value">${totalSats.toLocaleString()}</div>
      <div class="kpi-sub">Tracked from CelesTrak</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Active Alerts</div>
      <div class="kpi-value">${activeAlerts.toLocaleString()}</div>
      <div class="kpi-sub">Conjunctions within 50 km</div>
    </div>
    <div class="kpi-card ${criticalCount > 0 ? 'kpi-critical' : ''}">
      <div class="kpi-label">High-Risk Conjunctions</div>
      <div class="kpi-value">${criticalCount}</div>
      <div class="kpi-sub">${highCount} additional in high tier</div>
    </div>
    <div class="kpi-card ${healthClass}">
      <div class="kpi-label">System Health</div>
      <div class="kpi-value" style="font-size:var(--fs-lg)">${health}</div>
      <div class="kpi-sub">Based on critical-tier count</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Top Watch Item</div>
      <div class="kpi-value" style="font-size:var(--fs-lg)">${topSat}</div>
      <div class="kpi-sub">Highest cumulative risk</div>
    </div>
  `;
}

async function buildDashboard(conjunctions, analytics) {
  if (chartsBuilt) return;
  chartsBuilt = true;

  renderKPIStrip(conjunctions, analytics);

  chartInstances.forEach(c => c.destroy());
  chartInstances = [];

  const gridColor = "rgba(107,138,255,0.07)";
  const tickColor = "#4a5880";
  const tickFont  = { size: 10, family: "'Inter', sans-serif" };

  const baseScales = {
    x: { ticks: { color: tickColor, font: tickFont }, grid: { color: gridColor } },
    y: { ticks: { color: tickColor, font: tickFont }, grid: { color: gridColor } }
  };

  const riskDist   = analytics.risk_distribution || [];
  const riskLabels = riskDist.map(r => r.level.charAt(0).toUpperCase() + r.level.slice(1));
  const riskCounts = riskDist.map(r => r.count);
  const riskColors = riskDist.map(r => {
    if (r.level === "critical") return "rgba(255,60,60,0.8)";
    if (r.level === "high")     return "rgba(255,140,0,0.8)";
    if (r.level === "medium")   return "rgba(240,192,0,0.7)";
    return "rgba(107,138,255,0.55)";
  });

  chartInstances.push(new Chart(document.getElementById("chart-risk"), {
    type: "doughnut",
    data: {
      labels: riskLabels,
      datasets: [{
        data: riskCounts,
        backgroundColor: riskColors,
        borderColor: "#06061a",
        borderWidth: 3,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      cutout: "60%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#6a7aaa",
            font: { size: 11, family: "'Inter', sans-serif" },
            padding: 14,
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.parsed} conjunctions` }
        }
      }
    }
  }));

  const topSats  = analytics.top_satellites || [];
  const satNames = topSats.map(s => s.name.replace("STARLINK-", "SL-"));
  const satRisks = topSats.map(s => parseFloat((s.total_risk * 1e6).toFixed(2)));

  chartInstances.push(new Chart(document.getElementById("chart-topsats"), {
    type: "bar",
    data: {
      labels: satNames,
      datasets: [{
        label: "Risk ×10⁻⁶",
        data: satRisks,
        backgroundColor: satRisks.map((_, i) =>
          i === 0 ? "rgba(255,70,70,0.75)"
          : i < 3  ? "rgba(255,140,0,0.70)"
          :           "rgba(107,138,255,0.55)"
        ),
        borderColor: "transparent",
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(2)} ×10⁻⁶` } }
      },
      scales: {
        ...baseScales,
        x: { ...baseScales.x, ticks: { ...baseScales.x.ticks, maxRotation: 40 } }
      }
    }
  }));

  const buckets = [
    { label: "0–5 km",   min: 0,  max: 5  },
    { label: "5–10 km",  min: 5,  max: 10 },
    { label: "10–20 km", min: 10, max: 20 },
    { label: "20–35 km", min: 20, max: 35 },
    { label: "35–50 km", min: 35, max: 50 }
  ];

  chartInstances.push(new Chart(document.getElementById("chart-distance"), {
    type: "bar",
    data: {
      labels: buckets.map(b => b.label),
      datasets: [{
        data: buckets.map(b =>
          conjunctions.filter(c =>
            c.miss_distance_km >= b.min && c.miss_distance_km < b.max
          ).length
        ),
        backgroundColor: [
          "rgba(255,60,60,0.75)",
          "rgba(255,120,40,0.72)",
          "rgba(240,192,0,0.68)",
          "rgba(80,200,120,0.62)",
          "rgba(107,138,255,0.55)"
        ],
        borderColor: "transparent",
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: { legend: { display: false } },
      scales: baseScales
    }
  }));

  const velBuckets = [
    { label: "0–3",   min: 0,  max: 3  },
    { label: "3–6",   min: 3,  max: 6  },
    { label: "6–9",   min: 6,  max: 9  },
    { label: "9–12",  min: 9,  max: 12 },
    { label: "12–15", min: 12, max: 15 }
  ];

  chartInstances.push(new Chart(document.getElementById("chart-velocity"), {
    type: "line",
    data: {
      labels: velBuckets.map(b => b.label + " km/s"),
      datasets: [{
        label: "Conjunctions",
        data: velBuckets.map(b =>
          conjunctions.filter(c =>
            c.relative_velocity_km_s >= b.min &&
            c.relative_velocity_km_s < b.max
          ).length
        ),
        borderColor: "rgba(107,180,255,0.9)",
        backgroundColor: "rgba(107,180,255,0.07)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(107,180,255,1)",
        pointBorderColor: "#06061a",
        pointBorderWidth: 2,
        pointRadius: 5,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: { legend: { display: false } },
      scales: baseScales
    }
  }));

  const altDist = analytics.altitude_distribution || [];

  chartInstances.push(new Chart(document.getElementById("chart-altitude"), {
    type: "bar",
    data: {
      labels: altDist.map(a => a.band),
      datasets: [{
        data: altDist.map(a => a.count),
        backgroundColor: [
          "rgba(80,220,120,0.70)",
          "rgba(170,220,80,0.68)",
          "rgba(240,210,60,0.66)",
          "rgba(255,160,60,0.66)",
          "rgba(255,110,60,0.70)"
        ],
        borderColor: "transparent",
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} satellites` } }
      },
      scales: baseScales
    }
  }));
}