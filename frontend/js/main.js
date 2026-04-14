// main.js

function setStatus(msg) {
  document.getElementById("status-msg").textContent = msg;
}

function updateClock() {
  const now = new Date();
  document.getElementById("stat-time").textContent =
    "UTC: " + now.toUTCString().slice(17, 25);
}

async function init() {
  setStatus("Initialising globe...");
  initGlobe();

  setStatus("Loading data from server...");

  const [conjunctions, analytics, maneuvers] = await Promise.all([
    loadConjunctions(),
    fetchAnalytics(),
    fetchManeuvers(100)
  ]);

  updateConjunctionStats(conjunctions);
  await loadSatellites();
  markHighRiskSatellites(conjunctions);
  initSearch(conjunctions);
  renderAlerts(conjunctions);
  renderManeuvers(maneuvers);
  buildDashboard(conjunctions, analytics);

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