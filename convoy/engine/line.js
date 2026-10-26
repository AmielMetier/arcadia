// Convoy Storm — la ligne : gares, tronçons, aiguillages, virages, pentes et tunnels (moteur pur, partagé par l'hôte,
// les invités et l'affichage).
//
// La simulation avance le long de la voie : une distance D et un écart latéral x. Les virages n'existent que pour
// l'affichage (Line enroule le décor sur la courbe) et pour la vitesse permise ; les pentes changent la vitesse et la
// consommation. Tout se déduit de la graine et de la route choisie aux aiguillages : R = { legs, mk, pc }
//  - legs[L] : paysage du tronçon L (choisi à l'aiguillage de sortie de la gare L-1) ;
//  - mk[L]   : moment fort retenu au milieu du tronçon L (0 ou 1, choisi à l'aiguillage du milieu) ;
//  - pc      : { at, c } position du levier de l'aiguillage pas encore franchi (il change la voie qu'on voit devant).
import { hash, makeRng } from './rng.js';
import { BIOMES, BIOME_KEYS, CHUNK, HALF_W } from './world.js';

export const LEG_SHIFT = 110;          // un paysage commence 110 m après la gare (le décor devant la gare est déjà construit)
export const STATION_EVERY = 550;      // mode sans fin
export const FORK_AT = 40;             // l'aiguillage de sortie de gare, 40 m devant le quai
export const BRIDGE_LEN = 46;          // longueur du pont de la gorge (m)
const SEG = 70, GSEG = 120;            // longueur des segments de virage et de pente
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Distance de la gare n° i
export function stationDist(mode, goal, i) {
  if (mode === 'expedition') return i < 3 ? Math.round(goal * (i + 1) / 4) : null;
  return STATION_EVERY * (i + 1);
}
// Tronçon (n°) d'une distance : le tronçon L va de la gare L-1 (+ LEG_SHIFT) à la gare L
export function legAt(mode, goal, d) {
  for (let n = 0; n < 500; n++) { const sd = stationDist(mode, goal, n); if (sd == null || sd + LEG_SHIFT > d) return n; }
  return 500;
}
export function legEnd(mode, goal, L) { const sd = stationDist(mode, goal, L); return sd != null ? sd : mode === 'expedition' ? goal : null; }
export const bioAt = (mode, goal, legs, d) => legs[legAt(mode, goal, d)] || 'plaine';

/* ------------------------------------------------------------------ moments forts */
// Position du moment fort du tronçon L (indépendante du paysage), ou null
export function momentPos(seed, mode, goal, L) {
  if (L < 1) return null;
  const a = stationDist(mode, goal, L - 1); if (a == null) return null;
  const e = legEnd(mode, goal, L); if (e == null) return null;
  const lo = a + LEG_SHIFT + 160, hi = e - 110; if (hi < lo) return null;
  return Math.round(lo + makeRng(hash(seed * 19 + L * 7121 + 11)).next() * (hi - lo));
}
// Les deux moments forts proposés à l'aiguillage du milieu du tronçon L, selon son paysage
export function momentKinds(seed, L, bio) {
  const ent = Object.entries((BIOMES[bio] || BIOMES.plaine).moments), r = makeRng(hash(seed * 23 + L * 3301 + 5));
  const a = r.weighted(ent), rest = ent.filter(([k]) => k !== a);
  return [a, rest.length ? r.weighted(rest) : a];
}
// Moment fort du tronçon L, une fois son aiguillage du milieu franchi : { L, k, d }
export function momentOf(seed, mode, goal, R, L) {
  if (!R.legs[L] || R.mk[L] == null) return null;
  const d = momentPos(seed, mode, goal, L); if (d == null) return null;
  return { L, k: momentKinds(seed, L, R.legs[L])[R.mk[L]], d };
}

