// globe.js

const EARTH_RADIUS = 1.0;
const SCALE_FACTOR = 1.0 / 6371.0;

let scene, camera, renderer;
let isDragging = false;
let previousMouse = { x: 0, y: 0 };
let earthGroup;
let autoRotate = true;

// ── Selection trail state ──────────────────────────────
let _primTrail  = null, _primMarker  = null, _primRec  = null;
let _secTrail   = null, _secMarker   = null, _secRec   = null;

// ── Time simulation state ──────────────────────────────
// simTimeMs is the single source of truth for "what time is it right
// now, for the purposes of satellite propagation". When not paused,
// it advances at the same rate as real time (1x speed), ticked once
// per animation frame in renderLoop() below. Pausing freezes it;
// rewind/forward shift it directly; jumping to realtime resets it to
// the actual current wall-clock time. Every place in the codebase
// that used to call `new Date()` to propagate a satellite's position
// now calls getSimTime() instead, so the whole app — globe, trails,
// the UTC clock — all consistently reflect simulated time together.
let simTimeMs       = Date.now();
let simPaused        = false;
let _lastFrameRealMs = Date.now();

function tickSimTime() {
  const nowReal = Date.now();
  const dtReal  = nowReal - _lastFrameRealMs;
  _lastFrameRealMs = nowReal;
  if (!simPaused) simTimeMs += dtReal;
}

function getSimTime() {
  return new Date(simTimeMs);
}

function timeRewind(minutes) {
  simTimeMs -= minutes * 60000;
  _updateTimeControlsUI();
}

function timeForward(minutes) {
  simTimeMs += minutes * 60000;
  _updateTimeControlsUI();
}

function timeTogglePause() {
  simPaused = !simPaused;
  _updateTimeControlsUI();
}

function timeRealtime() {
  simTimeMs = Date.now();
  simPaused = false;
  _updateTimeControlsUI();
}

function _updateTimeControlsUI() {
  const pauseBtn = document.getElementById("btn-time-pause");
  if (pauseBtn) pauseBtn.textContent = simPaused ? "▶ Resume" : "⏸ Pause";

  // Visually distinguish "live" from "simulated/offset" time so it's
  // never ambiguous whether the globe is showing the real present.
  const isLive = !simPaused && Math.abs(simTimeMs - Date.now()) < 2000;
  const clockEl = document.getElementById("stat-time");
  if (clockEl) clockEl.classList.toggle("sim-active", !isLive);
}

function initGlobe() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    42, window.innerWidth / window.innerHeight, 0.001, 1000
  );
  camera.position.set(0, 0, 2.8);

  const canvas = document.getElementById("globe-canvas");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  earthGroup = new THREE.Group();
  scene.add(earthGroup);

  const loader   = new THREE.TextureLoader();
  const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 80, 80);

  // Dark Earth — night side texture as primary, much darker look
  loader.load(
    "https://unpkg.com/three-globe/example/img/earth-night.jpg",
    tex => {
      earthGroup.add(new THREE.Mesh(earthGeo,
        new THREE.MeshPhongMaterial({
          map:       tex,
          specular:  new THREE.Color(0x111133),
          shininess: 5,
          emissive:  new THREE.Color(0x050510),
          emissiveIntensity: 0.3
        })
      ));
    },
    undefined,
    () => {
      // Fallback: dark blue sphere
      earthGroup.add(new THREE.Mesh(earthGeo,
        new THREE.MeshPhongMaterial({
          color: 0x0a1428, emissive: 0x030810, shininess: 5
        })
      ));
    }
  );

  // Faint country borders overlay using topology texture
  loader.load(
    "https://unpkg.com/three-globe/example/img/earth-topology.png",
    tex => {
      earthGroup.add(new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS + 0.001, 80, 80),
        new THREE.MeshBasicMaterial({
          map: tex, transparent: true, opacity: 0.06,
          blending: THREE.AdditiveBlending
        })
      ));
    }
  );

  // Thin grid overlay (latitude/longitude lines)
  const gridGeo = new THREE.SphereGeometry(EARTH_RADIUS + 0.002, 36, 18);
  const gridMat = new THREE.MeshBasicMaterial({
    color:       0x1a2a5a,
    wireframe:   true,
    transparent: true,
    opacity:     0.08
  });
  earthGroup.add(new THREE.Mesh(gridGeo, gridMat));

  // Outer atmosphere glow
  earthGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS + 0.04, 64, 64),
    new THREE.MeshPhongMaterial({
      color: 0x1a3a99, transparent: true, opacity: 0.08, side: THREE.BackSide
    })
  ));

  // Dim ambient — space is dark
  scene.add(new THREE.AmbientLight(0x112244, 0.8));

  // Single sunlight source from one side
  const sun = new THREE.DirectionalLight(0x4466aa, 1.2);
  sun.position.set(5, 2, 3);
  scene.add(sun);

  buildStarfield();
  initMouseControls(canvas);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function buildStarfield() {
  [10000, 2000].forEach((count, layer) => {
    const pos    = new Float32Array(count * 3);
    const spread = layer === 0 ? 700 : 180;
    for (let i = 0; i < count * 3; i++) {
      pos[i] = (Math.random() - 0.5) * spread;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color:       layer === 0 ? 0xffffff : 0xaabbff,
      size:        layer === 0 ? 0.22 : 0.38,
      transparent: true,
      opacity:     layer === 0 ? 0.6 : 0.8
    })));
  });
}

