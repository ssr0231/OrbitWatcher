// inspector.js
// Satellite inspector panel — shows on click or search selection.

function openInspector(name, rec, conjunctions) {
  const panel = document.getElementById("inspector");
  const title = document.getElementById("inspector-name");
  const body  = document.getElementById("inspector-body");

  title.textContent = name;

  // Get live position and velocity
  const now = new Date();
  const pv  = satellite.propagate(rec.satrec, now);

  let posHTML = "";
  let altHTML = "";

  if (pv && pv.position) {
    const p   = pv.position;
    const v   = pv.velocity;
    const alt = (Math.sqrt(p.x**2 + p.y**2 + p.z**2) - 6371).toFixed(1);
    const spd = v ? Math.sqrt(v.x**2 + v.y**2 + v.z**2).toFixed(3) : "—";

    posHTML = `
      <div>Position: <b>${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)} km</b></div>
      <div>Altitude: <b>${alt} km</b></div>
      <div>Speed: <b>${spd} km/s</b></div>
    `;
  }

  const conjHTML = conjunctions.length > 0
    ? conjunctions.slice(0, 3).map(c => {
        const other = c.sat1_name === name ? c.sat2_name : c.sat1_name;
        return `<div style="margin-top:6px;padding:6px 8px;background:rgba(255,50,50,0.08);
                border-radius:5px;border-left:2px solid #ff4040;">
          <span style="color:#ff6666;font-weight:600">${other}</span>
          <span style="color:#5a6a90"> — ${c.miss_distance_km.toFixed(2)} km</span>
        </div>`;
      }).join("")
    : `<div style="color:#404a70;margin-top:4px">No active conjunctions</div>`;

  body.innerHTML = `
    ${posHTML}
    <div style="margin-top:10px;font-size:10px;letter-spacing:1px;
    text-transform:uppercase;color:#404a70;margin-bottom:4px">
      Conjunctions
    </div>
    ${conjHTML}
  `;

  panel.classList.remove("hidden");
}

function closeInspector() {
  document.getElementById("inspector").classList.add("hidden");
  document.getElementById("sat-search").value = "";
}