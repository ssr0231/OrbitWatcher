// conjunctions.js

let conjunctionData = [];

async function loadConjunctions() {
  conjunctionData = await fetchConjunctions(200);
  return conjunctionData;
}

function updateConjunctionStats(conjunctions) {
  const critCount = conjunctions.filter(c => c.miss_distance_km < 10).length;
  document.getElementById("stat-conj").textContent =
    `Conjunctions: ${conjunctions.length}`;
  document.getElementById("stat-critical").textContent =
    `Critical: ${critCount}`;
}