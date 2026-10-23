// Convoy Storm — scène 3D (Three.js r169 embarqué, sans fichier externe : primitives low-poly uniquement).
// La scène vit dans le repère du train : le convoi reste à l'origine, la plaine et les ruines défilent vers +Z.
// createScene() monte le canevas ; dispose() libère tout (géométries, matériaux, textures, contexte WebGL, écouteurs).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { DECK_Y, HALF_W, REAR, BODY_FRONT, BOILER, DECK_BOXES, WAGONS, CHUNK, piecePos } from '../engine/world.js';
import { Ruins, DIFFICULTY } from '../engine/sim.js';
import { hash, makeRng } from '../engine/rng.js';

// Caméra isométrique : décalage fixe par rapport au point suivi. CAM_DIR sert à l'entrée (haut de l'écran = CAM_DIR).
const CAM_OFF = new THREE.Vector3(11, 17, 15);
export const CAM_DIR = (() => { const l = Math.hypot(CAM_OFF.x, CAM_OFF.z); return { x: -CAM_OFF.x / l, z: -CAM_OFF.z / l }; })();
const FOG = 0xc3ced9;

export function createScene(host, { onLost } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.Fog(FOG, 14, 56);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 220);

  // ---------------------------------------------------------------- ressources partagées (libérées dans dispose)
  const owned = { geo: new Set(), mat: new Set(), tex: new Set() };
  const G = (g) => (owned.geo.add(g), g);
  const M = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, flatShading: true, ...o }); owned.mat.add(m); return m; };
  const mesh = (geo, mat, cast = true, recv = true) => { const me = new THREE.Mesh(geo, mat); me.castShadow = cast; me.receiveShadow = recv; return me; };
  const MAT = {
    steel: M(0x4b525c, { metalness: 0.45, roughness: 0.55 }), dark: M(0x262a31, { metalness: 0.3 }), plate: M(0x6a5a48, { roughness: 0.95 }),
    rust: M(0x8a4b2e), red: M(0xb3362a), snow: M(0xf4f7fb, { roughness: 1 }), stone: M(0x8d8a86), concrete: M(0xa4a6a4), roof: M(0x5d4a3c),
    metal: M(0x5c6168, { metalness: 0.4 }), wood: M(0x7b5a3a), crate: M(0xc0821f), stripe: M(0x1d1f23), glow: M(0xff8a2a, { emissive: 0xff6a10, emissiveIntensity: 2.2 }),
    lamp: M(0xfff1c4, { emissive: 0xffe2a0, emissiveIntensity: 2 }), redLamp: M(0xff3b2f, { emissive: 0xff2010, emissiveIntensity: 2 }),
    skin: M(0xe6b796), loot: M(0xffd34d, { emissive: 0xffb020, emissiveIntensity: 1.6 }), coal: M(0x18191c),
  };
  const GEO = {
    box: G(new THREE.BoxGeometry(1, 1, 1)), cyl6: G(new THREE.CylinderGeometry(1, 1, 1, 6)), cyl10: G(new THREE.CylinderGeometry(1, 1, 1, 10)),
    wheel: G(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 10).rotateZ(Math.PI / 2)), head: G(new THREE.IcosahedronGeometry(0.24, 1)),
    mound: G(new THREE.IcosahedronGeometry(1, 0)), crate: G(new THREE.BoxGeometry(0.5, 0.5, 0.5)), cone: G(new THREE.ConeGeometry(0.32, 0.4, 6)),
  };
  const box = (w, h, d, mat, cast = true) => { const m = mesh(GEO.box, mat, cast); m.scale.set(w, h, d); return m; };

  // ---------------------------------------------------------------- lumières
  scene.add(new THREE.HemisphereLight(0xe2ebf5, 0x5f6b78, 1.05));
  const sun = new THREE.DirectionalLight(0xfff4e6, 1.35);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---------------------------------------------------------------- sol enneigé (texture dessinée en canevas)
  const snowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#eef2f7'; x.fillRect(0, 0, 256, 256);
    const r = makeRng(7);
    for (let i = 0; i < 900; i++) { const v = 220 + r.int(0, 30); x.fillStyle = `rgba(${v - 12},${v - 4},${v},${r.range(0.15, 0.5)})`; x.beginPath(); x.ellipse(r.range(0, 256), r.range(0, 256), r.range(2, 14), r.range(1, 4), r.range(0, 3), 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(36, 36); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    owned.tex.add(t); return t;
  })();
  const ground = mesh(G(new THREE.PlaneGeometry(360, 360)), M(0xffffff, { map: snowTex, roughness: 1, flatShading: false }), false, true);
  ground.rotation.x = -Math.PI / 2; scene.add(ground);

  // voie : ballast, rails, traverses (instanciées, recyclées en boucle)
  const track = new THREE.Group(); scene.add(track);
  const ballast = box(4.2, 0.12, 360, M(0x6f6a66), false); ballast.position.y = 0.06; ballast.receiveShadow = true; track.add(ballast);
  for (const sx of [-0.75, 0.75]) { const r = box(0.12, 0.16, 360, MAT.steel, false); r.position.set(sx, 0.26, 0); track.add(r); }
  const SLEEPERS = 200, SP = 1.2;
  const sleepers = new THREE.InstancedMesh(GEO.box, MAT.wood, SLEEPERS); sleepers.receiveShadow = true; track.add(sleepers);
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(2.4, 0.12, 0.28), tmpP = new THREE.Vector3();

  // ---------------------------------------------------------------- le convoi
  const train = new THREE.Group(); scene.add(train);
  const wheels = [];
  WAGONS.forEach(([z0, z1], wi) => {
    const len = z1 - z0, zc = (z0 + z1) / 2;
    const chassis = box(HALF_W * 2 - 0.2, 0.7, len - 0.2, MAT.dark); chassis.position.set(0, 0.85, zc); train.add(chassis);
    const deck = box(HALF_W * 2, 0.16, wi === 0 ? z1 - (-12.9) : len, MAT.plate); deck.position.set(0, DECK_Y - 0.08, wi === 0 ? (z1 + -12.9) / 2 : zc); train.add(deck);
    // jupes blindées, légèrement inclinées
    for (const s of [-1, 1]) { const sk = box(0.12, 0.85, len - 0.6, MAT.steel); sk.position.set(s * (HALF_W + 0.02), 1.0, zc); sk.rotation.z = s * 0.12; train.add(sk); }
    for (let i = 0; i < 2; i++) for (const s of [-1, 1]) {
      const w = mesh(GEO.wheel, MAT.dark); w.position.set(s * 1.2, 0.48, z0 + 1.6 + i * (len - 3.2)); train.add(w); wheels.push(w);
    }
  });
  // passerelles entre les wagons
  for (const zc of [-5.8, 5.8]) { const pl = box(1.6, 0.1, 1.0, MAT.steel); pl.position.set(0, DECK_Y - 0.06, zc); train.add(pl); }
  // locomotive : corps chaudière horizontal, cabine, chasse-neige, phare
  const lbody = mesh(GEO.cyl10, MAT.steel); lbody.scale.set(1.25, 6.2, 1.25); lbody.rotation.x = Math.PI / 2; lbody.position.set(0, DECK_Y + 1.15, -16.4); train.add(lbody);
  const cab = box(2.4, 2.4, 3.4, MAT.red); cab.position.set(0, DECK_Y + 1.2, -11.5); train.add(cab);
  const cabRoof = box(2.9, 0.18, 3.9, MAT.dark); cabRoof.position.set(0, DECK_Y + 2.5, -11.5); train.add(cabRoof);
  for (const s of [-1, 1]) { const win = box(0.05, 0.6, 1.4, MAT.lamp, false); win.position.set(s * 1.22, DECK_Y + 1.7, -11.5); train.add(win); }
  const stack = mesh(GEO.cyl10, MAT.dark); stack.scale.set(0.32, 1.2, 0.32); stack.position.set(0, DECK_Y + 2.3, -17.6); train.add(stack);
  for (const s of [-1, 1]) { const pw = box(2.6, 1.4, 0.18, MAT.steel); pw.position.set(s * 0.95, 0.75, -19.0); pw.rotation.y = s * 0.62; train.add(pw); }
  const head = mesh(GEO.cyl10, MAT.lamp, false); head.scale.set(0.28, 0.2, 0.28); head.rotation.x = Math.PI / 2; head.position.set(0, DECK_Y + 1.15, -19.55); train.add(head);
  const beam = new THREE.SpotLight(0xffe7b0, 45, 40, 0.42, 0.6, 1.4); beam.position.set(0, DECK_Y + 1.2, -19.6); beam.target.position.set(0, 0, -40); train.add(beam, beam.target);
  // la chaudière au centre : foyer rougeoyant, cheminée, manomètre
  const boiler = mesh(GEO.cyl10, MAT.steel); boiler.scale.set(BOILER.r, BOILER.top - DECK_Y, BOILER.r); boiler.position.set(0, (BOILER.top + DECK_Y) / 2, 0); train.add(boiler);
  for (const y of [0.4, 1.1, 1.8]) { const band = mesh(GEO.cyl10, MAT.dark); band.scale.set(BOILER.r + 0.04, 0.1, BOILER.r + 0.04); band.position.set(0, DECK_Y + y, 0); train.add(band); }
  const mouthRim = mesh(G(new THREE.TorusGeometry(BOILER.mouth, 0.12, 6, 14)), MAT.dark); mouthRim.rotation.x = Math.PI / 2; mouthRim.position.set(0, BOILER.top + 0.02, 0); train.add(mouthRim);
  const fireMat = M(0xff7a1a, { emissive: 0xff5a00, emissiveIntensity: 2.5 });
  const fire = mesh(G(new THREE.CircleGeometry(BOILER.mouth - 0.05, 12)), fireMat, false, false); fire.rotation.x = -Math.PI / 2; fire.position.set(0, BOILER.top - 0.05, 0); train.add(fire);
  const door = box(0.7, 0.6, 0.06, fireMat, false); door.position.set(0, DECK_Y + 0.55, BOILER.r + 0.02); train.add(door);
  const chim = mesh(GEO.cyl10, MAT.dark); chim.scale.set(0.28, 1.6, 0.28); chim.position.set(0.75, BOILER.top + 0.5, -0.5); train.add(chim);
  const fireLight = new THREE.PointLight(0xff7a2a, 30, 14, 1.6); fireLight.position.set(0, BOILER.top + 0.6, 0); train.add(fireLight);
  // obstacles du plancher
  DECK_BOXES.slice(1).forEach((b, i) => { const o = box(b.x1 - b.x0, i === 0 ? 0.9 : 0.6, b.z1 - b.z0, i === 0 ? MAT.rust : MAT.metal); o.position.set((b.x0 + b.x1) / 2, DECK_Y + (i === 0 ? 0.45 : 0.3), (b.z0 + b.z1) / 2); train.add(o);
    if (i === 0) { const coal = box(b.x1 - b.x0 - 0.2, 0.1, b.z1 - b.z0 - 0.2, MAT.coal, false); coal.position.set(o.position.x, DECK_Y + 0.82, o.position.z); train.add(coal); } });
  // échelle de queue et feux rouges
  for (const s of [-0.55, 0.55]) { const rl = box(0.08, DECK_Y + 0.6, 0.08, MAT.steel); rl.position.set(s, (DECK_Y + 0.6) / 2, REAR + 0.12); train.add(rl);
    const lamp = mesh(GEO.head, MAT.redLamp, false); lamp.scale.setScalar(0.5); lamp.position.set(s * 2.6, DECK_Y + 0.25, REAR + 0.05); train.add(lamp); }
  for (let i = 0; i < 4; i++) { const rg = box(1.1, 0.06, 0.06, MAT.steel); rg.position.set(0, 0.35 + i * 0.38, REAR + 0.14); train.add(rg); }

  // tache ronde et douce pour la fumée et les flocons (sinon les points sont des carrés)
  const puffTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); owned.tex.add(t); return t;
  })();
  // fumée de la cheminée (particules recyclées)
  const SMOKE = 70;
  const smokeGeo = G(new THREE.BufferGeometry()); const smokePos = new Float32Array(SMOKE * 3); const smokeAge = new Float32Array(SMOKE);
  for (let i = 0; i < SMOKE; i++) smokeAge[i] = i / SMOKE * 3;
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  const smokeMat = new THREE.PointsMaterial({ color: 0x55585e, size: 2.2, map: puffTex, transparent: true, opacity: 0.55, depthWrite: false }); owned.mat.add(smokeMat);
  const smoke = new THREE.Points(smokeGeo, smokeMat); smoke.frustumCulled = false; scene.add(smoke);

  // blizzard
  const SNOW = 2600, BOX = { x: 46, y: 16, z: 46 };
  const flakeGeo = G(new THREE.BufferGeometry()); const flakes = new Float32Array(SNOW * 3); const fr = makeRng(99);
  for (let i = 0; i < SNOW; i++) { flakes[i * 3] = fr.range(-BOX.x / 2, BOX.x / 2); flakes[i * 3 + 1] = fr.range(0, BOX.y); flakes[i * 3 + 2] = fr.range(-BOX.z / 2, BOX.z / 2); }
  flakeGeo.setAttribute('position', new THREE.BufferAttribute(flakes, 3));
  const flakeMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, map: puffTex, transparent: true, opacity: 0.95, depthWrite: false, fog: false }); owned.mat.add(flakeMat);
  const snow = new THREE.Points(flakeGeo, flakeMat); snow.frustumCulled = false; scene.add(snow);

  // ---------------------------------------------------------------- ruines (construites à la demande, recyclées)
  let ruins = null; const ruinMeshes = new Map(); const ruinsGroup = new THREE.Group(); scene.add(ruinsGroup);
  function buildRuin(r) {
    const g = new THREE.Group();
    for (const pc of r.pieces) {
      const p = piecePos(r, pc);
      const m = box(pc.w, pc.h, pc.d, MAT[pc.m] || MAT.stone);
      m.position.set(p.x, pc.h / 2, p.zw); m.rotation.y = -p.rot; g.add(m);
      if (pc.h > 0.6) { const cap = box(pc.w + 0.05, 0.14, pc.d + 0.05, MAT.snow, false); cap.position.set(p.x, pc.h + 0.06, p.zw); cap.rotation.y = -p.rot; g.add(cap); }
    }
    const rr = makeRng(r.seed);
    for (let i = 0; i < 3; i++) { const m = mesh(GEO.mound, MAT.snow, false); m.scale.set(rr.range(0.8, 2.2), rr.range(0.3, 0.7), rr.range(0.8, 2.0)); m.position.set(r.x + rr.range(-4, 4), 0, r.zw + rr.range(-4, 4)); g.add(m); }
    // lanterne du point de fouille (éteinte une fois fouillée)
    const post = box(0.08, 1.2, 0.08, MAT.dark); post.position.set(r.spot.x, 0.6, r.spot.zw); g.add(post);
    const lan = mesh(GEO.head, MAT.loot, false); lan.scale.setScalar(0.7); lan.position.set(r.spot.x, 1.3, r.spot.zw); g.add(lan);
    g.userData = { lan, id: r.id };
    return g;
  }
  // monticules de neige décoratifs par tronçon
  const moundGroups = new Map();
  function buildMounds(seed, k) {
    const g = new THREE.Group(); const rr = makeRng(hash(seed * 31 + k));
    for (let i = 0; i < 7; i++) {
      const m = mesh(GEO.mound, MAT.snow, false); const side = rr.chance(0.5) ? -1 : 1;
      m.scale.set(rr.range(1, 4), rr.range(0.25, 0.9), rr.range(1, 3.5)); m.rotation.y = rr.range(0, 3);
      m.position.set(side * rr.range(3.5, 34), -0.05, -k * CHUNK - rr.range(0, CHUNK)); g.add(m);
    }
    if (rr.chance(0.5)) { // poteau télégraphique penché
      const p = box(0.18, 4.5, 0.18, MAT.wood); p.position.set((rr.chance(0.5) ? -1 : 1) * 4.2, 2.1, -k * CHUNK - rr.range(0, CHUNK)); p.rotation.z = rr.range(-0.25, 0.25); g.add(p);
    }
    return g;
  }

  // ---------------------------------------------------------------- joueurs et caisses
  const players = new Map();
  function labelTex(name, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.font = '700 30px "Chakra Petch", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const w = Math.min(240, x.measureText(name).width + 28);
    x.fillStyle = 'rgba(14,16,20,.78)'; x.beginPath(); x.roundRect(128 - w / 2, 10, w, 44, 12); x.fill();
    x.fillStyle = color; x.fillRect(128 - w / 2 + 8, 26, 8, 12);
    x.fillStyle = '#fff'; x.fillText(name, 136, 33);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function buildPlayer(p) {
    const g = new THREE.Group();
    const col = M(new THREE.Color(p.color).getHex(), { roughness: 0.8 });
    const dark = M(new THREE.Color(p.color).multiplyScalar(0.45).getHex());
    const body = mesh(GEO.cyl6, col); body.scale.set(0.34, 0.62, 0.3); body.position.y = 0.95; g.add(body);
    const legs = [-0.13, 0.13].map((x) => { const l = box(0.15, 0.55, 0.17, dark); l.position.set(x, 0.38, 0); g.add(l); return l; });
    const arms = [-0.4, 0.4].map((x) => { const a = box(0.13, 0.5, 0.14, col); a.position.set(x, 1.0, 0); g.add(a); return a; });
    const headM = mesh(GEO.head, MAT.skin); headM.position.y = 1.5; g.add(headM);
    const hood = mesh(GEO.cone, dark); hood.position.y = 1.72; hood.scale.set(1, 0.9, 1); g.add(hood);
    const scarf = box(0.42, 0.1, 0.36, MAT.red); scarf.position.y = 1.3; g.add(scarf);
    const pack = box(0.4, 0.45, 0.2, dark); pack.position.set(0, 1.0, -0.24); g.add(pack);
    const goggles = box(0.3, 0.08, 0.05, MAT.dark); goggles.position.set(0, 1.53, 0.22); g.add(goggles);
    const crate = makeCrate(); crate.position.set(0, 2.15, 0.05); crate.visible = false; g.add(crate);
    const tex = labelTex(p.name, p.color);
    const labMat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const label = new THREE.Sprite(labMat); label.scale.set(2.4, 0.6, 1); label.position.y = 2.8; label.renderOrder = 10; g.add(label);
    scene.add(g);
    return { g, legs, arms, crate, label, own: [col, dark, tex, labMat], walk: 0, name: p.name, color: p.color };
  }
  function makeCrate() {
    const g = new THREE.Group();
    const b = mesh(GEO.crate, MAT.crate); g.add(b);
    const s = mesh(GEO.crate, MAT.stripe, false); s.scale.set(1.02, 0.18, 1.02); g.add(s);
    const s2 = mesh(GEO.crate, MAT.stripe, false); s2.scale.set(0.18, 1.02, 1.03); g.add(s2);
    return g;
  }
  const crates = new Map();

  // ---------------------------------------------------------------- dimensionnement
  let W = 1, H = 1;
  const ro = new ResizeObserver(() => resize()); ro.observe(host);
  function resize() {
    W = Math.max(1, host.clientWidth); H = Math.max(1, host.clientHeight);
    renderer.setSize(W, H, false); camera.aspect = W / H;
    camera.fov = W / H < 0.8 ? 52 : 38; // portrait : on recule un peu
    camera.updateProjectionMatrix();
  }
  resize();
  const onCtxLost = (e) => { e.preventDefault(); onLost && onLost(); };
  canvas.addEventListener('webglcontextlost', onCtxLost);

  // ---------------------------------------------------------------- image
  const focus = new THREE.Vector3(0, 0, 0);
  let camInit = false, wheelA = 0, lastSeed = null, lastDiff = null, shake = 0;
  const v3 = new THREE.Vector3();

  function frame(view, dt) {
    if (view.seed !== lastSeed || view.diff !== lastDiff) {
      reset(); lastSeed = view.seed; lastDiff = view.diff;
      ruins = new Ruins(view.seed, DIFFICULTY[view.diff]?.loot ?? 0.6);
      const bl = view.diff === 'blizzard';
      scene.fog.near = bl ? 9 : 14; scene.fog.far = bl ? 42 : 56; flakeMat.size = bl ? 0.26 : 0.2;
    }
    const dist = view.dist;
    // caméra : suit le joueur local (ou le convoi), avec un peu d'avance dans le sens de la marche
    const fx = view.focus.x, fz = view.focus.z;
    if (!camInit) { focus.set(fx, 0, fz); camInit = true; }
    focus.x += (fx - focus.x) * Math.min(1, dt * 4); focus.z += (fz - focus.z) * Math.min(1, dt * 4);
    shake = Math.max(0, shake - dt * 2);
    camera.position.copy(focus).add(CAM_OFF);
    if (shake > 0) camera.position.add(v3.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
    camera.lookAt(focus.x, 0.8, focus.z - 1.5);
    sun.position.set(focus.x - 9, 24, focus.z + 7); sun.target.position.set(focus.x, 0, focus.z);
    ground.position.set(Math.round(focus.x / 10) * 10, 0, Math.round(focus.z / 10) * 10);
    snowTex.offset.set(ground.position.x / 10, (dist - ground.position.z) / 10 % 1);

    // voie
    const zb = focus.z;
    for (let i = 0; i < SLEEPERS; i++) {
      const L = SLEEPERS * SP;
      const z = (((i * SP + dist - zb) % L) + L) % L - L / 2 + zb;
      tmpP.set(0, 0.15, z); tmpM.compose(tmpP, tmpQ, tmpS); sleepers.setMatrixAt(i, tmpM);
    }
    sleepers.instanceMatrix.needsUpdate = true;

    // roues et secousses du train
    wheelA += (view.speed / 0.42) * dt; for (const w of wheels) w.rotation.x = -wheelA;
    train.position.y = view.speed > 0.1 ? Math.sin(view.t * 9) * 0.015 * view.speed : 0;

    // chaudière : feu et lumière selon le carburant
    const f = view.fuel / 100, flick = 0.85 + Math.sin(view.t * 23) * 0.08 + Math.sin(view.t * 7.3) * 0.07;
    fireMat.emissiveIntensity = (0.3 + 2.6 * f) * flick;
    fireLight.intensity = (4 + 34 * f) * flick;
    fire.scale.setScalar(0.4 + 0.6 * Math.min(1, f * 1.6));
    beam.intensity = view.speed > 0.05 ? 45 : 18;

    // fumée : sort de la cheminée, file vers l'arrière
    for (let i = 0; i < SMOKE; i++) {
      smokeAge[i] += dt * (0.6 + f);
      if (smokeAge[i] > 3) smokeAge[i] -= 3;
      const a = smokeAge[i];
      smokePos[i * 3] = 0.75 + Math.sin(i * 1.7 + a) * 0.3 * a + a * 1.1;
      smokePos[i * 3 + 1] = BOILER.top + 1.3 + a * 1.4;
      smokePos[i * 3 + 2] = -0.5 + a * (1.5 + view.speed * 1.2);
    }
    smokeGeo.attributes.position.needsUpdate = true;
    smokeMat.opacity = 0.15 + 0.45 * f;

    // blizzard : vent latéral, le sol défile
    const wx = 7, wy = -3.2, wz = 3 + view.speed;
    for (let i = 0; i < SNOW; i++) {
      let x = flakes[i * 3] + (wx + Math.sin(i + view.t * 2) * 1.5) * dt, y = flakes[i * 3 + 1] + wy * dt, z = flakes[i * 3 + 2] + wz * dt;
      if (y < 0) y += BOX.y;
      flakes[i * 3] = x; flakes[i * 3 + 1] = y; flakes[i * 3 + 2] = z;
    }
    flakeGeo.attributes.position.needsUpdate = true;
    // enroule les flocons autour du point suivi (sans les recréer)
    for (let i = 0; i < SNOW; i++) {
      const dx = flakes[i * 3] - focus.x, dz = flakes[i * 3 + 2] - focus.z;
      if (dx > BOX.x / 2) flakes[i * 3] -= BOX.x; else if (dx < -BOX.x / 2) flakes[i * 3] += BOX.x;
      if (dz > BOX.z / 2) flakes[i * 3 + 2] -= BOX.z; else if (dz < -BOX.z / 2) flakes[i * 3 + 2] += BOX.z;
    }

    // ruines et monticules du voisinage (repère du sol → décalage de dist)
    ruinsGroup.position.z = dist;
    const live = new Set(), liveK = new Set();
    for (const [k, c] of ruins.around(dist)) {
      liveK.add(k);
      if (!moundGroups.has(k)) { const g = buildMounds(view.seed, k); moundGroups.set(k, g); ruinsGroup.add(g); }
      for (const r of c.ruins) {
        live.add(r.id);
        let g = ruinMeshes.get(r.id);
        if (!g) { g = buildRuin(r); ruinMeshes.set(r.id, g); ruinsGroup.add(g); }
        const on = !view.looted.has(r.id);
        g.userData.lan.visible = on;
        if (on) g.userData.lan.scale.setScalar(0.6 + Math.sin(view.t * 4 + r.id) * 0.12);
      }
    }
    for (const [id, g] of ruinMeshes) if (!live.has(id)) { ruinsGroup.remove(g); ruinMeshes.delete(id); }
    for (const [k, g] of moundGroups) if (!liveK.has(k)) { ruinsGroup.remove(g); moundGroups.delete(k); }

    // caisses
    const seen = new Set();
    for (const c of view.crates) {
      seen.add(c.id);
      let m = crates.get(c.id);
      if (!m) { m = makeCrate(); crates.set(c.id, m); scene.add(m); }
      m.position.set(c.x, c.y, c.m === 0 ? c.z + dist : c.z);
      m.rotation.y = (c.id * 0.7) % 3; if (c.m === 2) m.rotation.x += dt * 8;
    }
    for (const [id, m] of crates) if (!seen.has(id)) { scene.remove(m); crates.delete(id); }

    // joueurs
    const seenP = new Set();
    for (const p of view.players) {
      seenP.add(p.id);
      let o = players.get(p.id);
      if (o && (o.name !== p.name || o.color !== p.color)) { dropPlayer(p.id); o = null; }
      if (!o) { o = buildPlayer(p); players.set(p.id, o); }
      o.g.visible = p.st !== 3;
      o.g.position.set(p.x, p.y, p.z);
      o.g.rotation.y = p.yaw;
      const sp = Math.hypot(p.vx, p.vz);
      o.walk += sp * dt * 2.4;
      const sw = p.air ? 0.6 : Math.sin(o.walk) * Math.min(1, sp / 3) * 0.7;
      o.legs[0].rotation.x = sw; o.legs[1].rotation.x = -sw;
      const up = p.carry ? -2.9 : p.st === 2 ? -2.6 + Math.sin(view.t * 14) * 0.4 : p.sp > 0 ? -1.2 + Math.sin(view.t * 16) * 0.5 : -sw * 0.8;
      o.arms[0].rotation.x = up; o.arms[1].rotation.x = p.carry || p.st === 2 || p.sp > 0 ? up : sw * 0.8;
      o.g.rotation.x = p.st === 1 ? 0.35 : 0; // trébuche dans la neige
      if (p.st === 2) o.g.rotation.y = Math.PI; // dos à la caméra sur l'échelle
      o.crate.visible = !!p.carry;
      o.label.material.opacity = p.me ? 0.75 : 1;
    }
    for (const id of [...players.keys()]) if (!seenP.has(id)) dropPlayer(id);

    renderer.render(scene, camera);
  }
  function dropPlayer(id) {
    const o = players.get(id); if (!o) return;
    scene.remove(o.g); for (const r of o.own) r.dispose(); players.delete(id);
  }

  // position écran d'un point du repère du train (marqueurs du HUD)
  function toScreen(x, y, z) {
    v3.set(x, y, z).project(camera);
    return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H, front: v3.z < 1 };
  }

  // remise à zéro entre deux parties (nouvelle graine) : on garde la scène, on vide le décor et les entités
  function reset() {
    for (const g of ruinMeshes.values()) ruinsGroup.remove(g); ruinMeshes.clear();
    for (const g of moundGroups.values()) ruinsGroup.remove(g); moundGroups.clear();
    for (const m of crates.values()) scene.remove(m); crates.clear();
    for (const id of [...players.keys()]) dropPlayer(id);
    camInit = false;
  }

  let disposed = false;
  function dispose() {
    if (disposed) return; disposed = true;
    ro.disconnect();
    canvas.removeEventListener('webglcontextlost', onCtxLost);
    for (const id of [...players.keys()]) dropPlayer(id);
    scene.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    for (const g of owned.geo) g.dispose();
    for (const m of owned.mat) m.dispose();
    for (const t of owned.tex) t.dispose();
    sun.shadow.map?.dispose(); fireLight.shadow?.map?.dispose(); beam.shadow?.map?.dispose();
    scene.clear();
    renderer.dispose(); renderer.forceContextLoss();
    canvas.remove();
  }

  return { frame, resize, toScreen, reset, dispose, kick: (s = 0.35) => { shake = Math.max(shake, s); }, canvas };
}
