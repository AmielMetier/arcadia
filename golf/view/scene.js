// Birdie Party — scène 3D (Three.js r169 embarqué). Assemble le ciel, le terrain, l'eau (avec reflets), le décor,
// les golfeurs, la balle (traînée et ombre), les balles des autres joueurs, la cible de visée et la caméra.
// createScene() monte le canevas ; loadHole() construit un trou ; dispose() libère tout (géométries, matériaux,
// textures, contexte WebGL).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { buildTerrain, buildWater, noiseTexture, reliefMaterial, LOOKS } from './terrain.js';
import { buildSky, buildPeaks, skyFor, TIMES } from './sky.js';
import { scatterNature, buildPin, buildTeeMarkers, buildGreenGrid } from './decor.js';
import { createTreeKit, forestItems, SWAY } from './trees.js';
import { createGrass } from './grass.js';
import { createPost } from './post.js';
import { buildGolfer } from './golfer.js';
import { loadNature } from './models.js';

const MOBILE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 560;
// direction du soleil (la lune le soir) : réglée par le moment de la journée à chaque trou
const DAY_DIR = new THREE.Vector3(-0.45, 0.78, -0.42).normalize();
const SUN_DIR = DAY_DIR.clone();
const DAY = { sunColor: 0xffeed4, sunInt: 4.2, hemiSky: 0xc4d8f0, hemiGround: 0x34481f, hemiInt: 0.42, exposure: 0.92, env: 0.3 };
const BALL_VIS = 0.055; // rayon affiché de la balle (grossie pour rester visible)

