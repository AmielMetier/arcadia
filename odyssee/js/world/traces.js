// odyssee/js/world/traces.js — la trame des routes : un ruban d'herbe autour d'un sentier devient un vrai terrain.
//
// Passe de fin (après poserBiomes, avant decors-routes.js), route par route :
//   1. des corniches : un chemin haut longe le chemin bas ;
//   2. des obstacles au milieu du passage : îlots qu'on contourne des deux côtés, chicanes, barrages qui obligent à
//      faire le tour par la forêt ;
//   3. des boucles : des sentiers qui quittent la route, passent par une clairière cachée et reviennent plus loin ;
//   4. le sentier est redessiné d'après ce terrain (il cherche son passage), avec ses embranchements.
// Chaque changement est essayé puis contrôlé (essayer) : rien de ce qui se rejoignait à pied n'est coupé, rien de ce qui
// était séparé (un garde, un arbuste à couper, un bras de mer) ne se rejoint. Les cases des dresseurs, objets, portes,
// rebords et de leurs abords restent praticables. Ne change que des cases : le résultat est gardé (cache-monde.js).
import { T, walkable } from './tiles.js';
import { along, rng, sin } from './mapgen.js';
import { plateau, massif } from './relief.js';
import { B, BIOME_ROUTE, bruitBiome as bruit, hasardCase } from './biomes.js';

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], N8 = [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]];
const SOL = new Set([T.GRASS, T.FLOWER, T.TALL, T.DARKTALL, T.SAND, T.SNOW, T.ASH]);
const BOIS = new Set([T.TREE, T.PINE]);
const WALK = Uint8Array.from({ length: 64 }, (_, t) => (walkable(t) ? 1 : 0));
const RB = 36, MARGE = 9, LOIN = 11;

/** la matière des obstacles de chaque biome, et le poids de chaque sorte de scène */
const STYLES = {
  campagne: { murs: ['bois', 'eau', 'bois'], terrasse: 1 }, valfleuri: { murs: ['eau', 'bois', 'eau'], terrasse: 1 }, murmure: { murs: ['bois', 'eau'], terrasse: 0.6 },
  alpage: { murs: ['roche', 'bois'], terrasse: 2 }, cerisaie: { murs: ['bois', 'eau'], terrasse: 1.4 }, lande: { murs: ['roche', 'bois', 'eau'], terrasse: 1.4 },
  savane: { murs: ['roche', 'eau', 'roche'], terrasse: 1 }, lavande: { murs: ['bois', 'bois', 'eau'], terrasse: 1.4 }, mirage: { murs: ['roche', 'bois', 'eau'], terrasse: 1 },
  jungle: { murs: ['bois', 'eau', 'bois'], terrasse: 1 }, gorge: { murs: ['roche', 'eau', 'roche'], terrasse: 1.4 }, taiga: { murs: ['bois', 'roche'], terrasse: 0.6 },
  celeste: { murs: ['bois', 'eau'], terrasse: 0.6 }, cote: { murs: ['eau', 'roche', 'bois'], terrasse: 1 }, verger: { murs: ['bois', 'eau'], terrasse: 1 },
  riziere: { murs: ['eau', 'bois', 'eau'], terrasse: 1.6 }, marais: { murs: ['eau', 'bois', 'eau'], terrasse: 0.3 }, desert: { murs: ['roche', 'roche', 'eau'], terrasse: 1.2 },
  canyon: { murs: ['roche', 'roche', 'bois'], terrasse: 2 }, roseraie: { murs: ['bois', 'eau'], terrasse: 1 }, hante: { murs: ['bois', 'eau', 'bois'], terrasse: 0.8 },
  vigne: { murs: ['bois', 'roche'], terrasse: 2 }, orage: { murs: ['roche', 'bois'], terrasse: 1 }, bambou: { murs: ['bois', 'eau'], terrasse: 1 },
  braises: { murs: ['eau', 'roche'], terrasse: 1 }, givre: { murs: ['bois', 'roche'], terrasse: 1 },
};

/** le numéro du groupe de cases qui se rejoignent à pied sans rien débloquer (0 : on n'y marche pas). Les cases des
 *  gardes, et celles des personnages qui ne sont là qu'à un moment de l'histoire, comptent comme des murs. */
export function etiquettes(W) {
  const n = W.w * W.h, E = new Int32Array(n), mur = new Uint8Array(n), pile = new Int32Array(n);
  for (const g of W.gates) for (const q of g.tiles) { const [x, y] = Array.isArray(q) ? q : String(q).split(',').map(Number); mur[y * W.w + x] = 1; }
  for (const p of W.npcs) if (p.gate || p.when || p.hideIf) mur[p.y * W.w + p.x] = 1;
  let no = 0;
  for (let i0 = 0; i0 < n; i0++) {
    if (E[i0] || mur[i0] || !WALK[W.t[i0]]) continue;
    let k = 0; pile[k++] = i0; E[i0] = ++no;
    while (k) {
      const i = pile[--k], x = i % W.w, st = W.t[i] === T.STAIRS;
      for (let q = 0; q < 4; q++) {
        if ((q === 0 && x === W.w - 1) || (q === 1 && x === 0)) continue;
        const j = i + (q === 0 ? 1 : q === 1 ? -1 : q === 2 ? W.w : -W.w); if (j < 0 || j >= n || E[j] || mur[j] || !WALK[W.t[j]]) continue;
        const dh = Math.abs(W.hg[i] - W.hg[j]); if (dh && !(dh === 1 && (st || W.t[j] === T.STAIRS))) continue;
        E[j] = no; pile[k++] = j;
      }
    }
  }
  return E;
}

/** tas binaire (plus petit coût d'abord) */
class Tas {
  constructor() { this.c = []; this.v = []; }
  push(c, v) { const C = this.c, V = this.v; let i = C.length; C.push(c); V.push(v); while (i) { const p = (i - 1) >> 1; if (C[p] <= c) break; C[i] = C[p]; V[i] = V[p]; i = p; } C[i] = c; V[i] = v; }
  pop() {
    const C = this.c, V = this.v, r = V[0]; this.cout = C[0]; const c = C.pop(), v = V.pop(), n = C.length;
    if (n) { let i = 0; for (;;) { let k = 2 * i + 1; if (k >= n) break; if (k + 1 < n && C[k + 1] < C[k]) k++; if (C[k] >= c) break; C[i] = C[k]; V[i] = V[k]; i = k; } C[i] = c; V[i] = v; }
    return r;
  }
  get n() { return this.c.length; }
}

