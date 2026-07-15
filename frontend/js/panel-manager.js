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

    PanelManager.register("filters", () => {
      const panel = document.getElementById("filter-panel");
      if (panel) panel.classList.add("hidden");
    });

    PanelManager.register("search", () => {
      const box = document.getElementById("search-results");
      if (!box) return;
      box.style.display = "none";
      box.innerHTML = "";
    });

    // preserveSearch: true is the fix.
    // Without it: PanelManager.open("search") → closeAllExcept("search")
    // → this callback → closeInspector() → sat-search.value = ""
    // → input wiped after every keystroke.
    PanelManager.register("inspector", () => {
      if (typeof closeInspector === "function") {
        closeInspector({ preserveSearch: true });
        return;
      }
      const panel = document.getElementById("inspector");
      if (panel) panel.classList.add("hidden");
    });

    PanelManager.register("forecast", () => {
      const foreView = document.getElementById("forecast-view");
      if (foreView) foreView.classList.add("hidden");
      if (typeof setForecastVisible === "function") setForecastVisible(false);
    });

  });
})();