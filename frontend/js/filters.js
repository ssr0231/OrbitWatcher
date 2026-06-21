// filters.js
//
// Controls which satellites are visible on the globe, based on risk
// status, altitude band, and orbit type.
//
// Filtering does NOT remove points from the satellite BufferGeometry
// (that would require an expensive geometry rebuild every time a
// filter changes). Instead, every frame in updateSatellitePositions()
// (satellites.js), each filtered-out satellite is simply positioned
// beyond the camera's far clipping plane (see globe.js — far = 1000,
// while real satellite positions are scaled to ~1.0 units), so it
// renders as invisible without ever changing the point count or
// triggering a geometry resize.

const ALL_ALTITUDE_BANDS = ["gt560", "530-560", "500-530", "470-500", "lt470"];
const ALL_ORBIT_TYPES    = ["LEO", "MEO", "GEO"];

let filterState = {
  risk: "all",  // "all" | "highRiskOnly" | "hideHighRisk"
  altitudeBands: new Set(ALL_ALTITUDE_BANDS),
  orbitTypes: new Set(ALL_ORBIT_TYPES)
};

function initFilters() {
  document.querySelectorAll('input[name="filter-risk"]').forEach(el => {
    el.addEventListener("change", () => {
      filterState.risk = document.querySelector('input[name="filter-risk"]:checked').value;
    });
  });

  document.querySelectorAll(".filter-altitude").forEach(el => {
    el.addEventListener("change", () => {
      if (el.checked) filterState.altitudeBands.add(el.value);
      else filterState.altitudeBands.delete(el.value);
    });
  });

  document.querySelectorAll(".filter-orbit").forEach(el => {
    el.addEventListener("change", () => {
      if (el.checked) filterState.orbitTypes.add(el.value);
      else filterState.orbitTypes.delete(el.value);
    });
  });
}

function toggleFilterPanel() {
  document.getElementById("filter-panel").classList.toggle("hidden");
}

function resetFilters() {
  filterState.risk = "all";
  filterState.altitudeBands = new Set(ALL_ALTITUDE_BANDS);
  filterState.orbitTypes    = new Set(ALL_ORBIT_TYPES);

  const allRadio = document.querySelector('input[name="filter-risk"][value="all"]');
  if (allRadio) allRadio.checked = true;
  document.querySelectorAll(".filter-altitude").forEach(el => el.checked = true);
  document.querySelectorAll(".filter-orbit").forEach(el => el.checked = true);
}

// Classifies altitude into the same 5 bands used for satellite color
// coding (satellites.js) and the analytics altitude chart (backend/
// routes/analytics.py) — kept as a single shared function so "which
// band is this satellite in" always means exactly the same thing
// everywhere in the app, with no risk of the thresholds drifting out
// of sync between features.
function altitudeBandKey(altKm) {
  if (altKm > 560) return "gt560";
  if (altKm > 530) return "530-560";
  if (altKm > 500) return "500-530";
  if (altKm > 470) return "470-500";
  return "lt470";
}

// Matches the same LEO/MEO/GEO thresholds used in inspector.js, so a
// satellite's classification never disagrees between the inspector
// panel and the filter panel.
function orbitTypeFor(altKm) {
  return altKm < 2000 ? "LEO" : altKm < 35786 ? "MEO" : "GEO";
}

// Single entry point called for every satellite, every frame, from
// updateSatellitePositions() in satellites.js.
function passesFilters(altKm, isHighRisk) {
  if (filterState.risk === "highRiskOnly" && !isHighRisk) return false;
  if (filterState.risk === "hideHighRisk" && isHighRisk) return false;
  if (!filterState.altitudeBands.has(altitudeBandKey(altKm))) return false;
  if (!filterState.orbitTypes.has(orbitTypeFor(altKm))) return false;
  return true;
}

function updateFilterCount(visible, total) {
  const el = document.getElementById("filter-count");
  if (el) el.textContent = `${visible.toLocaleString()} / ${total.toLocaleString()} shown`;
}