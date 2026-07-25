// api.js

const API_BASE = window.location.origin + "/api/v1";

// Wraps fetch() with an AbortController timeout.
// Without this, a slow or unresponsive backend causes fetch() to hang
// for several minutes (browser default), leaving the user on an
// indefinite loading screen with no feedback.
//
// timeoutMs: milliseconds before the request is aborted.
//   - TLE endpoint returns ~3 MB of text — allow 15 seconds.
//   - All other endpoints return small JSON — 10 seconds is generous.
//
// Throws on network error, timeout, or non-2xx status.
async function _fetchWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return res;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s: ${url}`);
    }
    throw e;
  }
}

// Returns the TLE array on success, or null on any network/API failure.
//
// Returning null (not []) on failure is intentional — it lets callers
// distinguish between two different situations:
//   []   — the API responded successfully but returned zero satellites
//           (unusual but valid — e.g., CelesTrak feed is empty)
//   null — the API call itself failed (network error, timeout, 503)
//           in which case we have no information about the current
//           satellite population and must not imply a live connection.
//
// All other fetch functions return [] on failure because empty data
// is an acceptable degraded state for conjunctions/analytics/forecast.
// TLE data is different — the entire globe visualisation depends on it.
async function fetchTLEs() {
  try {
    const res  = await _fetchWithTimeout(`${API_BASE}/tles`, 15000);
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    console.error("fetchTLEs failed:", e.message);
    return null;  // null = fetch failed, not an empty dataset
  }
}

async function fetchConjunctions(limit = 200) {
  try {
    const res  = await _fetchWithTimeout(`${API_BASE}/conjunctions?limit=${limit}`);
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    console.error("fetchConjunctions failed:", e.message);
    return [];
  }
}

async function fetchAnalytics() {
  try {
    const res  = await _fetchWithTimeout(`${API_BASE}/analytics`);
    const json = await res.json();
    return json.data || {};
  } catch (e) {
    console.error("fetchAnalytics failed:", e.message);
    return {};
  }
}

async function fetchManeuvers(limit = 100) {
  try {
    const res  = await _fetchWithTimeout(`${API_BASE}/maneuvers?limit=${limit}`);
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    console.error("fetchManeuvers failed:", e.message);
    return [];
  }
}

async function fetchForecast() {
  try {
    const res = await _fetchWithTimeout(`${API_BASE}/forecast`);
    return await res.json();
  } catch (e) {
    console.error("fetchForecast failed:", e.message);
    return { data: [], count: 0 };
  }
}