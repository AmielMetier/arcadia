// odyssee/js/render/iles-faille.js — les îles flottantes des failles : roche peinte au pixel, ponts de lumière, courants,
// cristaux, débris qui dérivent, et le tunnel de la faille qui défile dans le vide (image de fond de la scène).
import * as THREE from 'three';
import { DIRS } from '../world/tiles.js';

const PX = 32;   // pixels par case
/** couleurs de la roche : contour, ombre, base, clair, éclat ; la lueur vient de la faille */
const ROCHES = {
  inverse: ['#140d2c', '#2a2056', '#43357e', '#5d4da4', '#8878cc'],
  chaos: ['#171c28', '#333d50', '#515f74', '#73839a', '#a4b4c8'],
  alpha: ['#1a0a0a', '#3a1a1a', '#56302c', '#75463c', '#a4705c'],
  gardien: ['#1c1408', '#40301a', '#645030', '#8c7448', '#c4a868'],
};
const h2 = (x, y) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const canevas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function texture(c) { const t = new THREE.Texture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; }

/** la roche des îles, sur un seul grand canevas (une case de vide de plus au sud pour les pointes) */
function peindreRoche(m, info) {
  const F = m.faille, R = ROCHES[F.gardien ? 'gardien' : F.kind] || ROCHES.inverse;
  const c = canevas(m.w * PX, m.h * PX), x = c.getContext('2d');
  const sol = new Set(F.sol.map(([a, b]) => a + ',' + b)), est = (a, b) => sol.has(a + ',' + b);
  const px = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  // dessous : des pointes de roche sous le bord sud, plus longues vers le milieu de chaque morceau
  for (const [a, b] of F.sol) {
    if (est(a, b + 1)) continue;
    let g = 0, d = 0; while (est(a - g - 1, b) && !est(a - g - 1, b + 1) && g < 6) g++; while (est(a + d + 1, b) && !est(a + d + 1, b + 1) && d < 6) d++;
    for (let i = 0; i < PX; i += 2) {
      const u = (g * PX + i) / ((g + d + 1) * PX), creux = Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
      const haut = Math.round(10 + creux * 34 + h2(a * 16 + (i >> 1), b) * 16 + (h2(a * 4 + (i >> 3), b + 9) > 0.6 ? 12 : 0));
      const X = a * PX + i, Y = (b + 1) * PX;
      for (let j = 0; j < haut; j += 2) {
        const p = j / haut, strie = h2(a * 8 + (i >> 2), b * 8 + (j >> 2));
        px(X, Y + j, 2, 2, j < 4 ? R[2] : p > 0.82 ? R[0] : strie > 0.72 ? R[2] : strie > 0.3 || p < 0.35 ? R[1] : R[0]);
      }
      if (h2(a * 31 + i, b) > 0.93) px(X, Y + Math.round(haut * 0.4), 2, 4, info.rim);   // veine de lumière
    }
  }
  // dessus : dalles irrégulières, fissures, veines
  for (const [a, b] of F.sol) {
    const X = a * PX, Y = b * PX;
    px(X, Y, PX, PX, R[2]);
    for (let j = 0; j < PX; j += 2) for (let i = 0; i < PX; i += 2) { const n = h2(X + i, Y + j); if (n > 0.93) px(X + i, Y + j, 2, 2, R[3]); else if (n < 0.06) px(X + i, Y + j, 2, 2, R[1]); }
    // joints : la dalle se coupe en deux ou en trois selon la case
    const q = h2(a, b), mi = 10 + 2 * Math.floor(h2(b, a) * 6);
    px(X, Y, PX, 2, R[1]); px(X, Y, 2, PX, R[1]); px(X + 2, Y + 2, PX - 2, 2, R[3]); px(X + 2, Y + 2, 2, PX - 4, R[3]);
    if (q < 0.4) { px(X, Y + mi, PX, 2, R[1]); px(X + 2, Y + mi + 2, PX - 4, 2, R[3]); }
    else if (q < 0.7) { px(X + mi, Y, 2, PX, R[1]); px(X + mi + 2, Y + 2, 2, PX - 4, R[3]); }
    if (h2(a + 7, b + 3) > 0.86) { let i = 4 + Math.floor(h2(a, b + 5) * 8), j = 6; for (let n = 0; n < 9; n++) { px(X + i, Y + j, 2, 2, R[0]); px(X + i, Y + j + 2, 2, 2, info.core); i += h2(a + n, b) > 0.4 ? 2 : 0; j += h2(a, b + n) > 0.4 ? 2 : 0; if (i > 26 || j > 26) break; } }
  }
  // bords : arête éclairée au nord, contour sombre, lueur de la faille au ras du vide ; coins rognés
  for (const [a, b] of F.sol) {
    const X = a * PX, Y = b * PX, N = !est(a, b - 1), S = !est(a, b + 1), O = !est(a - 1, b), E = !est(a + 1, b);
    if (N) { px(X, Y, PX, 2, R[0]); px(X, Y + 2, PX, 4, R[4]); px(X, Y + 6, PX, 2, R[3]); }
    if (O) { px(X, Y, 2, PX, R[0]); px(X + 2, Y, 2, PX, R[3]); }
    if (E) { px(X + PX - 2, Y, 2, PX, R[0]); px(X + PX - 4, Y, 2, PX, R[1]); }
    if (S) { px(X, Y + PX - 4, PX, 2, R[4]); px(X, Y + PX - 2, PX, 2, info.rim); }
    const rogne = (cx, cy) => x.clearRect(cx, cy, 4, 4);
    if (N && O) { rogne(X, Y); } if (N && E) { rogne(X + PX - 4, Y); } if (S && O) x.clearRect(X, Y + PX - 4, 4, 4); if (S && E) x.clearRect(X + PX - 4, Y + PX - 4, 4, 4);
  }
  // cercle gravé autour du gardien de la salle
  const [ex, ey] = F.ennemi, cx = ex * PX + PX / 2, cy = ey * PX + PX / 2;
  for (let n = 0; n < 160; n++) { const t = n / 160 * Math.PI * 2; for (const r of [46, 58]) { const i = Math.round((cx + Math.cos(t) * r) / 2) * 2, j = Math.round((cy + Math.sin(t) * r * 0.8) / 2) * 2; if (est(Math.floor(i / PX), Math.floor(j / PX))) px(i, j, 2, 2, n % 5 ? R[1] : info.core); } }
  // rochers
  for (const [a, b] of F.rochers) {
    const X = a * PX, Y = b * PX;
    for (let j = -14; j < PX - 4; j += 2) { const u = (j + 14) / (PX + 10), w = Math.round((6 + 9 * Math.sqrt(u)) / 2) * 2; px(X + 16 - w, Y + j, w * 2, 2, R[0]); if (w > 4) { px(X + 18 - w, Y + j, w * 2 - 4, 2, u < 0.3 ? R[4] : R[2]); px(X + 18 - w, Y + j, Math.max(2, Math.round(w * 0.5)), 2, u < 0.6 ? R[3] : R[2]); px(X + 14 + w - 6, Y + j, 4, 2, R[1]); } }
    px(X + 14, Y - 2, 2, 12, info.core); px(X + 16, Y + 6, 2, 8, info.rim);
  }
  return c;
}

