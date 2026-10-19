// Plateau en vraie 3D (Three.js / WebGL) : plateau texturé posé sur une table en bois, pions et maisons en volume,
// dés physiques, caméra orbitale (clic-glisser pour tourner, molette pour zoomer).
// Même interface que le plateau CSS (board.js), qui reste utilisé si WebGL n'est pas disponible.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { OrbitControls } from '../../shared/vendor/three/OrbitControls.js';
import { RoomEnvironment } from '../../shared/vendor/three/RoomEnvironment.js';
import { SIZE, CORNER, CELL, rect, side, pawnSpot, buildSpots, center, cellAt } from './geometry.js';
import { ICONS, spaceIcon } from './icons.js';
import { centerArt } from './board.js';
import { makeToken3d } from './tokens3d.js';
import { money, el, wait, store, save } from './util.js';

const U = 10;                    // 1 unité 3D = 10 px du plateau
const MARGIN = 15;               // marge crème autour des cases (px)
const TOP = 1.2;                 // hauteur du dessus du plateau
const TEX = 3072;                // résolution de la texture du plateau
const W = (SIZE + 2 * MARGIN) / U;
const toWorld = (x, y, h = TOP) => new THREE.Vector3(x / U - SIZE / 2 / U, h, y / U - SIZE / 2 / U);

/* ------------------------------------------------------------------ dessin de la texture du plateau */
const svgImg = (svg) => new Promise((res) => {
  const i = new Image();
  i.onload = () => res(i); i.onerror = () => res(null);
  i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.includes('xmlns=') ? svg : svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
});
const FONT = '"League Spartan", "Arial Black", "Helvetica Neue", Arial, sans-serif';
const shortName = (n) => n.replace(/^Boulevard /, 'Bd ').replace(/^Avenue /, 'Av. ').replace(/^Taxe de luxe — /, 'Taxe de luxe · ');

function wrap(ctx, text, maxW) {
  const words = text.toUpperCase().split(' '), lines = [];
  let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  return lines;
}

async function drawBoardTexture(board) {
  try { await Promise.all([document.fonts.load(`900 40px "League Spartan"`), document.fonts.load(`700 40px "League Spartan"`)]); } catch (e) {}
  const c = document.createElement('canvas'); c.width = c.height = TEX;
  const g = c.getContext('2d'), k = TEX / (SIZE + 2 * MARGIN);
  g.scale(k, k);
  g.fillStyle = '#fbf8ee'; g.fillRect(0, 0, SIZE + 2 * MARGIN, SIZE + 2 * MARGIN);
  g.strokeStyle = '#16181d'; g.lineWidth = 3; g.strokeRect(MARGIN - 1.5, MARGIN - 1.5, SIZE + 3, SIZE + 3);
  g.translate(MARGIN, MARGIN);
  // centre
  const css = `<style>.logo{font-family:'League Spartan','Arial Black',Impact,sans-serif;font-weight:900;font-size:60px;fill:#fff;stroke:#16181d;stroke-width:5px;paint-order:stroke}
    .logosub{font-family:'League Spartan',Arial,sans-serif;font-weight:700;font-size:15px;letter-spacing:6px;fill:#fff8ea}
    .deckl{font-family:'League Spartan',Arial,sans-serif;font-weight:800;font-size:15px;fill:#fff8ea}
    .deckq{font-family:'League Spartan','Arial Black',sans-serif;font-weight:900;font-size:76px;fill:#fff8ea;stroke:#16181d;stroke-width:4px;paint-order:stroke}</style>`;
  const art = await svgImg(centerArt().replace(/<svg ([^>]*)>/, (m) => m + css));
  if (art) g.drawImage(art, CORNER, CORNER, SIZE - 2 * CORNER, SIZE - 2 * CORNER);
  // icônes
  const icons = {};
  await Promise.all(board.spaces.map(async (sp) => { const s = spaceIcon(sp); if (s) icons[sp.i] = await svgImg(s); }));
  for (const k2 of ['go', 'bars', 'hill', 'police']) icons[k2] = await svgImg(ICONS[k2]);
  g.lineWidth = 1.6; g.strokeStyle = '#16181d';
  for (const sp of board.spaces) {
    const r = rect(sp.i), s = side(sp.i);
    g.save();
    g.translate(r.x + r.w / 2, r.y + r.h / 2);
    if (s === 'corner') { drawCorner(g, sp, icons); g.restore(); g.strokeRect(r.x, r.y, r.w, r.h); continue; }
    g.rotate({ bottom: 0, left: Math.PI / 2, top: Math.PI, right: -Math.PI / 2 }[s]);
    drawCell(g, sp, icons[sp.i]);
    g.restore();
    g.strokeRect(r.x, r.y, r.w, r.h);
  }
  return c;
}

