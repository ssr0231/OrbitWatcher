// api.js
// Single source of truth for all backend calls.
// Every other JS file imports from here.

const API_BASE = "http://localhost:8000/api/v1";

async function fetchTLEs() {
  const res = await fetch(`${API_BASE}/tles`);
  const json = await res.json();
  return json.data;
}

async function fetchConjunctions(limit = 100) {
  const res = await fetch(`${API_BASE}/conjunctions?limit=${limit}`);
  const json = await res.json();
  return json.data;
}

async function fetchAnalytics() {
  const res = await fetch(`${API_BASE}/analytics`);
  const json = await res.json();
  return json.data;
}

async function fetchManeuvers(limit = 50) {
  const res = await fetch(`${API_BASE}/maneuvers?limit=${limit}`);
  const json = await res.json();
  return json.data;
}