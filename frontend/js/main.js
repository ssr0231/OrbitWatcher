// main.js
// Entry point — initialises everything in the correct order.

function setStatus(msg) {
  document.getElementById("status-msg").textContent = msg;
}

function updateClock() {
  const now = new Date();
  const utc = now.toUTCString().slice(17, 25);
  document.getElementById("stat-time").textContent = `UTC: ${utc}`;
}

async function init() {
  setStatus("Initialising globe...");
  initGlobe();

  // Load all data in parallel
  setStatus("Loading satellite and conjunction data...");
  const [conjunctions, analytics, maneuvers] = await Promise.all([
    loadConjunctions(),
    fetchAnalytics(),
    fetchManeuvers(100)
  ]);

  // Load satellites (needs conjunctions first for color coding)
  await loadSatellites();

  // Render UI panels
  renderAlerts(conjunctions);
  renderManeuvers(maneuvers);

  // Build dashboard charts (only renders when dashboard is opened)
  buildDashboard(conjunctions, analytics);

  // Start animation loop
  function loop() {
    updateSatellitePositions();
    updateClock();
    requestAnimationFrame(loop);
  }

  renderLoop();
  loop();

  setStatus(`Live — ${satRecords.length.toLocaleString()} satellites tracked.`);
}

window.addEventListener("load", init);