/* ------------------------------------------------------------------ aiguillages */
// Aiguillages du tronçon L : { k: 'st' | 'mid', L, at (point de l'aiguille), lD / lx (levier, repère du sol) }
export function forksOf(seed, mode, goal, L) {
  const out = [];
  const a = L >= 1 ? stationDist(mode, goal, L - 1) : null;
  if (a != null && legEnd(mode, goal, L) != null) out.push({ k: 'st', L, at: a + FORK_AT, lD: a + FORK_AT - 12, lx: -(HALF_W + 3.4) });
  const d = momentPos(seed, mode, goal, L);
  if (d != null) {
    const q = d - 140, side = makeRng(hash(seed * 31 + L * 71)).chance(0.5) ? -1 : 1;
    out.push({ k: 'mid', L, at: q, lD: q - 16, lx: side * (HALF_W + 3.4) });
  }
  return out;
}
// Options d'un aiguillage : deux paysages ('st') ou deux moments forts ('mid')
export function forkOptions(seed, R, f) {
  if (f.k === 'st') {
    const cur = R.legs[f.L - 1] || 'plaine';
    const pool = BIOME_KEYS.filter((b) => b !== cur);
    makeRng(hash(seed * 43 + (f.L - 1) * 1291 + 17)).shuffle(pool);
    return pool.slice(0, 2);
  }
  return R.legs[f.L] ? momentKinds(seed, f.L, R.legs[f.L]) : null;
}
// Voie prise (0 : à gauche, 1 : à droite), ou celle du levier tant que l'aiguillage n'est pas franchi
export function forkChoice(seed, R, f) {
  if (f.k === 'st' && R.legs[f.L]) { const i = forkOptions(seed, R, f).indexOf(R.legs[f.L]); return i < 0 ? 0 : i; }
  if (f.k === 'mid' && R.mk[f.L] != null) return R.mk[f.L];
  return R.pc && R.pc.at === f.at ? R.pc.c : 0;
}
// Après l'aiguille, la voie tourne pour de bon : 24° sur 70 m à la sortie des gares, 17° sur 60 m au milieu des tronçons
export const forkBend = (f) => (f.k === 'st' ? { len: 70, ang: 0.42 } : { len: 60, ang: 0.3 });

/* ------------------------------------------------------------------ tunnels, portions droites, pentes, virages */
// Tunnels du tronçon L (seulement dans le col) : [[d0, d1], …]
export function tunnelsOf(seed, mode, goal, R, L) {
  if (R.legs[L] !== 'col') return [];
  const a = stationDist(mode, goal, L - 1), e = legEnd(mode, goal, L); if (a == null || e == null) return [];
  const r = makeRng(hash(seed * 67 + L * 389));
  const d = momentPos(seed, mode, goal, L);
  const bad = [[a - 20, a + LEG_SHIFT + 30], [e - 90, e + 20], ...forksOf(seed, mode, goal, L).map((f) => [f.at - 50, f.at + 90])];
  if (d != null) bad.push([d - 180, d + BRIDGE_LEN + 60]);
  const out = [];
  for (let i = 0; i < 8 && out.length < 2; i++) {
    const len = r.range(60, 95), t0 = r.range(a + LEG_SHIFT + 30, e - 90 - len);
    if (bad.concat(out.map(([b0, b1]) => [b0 - 60, b1 + 60])).some(([b0, b1]) => t0 + len > b0 && t0 < b1)) continue;
    out.push([Math.round(t0), Math.round(t0 + len)]);
  }
  return out.sort((p, q) => p[0] - q[0]);
}
export function tunnelAt(seed, mode, goal, R, d) {
  const L = legAt(mode, goal, d);
  for (const l of [L - 1, L]) for (const t of tunnelsOf(seed, mode, goal, R, l)) if (d >= t[0] && d <= t[1]) return t;
  return null;
}
// Portions où la voie est droite et plate : gares, ville d'arrivée, pont, convoi abandonné
function straightSpans(seed, mode, goal, R, d) {
  const S = [], L = legAt(mode, goal, d);
  for (let i = Math.max(0, L - 1); i <= L + 1; i++) { const sd = stationDist(mode, goal, i); if (sd != null) S.push([sd - 45, sd + 35]); }
  if (mode === 'expedition' && goal) S.push([goal - 80, goal + 60]);
  for (const l of [L - 1, L, L + 1]) {
    const m = momentOf(seed, mode, goal, R, l);
    if (m && m.k === 'bridge') S.push([m.d - 30, m.d + BRIDGE_LEN + 30]);
    if (m && m.k === 'wreck') S.push([m.d - 40, m.d + 40]);
  }
  return S;
}
// 0 sur une portion droite, 1 ailleurs (raccords de 15 m)
function zoneK(seed, mode, goal, R, d) {
  let k = 1;
  for (const [a, b] of straightSpans(seed, mode, goal, R, d)) k = Math.min(k, clamp(Math.max(a - d, d - b) / 15, 0, 1));
  return k;
}
const ease = (f) => (1 - Math.cos(Math.PI * f)) / 2;
// Pente (montée > 0) à la distance d
export function gradeAt(seed, mode, goal, R, d) {
  const n = Math.floor(d / GSEG), f = d / GSEG - n;
  const v = (i) => { const g = (BIOMES[bioAt(mode, goal, R.legs, i * GSEG)] || BIOMES.plaine).grade; return g ? makeRng(hash(seed * 71 + i * 613)).pick([-1, -0.6, 0, 0.6, 1]) * g : 0; };
  const g = v(n) * (1 - ease(f)) + v(n + 1) * ease(f);
  return g ? g * zoneK(seed, mode, goal, R, d) : 0;
}
// Courbure (1/m, > 0 : la voie tourne à droite) à la distance d
export function kappaAt(seed, mode, goal, R, d) {
  if (d < 0) return 0;
  const n = Math.floor(d / SEG), f = d / SEG - n;
  const v = (i) => (BIOMES[bioAt(mode, goal, R.legs, i * SEG)] || BIOMES.plaine).kmax * makeRng(hash(seed * 61 + i * 977 + 3)).pick([-1, -0.6, 0, 0, 0.6, 1]);
  let k = (v(n) * (1 - ease(f)) + v(n + 1) * ease(f)) * zoneK(seed, mode, goal, R, d);
  const L = legAt(mode, goal, d);
  for (const l of [L, L + 1]) for (const fk of forksOf(seed, mode, goal, l)) {
    const B = forkBend(fk);
    if (d >= fk.at && d < fk.at + B.len) k += (forkChoice(seed, R, fk) ? 1 : -1) * B.ang / B.len;
  }
  return k;
}