class Trame {
  constructor(W, route, etq, reserve) {
    this.W = W; this.id = route.id; this.pts = route.pts; this.etq = etq; this.reserve = reserve; this.nb = B[BIOME_ROUTE[route.id]]; this.st = STYLES[BIOME_ROUTE[route.id]] || { murs: ['bois'], terrasse: 1 };
    let g = 11; for (const c of route.id + ':trame') g = (g * 33 + c.charCodeAt(0)) >>> 0;
    this.g = g % 9973; this.r = rng(g);
    const P = this.pts; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, L = 0;
    P.forEach(([x, y], i) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); if (i) L += Math.hypot(x - P[i - 1][0], y - P[i - 1][1]); });
    this.L = L; this.X0 = Math.max(1, Math.floor(x0 - RB)); this.Y0 = Math.max(1, Math.floor(y0 - RB)); this.X1 = Math.min(W.w - 2, Math.ceil(x1 + RB)); this.Y1 = Math.min(W.h - 2, Math.ceil(y1 + RB));
    this.w = this.X1 - this.X0 + 1; this.h = this.Y1 - this.Y0 + 1; const n = this.w * this.h;
    // à nous : la zone de la route, son biome ; et à quelle distance est le premier lieu qui n'est pas à nous
    this.own = new Uint8Array(n); this.etr = new Uint8Array(n).fill(LOIN); let front = [];
    for (let y = this.Y0; y <= this.Y1; y++) for (let x = this.X0; x <= this.X1; x++) {
      const i = this.at(x, y), z = W.zoneAt(x, y); this.own[i] = z?.route === this.id && !z.town && (W.biomes[y * W.w + x] & 31) === this.nb ? 1 : 0;
      const t = W.get(x, y); if (!this.own[i] && !BOIS.has(t) && t !== T.CAVEWALL && t !== T.ROCK && t !== T.CLIFF) { this.etr[i] = 0; front.push(i); }
    }
    for (let d = 1; d < LOIN; d++) { const s = []; for (const i of front) { const a = i % this.w, b = (i - a) / this.w; for (const [u, v] of N8) { const x = a + u, y = b + v; if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue; const j = y * this.w + x; if (this.etr[j] > d) { this.etr[j] = d; s.push(j); } } } front = s; }
    // distance à l'ancien sentier et place le long de la route (en cases)
    this.d = new Float32Array(n).fill(1e9); this.s = new Float32Array(n).fill(-1);
    for (let k = 0, m = Math.ceil(L); k <= m; k++) {
      const p = along(P, k / m), X = Math.round(p.x), Y = Math.round(p.y);
      for (let y = Math.max(this.Y0, Y - RB); y <= Math.min(this.Y1, Y + RB); y++) for (let x = Math.max(this.X0, X - RB); x <= Math.min(this.X1, X + RB); x++) { const i = this.at(x, y), e = Math.hypot(x - p.x, y - p.y); if (e < this.d[i]) { this.d[i] = e; this.s[i] = k / m * L; } }
    }
    // le sol ordinaire de la route, et le groupe de cases où passe son sentier
    const c = new Map(), q = new Map();
    for (let i = 0; i < n; i++) { if (!this.own[i]) continue; const [x, y] = this.xy(i), t = W.get(x, y); if ([T.GRASS, T.SAND, T.SNOW, T.ASH].includes(t) && this.d[i] < 12) c.set(t, (c.get(t) || 0) + 1); if (t === T.PATH && this.d[i] < 2) { const e = etq[y * W.w + x]; q.set(e, (q.get(e) || 0) + 1); } }
    const premier = (m, def) => [...m].sort((a, b) => b[1] - a[1])[0]?.[0] ?? def;
    this.sol = premier(c, T.GRASS); this.L0 = premier(q, 0);
    this.roc = ['canyon', 'desert', 'gorge', 'taiga', 'celeste', 'alpage', 'murmure'].includes(BIOME_ROUTE[route.id]);   // là, on taille aussi dans la roche
    this.sec = ['desert', 'canyon', 'gorge', 'orage', 'braises', 'givre'].includes(BIOME_ROUTE[route.id]);
    this.salles = []; this.boucles = []; this.faits = {}; this.occupe = [];
  }
  at(x, y) { return (y - this.Y0) * this.w + x - this.X0; }
  xy(i) { const a = i % this.w; return [a + this.X0, (i - a) / this.w + this.Y0]; }
  dedans(x, y) { return x >= this.X0 && y >= this.Y0 && x <= this.X1 && y <= this.Y1; }
  k(x, y) { return y * this.W.w + x; }
  pick(L) { return L[Math.floor(this.r() * L.length)]; }
  pos(s) { return along(this.pts, Math.max(0, Math.min(1, s / this.L))); }
  fait(k) { this.faits[k] = (this.faits[k] || 0) + 1; }
  nous(x, y) { return this.dedans(x, y) && this.own[this.at(x, y)] === 1; }
  /** sol naturel ou sentier à nous, non réservé */
  libre(x, y) { if (!this.nous(x, y) || this.reserve.has(this.k(x, y))) return false; const t = this.W.get(x, y); return (SOL.has(t) || t === T.PATH) && !this.W.monts?.[this.k(x, y)]; }
  /** forêt à nous qu'on peut ouvrir (loin des autres lieux) */
  bois(x, y) { const t = this.W.get(x, y); return this.nous(x, y) && (BOIS.has(t) || (this.roc && t === T.CAVEWALL)) && this.etr[this.at(x, y)] >= LOIN - 1 && !this.reserve.has(this.k(x, y)) && !this.W.monts?.[this.k(x, y)]; }

  /* ---------- essayer puis contrôler ---------- */
  composantes(t, h, w, hh) {
    const id = new Int32Array(w * hh), pile = []; let n = 0;
    for (let i0 = 0; i0 < id.length; i0++) {
      if (id[i0] || !WALK[t[i0]]) continue;
      id[i0] = ++n; pile.push(i0);
      while (pile.length) {
        const i = pile.pop(), x = i % w, s = t[i] === T.STAIRS;
        for (let q = 0; q < 4; q++) {
          if ((q === 0 && x === w - 1) || (q === 1 && x === 0)) continue;
          const j = i + (q === 0 ? 1 : q === 1 ? -1 : q === 2 ? w : -w); if (j < 0 || j >= id.length || id[j] || !WALK[t[j]]) continue;
          const dh = Math.abs(h[i] - h[j]); if (dh && !(dh === 1 && (s || t[j] === T.STAIRS))) continue;
          id[j] = n; pile.push(j);
        }
      }
    }
    return id;
  }
  copie(x0, y0, w, h) { const W = this.W, f = (A) => { const o = new A.constructor(w * h); for (let j = 0; j < h; j++) o.set(A.subarray((y0 + j) * W.w + x0, (y0 + j) * W.w + x0 + w), j * w); return o; }; return { t: f(W.t), h: f(W.hg), p: W.pentes ? f(W.pentes) : null }; }
  /** joue fn (qui ne change que des cases du rectangle) ; si un passage est coupé ou ouvert, tout est remis comme avant */
  essayer(rx0, ry0, rx1, ry1, fn) {
    const W = this.W, x0 = Math.max(0, Math.floor(rx0) - MARGE), y0 = Math.max(0, Math.floor(ry0) - MARGE), x1 = Math.min(W.w - 1, Math.ceil(rx1) + MARGE), y1 = Math.min(W.h - 1, Math.ceil(ry1) + MARGE), w = x1 - x0 + 1, h = y1 - y0 + 1;
    const A = this.copie(x0, y0, w, h), ok = fn() !== false && this.coherent(A, x0, y0, w, h);
    if (!ok) { for (let j = 0; j < h; j++) { const o = (y0 + j) * W.w + x0; W.t.set(A.t.subarray(j * w, j * w + w), o); W.hg.set(A.h.subarray(j * w, j * w + w), o); if (A.p) W.pentes.set(A.p.subarray(j * w, j * w + w), o); } return false; }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const g = (y0 + j) * W.w + x0 + i, av = WALK[A.t[j * w + i]], ap = WALK[W.t[g]]; if (ap && !av) this.etq[g] = this.L0; else if (av && !ap) this.etq[g] = 0; }
    return true;
  }
  coherent(A, x0, y0, w, h) {
    const W = this.W, Z = this.copie(x0, y0, w, h), a = this.composantes(A.t, A.h, w, h), z = this.composantes(Z.t, Z.h, w, h), vers = new Map(), grp = new Map(), neuf = new Map();
    for (let i = 0; i < a.length; i++) {
      const X = x0 + i % w, Y = y0 + Math.floor(i / w), av = a[i] > 0, ap = z[i] > 0;
      if (av && !ap && this.reserve.has(this.k(X, Y))) return false;
      if (ap && !av) {
        // une case neuve ne touche que la forêt, nos cases, ou d'autres cases neuves
        for (const [u, v] of N8) {
          const p = X + u, q = Y + v, t = W.get(p, q); if (BOIS.has(t) || t === T.ROCK || t === T.CAVEWALL) continue;
          if (WALK[t]) { const e = this.etq[this.k(p, q)]; if (e === this.L0 || e === 0) continue; return false; }
          if ((t === T.CLIFF || t === T.WATER) && Z.t[i] !== A.t[i] && p >= x0 && q >= y0 && p < x0 + w && q < y0 + h && A.t[(q - y0) * w + p - x0] !== t) continue;   // paroi ou eau posée par nous à l'instant
          return false;
        }
      }
      if (!ap) continue;
      if (av) {
        const p = vers.get(a[i]); if (p === undefined) vers.set(a[i], z[i]); else if (p !== z[i]) return false;                          // coupé
        const e = this.etq[this.k(X, Y)], q = grp.get(z[i]); if (q === undefined) grp.set(z[i], e); else if (q !== e) return false;       // réuni
        neuf.set(z[i], false);
      } else if (!neuf.has(z[i])) neuf.set(z[i], true);
    }
    for (const v of neuf.values()) if (v) return false;                                                                                   // poche isolée
    return true;
  }

  /* ---------- poser ---------- */
  /** ouvre des cases de forêt */
  creuser(C, h = null) { for (const [x, y] of C) if (BOIS.has(this.W.get(x, y)) || (h != null && this.W.get(x, y) === T.CAVEWALL)) { if (h != null) this.W.setHeight(x, y, h); const b = bruit(x, y, 5, this.g + 3); this.W.set(x, y, b > 0.68 ? T.TALL : b < 0.24 && !this.sec ? T.FLOWER : this.sol); } }
  /** sans les pointes ni les miettes : le plus gros morceau */
  propre(C) {
    const S = new Map(C.map((c) => [this.k(...c), c])), v = ([x, y]) => N4.filter(([a, b]) => S.has(this.k(x + a, y + b))).length;
    for (let i = 0; i < 4; i++) { const out = [...S].filter(([, c]) => v(c) < 2); if (!out.length) break; for (const [k] of out) S.delete(k); }
    let best = []; const vu = new Set();
    for (const [k, c] of S) { if (vu.has(k)) continue; vu.add(k); const L = [c]; for (let i = 0; i < L.length; i++) for (const [a, b] of N4) { const q = this.k(L[i][0] + a, L[i][1] + b); if (S.has(q) && !vu.has(q)) { vu.add(q); L.push(S.get(q)); } } if (L.length > best.length) best = L; }
    return best;
  }
  /** un obstacle : bosquet, roche ou eau */
  mur(C, kind) {
    const W = this.W; C = this.propre(C); if (!C.length) return;
    if (kind === 'eau') { for (const [x, y] of C) W.set(x, y, T.WATER); return; }
    const pins = C.some(([x, y]) => N8.some(([u, v]) => W.get(x + u * 3, y + v * 3) === T.PINE));
    for (const [x, y] of C) W.set(x, y, kind === 'roche' ? T.TREE : pins && bruit(x, y, 4, this.g) > 0.45 ? T.PINE : T.TREE);
    if (kind === 'roche') massif(W, C, { pas: 1.5, max: 2, base: W.height(...C[0]) });
  }
  boite(C) { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const [x, y] of C) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; }
  /** les cases autour du point p, dans son repère (u le long du sentier, v en travers) */
  autour(p, R, f) { const C = []; for (let y = Math.floor(p.y - R); y <= p.y + R; y++) for (let x = Math.floor(p.x - R); x <= p.x + R; x++) { const u = (x - p.x) * p.dx + (y - p.y) * p.dy, v = (x - p.x) * p.nx + (y - p.y) * p.ny; if (f(u, v, x, y)) C.push([x, y]); } return C; }
  /** jusqu'où la route est ouverte, d'un côté du sentier */
  bord(p, s) { let k = 0; for (let v = 1; v < 24; v++) { const x = Math.round(p.x + p.nx * s * v), y = Math.round(p.y + p.ny * s * v), t = this.W.get(x, y); if (!this.nous(x, y) || (!SOL.has(t) && t !== T.PATH)) { if (k) return v - 1; k = 1; } } return 23; }
  pris(s, r) { return this.occupe.some(([a, b]) => Math.abs(a - s) < b + r); }

  /** 0. les petites barrières qui longeaient l'ancien sentier */
  barrieres() {
    const W = this.W; let n = 0;
    for (let i = 0; i < this.own.length; i++) {
      if (!this.own[i] || this.d[i] > 6) continue; const [x, y] = this.xy(i); if (W.get(x, y) !== T.FENCE) continue;
      const h = W.height(x, y); if (N8.every(([u, v]) => { const t = W.get(x + u, y + v); return t === T.FENCE || BOIS.has(t) || t === T.ROCK || (WALK[t] && this.etq[this.k(x + u, y + v)] === this.L0 && W.height(x + u, y + v) === h); })) { W.set(x, y, this.sol); this.etq[this.k(x, y)] = this.L0; n++; }
    }
    this.faits.barrieres = n;
    // des marches au milieu du plat (deux plateaux voisins montés l'un après l'autre) : du sentier
    for (let i = 0; i < this.own.length; i++) { if (!this.own[i]) continue; const [x, y] = this.xy(i); if (W.get(x, y) !== T.STAIRS) continue; const h = W.height(x, y); if (N4.every(([u, v]) => W.height(x + u, y + v) === h && W.get(x + u, y + v) !== T.CLIFF && (W.get(x + u, y + v) !== T.STAIRS || N4.every(([a, b]) => W.height(x + u + a, y + v + b) === h)))) W.set(x, y, T.PATH); }
  }
  /** 1. le chemin haut : une longue butte sur un côté du chemin, des marches au sud */
  corniche(s, side) {
    const W = this.W, p0 = this.pos(s), ew = Math.abs(p0.dx) > Math.abs(p0.dy), demi = ew ? 8 + Math.floor(this.r() * 5) : 6 + Math.floor(this.r() * 2), x = Math.round(p0.x), y = Math.round(p0.y), h0 = W.height(x, y);
    // dans l'axe de la grille (des bords nets) ; jamais au sud d'un chemin qui va d'est en ouest (on n'en verrait pas la paroi)
    const p = ew ? { x, y, dx: 1, dy: 0, nx: 0, ny: 1 } : { x, y, dx: 0, dy: 1, nx: 1, ny: 0 };
    if (Math.max(Math.abs(p0.dx), Math.abs(p0.dy)) < 0.88 || (ew && side > 0)) return false;
    if (s < 18 || s > this.L - 18 || this.pris(s, demi)) return false;
    const B1 = this.bord(p, side); if (B1 < 7) return false;
    const haut = Math.min(B1 - 0.5, 12);
    const C = this.autour(p, demi + 14, (u, v, X, Y) => {
      v *= side; if (Math.abs(u) > demi || v < 4 || (v < 4.9 && Math.abs(u) > demi - 0.9) || v > haut + 4) return false;
      const t = W.get(X, Y); if (!this.nous(X, Y) || W.height(X, Y) !== h0 || W.warpAt(X, Y)) return false;
      return (SOL.has(t) || t === T.PATH || BOIS.has(t) || t === T.ROCK || (t === T.BLOCK)) && (!this.reserve.has(this.k(X, Y)) || WALK[t] || t === T.BLOCK);
    });
    const ouvertes = C.filter(([a, b]) => SOL.has(W.get(a, b))); if (ouvertes.length < (ew ? 50 : 36)) return false;
    const K = new Set(C.map(([a, b]) => this.k(a, b)));
    // les pieds de la butte : du terrain simple
    for (const [a, b] of C) for (const [u, v] of [[0, 1], [0, 2], [1, 0], [-1, 0], [0, -1]]) { if (K.has(this.k(a + u, b + v))) continue; const t = W.get(a + u, b + v); if (![...SOL, ...BOIS, T.PATH].includes(t) || W.height(a + u, b + v) !== h0 || (v >= 1 && WALK[t] && this.reserve.has(this.k(a + u, b + v)))) return false; }
    const bx = this.boite([...C, [x, y]]);
    const rampe = (u) => { const L = []; for (let v = 1; v <= 7.4; v += 0.5) for (const e of [0, 1]) L.push([Math.round(p.x + p.dx * (u + e) + p.nx * side * v), Math.round(p.y + p.dy * (u + e) + p.ny * side * v)]); return L; };
    const R = [...rampe(-demi + 2), ...rampe(demi - 3)];
    let sentier = []; for (let u = -demi + 2; u <= demi - 2; u += 0.5) for (const e of [6.6, 7.4]) sentier.push([Math.round(p.x + p.dx * u + p.nx * side * e), Math.round(p.y + p.dy * u + p.ny * side * e)]);
    // un chemin du nord au sud : on monte par le bas de la butte, au sud (les marches se voient de face)
    if (!ew) {
      const xs = [x + side * 6, x + side * 7], bas = Math.max(...C.filter(([a]) => a === xs[0]).map(([, b]) => b)); R.length = 0; sentier = [];
      for (const a of xs) { if (!K.has(this.k(a, bas)) || !K.has(this.k(a, bas - 2))) return false; for (let b = bas - 3; b <= bas + 4; b++) { if (b > bas && (!this.libre(a, b) || W.height(a, b) !== h0)) return false; sentier.push([a, b]); } }
      for (let b = bas - 4; b >= y - demi + 3; b--) sentier.push([xs[0], b], [xs[1], b]);
    }
    const nord = () => { for (const [a, b] of C) { if (K.has(this.k(a, b - 1)) || !SOL.has(W.get(a, b)) || this.reserve.has(this.k(a, b)) || BOIS.has(W.get(a, b - 1))) continue; W.set(a, b, hasardCase(a, b, this.g) < 0.3 ? T.PINE : T.TREE); } };
    if (!this.essayer(bx[0], bx[1], bx[2], bx[3] + 5, () => {
      for (const [a, b] of [...R, ...sentier]) if (this.libre(a, b)) W.set(a, b, T.PATH);
      const E = plateau(W, C, h0 + 1, { brut: true, roche: this.st.murs[0] === 'roche' }); void E;
      if (C.some(([a, b]) => W.get(a, b) === T.STAIRS)) return false;   // jamais de marches de côté ni de dos
      nord();
      if (!C.some(([a, b]) => W.get(a, b) === T.STAIRS || W.get(a, b + 1) === T.STAIRS)) return false;
    })) return false;
    const m = this.pos(s), q = haut * 0.62; this.salles.push({ x: Math.round(m.x + m.nx * side * q), y: Math.round(m.y + m.ny * side * q), r: 3, sorte: 'corniche' });
    this.occupe.push([s, demi + 1]); this.fait('corniche'); return true;
  }
  /** 2a. un îlot au milieu : le chemin se sépare en deux et se rejoint */
  ilot(s, kind) {
    const W = this.W, p = this.pos(s), a = 4 + this.r() * 4, b = 2.2 + this.r() * 2.2, h0 = W.height(Math.round(p.x), Math.round(p.y));
    if (s < 14 || s > this.L - 14 || this.pris(s, a)) return false;
    const q = (u, v, x, y, A, Bb) => (u / A) ** 2 + (v / Bb) ** 2 + (bruit(x, y, 2.6, this.g + 20) - 0.5) * 0.5;
    const anneau = this.autour(p, a + 8, (u, v, x, y) => q(u, v, x, y, a + 3.6, b + 3.8) <= 1), C = this.autour(p, a + 3, (u, v, x, y) => q(u, v, x, y, a, b) <= 1 && this.libre(x, y) && W.height(x, y) === h0);
    const tout = this.autour(p, a + 3, (u, v, x, y) => q(u, v, x, y, a, b) <= 1);
    if (C.length < 12 || C.length < tout.length * 0.72) return false;
    const bx = this.boite(anneau);
    if (!this.essayer(...bx, () => { this.creuser(anneau.filter(([x, y]) => this.bois(x, y) && W.height(x, y) === h0)); this.mur(C, kind); })) return false;
    this.occupe.push([s, a + 2]); this.fait('ilot_' + kind); (this.ilots ||= []).push([Math.round(p.x), Math.round(p.y), kind]); return true;
  }
  /** 2b. des langues de forêt (ou de roche, d'eau) qui s'avancent tour à tour d'un bord et de l'autre */
  chicane(s, kind) {
    const W = this.W, N = 2 + Math.floor(this.r() * 2), pas = 9 + this.r() * 3; let side = this.r() < 0.5 ? 1 : -1, n = 0;
    if (s < 14 || s + N * pas > this.L - 14 || this.pris(s + (N - 1) * pas / 2, N * pas / 2)) return false;
    for (let i = 0; i < N; i++, side = -side) {
      const p = this.pos(s + i * pas), h0 = W.height(Math.round(p.x), Math.round(p.y)), lo = this.bord(p, side), fo = this.bord(p, -side); if (fo < 5) continue;
      const av = Math.min(fo - 3.5, 4.5), ep = 1.4 + this.r() * 1.2;
      const C = this.autour(p, lo + 6, (u, v, x, y) => { v *= side; return v > -av && v < lo + 3 && Math.abs(u) < ep + (v > 2 ? 0.8 : 0) + (bruit(x, y, 2.4, this.g + 31) - 0.5) * 2 && this.libre(x, y) && W.height(x, y) === h0; });
      if (C.length < 14) continue;
      if (this.essayer(...this.boite(C), () => { this.mur(C, kind); })) n++;
    }
    if (!n) return false;
    this.occupe.push([s + (N - 1) * pas / 2, N * pas / 2]); this.fait('chicane'); return true;
  }
  /** 2c. un barrage en travers de toute la route : on fait le tour par la forêt, où une salle s'ouvre */
  detour(s, kind) {
    const W = this.W, p = this.pos(s), side = this.r() < 0.5 ? 1 : -1, h0 = W.height(Math.round(p.x), Math.round(p.y)), lo = this.bord(p, side);
    if (s < 20 || s > this.L - 20 || this.pris(s, 10) || lo > 15) return false;
    const R = lo + 6 + this.r() * 3, arc = [];
    for (let k = 0; k <= 60; k++) { const f = k / 60, u = (f - 0.5) * 26, v = side * (R * sin(f * 3.14159) + 1); const x = p.x + p.dx * u + p.nx * v, y = p.y + p.dy * u + p.ny * v; arc.push([x, y]); }
    const coul = new Set(), O = [];
    for (const [x, y] of arc) { const e = 2.2 + bruit(x, y, 4, this.g + 40) * 1.6; for (let b = -4; b <= 4; b++) for (let a = -4; a <= 4; a++) if (Math.hypot(a, b) <= e) { const X = Math.round(x) + a, Y = Math.round(y) + b, kk = this.k(X, Y); if (!coul.has(kk)) { coul.add(kk); O.push([X, Y]); } } }
    const C = this.autour(p, 26, (u, v, x, y) => Math.abs(u) < 1.6 + (bruit(x, y, 2.6, this.g + 41) - 0.4) * 2 && v * side < lo + 3 && v * side > -23 && !coul.has(this.k(x, y)) && this.libre(x, y) && W.height(x, y) === h0);
    const F = O.filter(([x, y]) => this.bois(x, y) && W.height(x, y) === h0); if (F.length < 30 || C.length < 14) return false;
    if (!this.essayer(...this.boite([...C, ...O]), () => { this.creuser(F); this.mur(C, kind); })) return false;
    const m = arc[30]; this.salles.push({ x: Math.round(m[0]), y: Math.round(m[1]), r: 3, sorte: 'detour' });
    this.occupe.push([s, 13]); this.fait('detour'); return true;
  }

  /* ---------- chemins ---------- */
  /** plus court chemin depuis `dep` (cases) : cout(x, y) (Infinity : interdit), but(x, y) ; o.pas(x0,y0,x1,y1) */
  chemin(dep, but, cout, pas = null, max = 1e9, diag = true) {
    const n = this.w * this.h, D = new Float64Array(n).fill(Infinity), prec = new Int32Array(n).fill(-1), tas = new Tas();
    for (const [x, y] of dep) if (this.dedans(x, y)) { const i = this.at(x, y); D[i] = 0; tas.push(0, i); }
    const V = diag ? N8 : N4;
    while (tas.n) {
      const i = tas.pop(), c = tas.cout; if (c > D[i]) continue; if (c > max) return null;
      const [x, y] = this.xy(i); if (but(x, y)) { const L = []; for (let k = i; k >= 0; k = prec[k]) L.push(this.xy(k)); return L.reverse(); }
      for (const [u, v] of V) {
        const a = x + u, b = y + v; if (!this.dedans(a, b)) continue; const j = this.at(a, b), q = cout(a, b); if (q === Infinity) continue;
        if (pas && !pas(x, y, a, b)) continue;
        if (u && v) { if (cout(x + u, y) === Infinity || cout(x, y + v) === Infinity || (pas && (!pas(x, y, x + u, y) || !pas(x, y, x, y + v) || !pas(x + u, y, a, b)))) continue; }
        const e = c + q * (u && v ? 1.42 : 1); if (e < D[j]) { D[j] = e; prec[j] = i; tas.push(e, j); }
      }
    }
    return null;
  }
  /** 3. les boucles : par la forêt, une clairière cachée, et retour plus loin sur la route */
  faireBoucles(n) {
    const W = this.W, w = this.w, h = this.h, N = w * h; let faits = 0;
    for (let tour = 0; tour < n * 3 && faits < n; tour++) {
      // à quelle distance chaque case de forêt est du terrain ouvert
      const D = new Uint8Array(N).fill(60); let fr = [];
      for (let i = 0; i < N; i++) { const [x, y] = this.xy(i); if (!this.bois(x, y)) { D[i] = 0; fr.push(i); } }
      for (let d = 1; d < 30 && fr.length; d++) { const s = []; for (const i of fr) { const a = i % w, b = (i - a) / w; for (const [u, v] of N8) { const x = a + u, y = b + v; if (x < 0 || y < 0 || x >= w || y >= h) continue; const j = y * w + x; if (D[j] > d) { D[j] = d; s.push(j); } } } fr = s; }
      // une clairière : le cœur d'un bois
      let cand = []; for (const dm of [8, 6]) { if (cand.length) break; for (let i = 0; i < N; i++) if (D[i] >= dm && D[i] < 17 && this.d[i] > 12 && this.d[i] < 33 && this.s[i] > 24 && this.s[i] < this.L - 24) cand.push(i); }
      if (!cand.length) return faits;
      let M = -1; for (let e = 0; e < 30; e++) { const i = this.pick(cand), [x, y] = this.xy(i); if (this.salles.every((q) => Math.hypot(q.x - x, q.y - y) > 26)) { M = i; break; } }
      if (M < 0) return faits;
      const [mx, my] = this.xy(M), sM = this.s[M], R = Math.min(8.5, D[M] - 1.5), pM = this.pos(sM), hM = W.height(Math.round(pM.x), Math.round(pM.y)), haut = (x, y) => W.get(x, y) !== T.CAVEWALL && W.height(x, y) !== hM;
      const touche = (x, y) => N8.some(([u, v]) => { const t = W.get(x + u, y + v); return !(BOIS.has(t) || t === T.ROCK || t === T.CAVEWALL || (WALK[t] && this.etq[this.k(x + u, y + v)] === this.L0)); });
      const cout = (x, y) => { if (!this.dedans(x, y)) return Infinity; const i = this.at(x, y); if (D[i] && touche(x, y)) return Infinity; if (D[i] === 0) return this.etq[this.k(x, y)] === this.L0 && WALK[W.get(x, y)] && W.height(x, y) === hM && !this.reserve.has(this.k(x, y)) ? 1 : Infinity; if (haut(x, y)) return Infinity; return 1 + (D[i] < 3 ? 2.5 : 0) + 9 * bruit(x, y, 7, this.g + 50 + tour) ** 2; };
      const but = (lo, hi, s0) => (x, y) => { const i = this.at(x, y), e = Math.abs(this.s[i] - s0); return D[i] === 0 && this.d[i] < 22 && e >= lo && e <= hi; };
      // ne pas traverser la route : on s'arrête à la première case ouverte
      const ferme = (...q) => { const B0 = but(...q); return (x, y) => (D[this.at(x, y)] === 0 && !B0(x, y) ? Infinity : cout(x, y)); };
      const a0 = [0, 70, sM];
      const A = this.chemin([[mx, my]], but(...a0), ferme(...a0), null, 420); if (!A) continue;
      const z0 = [22, 110, this.s[this.at(...A[A.length - 1])]];
      // le retour évite l'aller
      const pres = new Set(); for (const [x, y] of A) if (Math.hypot(x - mx, y - my) > R + 1) for (let b = -5; b <= 5; b++) for (let a = -5; a <= 5; a++) pres.add(this.k(x + a, y + b));
      const f2 = ferme(...z0), Z = this.chemin([[mx, my]], but(...z0), (x, y) => { const c = f2(x, y); return c === Infinity ? c : c + (pres.has(this.k(x, y)) ? 14 : 0); }, null, 520);
      const C = new Map(), add = (x, y) => { if (this.bois(x, y) && !haut(x, y) && !touche(x, y)) C.set(this.k(x, y), [x, y]); };
      const brosse = (L) => { for (const [x, y] of L) { const e = 1.9 + bruit(x, y, 6, this.g + 60) * 2.2; for (let b = -4; b <= 4; b++) for (let a = -4; a <= 4; a++) if (Math.hypot(a, b) <= e) add(x + a, y + b); } };
      brosse(A); if (Z) brosse(Z);
      for (let y = my - 10; y <= my + 10; y++) for (let x = mx - 10; x <= mx + 10; x++) if (((x - mx) / R) ** 2 + ((y - my) / (R * 0.85)) ** 2 + (bruit(x, y, 3, this.g + 70) - 0.5) * 0.6 <= 1) add(x, y);
      // la roche taillée ne garde pas d'aiguilles d'une case
      if (this.roc) for (let e = 0; e < 3; e++) for (const [x, y] of [...C.values()]) for (const [u, v] of N8) { const a = x + u, b = y + v; if (W.get(a, b) === T.CAVEWALL && !C.has(this.k(a, b)) && N4.filter(([p, q]) => W.get(a + p, b + q) === T.CAVEWALL && !C.has(this.k(a + p, b + q))).length < 2) add(a, b); }
      const cells = [...C.values()]; if (cells.length < 60) continue;
      if (!this.essayer(...this.boite([...cells, A[A.length - 1], ...(Z ? [Z[Z.length - 1]] : [])]), () => { this.creuser(cells, hM); })) continue;
      this.salles.push({ x: mx, y: my, r: Math.floor(R - 1), sorte: Z ? 'boucle' : 'clairiere' }); this.boucles.push(A.slice().reverse().concat(Z ? Z.slice(1) : []));
      this.fait(Z ? 'boucle' : 'clairiere'); faits++;
    }
    return faits;
  }
  /** 4. le sentier est redessiné d'après le terrain, avec ses embranchements */
  reseau() {
    const W = this.W, N = this.w * this.h, P = this.pts;
    const pas = (x0, y0, x1, y1) => { const a = W.get(x0, y0), b = W.get(x1, y1), dh = Math.abs(W.height(x0, y0) - W.height(x1, y1)); return dh === 0 || (dh === 1 && (a === T.STAIRS || b === T.STAIRS) && (x0 === x1 || y0 === y1)); };
    const marche = (x, y) => this.dedans(x, y) && WALK[W.get(x, y)] && this.etq[this.k(x, y)] === this.L0 && W.get(x, y) !== T.DOOR && W.get(x, y) !== T.CAVEDOOR;
    const proche = (q) => { for (let r = 0; r < 14; r++) for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) if (Math.max(Math.abs(a), Math.abs(b)) === r && marche(Math.round(q[0]) + a, Math.round(q[1]) + b)) return [Math.round(q[0]) + a, Math.round(q[1]) + b]; return null; };
    const A = proche(P[0]), Z = proche(P[P.length - 1]); if (!A || !Z) return null;
    // combien de cases jusqu'au premier mur
    const mur = new Uint8Array(N).fill(9); let fr = [];
    for (let i = 0; i < N; i++) { const [x, y] = this.xy(i); if (!WALK[W.get(x, y)]) { mur[i] = 0; fr.push(i); } }
    for (let d = 1; d < 5; d++) { const s = []; for (const i of fr) { const a = i % this.w, b = (i - a) / this.w; for (const [u, v] of N8) { const x = a + u, y = b + v; if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue; const j = y * this.w + x; if (mur[j] > d) { mur[j] = d; s.push(j); } } } fr = s; }
    const vieux = new Set(), vers = new Set();
    const fixe = (x, y) => { for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const t = W.get(x + a, y + b); if (t === T.STAIRS || t === T.BRIDGE || t === T.DOOR || t === T.CAVEDOOR || t === T.PAVE) return true; } return false; };
    for (let i = 0; i < N; i++) { const [x, y] = this.xy(i); if (this.own[i] && this.d[i] <= 2.6 && W.get(x, y) === T.PATH && this.s[i] > 5 && this.s[i] < this.L - 5 && !fixe(x, y)) vieux.add(this.k(x, y)); }
    const occ = new Set([...W.npcs, ...W.items].map((o) => this.k(o.x, o.y)));
    const cout = (g, w2) => (x, y) => {
      if (!marche(x, y) || occ.has(this.k(x, y))) return Infinity; const m = mur[this.at(x, y)], t = W.get(x, y);
      if (vers.has(this.k(x, y))) return 0.45;
      return 1 + (m === 1 ? 5 : m === 2 ? 1.6 : m === 3 ? 0.4 : 0) + w2 * (bruit(x, y, 9, g) ** 2 * 9 + bruit(x, y, 4, g + 7) ** 2 * 4) + (t === T.STAIRS ? -0.3 : t === T.PATH && !vieux.has(this.k(x, y)) ? -0.2 : 0) + (t === T.TALL || t === T.DARKTALL ? 0.8 : 0) + (this.own[this.at(x, y)] ? 0 : 4);
    };
    const main = this.chemin([A], (x, y) => x === Z[0] && y === Z[1], cout(this.g + 80, 1), pas); if (!main) return null;
    for (const [x, y] of vieux.size ? [...vieux].map((k) => [k % W.w, Math.floor(k / W.w)]) : []) W.set(x, y, this.sol);
    const peindre = (L, ray) => { for (const [x, y] of L) { const e = Math.ceil(ray); for (let b = -e; b <= e; b++) for (let a = -e; a <= e; a++) { if (Math.hypot(a, b) > ray) continue; const X = x + a, Y = y + b, k = this.k(X, Y), t = W.get(X, Y); if (!this.dedans(X, Y) || W.height(X, Y) !== W.height(x, y) || this.etq[k] !== this.L0) continue; if (SOL.has(t) && this.own[this.at(X, Y)]) { W.set(X, Y, T.PATH); vers.add(k); } else if (t === T.PATH || t === T.STAIRS || t === T.BRIDGE || t === T.PAVE) vers.add(k); } } };
    peindre(main, 1.2);
    const traces = [];
    const relier = (x, y, g, w2, ray) => { const D = proche([x, y]); if (!D || vers.has(this.k(...D))) return; const L = this.chemin([D], (a, b) => vers.has(this.k(a, b)), cout(g, w2), pas, 600); if (!L) return; peindre(L, ray); if (L.length > 8) traces.push(L); };
    // les boucles : leur sentier, du chemin au chemin
    for (const b of this.boucles) { peindre(b, 1); relier(...b[0], this.g + 90, 0.6, 1); relier(...b[b.length - 1], this.g + 91, 0.6, 1); }
    // ce qui reste de sentiers (impasses, escaliers) est rattaché au nouveau chemin
    const vu = new Set();
    for (let i = 0; i < N; i++) {
      const [x, y] = this.xy(i), k = this.k(x, y); if (!this.own[i] || vu.has(k) || vers.has(k) || W.get(x, y) !== T.PATH || this.etq[k] !== this.L0) continue;
      const C = [[x, y]]; vu.add(k); let touche = false;
      for (let q = 0; q < C.length; q++) for (const [u, v] of N4) { const a = C[q][0] + u, b = C[q][1] + v, kk = this.k(a, b); if (!this.dedans(a, b) || vu.has(kk) || !pas(...C[q], a, b)) continue; const t = W.get(a, b); if (t !== T.PATH && t !== T.STAIRS && t !== T.BRIDGE && t !== T.PAVE) continue; if (vers.has(kk)) { touche = true; continue; } vu.add(kk); C.push([a, b]); }
      if (!touche && C.length >= 3) { const L = this.chemin(C, (a, b) => vers.has(this.k(a, b)), (a, b) => (C.length < 4000 ? cout(this.g + 95, 0.5)(a, b) : 1), pas, 260); if (L) { peindre(L, 1.05); if (L.length > 8) traces.push(L); } }
      for (const [a, b] of C) vers.add(this.k(a, b));
    }
    // une seconde voie entre deux points du chemin, par l'autre côté des obstacles
    const loinDe = new Set(); for (const [x, y] of main) for (let b = -4; b <= 4; b++) for (let a = -4; a <= 4; a++) loinDe.add(this.k(x + a, y + b));
    for (let k = 0, n = Math.max(1, Math.round(main.length / 60)); k < n; k++) {
      const i0 = Math.floor((k + 0.1 + this.r() * 0.25) * main.length / n), i1 = Math.min(main.length - 1, i0 + 22 + Math.floor(this.r() * 18)); if (i1 - i0 < 16) continue;
      const c = cout(this.g + 99 + k, 0.8), d = main[i0], f = main[i1];
      const L = this.chemin([d], (x, y) => x === f[0] && y === f[1], (x, y) => { const v = c(x, y); return v === Infinity ? v : Math.max(v, 1) + (loinDe.has(this.k(x, y)) ? 4 : 0); }, pas, 260);
      if (!L || L.filter(([x, y]) => !loinDe.has(this.k(x, y))).length < 12) continue;
      peindre(L, 1.05); traces.push(L); this.fait('fourche');
    }
    for (const q of this.salles) if (q.sorte !== 'boucle' && q.sorte !== 'clairiere') relier(q.x, q.y, this.g + 97, 0.6, 0.8);
    // un pavé de sentier tout seul (le haut d'une butte, un bout oublié) : du sol
    for (let i = 0; i < N; i++) { if (!this.own[i]) continue; const [x, y] = this.xy(i); if (W.get(x, y) === T.PATH && !N4.some(([u, v]) => [T.PATH, T.BRIDGE, T.PAVE, T.DOOR, T.CAVEDOOR].includes(W.get(x + u, y + v)))) W.set(x, y, this.sol); }
    const fin = (L) => { const o = []; for (let i = 0; i < L.length; i += 3) { let x = 0, y = 0, n = 0; for (let k = Math.max(0, i - 2); k <= Math.min(L.length - 1, i + 2); k++) { x += L[k][0]; y += L[k][1]; n++; } o.push([Math.round(x / n * 100) / 100, Math.round(y / n * 100) / 100]); } const z = L[L.length - 1]; o.push([z[0], z[1]]); return o; };
    return { main: fin(main), autres: [...this.boucles, ...traces].filter((L) => L.length > 6).map(fin) };
  }

  faire() {
    if (!this.L0 || this.L < 24) return null;
    this.barrieres();
    const n = (k) => Math.max(1, Math.round(k * this.L / 100)), S = () => 14 + this.r() * (this.L - 28);
    const repeter = (nb, essais, f) => { let k = 0; for (let i = 0; i < essais && k < nb; i++) if (f()) k++; return k; };
    repeter(n(1.9 * this.st.terrasse), 220, () => this.corniche(S(), this.r() < 0.5 ? 1 : -1));
    const m = () => this.pick(this.st.murs);
    this.faireBoucles(Math.max(1, Math.round(this.L / 45)));
    repeter(n(1.3), 30, () => this.detour(S(), m()));
    repeter(n(1.7), 40, () => this.chicane(S(), m()));
    repeter(n(2.6), 60, () => this.ilot(S(), m()));
    const R = this.reseau();
    return { trace: R?.main || null, autres: R?.autres || [], salles: this.salles, faits: this.faits };
  }
}

/** retrace toutes les routes ; ne change que des cases. Renvoie { route: { trace, autres, salles, faits } } */
export function tracerRoutes(W, routes, reserve) {
  const etq = etiquettes(W), out = {};
  for (const route of routes) {
    if (!B[BIOME_ROUTE[route.id]] || !route.pts?.length || !W.zones.some((z) => z.route === route.id)) continue;
    const R = new Trame(W, route, etq, reserve).faire(); if (R) out[route.id] = R;
  }
  return out;
}
