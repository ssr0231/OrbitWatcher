// conjunctions.js
// Loads conjunction data and updates the risk display.

let conjunctionData = [];

async function loadConjunctions() {
  conjunctionData = await fetchConjunctions(200);
  markHighRiskSatellites(conjunctionData);

  const critCount = conjunctionData.filter(
    c => c.miss_distance_km < 10
  ).length;

  document.getElementById("stat-conj").textContent =
    `Conjunctions: ${conjunctionData.length}`;
  document.getElementById("stat-critical").textContent =
    `Critical: ${critCount}`;

  return conjunctionData;
}