function initMouseControls(canvas) {
  canvas.addEventListener("mousedown", e => {
    isDragging    = true;
    previousMouse = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("mousemove", e => {
    if (!isDragging) return;
    earthGroup.rotation.y += (e.clientX - previousMouse.x) * 0.004;
    earthGroup.rotation.x += (e.clientY - previousMouse.y) * 0.004;
    earthGroup.rotation.x  = Math.max(
      -Math.PI / 2.2,
      Math.min(Math.PI / 2.2, earthGroup.rotation.x)
    );
    previousMouse = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("mouseup",    () => isDragging = false);
  canvas.addEventListener("mouseleave", () => isDragging = false);
  canvas.addEventListener("wheel", e => {
    camera.position.z += e.deltaY * 0.0008;
    camera.position.z  = Math.max(1.3, Math.min(5.5, camera.position.z));
    e.preventDefault();
  }, { passive: false });
}

// ── Internal helpers ───────────────────────────────────

function _orbitPoints(rec, steps) {
  const pts = [];
  const now = getSimTime();
  for (let i = 0; i <= steps; i++) {
    const t = new Date(now.getTime() + (i / steps) * 96 * 60000);
    try {
      const pv = satellite.propagate(rec.satrec, t);
      if (pv && pv.position) {
        const p = pv.position;
        pts.push(new THREE.Vector3(
           p.x * SCALE_FACTOR,
           p.z * SCALE_FACTOR,
          -p.y * SCALE_FACTOR
        ));
      }
    } catch(e) {}
  }
  return pts;
}

function _makeMarker(rec, color) {
  try {
    const pv = satellite.propagate(rec.satrec, getSimTime());
    if (!pv || !pv.position) return null;
    const p = pv.position;
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 16, 16),
      new THREE.MeshBasicMaterial({ color })
    );
    m.position.set(
       p.x * SCALE_FACTOR,
       p.z * SCALE_FACTOR,
      -p.y * SCALE_FACTOR
    );
    return m;
  } catch(e) { return null; }
}

function _drop(obj) {
  if (!obj) return;
  earthGroup.remove(obj);
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) obj.material.dispose();
}

function _moveMarker(marker, rec) {
  if (!marker || !rec) return;
  try {
    const pv = satellite.propagate(rec.satrec, getSimTime());
    if (pv && pv.position) {
      const p = pv.position;
      marker.position.set(
         p.x * SCALE_FACTOR,
         p.z * SCALE_FACTOR,
        -p.y * SCALE_FACTOR
      );
    }
  } catch(e) {}
}

// ── Public trail API ───────────────────────────────────

function drawSelectionTrail(rec) {
  clearSelectionTrail();
  if (!rec || !rec.satrec) return;
  _primRec = rec;

  const pts = _orbitPoints(rec, 120);
  if (pts.length < 2) return;

  _primTrail = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 1.0 })
  );
  earthGroup.add(_primTrail);

  _primMarker = _makeMarker(rec, 0x00ffaa);
  if (_primMarker) earthGroup.add(_primMarker);
}

function drawSecondaryTrail(rec) {
  _drop(_secTrail);  _secTrail  = null;
  _drop(_secMarker); _secMarker = null;
  if (!rec || !rec.satrec) return;
  _secRec = rec;

  const pts = _orbitPoints(rec, 120);
  if (pts.length < 2) return;

  _secTrail = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xff4444, transparent: true, opacity: 1.0 })
  );
  earthGroup.add(_secTrail);

  _secMarker = _makeMarker(rec, 0xff4444);
  if (_secMarker) earthGroup.add(_secMarker);
}

function clearSelectionTrail() {
  _drop(_primTrail);  _primTrail  = null;
  _drop(_primMarker); _primMarker = null;
  _drop(_secTrail);   _secTrail   = null;
  _drop(_secMarker);  _secMarker  = null;
  _primRec = null;
  _secRec  = null;
}

function toggleRotation() {
  autoRotate = !autoRotate;
  const btn = document.getElementById("btn-rotation");
  if (btn) btn.textContent = autoRotate ? "⏸ Rotation" : "▶ Rotation";
}

function renderLoop() {
  requestAnimationFrame(renderLoop);
  tickSimTime();
  if (autoRotate && !isDragging) earthGroup.rotation.y += 0.0005;
  _moveMarker(_primMarker, _primRec);
  _moveMarker(_secMarker,  _secRec);
  renderer.render(scene, camera);
}