// globe.js
// Three.js scene setup.
// Creates the Earth sphere, atmosphere, starfield.
// Exposes the scene, camera, renderer for other modules.

const EARTH_RADIUS = 1.0;
const SCALE_FACTOR = 1.0 / 6371.0; // converts km to scene units

let scene, camera, renderer;
let earthMesh, atmosphereMesh;
let isDragging = false;
let previousMouse = { x: 0, y: 0 };
let earthGroup;

function initGlobe() {
  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.001,
    1000
  );
  camera.position.set(0, 0, 2.8);

  // Renderer
  const canvas = document.getElementById("globe-canvas");
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Group to rotate Earth + satellites together
  earthGroup = new THREE.Group();
  scene.add(earthGroup);

  // Earth sphere
  const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
  const earthMat = new THREE.MeshPhongMaterial({
    color: 0x1a2a5a,
    emissive: 0x0a1030,
    specular: 0x2244aa,
    shininess: 15,
    transparent: false
  });
  earthMesh = new THREE.Mesh(earthGeo, earthMat);
  earthGroup.add(earthMesh);

  // Grid lines on Earth surface
  const gridGeo = new THREE.SphereGeometry(EARTH_RADIUS + 0.001, 36, 18);
  const gridMat = new THREE.MeshBasicMaterial({
    color: 0x2244aa,
    wireframe: true,
    transparent: true,
    opacity: 0.08
  });
  earthGroup.add(new THREE.Mesh(gridGeo, gridMat));

  // Atmosphere glow
  const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS + 0.02, 64, 64);
  const atmosMat = new THREE.MeshPhongMaterial({
    color: 0x3366ff,
    transparent: true,
    opacity: 0.08,
    side: THREE.BackSide
  });
  atmosphereMesh = new THREE.Mesh(atmosGeo, atmosMat);
  earthGroup.add(atmosphereMesh);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x333355, 1.2);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0x8899ff, 1.5);
  sunLight.position.set(5, 3, 5);
  scene.add(sunLight);

  // Starfield background
  buildStarfield();

  // Mouse controls for rotation
  initMouseControls(canvas);

  // Handle window resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function buildStarfield() {
  const count = 8000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 800;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.3,
    transparent: true,
    opacity: 0.7
  });
  scene.add(new THREE.Points(starGeo, starMat));
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
    earthGroup.rotation.y += dx * 0.005;
    earthGroup.rotation.x += dy * 0.005;
    previousMouse = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener("mouseup", () => isDragging = false);
  canvas.addEventListener("mouseleave", () => isDragging = false);

  // Zoom with scroll
  canvas.addEventListener("wheel", e => {
    camera.position.z += e.deltaY * 0.001;
    camera.position.z = Math.max(1.4, Math.min(6.0, camera.position.z));
  });
}

function renderLoop() {
  requestAnimationFrame(renderLoop);

  // Slow auto-rotation when not dragging
  if (!isDragging) {
    earthGroup.rotation.y += 0.0008;
  }

  renderer.render(scene, camera);
}