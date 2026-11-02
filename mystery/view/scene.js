// Mystère Mystère : la vue 3D (Three.js). Le manoir est construit une fois à partir de la grille (murs, sols, plafonds,
// escaliers, rambardes, portes, fenêtres, tableaux), fusionné par matière ; les meubles aussi. Puis, à chaque image :
// les personnages animés, les armes en main, les pièces d'or, les couteaux, le revolver tombé, les tirs, les lumières.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { mergeGeometries } from '../../shared/vendor/three/BufferGeometryUtils.js';
import { W, H, LEVELS, LV_Y, STORY, CEIL, DOOR_H, T, li, idx, cellT, STYLES, stairY, rayWorld } from '../engine/map.js';
import { sees, EYE } from '../engine/sim.js';
import { Models, PROC, revolver, coinGeometry, mat, SKINS, HAIRS } from './models.js';
import { surface, glowSprite, nameTag, painting, shade } from './textures.js';
import { FirstPerson } from './fpv.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerpA = (a, b, f) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * f; };
const hash = (n) => { let x = (n | 0) ^ 0x9e3779b9; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };

// ------------------------------------------------------------------ petit atelier de géométrie
class GB {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; }
  // quadrilatère p0..p3 (dans l'ordre du pourtour), tourné vers n
  quad(p0, p1, p2, p3, n, uv = [[0, 0], [1, 0], [1, 1], [0, 1]], col = [1, 1, 1, 1]) {
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    let P = [p0, p1, p2, p3], U = uv, C = col;
    if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) { P = [p0, p3, p2, p1]; U = [uv[0], uv[3], uv[2], uv[1]]; C = [col[0], col[3], col[2], col[1]]; }
    for (const k of [0, 1, 2, 0, 2, 3]) { this.p.push(...P[k]); this.n.push(...n); this.uv.push(...U[k]); this.c.push(C[k], C[k], C[k]); }
  }
  box(x0, y0, z0, x1, y1, z1, s = 1) {
    const f = (a, b, c, d, n, u) => this.quad(a, b, c, d, n, u);
    const U = (w, h) => [[0, 0], [w / s, 0], [w / s, h / s], [0, h / s]];
    f([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], U(x1 - x0, y1 - y0));
    f([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], U(x1 - x0, y1 - y0));
    f([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], U(z1 - z0, y1 - y0));
    f([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], U(z1 - z0, y1 - y0));
    f([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], U(x1 - x0, z1 - z0));
    f([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], U(x1 - x0, z1 - z0));
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    return g;
  }
}

