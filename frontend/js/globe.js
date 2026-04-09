// globe.js
// Real Earth texture + orbit trails for high-risk satellites.

const EARTH_RADIUS = 1.0;
const SCALE_FACTOR = 1.0 / 6371.0;

let scene, camera, renderer;
let isDragging = false;
let previousMouse = { x: 0, y: 0 };
let earthGroup;
let trailLines = [];

function initGlobe() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.001,
    1000
  );
  camera.position.set(0, 0, 2.8);

  const canvas = document.getElementById("globe-canvas");
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  earthGroup = new THREE.Group();
  scene.add(earthGroup);

  // Load real Earth texture
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = "anonymous";

  const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 80, 80);

  // Primary: real Blue Marble texture
  loader.load(
    "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
    (texture) => {
      // Texture loaded — apply to Earth
      const mat = new THREE.MeshPhongMaterial({
        map:       texture,
        specular:  new THREE.Color(0x333366),
        shininess: 8
      });
      const earth = new THREE.Mesh(earthGeo, mat);
      earthGroup.add(earth);
      setStatus("Live — " + (typeof satRecords !== "undefined"
        ? satRecords.length.toLocaleString() : "0") + " satellites tracked.");
    },
    undefined,
    () => {
      // Fallback if texture fails to load
      const mat = new THREE.MeshPhongMaterial({
        color:    0x1a3a6a,
        emissive: 0x050d20,
        specular: 0x2244aa,
        shininess: 10
      });
      earthGroup.add(new THREE.Mesh(earthGeo, mat));
    }
  );

  // Night lights layer (city lights on dark side)
  loader.load(
    "https://unpkg.com/three-globe/example/img/earth-night.jpg",
    (texture) => {
      const nightGeo = new THREE.SphereGeometry(EARTH_RADIUS + 0.001, 80, 80);
      const nightMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending
      });
      earthGroup.add(new THREE.Mesh(nightGeo, nightMat));
    }
  );

  // Cloud layer
  loader.load(
    "https://unpkg.com/three-globe/example/img/earth-water.png",
    (texture) => {
      const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS + 0.003, 80, 80);
      const cloudMat = new THREE.MeshPhongMaterial({
        map: texture,
        transparent: true,
        opacity: 0.18,
        depthWrite: false
      });
      earthGroup.add(new THREE.Mesh(cloudGeo, cloudMat));
    }
  );

  // Atmosphere glow
  const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS + 0.04, 64, 64);
  const atmosMat = new THREE.MeshPhongMaterial({
    color: 0x3366cc,
    transparent: true,
    opacity: 0.06,
    side: THREE.BackSide
  });
  earthGroup.add(new THREE.Mesh(atmosGeo, atmosMat));

  // Thin atmosphere rim
  const rimGeo = new THREE.SphereGeometry(EARTH_RADIUS + 0.015, 64, 64);
  const rimMat = new THREE.MeshPhongMaterial({
    color: 0x4488ff,
    transparent: true,
    opacity: 0.04,
    side: THREE.BackSide
  });
  earthGroup.add(new THREE.Mesh(rimGeo, rimMat));

  // Lighting setup
  scene.add(new THREE.AmbientLight(0x334466, 1.2));

  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(6, 2, 4);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x112244, 0.4);
  fill.position.set(-5, -2, -3);
  scene.add(fill);

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
    const positions = new Float32Array(count * 3);
    const spread = layer === 0 ? 700 : 180;
    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * spread;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color:       layer === 0 ? 0xffffff : 0xaabbff,
      size:        layer === 0 ? 0.22 : 0.38,
      transparent: true,
      opacity:     layer === 0 ? 0.45 : 0.75
    });
    scene.add(new THREE.Points(geo, mat));
  });
}

function initMouseControls(canvas) {
  canvas.addEventListener("mousedown", e => {
    isDragging = true;
    previousMouse = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener("mousemove", e => {
    if (!isDragging) return;
    const dx = e.clientX - previousMouse.x;
    const dy = e.clientY - previousMouse.y;
    earthGroup.rotation.y += dx * 0.004;
    earthGroup.rotation.x += dy * 0.004;
    earthGroup.rotation.x = Math.max(
      -Math.PI / 2.2,
      Math.min(Math.PI / 2.2, earthGroup.rotation.x)
    );
    previousMouse = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener("mouseup",    () => isDragging = false);
  canvas.addEventListener("mouseleave", () => isDragging = false);

  canvas.addEventListener("wheel", e => {
    camera.position.z += e.deltaY * 0.0008;
    camera.position.z = Math.max(1.3, Math.min(5.5, camera.position.z));
    e.preventDefault();
  }, { passive: false });
}

function drawOrbitTrail(satRecord) {
  /**
   * Draws the orbit path of a high-risk satellite as a line loop.
   * Propagates the satellite through one full orbit (96 minutes)
   * at 60 sample points and connects them with a LineLoop.
   */
  if (!satRecord || !satRecord.satrec) return;

  const points = [];
  const now = new Date();
  const ORBIT_MINUTES = 96;
  const STEPS = 80;

  for (let i = 0; i <= STEPS; i++) {
    const t = new Date(now.getTime() + (i / STEPS) * ORBIT_MINUTES * 60000);
    try {
      const pv = satellite.propagate(satRecord.satrec, t);
      if (!pv || !pv.position) continue;
      const p = pv.position;
      const scale = SCALE_FACTOR;
      points.push(new THREE.Vector3(
        p.x * scale,
        p.z * scale,
        -p.y * scale
      ));
    } catch (e) { continue; }
  }

  if (points.length < 2) return;

  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color: 0xff3333,
    transparent: true,
    opacity: 0.35,
    linewidth: 1
  });

  const line = new THREE.Line(geo, mat);
  earthGroup.add(line);
  trailLines.push(line);
}

function clearTrails() {
  for (const line of trailLines) {
    earthGroup.remove(line);
    line.geometry.dispose();
    line.material.dispose();
  }
  trailLines = [];
}

function renderLoop() {
  requestAnimationFrame(renderLoop);
  if (!isDragging) earthGroup.rotation.y += 0.0005;
  renderer.render(scene, camera);
}