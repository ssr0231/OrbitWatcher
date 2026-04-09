// export.js
// Export conjunction + maneuver data as CSV or JSON.

let exportData = [];

function setExportData(maneuvers) {
  exportData = maneuvers;
}

function exportCSV() {
  if (!exportData.length) {
    alert("No maneuver data to export yet.");
    return;
  }

  const headers = [
    "Satellite 1",
    "Satellite 2",
    "Miss Distance (km)",
    "Relative Velocity (km/s)",
    "Risk Score",
    "Delta-V (m/s)",
    "Risk Level",
    "Recommendation"
  ];

  const rows = exportData.map(m => {
    let level = "medium";
    if (m.risk_score > 0.00007)      level = "critical";
    else if (m.risk_score > 0.00003) level = "high";

    return [
      m.sat1_name,
      m.sat2_name,
      m.miss_distance_km ? m.miss_distance_km.toFixed(3) : "",
      m.relative_velocity_km_s ? m.relative_velocity_km_s.toFixed(3) : "",
      m.risk_score.toExponential(4),
      m.delta_v_m_s.toFixed(4),
      level,
      `"${m.recommendation_text.replace(/"/g, '""')}"`
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const now = new Date().toISOString().slice(0, 10);
  downloadFile(`OrbitWatch_Maneuvers_${now}.csv`, csv, "text/csv");
}

function exportJSON() {
  if (!exportData.length) {
    alert("No maneuver data to export yet.");
    return;
  }

  const now      = new Date().toISOString();
  const payload  = {
    exported_at:  now,
    total_count:  exportData.length,
    maneuvers:    exportData.map(m => {
      let level = "medium";
      if (m.risk_score > 0.00007)      level = "critical";
      else if (m.risk_score > 0.00003) level = "high";
      return {
        satellite_1:            m.sat1_name,
        satellite_2:            m.sat2_name,
        miss_distance_km:       m.miss_distance_km,
        relative_velocity_km_s: m.relative_velocity_km_s,
        risk_score:             m.risk_score,
        risk_level:             level,
        delta_v_m_s:            m.delta_v_m_s,
        recommendation:         m.recommendation_text
      };
    })
  };

  downloadFile(
    `OrbitWatch_Maneuvers_${now.slice(0,10)}.json`,
    JSON.stringify(payload, null, 2),
    "application/json"
  );
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}