export function createScene(host, { onLost } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  host.appendChild(canvas);
  // sur ordinateur l'image passe toujours par la cible anticrénelée du post-traitement : le canevas n'a pas besoin de la sienne
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: MOBILE, powerPreference: 'high-performance' });
  const PR_MAX = Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 1.6);
  renderer.setPixelRatio(PR_MAX);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // tonalité neutre : hautes lumières douces sans éteindre les verts
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onLost && onLost(); });
  // fondu enchaîné : l'image du moment est figée dans un calque posé sur la scène, qui s'efface pendant que la
  // nouvelle vue apparaît dessous (changement de plan sans coupure ni passage au blanc)
  const xf = document.createElement('canvas');
  xf.className = 'xfade';
  host.appendChild(xf);
  const xctx = xf.getContext('2d');
  const fade = { a: 0, left: 0, dur: 1 };
  // rend la main au navigateur entre deux étapes lourdes : il affiche une image, les animations continuent
  const breathe = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.12, 4800);
  const noise = noiseTexture();
  let disposed = false;

  // ---------------------------------------------------------------- lumières : soleil chaud, ciel bleu, rebond vert
  const hemi = new THREE.HemisphereLight(0xc4d8f0, 0x34481f, 0.42); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffeed4, 4.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 280 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.035; sun.shadow.radius = 3;
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
  // qualité : résolution, post-traitement (occlusion, halo), reflets, herbe 3D ; baissée automatiquement si la machine peine
  const post = MOBILE ? null : createPost(renderer);
  const quality = { refl: !MOBILE, grass: true, ao: !MOBILE, bloom: !MOBILE };
  // un cran plus bas : d'abord la résolution (jusqu'à un pixel par point), puis les effets, enfin encore la résolution
  function lowerQuality() {
    const pr = renderer.getPixelRatio();
    const setPr = (v) => { renderer.setPixelRatio(v); resize(); return 'résolution ' + v.toFixed(2); };
    if (pr > 1.01) return setPr(Math.max(1, pr * 0.85));
    for (const k of ['refl', 'ao', 'grass', 'bloom']) if (quality[k]) { quality[k] = false; return k; }
    if (pr > 0.76) return setPr(Math.max(0.75, pr * 0.85));
    return null;
  }
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

  // lumière du moment de la journée (jour, crépuscule, soir)
  function setLight(L) {
    sun.color.setHex(L.sunColor); sun.intensity = L.sunInt;
    hemi.color.setHex(L.hemiSky); hemi.groundColor.setHex(L.hemiGround); hemi.intensity = L.hemiInt;
    renderer.toneMappingExposure = L.exposure;
  }
  let light = DAY;
  // construit le décor d'un trou en tâche de fond, par tranches de quelques millisecondes : le trou affiché reste
  // vivant (la caméra continue de voler) jusqu'à ce que le nouveau soit prêt, puis on bascule d'un coup. `swap` est
  // appelé juste avant la bascule (pour lancer un fondu depuis l'image du moment). Si un autre trou est demandé
  // entre-temps (on lance la partie pendant le survol de l'accueil), celui-ci est abandonné.
  let builds = 0;
  const STALE = {};
  async function loadHole(hole, { theme = 'campagne', wind, time = 'jour', swap } = {}) {
    const id = ++builds;
    let t0 = performance.now();
    const pace = async () => {
      if (performance.now() - t0 < 10) return;
      await breathe(); t0 = performance.now();
      if (disposed || id !== builds) throw STALE;
    };
    const T = TIMES[time], lt = T || DAY, sunDir = T ? new THREE.Vector3(...T.dir).normalize() : DAY_DIR.clone();
    const look = LOOKS[theme] || LOOKS.campagne, skyLook = skyFor(theme, time);
    const g = new THREE.Group();
    const center = { x: (hole.bounds.x0 + hole.bounds.x1) / 2, z: (hole.bounds.z0 + hole.bounds.z1) / 2 };
    let env = null, terrain, water, sky, grass, pin, grid;
    try {
      // ciel → environnement (reflets et lumière d'ambiance)
      sky = buildSky(skyLook, sunDir, noise);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene(); envScene.add(buildSky(skyLook, sunDir, noise));
      env = pmrem.fromScene(envScene, 0.02).texture;
      envScene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      pmrem.dispose();
      g.add(sky);
      const peaks = buildPeaks(skyLook, hole.def.seed, center, noise); if (peaks) g.add(peaks);
      await pace();
      terrain = await buildTerrain(hole, { look, noise, anisotropy: renderer.capabilities.getMaxAnisotropy(), step: MOBILE ? 2 : 1.5, pace });
      g.add(terrain.mesh);
      await pace();
      water = buildWater(hole, { noise, envMap: env, refl, sun: sunDir }); g.add(water.group);
      // arbres du parcours (la balle les heurte), forêt des collines, herbes hautes
      if (!treeKit) treeKit = createTreeKit();
      // les arbres loin du couloir de jeu sont plus sombres
      for (const t of hole.trees) t.dark = hole.landSD(t.x, t.z) < -3;
      // pied du tronc enfoncé dans la pente (jamais de tronc qui flotte)
      const sink = (list) => { for (const t of list) { let m = t.y; for (const [dx, dz] of [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]]) m = Math.min(m, hole.heightAt(t.x + dx, t.z + dz)); t.y = m - 0.05; } return list; };
      g.add(treeKit.plant(sink(hole.trees.map((t) => ({ ...t })))));
      await pace();
      g.add(treeKit.shades(hole));
      await pace();
      g.add(treeKit.plant(sink(forestItems(hole, { count: MOBILE ? 900 : 2600 })), { lo: true, shadows: false, dark: true }));
      await pace();
      grass = createGrass(hole, look, { mobile: MOBILE, sway: SWAY }); g.add(grass.group);
      pin = buildPin(hole); g.add(pin.group);
      g.add(buildTeeMarkers(hole));
      grid = buildGreenGrid(hole); g.add(grid.group);
      await pace();
      // premières dalles d'herbe autour du départ, quelques-unes à la fois
      const focus = new THREE.Vector3(hole.tee.x, 0, hole.tee.z + 10);
      for (let k = 0; k < 15; k++) { grass.update(focus, 4); await pace(); }
      // shaders compilés à l'avance (en parallèle), puis chaque morceau dessiné une fois hors écran : la première
      // vraie image du nouveau décor ne fige pas
      if (renderer.compileAsync) await renderer.compileAsync(g, camera, scene).catch(() => {});
      await warmUp(g, center, pace);
    } catch (e) {
      freeGroup(g); env && env.dispose(); grass && grass.dispose();
      if (e === STALE) return;
      throw e;
    }
    // bascule : l'ancien trou s'en va, le nouveau prend sa place (lumière, brume, ciel)
    swap && swap();
    if (world) unloadHole();
    light = lt; setLight(light); SUN_DIR.copy(sunDir);
    scene.environment = env; scene.environmentIntensity = light.env;
    // voile bleuté de la distance, le même pour tout (terrain, forêts, mer, sommets) : plus c'est loin, plus c'est bleu
    // (≈ 3 % à 300 m, 50 % à 1,5 km, 70 à 85 % pour les sommets à l'horizon)
    scene.fog = new THREE.FogExp2(skyLook.fog, 0.000555);
    scene.background = new THREE.Color(skyLook.horizon);
    scene.add(g);
    world = { group: g, hole, terrain, water, sky, pin, grid, env, wind, grass, noReflect: [grass.group, grid.group, water.group] };
    // décor Kenney : chargé une fois, semé à chaque trou
    if (!kitP) kitP = loadNature(new URL('../models/nature/', import.meta.url).href).catch(() => null);
    kitP.then((kit) => { if (!disposed && world && world.hole === hole && kit) world.group.add(scatterNature(hole, kit)); });
  }
  // préchauffage d'un décor neuf, morceau par morceau : chacun passe un instant sur un calque que seule une caméra
  // hors écran regarde (avec les vraies lumières), pour l'image normale et pour celle des reflets (plan de coupe)
  const WARM = 5, warmCam = new THREE.OrthographicCamera(-3200, 3200, 3200, -3200, 1, 9000);
  warmCam.layers.set(WARM); hemi.layers.enable(WARM); sun.layers.enable(WARM);
  let warmRT = null;
  async function warmUp(g, center, pace) {
    if (!warmRT) warmRT = new THREE.WebGLRenderTarget(8, 8);
    warmCam.position.set(center.x, 4000, center.z); warmCam.lookAt(center.x, 0, center.z); warmCam.updateMatrixWorld();
    for (const o of [...g.children]) {
      o.traverse((c) => c.layers.enable(WARM));
      scene.add(g);
      renderer.setRenderTarget(warmRT);
      renderer.render(scene, warmCam);
      renderer.clippingPlanes = [clipPlane]; renderer.shadowMap.autoUpdate = false;
      renderer.render(scene, warmCam);
      renderer.clippingPlanes = []; renderer.shadowMap.autoUpdate = true;
      renderer.setRenderTarget(null);
      scene.remove(g);
      o.traverse((c) => c.layers.disable(WARM));
      await pace();
    }
  }
  function unloadHole() {
    if (!world) return;
    scene.remove(world.group);
    world.grass.dispose();
    if (world.relief) { world.relief.mat.dispose(); world.relief.water.dispose(); }
    freeGroup(world.group);
    world.env.dispose();
    world = null;
  }
  function freeGroup(group) {
    group.traverse((o) => {
      if (o.isMesh || o.isPoints || o.isInstancedMesh || o.isLineSegments) {
        // les géométries et matériaux partagés (arbres, décor Kenney) sont libérés par leur kit
        if (o.userData.shared) return;
        o.geometry.dispose();
        for (const t of o.userData.textures || []) t.dispose();
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) { m.map && m.map !== noise && m.map.dispose(); m.dispose(); }
      }
    });
  }

  // ---------------------------------------------------------------- mini-carte : photo aérienne du trou
  // caméra orthographique au-dessus du trou, green en haut ; sans brume, ombres sur tout le trou
  // mini-carte : le trou vu du dessus dans le cadre f, à l'échelle `scale` (plus fin, pour zoomer sans flou).
  // relief : seuls le terrain (teintes d'altitude, courbes de niveau) et l'eau en aplat, les arbres en pastilles
  function renderMap(f, { relief = false, scale = 1 } = {}) {
    if (!world) return null;
    const hole = world.hole, W = Math.round(f.W * scale), H = Math.round(f.H * scale), gy = hole.heightAt(f.cx, f.cz);
    const oc = new THREE.OrthographicCamera(-f.wm / 2, f.wm / 2, f.hm / 2, -f.hm / 2, 1, 4000);
    oc.position.set(f.cx, gy + 1500, f.cz); oc.up.set(f.dx, 0, f.dz); oc.lookAt(f.cx, gy, f.cz); oc.updateMatrixWorld();
    const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
    const dyn = [ball, blob, others, trail, marker, dotsMesh, tee, ...[...golfers].map((g) => g.root)];
    const hide = (relief ? [...dyn, ...world.group.children.filter((o) => o !== world.terrain.mesh && o !== world.water.group)]
      : [...dyn, world.grass.group, world.grid.group, world.sky, world.pin.group]).filter((o) => o.visible);
    for (const o of hide) o.visible = false;
    const fog = scene.fog; scene.fog = null;
    const sc = sun.shadow.camera, saved = { l: sc.left, r: sc.right, t: sc.top, b: sc.bottom, far: sc.far, p: sun.position.clone(), q: sun.target.position.clone() };
    const swapped = [];
    if (relief) {
      // altitudes du cadre, pour étaler les teintes et choisir l'écart entre deux courbes
      let h0 = Infinity, h1 = -Infinity;
      for (let j = 0; j <= 40; j++) for (let i = 0; i <= 30; i++) {
        const u = (i / 30 - 0.5) * f.wm, v = (j / 40 - 0.5) * f.hm, x = f.cx + u * f.rx + v * f.dx, z = f.cz + u * f.rz + v * f.dz, h = hole.heightAt(x, z);
        if (!hole.coast || h > hole.coast.level) { h0 = Math.min(h0, h); h1 = Math.max(h1, h); }
      }
      const step = [0.5, 1, 2, 5, 10].find((k) => (h1 - h0) / k <= 28) || 20;
      // lumière venue du haut à gauche de la carte, comme sur les cartes topographiques
      const lx = f.dx - f.rx, lz = f.dz - f.rz, ll = Math.hypot(lx, lz) || 1;
      const light = new THREE.Vector3(lx / ll * 0.7, 0.75, lz / ll * 0.7).normalize();
      if (!world.relief) world.relief = { mat: reliefMaterial(world.terrain.uniforms, { hMin: h0, hMax: h1, step, light }), water: new THREE.MeshBasicMaterial({ color: 0x5ba8da }), step };
      swapped.push([world.terrain.mesh, world.terrain.mesh.material]); world.terrain.mesh.material = world.relief.mat;
      world.water.group.traverse((o) => { if (o.isMesh) { swapped.push([o, o.material]); o.material = world.relief.water; } });
    } else {
      const half = Math.max(f.wm, f.hm) * 0.6;
      Object.assign(sc, { left: -half, right: half, top: half, bottom: -half, far: 2400 }); sc.updateProjectionMatrix();
      sun.target.position.set(f.cx, gy, f.cz); sun.position.set(f.cx + SUN_DIR.x * 900, gy + SUN_DIR.y * 900, f.cz + SUN_DIR.z * 900);
    }
    world.water.setReflect(null);
    // la carte reste lisible le soir : on l'éclaire comme en plein jour
    setLight(DAY);
    renderer.setRenderTarget(rt); renderer.render(scene, oc);
    setLight(light);
    const buf = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    renderer.setRenderTarget(null);
    for (const [o, m] of swapped) o.material = m;
    Object.assign(sc, { left: saved.l, right: saved.r, top: saved.t, bottom: saved.b, far: saved.far }); sc.updateProjectionMatrix();
    sun.position.copy(saved.p); sun.target.position.copy(saved.q);
    scene.fog = fog;
    for (const o of hide) o.visible = true;
    rt.dispose();
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    g.putImageData(img, 0, 0);
    if (relief) {
      // arbres du parcours : pastilles vert sombre, cernées de clair
      const s = (W / f.W) * f.s, at = (x, z) => { const px = x - f.cx, pz = z - f.cz; return [W / 2 + (px * f.rx + pz * f.rz) * s, H / 2 - (px * f.dx + pz * f.dz) * s]; };
      g.fillStyle = 'rgba(38,74,40,0.82)'; g.strokeStyle = 'rgba(240,248,228,0.55)'; g.lineWidth = Math.max(1, s * 0.25);
      for (const t of hole.trees) { const [x, y] = at(t.x, t.z), r = Math.max(1.5, t.r * 0.75 * s); if (x < -r || y < -r || x > W + r || y > H + r) continue; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke(); }
      cv.contourStep = world.relief.step;
    } else {
      // léger contraste, comme une photo aérienne
      g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
    }
    return cv;
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
    if (post) post.setSize(Math.round(w * pr), Math.round(h * pr));
  }
  resize();
  addEventListener('resize', resize);

  // rendu miroir pour le plan d'eau le plus proche de ce que regarde la caméra
  function renderReflection() {
    if (!world || !quality.refl) { world && world.water.setReflect(null); return; }
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

  let T = 0, frameNo = 0, shadowHalf = 50;
  function frame(dt) {
    if (disposed) return;
    T += dt;
    const a = 1 - Math.exp(-cam.k * dt);
    cam.pos.lerp(cam.tPos, a); cam.look.lerp(cam.tLook, a);
    // ne jamais passer sous le terrain
    if (world) { const gy = world.hole.heightAt(cam.pos.x, cam.pos.z) + 0.6; if (cam.pos.y < gy) cam.pos.y = gy; }
    camera.position.copy(cam.pos); camera.lookAt(cam.look);
    // l'ombre du soleil couvre ce qui est devant la caméra (pas le point visé, qui peut être très loin pendant un
    // survol) ; plus la caméra est haute, plus la zone d'ombre est grande
    const gy0 = world ? world.hole.heightAt(cam.pos.x, cam.pos.z) : 0, high = Math.max(0, cam.pos.y - gy0);
    const ax = cam.look.x - cam.pos.x, az = cam.look.z - cam.pos.z, al = Math.hypot(ax, az) || 1;
    const ahead = Math.min(al * 0.6, 34 + high * 0.8);
    const fx = cam.pos.x + ax / al * ahead, fz = cam.pos.z + az / al * ahead;
    const half = Math.round(Math.min(95, Math.max(50, 44 + high * 1.6)));
    if (half !== shadowHalf) { shadowHalf = half; Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half }); sun.shadow.camera.updateProjectionMatrix(); }
    sun.target.position.set(fx, 0, fz);
    sun.position.set(fx + SUN_DIR.x * 120, SUN_DIR.y * 120 + (world ? world.hole.heightAt(fx, fz) : 0), fz + SUN_DIR.z * 120);
    SWAY.uT.value = T;
    if (world) {
      SWAY.uWind.value = Math.min(1, (world.wind?.speed || 0) / 7);
      world.water.update(T);
      world.sky.userData.update(T, world.wind);
      world.pin.update(T, world.wind);
      world.grid.update(T);
      // l'herbe 3D suit ce que regarde la caméra (entre la caméra et sa cible)
      if (quality.grass) { tmp.copy(cam.pos).lerp(cam.look, 0.35); world.grass.update(tmp, 2); }
      world.grass.group.visible = quality.grass;
      const ms = marker.userData.size || 1, pulse = 1 + Math.sin(T * 4) * 0.06;
      ring.scale.setScalar(ms * pulse); dot.scale.setScalar(ms); beam.scale.set(ms, 1 + ms * 0.3, ms);
    }
    for (const g of golfers) g.update(dt);
    // le reflet de l'eau n'est recalculé qu'une image sur deux (il bouge lentement)
    if ((frameNo++ & 1) === 0 || !quality.refl) renderReflection();
    if (post) { post.q.ao = quality.ao; post.q.bloom = quality.bloom; post.render(scene, camera, T); }
    else { renderer.setRenderTarget(null); renderer.render(scene, camera); }
    if (fade.left > 0) {
      fade.left = Math.max(0, fade.left - dt);
      const t = 1 - fade.left / fade.dur;
      fade.a = 1 - t * t * (3 - 2 * t);
      xf.style.opacity = fade.a;
      if (!fade.left) xf.style.display = 'none';
    }
  }
  // à appeler juste avant de changer de plan : l'image actuelle s'efface en dur secondes au-dessus de la nouvelle.
  // Si un fondu est déjà en cours, on part de ce qu'on voit (les deux images mêlées), sans saut.
  function dissolve(dur = 0.6) {
    if (disposed) return;
    frame(0); // l'image actuelle, lue tant qu'elle est encore dans le tampon
    const W = canvas.width, H = canvas.height;
    if (fade.a > 0.01 && xf.width === W && xf.height === H) {
      xctx.globalCompositeOperation = 'destination-in';
      xctx.fillStyle = `rgba(0,0,0,${fade.a})`; xctx.fillRect(0, 0, W, H);
      xctx.globalCompositeOperation = 'destination-over';
      xctx.drawImage(canvas, 0, 0);
      xctx.globalCompositeOperation = 'source-over';
    } else {
      if (xf.width !== W || xf.height !== H) { xf.width = W; xf.height = H; }
      xctx.drawImage(canvas, 0, 0);
    }
    Object.assign(fade, { a: 1, left: dur, dur });
    xf.style.opacity = 1; xf.style.display = 'block';
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
    noise.dispose(); reflRT.dispose(); warmRT && warmRT.dispose(); post && post.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove(); xf.remove();
  }

  return {
    renderer, scene, camera, MOBILE, quality, lowerQuality,
    loadHole, renderMap, setBall, setOthers, setMarker, setAimDots, trailPush, trailClear, trailFade, camTo, cam, frame, dissolve, project, dispose, addGolfer, removeGolfer,
    get hole() { return world && world.hole; },
    setWind(w) { if (world) world.wind = w; },
    showBall(on) { ball.visible = on; blob.visible = on; },
    setTee(b, on) { tee.visible = on; if (on) tee.position.set(b.x, b.y - 0.021, b.z); },
    showPole(on) { world && world.pin.showPole(on); },
    showGrid(on) { if (world) world.grid.group.visible = on; },
  };
}
