// Plouf ! — scène 3D (Three.js r169 embarqué) : la mer de la Baie des Anges, le radeau en planches, les joueurs
// (petits baigneurs dessinés dans le code), les mouettes, les objets et les éclaboussures. Aucun modèle à charger.
// La caméra regarde le radeau depuis le sud, en plongée : le haut de l'écran est le nord (-z).
// createScene() monte le canevas ; frame(view, dt) dessine une image ; fx.* ajoute un effet ; dispose() libère tout.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { Arena, T } from '../engine/arena.js';
import { ST, GULL_Y } from '../engine/sim.js';

const PITCH = 0.98;                 // inclinaison de la caméra (rad, ~56°)
const SKY = 0x8fd6f5, SEA = 0x1592cf, SEA_FAR = 0x5cc0ea;
const SKINS = ['#f2c6a0', '#e0a87c', '#c68b59', '#8d5a3b', '#f7d7b5', '#a8724a'];
const SHORTS = ['#ffffff', '#1d3557', '#f4a261', '#2a9d8f', '#e63946', '#ffd166'];
const CHAR_K = 1.3;                 // les baigneurs sont dessinés un peu plus grands que leur cercle de collision
const HASH = (n) => { let x = (n | 0) * 2654435761; x ^= x >>> 15; return (x >>> 0) % 997; };

