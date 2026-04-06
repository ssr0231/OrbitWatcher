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

  // Load data
  await loadSatellites();
  const conjunctions = await loadConjunctions();
  renderAlerts(conjunctions);

  // Start render + propagation loop
  setStatus("Propagating orbits...");

  function loop() {
    updateSatellitePositions();
    updateClock();
    requestAnimationFrame(loop);
  }

  renderLoop();
  loop();

  setStatus(`Live — ${satRecords.length.toLocaleString()} satellites tracked.`);
}

// Start everything when page loads
window.addEventListener("load", init);