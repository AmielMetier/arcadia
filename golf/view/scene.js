// Birdie Party — scène 3D (Three.js r169 embarqué). Assemble le ciel, le terrain, l'eau (avec reflets), le décor,
// les golfeurs, la balle (traînée et ombre), les balles des autres joueurs, la cible de visée et la caméra.
// createScene() monte le canevas ; loadHole() construit un trou ; dispose() libère tout (géométries, matériaux,
// textures, contexte WebGL).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { buildTerrain, buildWater, noiseTexture, LOOKS } from './terrain.js';
import { buildSky, buildPeaks, SKIES } from './sky.js';
import { scatterNature, buildPin, buildTeeMarkers, buildGreenGrid } from './decor.js';
import { createTreeKit, forestItems, buildTallGrass, SWAY } from './trees.js';
import { buildGolfer } from './golfer.js';
import { loadNature } from './models.js';

const MOBILE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 560;
const SUN_DIR = new THREE.Vector3(-0.45, 0.78, -0.42).normalize();
const BALL_VIS = 0.055; // rayon affiché de la balle (grossie pour rester visible)

export function createScene(host, { onLost } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // tonalité neutre : garde les couleurs franches (l'ACES les ternit)
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onLost && onLost(); });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.08, 4800);
  const noise = noiseTexture();
  let disposed = false;

  // ---------------------------------------------------------------- lumières : soleil chaud, ciel bleu, rebond vert
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5d8a3a, 0.55); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // ---------------------------------------------------------------- reflets : rendu miroir à mi-résolution
  const reflRT = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType });
  const refl = { uRefl: { value: reflRT.texture }, uReflM: { value: new THREE.Matrix4() } };
  const mirrorCam = new THREE.PerspectiveCamera();
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const noReflect = []; // objets à cacher pendant le rendu miroir

  // ---------------------------------------------------------------- contenu d'un trou (reconstruit à chaque trou)
  let world = null, kitP = null, treeKit = null;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_VIS, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, emissive: 0x404040 }));
  ball.castShadow = true; scene.add(ball);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0b1a06, transparent: true, opacity: 0.35, depthWrite: false }));
  blob.renderOrder = 3; scene.add(blob);
  // balles des autres joueurs, à leur couleur
  const others = new THREE.InstancedMesh(new THREE.SphereGeometry(BALL_VIS * 1.1, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), 8);
  others.count = 0; others.frustumCulled = false; scene.add(others);
  // traînée : points qui s'estompent derrière la balle
  const TRAIL = 70;
  const trailPos = new Float32Array(TRAIL * 3), trailA = new Float32Array(TRAIL);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('a', new THREE.BufferAttribute(trailA, 1));
  const trail = new THREE.Points(trailGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 400 } },
    vertexShader: 'attribute float a; varying float vA; uniform float uScale; void main(){ vA = a; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = max(1.5, uScale * 0.09 * (0.35 + 0.65 * a) / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c,c); if (d > 0.25) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, vA * 0.75 * (1.0 - d * 4.0)); }',
  }));
  trail.frustumCulled = false; scene.add(trail);
  let trailN = 0;
  // cible : anneau posé sur le sol + colonne de lumière visible de loin
  const marker = new THREE.Group(); scene.add(marker);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false })); marker.add(ring);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.95, depthWrite: false })); marker.add(dot);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 14, 16, 1, true).translate(0, 7, 0), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying float vY; void main(){ gl_FragColor = vec4(1.0, 0.93, 0.45, (1.0 - vY) * 0.42); }',
  }));
  marker.add(beam);
  marker.renderOrder = 4; ring.renderOrder = dot.renderOrder = beam.renderOrder = 4;
  // pointillés de visée au sol
  const DOTS = 60;
  const dotsMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }), DOTS);
  dotsMesh.count = 0; dotsMesh.renderOrder = 4; dotsMesh.frustumCulled = false; scene.add(dotsMesh);
  // tee sous la balle au départ
  const tee = new THREE.Group();
  const teeMat = new THREE.MeshStandardMaterial({ color: 0xff4f3a, roughness: 0.5 });
  tee.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.006, 0.07, 10).translate(0, -0.035, 0), teeMat));
  tee.add(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.012, 0.018, 14).translate(0, -0.004, 0), teeMat));
  tee.visible = false; scene.add(tee);
  noReflect.push(trail, marker, dotsMesh, blob);

  // golfeurs : celui qui joue et les spectateurs
  const golfers = new Set();
  function addGolfer(look) { const g = buildGolfer(look); scene.add(g.root); golfers.add(g); return g; }
  function removeGolfer(g) { if (!golfers.has(g)) return; scene.remove(g.root); g.dispose(); golfers.delete(g); }

  async function loadHole(hole, { theme = 'campagne', wind } = {}) {
    if (world) unloadHole();
    const look = LOOKS[theme] || LOOKS.campagne, skyLook = SKIES[theme] || SKIES.campagne;
    const g = new THREE.Group();
    const center = { x: (hole.bounds.x0 + hole.bounds.x1) / 2, z: (hole.bounds.z0 + hole.bounds.z1) / 2 };
    // ciel → environnement (reflets et lumière d'ambiance)
    const sky = buildSky(skyLook, SUN_DIR, noise);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene(); envScene.add(buildSky(skyLook, SUN_DIR, noise));
    const env = pmrem.fromScene(envScene, 0.02).texture;
    envScene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    pmrem.dispose();
    scene.environment = env; scene.environmentIntensity = 0.5;
    // brume bleutée sur les collines lointaines
    scene.fog = new THREE.Fog(skyLook.fog, 170, 1500);
    scene.background = new THREE.Color(skyLook.horizon);
    g.add(sky);
    const peaks = buildPeaks(skyLook, hole.def.seed, center); if (peaks) g.add(peaks);

    const terrain = buildTerrain(hole, { look, noise, anisotropy: renderer.capabilities.getMaxAnisotropy(), step: MOBILE ? 2 : 1.5 });
    g.add(terrain.mesh);
    const water = buildWater(hole, { noise, envMap: env, refl }); g.add(water.group);
    // arbres du parcours (la balle les heurte), forêt des collines, herbes hautes
    if (!treeKit) treeKit = createTreeKit();
    // les arbres loin du couloir de jeu sont plus sombres
    for (const t of hole.trees) t.dark = hole.centerDist(t.x, t.z) > hole.valley + 12;
    g.add(treeKit.plant(hole.trees));
    g.add(treeKit.shades(hole));
    g.add(treeKit.plant(forestItems(hole, { count: MOBILE ? 900 : 2600 }), { lo: true, shadows: false, dark: true }));
    const grass = buildTallGrass(hole, { count: MOBILE ? 2200 : 5200 }); g.add(grass);
    const pin = buildPin(hole); g.add(pin.group);
    g.add(buildTeeMarkers(hole));
    const grid = buildGreenGrid(hole); g.add(grid.group);
    scene.add(g);
    world = { group: g, hole, terrain, water, sky, pin, grid, env, wind, noReflect: [grass, grid.group, water.group] };
    // décor Kenney : chargé une fois, semé à chaque trou
    if (!kitP) kitP = loadNature(new URL('../models/nature/', import.meta.url).href).catch(() => null);
    kitP.then((kit) => { if (!disposed && world && world.hole === hole && kit) world.group.add(scatterNature(hole, kit)); });
    return { canvas: terrain.canvas, area: terrain.area };
  }
  function unloadHole() {
    if (!world) return;
    scene.remove(world.group);
    world.group.traverse((o) => {
      if (o.isMesh || o.isPoints || o.isInstancedMesh || o.isLineSegments) {
        // les géométries et matériaux partagés (arbres, décor Kenney) sont libérés par leur kit
        if (o.userData.shared) return;
        o.geometry.dispose();
        for (const t of o.userData.textures || []) t.dispose();
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) { m.map && m.map !== noise && m.map.dispose(); m.dispose(); }
      }
    });
    world.env.dispose();
    world = null;
  }

  // ---------------------------------------------------------------- balle, cible, ombre
  const tmp = new THREE.Vector3();
  function setBall(x, y, z) {
    ball.position.set(x, y - 0.021 + BALL_VIS, z);
    if (!world) return;
    const gy = world.hole.heightAt(x, z), hgt = Math.max(0, y - gy);
    blob.position.set(x, gy + 0.03, z);
    blob.scale.setScalar(BALL_VIS * (1.1 + hgt * 0.04));
    blob.material.opacity = 0.35 / (1 + hgt * 0.08);
    blob.visible = ball.visible;
  }
  function setOthers(list) {
    const m = new THREE.Matrix4(), col = new THREE.Color();
    others.count = Math.min(8, list.length);
    for (let i = 0; i < others.count; i++) {
      const o = list[i]; m.makeTranslation(o.x, (world ? world.hole.heightAt(o.x, o.z) : 0) + BALL_VIS, o.z);
      others.setMatrixAt(i, m); others.setColorAt(i, col.set(o.color));
    }
    others.instanceMatrix.needsUpdate = true; if (others.instanceColor) others.instanceColor.needsUpdate = true;
  }
  function trailPush(x, y, z) {
    for (let i = TRAIL - 1; i > 0; i--) { trailPos[i * 3] = trailPos[(i - 1) * 3]; trailPos[i * 3 + 1] = trailPos[(i - 1) * 3 + 1]; trailPos[i * 3 + 2] = trailPos[(i - 1) * 3 + 2]; }
    trailPos[0] = x; trailPos[1] = y; trailPos[2] = z;
    trailN = Math.min(TRAIL, trailN + 1);
    for (let i = 0; i < TRAIL; i++) trailA[i] = i < trailN ? 1 - i / TRAIL : 0;
    trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.a.needsUpdate = true;
  }
  function trailClear() { trailN = 0; trailA.fill(0); trailGeo.attributes.a.needsUpdate = true; }
  function trailFade(dt) { for (let i = 0; i < TRAIL; i++) trailA[i] = Math.max(0, trailA[i] - dt * 0.8); trailGeo.attributes.a.needsUpdate = true; }

  function setMarker(p, on, size = 1, beamOn = true) {
    marker.visible = !!on; if (!on || !world) return;
    beam.visible = beamOn;
    marker.position.set(p.x, world.hole.heightAt(p.x, p.z) + 0.06, p.z);
    marker.userData.size = size;
  }
  // pointillés de la balle à la cible, posés sur le relief
  function setAimDots(from, to, on) {
    if (!on || !world) { dotsMesh.count = 0; return; }
    const L = Math.hypot(to.x - from.x, to.z - from.z), step = Math.max(1.2, L / 40);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    let n = 0;
    for (let d = step * 1.5; d < L - step * 0.5 && n < DOTS; d += step) {
      const x = from.x + (to.x - from.x) * d / L, z = from.z + (to.z - from.z) * d / L;
      tmp.set(x, world.hole.heightAt(x, z) + 0.05, z);
      sc.setScalar(Math.min(0.5, 0.05 + d * 0.0035));
      m.compose(tmp, q, sc); dotsMesh.setMatrixAt(n++, m);
    }
    dotsMesh.count = n; dotsMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- caméra (suivi amorti)
  const cam = { pos: new THREE.Vector3(0, 30, -40), look: new THREE.Vector3(0, 0, 100), tPos: new THREE.Vector3(), tLook: new THREE.Vector3(), k: 3 };
  function camTo(pos, look, k = 3, snap = false) {
    cam.tPos.copy(pos); cam.tLook.copy(look); cam.k = k;
    if (snap) { cam.pos.copy(pos); cam.look.copy(look); }
  }

  function resize() {
    const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 62 : 50;
    camera.updateProjectionMatrix();
    trail.material.uniforms.uScale.value = h;
    const pr = renderer.getPixelRatio();
    reflRT.setSize(Math.round(w * pr * 0.5), Math.round(h * pr * 0.5));
  }
  resize();
  addEventListener('resize', resize);

  // rendu miroir pour le plan d'eau le plus proche de ce que regarde la caméra
  function renderReflection() {
    if (!world || MOBILE) { world && world.water.setReflect(null); return; }
    let best = null, bd = Infinity;
    for (const b of world.water.bodies) {
      if (b.river || !b.center) continue;
      const d = Math.max(0, Math.hypot(b.center.x - cam.look.x, b.center.z - cam.look.z) - b.center.r) + Math.max(0, Math.hypot(b.center.x - cam.pos.x, b.center.z - cam.pos.z) - b.center.r) * 0.5;
      if (d < bd) { bd = d; best = b; }
    }
    if (!best || bd > 420 || camera.position.y < best.level) { world.water.setReflect(null); return; }
    const h = best.level;
    mirrorCam.copy(camera);
    mirrorCam.position.set(camera.position.x, 2 * h - camera.position.y, camera.position.z);
    mirrorCam.up.set(0, 1, 0);
    mirrorCam.lookAt(cam.look.x, 2 * h - cam.look.y, cam.look.z);
    mirrorCam.updateMatrixWorld(); mirrorCam.projectionMatrix.copy(camera.projectionMatrix);
    refl.uReflM.value.copy(BIAS).multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse);
    clipPlane.constant = -h + 0.02;
    const hidden = [...noReflect, ...world.noReflect, ...[...golfers].map((g) => g.root)].filter((o) => o.visible);
    for (const o of hidden) o.visible = false;
    renderer.clippingPlanes = [clipPlane];
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(reflRT);
    renderer.render(scene, mirrorCam);
    renderer.setRenderTarget(null);
    renderer.clippingPlanes = [];
    renderer.shadowMap.autoUpdate = true;
    for (const o of hidden) o.visible = true;
    world.water.setReflect(h);
  }

  let T = 0;
  function frame(dt) {
    if (disposed) return;
    T += dt;
    const a = 1 - Math.exp(-cam.k * dt);
    cam.pos.lerp(cam.tPos, a); cam.look.lerp(cam.tLook, a);
    // ne jamais passer sous le terrain
    if (world) { const gy = world.hole.heightAt(cam.pos.x, cam.pos.z) + 0.6; if (cam.pos.y < gy) cam.pos.y = gy; }
    camera.position.copy(cam.pos); camera.lookAt(cam.look);
    // l'ombre du soleil suit ce que regarde la caméra
    const fx = cam.look.x * 0.6 + cam.pos.x * 0.4, fz = cam.look.z * 0.6 + cam.pos.z * 0.4;
    sun.target.position.set(fx, 0, fz);
    sun.position.set(fx + SUN_DIR.x * 120, SUN_DIR.y * 120 + (world ? world.hole.heightAt(fx, fz) : 0), fz + SUN_DIR.z * 120);
    SWAY.uT.value = T;
    if (world) {
      SWAY.uWind.value = Math.min(1, (world.wind?.speed || 0) / 7);
      world.water.update(T);
      world.sky.userData.update(T);
      world.pin.update(T, world.wind);
      world.grid.update(T);
      const ms = marker.userData.size || 1, pulse = 1 + Math.sin(T * 4) * 0.06;
      ring.scale.setScalar(ms * pulse); dot.scale.setScalar(ms); beam.scale.set(ms, 1 + ms * 0.3, ms);
    }
    for (const g of golfers) g.update(dt);
    renderReflection();
    renderer.render(scene, camera);
  }

  function project(x, y, z) {
    tmp.set(x, y, z).project(camera);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    return { x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h, on: tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05 };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    removeEventListener('resize', resize);
    unloadHole();
    kitP && kitP.then((k) => k && k.dispose());
    treeKit && treeKit.dispose();
    for (const g of [...golfers]) removeGolfer(g);
    scene.traverse((o) => { if (o.isMesh || o.isPoints) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.dispose(); } });
    noise.dispose(); reflRT.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  return {
    renderer, scene, camera, MOBILE,
    loadHole, setBall, setOthers, setMarker, setAimDots, trailPush, trailClear, trailFade, camTo, cam, frame, project, dispose, addGolfer, removeGolfer,
    get hole() { return world && world.hole; },
    setWind(w) { if (world) world.wind = w; },
    showBall(on) { ball.visible = on; blob.visible = on; },
    setTee(b, on) { tee.visible = on; if (on) tee.position.set(b.x, b.y - 0.021, b.z); },
    showPole(on) { world && world.pin.showPole(on); },
    showGrid(on) { if (world) world.grid.group.visible = on; },
  };
}
