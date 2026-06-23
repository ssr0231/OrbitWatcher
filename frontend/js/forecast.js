// forecast.js

let isForecastVisible = false;  // controlled by router.js via setForecastVisible()
let _forecastCountdownInterval = null;

function setForecastVisible(visible) {
  isForecastVisible = visible;

  if (visible && !_forecastCountdownInterval) {
    _forecastCountdownInterval = setInterval(_tickCountdowns, 1000);
  } else if (!visible && _forecastCountdownInterval) {
    clearInterval(_forecastCountdownInterval);
    _forecastCountdownInterval = null;
  }
}

function _tickCountdowns() {
  document.querySelectorAll(".forecast-countdown[data-seconds]").forEach(el => {
    let sec = parseFloat(el.dataset.seconds) - 1;
    if (sec < 0) sec = 0;
    el.dataset.seconds = sec;
    el.textContent = formatCountdown(sec);

    const item = el.closest(".forecast-item");
    if (item) {
      const newUrg = forecastUrgencyClass(sec);
      item.className = `forecast-item ${newUrg}`;
      const badge = item.querySelector(".forecast-urgency-badge");
      if (badge) {
        badge.className = `forecast-urgency-badge ${newUrg}-badge`;
        badge.textContent = forecastUrgencyLabel(sec);
      }
    }
  });
}

function formatCountdown(seconds) {
  const s   = Math.max(0, Math.floor(seconds));
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function forecastUrgencyClass(seconds) {
  if (seconds < 3600)  return "forecast-critical";
  if (seconds < 21600) return "forecast-high";
  if (seconds < 43200) return "forecast-medium";
  return "forecast-low";
}

function forecastUrgencyLabel(seconds) {
  if (seconds < 3600)  return "IMMINENT";
  if (seconds < 21600) return "< 6 HRS";
  if (seconds < 43200) return "< 12 HRS";
  return "< 24 HRS";
}

function renderForecast(json) {
  const list    = document.getElementById("forecast-list");
  const meta    = document.getElementById("forecast-meta");
  const counter = document.getElementById("forecast-count");
  if (!list) return;

  if (json.forecast_generated_at) {
    try {
      const dt = new Date(json.forecast_generated_at);
      meta.textContent = `Forecast generated: ${dt.toUTCString()}`;
    } catch (e) { meta.textContent = ""; }
  }

  if (counter) counter.textContent = `${json.count || 0} events`;

  if (!json.data || !json.data.length) {
    list.innerHTML = `
      <div class="forecast-empty">
        No conjunction events predicted in the next 24 hours.<br>
        <span style="font-size:10px;color:#404a70">
          Forecast data updates every 6 hours with the main pipeline.
        </span>
      </div>`;
    return;
  }

  list.innerHTML = json.data.map(ev => {
    const urg   = forecastUrgencyClass(ev.seconds_from_now);
    const label = forecastUrgencyLabel(ev.seconds_from_now);

    let approachStr = "";
    try {
      const dt = new Date(ev.approach_time);
      approachStr = dt.toUTCString().slice(0, 25) + " UTC";
    } catch (e) {}

    return `
      <div class="forecast-item ${urg}">
        <div class="forecast-header">
          <span class="forecast-names">${ev.sat1_name} ↔ ${ev.sat2_name}</span>
          <span class="forecast-urgency-badge ${urg}-badge">${label}</span>
        </div>
        <div class="forecast-countdown" data-seconds="${ev.seconds_from_now}">
          ${formatCountdown(ev.seconds_from_now)}
        </div>
        <div class="forecast-approach-time">${approachStr}</div>
        <div class="forecast-details">
          <span>Miss distance: <strong>${ev.predicted_miss_km.toFixed(1)} km</strong></span>
          <span>Rel. velocity: <strong>${ev.relative_velocity_km_s.toFixed(1)} km/s</strong></span>
          <span>Risk score: <strong>${ev.risk_score.toFixed(6)}</strong></span>
        </div>
      </div>`;
  }).join("");
}