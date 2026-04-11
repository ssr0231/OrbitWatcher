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

  // Step 1 — fetch all data in parallel
  const [conjunctions, analytics, maneuvers] = await Promise.all([
    loadConjunctions(),
    fetchAnalytics(),
    fetchManeuvers(100)
  ]);

  // Step 2 — update stats bar
  updateConjunctionStats(conjunctions);

  // Step 3 — load satellites (populates satRecords)
  await loadSatellites();

  // Step 4 — NOW mark risk colors + draw trails (satRecords ready)
  markHighRiskSatellites(conjunctions);

  // Step 5 — init search (needs satRecords)
  initSearch(conjunctions);

  // Step 6 — render UI panels
  renderAlerts(conjunctions);
  renderManeuvers(maneuvers);
  buildDashboard(conjunctions, analytics);

  // Step 7 — start animation
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