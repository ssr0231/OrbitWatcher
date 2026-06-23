// router.js

function showView(view) {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`btn-${view}`).classList.add("active");

  const sidePanel = document.getElementById("side-panel");
  const searchBar = document.getElementById("search-bar");
  const dashView  = document.getElementById("dashboard-view");
  const manView   = document.getElementById("maneuvers-view");
  const foreView  = document.getElementById("forecast-view");

  dashView.classList.add("hidden");
  manView.classList.add("hidden");
  foreView.classList.add("hidden");

  // Always pause the countdown when leaving forecast view
  setForecastVisible(false);

  if (view === "globe") {
    sidePanel.classList.remove("hidden");
    searchBar.classList.remove("hidden");
  } else if (view === "dashboard") {
    sidePanel.classList.add("hidden");
    searchBar.classList.add("hidden");
    dashView.classList.remove("hidden");
  } else if (view === "maneuvers") {
    sidePanel.classList.add("hidden");
    searchBar.classList.add("hidden");
    manView.classList.remove("hidden");
  } else if (view === "forecast") {
    sidePanel.classList.add("hidden");
    searchBar.classList.add("hidden");
    foreView.classList.remove("hidden");
    setForecastVisible(true);   // start countdown only now
  }
}