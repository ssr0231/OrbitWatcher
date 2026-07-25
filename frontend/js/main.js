// main.js

function setStatus(msg, isError = false) {
  const el = document.getElementById("status-msg");
  if (!el) return;
  el.textContent = msg;
  // Use the design system's critical color for error states so the
  // message is visually distinct from normal status text.
  el.style.color = isError ? "var(--risk-critical, #ff5252)" : "";
}

function updateClock() {
  const now = getSimTime();
  const el  = document.getElementById("stat-time");
  if (el) el.textContent = "UTC: " + now.toUTCString().slice(17, 25);
}

async function init() {
  try {
    setStatus("Initialising globe...");
    initGlobe();

    setStatus("Loading data from server...");

    const [conjunctions, analytics, maneuvers, forecastJson] = await Promise.all([
      loadConjunctions(),
      fetchAnalytics(),
      fetchManeuvers(100),
      fetchForecast()
    ]);

    updateConjunctionStats(conjunctions);
    await loadSatellites();
    markHighRiskSatellites(conjunctions);
    initSearch(conjunctions);
    initFilters();
    renderAlerts(conjunctions);
    renderManeuvers(maneuvers);
    buildDashboard(conjunctions, analytics);
    renderForecast(forecastJson);

    function loop() {
      updateSatellitePositions();
      updateHaloPositions();
      updateClock();
      requestAnimationFrame(loop);
    }

    renderLoop();
    loop();

    // Only overwrite the status with "Live — N satellites tracked" if
    // satellites actually loaded. If satRecords is empty, loadSatellites()
    // has already set an appropriate message:
    //   - "⚠ Satellite data unavailable — retry later." (fetch failed)
    //   - "Warning: no TLE data received."              (API returned [])
    // Overwriting either of those with "Live — 0 satellites tracked."
    // would falsely imply a successful live connection.
    if (satRecords.length > 0) {
      setStatus(`Live — ${satRecords.length.toLocaleString()} satellites tracked.`);
    }

  } catch (e) {
    console.error("OrbitWatch failed to initialise:", e);
    setStatus("⚠ Failed to load. Please check your connection and refresh the page.", true);
  }
}

window.addEventListener("load", init);