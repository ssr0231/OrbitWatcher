// export.js

window._exportData = [];

function setExportData(maneuvers) {
  window._exportData = maneuvers || [];
}

function exportCSV() {
  const data = window._exportData;
  if (!data.length) { alert("No data to export yet."); return; }

  const headers = [
    "Satellite 1","Satellite 2","Miss Distance (km)",
    "Relative Velocity (km/s)","Risk Score","Delta-V (m/s)",
    "Risk Level","Recommendation"
  ];

  const rows = data.map(m => {
    const lvl = m.risk_score > 0.00007 ? "critical" : m.risk_score > 0.00003 ? "high" : "medium";
    return [
      m.sat1_name, m.sat2_name,
      m.miss_distance_km != null ? m.miss_distance_km.toFixed(3) : "",
      m.relative_velocity_km_s != null ? m.relative_velocity_km_s.toFixed(3) : "",
      m.risk_score.toExponential(4),
      m.delta_v_m_s.toFixed(4), lvl,
      '"' + (m.recommendation_text || "").replace(/"/g, '""') + '"'
    ].join(",");
  });

  downloadFile(
    `OrbitWatch_${new Date().toISOString().slice(0,10)}.csv`,
    [headers.join(","), ...rows].join("\n"),
    "text/csv"
  );
}

function exportJSON() {
  const data = window._exportData;
  if (!data.length) { alert("No data to export yet."); return; }

  const payload = {
    exported_at: new Date().toISOString(),
    total: data.length,
    maneuvers: data.map(m => ({
      satellite_1:            m.sat1_name,
      satellite_2:            m.sat2_name,
      miss_distance_km:       m.miss_distance_km ?? null,
      relative_velocity_km_s: m.relative_velocity_km_s ?? null,
      risk_score:             m.risk_score,
      risk_level:             m.risk_score > 0.00007 ? "critical" : m.risk_score > 0.00003 ? "high" : "medium",
      delta_v_m_s:            m.delta_v_m_s,
      recommendation:         m.recommendation_text
    }))
  };

  downloadFile(
    `OrbitWatch_${new Date().toISOString().slice(0,10)}.json`,
    JSON.stringify(payload, null, 2),
    "application/json"
  );
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}