export function createScene(host, { onLost } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  host.appendChild(canvas);
  const MOBILE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 560;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onLost && onLost(); });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SEA_FAR, 30, 70);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 200);
  const owned = { geo: new Set(), mat: new Set(), tex: new Set() };
  const G = (g) => (owned.geo.add(g), g);
  const M = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o }); owned.mat.add(m); return m; };
  const B = (color, o = {}) => { const m = new THREE.MeshBasicMaterial({ color, ...o }); owned.mat.add(m); return m; };
  const canvasTex = (w, h, draw, repeat) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    owned.tex.add(t); return t;
  };

  // ---------------------------------------------------------------- lumière
  scene.add(new THREE.HemisphereLight(0xd8f1ff, 0xf3d9a4, 1.25));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.position.set(-7, 16, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  // ---------------------------------------------------------------- la mer
  // carte de normales tirée de sinus entiers (elle se répète sans couture) : les reflets du soleil scintillent
  const waterN = (() => {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), img = g.createImageData(S, S), TAU = Math.PI * 2;
    const h = (x, y) => Math.sin(TAU * (3 * x + 2 * y)) + 0.6 * Math.sin(TAU * (5 * x - 3 * y) + 1) + 0.4 * Math.sin(TAU * (7 * x + 5 * y) + 2) + 0.3 * Math.sin(TAU * (11 * y - 4 * x) + 4) + 0.2 * Math.sin(TAU * (13 * x + 9 * y));
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = i / S, y = j / S, e = 1 / S;
      const nx = -(h(x + e, y) - h(x - e, y)) * 1.2, ny = -(h(x, y + e) - h(x, y - e)) * 1.2, l = Math.hypot(nx, ny, 1);
      const k = (j * S + i) * 4;
      img.data[k] = (nx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(26, 26); owned.tex.add(t);
    return t;
  })();
  const sea = new THREE.Mesh(G(new THREE.PlaneGeometry(160, 160)), M(SEA, { roughness: 0.16, normalMap: waterN, normalScale: new THREE.Vector2(0.55, 0.55) }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.08; sea.receiveShadow = true;
  scene.add(sea);
  // le fond clair sous le radeau (eau peu profonde, sable)
  const glow = canvasTex(128, 128, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(120,225,240,0.75)'); r.addColorStop(0.55, 'rgba(110,215,235,0.45)'); r.addColorStop(1, 'rgba(100,200,230,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const shallow = new THREE.Mesh(G(new THREE.CircleGeometry(1, 48)), B(0xffffff, { map: glow, transparent: true, depthWrite: false }));
  shallow.rotation.x = -Math.PI / 2; shallow.position.y = -0.07; scene.add(shallow);

  // ligne de bouées du bassin, quelques bouées de balisage, un voilier au loin
  const floats = new THREE.InstancedMesh(G(new THREE.SphereGeometry(0.16, 10, 8)), M(0xffffff, { roughness: 0.5 }), 90);
  floats.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(90 * 3), 3);
  scene.add(floats);
  const marks = [];
  for (const [x, z, col] of [[-15, -12, 0xffc531], [15, -12, 0xffc531], [-16, 10, 0xff5a3c], [16, 10, 0xff5a3c]]) {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(G(new THREE.SphereGeometry(0.55, 14, 10)), M(col, { roughness: 0.5 })); ball.castShadow = true;
    const pole = new THREE.Mesh(G(new THREE.CylinderGeometry(0.06, 0.06, 1.4)), M(0x333333)); pole.position.y = 0.9;
    const top = new THREE.Mesh(G(new THREE.ConeGeometry(0.22, 0.4, 8)), M(col)); top.position.y = 1.7;
    g.add(ball, pole, top); g.position.set(x, 0, z); scene.add(g); marks.push(g);
  }
  const boat = new THREE.Group();
  {
    const hull = new THREE.Mesh(G(new THREE.BoxGeometry(1.2, 0.5, 3.6)), M(0xffffff)); hull.position.y = 0.15;
    const mast = new THREE.Mesh(G(new THREE.CylinderGeometry(0.05, 0.05, 4.2)), M(0x8a6b4a)); mast.position.set(0, 2.4, 0.2);
    const sailG = new THREE.BufferGeometry(); sailG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.6, 0.3, 0, 4.4, 0.25, 0, 0.6, -1.5], 3)); sailG.computeVertexNormals();
    const sail = new THREE.Mesh(G(sailG), M(0xfff6e8, { side: THREE.DoubleSide }));
    boat.add(hull, mast, sail); boat.position.set(-24, 0, -30); boat.rotation.y = Math.PI / 2; scene.add(boat);
  }

  // ---------------------------------------------------------------- le radeau
  const wood = canvasTex(128, 32, (g, w, h) => {
    g.fillStyle = '#c9965f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(90,55,25,${0.12 + Math.random() * 0.18})`; g.lineWidth = 1 + Math.random(); g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 3, w * 0.6, y - 3, w, y + Math.random() * 2); g.stroke(); }
    g.fillStyle = 'rgba(60,35,15,0.5)'; g.fillRect(6, h / 2 - 2, 3, 3); g.fillRect(w - 9, h / 2 - 2, 3, 3); // clous
  });
  const MAXT = 13 * 9;
  const plankG = G(new THREE.BoxGeometry(T * 0.97, 0.16, T / 3 - 0.04));
  const planks = new THREE.InstancedMesh(plankG, M(0xffffff, { map: wood, roughness: 0.85 }), MAXT * 3);
  planks.castShadow = true; planks.receiveShadow = true;
  planks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXT * 3 * 3), 3);
  const barrels = new THREE.InstancedMesh(G(new THREE.CylinderGeometry(0.26, 0.26, T * 0.8, 12)), M(0xffffff, { roughness: 0.5 }), MAXT);
  barrels.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXT * 3), 3);
  scene.add(planks, barrels);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  const raft = { arena: null, key: '', rd: -1, tiles: [], ti: '' };
  function setArena(key, big, rd) {
    const A = new Arena(key, null, !!big);
    raft.arena = A; raft.key = key; raft.rd = rd; raft.ti = '';
    raft.tiles = [];
    const col = new THREE.Color();
    for (let i = 0; i < MAXT; i++) {
      const on = i < A.st.length && A.st[i] > 0;
      const c = on ? A.center(i) : { x: 0, z: 0 };
      raft.tiles.push({ on, x: c.x, z: c.z, st: on ? 1 : 0, sink: on ? -1 : 9, rot: (HASH(i) % 3) * 0.004 });
      for (let k = 0; k < 3; k++) {
        const h = HASH(i * 3 + k);
        col.setHSL(0.075 + (h % 7) * 0.004, 0.45 + (h % 5) * 0.03, 0.62 + (h % 9) * 0.012);
        planks.setColorAt(i * 3 + k, col);
      }
      const bc = [0x2f7fd6, 0x2f7fd6, 0xf0f0f0, 0xff8a2a][HASH(i) % 4];
      barrels.setColorAt(i, col.set(bc));
      placeTile(i, 0, 0, 0, on ? 1 : 0);
    }
    planks.instanceColor.needsUpdate = true; barrels.instanceColor.needsUpdate = true;
    // le fond clair et la ligne de bouées suivent la taille du radeau
    shallow.scale.set(A.hx + 5, A.hz + 5, 1);
    const fx = A.hx + 4.5, fz = A.hz + 4.5;
    const col2 = new THREE.Color();
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2, x = Math.sin(a) * fx, z = Math.cos(a) * fz;
      _m.makeTranslation(x, 0, z); floats.setMatrixAt(i, _m);
      floats.setColorAt(i, col2.set(i % 6 < 3 ? 0xffffff : 0xff4b2b));
    }
    floats.instanceMatrix.needsUpdate = true; floats.instanceColor.needsUpdate = true;
    fit();
  }
  // une case : trois planches et un bidon dessous ; dy, rx, rz : secousse ou naufrage ; s = 0 pour la cacher
  function placeTile(i, dy, rx, rz, s) {
    const t = raft.tiles[i];
    _q.setFromEuler(_e.set(rx, t ? t.rot : 0, rz));
    for (let k = 0; k < 3; k++) {
      _p.set(0, 0, (k - 1) * T / 3).applyQuaternion(_q);
      _p.x += t ? t.x : 0; _p.y += dy - 0.08; _p.z += t ? t.z : 0;
      _s.setScalar(s);
      _m.compose(_p, _q, _s); planks.setMatrixAt(i * 3 + k, _m);
    }
    _p.set(t ? t.x : 0, dy - 0.3, t ? t.z : 0); _s.setScalar(s);
    _m.compose(_p, _q.setFromEuler(_e.set(rx, t ? t.rot : 0, rz + Math.PI / 2)), _s); barrels.setMatrixAt(i, _m);
  }
  function updateTiles(ti, dt, time) {
    if (!raft.arena) return;
    let dirty = false;
    for (let i = 0; i < raft.tiles.length; i++) {
      const t = raft.tiles[i];
      if (!t.on || t.sink > 3) continue;
      const s = ti ? ti.charCodeAt(i) - 48 : t.st;
      if (s === 0 && t.sink < 0) { t.sink = 0; fx.sinkTile(t.x, t.z); }
      if (t.sink >= 0) {
        t.sink += dt;
        const k = Math.min(1, t.sink / 1.4);
        placeTile(i, -k * 1.2, k * 0.5 * (HASH(i) % 2 ? 1 : -1), k * 0.35, t.sink > 1.4 ? 0 : 1);
        dirty = true;
      } else if (s === 2) {
        placeTile(i, Math.sin(time * 38 + i) * 0.035 - 0.03, Math.sin(time * 31 + i * 2) * 0.03, Math.cos(time * 27 + i) * 0.03, 1);
        dirty = true; t.st = 2;
      } else if (t.st === 2 && s === 1) { placeTile(i, 0, 0, 0, 1); dirty = true; t.st = 1; }
      else {
        // le radeau flotte : tout doucement
        const bob = Math.sin(time * 1.3 + t.x * 0.4 + t.z * 0.3) * 0.015;
        placeTile(i, bob, 0, 0, 1); dirty = true;
      }
    }
    if (dirty) { planks.instanceMatrix.needsUpdate = true; barrels.instanceMatrix.needsUpdate = true; }
  }

  // ---------------------------------------------------------------- caméra : tout le radeau dans l'image
  const target = new THREE.Vector3(0, 0, 0.6);
  let camDist = 20, shake = 0, zoomK = 1;           // zoomK : cadrage resserré (affiche, mise au point)
  function fit() {
    const A = raft.arena; if (!A) return;
    const aspect = camera.aspect, pts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { pts.push(new THREE.Vector3(sx * (A.hx + 0.8), 0, sz * (A.hz + 0.8))); pts.push(new THREE.Vector3(sx * (A.hx + 0.8), 1.6, sz * (A.hz + 0.8))); }
    let lo = 6, hi = 60;
    for (let it = 0; it < 18; it++) {
      const d = (lo + hi) / 2;
      camera.position.set(target.x, target.y + Math.sin(PITCH) * d, target.z + Math.cos(PITCH) * d);
      camera.lookAt(target); camera.updateMatrixWorld(); camera.aspect = aspect; camera.updateProjectionMatrix();
      const m = Math.max(...pts.map((p) => { const v = p.clone().project(camera); return Math.max(Math.abs(v.x), Math.abs(v.y) * 1.04); }));
      if (m > 0.9) lo = d; else hi = d;
    }
    camDist = hi;
  }
  function resize() {
    const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    fit();
  }
  addEventListener('resize', resize);

  // ---------------------------------------------------------------- baigneurs et mouettes
  const skinMats = SKINS.map((c) => M(c, { roughness: 0.6 }));
  const black = M(0x111111, { roughness: 0.3 }), white = M(0xffffff, { roughness: 0.5 }), orange = M(0xffa21f), grey = M(0xb9c2cc);
  const torsoG = G(new THREE.CapsuleGeometry(0.25, 0.3, 4, 12)), headG = G(new THREE.SphereGeometry(0.23, 16, 12));
  const limbG = G(new THREE.CapsuleGeometry(0.075, 0.3, 3, 8)), legG = G(new THREE.CapsuleGeometry(0.085, 0.22, 3, 8));
  const shortsG = G(new THREE.CylinderGeometry(0.27, 0.29, 0.2, 14)), eyeG = G(new THREE.SphereGeometry(0.035, 8, 6));
  const buoyTex = canvasTex(64, 8, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#ff3b30'; g.fillRect(i * w / 8, 0, w / 8, h); } });
  const buoyG = G(new THREE.TorusGeometry(0.36, 0.1, 10, 24)), buoyM = M(0xffffff, { map: buoyTex, roughness: 0.45 });
  const ringG = G(new THREE.RingGeometry(0.4, 0.48, 32)), discG = G(new THREE.CircleGeometry(1, 32));
  const chars = new Map();

  function makeChar(id, color) {
    const h = HASH(id + 17), skin = skinMats[h % skinMats.length];
    const shirt = M(color, { roughness: 0.7 }), shorts = M(SHORTS[(h >> 2) % SHORTS.length]);
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    body.scale.setScalar(CHAR_K);
    const torso = new THREE.Mesh(torsoG, shirt); torso.position.y = 0.72;
    const sh = new THREE.Mesh(shortsG, shorts); sh.position.y = 0.44;
    const head = new THREE.Mesh(headG, skin); head.position.y = 1.12;
    const eyes = [-0.08, 0.08].map((x) => { const e = new THREE.Mesh(eyeG, black); e.position.set(x, 1.15, 0.2); return e; });
    body.add(torso, sh, head, ...eyes);
    // un accessoire : lunettes de soleil, casquette, bob ou chignon
    const acc = h % 4;
    if (acc === 0) { const g = new THREE.Mesh(G(new THREE.BoxGeometry(0.3, 0.07, 0.05)), black); g.position.set(0, 1.15, 0.21); body.add(g); }
    else if (acc === 1) { const cap = new THREE.Mesh(G(new THREE.SphereGeometry(0.24, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), shorts); cap.position.y = 1.16; const vis = new THREE.Mesh(G(new THREE.BoxGeometry(0.26, 0.03, 0.18)), shorts); vis.position.set(0, 1.18, 0.24); body.add(cap, vis); }
    else if (acc === 2) { const bob = new THREE.Mesh(G(new THREE.CylinderGeometry(0.2, 0.32, 0.16, 14)), M(0xf3e2b3)); bob.position.y = 1.32; body.add(bob); }
    else { const hair = new THREE.Mesh(G(new THREE.SphereGeometry(0.245, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.2)), M([0x2b1a10, 0x6b3e1f, 0xd9b26a][h % 3])); hair.position.y = 1.14; hair.rotation.x = -0.25; body.add(hair); }
    const arm = (s) => { const g = new THREE.Group(); g.position.set(s * 0.32, 0.92, 0); const a = new THREE.Mesh(limbG, skin); a.position.y = -0.2; a.castShadow = true; g.add(a); body.add(g); return g; };
    const leg = (s) => { const g = new THREE.Group(); g.position.set(s * 0.12, 0.36, 0); const l = new THREE.Mesh(legG, skin); l.position.y = -0.17; l.castShadow = true; g.add(l); body.add(g); return g; };
    const armL = arm(-1), armR = arm(1), legL = leg(-1), legR = leg(1);
    const buoy = new THREE.Mesh(buoyG, buoyM); buoy.rotation.x = Math.PI / 2; buoy.position.y = 0.5; buoy.visible = false; body.add(buoy);
    for (const o of [torso, sh, head]) { o.castShadow = true; o.receiveShadow = true; }
    // repère au sol à la couleur du joueur, et le disque qui grandit quand il arme sa poussée
    const ring = new THREE.Mesh(ringG, B(color, { transparent: true, opacity: 0.85, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    const disc = new THREE.Mesh(discG, B(color, { transparent: true, opacity: 0.35, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.visible = false;
    // la mouette
    const gull = new THREE.Group(); gull.scale.setScalar(0.85);
    const gb = new THREE.Mesh(G(new THREE.SphereGeometry(0.3, 14, 10)), white); gb.scale.set(1, 0.75, 1.5); gb.castShadow = true;
    const gh = new THREE.Mesh(G(new THREE.SphereGeometry(0.17, 12, 10)), white); gh.position.set(0, 0.15, 0.42);
    const beak = new THREE.Mesh(G(new THREE.ConeGeometry(0.06, 0.22, 8)), orange); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.12, 0.62);
    const geyes = [-0.08, 0.08].map((x) => { const e = new THREE.Mesh(eyeG, black); e.position.set(x, 0.2, 0.55); return e; });
    const scarf = new THREE.Mesh(G(new THREE.TorusGeometry(0.15, 0.05, 6, 16)), shirt); scarf.position.set(0, 0.06, 0.3);
    const wing = (s) => { const g = new THREE.Group(); g.position.set(s * 0.22, 0.08, 0); const w = new THREE.Mesh(G(new THREE.BoxGeometry(0.55, 0.04, 0.34)), grey); w.position.x = s * 0.28; w.castShadow = true; const tip = new THREE.Mesh(G(new THREE.BoxGeometry(0.2, 0.045, 0.26)), black); tip.position.set(s * 0.64, 0, -0.03); g.add(w, tip); gull.add(g); return g; };
    const wl = wing(-1), wr = wing(1);
    gull.add(gb, gh, beak, ...geyes, scarf); gull.visible = false;
    const aim = new THREE.Mesh(G(new THREE.RingGeometry(0.75, 0.9, 32)), B(color, { transparent: true, opacity: 0.7, depthWrite: false }));
    aim.rotation.x = -Math.PI / 2; aim.visible = false;
    scene.add(root, ring, disc, gull, aim);
    return { root, body, armL, armR, legL, legR, buoy, ring, disc, gull, wl, wr, aim, walk: 0, spin: 0, tumble: 0, flap: 0, shirt, shorts, st: -1 };
  }
  function dropChar(c) {
    scene.remove(c.root, c.ring, c.disc, c.gull, c.aim);
    c.shirt.dispose(); c.shorts.dispose(); c.ring.material.dispose(); c.disc.material.dispose(); c.aim.material.dispose();
  }
  const lerp = (a, b, k) => a + (b - a) * k;

  function drawChar(c, p, dt, time) {
    const st = p.st, gullOn = st === ST.GULL;
    c.root.visible = !gullOn && !(st === ST.FALL && p.y < -1.1);
    c.gull.visible = gullOn; c.aim.visible = gullOn && p.alive;
    c.ring.visible = st === ST.RUN; c.disc.visible = st === ST.RUN && p.chg > 0;
    if (gullOn) {
      c.flap += dt * 9;
      const bob = Math.sin(time * 2.2 + p.id) * 0.12;
      c.gull.position.set(p.x, GULL_Y + bob, p.z); c.gull.rotation.y = p.yaw;
      c.wl.rotation.z = Math.sin(c.flap) * 0.6; c.wr.rotation.z = -Math.sin(c.flap) * 0.6;
      c.aim.position.set(p.x, 0.12, p.z);
      const ready = p.cd <= 0;
      c.aim.material.opacity = ready ? 0.55 + Math.sin(time * 8) * 0.25 : 0.18;
      c.aim.scale.setScalar(ready ? 1 : 0.7);
      return;
    }
    c.root.position.set(p.x, p.y, p.z);
    c.root.rotation.y = p.yaw;
    c.ring.position.set(p.x, 0.1, p.z);
    c.buoy.visible = !!p.buoy || st === ST.BOB;
    const speed = Math.hypot(p.vx, p.vz);
    let armX = 0, armZ = 0.12, legX = 0, lean = 0, squash = 1, rollZ = 0, k = Math.min(1, dt * 14);
    if (st === ST.RUN) {
      c.walk += dt * speed * 3.2;
      const sw = Math.sin(c.walk) * Math.min(1, speed / 4);
      legX = sw * 0.7; armX = -sw * 0.6;
      if (p.chg > 0 || p.lun > 0 || p.ck) legX *= 0.4;
      if (p.chg > 0) { squash = 0.86; lean = -0.25; armX = 0.9; armZ = 0.35; c.disc.position.set(p.x, 0.11, p.z); c.disc.scale.setScalar(0.3 + p.chgK * 0.6); }
      if (p.lun > 0) { lean = 0.45; armX = -1.45; armZ = 0.15; }
      if (p.ck) { armX = -2.9; armZ = 0.25; }
      if (p.stun > 0) { rollZ = Math.sin(time * 18) * 0.25; armZ = 0.9; }
      if (p.tee) { lean = 0.2; armZ = 1.2; c.spin += dt * 16; armX = Math.sin(c.spin) * 2.4; }
      c.tumble = 0;
    } else if (st === ST.AIR) { c.tumble += dt * 9; armZ = 1.2; legX = 0.6; }
    else if (st === ST.HELD) { armZ = 1.4; c.walk += dt * 20; legX = Math.sin(c.walk) * 0.8; armX = Math.sin(c.walk * 1.3) * 1.2; }
    else if (st === ST.FALL) { armX = -3; armZ = 0.3; k = 1; }
    else if (st === ST.BOB) { armZ = 1.3 + Math.sin(time * 6) * 0.3; c.root.position.y = -0.55 + Math.sin(time * 3) * 0.05; }
    // au bord, on mouline des bras (en opposition) ; sinon les deux bras ensemble ou en balancier
    const opp = st === ST.RUN && p.tee;
    c.armL.rotation.x = opp ? armX : lerp(c.armL.rotation.x, armX, k);
    c.armR.rotation.x = opp ? -armX : lerp(c.armR.rotation.x, st === ST.RUN && !p.chg && !p.lun && !p.ck ? -armX : armX, k);
    c.armL.rotation.z = lerp(c.armL.rotation.z, -armZ, k); c.armR.rotation.z = lerp(c.armR.rotation.z, armZ, k);
    c.legL.rotation.x = lerp(c.legL.rotation.x, legX, k); c.legR.rotation.x = lerp(c.legR.rotation.x, -legX, k);
    c.body.rotation.x = st === ST.AIR ? c.tumble : lerp(c.body.rotation.x, lean, k);
    c.body.rotation.z = st === ST.HELD ? Math.PI / 2 : lerp(c.body.rotation.z, rollZ, k);
    c.body.scale.y = lerp(c.body.scale.y, squash * CHAR_K, k);
    if (st === ST.HELD) c.body.position.y = -0.6; else c.body.position.y = lerp(c.body.position.y, 0, k);
  }

  // ---------------------------------------------------------------- objets : pastèques, bouées, sardines
  const melonTex = canvasTex(64, 64, (g, w, h) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#2f8f2f' : '#1d5e1d'; g.fillRect(i * w / 16, 0, w / 16 + 1, h); } });
  const melonG = G(new THREE.SphereGeometry(0.3, 18, 14)), melonM = M(0xffffff, { map: melonTex, roughness: 0.4 });
  const fishG = G(new THREE.SphereGeometry(0.12, 10, 8)), fishM = M(0x8fb3c9, { metalness: 0.5, roughness: 0.3 }), tailG = G(new THREE.ConeGeometry(0.09, 0.14, 4));
  const shadowM = B(0x000000, { transparent: true, opacity: 0.25, depthWrite: false });
  const objs = new Map();
  function makeObj(k) {
    const g = new THREE.Group();
    if (k === 'melon') { const m = new THREE.Mesh(melonG, melonM); m.scale.set(1, 0.85, 1.25); m.position.y = 0.26; m.castShadow = true; g.add(m); }
    else if (k === 'buoy') { const m = new THREE.Mesh(buoyG, buoyM); m.rotation.x = Math.PI / 2; m.position.y = 0.12; m.castShadow = true; g.add(m); }
    else { const m = new THREE.Mesh(fishG, fishM); m.scale.set(0.7, 0.8, 2); const t = new THREE.Mesh(tailG, fishM); t.rotation.x = -Math.PI / 2; t.position.z = -0.28; g.add(m, t); }
    const sh = new THREE.Mesh(discG, shadowM); sh.rotation.x = -Math.PI / 2; sh.visible = false;
    scene.add(g, sh);
    return { g, sh, spin: Math.random() * 6 };
  }
  function drawObj(o, x, dt, time) {
    o.g.position.set(x.x, x.y, x.z);
    if (x.st === 2) { o.spin += dt * 8; o.g.rotation.set(o.spin, o.spin * 0.7, 0); }
    else if (x.st === 0) { o.g.rotation.set(0, time * (x.k === 'buoy' ? 0.8 : 0), 0); if (x.k === 'buoy') o.g.position.y = 0.05 + Math.sin(time * 3) * 0.05; }
    else o.g.rotation.set(0, 0, 0);
    // ombre au sol pour ce qui tombe : on voit où ça va atterrir
    o.sh.visible = x.st === 2 && x.y > 0.6;
    if (o.sh.visible) { o.sh.position.set(x.x, 0.12, x.z); o.sh.scale.setScalar(0.2 + Math.min(0.5, x.y * 0.06)); }
  }

  // ---------------------------------------------------------------- effets : gouttes, ronds dans l'eau, éclats, vent
  const PMAX = 500;
  const parts = new THREE.InstancedMesh(G(new THREE.IcosahedronGeometry(0.07, 0)), B(0xffffff), PMAX);
  parts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PMAX * 3), 3);
  parts.frustumCulled = false; scene.add(parts);
  const P = Array.from({ length: PMAX }, () => ({ life: 0 }));
  let pNext = 0;
  const _c = new THREE.Color();
  function emit(x, y, z, n, { speed = 3, up = 4, color = 0xffffff, size = 1, life = 0.8, grav = 12, spread = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const idx = pNext, q = P[idx]; pNext = (pNext + 1) % PMAX;
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      Object.assign(q, { x: x + (Math.random() - 0.5) * 0.3 * spread, y, z: z + (Math.random() - 0.5) * 0.3 * spread, vx: Math.cos(a) * s, vy: up * (0.5 + Math.random() * 0.7), vz: Math.sin(a) * s,
        life, max: life, size: size * (0.6 + Math.random() * 0.8), grav });
      parts.setColorAt(idx, _c.set(Array.isArray(color) ? color[i % color.length] : color));
    }
    parts.instanceColor.needsUpdate = true;
  }
  const rings = Array.from({ length: 18 }, () => {
    const m = new THREE.Mesh(G(new THREE.RingGeometry(0.82, 1, 40)), B(0xffffff, { transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return { m, t: 1, max: 1, r: 1 };
  });
  let rNext = 0;
  function ring(x, z, r = 2, dur = 0.9, y = 0) { const q = rings[rNext]; rNext = (rNext + 1) % rings.length; q.m.position.set(x, y + 0.02, z); q.t = 0; q.max = dur; q.r = r; q.m.visible = true; }
  const streaks = Array.from({ length: 40 }, () => {
    const m = new THREE.Mesh(G(new THREE.BoxGeometry(0.04, 0.04, 1.6)), B(0xffffff, { transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; scene.add(m); return { m, life: 0 };
  });
  const fx = {
    splash(x, z, big = 1) { emit(x, 0, z, Math.round(28 * big), { speed: 2.6 * big, up: 6 * big, color: [0xffffff, 0xd6f3ff, 0xa8e6ff], life: 0.9 }); ring(x, z, 2.2 * big, 1); ring(x, z, 1.2 * big, 0.7); shake = Math.max(shake, 0.12 * big); },
    plop(x, z) { emit(x, 0, z, 10, { speed: 1.5, up: 3.5, color: 0xe0f6ff, life: 0.6 }); ring(x, z, 1, 0.7); },
    hit(x, z, k = 0) { emit(x, 0.9, z, 10 + Math.round(k * 12), { speed: 3 + k * 3, up: 2, color: [0xffe066, 0xffffff, 0xffb703], life: 0.35, grav: 4 }); ring(x, z, 0.9 + k, 0.35, 0.1); shake = Math.max(shake, 0.06 + k * 0.14); },
    bump(x, z) { emit(x, 0.6, z, 5, { speed: 2, up: 1.5, color: 0xffffff, life: 0.25, grav: 4 }); },
    splat(x, z) { emit(x, 1, z, 26, { speed: 3.5, up: 3, color: [0xff3b4f, 0xff6b6b, 0x2f8f2f, 0x111111, 0xffd0d0], life: 0.7, size: 1.3 }); shake = Math.max(shake, 0.1); },
    fish(x, z, water) { if (water) fx.plop(x, z); else { emit(x, 0.2, z, 12, { speed: 2, up: 2, color: [0xbfd7e6, 0xffffff], life: 0.5 }); ring(x, z, 1.4, 0.5, 0.1); } },
    land(x, z) { emit(x, 0.1, z, 8, { speed: 1.8, up: 1.2, color: 0xe6c79a, life: 0.4, grav: 6 }); },
    sinkTile(x, z) { emit(x, 0, z, 16, { speed: 1.4, up: 2.5, color: [0xffffff, 0xc9965f], life: 0.8 }); ring(x, z, 1.6, 1.2); },
    bubbles(x, z) { emit(x, -0.05, z, 6, { speed: 0.4, up: 1.4, color: 0xe8fbff, life: 0.6, grav: 1, size: 0.7 }); },
    sparkle(x, y, z, color) { emit(x, y, z, 14, { speed: 1.6, up: 2.5, color: [color, 0xffffff], life: 0.6, grav: 3, size: 0.8 }); },
  };
  function stepFx(dt, wind) {
    for (let i = 0; i < PMAX; i++) {
      const q = P[i];
      if (q.life > 0) {
        q.life -= dt; q.vy -= q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
        if (q.y < -0.05 && q.vy < 0) q.life = 0;
        const s = q.life > 0 ? q.size * Math.min(1, q.life / q.max * 2) : 0;
        _m.compose(_p.set(q.x, q.y, q.z), _q.identity(), _s.setScalar(s));
      } else _m.makeScale(0, 0, 0);
      parts.setMatrixAt(i, _m);
    }
    parts.instanceMatrix.needsUpdate = true;
    for (const r of rings) {
      if (!r.m.visible) continue;
      r.t += dt; const k = r.t / r.max;
      if (k >= 1) { r.m.visible = false; continue; }
      r.m.scale.setScalar(0.2 + r.r * k); r.m.material.opacity = (1 - k) * 0.8;
    }
    // traînées du mistral, dans le sens du vent
    for (const s of streaks) {
      if (s.life > 0) {
        s.life -= dt; s.m.position.x += s.vx * dt; s.m.position.z += s.vz * dt;
        s.m.material.opacity = Math.min(0.55, s.life * 1.2);
        if (s.life <= 0) s.m.visible = false;
      } else if (wind && Math.random() < dt * 30) {
        const A = raft.arena, ax = wind.x, az = wind.z, l = Math.hypot(ax, az) || 1;
        const span = (A ? Math.max(A.hx, A.hz) : 6) + 4;
        const side = (Math.random() - 0.5) * span * 2;
        s.m.position.set(-ax / l * span + -az / l * side, 0.3 + Math.random() * 2.5, -az / l * span + ax / l * side);
        s.m.rotation.y = Math.atan2(ax, az);
        s.vx = ax / l * 14; s.vz = az / l * 14; s.life = 1.2 + Math.random() * 0.6; s.m.visible = true;
      }
    }
  }

  // ---------------------------------------------------------------- une image
  let time = 0, disposed = false;
  const tmpV = new THREE.Vector3();
  function frame(v, dt) {
    if (disposed) return;
    time += dt;
    if (v.sh && (v.rd !== raft.rd || v.sh !== raft.key || !raft.arena || raft.arena.big !== (v.bg ? 1 : 0))) setArena(v.sh, v.bg, v.rd);
    updateTiles(v.ti, dt, time);
    // joueurs
    const seen = new Set();
    for (const p of v.players) {
      seen.add(p.id);
      let c = chars.get(p.id);
      if (!c) { c = makeChar(p.id, p.color); chars.set(p.id, c); }
      if (c.st === ST.FALL && p.st === ST.FALL && p.y < -0.3 && Math.random() < dt * 8) fx.bubbles(p.x, p.z);
      c.st = p.st;
      drawChar(c, p, dt, time);
    }
    for (const [id, c] of chars) if (!seen.has(id)) { dropChar(c); chars.delete(id); }
    // objets
    const os = new Set();
    for (const o of v.objs) {
      os.add(o.id);
      let m = objs.get(o.id);
      if (!m) { m = makeObj(o.k); objs.set(o.id, m); }
      drawObj(m, o, dt, time);
    }
    for (const [id, m] of objs) if (!os.has(id)) { scene.remove(m.g, m.sh); objs.delete(id); }
    // la mer bouge, le voilier passe, les bouées dansent
    waterN.offset.set(time * 0.012, time * 0.008);
    boat.position.x = -24 + ((time * 0.6) % 48); boat.position.y = Math.sin(time * 0.9) * 0.08; boat.rotation.z = Math.sin(time * 0.7) * 0.04;
    for (const m of marks) { m.position.y = Math.sin(time * 1.4 + m.position.x) * 0.1; m.rotation.z = Math.sin(time * 1.1 + m.position.z) * 0.08; }
    stepFx(dt, v.wind);
    // caméra (avec une secousse sur les gros coups)
    shake = Math.max(0, shake - dt * 0.6);
    const sx = shake ? (Math.random() - 0.5) * shake : 0, sz = shake ? (Math.random() - 0.5) * shake : 0;
    const d = camDist * zoomK;
    camera.position.set(target.x + sx, target.y + Math.sin(PITCH) * d, target.z + Math.cos(PITCH) * d + sz);
    camera.lookAt(target.x + sx * 0.5, target.y, target.z + sz * 0.5);
    renderer.render(scene, camera);
  }
  // position à l'écran d'un point du monde (étiquettes des joueurs), en pixels CSS
  function toScreen(x, y, z) {
    tmpV.set(x, y, z).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: (tmpV.x * 0.5 + 0.5) * r.width + r.left, y: (-tmpV.y * 0.5 + 0.5) * r.height + r.top, on: tmpV.z < 1 };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    removeEventListener('resize', resize);
    scene.traverse((o) => { if (o.geometry) owned.geo.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => owned.mat.add(m)); });
    owned.geo.forEach((g) => g.dispose()); owned.mat.forEach((m) => m.dispose()); owned.tex.forEach((t) => t.dispose());
    renderer.dispose(); renderer.forceContextLoss();
    canvas.remove();
  }

  resize();
  setArena('radeau', 0, 0);
  return { frame, fx, toScreen, dispose, resize, zoom: (k) => { zoomK = k; }, canvas };
}
