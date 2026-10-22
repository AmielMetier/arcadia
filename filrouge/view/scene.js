// La pièce en 3D : table en bois sous une suspension, fenêtre sur la Baie des Anges la nuit, la bombe posée sur un tapis de découpe.
// Le démineur tourne la bombe au clavier (Z/S, Q/D, A/E — touches physiques, donc W/S, A/D, Q/E en QWERTY) ou à la souris,
// clique un module pour s'en approcher, clique ses pièces pour agir.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { RoomEnvironment } from '../../shared/vendor/three/RoomEnvironment.js';
import { woodTex, plasterTex, matTex, nightTex, canvasTex, roundRect, BUNG, FONT } from './tex.js';
import { buildBomb, CASE } from './bomb3d.js';
import { buildBook } from './book3d.js';
import { timeLeft } from '../engine/rules.js';

const TABLE = 1.0;
const ROT_SPEED = 2.1;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...o });
const shadowy = (me) => { me.castShadow = true; me.receiveShadow = true; return me; };

function buildRoom(scene) {
  const floorT = woodTex('#6b4429', '#4b2c17', 8, [5, 5]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), std('#ffffff', { map: floorT.tex, roughness: 0.75 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wallT = plasterTex('#b9a88e');
  const wallM = std('#ffffff', { map: wallT.tex, roughness: 0.95 });
  const walls = [
    { p: [0, 2.7, -5.5], r: 0, w: 14 }, { p: [-6.5, 2.7, 0], r: Math.PI / 2, w: 14 }, { p: [6.5, 2.7, 0], r: -Math.PI / 2, w: 14 }, { p: [0, 2.7, 7], r: Math.PI, w: 14 },
  ];
  for (const wl of walls) { const m = new THREE.Mesh(new THREE.PlaneGeometry(wl.w, 5.4), wallM); m.position.set(...wl.p); m.rotation.y = wl.r; m.receiveShadow = true; scene.add(m); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), std('#2a2622', { roughness: 1 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = 5.4; scene.add(ceil);
  // plinthes
  const skirt = std('#3b2a1e');
  const sk = new THREE.Mesh(new THREE.BoxGeometry(13, 0.2, 0.06), skirt); sk.position.set(0, 0.1, -5.47); scene.add(sk);

  // fenêtre de nuit
  const night = nightTex();
  const win = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.1), new THREE.MeshBasicMaterial({ map: night.tex, toneMapped: false, color: '#9aa6c8' }));
  win.position.set(-2.4, 2.9, -5.48); scene.add(win);
  const frameM = std('#e8e0d0', { roughness: 0.5 });
  for (const [w, h, x, y] of [[3.6, 0.12, 0, 1.08], [3.6, 0.12, 0, -1.08], [0.12, 2.28, -1.74, 0], [0.12, 2.28, 1.74, 0], [0.07, 2.1, 0, 0], [3.4, 0.06, 0, 0.3]]) {
    const f = shadowy(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), frameM)); f.position.set(-2.4 + x, 2.9 + y, -5.44); scene.add(f);
  }
  const sill = shadowy(new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.08, 0.35), frameM)); sill.position.set(-2.4, 1.78, -5.33); scene.add(sill);
  const moon = new THREE.PointLight('#6f86ff', 5, 9, 2); moon.position.set(-2.4, 2.8, -4.6); scene.add(moon);

  // affiche sur le mur de droite
  const poster = canvasTex(600, 820, (c, w, h) => {
    c.fillStyle = '#f3e9d2'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#c8102e'; c.fillRect(0, 0, w, 210);
    c.fillStyle = '#fff8ea'; c.font = `66px ${BUNG}`; c.textAlign = 'center'; c.fillText('FIL ROUGE', w / 2, 110);
    c.font = `600 30px ${FONT}`; c.fillText('BRIGADE DE DÉMINAGE · NICE', w / 2, 165);
    c.fillStyle = '#16181d'; c.font = `40px ${BUNG}`;
    ['RÈGLE N°1', 'ON NE PANIQUE PAS', '', 'RÈGLE N°2', 'ON DÉCRIT CE', 'QU’ON VOIT', '', 'RÈGLE N°3', 'ON ÉCOUTE', 'L’EXPERT'].forEach((t, k) => c.fillText(t, w / 2, 290 + k * 50));
    c.strokeStyle = '#16181d'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
  });
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.9), std('#fff', { map: poster.tex, roughness: 0.8 }));
  pm.position.set(6.47, 2.8, -1.2); pm.rotation.y = -Math.PI / 2; scene.add(pm);
  // horloge
  const clock = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#f7f3ea'; c.beginPath(); c.arc(w / 2, h / 2, 120, 0, 7); c.fill(); c.lineWidth = 12; c.strokeStyle = '#16181d'; c.stroke();
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; c.fillStyle = '#16181d'; c.fillRect(w / 2 + Math.cos(a) * 96 - 4, h / 2 + Math.sin(a) * 96 - 4, 8, 8); }
    c.lineWidth = 8; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + 50, h / 2 - 30); c.stroke();
    c.lineWidth = 5; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 - 20, h / 2 - 84); c.stroke();
  });
  const cm = new THREE.Mesh(new THREE.CircleGeometry(0.45, 40), std('#fff', { map: clock.tex })); cm.position.set(2.6, 3.7, -5.47); scene.add(cm);
  // étagère et cartons
  const shelf = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 3), std('#5a3a22'))); shelf.position.set(-6.25, 2.4, -1.5); scene.add(shelf);
  [['#b88a56', 0.5, -2.4], ['#a77a48', 0.38, -1.7], ['#c99a62', 0.44, -0.9]].forEach(([col, s, z]) => {
    const b = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.42, s, 0.5), std(col, { roughness: 0.9 }))); b.position.set(-6.2, 2.43 + s / 2, z); scene.add(b);
  });

  // table
  const top = woodTex('#9b6a40', '#7a4f2c', 5);
  const tm = std('#ffffff', { map: top.tex, roughness: 0.55 });
  const table = shadowy(new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.12, 3.9), tm)); table.position.set(0, TABLE - 0.06, 0); scene.add(table);
  for (const [x, z] of [[-3.6, -1.75], [3.6, -1.75], [-3.6, 1.75], [3.6, 1.75]]) {
    const leg = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.14, TABLE - 0.12, 0.14), std('#4b2f1b'))); leg.position.set(x, (TABLE - 0.12) / 2, z); scene.add(leg);
  }
  const mat = matTex();
  const mm = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.75), std('#ffffff', { map: mat.tex, roughness: 0.9 }));
  mm.rotation.x = -Math.PI / 2; mm.position.set(0, TABLE + 0.002, 0.15); mm.receiveShadow = true; scene.add(mm);

  // tasse de café
  const mug = new THREE.Group();
  const cup = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.34, 28, 1, true), std('#f2efe8', { roughness: 0.3, side: THREE.DoubleSide })));
  cup.position.y = 0.17; mug.add(cup);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), std('#f2efe8')); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.01; mug.add(bottom);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), std('#2b170b', { roughness: 0.15 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.28; mug.add(coffee);
  const ear = shadowy(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 10, 20), std('#f2efe8', { roughness: 0.3 }))); ear.position.set(0.19, 0.17, 0); mug.add(ear);
  mug.position.set(-2.75, TABLE, 1.3); scene.add(mug);
  // caisse à outils
  const tb = new THREE.Group();
  const tbx = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.42, 0.48), std('#c8102e', { roughness: 0.4, metalness: 0.4 }))); tbx.position.y = 0.21; tb.add(tbx);
  const lid = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.06, 0.5), std('#a50d26', { metalness: 0.4 }))); lid.position.y = 0.44; tb.add(lid);
  const hd = shadowy(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 20, Math.PI), std('#16181d'))); hd.position.y = 0.47; tb.add(hd);
  tb.position.set(-2.55, TABLE, -1.25); tb.rotation.y = 0.35; scene.add(tb);
  // carnet et crayon
  const pad = canvasTex(400, 520, (c, w, h) => { c.fillStyle = '#fffbe8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#9fc3e8'; c.lineWidth = 2; for (let y = 70; y < h; y += 30) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } c.strokeStyle = '#e88'; c.beginPath(); c.moveTo(50, 0); c.lineTo(50, h); c.stroke(); c.fillStyle = '#2a3a7a'; c.font = `italic 30px ${FONT}`; c.fillText('rouge → ✂ ?', 70, 120); c.fillText('lot : ?', 70, 180); });
  const pm2 = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.025, 0.8), [std('#ddd'), std('#ddd'), std('#fff', { map: pad.tex }), std('#ddd'), std('#ddd'), std('#ddd')]));
  pm2.position.set(2.45, TABLE + 0.013, -0.85); pm2.rotation.y = -0.4; scene.add(pm2);
  const pencil = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8), std('#f4c51d'))); pencil.rotation.z = Math.PI / 2; pencil.rotation.y = 0.9; pencil.position.set(2.0, TABLE + 0.02, -0.5); scene.add(pencil);

  // suspension
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6), std('#111')); cord.position.set(0, 5.2, 0.2); scene.add(cord);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.42, 32, 1, true), std('#24543f', { side: THREE.DoubleSide, metalness: 0.5, roughness: 0.4 }));
  shade.position.set(0, 4.75, 0.2); scene.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff3d0' })); bulb.position.set(0, 4.6, 0.2); scene.add(bulb);
  const spot = new THREE.SpotLight('#ffe2b0', 150, 0, 0.62, 0.55, 2);
  spot.position.set(0, 4.65, 0.2); spot.target.position.set(0, TABLE, 0.1);
  spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.02;
  spot.shadow.camera.near = 0.5; spot.shadow.camera.far = 9;
  scene.add(spot, spot.target);
  const fill = new THREE.PointLight('#ffcf9a', 4, 10, 2); fill.position.set(0, 3.2, 3.2); scene.add(fill);
  const hemi = new THREE.HemisphereLight('#8090b8', '#2a1c12', 0.45); scene.add(hemi);
  return { spot, hemi, fill, bulb, moon };
}

