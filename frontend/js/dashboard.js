// dashboard.js
// Chart.js charts — resize loop fixed by constraining canvas height in CSS.

let chartsBuilt   = false;
let chartInstances = [];

async function buildDashboard(conjunctions, analytics) {
  if (chartsBuilt) return;
  chartsBuilt = true;

  // Destroy any existing charts first
  chartInstances.forEach(c => c.destroy());
  chartInstances = [];

  const gridColor = "rgba(107,138,255,0.07)";
  const tickColor = "#4a5880";
  const tickFont  = { size: 10, family: "'Inter', sans-serif" };

  const baseScales = {
    x: { ticks: { color: tickColor, font: tickFont }, grid: { color: gridColor } },
    y: { ticks: { color: tickColor, font: tickFont }, grid: { color: gridColor } }
  };

  // ── Chart 1: Risk distribution ────────────────────────
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

  // ── Chart 2: Top satellites by risk score ─────────────
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

  // ── Chart 3: Miss distance distribution ───────────────
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

  // ── Chart 4: Relative velocity distribution ───────────
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
}