// case dessinée « debout » : largeur CELL, hauteur CORNER, bande de couleur en haut (vers le centre du plateau)
function drawCell(g, sp, icon) {
  const w = CELL, h = CORNER, x0 = -w / 2, y0 = -h / 2;
  g.fillStyle = '#16181d';
  if (sp.type === 'street') { g.fillStyle = sp.color; g.fillRect(x0, y0, w, 24); g.fillStyle = '#16181d'; g.fillRect(x0, y0 + 23, w, 2); }
  g.textAlign = 'center'; g.textBaseline = 'top';
  g.font = `800 10.5px ${FONT}`;
  const lines = wrap(g, shortName(sp.name), w - 8);
  let y = sp.type === 'street' ? y0 + 30 : y0 + 8;
  for (const l of lines) { g.fillText(l, 0, y); y += 11.5; }
  if (icon) {
    const sz = sp.type === 'chance' || sp.type === 'chest' ? 38 : 30;
    g.drawImage(icon, -sz / 2, Math.max(y + 2, -sz / 2 + 6), sz, sz);
  }
  g.font = `600 10.5px ${FONT}`; g.textBaseline = 'bottom';
  const price = sp.price ? money(sp.price) : sp.amount ? 'Payez ' + money(sp.amount) : '';
  if (price) g.fillText(price, 0, h / 2 - 6);
}

function drawCorner(g, sp, icons) {
  const h = CORNER / 2;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#16181d';
  if (sp.type === 'go') {
    g.rotate(-Math.PI / 4);
    g.font = `700 8px ${FONT}`; g.fillText('RECEVEZ 200 € DE SALAIRE', 0, -24); g.fillText('EN PASSANT', 0, -15);
    g.font = `900 24px ${FONT}`; g.fillStyle = '#e3262f'; g.fillText('DÉPART', 0, 6);
    g.rotate(Math.PI / 4);
    if (icons.go) g.drawImage(icons.go, -h + 14, h - 34, CORNER - 28, 28);
  } else if (sp.type === 'jail') {
    g.fillStyle = '#F7941D'; g.fillRect(h - 76, -h, 76, 76); g.strokeRect(h - 76, -h, 76, 76);
    if (icons.bars) g.drawImage(icons.bars, h - 60, -h + 8, 44, 44);
    g.fillStyle = '#16181d'; g.font = `900 9px ${FONT}`; g.fillText('EN PRISON', h - 38, -h + 64);
    g.font = `900 13px ${FONT}`; g.fillText('VISITE', -6, h - 12);
    g.save(); g.rotate(-Math.PI / 2); g.fillText('SIMPLE', 6, -h + 12); g.restore();
  } else if (sp.type === 'parking') {
    g.rotate(-Math.PI / 4 + Math.PI);
    g.font = `900 14px ${FONT}`; g.fillText('PARC', 0, -30);
    if (icons.hill) g.drawImage(icons.hill, -21, -22, 42, 42);
    g.fillText('GRATUIT', 0, 30); g.font = `700 8px ${FONT}`; g.fillText('COLLINE DU CHÂTEAU', 0, 42);
  } else if (sp.type === 'gotojail') {
    g.rotate(Math.PI / 4 + Math.PI);
    g.font = `900 14px ${FONT}`; g.fillText('ALLEZ EN', 0, -30);
    if (icons.police) g.drawImage(icons.police, -21, -22, 42, 42);
    g.fillText('PRISON', 0, 30);
  }
}

function woodTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 1024); grd.addColorStop(0, '#8e5a33'); grd.addColorStop(1, '#6f4224');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 1024);
  for (let k = 0; k < 260; k++) {
    const y = Math.random() * 1024, a = 0.03 + Math.random() * 0.07;
    g.strokeStyle = Math.random() < 0.5 ? `rgba(40,20,8,${a})` : `rgba(255,220,170,${a * 0.7})`;
    g.lineWidth = 1 + Math.random() * 3; g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x / 140 + k) * 4);
    g.stroke();
  }
  for (let k = 1; k < 4; k++) { g.fillStyle = 'rgba(30,15,5,.35)'; g.fillRect(0, k * 256 - 1, 1024, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function diceFace(n) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fffdf6'; g.fillRect(0, 0, 128, 128);
  const P = { 1: [[64, 64]], 2: [[34, 34], [94, 94]], 3: [[30, 30], [64, 64], [98, 98]], 4: [[34, 34], [94, 34], [34, 94], [94, 94]],
    5: [[30, 30], [98, 30], [64, 64], [30, 98], [98, 98]], 6: [[34, 28], [94, 28], [34, 64], [94, 64], [34, 100], [94, 100]] }[n];
  g.fillStyle = n === 1 ? '#e3262f' : '#16181d';
  for (const [x, y] of P) { g.beginPath(); g.arc(x, y, n === 1 ? 16 : 11, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// faces du cube (ordre Three.js : +x, -x, +y, -y, +z, -z) et rotation qui met la valeur v sur le dessus
const FACE_VALUES = [3, 4, 1, 6, 2, 5];
function faceUp(v) {
  const e = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2] }[v];
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0], e[1], e[2]));
}
export const _dice = { FACE_VALUES, faceUp }; // tests