export function createScene(stage, { map: M, quality = 'normal', onLost } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  let pr = Math.min(window.devicePixelRatio || 1, quality === 'bas' ? 1 : 1.5);
  renderer.setPixelRatio(pr);
  renderer.setSize(stage.clientWidth || innerWidth, stage.clientHeight || innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
  stage.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onLost && onLost(); });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a1426');
  scene.fog = new THREE.Fog('#1a1426', 22, 70);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 140);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  const resize = () => { const w = stage.clientWidth || innerWidth, h = stage.clientHeight || innerHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); };
  addEventListener('resize', resize); resize();

  // lumière d'ambiance : le soir, la lune par les fenêtres
  const hemi = new THREE.HemisphereLight('#fff0dc', '#4a3a5a', 1.6); scene.add(hemi);
  const moon = new THREE.DirectionalLight('#9fb6ff', 0.35); moon.position.set(-20, 30, -10); scene.add(moon);
  // réserve de lampes : les plus proches de la caméra reçoivent les vraies lumières
  const POOL = 10, pool = [];
  for (let i = 0; i < POOL; i++) { const l = new THREE.PointLight('#ffd9a0', 0, 13, 1.25); scene.add(l); pool.push(l); }
  const torch = new THREE.PointLight('#cfd8ff', 0, 7, 1.6); camera.add(torch); torch.position.set(0, 0.2, 0);
  const flash = new THREE.PointLight('#ffd27a', 0, 9, 2); scene.add(flash);

  const models = new Models();
  const propNames = [...new Set(M.props.map((p) => p.m).filter((n) => !PROC[n]))];
  const ready = models.ready.then(() => models.loadAll(propNames)).then(() => { buildProps(); fpv.setModels(models); });
  const world = new THREE.Group(); scene.add(world);

  // ================================================================== le manoir
  const builders = new Map();
  const gb = (key) => { let b = builders.get(key); if (!b) builders.set(key, b = new GB()); return b; };
  const styleOf = (lv, cx, cz) => {
    const L = li(lv); let r = M.room[L][idx(cx, cz)];
    if (r < 0 && lv === 1) r = M.room[li(0)][idx(cx, cz)];
    return STYLES[r >= 0 ? M.rooms[r].style : 'hall'] || STYLES.hall;
  };
  const open = (t) => t !== T.WALL;
  const DIRS = [[1, 0, [1, 0, 0]], [-1, 0, [-1, 0, 0]], [0, 1, [0, 0, 1]], [0, -1, [0, 0, -1]]];
  const PANEL = 1.1;
  for (const lv of LEVELS) {
    const L = li(lv), y0 = LV_Y[L];
    for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
      const t = M.t[L][idx(cx, cz)];
      if (t === T.WALL) {
        for (const [dx, dz, n] of DIRS) {
          const nx = cx + dx, nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
          const tn = M.t[L][idx(nx, nz)];
          if (!open(tn)) continue;
          const st = styleOf(lv, nx, nz);
          // la face est sur le bord commun aux deux cases
          let a, b;
          if (dx === 1) { a = [cx + 1, cz]; b = [cx + 1, cz + 1]; } else if (dx === -1) { a = [cx, cz + 1]; b = [cx, cz]; }
          else if (dz === 1) { a = [cx + 1, cz + 1]; b = [cx, cz + 1]; } else { a = [cx, cz]; b = [cx + 1, cz]; }
          const u0 = dx ? a[1] : a[0], u1 = dx ? b[1] : b[0];
          const panelTop = y0 + PANEL, top = y0 + STORY;
          // sous le vide du hall, le mur du rez-de-chaussée monte jusqu'au plafond de l'étage (le niveau 1 prend le relais)
          gb('panel:' + st.panel).quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], panelTop, b[1]], [a[0], panelTop, a[1]], n, [[u0 / 2.2, 0], [u1 / 2.2, 0], [u1 / 2.2, 1], [u0 / 2.2, 1]], [0.72, 0.72, 1, 1]);
          gb('wall:' + st.wall).quad([a[0], panelTop, a[1]], [b[0], panelTop, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], n, [[u0 / 1.6, panelTop / 1.6], [u1 / 1.6, panelTop / 1.6], [u1 / 1.6, top / 1.6], [u0 / 1.6, top / 1.6]], [1, 1, 0.85, 0.85]);
          // cimaise et plinthe
          const o = 0.03, ox = n[0] * o, oz = n[2] * o;
          gb('trim').quad([a[0] + ox, panelTop - 0.04, a[1] + oz], [b[0] + ox, panelTop - 0.04, b[1] + oz], [b[0] + ox, panelTop + 0.05, b[1] + oz], [a[0] + ox, panelTop + 0.05, a[1] + oz], n);
          if (lv !== -1) gb('trim').quad([a[0] + ox, y0 + CEIL - 0.16, a[1] + oz], [b[0] + ox, y0 + CEIL - 0.16, b[1] + oz], [b[0] + ox, y0 + CEIL, b[1] + oz], [a[0] + ox, y0 + CEIL, a[1] + oz], n);
        }
        continue;
      }
      // sol
      if (t === T.FLOOR || t === T.PROP || t === T.PASS) {
        const st = t === T.PASS ? STYLES.passage : styleOf(lv, cx, cz);
        gb('floor:' + st.floor).quad([cx, y0, cz], [cx + 1, y0, cz], [cx + 1, y0, cz + 1], [cx, y0, cz + 1], [0, 1, 0], [[cx / 2, cz / 2], [(cx + 1) / 2, cz / 2], [(cx + 1) / 2, (cz + 1) / 2], [cx / 2, (cz + 1) / 2]]);
      }
      // plafond : sauf sous un vide ou un escalier qui monte
      const up = lv < 1 ? M.t[L + 1][idx(cx, cz)] : T.WALL;
      const sameStair = t === T.STAIR && up === T.STAIR;
      if (!(lv < 1 && (up === T.VOID || sameStair)) && t !== T.VOID || (lv === 1)) {
        const yc = y0 + CEIL;
        gb(lv === -1 ? 'ceil-cave' : 'ceil').quad([cx, yc, cz], [cx + 1, yc, cz], [cx + 1, yc, cz + 1], [cx, yc, cz + 1], [0, -1, 0], [[cx / 2, cz / 2], [(cx + 1) / 2, cz / 2], [(cx + 1) / 2, (cz + 1) / 2], [cx / 2, (cz + 1) / 2]]);
      }
      // rambarde autour du vide
      if (lv === 1 && (t === T.FLOOR || t === T.PROP)) for (const [dx, dz] of DIRS) {
        const tn = cellT(M, 1, cx + dx, cz + dz);
        if (tn !== T.VOID) continue;
        railing(cx, cz, dx, dz, y0);
      }
    }
  }
  // dessous de la dalle de l'étage vu depuis le hall : le bord du vide
  for (const h of M.holes) {
    const yb = LV_Y[li(h.lv)] - 0.1, yt = LV_Y[li(h.lv)];
    const b = gb('trim');
    b.quad([h.x0, yb, h.z0], [h.x1 + 1, yb, h.z0], [h.x1 + 1, yt, h.z0], [h.x0, yt, h.z0], [0, 0, 1]);
  }
  function railing(cx, cz, dx, dz, y0) {
    const b = gb('rail'), y1 = y0 + 0.95;
    const x0 = dx === 1 ? cx + 0.92 : dx === -1 ? cx : cx, x1 = dx === 1 ? cx + 1 : dx === -1 ? cx + 0.08 : cx + 1;
    const z0 = dz === 1 ? cz + 0.92 : dz === -1 ? cz : cz, z1 = dz === 1 ? cz + 1 : dz === -1 ? cz + 0.08 : cz + 1;
    b.box(x0 - (dx ? 0.02 : 0), y1, z0 - (dz ? 0.02 : 0), x1 + (dx ? 0.02 : 0), y1 + 0.08, z1 + (dz ? 0.02 : 0));
    b.box(x0, y0, z0, x1, y0 + 0.12, z1);
    for (let k = 0; k < 4; k++) { const f = (k + 0.5) / 4; const px = dx ? (x0 + x1) / 2 : cx + f, pz = dz ? (z0 + z1) / 2 : cz + f; b.box(px - 0.03, y0 + 0.12, pz - 0.03, px + 0.03, y1, pz + 0.03); }
  }
  // escaliers : des marches pleines, et une rampe du côté ouvert
  for (const st of M.stairs) {
    const along = st.axis === 'z', a0 = along ? st.z0 : st.x0, a1 = (along ? st.z1 : st.x1) + 1, c0 = along ? st.x0 : st.z0, c1 = (along ? st.x1 : st.z1) + 1;
    const n = (a1 - a0) * 2, rise = st.yHi - st.yLo;
    for (let i = 0; i < n; i++) {
      // i = 0 en bas
      const s0 = st.top === 'min' ? a1 - (i + 1) * 0.5 : a0 + i * 0.5, s1 = s0 + 0.5, ytop = st.yLo + rise * (i + 1) / n;
      const b = gb('step');
      if (along) b.box(c0, st.yLo - 0.01, s0, c1, ytop, s1); else b.box(s0, st.yLo - 0.01, c0, s1, ytop, c1);
      // nez de marche
      const nb = gb('trim'), e = st.top === 'min' ? s0 : s1;
      if (along) nb.box(c0, ytop - 0.04, e - 0.03, c1, ytop + 0.01, e + 0.03); else nb.box(e - 0.03, ytop - 0.04, c0, e + 0.03, ytop + 0.01, c1);
      // tapis au milieu des marches des grands escaliers
      if (st.lo === 0 && st.hi === 1 && along) gb('runner').box(c0 + 0.35, ytop, s0, c1 - 0.35, ytop + 0.015, s1);
    }
    // rampes : de chaque côté ouvert
    for (const side of [c0, c1]) {
      const cOut = side === c0 ? c0 - 1 : c1;
      let openSide = false;
      for (let a = a0; a < a1; a++) { const cx = along ? cOut : a, cz = along ? a : cOut; const t0 = cellT(M, st.lo, cx, cz), t1 = cellT(M, st.hi, cx, cz); if ((t0 !== T.WALL && t0 !== T.STAIR) || (t1 !== T.WALL && t1 !== T.STAIR)) openSide = true; }
      if (!openSide) continue;
      const b = gb('rail'), cIn = side === c0 ? c0 + 0.04 : c1 - 0.04;
      for (let k = 0; k <= (a1 - a0) * 2; k++) {
        const a = a0 + k * 0.5, y = stairY(st, along ? (c0 + c1) / 2 : a, along ? a : (c0 + c1) / 2);
        if (along) b.box(cIn - 0.03, y, a - 0.03, cIn + 0.03, y + 0.95, a + 0.03); else b.box(a - 0.03, y, cIn - 0.03, a + 0.03, y + 0.95, cIn + 0.03);
      }
      // main courante : segments inclinés
      const steps = (a1 - a0) * 2;
      for (let k = 0; k < steps; k++) {
        const aa = a0 + k * 0.5, ab = aa + 0.5;
        const ya = stairY(st, along ? (c0 + c1) / 2 : aa, along ? aa : (c0 + c1) / 2) + 0.95, yb = stairY(st, along ? (c0 + c1) / 2 : ab, along ? ab : (c0 + c1) / 2) + 0.95;
        const yl = Math.min(ya, yb), yh = Math.max(ya, yb) + 0.07;
        if (along) b.box(cIn - 0.04, yl, aa, cIn + 0.04, yh, ab); else b.box(aa, yl, cIn - 0.04, ab, yh, cIn + 0.04);
      }
    }
  }
  // portes : linteau et chambranle
  for (const d of M.doors) {
    const y0 = LV_Y[li(d.lv)], b = gb('frame'), top = y0 + (d.arch ? 3.15 : DOOR_H);
    b.box(d.x0 - 0.02, top, d.z0 - 0.02, d.x1 + 1.02, y0 + STORY, d.z1 + 1.02);
    const horiz = d.z0 === d.z1; // l'ouverture court le long de x
    if (horiz) { b.box(d.x0 - 0.12, y0, d.z0 - 0.06, d.x0 + 0.06, top, d.z1 + 1.06); b.box(d.x1 + 0.94, y0, d.z0 - 0.06, d.x1 + 1.12, top, d.z1 + 1.06); b.box(d.x0 - 0.12, top - 0.12, d.z0 - 0.06, d.x1 + 1.12, top, d.z1 + 1.06); }
    else { b.box(d.x0 - 0.06, y0, d.z0 - 0.12, d.x1 + 1.06, top, d.z0 + 0.06); b.box(d.x0 - 0.06, y0, d.z1 + 0.94, d.x1 + 1.06, top, d.z1 + 1.12); b.box(d.x0 - 0.06, top - 0.12, d.z0 - 0.12, d.x1 + 1.06, top, d.z1 + 1.12); }
  }
  // fenêtres : un carreau éclairé par la lune et des rideaux
  const SIDE = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] };
  for (const wdw of M.windows) {
    const [nx, nz] = SIDE[wdw.side], cx = Math.floor(wdw.x), cz = Math.floor(wdw.z), y0 = LV_Y[li(wdw.lv)];
    // le plan de la face intérieure
    const fx = nx === 1 ? cx + 1 : nx === -1 ? cx : null, fz = nz === 1 ? cz + 1 : nz === -1 ? cz : null;
    const o = 0.02;
    const glass = gb('glass'), fr = gb('wframe'), cur = gb('curtain');
    const quadAt = (bld, u0, u1, ya, yb, off) => {
      if (fz !== null) bld.quad([cx + u0, ya, fz + nz * off], [cx + u1, ya, fz + nz * off], [cx + u1, yb, fz + nz * off], [cx + u0, yb, fz + nz * off], [0, 0, nz]);
      else bld.quad([fx + nx * off, ya, cz + u0], [fx + nx * off, ya, cz + u1], [fx + nx * off, yb, cz + u1], [fx + nx * off, yb, cz + u0], [nx, 0, 0]);
    };
    quadAt(fr, 0.05, 0.95, y0 + 1.15, y0 + 3.05, o);
    quadAt(glass, 0.12, 0.88, y0 + 1.22, y0 + 2.98, o * 2);
    quadAt(fr, 0.47, 0.53, y0 + 1.22, y0 + 2.98, o * 3); quadAt(fr, 0.12, 0.88, y0 + 2.05, y0 + 2.11, o * 3);
    if (wdw.lv >= 0) { quadAt(cur, -0.1, 0.16, y0 + 0.9, y0 + 3.3, o * 4); quadAt(cur, 0.84, 1.1, y0 + 0.9, y0 + 3.3, o * 4); quadAt(cur, -0.1, 1.1, y0 + 3.1, y0 + 3.35, o * 4.5); }
  }
  // tableaux aux murs des pièces de réception
  const paintTex = Array.from({ length: 8 }, (_, i) => painting(7919 * (i + 3)));
  const paintBuilders = paintTex.map(() => new GB());
  const winSet = new Set(M.windows.map((w) => `${w.lv}:${Math.floor(w.x)},${Math.floor(w.z)}`));
  for (const lv of [0, 1]) {
    const L = li(lv), y0 = LV_Y[L];
    for (let cz = 1; cz < H - 1; cz++) for (let cx = 1; cx < W - 1; cx++) {
      if (M.t[L][idx(cx, cz)] !== T.WALL || winSet.has(`${lv}:${cx},${cz}`)) continue;
      for (const [dx, dz, n] of DIRS) {
        const tn = cellT(M, lv, cx + dx, cz + dz);
        if (tn !== T.FLOOR) continue;
        const r = M.room[L][idx(cx + dx, cz + dz)], room = r >= 0 ? M.rooms[r] : null;
        if (!room || !['hall', 'salon', 'salle', 'galerie', 'maitre', 'trophees', 'musique', 'vestibule', 'billard'].includes(room.style)) continue;
        // une case sur trois, en évitant les côtés des portes
        if (hash(cx * 131 + cz * 977 + lv * 7 + dx * 3 + dz) > 0.3) continue;
        if (cellT(M, lv, cx + dz, cz + dx) !== T.WALL || cellT(M, lv, cx - dz, cz - dx) !== T.WALL) continue;
        const k = Math.floor(hash(cx * 17 + cz * 31 + lv) * paintTex.length);
        const fx = dx === 1 ? cx + 1.03 : dx === -1 ? cx - 0.03 : null, fz = dz === 1 ? cz + 1.03 : dz === -1 ? cz - 0.03 : null;
        const ya = y0 + 1.55, yb = y0 + 2.45;
        const frame = gb('gold');
        if (fz !== null) { frame.quad([cx + 0.18, ya - 0.08, fz - dz * 0.01], [cx + 0.82, ya - 0.08, fz - dz * 0.01], [cx + 0.82, yb + 0.08, fz - dz * 0.01], [cx + 0.18, yb + 0.08, fz - dz * 0.01], n); paintBuilders[k].quad([cx + 0.25, ya, fz + dz * 0.005], [cx + 0.75, ya, fz + dz * 0.005], [cx + 0.75, yb, fz + dz * 0.005], [cx + 0.25, yb, fz + dz * 0.005], n, dz === 1 ? [[1, 0], [0, 0], [0, 1], [1, 1]] : [[0, 0], [1, 0], [1, 1], [0, 1]]); }
        else { frame.quad([fx - dx * 0.01, ya - 0.08, cz + 0.18], [fx - dx * 0.01, ya - 0.08, cz + 0.82], [fx - dx * 0.01, yb + 0.08, cz + 0.82], [fx - dx * 0.01, yb + 0.08, cz + 0.18], n); paintBuilders[k].quad([fx + dx * 0.005, ya, cz + 0.25], [fx + dx * 0.005, ya, cz + 0.75], [fx + dx * 0.005, yb, cz + 0.75], [fx + dx * 0.005, yb, cz + 0.25], n, dx === -1 ? [[1, 0], [0, 0], [0, 1], [1, 1]] : [[0, 0], [1, 0], [1, 1], [0, 1]]); }
      }
    }
  }
  // matières du manoir
  const MATS = {
    trim: new THREE.MeshLambertMaterial({ color: '#4a2416' }), frame: new THREE.MeshLambertMaterial({ color: '#5a2c18' }), rail: new THREE.MeshLambertMaterial({ color: '#5e2d19' }),
    step: new THREE.MeshLambertMaterial({ color: '#7a4428' }), runner: new THREE.MeshLambertMaterial({ color: '#9c2433' }), ceil: new THREE.MeshLambertMaterial({ map: surface('plafond', 1), vertexColors: false }),
    'ceil-cave': new THREE.MeshLambertMaterial({ map: surface('plafond-cave', 1) }), glass: new THREE.MeshBasicMaterial({ color: '#3d5c99', fog: false }), wframe: new THREE.MeshLambertMaterial({ color: '#efe6d6' }),
    curtain: new THREE.MeshLambertMaterial({ color: '#8f1f2b', side: THREE.DoubleSide }), gold: new THREE.MeshStandardMaterial({ color: '#d4a645', metalness: 0.7, roughness: 0.35 }),
  };
  const matFor = (key) => {
    if (MATS[key]) return MATS[key];
    const [kind, name] = key.split(':');
    const m = new THREE.MeshLambertMaterial({ map: surface(name, 1), vertexColors: kind === 'panel' || kind === 'wall' });
    MATS[key] = m; return m;
  };
  for (const [key, b] of builders) { const m = new THREE.Mesh(b.geo(), matFor(key)); m.matrixAutoUpdate = false; world.add(m); }
  paintBuilders.forEach((b, i) => { if (b.p.length) world.add(new THREE.Mesh(b.geo(), new THREE.MeshLambertMaterial({ map: paintTex[i] }))); });
  // lustres, appliques, bougies, torches
  const flames = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffd27a' });
  const glowTex = glowSprite('rgba(255,210,140,0.9)', 'rgba(255,170,80,0)');
  for (const l of M.lights) {
    const g = new THREE.Group(); g.position.set(l.x, l.y, l.z);
    const brass = mat('#c99a3f');
    if (l.kind === 'lustre' || l.kind === 'grand') {
      const k = l.kind === 'grand' ? 1.9 : 1;
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, (l.kind === 'grand' ? 1.6 : 0.5)), brass); chain.position.y = (l.kind === 'grand' ? 0.8 : 0.25) - 0.05; g.add(chain);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45 * k, 0.03 * k, 6, 20), brass); ring.rotation.x = Math.PI / 2; ring.position.y = -0.35; g.add(ring);
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.12 * k, 10, 8), brass); hub.position.y = -0.38; g.add(hub);
      const nC = l.kind === 'grand' ? 10 : 6;
      for (let i = 0; i < nC; i++) {
        const a = i / nC * Math.PI * 2, x = Math.cos(a) * 0.45 * k, z = Math.sin(a) * 0.45 * k;
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6), mat('#f4ecd8')); c.position.set(x, -0.28, z); g.add(c);
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), flameMat); f.position.set(x, -0.18, z); g.add(f); flames.push(f);
      }
      if (l.kind === 'grand') { const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.04, 6, 24), brass); ring2.rotation.x = Math.PI / 2; ring2.position.y = -0.85; g.add(ring2); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), flameMat); f.position.set(Math.cos(a) * 0.8, -0.72, Math.sin(a) * 0.8); g.add(f); flames.push(f); } }
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6, fog: false })); sp.scale.setScalar(1.6 * k); sp.position.y = -0.3; g.add(sp);
    } else if (l.kind === 'applique' || l.kind === 'bougie' || l.kind === 'torche') {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.3, 6), l.kind === 'torche' ? mat('#4a2a18') : brass); c.position.y = -0.15; g.add(c);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), flameMat); f.position.y = 0.04; g.add(f); flames.push(f);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55, fog: false })); sp.scale.setScalar(0.9); g.add(sp);
    } else if (l.kind === 'billard') {
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.6, 0.3, 4, 1, true), new THREE.MeshLambertMaterial({ color: '#2f6b3f', side: THREE.DoubleSide })); shade.rotation.y = Math.PI / 4; shade.scale.set(2.2, 1, 1); g.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff3c8' })); bulb.position.y = -0.1; g.add(bulb);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0), brass); chain.position.y = 0.6; g.add(chain);
    }
    world.add(g);
  }

  // ================================================================== meubles (fusionnés par matière)
  function buildProps() {
    const byMat = new Map();
    const add = (geo, material, mtx) => {
      const g = geo.clone(); g.applyMatrix4(mtx);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      const ng = g.index ? g.toNonIndexed() : g;
      let l = byMat.get(material); if (!l) byMat.set(material, l = []); l.push(ng);
    };
    for (const p of M.props) {
      const place = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(new THREE.Matrix4().makeRotationY(p.rot));
      if (PROC[p.m]) {
        const grp = PROC[p.m](); grp.updateMatrixWorld(true);
        // à la bonne hauteur
        const b = new THREE.Box3().setFromObject(grp), size = new THREE.Vector3(); b.getSize(size);
        const k = p.h ? p.h / (size.y || 1) : 1;
        const fix = new THREE.Matrix4().makeScale(k, k, k);
        grp.traverse((o) => { if (o.isMesh) add(o.geometry, o.material, place.clone().multiply(fix).multiply(o.matrixWorld)); });
        continue;
      }
      const parts = models.parts(p.m, p.h, p.s);
      if (!parts) continue;
      for (const q of parts) add(q.geo, q.mat, place.clone().multiply(q.mtx));
    }
    for (const [m, list] of byMat) {
      const g = mergeGeometries(list, false);
      if (!g) continue;
      const mesh = new THREE.Mesh(g, m); mesh.matrixAutoUpdate = false; world.add(mesh);
    }
    // passages secrets : des panneaux qui glissent
    for (const ps of M.passages) passages.push(buildPassage(ps));
  }
  const passages = [];
  function buildPassage(ps) {
    const len = ps.axis === 'z' ? ps.z1 - ps.z0 + 1 : ps.x1 - ps.x0 + 1;
    const g = new THREE.Group();
    const wood = mat(ps.kind === 'mirror' ? '#d9c08a' : '#5a2c18');
    const sx = ps.axis === 'x' ? len : 0.96, sz = ps.axis === 'z' ? len : 0.96;
    const body = new THREE.Mesh(new THREE.BoxGeometry(sx, DOOR_H, sz), wood); body.position.y = DOOR_H / 2; g.add(body);
    if (ps.kind === 'bookcase') {
      const cols = ['#8f1f2b', '#2e4f86', '#2f6b4f', '#c99a3f', '#5c3a7a', '#a45a2a'];
      for (const side of [1, -1]) for (let r = 0; r < 5; r++) for (let i = 0; i < 9; i++) {
        const h = 0.3 + hash(r * 9 + i + side) * 0.12, w = 0.07 + hash(r * 7 + i * 3) * 0.05;
        const bk = new THREE.Mesh(new THREE.BoxGeometry(ps.axis === 'x' ? w : 0.2, h, ps.axis === 'z' ? w : 0.2), mat(cols[(r * 3 + i) % cols.length]));
        const along = -len / 2 + 0.15 + i * (len - 0.3) / 8, out = side * 0.4;
        bk.position.set(ps.axis === 'x' ? along : out, 0.2 + r * 0.5 + h / 2, ps.axis === 'z' ? along : out); g.add(bk);
      }
    } else if (ps.kind === 'wardrobe') {
      for (const side of [1, -1]) for (const s of [-0.25, 0.25]) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(ps.axis === 'x' ? len * 0.44 : 0.04, DOOR_H - 0.3, ps.axis === 'z' ? len * 0.44 : 0.04), mat('#7a3d22'));
        d.position.set(ps.axis === 'x' ? s * len : side * 0.49, DOOR_H / 2, ps.axis === 'z' ? s * len : side * 0.49); g.add(d);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat('#d0a548')); knob.position.set(ps.axis === 'x' ? s * 0.25 : side * 0.53, 1.3, ps.axis === 'z' ? s * 0.25 : side * 0.53); g.add(knob);
      }
    } else {
      for (const side of [1, -1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(ps.axis === 'x' ? len * 0.8 : 0.03, 1.8, ps.axis === 'z' ? len * 0.8 : 0.03), new THREE.MeshStandardMaterial({ color: '#c8dcea', metalness: 0.9, roughness: 0.08 })); m.position.set(ps.axis === 'x' ? 0 : side * 0.49, 1.4, ps.axis === 'z' ? 0 : side * 0.49); g.add(m); }
    }
    // le linteau au-dessus ne bouge pas
    const top = new THREE.Mesh(new THREE.BoxGeometry(sx, STORY - DOOR_H, sz), mat('#4a2416')); top.position.set(ps.x, ps.y + DOOR_H + (STORY - DOOR_H) / 2, ps.z); world.add(top);
    g.position.set(ps.x, ps.y, ps.z);
    world.add(g);
    return { ps, g, k: 0, len };
  }

  // ================================================================== objets dynamiques
  const coinMat = new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.85, roughness: 0.3, emissive: '#5a3a00' });
  const coins = new THREE.InstancedMesh(coinGeometry(), coinMat, 120); coins.count = 0; coins.frustumCulled = false; scene.add(coins);
  const coinSpark = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: glowSprite('rgba(255,220,120,0.9)', 'rgba(255,200,80,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 120); coinSpark.count = 0; coinSpark.frustumCulled = false; scene.add(coinSpark);
  const knives = new Map(), guns = new Map();
  const beamMat = new THREE.MeshBasicMaterial({ color: '#ffd23a', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const tracers = [];
  const tracerMat = new THREE.MeshBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const puffs = [];
  const puffTex = glowSprite('rgba(255,240,200,1)', 'rgba(255,200,120,0)');

  // ================================================================== personnages
  const chars = new Map();
  const qHand = new THREE.Quaternion(), qWant = new THREE.Quaternion(), eWant = new THREE.Euler();
  const tmpV = new THREE.Vector3();
  function makeChar(p) {
    const seed = typeof p.id === 'number' ? p.id : [...String(p.id)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
    const look = { color: p.color || '#4aa3df', skin: SKINS[Math.floor(hash(seed * 3) * SKINS.length)], hair: HAIRS[Math.floor(hash(seed * 5) * HAIRS.length)], pants: shade(p.color || '#4aa3df', -0.55), tie: ['#8f1f2b', '#2a2a3a', '#c99a3f', '#2e4f86'][Math.floor(hash(seed * 11) * 4)] };
    const c = models.character(p.model || 0, look);
    const g = new THREE.Group(); scene.add(g);
    const ch = { g, id: p.id, model: null, mixer: null, acts: {}, cur: null, tag: null, deadK: 0, knife: null, gun: null, hand: null, name: p.name, color: p.color, yaw: p.yaw, x: p.x, y: p.y, z: p.z, lastAtk: false, lastShot: false };
    if (c) {
      ch.model = c.root; g.add(c.root);
      ch.mixer = new THREE.AnimationMixer(c.root);
      for (const clip of c.clips) ch.acts[clip.name] = ch.mixer.clipAction(clip);
      for (const n of ['Punch', 'Shoot_OneHanded', 'RecieveHit', 'PickUp']) if (ch.acts[n]) { ch.acts[n].setLoop(THREE.LoopOnce); ch.acts[n].clampWhenFinished = false; }
      play(ch, 'Idle');
      c.root.updateMatrixWorld(true);
      ch.hand = c.root.getObjectByName('FistR') || c.root.getObjectByName('Fist.R') || c.root.getObjectByName('Fist_R');
      if (ch.hand) {
        const ws = new THREE.Vector3(); ch.hand.getWorldScale(ws);
        const holder = new THREE.Group(); holder.scale.setScalar(1 / (ws.x || 1)); ch.hand.add(holder); ch.holder = holder;
        ch.knife = models.knife(); ch.knife.scale.setScalar(1.3); ch.knife.position.set(0, 0.02, -0.08); holder.add(ch.knife);
        ch.gun = revolver(); ch.gun.scale.setScalar(1.5); ch.gun.position.set(0, 0.0, 0.02); holder.add(ch.gun);
        ch.knife.visible = ch.gun.visible = false;
      }
    } else {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.0, 4, 8), mat(p.color)); body.position.y = 0.85; g.add(body);
    }
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTag(p.name, p.color), depthTest: true, transparent: true, fog: false, sizeAttenuation: false }));
    tag.scale.set(0.16, 0.04, 1); tag.position.y = 2.05; g.add(tag); ch.tag = tag;
    chars.set(p.id, ch);
    return ch;
  }
  function play(ch, name, fade = 0.2, speed = 1) {
    const a = ch.acts[name]; if (!a) return;
    a.timeScale = speed;
    if (ch.cur === name) return;
    const prev = ch.acts[ch.cur];
    a.reset().play();
    if (prev) a.crossFadeFrom(prev, fade, false);
    ch.cur = name;
  }
  function once(ch, name) {
    const a = ch.acts[name]; if (!a) return;
    a.reset(); a.setEffectiveWeight(1); a.play(); a.timeScale = 1.4;
    ch.oneShot = name; ch.oneT = a.getClip().duration / 1.4;
  }

  // ================================================================== vue à la première personne
  const fpv = new FirstPerson(camera);

  // ================================================================== image
  let t = 0, camY = null, camLv = 0, frameN = 0, shake = 0;
  const lightScore = [];
  function frame(v, dt) {
    t += dt; frameN++;
    const w = v.w, me = v.me, real = v.real;
    // caméra
    let eyeLv = 0;
    if (me) {
      if (v.camMode === 'fps') {
        const ey = me.y + EYE;
        camY = camY == null || Math.abs(camY - ey) > 2 ? ey : camY + (ey - camY) * Math.min(1, dt * 18);
        camera.position.set(me.x, camY, me.z);
        camera.rotation.set(v.pitch, v.yaw, 0);
      } else {
        // spectateur : derrière la personne suivie, sans traverser les murs
        const yaw = v.yaw, pitch = clamp(v.pitch, -0.9, 0.6);
        const tx = me.x, ty = me.y + 1.6, tz = me.z;
        const dx = Math.sin(yaw) * Math.cos(pitch), dy = -Math.sin(pitch), dz = Math.cos(yaw) * Math.cos(pitch);
        const d = Math.max(0.4, rayWorld(M, w, tx, ty, tz, dx, dy, dz, 3.2, 0.1) - 0.3);
        camera.position.set(tx + dx * d, ty + dy * d + 0.2, tz + dz * d);
        camera.rotation.set(pitch - 0.15, yaw, 0);
        camY = null;
      }
      eyeLv = me.lv;
      if (shake > 0) { shake = Math.max(0, shake - dt * 2); camera.rotation.z = (Math.random() - 0.5) * shake * 0.05; camera.rotation.x += (Math.random() - 0.5) * shake * 0.03; }
    }
    camLv = eyeLv;
    // lumières : les plus proches de l'œil
    const bo = w && w.bo > 0;
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    lightScore.length = 0;
    for (const l of M.lights) { const d = Math.hypot(l.x - cx, (l.y - cy) * 1.4, l.z - cz) - (l.kind === 'grand' ? 8 : 0); lightScore.push([d, l]); }
    lightScore.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < POOL; i++) {
      const L = pool[i], e = lightScore[i];
      if (!e) { L.intensity = 0; continue; }
      const l = e[1];
      L.position.set(l.x, l.y - 0.4, l.z); L.color.setHex(l.color);
      const fl = l.kind === 'feu' || l.kind === 'torche' || l.kind === 'bougie' ? 0.85 + Math.sin(t * 13 + l.id) * 0.08 + Math.sin(t * 7.3 + l.id * 2) * 0.07 : 1;
      L.intensity = (bo ? (l.kind === 'feu' ? 0.35 : 0.03) : 1) * 7 * l.power * fl;
      L.distance = l.kind === 'grand' ? 26 : 14;
    }
    hemi.intensity = bo ? 0.18 : 1.6; moon.intensity = bo ? 0.12 : 0.35;
    torch.intensity = bo && me ? 2.6 : 0;
    scene.fog.near = bo ? 4 : 22; scene.fog.far = bo ? 22 : 70;
    for (const f of flames) f.visible = !bo;
    if (flash.intensity > 0) flash.intensity = Math.max(0, flash.intensity - dt * 60);

    if (!w) { renderer.render(scene, camera); return; }
    // passages
    for (const P of passages) {
      const target = w.pass[P.ps.id] ? 1 : 0;
      P.k += clamp(target - P.k, -dt * 2.2, dt * 2.2);
      const off = P.k * (P.len + 0.05), e = P.k * P.k * (3 - 2 * P.k);
      if (P.ps.axis === 'x') P.g.position.x = P.ps.x + e * (P.len + 0.05); else P.g.position.z = P.ps.z - e * (P.len + 0.05);
      void off;
    }
    // pièces d'or
    const dummy = new THREE.Object3D();
    let n = 0;
    for (const c of w.coins) {
      if (n >= 120) break;
      const ly = LV_Y[li(c.lv)];
      dummy.position.set(c.x, ly + 0.45 + Math.sin(t * 3 + c.x) * 0.06, c.z); dummy.rotation.set(0, t * 2.5 + c.x, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      coins.setMatrixAt(n, dummy.matrix);
      dummy.rotation.set(0, 0, 0); dummy.quaternion.copy(camera.quaternion); dummy.scale.setScalar(0.9 + Math.sin(t * 5 + c.z) * 0.15); dummy.updateMatrix(); coinSpark.setMatrixAt(n, dummy.matrix);
      n++;
    }
    coins.count = n; coinSpark.count = n; coins.instanceMatrix.needsUpdate = true; coinSpark.instanceMatrix.needsUpdate = true;
    // couteaux plantés ou en vol
    const seenK = new Set();
    for (const k of [...w.knives, ...(v.flying || [])]) {
      seenK.add(k.id);
      let m = knives.get(k.id);
      if (!m) { m = models.knife(); m.scale.setScalar(1.6); scene.add(m); knives.set(k.id, m); }
      m.position.set(k.x, k.y, k.z);
      if (k.fly) { m.rotation.set(t * 22, k.yaw, 0, 'YXZ'); } else m.rotation.set(-0.5, k.yaw, 0, 'YXZ');
    }
    for (const [id, m] of knives) if (!seenK.has(id)) { scene.remove(m); knives.delete(id); }
    // revolvers tombés : un faisceau doré qu'on voit de loin
    const seenG = new Set();
    for (const g of w.guns) {
      seenG.add(g.id);
      let o = guns.get(g.id);
      if (!o) {
        o = new THREE.Group(); const r = revolver(); r.scale.setScalar(2.2); r.rotation.z = Math.PI / 2; r.position.y = 0.12; o.add(r); o.userData.r = r;
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 6, 16, 1, true), beamMat); beam.position.y = 3; o.add(beam);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: '#ffd23a', fog: false })); sp.scale.setScalar(1.4); sp.position.y = 0.4; o.add(sp);
        scene.add(o); guns.set(g.id, o);
      }
      o.position.set(g.x, g.y, g.z); o.userData.r.rotation.y = t * 1.5; o.userData.r.position.y = 0.25 + Math.sin(t * 3) * 0.06;
    }
    for (const [id, o] of guns) if (!seenG.has(id)) { scene.remove(o); guns.delete(id); }
    // tirs
    for (let i = tracers.length - 1; i >= 0; i--) { const tr = tracers[i]; tr.t -= dt; tr.m.material.opacity = Math.max(0, tr.t / 0.12); if (tr.t <= 0) { scene.remove(tr.m); tr.m.geometry.dispose(); tr.m.material.dispose(); tracers.splice(i, 1); } }
    for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.t -= dt; p.s.material.opacity = Math.max(0, p.t / p.T); p.s.scale.setScalar(p.k * (1.4 - p.t / p.T * 0.6)); if (p.t <= 0) { scene.remove(p.s); p.s.material.dispose(); puffs.splice(i, 1); } }

    // personnages
    const seen = new Set();
    for (const p of v.players) {
      if (p.spec) continue;
      seen.add(p.id);
      let ch = chars.get(p.id);
      if (!ch) ch = makeChar(p);
      const self = v.camMode === 'fps' && me && p.id === me.id;
      ch.g.visible = !self;
      // position et cap adoucis
      ch.g.position.set(p.x, p.y, p.z);
      ch.yaw = lerpA(ch.yaw, p.yaw, Math.min(1, dt * 16));
      ch.g.rotation.y = ch.yaw + Math.PI;
      if (ch.model) {
        if (p.dead) {
          ch.deadK = Math.min(1, ch.deadK + dt * 3);
          if (ch.cur !== 'Defeat') { play(ch, 'Defeat', 0.1); }
          ch.model.rotation.x = -ch.deadK * Math.PI / 2 * 0.98; ch.model.position.y = ch.deadK * 0.15;
          if (ch.deadK >= 1 && ch.acts.Defeat) ch.acts.Defeat.timeScale = 0;
        } else {
          ch.deadK = 0; ch.model.rotation.x = 0; ch.model.position.y = 0;
          if (p.atk && !ch.lastAtk) once(ch, 'Punch');
          if ((p.shot && !ch.lastShot) || (p.throw && !ch.lastThrow)) once(ch, p.shot ? 'Shoot_OneHanded' : 'Punch');
          const loop = p.stun ? 'RecieveHit' : p.moving ? 'Walk' : 'Idle';
          play(ch, loop, 0.2, p.moving ? (p.run ? 1.55 : 1.1) : 1);
        }
        ch.lastAtk = p.atk; ch.lastShot = p.shot; ch.lastThrow = p.throw;
        if (ch.oneT > 0) { ch.oneT -= dt; if (ch.oneT <= 0 && ch.acts[ch.oneShot]) ch.acts[ch.oneShot].fadeOut(0.15); }
        // ne pas animer ceux qu'on ne voit pas de toute façon
        const far = Math.hypot(p.x - cx, p.z - cz) > 34 || Math.abs(p.y - cy) > 7;
        if (!far || frameN % 4 === 0) ch.mixer.update(far ? dt * 4 : dt);
        if (ch.knife) {
          ch.knife.visible = !p.dead && p.held === 'knife'; ch.gun.visible = !p.dead && p.held === 'gun';
          // l'arme pointe devant le personnage, quelle que soit l'orientation de l'os de la main
          if (ch.knife.visible || ch.gun.visible) {
            ch.g.updateMatrixWorld(true);
            ch.hand.getWorldQuaternion(qHand);
            qWant.setFromEuler(eWant.set(p.held === 'gun' ? -0.1 : 0.5, ch.yaw, 0, 'YXZ'));
            ch.holder.quaternion.copy(qHand.invert().multiply(qWant));
          }
        }
      }
      // nom : seulement si on le voit d'assez près
      if (ch.tag) {
        const show = !self && !p.dead && me && Math.hypot(p.x - cx, p.z - cz) < 14 && (frameN % 6 !== 0 ? ch.tagOn : (ch.tagOn = sees(M, w, { x: cx, y: cy - EYE, z: cz, lv: camLv }, p, 14)));
        ch.tagA = clamp((ch.tagA || 0) + (show ? dt * 5 : -dt * 5), 0, 1);
        ch.tag.material.opacity = ch.tagA; ch.tag.visible = ch.tagA > 0.01;
      }
    }
    for (const [id, ch] of chars) if (!seen.has(id)) { scene.remove(ch.g); chars.delete(id); }
    // vue à la première personne
    fpv.update(dt, v);
    renderer.render(scene, camera);
  }

  // ================================================================== effets
  const fx = {
    shot(e, mine) {
      const from = new THREE.Vector3(e.x, e.y - 0.15, e.z), to = new THREE.Vector3(e.tx, e.ty, e.tz);
      if (mine) { const m = fpv.muzzle(); if (m) from.copy(m); }
      const len = from.distanceTo(to);
      if (len > 0.3) {
        const geo = new THREE.CylinderGeometry(0.012, 0.012, len, 5); geo.translate(0, len / 2, 0); geo.rotateX(Math.PI / 2);
        const m = new THREE.Mesh(geo, tracerMat.clone()); m.position.copy(from); m.lookAt(to); scene.add(m); tracers.push({ m, t: 0.12 });
      }
      flash.position.copy(from); flash.intensity = 30;
      fx.puff(to.x, to.y, to.z, 0.5, 0.25);
    },
    puff(x, y, z, k = 0.6, T = 0.4) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.set(x, y, z); s.scale.setScalar(k); scene.add(s); puffs.push({ s, t: T, T, k }); },
    shake(k = 1) { shake = Math.max(shake, k); },
    swing() { fpv.slash(); },
    throwKnife() { fpv.throwAnim(); },
    recoil() { fpv.recoil(); },
    draw(on) { fpv.draw(on); },
  };
  function setQuality(q) { pr = Math.min(window.devicePixelRatio || 1, q === 'bas' ? 0.85 : q === 'haut' ? 2 : 1.5); renderer.setPixelRatio(pr); resize(); }
  function dispose() { removeEventListener('resize', resize); renderer.dispose(); renderer.domElement.remove(); }
  return { ready, frame, fx, camera, renderer, dispose, setQuality, canvas: renderer.domElement, debug: { chars, scene } };
}
