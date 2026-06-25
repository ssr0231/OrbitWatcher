// router.js

function showView(view) {
  // Remove active from all nav buttons
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  // Defensive: only set active if the button exists
  const activeBtn = document.getElementById(`btn-${view}`);
  if (activeBtn) activeBtn.classList.add("active");

  // Grab all view containers defensively
  const sidePanel = document.getElementById("side-panel");
  const searchBar = document.getElementById("search-bar");
  const dashView  = document.getElementById("dashboard-view");
  const manView   = document.getElementById("maneuvers-view");
  const foreView  = document.getElementById("forecast-view");

  // Hide all overlay views first
  if (dashView) dashView.classList.add("hidden");
  if (manView)  manView.classList.add("hidden");
  if (foreView) foreView.classList.add("hidden");

  // Pause the forecast countdown whenever we leave that tab
  if (typeof setForecastVisible === "function") setForecastVisible(false);

  if (view === "globe") {
    if (sidePanel) sidePanel.classList.remove("hidden");
    if (searchBar) searchBar.classList.remove("hidden");

  } else if (view === "dashboard") {
    if (sidePanel) sidePanel.classList.add("hidden");
    if (searchBar) searchBar.classList.add("hidden");
    if (dashView)  dashView.classList.remove("hidden");

  } else if (view === "maneuvers") {
    if (sidePanel) sidePanel.classList.add("hidden");
    if (searchBar) searchBar.classList.add("hidden");
    if (manView)   manView.classList.remove("hidden");

  } else if (view === "forecast") {
    if (sidePanel) sidePanel.classList.add("hidden");
    if (searchBar) searchBar.classList.add("hidden");
    if (foreView)  foreView.classList.remove("hidden");
    if (typeof setForecastVisible === "function") setForecastVisible(true);
  }
}