// api.js
const API_BASE = window.location.origin + "/api/v1";

async function fetchTLEs() {
  try {
    const res = await fetch(`${API_BASE}/tles`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data || [];
  } catch (e) { console.error("fetchTLEs failed:", e); return []; }
}

async function fetchConjunctions(limit = 200) {
  try {
    const res = await fetch(`${API_BASE}/conjunctions?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data || [];
  } catch (e) { console.error("fetchConjunctions failed:", e); return []; }
}

async function fetchAnalytics() {
  try {
    const res = await fetch(`${API_BASE}/analytics`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data || {};
  } catch (e) { console.error("fetchAnalytics failed:", e); return {}; }
}

async function fetchManeuvers(limit = 100) {
  try {
    const res = await fetch(`${API_BASE}/maneuvers?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data || [];
  } catch (e) { console.error("fetchManeuvers failed:", e); return []; }
}