// router.js
// Controls which view is visible.
// Globe canvas stays alive at all times — only UI panels swap.

function showView(view) {
  // Update nav buttons
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`btn-${view}`).classList.add("active");

  // Show/hide panels
  const sidePanel = document.getElementById("side-panel");
  const dashView  = document.getElementById("dashboard-view");
  const manView   = document.getElementById("maneuvers-view");

  // Hide all views first
  dashView.classList.add("hidden");
  manView.classList.add("hidden");
  sidePanel.classList.remove("hidden");

  if (view === "globe") {
    sidePanel.classList.remove("hidden");
  } else if (view === "dashboard") {
    sidePanel.classList.add("hidden");
    dashView.classList.remove("hidden");
  } else if (view === "maneuvers") {
    sidePanel.classList.add("hidden");
    manView.classList.remove("hidden");
  }
}