function labelTexture(text, { bg = '#2fbf71', fg = '#fff', w = 256, h = 96, size = 44 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.strokeStyle = '#16181d'; g.lineWidth = 6;
  g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 18); g.fill(); g.stroke();
  g.fillStyle = fg; g.font = `900 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ------------------------------------------------------------------ tweens */
function tweener() {
  const list = new Set();
  return {
    run(dur, fn) { return new Promise((res) => { list.add({ t0: performance.now(), dur: Math.max(1, dur), fn, res }); }); },
    tick(now) { for (const tw of list) { const k = Math.min(1, (now - tw.t0) / tw.dur); tw.fn(k); if (k >= 1) { list.delete(tw); tw.res(); } } },
    get busy() { return list.size > 0; },
  };
}
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/* ------------------------------------------------------------------ montage */
export async function mountBoard3d(host, board, { onCell } = {}) {
  const stage = el('div', 'stage3d');
  host.appendChild(stage);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
  if (!renderer.getContext()) throw new Error('WebGL indisponible');
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#5b3820');
  scene.fog = new THREE.Fog('#5b3820', 180, 420);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(36, 1, 1, 1000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 40; controls.maxDistance = 260;
  controls.minPolarAngle = 0.05; controls.maxPolarAngle = 1.32;
  controls.screenSpacePanning = false;

  // lumières
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a2412, 0.9));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
  sun.position.set(45, 110, 60); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 10, far: 300 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // table
  const table = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.75, metalness: 0 }));
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);

  // plateau
  const tex = new THREE.CanvasTexture(await drawBoardTexture(board));
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x16120f, roughness: 0.6 });
  const topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0 });
  const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(W, TOP, W), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
  boardMesh.position.y = TOP / 2; boardMesh.receiveShadow = true; boardMesh.castShadow = true;
  scene.add(boardMesh);
  // la texture inclut la marge : on décale les coordonnées pour que (0,0) px = coin des cases
  const pxToWorld = (x, y, h = TOP) => toWorld(x, y, h);

  /* ---------------------------------------------------------- calques sur les cases */
  const overlayGeo = new THREE.PlaneGeometry(1, 1);
  function overlay(i, color, opacity, lift = 0.02) {
    const r = rect(i), m = new THREE.Mesh(overlayGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.scale.set(r.w / U, r.h / U, 1);
    m.position.copy(pxToWorld(r.x + r.w / 2, r.y + r.h / 2, TOP + lift)); m.renderOrder = 2;
    scene.add(m); return m;
  }
  const hl = overlay(0, 0xffc531, 0); hl.visible = false;
  const hov = overlay(0, 0x1c5fb4, 0.18); hov.visible = false;
  const pulseM = overlay(0, 0xffc531, 0.0); pulseM.visible = false;
  function moveOverlay(m, i) { const r = rect(i); m.scale.set(r.w / U, r.h / U, 1); m.position.copy(pxToWorld(r.x + r.w / 2, r.y + r.h / 2, m.position.y)); }

  // bandes de propriétaire (bord extérieur de la case) et tampons « hypothéquée »
  const owners = [], morts = [];
  const mortTex = labelTexture('HYPOTHÉQUÉE', { bg: '#fff8ea', fg: '#c62a12', w: 320, h: 80, size: 36 });
  function ownerStrip(i) {
    const r = rect(i), s = side(i), th = 8;
    const geo = new THREE.BoxGeometry(1, 0.2, 1), m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
    let x = r.x + r.w / 2, y = r.y + r.h / 2, w = r.w, h = r.h;
    if (s === 'bottom') { y = r.y + r.h - th / 2; h = th; } else if (s === 'top') { y = r.y + th / 2; h = th; }
    else if (s === 'left') { x = r.x + th / 2; w = th; } else if (s === 'right') { x = r.x + r.w - th / 2; w = th; }
    m.scale.set(w / U, 1, h / U); m.position.copy(pxToWorld(x, y, TOP + 0.1)); m.visible = false; m.castShadow = true;
    scene.add(m); return m;
  }
  for (const sp of board.spaces) {
    if (!sp.price) continue;
    owners[sp.i] = ownerStrip(sp.i);
    const r = rect(sp.i), s = side(sp.i);
    const mm = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(r.w, r.h) / U * 1.05, Math.min(r.w, r.h) / U * 0.27), new THREE.MeshBasicMaterial({ map: mortTex, transparent: true, depthWrite: false }));
    mm.rotation.x = -Math.PI / 2; mm.rotation.z = { bottom: 0.45, top: Math.PI + 0.45, left: -Math.PI / 2 + 0.45, right: Math.PI / 2 + 0.45 }[s] || 0;
    mm.position.copy(pxToWorld(r.x + r.w / 2, r.y + r.h / 2, TOP + 0.05)); mm.visible = false; mm.renderOrder = 3;
    scene.add(mm); morts[sp.i] = mm;
  }

  // cagnotte du Parc gratuit (règle maison)
  let potValue = null;
  const potSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture('0 €'), depthTest: false }));
  potSprite.scale.set(9, 3.4, 1); potSprite.position.copy(pxToWorld(CORNER / 2, CORNER / 2, TOP + 5)); potSprite.visible = false; potSprite.renderOrder = 5;
  scene.add(potSprite);

  /* ---------------------------------------------------------- pions, bâtiments */
  const T = tweener();
  const pawns = new Map();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.22, 10, 40), new THREE.MeshBasicMaterial({ color: 0xffc531 }));
  ring.rotation.x = Math.PI / 2; ring.visible = false; scene.add(ring);
  let curId = null;
  function ensurePawn(p) {
    let o = pawns.get(p.id);
    if (!o) {
      const obj = makeToken3d(p.token, p.color);
      obj.scale.setScalar(0.92);
      scene.add(obj);
      o = { obj, pos: p.pos, inJail: p.inJail };
      pawns.set(p.id, o);
    }
    return o;
  }
  const placeAt = (o, s) => { const w = pxToWorld(s.x, s.y, TOP); o.obj.position.set(w.x, TOP, w.z); };
  function layoutPawns(players) {
    const groups = new Map();
    for (const p of players) {
      if (p.bankrupt) continue;
      const o = pawns.get(p.id); if (!o || o.moving) continue;
      const key = o.pos + (o.pos === 10 && o.inJail ? 'j' : '');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o);
    }
    for (const list of groups.values()) list.forEach((o, k) => placeAt(o, pawnSpot(o.pos, k, list.length, o.inJail)));
  }
  const builds = new Map();
  const houseMat = new THREE.MeshStandardMaterial({ color: 0x2fbf71, roughness: 0.45 }), hotelMat = new THREE.MeshStandardMaterial({ color: 0xe3262f, roughness: 0.45 });
  function houseMesh(hotel) {
    const g = new THREE.Group(), w = hotel ? 2.6 : 1.3, d = hotel ? 1.3 : 1.3, h = hotel ? 1.5 : 1.1;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hotel ? hotelMat : houseMat); body.position.y = h / 2;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, d * 0.78, w, 4, 1), hotel ? hotelMat : houseMat);
    roof.rotation.z = Math.PI / 2; roof.rotation.x = Math.PI / 4; roof.scale.set(0.62, 1, 1); roof.position.y = h + 0.32;
    for (const m of [body, roof]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
    return g;
  }
  function setBuildings(i, houses, hotel, animate) {
    const key = hotel ? 'H' : String(houses), cur = builds.get(i);
    if (cur && cur.key === key) return;
    const before = cur ? cur.objs.length : 0;
    if (cur) cur.objs.forEach((o) => scene.remove(o));
    const s = side(i), rotY = s === 'left' || s === 'right' ? Math.PI / 2 : 0;
    const objs = buildSpots(i, hotel ? 1 : houses, hotel).map((p, k) => {
      const m = houseMesh(hotel); m.rotation.y = rotY;
      const w = pxToWorld(p.x, p.y, TOP); m.position.set(w.x, TOP, w.z);
      scene.add(m);
      if (animate && (hotel || k >= before)) T.run(550, (t) => { m.position.y = TOP + 18 * (1 - t) * (1 - t) + Math.sin(t * Math.PI) * (t > 0.7 ? 0.5 : 0); });
      return m;
    });
    builds.set(i, { key, objs });
  }

  /* ---------------------------------------------------------- dés */
  const diceMats = FACE_VALUES.map((v) => new THREE.MeshStandardMaterial({ map: diceFace(v), roughness: 0.35 }));
  const dice = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 3.2, 1, 1, 1), diceMats);
    m.castShadow = true; m.visible = false; scene.add(m); return m;
  });

  /* ---------------------------------------------------------- caméra */
  const view = { top: !store('david_view3d', true), follow: store('david_follow', true), offsetPx: 0 };
  const home = () => {
    const aspect = camera.aspect || 1.6;
    const dist = (W * 0.62) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, aspect / 1.05);
    if (view.top) return { pos: new THREE.Vector3(0, dist * 1.02, 0.01), target: new THREE.Vector3(0, 0, 0) };
    return { pos: new THREE.Vector3(0, dist * 0.8, dist * 0.66), target: new THREE.Vector3(0, 0, 3) };
  };
  async function flyTo(pos, target, dur = 700) {
    const p0 = camera.position.clone(), t0 = controls.target.clone();
    await T.run(dur, (k) => { const e = ease(k); camera.position.lerpVectors(p0, pos, e); controls.target.lerpVectors(t0, target, e); });
  }
  let userMoved = false;
  controls.addEventListener('start', () => { userMoved = true; });
  function fit(instant = true) {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // le plateau est centré dans la zone libre (entre la colonne des joueurs à gauche et les boutons à droite)
    const off = w > 900 ? -60 : 0;
    camera.setViewOffset(w, h, off, 0, w, h);
    camera.updateProjectionMatrix();
    if (instant) { const hm = home(); camera.position.copy(hm.pos); controls.target.copy(hm.target); controls.update(); }
  }
  new ResizeObserver(() => fit(!userMoved)).observe(stage);

  /* ---------------------------------------------------------- souris : case visée */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP);
  function pickCell(cx, cy) {
    const b = renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, p)) return -1;
    return cellAt((p.x + SIZE / 2 / U) * U, (p.z + SIZE / 2 / U) * U);
  }
  let down = null, hover = -1;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) { const i = pickCell(e.clientX, e.clientY); if (i >= 0 && onCell) onCell(i); }
    down = null;
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (down) return;
    const i = pickCell(e.clientX, e.clientY);
    if (i === hover) return;
    hover = i; hov.visible = i >= 0; if (i >= 0) moveOverlay(hov, i);
    renderer.domElement.style.cursor = i >= 0 ? 'pointer' : 'grab';
  });
  renderer.domElement.addEventListener('pointerleave', () => { hover = -1; hov.visible = false; });

  /* ---------------------------------------------------------- boucle de rendu */
  let pulseOn = false;
  renderer.setAnimationLoop((now) => {
    if (document.hidden) return;
    T.tick(now);
    controls.update();
    if (curId != null && pawns.get(curId)) {
      const o = pawns.get(curId); ring.visible = o.obj.visible;
      ring.position.set(o.obj.position.x, o.obj.position.y + 0.08, o.obj.position.z);
      const s = 1 + Math.sin(now / 260) * 0.08; ring.scale.set(s, s, s);
    } else ring.visible = false;
    if (pulseOn) pulseM.material.opacity = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(now / 220));
    renderer.render(scene, camera);
  });

  const screenOf = (v) => {
    const b = renderer.domElement.getBoundingClientRect(), p = v.clone().project(camera);
    return { x: b.left + (p.x + 1) / 2 * b.width, y: b.top + (1 - p.y) / 2 * b.height };
  };

  /* ---------------------------------------------------------- API (identique au plateau CSS) */
  const api = {
    stage, renderer, scene, camera, kind: '3d',
    sync(S, { animateBuild = false } = {}) {
      for (const p of S.players) {
        const o = ensurePawn(p);
        if (!o.moving) { o.pos = p.pos; o.inJail = p.inJail; }
        o.obj.visible = !p.bankrupt;
      }
      layoutPawns(S.players);
      for (const sp of board.spaces) {
        const pr = S.props[sp.i]; if (!pr) continue;
        const owner = S.players.find((q) => q.id === pr.owner);
        api.markOwner(sp.i, owner ? owner.color : null);
        morts[sp.i].visible = !!pr.mortgaged;
        if (sp.type === 'street') setBuildings(sp.i, pr.houses, pr.hotel, animateBuild);
      }
      const showPot = !!S.cfg.freeParkingJackpot;
      potSprite.visible = showPot;
      if (showPot && potValue !== S.pot) { potValue = S.pot; potSprite.material.map.dispose(); potSprite.material.map = labelTexture(money(S.pot || 0)); potSprite.material.needsUpdate = true; }
    },
    markOwner(i, color) {
      const m = owners[i]; if (!m) return;
      m.visible = !!color; if (color) m.material.color.set(color);
    },
    setCurrent(id) { curId = id; },
    select(i) { hl.visible = i >= 0; if (i >= 0) { moveOverlay(hl, i); hl.material.opacity = 0.35; } },
    pulse(i) { pulseOn = i >= 0; pulseM.visible = i >= 0; if (i >= 0) moveOverlay(pulseM, i); },
    async hop(pid, steps, speed = 1) {
      const o = pawns.get(pid); if (!o || !steps) return;
      const dir = Math.sign(steps), n = Math.abs(steps), dur = Math.max(70, 200 / speed);
      o.moving = true; o.inJail = false;
      const follow = view.follow && speed <= 1.5 && !userMoved;
      if (follow) { const c = center(o.pos), w = pxToWorld(c.x, c.y, 0); flyTo(new THREE.Vector3(w.x * 0.55, 62, w.z * 0.55 + 50), new THREE.Vector3(w.x * 0.6, 0, w.z * 0.6), 600); }
      for (let k = 0; k < n; k++) {
        o.pos = (o.pos + dir + 40) % 40;
        const from = o.obj.position.clone(), s = pawnSpot(o.pos, 0, 1, false), to = pxToWorld(s.x, s.y, TOP);
        await T.run(dur, (t) => { o.obj.position.lerpVectors(from, to, ease(t)); o.obj.position.y = TOP + Math.sin(t * Math.PI) * 2.6; });
        api.onStep && api.onStep(o.pos, speed);
        if (follow && k % 3 === 2) { const c = center(o.pos), w = pxToWorld(c.x, c.y, 0); flyTo(new THREE.Vector3(w.x * 0.55, 62, w.z * 0.55 + 50), new THREE.Vector3(w.x * 0.6, 0, w.z * 0.6), 500); }
      }
      o.moving = false;
    },
    async slide(pid, to, inJail, speed = 1) {
      const o = pawns.get(pid); if (!o) return;
      o.pos = to; o.inJail = inJail; o.moving = true;
      const from = o.obj.position.clone(), s = pawnSpot(to, 0, 1, inJail), dest = pxToWorld(s.x, s.y, TOP);
      await T.run(700 / speed, (t) => { o.obj.position.lerpVectors(from, dest, ease(t)); o.obj.position.y = TOP + Math.sin(t * Math.PI) * 8; });
      o.moving = false;
    },
    async rollDice(values, speed = 1) {
      const dur = Math.max(300, 1300 / speed);
      const runs = values.map((v, k) => {
        const m = dice[k]; m.visible = true;
        const start = new THREE.Vector3(26 + k * 4, 14, 30 - k * 6), end = new THREE.Vector3(-3 + k * 6.5, TOP + 1.6, 4 - k * 3);
        const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
        const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.9);
        const q1 = yaw.multiply(faceUp(v));
        const spin = new THREE.Vector3(Math.random() - 0.5, 0.3, Math.random() - 0.5).normalize();
        return T.run(dur, (t) => {
          const e = 1 - Math.pow(1 - t, 3);
          m.position.lerpVectors(start, end, e);
          const bounce = t < 0.55 ? Math.sin((t / 0.55) * Math.PI) * 10 : t < 0.82 ? Math.sin(((t - 0.55) / 0.27) * Math.PI) * 2.5 : Math.sin(((t - 0.82) / 0.18) * Math.PI) * 0.6;
          m.position.y = end.y + bounce * (1 - e * 0.5);
          // rotation : tourne vite au début puis se pose sur la bonne face
          const extra = new THREE.Quaternion().setFromAxisAngle(spin, (1 - e) * 14);
          m.quaternion.copy(q0).slerp(q1, Math.min(1, e * 1.08)).premultiply(extra);
          if (t >= 1) m.quaternion.copy(q1);
        });
      });
      await Promise.all(runs);
      clearTimeout(api._diceT);
      api._diceT = setTimeout(() => { for (const m of dice) m.visible = false; }, 2600);
    },
    // valeur lue sur le dessus des dés (tests)
    diceTop() {
      return dice.map((m) => {
        const normals = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
        let best = -2, val = 0;
        normals.forEach((n, k) => { const v = new THREE.Vector3(...n).applyQuaternion(m.quaternion); if (v.y > best) { best = v.y; val = FACE_VALUES[k]; } });
        return val;
      });
    },
    relax() { if (!userMoved && !view.top) { const h = home(); flyTo(h.pos, h.target, 800); } },
    recenter() { userMoved = false; const h = home(); return flyTo(h.pos, h.target, 700); },
    cellScreen(i) { const c = center(i); const s = screenOf(pxToWorld(c.x, c.y, TOP)); return { ...s, w: 40, h: 40 }; },
    pawnScreen(pid) { const o = pawns.get(pid); if (!o) return null; return screenOf(o.obj.position.clone().add(new THREE.Vector3(0, 4, 0))); },
    pickCell,
    heat(list) {
      for (const m of api._heat || []) { scene.remove(m); m.material.map && m.material.map.dispose(); }
      api._heat = [];
      if (!list) return;
      list.forEach((h, i) => {
        if (!h) return;
        const r = rect(i), m = new THREE.Mesh(new THREE.PlaneGeometry(r.w / U, r.h / U), new THREE.MeshBasicMaterial({ map: labelTexture(h.label, { bg: h.bg, fg: h.ink, w: 160, h: 160, size: 40 }), transparent: true, opacity: 0.92, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.copy(pxToWorld(r.x + r.w / 2, r.y + r.h / 2, TOP + 0.08)); m.renderOrder = 4;
        scene.add(m); api._heat.push(m);
      });
    },
    intro() {
      let k = 0;
      for (const o of pawns.values()) {
        const y0 = o.obj.position.y; o.obj.position.y = 60;
        setTimeout(() => T.run(650, (t) => { o.obj.position.y = y0 + 60 * (1 - t) * (1 - t); }).then(() => api.onStep && api.onStep(0, 1)), 300 + k * 260);
        k++;
      }
    },
    is3d: () => !view.top,
    toggle3d() { view.top = !view.top; save('david_view3d', !view.top); userMoved = false; const h = home(); flyTo(h.pos, h.target, 700); },
    follow: () => view.follow,
    toggleFollow() { view.follow = !view.follow; save('david_follow', view.follow); if (!view.follow) api.relax(); },
    fit,
  };
  fit(true);
  return api;
}
