// globe.js

const EARTH_RADIUS = 1.0;
const SCALE_FACTOR = 1.0 / 6371.0;

let scene, camera, renderer;
let isDragging = false;
let previousMouse = { x: 0, y: 0 };
let earthGroup;
let autoRotate = true;
let latLonGridMesh = null;
let countryBordersMesh = null;
let latLonGridEnabled = true;
let countryBordersEnabled = true;

// ── Sun state ──────────────────────────────────────────
let sunLight = null;
let _sunMesh  = null;

// ── Camera orbit state ─────────────────────────────────
let _cameraTheta     = 0;
let _cameraPhi       = 0;
let _cameraRadius    = 2.8;
let _lastInteraction = Date.now();

// State 0 = Normal, 1 = Fast, 2 = Fastest, 3 = OFF
let _cameraOrbitState = 0;
const _ORBIT_SPEEDS   = [0.00010, 0.00028, 0.00055, 0];
const _ORBIT_RESUME_MS = 1000;  // resume cinematic 1 second after interaction

// ── Selection trail state ──────────────────────────────
let _primTrail  = null, _primMarker  = null, _primRec  = null;
let _secTrail   = null, _secMarker   = null, _secRec   = null;

// ── Time simulation state ──────────────────────────────
let simTimeMs        = Date.now();
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
  if (pauseBtn) {
    if (simPaused) {
      pauseBtn.textContent = "▶";
      pauseBtn.title = "Resume simulation time";
      pauseBtn.setAttribute("aria-label", "Resume simulation time");
    } else {
      pauseBtn.textContent = "⏸";
      pauseBtn.title = "Pause simulation time";
      pauseBtn.setAttribute("aria-label", "Pause simulation time");
    }
  }
  const isLive = !simPaused && Math.abs(simTimeMs - Date.now()) < 2000;
  const clockEl = document.getElementById("stat-time");
  if (clockEl) clockEl.classList.toggle("sim-active", !isLive);
}

// ── Solar position ─────────────────────────────────────
function _computeSunDirection(date) {
  const JD  = date.getTime() / 86400000.0 + 2440587.5;
  const n   = JD - 2451545.0;
  const L   = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;
  const gDeg = ((357.528 + 0.9856003 * n) % 360 + 360) % 360;
  const g   = gDeg * Math.PI / 180;
  const lambdaDeg = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
  const lambda    = lambdaDeg * Math.PI / 180;
  const eps       = 23.439 * Math.PI / 180;
  const ex =  Math.cos(lambda);
  const ey =  Math.cos(eps) * Math.sin(lambda);
  const ez =  Math.sin(eps) * Math.sin(lambda);
  return new THREE.Vector3(ex, ez, -ey).normalize();
}

function _updateSunPosition() {
  if (!sunLight) return;
  const dir = _computeSunDirection(getSimTime());
  sunLight.position.set(dir.x * 100, dir.y * 100, dir.z * 100);
  if (_sunMesh) {
    _sunMesh.position.set(dir.x * 100, dir.y * 100, dir.z * 100);
  }
}