/* ------------------------------------------------------------------ paysage d'un tronçon de plaine (36 m) */
// Paysage, portions à laisser vides (aiguillages, pont, convoi abandonné, tunnels, gares) et côté de la falaise du col
export function chunkEnv(seed, mode, goal, R, k) {
  const d = k * CHUNK, L = legAt(mode, goal, d), clear = [];
  const keep = (c) => { if (c[1] + 14 > d && c[0] - 14 < d + CHUNK) clear.push(c); };
  for (const l of [L - 1, L, L + 1]) {
    for (const f of forksOf(seed, mode, goal, l)) keep(f.k === 'st' ? [f.at - 10, f.at + 45] : [f.at - 14, f.at + 30]);
    const m = momentOf(seed, mode, goal, R, l);
    if (m && m.k === 'bridge') keep([m.d - 6, m.d + BRIDGE_LEN + 6]);
    if (m && m.k === 'wreck') keep([m.d - 30, m.d + 30]);
    for (const t of tunnelsOf(seed, mode, goal, R, l)) keep([t[0] - 10, t[1] + 10, 1]); // 1 : tunnel (la falaise continue au-dessus)
    const sd = stationDist(mode, goal, l); if (sd != null) keep([sd - 22, sd + 22]);
  }
  const bio = R.legs[L] || 'plaine';
  return { bio, clear, cs: makeRng(hash(seed * 73 + L * 19)).chance(0.5) ? 1 : -1 };
}

// Murs des tunnels (solides), en repère du train : la voie y est étroite, on longe le convoi de près
export function tunnelColliders(seed, mode, goal, R, dist) {
  const out = [], L = legAt(mode, goal, dist);
  for (const l of [L - 1, L, L + 1]) for (const [t0, t1] of tunnelsOf(seed, mode, goal, R, l)) {
    if (t1 < dist - 90 || t0 > dist + 60) continue;
    for (let a = t0; a < t1; a += 10) { const b = Math.min(t1, a + 10), z = dist - (a + b) / 2; for (const s of [-1, 1]) out.push({ x: s * (HALF_W + 2.9), z, w: 1, d: b - a, rot: 0, h: 6 }); }
  }
  return out;
}

