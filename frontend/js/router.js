// router.js

function showView(view) {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  const activeBtn = document.getElementById(`btn-${view}`);
  if (activeBtn) activeBtn.classList.add("active");

  const sidePanel = document.getElementById("side-panel");
  const searchBar = document.getElementById("search-bar");
  const dashView  = document.getElementById("dashboard-view");
  const manView   = document.getElementById("maneuvers-view");
  const foreView  = document.getElementById("forecast-view");

  // NEW
  const bottomBar = document.getElementById("bottombar");

  function showGlobeUI(show) {
    if (bottomBar) bottomBar.classList.toggle("hidden-ui", !show);
  }

  if (dashView) dashView.classList.add("hidden");
  if (manView)  manView.classList.add("hidden");
  if (foreView) foreView.classList.add("hidden");

  if (typeof setForecastVisible === "function")
    setForecastVisible(false);

  if (view === "globe") {

    showGlobeUI(true);

    if (sidePanel) sidePanel.classList.remove("hidden");
    if (searchBar) searchBar.classList.remove("hidden");

  }

  else if (view === "dashboard") {

    showGlobeUI(false);

    if (sidePanel) sidePanel.classList.add("hidden");
    if (searchBar) searchBar.classList.add("hidden");
    if (dashView) dashView.classList.remove("hidden");

  }

  else if (view === "maneuvers") {

    showGlobeUI(false);

    if (sidePanel) sidePanel.classList.add("hidden");
    if (searchBar) searchBar.classList.add("hidden");
    if (manView) manView.classList.remove("hidden");

  }

  else if (view === "forecast") {

    showGlobeUI(false);

    if (window.PanelManager)
      PanelManager.closeAllExcept("forecast");

    if (sidePanel) sidePanel.classList.add("hidden");
    if (searchBar) searchBar.classList.add("hidden");
    if (foreView) foreView.classList.remove("hidden");

    if (typeof setForecastVisible === "function")
      setForecastVisible(true);
  }
}