export function createScene(host, { onPick, onFocus = () => {}, onBook = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  host.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Bombe en 3D : Z/S, Q/D, A/E pour la tourner, clic pour agir');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d0f14');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.25;
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
  const lights = buildRoom(scene);

  /* ---------------------------------------------------------------- bombe */
  const holder = new THREE.Group(); scene.add(holder);
  const spin = new THREE.Group(); holder.add(spin);
  let bomb = null, team = null, offset = 0;
  const corners = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) corners.push(new THREE.Vector3(x * CASE.w / 2, y * CASE.h / 2, z * CASE.d / 2));
  for (const x of [-0.47, 0.47]) corners.push(new THREE.Vector3(x, CASE.h / 2 + 0.47, 0));

  function setBomb(t, opts) {
    if (bomb) { spin.remove(bomb.root); }
    bomb = buildBomb(t.bomb, opts);
    spin.add(bomb.root);
    spin.quaternion.identity();
    team = t;
  }

  /* ---------------------------------------------------------------- manuel posé sur la table */
  const bookHolder = new THREE.Group();
  bookHolder.position.set(2.5, TABLE + 0.002, 1.32); bookHolder.rotation.y = 0.12;
  scene.add(bookHolder);
  let book = null, bookOn = false, bookLocked = false;
  const bookCam = { zoom: 1, pan: new THREE.Vector2() };
  function setManual(ed) {
    if (book && book.edition === ed) return;
    if (book) bookHolder.remove(book.root);
    book = ed ? Object.assign(buildBook(ed), { edition: ed }) : null;
    if (book) bookHolder.add(book.root);
    if (!book) setBookView(false);
  }
  // vue penchée sur le manuel ; lock : l'expert ne quitte jamais le manuel
  function setBookView(v, lock = bookLocked) {
    bookLocked = lock;
    v = (v || lock) && !!book;
    if (v === bookOn) return;
    bookOn = v; if (v) { unfocus(); bookCam.pan.set(0, 0); }
    onBook(bookOn);
  }

  /* ---------------------------------------------------------------- caméra */
  const cam = { dist: 5.6, fit: 5.6, zoom: 1, target: new THREE.Vector3(0, TABLE + 1.15, 0), pos: new THREE.Vector3(), look: new THREE.Vector3(0, TABLE + 1.15, 0), focus: -1, shake: 0, shakeAmp: 0 };
  const VIEW_DIR = new THREE.Vector3(0, 0.3, 1).normalize();
  cam.pos.copy(cam.target).addScaledVector(VIEW_DIR, cam.dist);
  camera.position.copy(cam.pos);

  // turn : remettre la bombe de face (ou de dos) pour montrer ce module
  function focusModule(m, turn = false) {
    if (bookOn && !bookLocked) setBookView(false);
    if (turn && team && team.bomb.modules[m]) {
      resetting = team.bomb.modules[m].slot >= 6 ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI) : new THREE.Quaternion();
    }
    cam.focus = m;
    onFocus(m);
  }
  function unfocus() { if (cam.focus !== -1) { cam.focus = -1; onFocus(-1); } }

  /* ---------------------------------------------------------------- clavier */
  const held = new Set();
  let resetting = null;
  const ROT_KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  const onKey = (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (bookOn && e.type === 'keydown' && ['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(e.code)) {
      if (/Right|Down/.test(e.code)) book.next(); else book.prev();
      e.preventDefault(); return;
    }
    if (bookOn && e.type === 'keydown' && e.code === 'Escape' && !bookLocked) { setBookView(false); return; }
    if (bookOn && bookLocked) return;
    if (ROT_KEYS.includes(e.code)) {
      if (bookOn && e.type === 'keydown') setBookView(false);
      if (e.type === 'keydown') { held.add(e.code); resetting = null; } else held.delete(e.code);
      e.preventDefault();
    } else if (e.type === 'keydown' && e.code === 'KeyR') { resetting = new THREE.Quaternion(); unfocus(); }
    else if (e.type === 'keydown' && e.code === 'KeyF') {
      resetting = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI).multiply(spin.quaternion.clone()); unfocus();
    } else if (e.type === 'keydown' && e.code === 'Escape') unfocus();
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  // une touche relâchée hors de la page (changement d'onglet, alt-tab) ne doit pas rester enfoncée
  const release = () => { held.clear(); down = null; };
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', release);

  const qTmp = new THREE.Quaternion();
  const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
  function rotateWorld(axis, ang) { qTmp.setFromAxisAngle(AX[axis], ang); spin.quaternion.premultiply(qTmp); spin.quaternion.normalize(); }

  /* ---------------------------------------------------------------- souris */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null, hovered = null;
  function hit(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const roots = [];
    if (book) roots.push(book.root);
    if (bomb && holder.visible) roots.push(bomb.root);
    // le lancer de rayon de three.js touche aussi les objets masqués : on les écarte
    const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    const hits = ray.intersectObjects(roots, true).filter((h) => shown(h.object));
    for (const h of hits) {
      if (book) { let o = h.object; while (o && o !== book.root) o = o.parent; if (o === book.root) return h.object.userData.pick ? { pick: h.object.userData.pick, obj: h.object } : { book: true }; }
      let o = h.object, mod = -1;
      while (o) { if (o.userData.pick) return { pick: o.userData.pick, obj: o }; if (o.userData.module !== undefined) { mod = o.userData.module; break; } o = o.parent; }
      if (mod >= 0) return { module: mod };
      return { bomb: true };
    }
    return null;
  }
  function setHover(o) {
    if (hovered === o) return;
    if (hovered) for (const mt of [].concat(hovered.material)) if (mt.userData.e0) { mt.emissive.copy(mt.userData.e0); mt.emissiveIntensity = mt.userData.ei0; }
    hovered = o;
    if (o) for (const mt of [].concat(o.material)) if (mt.emissive) { mt.userData.e0 = mt.userData.e0 || mt.emissive.clone(); mt.userData.ei0 = mt.userData.ei0 ?? mt.emissiveIntensity; mt.emissive.set('#ffe9a8'); mt.emissiveIntensity = 0.28; }
    canvas.style.cursor = o ? 'pointer' : 'grab';
  }
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus();
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, b: e.button, drag: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (down) {
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
      if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down.drag = true; if (!bookOn) { resetting = null; unfocus(); } }
      if (down.drag && bookOn) {
        // glisser sur le manuel : on le fait défiler sous les yeux
        const k = 0.0025 * bookCam.zoom;
        bookCam.pan.x = Math.max(-0.8, Math.min(0.8, bookCam.pan.x - dx * k));
        bookCam.pan.y = Math.max(-0.6, Math.min(0.6, bookCam.pan.y - dy * k));
      } else if (down.drag && holder.visible) { rotateWorld('y', dx * 0.008); rotateWorld('x', dy * 0.008); canvas.style.cursor = 'grabbing'; }
      down.lx = e.clientX; down.ly = e.clientY;
      return;
    }
    const h = hit(e);
    setHover(h && h.pick ? h.obj : null);
  });
  canvas.addEventListener('pointerup', (e) => {
    const d = down; down = null;
    if (!d || d.drag) { canvas.style.cursor = 'grab'; return; }
    if (d.b === 2) { if (bookOn && !bookLocked) setBookView(false); unfocus(); return; }
    const h = hit(e);
    if (bookOn) {
      if (h && h.pick && h.pick.book) {
        if (h.pick.book === 'next') book.next(); else if (h.pick.book === 'prev') book.prev(); else book.go(h.pick.s);
      } else if (!h || !h.book) { if (!bookLocked) setBookView(false); }
      return;
    }
    if (h && (h.book || (h.pick && h.pick.book))) { setBookView(true); return; }
    if (!h) { unfocus(); return; }
    if (h.pick) {
      const p = h.obj.userData.press;
      if (p) { p.position.z = p.userData.baseZ - 0.018; setTimeout(() => { p.position.z = p.userData.baseZ; }, 130); }
      // clic sur une pièce d'un module : on s'en approche aussi
      if (cam.focus !== h.pick.m) focusModule(h.pick.m);
      onPick(h.pick);
    } else if (h.module !== undefined) focusModule(cam.focus === h.module ? -1 : h.module);
    else unfocus();
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (bookOn) { bookCam.zoom = Math.max(0.45, Math.min(1.4, bookCam.zoom * (1 + Math.sign(e.deltaY) * 0.08))); return; }
    if (cam.focus !== -1 && e.deltaY > 0) { unfocus(); return; }
    cam.zoom = Math.max(0.5, Math.min(1.6, cam.zoom * (1 + Math.sign(e.deltaY) * 0.09)));
  }, { passive: false });

  /* ---------------------------------------------------------------- effets */
  const fx = { dark: 0, fog: 0, boom: null, particles: [] };
  function shake(amp, dur) { cam.shake = Math.max(cam.shake, dur); cam.shakeAmp = Math.max(cam.shakeAmp, amp); }
  function sabotage(kind) {
    if (kind === 'noir') fx.dark = 5.5;
    else if (kind === 'fumee') fx.fog = 7;
    else if (kind === 'secousse') shake(0.09, 2.6);
  }
  const flashLight = new THREE.PointLight('#ffb050', 0, 30, 1.6); scene.add(flashLight);
  function explode() {
    if (!bomb) return;
    const c = new THREE.Vector3(); bomb.root.getWorldPosition(c);
    flashLight.position.copy(c).add(new THREE.Vector3(0, 0.5, 0.8));
    fx.boom = { t: 0, c };
    spin.visible = false;
    shake(0.35, 1.6);
    const fire = [std('#ffcf4a', { emissive: '#ff9a1a', emissiveIntensity: 3 }), std('#ff6a1a', { emissive: '#ff4a00', emissiveIntensity: 2.5 }), std('#3a3a3a', { roughness: 1 })];
    for (let k = 0; k < 90; k++) {
      const me = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 + Math.random() * 0.25, 0), fire[k < 50 ? k % 2 : 2]);
      me.position.copy(c);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(3 + Math.random() * 6);
      scene.add(me); fx.particles.push({ me, v, life: 1.2 + Math.random() * 1.4, smoke: k >= 50 });
    }
  }

  /* ---------------------------------------------------------------- boucle */
  const clock = new THREE.Clock();
  const tmpV = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  let raf = 0, lastSec = -1, alive = true, onSecond = null;
  function frame() {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    // rotation au clavier (axes du monde : ce que l'on voit tourne comme on s'y attend)
    const k = (c) => (held.has(c) ? 1 : 0);
    const yaw = k('KeyD') - k('KeyA') + k('ArrowRight') - k('ArrowLeft');
    const pitch = k('KeyS') - k('KeyW') + k('ArrowDown') - k('ArrowUp');
    const roll = k('KeyQ') - k('KeyE');
    if (yaw || pitch || roll) {
      unfocus();
      if (yaw) rotateWorld('y', yaw * ROT_SPEED * dt);
      if (pitch) rotateWorld('x', pitch * ROT_SPEED * dt);
      if (roll) rotateWorld('z', roll * ROT_SPEED * dt);
    }
    if (resetting) { spin.quaternion.slerp(resetting, Math.min(1, dt * 7)); if (spin.quaternion.angleTo(resetting) < 0.002) { spin.quaternion.copy(resetting); resetting = null; } }
    // la bombe reste posée sur la table : sa hauteur suit son point le plus bas
    let minY = Infinity;
    for (const c of corners) { tmpV.copy(c).applyQuaternion(spin.quaternion); minY = Math.min(minY, tmpV.y); }
    const wantY = TABLE - minY + 0.005;
    holder.position.y += (wantY - holder.position.y) * Math.min(1, dt * 14);
    if (bomb) bomb.tick(dt);
    if (book) book.tick(dt);

    // chrono
    if (bomb && team) {
      const now = Date.now() + offset, ms = timeLeft(team, now);
      const sec = Math.ceil(ms / 1000);
      const flash = team.status === 'live' && ms < 30000 && ms % 1000 > 800;
      bomb.sync(team, ms, flash);
      if (sec !== lastSec) { const prev = lastSec; lastSec = sec; if (onSecond && team.status === 'live' && now >= team.clock.at && prev !== -1) onSecond(sec, team.clock.rate); }
    }

    // caméra : manuel, module en gros plan ou vue d'ensemble
    if (bookOn) {
      // au-dessus du livret, légèrement de face ; recul calculé pour voir la double page entière
      const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
      const fit = Math.max(1.02 / Math.tan(hfov / 2), 0.74 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.13;
      const c = new THREE.Vector3(bookCam.pan.x + 0.06, 0.03, bookCam.pan.y + 0.02).applyQuaternion(bookHolder.quaternion).add(bookHolder.position);
      const dir = new THREE.Vector3(0, 1, 0.3).normalize().applyQuaternion(bookHolder.quaternion);
      cam.target.lerp(c, Math.min(1, dt * 7));
      cam.pos.lerp(c.clone().addScaledVector(dir, fit * bookCam.zoom), Math.min(1, dt * 7));
    } else if (cam.focus !== -1 && bomb && bomb.mods[cam.focus]) {
      const g = bomb.mods[cam.focus].group;
      g.getWorldPosition(tmpV);
      g.getWorldQuaternion(tmpQ);
      tmpN.set(0, 0, 1).applyQuaternion(tmpQ);
      if (!resetting && tmpN.dot(VIEW_DIR) < -0.2) unfocus();
      cam.target.lerp(tmpV, Math.min(1, dt * 8));
      const want = tmpV.clone().addScaledVector(tmpN, 1.75).add(new THREE.Vector3(0, 0.12, 0));
      cam.pos.lerp(want, Math.min(1, dt * 6));
    } else {
      const base = new THREE.Vector3(0, TABLE + 1.15, 0);
      cam.target.lerp(base, Math.min(1, dt * 6));
      cam.pos.lerp(base.clone().addScaledVector(VIEW_DIR, cam.fit * cam.zoom), Math.min(1, dt * 6));
    }
    camera.position.copy(cam.pos);
    const t = clock.elapsedTime;
    if (!bookOn) { camera.position.x += Math.sin(t * 0.4) * 0.015; camera.position.y += Math.sin(t * 0.55) * 0.01; }
    if (cam.shake > 0) {
      cam.shake -= dt;
      const a = cam.shakeAmp * Math.min(1, cam.shake);
      camera.position.add(new THREE.Vector3((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a));
      if (cam.shake <= 0) cam.shakeAmp = 0;
    }
    camera.lookAt(cam.target);

    // sabotages : coupure de courant, fumée
    if (fx.dark > 0) fx.dark -= dt;
    const darkK = fx.dark > 0 ? (fx.dark > 5 ? (5.5 - fx.dark) * 2 : fx.dark < 0.5 ? 1 - fx.dark * 2 : 1) : 0;
    const flicker = darkK > 0 && Math.random() < 0.04 ? 0.5 : 0;
    lights.spot.intensity = 150 * (1 - darkK + flicker * darkK);
    lights.fill.intensity = 4 * (1 - darkK);
    lights.hemi.intensity = 0.45 * (1 - darkK * 0.92);
    lights.bulb.material.color.set(darkK > 0.5 ? '#332a20' : '#fff3d0');
    if (fx.fog > 0) {
      fx.fog -= dt;
      const dens = Math.min(1, fx.fog / 2) * 0.42;
      if (!scene.fog) scene.fog = new THREE.FogExp2('#9a9a9a', dens);
      scene.fog.density = dens;
      if (fx.fog <= 0) scene.fog = null;
    }
    // explosion
    if (fx.boom) {
      fx.boom.t += dt;
      flashLight.intensity = Math.max(0, 900 * (1 - fx.boom.t / 1.2));
    }
    for (let i = fx.particles.length - 1; i >= 0; i--) {
      const p = fx.particles[i];
      p.life -= dt;
      p.me.position.addScaledVector(p.v, dt);
      p.v.multiplyScalar(p.smoke ? 0.97 : 0.94); if (p.smoke) p.v.y += dt * 0.8; else p.v.y -= dt * 3;
      p.me.scale.multiplyScalar(p.smoke ? 1 + dt * 0.9 : 1 - dt * 0.6);
      p.me.rotation.x += dt * 2;
      if (p.life <= 0) { scene.remove(p.me); fx.particles.splice(i, 1); }
    }
    if (host.offsetParent !== null) renderer.render(scene, camera);
  }

  function resize() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // écran étroit : on recule pour garder toute la bombe
    camera.fov = w / h < 1 ? 56 : 40;
    camera.updateProjectionMatrix();
    // recul qui fait tenir toute la bombe en largeur
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    cam.fit = Math.max(5.6, 3.0 / Math.tan(hfov / 2));
  }
  const ro = new ResizeObserver(resize); ro.observe(host);
  resize();
  frame();
  canvas.style.cursor = 'grab';

  return {
    setBomb, setManual,
    setBombVisible(v) { holder.visible = v; },
    setBookView, get bookOn() { return bookOn; }, get book() { return book; },
    get debug() { return { held: [...held], resetting: !!resetting, q: spin.quaternion.toArray().map((v) => +v.toFixed(3)) }; },
    inkBook(sec) { if (book) book.ink(sec); },
    setTeam(t, off) { team = t; offset = off; },
    strike(m) { if (bomb) bomb.flashStrike(m); shake(0.06, 0.45); },
    sabotage, explode,
    onSecond(fn) { onSecond = fn; },
    reset() { resetting = new THREE.Quaternion(); unfocus(); },
    flip() { resetting = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI).multiply(spin.quaternion.clone()); unfocus(); },
    rotate(axis, ang) { resetting = null; rotateWorld(axis, ang); },
    focusModule, unfocus,
    get focused() { return cam.focus; },
    dispose() {
      alive = false; cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
      renderer.dispose(); canvas.remove();
    },
  };
}
