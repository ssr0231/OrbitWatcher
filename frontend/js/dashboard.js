// dashboard.js

let chartsBuilt = false;

async function buildDashboard(conjunctions, analytics) {
  if (chartsBuilt) return;
  chartsBuilt = true;

  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: { color: "#8090b0", font: { size: 11 } }
      }
    },
    scales: {
      x: {
        ticks: { color: "#6070a0", font: { size: 10 } },
        grid:  { color: "rgba(100,120,255,0.08)" }
      },
      y: {
        ticks: { color: "#6070a0", font: { size: 10 } },
        grid:  { color: "rgba(100,120,255,0.08)" }
      }
    }
  };

  // ── Chart 1: Risk level distribution ──────────────────
  const riskDist   = analytics.risk_distribution || [];
  const riskLabels = riskDist.map(r => r.level.toUpperCase());
  const riskCounts = riskDist.map(r => r.count);
  const riskColors = riskLabels.map(l => {
    if (l === "CRITICAL") return "rgba(255,50,50,0.7)";
    if (l === "HIGH")     return "rgba(255,136,0,0.7)";
    if (l === "MEDIUM")   return "rgba(255,200,0,0.6)";
    return "rgba(100,150,255,0.5)";
  });

  new Chart(document.getElementById("chart-risk"), {
    type: "doughnut",
    data: {
      labels: riskLabels,
      datasets: [{
        data: riskCounts,
        backgroundColor: riskColors,
        borderColor: "rgba(8,8,30,0.8)",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: { color: "#8090b0", font: { size: 11 } }
        }
      }
    }
  });

  // ── Chart 2: Top 10 high-risk satellites ──────────────
  const topSats  = analytics.top_satellites || [];
  const satNames = topSats.map(s => s.name.replace("STARLINK-", "SL-"));
  const satApps  = topSats.map(s => s.appearances);

  if (satNames.length > 0) {
    new Chart(document.getElementById("chart-topsats"), {
      type: "bar",
      data: {
        labels: satNames,
        datasets: [{
          label: "Conjunctions",
          data: satApps,
          backgroundColor: "rgba(100,120,255,0.6)",
          borderColor:     "rgba(100,120,255,0.9)",
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        ...chartDefaults,
        plugins: { legend: { display: false } }
      }
    });
  } else {
    const ctx = document.getElementById("chart-topsats");
    ctx.parentElement.innerHTML += `
      <div style="color:#5060a0;font-size:11px;
      text-align:center;padding:40px 0;">
        No data available yet
      </div>`;
  }

  // ── Chart 3: Miss distance distribution ───────────────
  const buckets = [
    { label: "0-5 km",   min: 0,  max: 5  },
    { label: "5-10 km",  min: 5,  max: 10 },
    { label: "10-20 km", min: 10, max: 20 },
    { label: "20-35 km", min: 20, max: 35 },
    { label: "35-50 km", min: 35, max: 50 }
  ];

  const distCounts = buckets.map(b =>
    conjunctions.filter(c =>
      c.miss_distance_km >= b.min &&
      c.miss_distance_km < b.max
    ).length
  );

  new Chart(document.getElementById("chart-distance"), {
    type: "bar",
    data: {
      labels: buckets.map(b => b.label),
      datasets: [{
        label: "Conjunctions",
        data: distCounts,
        backgroundColor: [
          "rgba(255,50,50,0.7)",
          "rgba(255,100,50,0.7)",
          "rgba(255,180,0,0.6)",
          "rgba(100,200,100,0.6)",
          "rgba(100,150,255,0.6)"
        ],
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      ...chartDefaults,
      plugins: { legend: { display: false } }
    }
  });

  // ── Chart 4: Relative velocity distribution ───────────
  const velBuckets = [
    { label: "0-3",   min: 0,  max: 3  },
    { label: "3-6",   min: 3,  max: 6  },
    { label: "6-9",   min: 6,  max: 9  },
    { label: "9-12",  min: 9,  max: 12 },
    { label: "12-15", min: 12, max: 15 }
  ];

  const velCounts = velBuckets.map(b =>
    conjunctions.filter(c =>
      c.relative_velocity_km_s >= b.min &&
      c.relative_velocity_km_s < b.max
    ).length
  );

  new Chart(document.getElementById("chart-velocity"), {
    type: "line",
    data: {
      labels: velBuckets.map(b => b.label + " km/s"),
      datasets: [{
        label: "Conjunctions",
        data: velCounts,
        borderColor: "rgba(100,180,255,0.9)",
        backgroundColor: "rgba(100,180,255,0.1)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(100,180,255,0.9)",
        pointRadius: 4,
        fill: true,
        tension: 0.4
      }]
    },
    options: chartDefaults
  });
}