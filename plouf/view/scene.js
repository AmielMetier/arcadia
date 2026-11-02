// Plouf ! — scène 3D (Three.js r169 embarqué) : la Baie des Anges (mer, plage au nord avec palmiers, parasols et
// poste de secours, bateaux qui dérivent), le radeau en planches photo posé sur des tonneaux, les baigneurs animés
// (view/baigneur.js), les mouettes (dessinées), les objets et les éclaboussures. Modèles : plouf/models/ (LICENSE.txt).
// La caméra regarde le radeau depuis le sud, en plongée : le haut de l'écran est le nord (-z).
// createScene() monte le canevas et charge les modèles (scene.ready) ; frame(view, dt) dessine une image ;
// fx.* ajoute un effet ; hurt(id) fait encaisser un coup ; dispose() libère tout.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { Arena, T } from '../engine/arena.js';
import { ST, GULL_Y } from '../engine/sim.js';
import { loadModels, cloneStatic, parts } from './models.js';
import { Baigneur } from './baigneur.js';

export const DECK = 0.5;            // le pont du radeau flotte au-dessus de l'eau : les tonneaux dépassent
const PITCH = 0.88;                 // inclinaison de la caméra (rad, ~50°) : assez de plongée pour lire le radeau, assez d'horizon pour voir la plage
const SKY = 0x8fd6f5, SEA = 0x1592cf, SEA_FAR = 0x5cc0ea;
const HASH = (n) => { let x = (n | 0) * 2654435761; x ^= x >>> 15; return (x >>> 0) % 997; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

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
  const deck = new THREE.Group(); deck.position.y = DECK; scene.add(deck); // tout ce qui vit sur le radeau (planches, joueurs, objets)
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SEA_FAR, 34, 95);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 260);
  const owned = { geo: new Set(), mat: new Set(), tex: new Set() };
  const G = (g) => (owned.geo.add(g), g);
  const M = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o }); owned.mat.add(m); return m; };
  const B = (color, o = {}) => { const m = new THREE.MeshBasicMaterial({ color, ...o }); owned.mat.add(m); return m; };
  const texLoader = new THREE.TextureLoader();
  const photo = (file, repeat, srgb = true) => {
    const t = texLoader.load(file); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace; owned.tex.add(t); return t;
  };
  const canvasTex = (w, h, draw, repeat) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    owned.tex.add(t); return t;
  };

  // ---------------------------------------------------------------- lumière
  scene.add(new THREE.HemisphereLight(0xd8f1ff, 0xf3d9a4, 1.2));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.position.set(-7, 16, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 50 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  // ---------------------------------------------------------------- la mer
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
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(36, 36); owned.tex.add(t);
    return t;
  })();
  const sea = new THREE.Mesh(G(new THREE.PlaneGeometry(260, 260)), M(SEA, { roughness: 0.16, normalMap: waterN, normalScale: new THREE.Vector2(0.55, 0.55) }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.08; sea.receiveShadow = true;
  scene.add(sea);
  // eau claire et peu profonde sous le radeau et le long de la plage
  const glow = canvasTex(128, 128, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(120,225,240,0.75)'); r.addColorStop(0.55, 'rgba(110,215,235,0.45)'); r.addColorStop(1, 'rgba(100,200,230,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const shallow = new THREE.Mesh(G(new THREE.CircleGeometry(1, 48)), B(0xffffff, { map: glow, transparent: true, depthWrite: false }));
  shallow.rotation.x = -Math.PI / 2; shallow.position.y = -0.07; scene.add(shallow);

  // ---------------------------------------------------------------- la plage, au nord : sable, galets, promenade
  const beach = new THREE.Group(); scene.add(beach);
  const sandTex = photo('tex/sand.jpg', 14), sandN = photo('tex/sand_n.jpg', 14, false);
  const sand = new THREE.Mesh(G(new THREE.PlaneGeometry(160, 26, 64, 8)), M(0xf1dcb0, { map: sandTex, normalMap: sandN, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 1 }));
  { // bord ondulé côté mer, légère pente qui monte vers la promenade
    const P = sand.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i); const k = (y + 13) / 26; P.setZ(i, k * 0.9 + (k < 0.08 ? -0.2 : 0)); if (y < -12.9) P.setY(i, -13 + Math.sin(x * 0.45) * 0.9 + Math.sin(x * 1.7) * 0.35); }
    sand.geometry.computeVertexNormals();
  }
  sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true; beach.add(sand);
  const foam = new THREE.Mesh(G(new THREE.PlaneGeometry(160, 2.2, 64, 1)), B(0xffffff, { transparent: true, opacity: 0.55, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(0, -0.02, 13.4); beach.add(foam);
  const prom = new THREE.Mesh(G(new THREE.BoxGeometry(160, 1.2, 6)), M(0xd9d3c7, { roughness: 0.9 })); prom.position.set(0, 0.5, -15.5); prom.receiveShadow = true; prom.castShadow = true; beach.add(prom);
  const rail = new THREE.Mesh(G(new THREE.BoxGeometry(160, 0.08, 0.08)), M(0x2b6ea8, { metalness: 0.4, roughness: 0.4 })); rail.position.set(0, 2.0, -12.6); beach.add(rail);
  for (let i = -8; i <= 8; i++) { const post = new THREE.Mesh(G(new THREE.CylinderGeometry(0.04, 0.04, 0.95)), M(0x2b6ea8)); post.position.set(i * 9.5, 1.55, -12.6); beach.add(post); }
  // chaises bleues de la Prom', un panneau, des galets
  const chairM = M(0x2b6ea8, { roughness: 0.55 });
  for (let i = -6; i <= 6; i++) { if (i % 2) continue; const ch = new THREE.Group(); const seat = new THREE.Mesh(G(new THREE.BoxGeometry(0.6, 0.06, 0.6)), chairM); seat.position.y = 1.55; const back = new THREE.Mesh(G(new THREE.BoxGeometry(0.6, 0.6, 0.06)), chairM); back.position.set(0, 1.85, 0.3); ch.add(seat, back); ch.position.set(i * 7 + 2, 0, -14.2); beach.add(ch); }
  const pebbles = new THREE.InstancedMesh(G(new THREE.SphereGeometry(0.11, 7, 5)), M(0x9da3a6, { roughness: 1 }), 160);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(); for (let i = 0; i < 160; i++) { const h = HASH(i * 7 + 3); p.set((h % 160) - 80 + (HASH(i) % 10) / 10, 0.02, 12.4 - (HASH(i * 3) % 30) / 10); s.set(0.6 + (h % 7) / 10, 0.4 + (h % 5) / 10, 0.6 + (h % 9) / 10); q.setFromEuler(new THREE.Euler(0, h, 0)); m.compose(p, q, s); pebbles.setMatrixAt(i, m); } }
  beach.add(pebbles);
  beach.visible = false; // placée quand on connaît la taille du radeau

  // ---------------------------------------------------------------- le radeau : planches photo sur des tonneaux
  const plankTex = photo('tex/planks.jpg', 1), plankN = photo('tex/planks_n.jpg', 1, false);
  const MAXT = 13 * 9;
  const tileG = G(new THREE.BoxGeometry(T * 0.985, 0.14, T * 0.985));
  const planks = new THREE.InstancedMesh(tileG, M(0xffffff, { map: plankTex, normalMap: plankN, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.85 }), MAXT);
  planks.castShadow = true; planks.receiveShadow = true;
  planks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXT * 3), 3);
  const rim = new THREE.InstancedMesh(G(new THREE.BoxGeometry(T * 0.985, 0.05, T * 0.985)), M(0x8a6a48, { roughness: 1 }), MAXT); // chant sous la planche
  let barrels = null; // InstancedMesh du tonneau Kenney, posé quand le modèle est là ; sinon des cylindres
  const barrelFallback = new THREE.InstancedMesh(G(new THREE.CylinderGeometry(0.26, 0.26, T * 0.8, 12)), M(0x2f7fd6, { roughness: 0.5 }), MAXT);
  deck.add(planks, rim, barrelFallback);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  const raft = { arena: null, key: '', rd: -1, tiles: [], big: 0 };
  function setArena(key, big, rd) {
    const A = new Arena(key, null, !!big);
    raft.arena = A; raft.key = key; raft.rd = rd; raft.big = big ? 1 : 0;
    raft.tiles = [];
    const col = new THREE.Color();
    for (let i = 0; i < MAXT; i++) {
      const on = i < A.st.length && A.st[i] > 0;
      const c = on ? A.center(i) : { x: 0, z: 0 };
      raft.tiles.push({ on, x: c.x, z: c.z, st: on ? 1 : 0, sink: on ? -1 : 9, rot: (HASH(i) % 3) * 0.004, rz: HASH(i * 5) % 2 ? Math.PI / 2 : 0 });
      const h = HASH(i * 3);
      col.setHSL(0.08 + (h % 7) * 0.003, 0.3 + (h % 5) * 0.03, 0.78 + (h % 9) * 0.012);
      planks.setColorAt(i, col);
      placeTile(i, 0, 0, 0, on ? 1 : 0);
    }
    planks.instanceColor.needsUpdate = true;
    shallow.scale.set(A.hx + 5, A.hz + 5, 1);
    beach.position.set(0, 0, -(A.hz + 6 + 13)); beach.visible = true;
    placeBoats(A);
    fit();
  }
  // une case : la planche, son chant, un tonneau dessous ; dy, rx, rz : secousse ou naufrage ; s = 0 pour la cacher
  function placeTile(i, dy, rx, rz, s) {
    const t = raft.tiles[i];
    _q.setFromEuler(_e.set(rx, (t ? t.rot + t.rz : 0), rz));
    _s.setScalar(s);
    _m.compose(_p.set(t ? t.x : 0, dy - 0.07, t ? t.z : 0), _q, _s); planks.setMatrixAt(i, _m);
    _m.compose(_p.set(t ? t.x : 0, dy - 0.16, t ? t.z : 0), _q, _s); rim.setMatrixAt(i, _m);
    _q.setFromEuler(_e.set(rx, t ? t.rot : 0, rz));
    _m.compose(_p.set(t ? t.x : 0, dy - 1.08, t ? t.z : 0), _q, _s.setScalar(s));
    if (barrels) barrels.setMatrixAt(i, _m);
    _q.setFromEuler(_e.set(rx + Math.PI / 2, t ? t.rot : 0, rz));
    _m.compose(_p.set(t ? t.x : 0, dy - 0.3, t ? t.z : 0), _q, _s.setScalar(s)); barrelFallback.setMatrixAt(i, _m);
  }
  function updateTiles(ti, dt, time) {
    if (!raft.arena) return;
    for (let i = 0; i < raft.tiles.length; i++) {
      const t = raft.tiles[i];
      if (!t.on || t.sink > 3) continue;
      const s = ti ? ti.charCodeAt(i) - 48 : t.st;
      if (s === 0 && t.sink < 0) { t.sink = 0; fx.sinkTile(t.x, t.z); }
      if (t.sink >= 0) {
        t.sink += dt;
        const k = Math.min(1, t.sink / 1.4);
        placeTile(i, -k * 1.2, k * 0.5 * (HASH(i) % 2 ? 1 : -1), k * 0.35, t.sink > 1.4 ? 0 : 1);
      } else if (s === 2) { placeTile(i, Math.sin(time * 38 + i) * 0.035 - 0.03, Math.sin(time * 31 + i * 2) * 0.03, Math.cos(time * 27 + i) * 0.03, 1); t.st = 2; }
      else { if (t.st === 2) t.st = 1; placeTile(i, Math.sin(time * 1.3 + t.x * 0.4 + t.z * 0.3) * 0.015, 0, 0, 1); }
    }
    planks.instanceMatrix.needsUpdate = true; rim.instanceMatrix.needsUpdate = true; barrelFallback.instanceMatrix.needsUpdate = true;
    if (barrels) barrels.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- modèles : chargés en arrière-plan
  let MD = null;
  const boats = []; // { obj, r, a, w, bob } : dérivent autour du radeau
  const ready = loadModels('models/').then((md) => {
    MD = md;
    if (md.tonneau) {
      const pz = parts(md.tonneau.scene);
      if (pz.length) {
        // un tonneau = un seul maillage dans le kit ; sa matrice interne (échelle) est cuite dans la géométrie
        const g = pz[0].geometry.clone().applyMatrix4(pz[0].matrix); owned.geo.add(g);
        barrels = new THREE.InstancedMesh(g, pz[0].material, MAXT); barrels.castShadow = true; barrels.receiveShadow = true;
        deck.add(barrels); deck.remove(barrelFallback);
        for (let i = 0; i < MAXT; i++) { const t = raft.tiles[i]; placeTile(i, 0, 0, 0, t && t.on && t.sink < 0 ? 1 : 0); }
        barrels.instanceMatrix.needsUpdate = true;
      }
    }
    dressBeach(md);
    if (raft.arena) placeBoats(raft.arena);
    for (const [id, c] of chars) { if (!c.real && md.baigneur) { dropChar(c); chars.delete(id); } }
  }).catch((e) => console.error(e));

  function dressBeach(md) {
    const put = (name, x, z, rotY = 0, k = 1) => { if (!md[name]) return null; const o = cloneStatic(md[name].scene); o.position.set(x, 0.6, z); o.rotation.y = rotY; o.scale.setScalar(k); beach.add(o); return o; };
    const palms = [[-26, -6, 0.3, 1], [-14, -9.5, 2.1, 0.85], [4, -8, 4, 1.1], [17, -10, 1.2, 0.9], [30, -6.5, 5.3, 1], [-40, -8, 2.6, 0.95], [44, -9, 0.9, 1.05]];
    for (const [x, z, r, k] of palms) put('palmier', x, z, r, k);
    const paras = [[-20, 4, 0.2], [-8, 6, 1.5], [3, 3.5, 2.8], [12, 6.5, 0.9], [24, 4, 2.2], [-33, 5, 1.1], [36, 6, 0.5]];
    for (const [x, z, r] of paras) { const o = put('parasol', x, z, r); if (o) o.position.y = 0.45; }
    const tower = put('tour', -4, -2.5, 0, 1); if (tower) tower.position.y = 0.6;
    const moored = put('barque', 20, 15.5, 0.4, 1); if (moored) moored.position.y = 0;
    const boat = md.voilier ? cloneStatic(md.voilier.scene) : null;
    if (boat) { scene.add(boat); boats.push({ obj: boat, r: 46, a: 2.4, w: 0.012, bob: 0.1 }); }
    for (const [name, r, a, w] of [['matelas', 1, 0.7, 0.05], ['canot', 1, 3.6, -0.04], ['barque', 1, 5.1, 0.035]]) {
      if (!md[name]) continue; const o = cloneStatic(md[name].scene); scene.add(o); boats.push({ obj: o, r, a, w, bob: 0.06, near: true });
    }
  }
  function placeBoats(A) {
    for (const b of boats) if (b.near) b.r = Math.max(A.hx, A.hz) + 7.5 + (b.w > 0 ? 1.5 : 0);
  }

  // bouées de la ligne d'eau et balises
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
  function placeFloats(A) {
    const fx = A.hx + 4.5, fz = A.hz + 4.5, col2 = new THREE.Color();
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      _m.makeTranslation(Math.sin(a) * fx, 0, Math.cos(a) * fz); floats.setMatrixAt(i, _m);
      floats.setColorAt(i, col2.set(i % 6 < 3 ? 0xffffff : 0xff4b2b));
    }
    floats.instanceMatrix.needsUpdate = true; floats.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- caméra : tout le radeau dans l'image
  const target = new THREE.Vector3(0, 0, -0.4);
  let camDist = 20, shake = 0, zoomK = 1;
  function fit() {
    const A = raft.arena; if (!A) return;
    placeFloats(A);
    const aspect = camera.aspect, pts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { pts.push(new THREE.Vector3(sx * (A.hx + 0.9), 0, sz * (A.hz + 0.9))); pts.push(new THREE.Vector3(sx * (A.hx + 0.9), 1.8, sz * (A.hz + 0.9))); }
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

  // ---------------------------------------------------------------- joueurs : baigneurs animés, mouettes dessinées
  const black = M(0x111111, { roughness: 0.3 }), white = M(0xffffff, { roughness: 0.5 }), orange = M(0xffa21f), grey = M(0xb9c2cc);
  const eyeG = G(new THREE.SphereGeometry(0.035, 8, 6));
  const ringG = G(new THREE.RingGeometry(0.4, 0.48, 32)), discG = G(new THREE.CircleGeometry(1, 32));
  const chars = new Map();

  function makeGull(color, shirt) {
    const gull = new THREE.Group(); gull.scale.setScalar(0.85);
    const gb = new THREE.Mesh(G(new THREE.SphereGeometry(0.3, 14, 10)), white); gb.scale.set(1, 0.75, 1.5); gb.castShadow = true;
    const gh = new THREE.Mesh(G(new THREE.SphereGeometry(0.17, 12, 10)), white); gh.position.set(0, 0.15, 0.42);
    const beak = new THREE.Mesh(G(new THREE.ConeGeometry(0.06, 0.22, 8)), orange); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.12, 0.62);
    const geyes = [-0.08, 0.08].map((x) => { const e = new THREE.Mesh(eyeG, black); e.position.set(x, 0.2, 0.55); return e; });
    const scarf = new THREE.Mesh(G(new THREE.TorusGeometry(0.15, 0.05, 6, 16)), shirt); scarf.position.set(0, 0.06, 0.3);
    const wing = (s) => { const g = new THREE.Group(); g.position.set(s * 0.22, 0.08, 0); const w = new THREE.Mesh(G(new THREE.BoxGeometry(0.55, 0.04, 0.34)), grey); w.position.x = s * 0.28; w.castShadow = true; const tip = new THREE.Mesh(G(new THREE.BoxGeometry(0.2, 0.045, 0.26)), black); tip.position.set(s * 0.64, 0, -0.03); g.add(w, tip); gull.add(g); return g; };
    const wl = wing(-1), wr = wing(1);
    gull.add(gb, gh, beak, ...geyes, scarf); gull.visible = false;
    return { gull, wl, wr };
  }
  function makeChar(id, color) {
    const shirt = M(color, { roughness: 0.7 });
    const real = !!(MD && MD.baigneur);
    const fig = real ? new Baigneur(MD.baigneur, { id, color }) : null;
    let root;
    if (fig) root = fig.root;
    else { // remplaçant le temps du chargement : une bille à la couleur du joueur
      root = new THREE.Group(); const m = new THREE.Mesh(G(new THREE.CapsuleGeometry(0.3, 0.6, 4, 10)), shirt); m.position.y = 0.7; m.castShadow = true; root.add(m);
    }
    const ring = new THREE.Mesh(ringG, B(color, { transparent: true, opacity: 0.85, depthWrite: false })); ring.rotation.x = -Math.PI / 2;
    const disc = new THREE.Mesh(discG, B(color, { transparent: true, opacity: 0.35, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.visible = false;
    const dizzyRing = new THREE.Group(); // étoiles qui tournent autour de la tête d'un étourdi
    for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(G(new THREE.OctahedronGeometry(0.07)), B(0xffd23f)); s.position.set(Math.sin(i * Math.PI / 2) * 0.42, 0, Math.cos(i * Math.PI / 2) * 0.42); dizzyRing.add(s); }
    dizzyRing.visible = false;
    const { gull, wl, wr } = makeGull(color, shirt);
    const aim = new THREE.Mesh(G(new THREE.RingGeometry(0.75, 0.9, 32)), B(color, { transparent: true, opacity: 0.7, depthWrite: false })); aim.rotation.x = -Math.PI / 2; aim.visible = false;
    const hand = new THREE.Mesh(G(new THREE.SphereGeometry(0.08, 8, 6)), B(0xffffff, { transparent: true, opacity: 0.9 })); hand.visible = false; // repère de la prise au bord
    deck.add(root, ring, disc, dizzyRing, gull, aim, hand);
    return { root, fig, real, ring, disc, dizzyRing, gull, wl, wr, aim, hand, shirt, flap: 0, st: -1, id };
  }
  function dropChar(c) {
    deck.remove(c.root, c.ring, c.disc, c.dizzyRing, c.gull, c.aim, c.hand);
    c.shirt.dispose(); c.ring.material.dispose(); c.disc.material.dispose(); c.aim.material.dispose();
    if (c.fig) c.fig.dispose();
  }
  function drawChar(c, p, dt, time) {
    const st = p.st, gullOn = st === ST.GULL;
    c.root.visible = !gullOn && !(st === ST.FALL && p.y < -1.1);
    c.gull.visible = gullOn; c.aim.visible = gullOn && p.alive;
    c.ring.visible = st === ST.RUN || st === ST.DOWN; c.disc.visible = st === ST.RUN && p.chg > 0;
    c.hand.visible = st === ST.HANG;
    c.dizzyRing.visible = (st === ST.RUN && (p.dz || 0) > 0.55) || st === ST.DOWN;
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
    if (c.disc.visible) { c.disc.position.set(p.x, 0.11, p.z); c.disc.scale.setScalar(0.3 + p.chgK * 0.6); }
    if (c.dizzyRing.visible) { c.dizzyRing.position.set(p.x, st === ST.DOWN ? 0.45 : 1.75, p.z); c.dizzyRing.rotation.y = time * 4; c.dizzyRing.scale.setScalar(st === ST.DOWN ? 0.8 : 1); }
    if (st === ST.HANG && p.hg) { c.hand.position.set(p.hg.ax + p.hg.nx * 0.05, 0.03, p.hg.az + p.hg.nz * 0.05); }
    if (c.fig) c.fig.update(p, dt, time);
    else { c.root.children[0].rotation.x = st === ST.DOWN ? Math.PI / 2 : 0; }
  }

  // ---------------------------------------------------------------- objets : pastèques, bouées, sardines
  const melonTex = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#2e9a3a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 12; i++) { g.strokeStyle = '#1b5e23'; g.lineWidth = 4 + (i % 3); g.beginPath(); const x = i * w / 12 + 4; g.moveTo(x, 0); g.bezierCurveTo(x + 5, h * 0.3, x - 5, h * 0.7, x + 2, h); g.stroke(); } });
  const melonG = G(new THREE.SphereGeometry(0.3, 18, 14)), melonM = M(0xffffff, { map: melonTex, roughness: 0.4 });
  const buoyTex = canvasTex(64, 8, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#ff3b30'; g.fillRect(i * w / 8, 0, w / 8, h); } });
  const buoyG = G(new THREE.TorusGeometry(0.36, 0.1, 10, 24)), buoyM = M(0xffffff, { map: buoyTex, roughness: 0.45 });
  const fishG = G(new THREE.SphereGeometry(0.12, 10, 8)), fishM = M(0x8fb3c9, { metalness: 0.5, roughness: 0.3 }), tailG = G(new THREE.ConeGeometry(0.09, 0.14, 4));
  const shadowM = B(0x000000, { transparent: true, opacity: 0.25, depthWrite: false });
  const objs = new Map();
  function makeObj(k) {
    const g = new THREE.Group();
    if (k === 'melon') { const m = new THREE.Mesh(melonG, melonM); m.scale.set(1, 0.85, 1.25); m.position.y = 0.26; m.castShadow = true; g.add(m); }
    else if (k === 'buoy') { if (MD && MD.bouee) { const b = cloneStatic(MD.bouee.scene); b.position.y = 0.05; g.add(b); } else { const m = new THREE.Mesh(buoyG, buoyM); m.rotation.x = Math.PI / 2; m.position.y = 0.12; m.castShadow = true; g.add(m); } }
    else { const m = new THREE.Mesh(fishG, fishM); m.scale.set(0.7, 0.8, 2); const t = new THREE.Mesh(tailG, fishM); t.rotation.x = -Math.PI / 2; t.position.z = -0.28; g.add(m, t); }
    const sh = new THREE.Mesh(discG, shadowM); sh.rotation.x = -Math.PI / 2; sh.visible = false;
    deck.add(g, sh);
    return { g, sh, spin: Math.random() * 6 };
  }
  function drawObj(o, x, dt, time) {
    o.g.position.set(x.x, x.y, x.z);
    if (x.st === 2) { o.spin += dt * 8; o.g.rotation.set(o.spin, o.spin * 0.7, 0); }
    else if (x.st === 0) { o.g.rotation.set(0, time * (x.k === 'buoy' ? 0.8 : 0), 0); if (x.k === 'buoy') o.g.position.y = 0.05 + Math.sin(time * 3) * 0.05; }
    else o.g.rotation.set(0, 0, 0);
    o.sh.visible = x.st === 2 && x.y > 0.6;
    if (o.sh.visible) { o.sh.position.set(x.x, 0.12, x.z); o.sh.scale.setScalar(0.2 + Math.min(0.5, x.y * 0.06)); }
  }

  // ---------------------------------------------------------------- effets : gouttes, ronds dans l'eau, éclats, vent
  const PMAX = 500;
  const partsM = new THREE.InstancedMesh(G(new THREE.IcosahedronGeometry(0.07, 0)), B(0xffffff), PMAX);
  partsM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PMAX * 3), 3);
  partsM.frustumCulled = false; scene.add(partsM);
  const P = Array.from({ length: PMAX }, () => ({ life: 0 }));
  let pNext = 0;
  const _c = new THREE.Color();
  function emit(x, y, z, n, { speed = 3, up = 4, color = 0xffffff, size = 1, life = 0.8, grav = 12, spread = 1, floor = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const idx = pNext, q = P[idx]; pNext = (pNext + 1) % PMAX;
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      Object.assign(q, { x: x + (Math.random() - 0.5) * 0.3 * spread, y, z: z + (Math.random() - 0.5) * 0.3 * spread, vx: Math.cos(a) * s, vy: up * (0.5 + Math.random() * 0.7), vz: Math.sin(a) * s, life, max: life, size: size * (0.6 + Math.random() * 0.8), grav, floor });
      partsM.setColorAt(idx, _c.set(Array.isArray(color) ? color[i % color.length] : color));
    }
    partsM.instanceColor.needsUpdate = true;
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
    hit(x, z, k = 0) { emit(x, DECK + 0.9, z, 10 + Math.round(k * 12), { speed: 3 + k * 3, up: 2, color: [0xffe066, 0xffffff, 0xffb703], life: 0.35, grav: 4, floor: DECK }); ring(x, z, 0.9 + k, 0.35, DECK + 0.1); shake = Math.max(shake, 0.06 + k * 0.14); },
    jab(x, z) { emit(x, DECK + 1.0, z, 6, { speed: 2, up: 1.5, color: [0xffffff, 0xffe066], life: 0.25, grav: 3, floor: DECK }); },
    ko(x, z) { emit(x, DECK + 0.3, z, 16, { speed: 2.5, up: 2.5, color: [0xffd23f, 0xffffff], life: 0.6, grav: 6, floor: DECK }); ring(x, z, 1.4, 0.5, DECK + 0.1); shake = Math.max(shake, 0.16); },
    bump(x, z) { emit(x, DECK + 0.6, z, 5, { speed: 2, up: 1.5, color: 0xffffff, life: 0.25, grav: 4, floor: DECK }); },
    splat(x, z) { emit(x, DECK + 1, z, 26, { speed: 3.5, up: 3, color: [0xff3b4f, 0xff6b6b, 0x2f8f2f, 0x111111, 0xffd0d0], life: 0.7, size: 1.3, floor: DECK }); shake = Math.max(shake, 0.1); },
    fish(x, z, water) { if (water) fx.plop(x, z); else { emit(x, DECK + 0.2, z, 12, { speed: 2, up: 2, color: [0xbfd7e6, 0xffffff], life: 0.5, floor: DECK }); ring(x, z, 1.4, 0.5, DECK + 0.1); } },
    land(x, z) { emit(x, DECK + 0.1, z, 8, { speed: 1.8, up: 1.2, color: 0xe6c79a, life: 0.4, grav: 6, floor: DECK }); },
    hang(x, z) { emit(x, 0.05, z, 8, { speed: 1.2, up: 2, color: [0xffffff, 0xd6f3ff], life: 0.5 }); ring(x, z, 0.9, 0.6); },
    sinkTile(x, z) { emit(x, 0, z, 16, { speed: 1.4, up: 2.5, color: [0xffffff, 0xc9965f], life: 0.8 }); ring(x, z, 1.6, 1.2); },
    bubbles(x, z) { emit(x, -0.05, z, 6, { speed: 0.4, up: 1.4, color: 0xe8fbff, life: 0.6, grav: 1, size: 0.7 }); },
    sparkle(x, y, z, color) { emit(x, DECK + y, z, 14, { speed: 1.6, up: 2.5, color: [color, 0xffffff], life: 0.6, grav: 3, size: 0.8, floor: DECK }); },
  };
  function stepFx(dt, wind) {
    for (let i = 0; i < PMAX; i++) {
      const q = P[i];
      if (q.life > 0) {
        q.life -= dt; q.vy -= q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
        if (q.y < q.floor - 0.05 && q.vy < 0) q.life = 0;
        const s = q.life > 0 ? q.size * Math.min(1, q.life / q.max * 2) : 0;
        _m.compose(_p.set(q.x, q.y, q.z), _q.identity(), _s.setScalar(s));
      } else _m.makeScale(0, 0, 0);
      partsM.setMatrixAt(i, _m);
    }
    partsM.instanceMatrix.needsUpdate = true;
    for (const r of rings) {
      if (!r.m.visible) continue;
      r.t += dt; const k = r.t / r.max;
      if (k >= 1) { r.m.visible = false; continue; }
      r.m.scale.setScalar(0.2 + r.r * k); r.m.material.opacity = (1 - k) * 0.8;
    }
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
    if (v.sh && (v.rd !== raft.rd || v.sh !== raft.key || !raft.arena || raft.big !== (v.bg ? 1 : 0))) setArena(v.sh, v.bg, v.rd);
    updateTiles(v.ti, dt, time);
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
    const os = new Set();
    for (const o of v.objs) {
      os.add(o.id);
      let m = objs.get(o.id);
      if (!m) { m = makeObj(o.k); objs.set(o.id, m); }
      drawObj(m, o, dt, time);
    }
    for (const [id, m] of objs) if (!os.has(id)) { deck.remove(m.g, m.sh); objs.delete(id); }
    // la mer bouge, les bateaux dérivent, les bouées dansent, l'écume avance et recule
    waterN.offset.set(time * 0.012, time * 0.008);
    for (const b of boats) {
      b.a += b.w * dt; const cx = Math.sin(b.a) * b.r, cz = Math.cos(b.a) * b.r;
      b.obj.position.set(cx, Math.sin(time * 0.9 + b.a) * b.bob, cz); b.obj.rotation.y = b.a + (b.w > 0 ? Math.PI : 0); b.obj.rotation.z = Math.sin(time * 0.7 + b.a) * 0.04;
    }
    for (const m of marks) { m.position.y = Math.sin(time * 1.4 + m.position.x) * 0.1; m.rotation.z = Math.sin(time * 1.1 + m.position.z) * 0.08; }
    foam.position.z = -13.4 + Math.sin(time * 0.6) * 0.6; foam.material.opacity = 0.35 + Math.sin(time * 0.6) * 0.2;
    stepFx(dt, v.wind);
    shake = Math.max(0, shake - dt * 0.6);
    const sx = shake ? (Math.random() - 0.5) * shake : 0, sz = shake ? (Math.random() - 0.5) * shake : 0;
    const d = camDist * zoomK;
    camera.position.set(target.x + sx, target.y + Math.sin(PITCH) * d, target.z + Math.cos(PITCH) * d + sz);
    camera.lookAt(target.x + sx * 0.5, target.y, target.z + sz * 0.5);
    renderer.render(scene, camera);
  }
  function toScreen(x, y, z) {
    tmpV.set(x, y + DECK, z).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: (tmpV.x * 0.5 + 0.5) * r.width + r.left, y: (-tmpV.y * 0.5 + 0.5) * r.height + r.top, on: tmpV.z < 1 };
  }
  // un joueur encaisse un coup : son baigneur joue l'animation
  function hurt(id) { const c = chars.get(id); if (c && c.fig) c.fig.once('HitRecieve', 1.6); }

  function dispose() {
    if (disposed) return;
    disposed = true;
    removeEventListener('resize', resize);
    for (const c of chars.values()) dropChar(c);
    scene.traverse((o) => { if (o.geometry) owned.geo.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { owned.mat.add(m); for (const k of ['map', 'normalMap']) if (m[k]) owned.tex.add(m[k]); }); });
    owned.geo.forEach((g) => g.dispose()); owned.mat.forEach((m) => m.dispose()); owned.tex.forEach((t) => t.dispose());
    renderer.dispose(); renderer.forceContextLoss();
    canvas.remove();
  }

  resize();
  setArena('radeau', 0, 0);
  return { frame, fx, hurt, toScreen, dispose, resize, ready, zoom: (k) => { zoomK = k; }, canvas, three: scene };
}
