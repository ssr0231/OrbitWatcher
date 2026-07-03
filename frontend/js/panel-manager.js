// panel-manager.js
// Centralized "only one major panel open" coordinator.

window.PanelManager = (() => {
  const closers = new Map();

  function register(panelName, closeFn) {
    if (!panelName || typeof closeFn !== "function") return;
    closers.set(panelName, closeFn);
  }

  function close(panelName) {
    const closeFn = closers.get(panelName);
    if (!closeFn) return;
    try { closeFn(); } catch (e) {}
  }

  function closeAllExcept(exceptPanelName) {
    closers.forEach((closeFn, panelName) => {
      if (panelName === exceptPanelName) return;
      try { closeFn(); } catch (e) {}
    });
  }

  function open(panelName, openFn) {
    closeAllExcept(panelName);
    if (typeof openFn === "function") openFn();
  }

  return { register, close, closeAllExcept, open };
})();

(function initPanelManager() {
  document.addEventListener("DOMContentLoaded", () => {
    // Filters floating panel
    PanelManager.register("filters", () => {
      const panel = document.getElementById("filter-panel");
      if (panel) panel.classList.add("hidden");
    });

    // Search result dropdown panel
    PanelManager.register("search", () => {
      const box = document.getElementById("search-results");
      if (!box) return;
      box.style.display = "none";
      box.innerHTML = "";
    });

    // Inspector floating panel (reuses existing cleanup behavior)
    PanelManager.register("inspector", () => {
      if (typeof closeInspector === "function") {
        closeInspector({ skipPanelManager: true });
        return;
      }
      const panel = document.getElementById("inspector");
      if (panel) panel.classList.add("hidden");
    });

    // Forecast major overlay view
    PanelManager.register("forecast", () => {
      const foreView = document.getElementById("forecast-view");
      if (foreView) foreView.classList.add("hidden");
      if (typeof setForecastVisible === "function") setForecastVisible(false);
    });
  });
})();