function tuilePont(core, rim) {
  const c = canevas(PX, PX), x = c.getContext('2d');
  x.fillStyle = rim; x.globalAlpha = 0.42; x.fillRect(0, 0, PX, PX);
  x.globalAlpha = 0.85; x.fillStyle = core; for (const [a, b, w, h] of [[0, 0, 2, PX], [PX - 2, 0, 2, PX]]) x.fillRect(a, b, w, h);
  x.globalAlpha = 0.6; for (let j = 2; j < PX; j += 8) { x.fillRect(4, j, PX - 8, 2); }
  x.globalAlpha = 0.95; x.fillStyle = '#ffffff'; for (const [a, b] of [[8, 6], [22, 14], [12, 24]]) x.fillRect(a, b, 2, 2);
  return c;
}
function peindreCourant(x, d, core, rim, f) {
  x.clearRect(0, 0, PX, PX); x.globalAlpha = 0.3; x.fillStyle = rim; x.fillRect(0, 0, PX, PX);
  const [dx, dy] = DIRS[d];
  for (let n = 0; n < 2; n++) {
    const q = (f * 2 + n * 16) % PX;
    for (let i = 0; i < 14; i += 2) {
      const larg = i;
      for (const s of [-1, 1]) {
        let a, b; const pos = (dx + dy > 0 ? q - i : PX - q + i);
        if (dy) { a = 16 + s * larg - 1; b = ((pos % PX) + PX) % PX; } else { b = 16 + s * larg - 1; a = ((pos % PX) + PX) % PX; }
        x.globalAlpha = 0.95 - i * 0.04; x.fillStyle = i < 4 ? '#ffffff' : core; x.fillRect(a, b, 2, 2);
      }
    }
  }
  x.globalAlpha = 1;
}
function tuileCristal(x, col, f) {
  x.clearRect(0, 0, PX, PX);
  x.fillStyle = '#0c0818'; for (let j = 0; j < 10; j += 2) { const w = [8, 12, 14, 12, 8][j / 2]; x.fillRect(16 - w, 18 + j, w * 2, 2); }
  x.fillStyle = '#4a3c70'; for (let j = 0; j < 6; j += 2) { const w = [8, 10, 8][j / 2]; x.fillRect(16 - w, 20 + j, w * 2, 2); }
  for (let j = 0; j < 20; j += 2) { const w = j < 6 ? 2 + j : j < 14 ? 6 : Math.max(2, 20 - j); x.fillStyle = '#0c0818'; x.fillRect(16 - w - 2, 2 + j, w * 2 + 4, 2); x.fillStyle = col; x.fillRect(16 - w, 2 + j, w * 2, 2); x.fillStyle = '#ffffff'; x.globalAlpha = f % 4 < 2 ? 0.75 : 0.45; x.fillRect(16 - w, 2 + j, Math.max(2, w - 2), 2); x.globalAlpha = 1; }
}
/** ce qui est propre à une île, posé dans `view.root` ; défait avec la carte (matériaux `own`) */
export class IleFaille {
  constructor(view, m) {
    this.view = view; this.m = m; this.t = 0; this.f = -1;
    const info = m.faille.info, root = view.root;
    const plan = (w, h, map, o = {}) => {
      const g = new THREE.PlaneGeometry(w, h); g.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ map, transparent: !!o.transp, alphaTest: o.transp ? 0 : 0.5, depthWrite: !o.transp, opacity: o.opacity ?? 1 }); mat.userData.own = true;
      const me = new THREE.Mesh(g, mat); if (o.ordre != null) me.renderOrder = o.ordre; root.add(me); return me;
    };
    const roche = plan(m.w, m.h, texture(peindreRoche(m, info))); roche.position.set(m.w / 2, 0, m.h / 2);
    // ponts
    const F = m.faille; this.ponts = { a: [], b: [] };
    const tp = { a: tuilePont(info.core, info.rim), b: tuilePont(info.rim, info.core) };
    for (const c of ['a', 'b']) for (const [a, b] of F.ponts[c]) { const me = plan(1, 1, texture(tp[c]), { transp: true, ordre: 1 }); me.position.set(a + 0.5, 0.004, b + 0.5); this.ponts[c].push(me); }
    // courants : un canevas par sens, redessiné
    this.courants = {};
    for (const [id, d] of F.courants) {
      const [a, b] = id.split(',').map(Number);
      const C = this.courants[d] ||= { c: canevas(PX, PX), tex: null }; C.tex ||= texture(C.c);
      const me = plan(1, 1, C.tex, { transp: true, ordre: 1 }); me.position.set(a + 0.5, 0.004, b + 0.5);
    }
    // cristaux
    this.cristaux = F.cristaux.map(([a, b]) => { const c = canevas(PX, PX), t = texture(c), me = plan(1, 1, t, { transp: true, ordre: 1 }); me.position.set(a + 0.5, 0.006, b + 0.5); return { c, t }; });
    // débris qui dérivent dans le vide
    this.debris = [];
    const R = ROCHES[F.gardien ? 'gardien' : F.kind] || ROCHES.inverse, libre = (a, b) => ![-2, -1, 0, 1, 2].some((i) => [-2, -1, 0, 1, 2].some((j) => F.sol.some(([p, q]) => p === a + i && q === b + j)));
    for (let n = 0; n < 60 && this.debris.length < 16; n++) {
      const a = 1 + Math.floor(h2(n, 3) * (m.w - 2)), b = 1 + Math.floor(h2(n, 8) * (m.h - 2)); if (!libre(a, b)) continue;
      const s = 16 + 2 * Math.floor(h2(n, 5) * 12), c = canevas(s, s), x = c.getContext('2d');
      for (let j = 0; j < s; j += 2) { const u = j / s, w = Math.round((s / 2) * (u < 0.25 ? 0.75 + u : 1 - (u - 0.25) * 1.25) * (0.85 + h2(n, j) * 0.15) / 2) * 2; if (w <= 0) continue; x.fillStyle = u < 0.2 ? R[3] : u < 0.5 ? R[2] : R[1]; x.fillRect(s / 2 - w, j, w * 2, 2); x.fillStyle = R[0]; x.fillRect(s / 2 + w - 2, j, 2, 2); }
      x.fillStyle = info.rim; x.fillRect(s / 2 - 2, 4, 4, 2);
      const me = plan(s / PX, s / PX, texture(c)); me.position.set(a + 0.5, -0.3, b + 0.5); this.debris.push({ me, x: a + 0.5, z: b + 0.5, p: n * 1.7, v: 0.4 + h2(n, 1) * 0.5 });
    }
  }
  maj(dt) {
    this.t += dt; const F = this.m.faille, info = F.info, f = Math.floor(this.t * 12);
    for (const c of ['a', 'b']) for (const me of this.ponts[c]) { const on = c === F.solide, v = on ? 0.85 + 0.15 * Math.sin(this.t * 3 + me.position.z) : 0.13; me.material.opacity += (v - me.material.opacity) * Math.min(1, dt * 8); }
    for (const d of this.debris) { d.me.position.x = d.x + Math.sin(this.t * d.v * 0.6 + d.p) * 0.25; d.me.position.z = d.z + Math.sin(this.t * d.v + d.p) * 0.18; }
    if (f === this.f) return; this.f = f;
    for (const d in this.courants) { const C = this.courants[d]; peindreCourant(C.c.getContext('2d'), d, info.core, info.rim, f); C.tex.needsUpdate = true; }
    for (const k of this.cristaux) { tuileCristal(k.c.getContext('2d'), F.solide === 'a' ? info.core : info.rim, f >> 1); k.t.needsUpdate = true; }
  }
}