// ── Sun texture — canvas-drawn star burst ──────────────
// Draws a realistic star with 8 sharp rays (4 long, 4 shorter at 45°)
// onto a canvas, then converts to a Three.js texture for a Sprite.
// AdditiveBlending makes it glow against the dark space background.
function _createSunTexture() {
  const S  = 512;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const ctx = cv.getContext("2d");
  const cx  = S / 2, cy = S / 2, R = S / 2;

  ctx.clearRect(0, 0, S, S);

  // Outer warm glow — large soft radial gradient
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  glow.addColorStop(0.00, "rgba(255,255,230,1.0)");
  glow.addColorStop(0.04, "rgba(255,255,210,0.95)");
  glow.addColorStop(0.10, "rgba(255,240,140,0.75)");
  glow.addColorStop(0.22, "rgba(255,210, 60,0.38)");
  glow.addColorStop(0.45, "rgba(255,170, 20,0.12)");
  glow.addColorStop(0.70, "rgba(255,130,  0,0.04)");
  glow.addColorStop(1.00, "rgba(255,100,  0,0.00)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);

  // 8 sharp star rays — 4 main (longer) + 4 diagonal (shorter)
  const numRays = 8;
  for (let i = 0; i < numRays; i++) {
    const angle  = (i / numRays) * Math.PI * 2;
    const isMain = i % 2 === 0;
    const len    = isMain ? R * 0.96 : R * 0.58;
    const hw     = isMain ? 2.2 : 1.4;  // half-width at origin (pixels)

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    const sg = ctx.createLinearGradient(0, 0, len, 0);
    sg.addColorStop(0.00, "rgba(255,255,255,1.0)");
    sg.addColorStop(0.06, "rgba(255,255,255,0.95)");
    sg.addColorStop(0.25, "rgba(255,255,240,0.50)");
    sg.addColorStop(0.55, "rgba(255,255,220,0.15)");
    sg.addColorStop(1.00, "rgba(255,255,255,0.00)");

    ctx.beginPath();
    ctx.moveTo(0, -hw);
    ctx.lineTo(len, 0);
    ctx.lineTo(0,  hw);
    ctx.closePath();
    ctx.fillStyle = sg;
    ctx.fill();

    ctx.restore();
  }

  // Bright white hot core on top
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.07);
  core.addColorStop(0.0, "rgba(255,255,255,1.0)");
  core.addColorStop(0.5, "rgba(255,255,255,0.85)");
  core.addColorStop(1.0, "rgba(255,255,255,0.0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, S, S);

  return new THREE.CanvasTexture(cv);
}

// ── Camera helpers ─────────────────────────────────────
function _updateCameraPosition() {
  camera.position.x = _cameraRadius * Math.cos(_cameraPhi) * Math.sin(_cameraTheta);
  camera.position.y = _cameraRadius * Math.sin(_cameraPhi);
  camera.position.z = _cameraRadius * Math.cos(_cameraPhi) * Math.cos(_cameraTheta);
  camera.lookAt(0, 0, 0);
}

function globeFaceSatellite(eciPos) {
  const mag = Math.sqrt(eciPos.x * eciPos.x + eciPos.y * eciPos.y + eciPos.z * eciPos.z);
  if (mag < 1) return;
  const tx = eciPos.x / mag;
  const ty = eciPos.z / mag;
  const tz = -eciPos.y / mag;
  _cameraTheta = Math.atan2(tx, tz);
  _cameraPhi   = Math.asin(Math.max(-1, Math.min(1, ty)));
}

function initGlobe() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    52, window.innerWidth / window.innerHeight, 0.001, 1000
  );
  _updateCameraPosition();

  const canvas = document.getElementById("globe-canvas");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  earthGroup = new THREE.Group();
  scene.add(earthGroup);

  const loader   = new THREE.TextureLoader();
  const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 80, 80);

  // Day texture — responds to DirectionalLight for day/night effect
  loader.load(
    "https://unpkg.com/three-globe/example/img/earth-day.jpg",
    tex => {
      earthGroup.add(new THREE.Mesh(earthGeo,
        new THREE.MeshPhongMaterial({
          map:       tex,
          specular:  new THREE.Color(0x004466),
          shininess: 12,
        })
      ));
    },
    undefined,
    () => {
      earthGroup.add(new THREE.Mesh(earthGeo,
        new THREE.MeshPhongMaterial({ color: 0x0a1428, shininess: 5 })
      ));
    }
  );

  // Night city lights — additive overlay (dark adds nothing on day side)
  loader.load(
    "https://unpkg.com/three-globe/example/img/earth-night.jpg",
    tex => {
      earthGroup.add(new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS + 0.0005, 80, 80),
        new THREE.MeshBasicMaterial({
          map:         tex,
          blending:    THREE.AdditiveBlending,
          transparent: true,
          opacity:     0.8,
          depthWrite:  false
        })
      ));
    }
  );

  // Country borders overlay
  loader.load(
    "https://unpkg.com/three-globe/example/img/earth-topology.png",
    tex => {
      countryBordersMesh = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS + 0.001, 80, 80),
        new THREE.MeshBasicMaterial({
          map:         tex,
          color:       0xb5c9ff,
          transparent: true,
          opacity:     0.14,
          blending:    THREE.NormalBlending,
          depthWrite:  false
        })
      );
      countryBordersMesh.visible = countryBordersEnabled;
      earthGroup.add(countryBordersMesh);
    }
  );

  // Lat/Lon grid
  const gridGeo = new THREE.SphereGeometry(EARTH_RADIUS + 0.002, 36, 18);
  const gridMat = new THREE.MeshBasicMaterial({
    color:       0x53b8d9,
    wireframe:   true,
    transparent: true,
    opacity:     0.15,
    blending:    THREE.NormalBlending,
    depthWrite:  false
  });
  latLonGridMesh = new THREE.Mesh(gridGeo, gridMat);
  latLonGridMesh.visible = latLonGridEnabled;
  earthGroup.add(latLonGridMesh);

  // Atmosphere glow
  earthGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS + 0.04, 64, 64),
    new THREE.MeshPhongMaterial({
      color: 0x1a3a99, transparent: true, opacity: 0.08, side: THREE.BackSide
    })
  ));

  // Near-zero ambient — space is dark, keeps day/night contrast sharp
  scene.add(new THREE.AmbientLight(0x0a1428, 0.06));

  // Sun directional light — position updated every frame
  sunLight = new THREE.DirectionalLight(0xfff8e0, 2.8);
  _updateSunPosition();
  scene.add(sunLight);

  // ── Visible sun — canvas star burst sprite ─────────────
  // THREE.Sprite always faces the camera (billboard).
  // AdditiveBlending makes the glow add to the dark background.
  // depthWrite: false prevents the transparent edges from occluding stars.
  // scale (26, 26, 1) gives a clearly visible but not screen-filling disc
  // at 100 units distance with FOV 52°.
  const sunTex = _createSunTexture();
  _sunMesh = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map:         sunTex,
      transparent: true,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false
    })
  );
  _sunMesh.scale.set(26, 26, 1);
  scene.add(_sunMesh);

  buildStarfield();
  initMouseControls(canvas);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  _updateGlobeDisplayControlsUI();
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
    isDragging       = true;
    _lastInteraction = Date.now();
    previousMouse    = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("mousemove", e => {
    if (!isDragging) return;
    _lastInteraction = Date.now();
    _cameraTheta += (e.clientX - previousMouse.x) * 0.005;
    _cameraPhi   -= (e.clientY - previousMouse.y) * 0.003;
    _cameraPhi    = Math.max(-Math.PI / 2 + 0.08, Math.min(Math.PI / 2 - 0.08, _cameraPhi));
    previousMouse = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("mouseup",    () => isDragging = false);
  canvas.addEventListener("mouseleave", () => isDragging = false);
  canvas.addEventListener("wheel", e => {
    _lastInteraction = Date.now();
    _cameraRadius += e.deltaY * 0.001;
    _cameraRadius  = Math.max(1.3, Math.min(5.5, _cameraRadius));
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
  if (btn) {
    if (autoRotate) {
      btn.textContent = "⏸";
      btn.title = "Pause Earth rotation";
      btn.setAttribute("aria-label", "Pause Earth rotation");
    } else {
      btn.textContent = "▶";
      btn.title = "Resume Earth rotation";
      btn.setAttribute("aria-label", "Resume Earth rotation");
    }
  }
}

// Cycles camera orbit through: Normal → Fast → Fastest → OFF → Normal
// _ORBIT_SPEEDS[state] drives the theta increment in renderLoop.
// State 3 = OFF: cinematic orbit fully disabled until toggled back.
// States 0-2: orbit pauses on interaction and resumes after _ORBIT_RESUME_MS.
function toggleCameraOrbit() {
  _cameraOrbitState = (_cameraOrbitState + 1) % 4;
  _updateGlobeDisplayControlsUI();
}

function toggleLatLonGrid() {
  latLonGridEnabled = !latLonGridEnabled;
  if (latLonGridMesh) latLonGridMesh.visible = latLonGridEnabled;
  _updateGlobeDisplayControlsUI();
}

function toggleCountryBorders() {
  countryBordersEnabled = !countryBordersEnabled;
  if (countryBordersMesh) countryBordersMesh.visible = countryBordersEnabled;
  _updateGlobeDisplayControlsUI();
}

function _updateGlobeDisplayControlsUI() {
  const gridBtn = document.getElementById("btn-grid-toggle");
  if (gridBtn) {
    const label = latLonGridEnabled ? "Latitude/Longitude Grid: ON" : "Latitude/Longitude Grid: OFF";
    gridBtn.title = label;
    gridBtn.setAttribute("aria-label", label);
    gridBtn.classList.toggle("is-active", latLonGridEnabled);
  }

  const bordersBtn = document.getElementById("btn-borders-toggle");
  if (bordersBtn) {
    const label = countryBordersEnabled ? "Country Borders: ON" : "Country Borders: OFF";
    bordersBtn.title = label;
    bordersBtn.setAttribute("aria-label", label);
    bordersBtn.classList.toggle("is-active", countryBordersEnabled);
  }

  // Camera orbit button: tooltip shows current speed state.
  // is-active (green dot) whenever orbit is not OFF.
  const orbitBtn = document.getElementById("btn-camera-orbit");
  if (orbitBtn) {
    const labels = [
      "Camera Orbit: Normal — click for Fast",
      "Camera Orbit: Fast — click for Fastest",
      "Camera Orbit: Fastest — click to turn OFF",
      "Camera Orbit: OFF — click to resume Normal"
    ];
    const label = labels[_cameraOrbitState];
    orbitBtn.title = label;
    orbitBtn.setAttribute("aria-label", label);
    orbitBtn.classList.toggle("is-active", _cameraOrbitState < 3);
  }
}

function renderLoop() {
  requestAnimationFrame(renderLoop);
  tickSimTime();

  // Sun: update direction and visible sprite from simulation time
  _updateSunPosition();

  // Cinematic camera orbit.
  // States 0-2: auto-orbit with increasing speed, pauses on interaction.
  // State  3:   orbit completely off, camera stays where user left it.
  const idle = !isDragging && (Date.now() - _lastInteraction > _ORBIT_RESUME_MS);
  if (_cameraOrbitState < 3 && idle) {
    _cameraTheta += _ORBIT_SPEEDS[_cameraOrbitState];
  }

  // Always recompute camera from spherical coords so zoom and drag
  // both take effect immediately without any state inconsistency.
  _updateCameraPosition();

  // Earth's physical rotation — independent of camera orbit.
  // Runs even when camera orbit is paused, so the terminator shifts.
  if (autoRotate) {
    earthGroup.rotation.y += 0.0002;
  }

  _moveMarker(_primMarker, _primRec);
  _moveMarker(_secMarker,  _secRec);
  renderer.render(scene, camera);
}