/* ------------------------------------------------------------------ la courbe de la voie (affichage, carte) */
// Intègre la courbure mètre par mètre : position (x, z) et cap (th) de la voie, dans un repère fixe.
// Cap 0 : la voie file vers -Z (comme le repère du train) ; th > 0 : elle a tourné vers +X.
export class Line {
  constructor(seed, mode, goal) {
    this.seed = seed; this.mode = mode; this.goal = goal;
    this.R = { legs: ['plaine'], mk: [], pc: null }; this.ver = '';
    this.th = new Float64Array(4096); this.px = new Float64Array(4096); this.pz = new Float64Array(4096); this.n = 0;
  }
  // nouvelle route : on ne recalcule la courbe qu'à partir du premier mètre concerné
  setRoute(legs, mk, pc) {
    const v = legs.join(',') + '|' + mk.join(',') + '|' + (pc ? pc.at + ':' + pc.c : '');
    if (v === this.ver) return;
    const o = this.R; let from = Infinity;
    for (let L = 0; L < Math.max(legs.length, o.legs.length); L++) if (legs[L] !== o.legs[L]) { const a = stationDist(this.mode, this.goal, L - 1); from = Math.min(from, a != null ? a : 0); }
    for (let L = 0; L < Math.max(mk.length, o.mk.length); L++) if (mk[L] !== o.mk[L]) { const d = momentPos(this.seed, this.mode, this.goal, L); from = Math.min(from, d != null ? d - 200 : 0); }
    const pa = o.pc ? o.pc.at : Infinity, pb = pc ? pc.at : Infinity;
    if (pa !== pb || (o.pc && pc && o.pc.c !== pc.c)) from = Math.min(from, pa, pb);
    this.R = { legs: legs.slice(), mk: mk.slice(), pc: pc ? { ...pc } : null }; this.ver = v;
    this.n = Math.max(0, Math.min(this.n, Math.floor(from) - 1));
  }
  kappa(d) { return kappaAt(this.seed, this.mode, this.goal, this.R, d); }
  grade(d) { return gradeAt(this.seed, this.mode, this.goal, this.R, d); }
  ensure(d) {
    const need = Math.ceil(d) + 2;
    if (need >= this.th.length) {
      const grow = (a) => { const b = new Float64Array(Math.max(need + 1024, a.length * 2)); b.set(a); return b; };
      this.th = grow(this.th); this.px = grow(this.px); this.pz = grow(this.pz);
    }
    for (let i = this.n; i < need; i++) {
      const k = this.kappa(i + 0.5), th = this.th[i] + k * 0.5;
      this.th[i + 1] = this.th[i] + k; this.px[i + 1] = this.px[i] + Math.sin(th); this.pz[i + 1] = this.pz[i] - Math.cos(th);
    }
    this.n = Math.max(this.n, need);
  }
  // point de la voie à la distance d : { x, z, th }
  at(d) { return this.atInto(d, {}); }
  atInto(d, o) {
    if (d <= 0) { o.x = 0; o.z = -d; o.th = 0; return o; }
    this.ensure(d);
    const i = Math.floor(d), f = d - i;
    o.x = this.px[i] + (this.px[i + 1] - this.px[i]) * f; o.z = this.pz[i] + (this.pz[i + 1] - this.pz[i]) * f; o.th = this.th[i] + (this.th[i + 1] - this.th[i]) * f;
    return o;
  }
  // repère local centré sur la voie en d0 (cap ramené à 0) : position et rotation d'un point (d, x) de la voie
  local(d0, d, x = 0, o = {}) {
    const a = this.at(d0), b = this.at(d);
    const wx = b.x + x * Math.cos(b.th) - a.x, wz = b.z + x * Math.sin(b.th) - a.z, c = Math.cos(a.th), s = Math.sin(a.th);
    o.x = wx * c + wz * s; o.z = -wx * s + wz * c; o.yaw = -(b.th - a.th);
    return o;
  }
}
