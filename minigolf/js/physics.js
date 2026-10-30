/* =============================================================================
   Golf Party — moteur physique de la balle (pur : aucun DOM, aucun Three.js → testable sous Node)
   -----------------------------------------------------------------------------
   - La balle est une sphère qui roule sur un maillage de triangles (sols, murets, loopings, tremplins…).
     Le contact est calculé au point le plus proche de chaque triangle : les arêtes et les coins
     sont gérés naturellement, les pentes accélèrent la balle à 5/7 g sin θ (sphère pleine qui roule).
   - Le trou est un vrai trou : le sol est ignoré au-dessus de la coupe, la lèvre est un cercle,
     la coupe un cylindre. Une balle trop rapide saute par-dessus ou ressort sur la lèvre.
   - Obstacles mobiles (moulin, balanciers, pistons…) : boîtes orientées dont la pose dépend du temps.
     Leur vitesse en surface est transmise à la balle au contact.
   - Matériaux : gazon, bois, sable (freine), glace, accélérateurs, tapis roulants, trampolines, bumpers…
   - Hors-jeu : eau, lave, sol du décor, chute dans le vide.
   - Pas fixe de 1/240 s, découpé selon la vitesse : le même code tourne en direct, chez les bots et dans les tests.
   ============================================================================= */

export const BALL_R = 0.12;
export const CUP_R = 0.27;
export const CUP_DEPTH = 0.4;
export const GRAV = 14;
export const TICK = 1 / 240;
export const MAX_SPEED = 40;
export const SHOT_MIN = 0.8, SHOT_MAX = 21;

/** Vitesse de frappe en fonction de la puissance 0..1 (courbe douce pour les petits putts) */
export const shotSpeed = (p) => SHOT_MIN + Math.pow(Math.max(0, Math.min(1, p)), 1.35) * (SHOT_MAX - SHOT_MIN);

/* ---------------- matériaux ----------------
   kind floor : la balle roule dessus (frottement de roulement « roll », en u/s²)
   kind wall  : rebond (restitution e), petit frottement à l'impact (fr) */
export const MATS = {
  turf:     { kind: 'floor', roll: 1.85, e: 0.28 },
  felt:     { kind: 'floor', roll: 1.6, e: 0.25 },
  plank:    { kind: 'floor', roll: 2.0, e: 0.32 },
  stone:    { kind: 'floor', roll: 1.9, e: 0.3 },
  moss:     { kind: 'floor', roll: 2.2, e: 0.22 },
  metal:    { kind: 'floor', roll: 1.55, e: 0.36 },
  grate:    { kind: 'floor', roll: 1.7, e: 0.34 },
  glassf:   { kind: 'floor', roll: 1.3, e: 0.3 },
  sand:     { kind: 'floor', roll: 9.5, e: 0.02, sand: 1 },
  zen:      { kind: 'floor', roll: 6.5, e: 0.04, sand: 1 },
  ice:      { kind: 'floor', roll: 0.28, e: 0.3 },
  boost:    { kind: 'floor', roll: 0.6, e: 0.3, boost: 12.5 },
  beach:    { kind: 'floor', roll: 2.6, e: 0.15 },
  sandstone:{ kind: 'floor', roll: 2.0, e: 0.28 },
  mud:      { kind: 'floor', roll: 8.0, e: 0.0, sand: 1, mud: 1 },
  snow:     { kind: 'floor', roll: 4.6, e: 0.05, sand: 1 },
  candy:    { kind: 'floor', roll: 1.7, e: 0.32 },
  snowpack: { kind: 'floor', roll: 2.3, e: 0.15 },
  magnet:   { kind: 'floor', roll: 1.7, e: 0.2 },
  logf:     { kind: 'floor', roll: 2.1, e: 0.3 },
  redwood:  { kind: 'floor', roll: 2.0, e: 0.3 },
  lavarock: { kind: 'floor', roll: 2.1, e: 0.3 },
  conveyor: { kind: 'floor', roll: 2.2, e: 0.3, conveyor: 3.2 },
  tramp:    { kind: 'floor', roll: 1.8, e: 0.9, tramp: 9.5 },
  lip:      { kind: 'wall', e: 0.3, fr: 0.2 },
  wood:     { kind: 'wall', e: 0.58, fr: 0.12 },
  brick:    { kind: 'wall', e: 0.55, fr: 0.14 },
  rock:     { kind: 'wall', e: 0.5, fr: 0.16 },
  whitew:   { kind: 'wall', e: 0.6, fr: 0.1 },
  metalw:   { kind: 'wall', e: 0.62, fr: 0.08 },
  neon:     { kind: 'wall', e: 0.62, fr: 0.08 },
  bamboo:   { kind: 'wall', e: 0.6, fr: 0.1 },
  redw:     { kind: 'wall', e: 0.58, fr: 0.12 },
  rubber:   { kind: 'wall', e: 0.78, fr: 0.1 },
  bumper:   { kind: 'wall', e: 0.92, fr: 0.05, kick: 3.6 },
  glass:    { kind: 'wall', e: 0.55, fr: 0.06 },
  hull:     { kind: 'wall', e: 0.5, fr: 0.14 },
  redrock:  { kind: 'wall', e: 0.5, fr: 0.15 },
  icew:     { kind: 'wall', e: 0.66, fr: 0.03 },
  snowcap:  { kind: 'wall', e: 0.4, fr: 0.2 },
  candyw:   { kind: 'wall', e: 0.62, fr: 0.08 },
  jelly:    { kind: 'wall', e: 0.95, fr: 0.04, kick: 1.5 },
  glassroof:{ kind: 'wall', e: 0.5, fr: 0.06 },
  logw:     { kind: 'wall', e: 0.52, fr: 0.14 },
  stonew:   { kind: 'wall', e: 0.55, fr: 0.13 },
  stonecap: { kind: 'wall', e: 0.55, fr: 0.12 },
  woodtrim: { kind: 'wall', e: 0.55, fr: 0.12 },
  goldtrim: { kind: 'wall', e: 0.6, fr: 0.1 },
  hazard:   { kind: 'wall', e: 0.6, fr: 0.1 },
};
export const MAT_NAMES = Object.keys(MATS);
const MAT_ID = Object.fromEntries(MAT_NAMES.map((n, i) => [n, i]));
const MAT_ARR = MAT_NAMES.map((n) => MATS[n]);
export const matId = (n) => (n in MAT_ID ? MAT_ID[n] : MAT_ID.turf);

/* ---------------- maillage statique + grille ---------------- */
const CELL = 1.0, MARGIN = BALL_R + 0.12;
const ckey = (ix, iy, iz) => ((ix + 2048) * 4096 + (iy + 2048)) * 4096 + (iz + 2048);

export class StaticMesh {
  constructor() { this.v = []; this.m = []; this.prm = []; this.n = 0; this.grid = new Map(); }
  /** Ajoute un triangle (sommets a,b,c = [x,y,z]), un matériau et un paramètre (direction des accélérateurs…) */
  add(a, b, c, mat, prm) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) return;   // triangle dégénéré
    this.v.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.m.push(typeof mat === 'number' ? mat : matId(mat));
    this.prm.push(prm ? prm[0] : 0, prm ? prm[1] : 0, prm ? prm[2] : 0);
    this.n++;
  }
  build() {
    this.V = Float64Array.from(this.v); this.M = Int16Array.from(this.m); this.P = Float32Array.from(this.prm);
    this.v = this.m = this.prm = null;
    const V = this.V, g = this.grid;
    this.min = [1e9, 1e9, 1e9]; this.max = [-1e9, -1e9, -1e9];
    for (let t = 0; t < this.n; t++) {
      const o = t * 9;
      let x0 = Math.min(V[o], V[o + 3], V[o + 6]), x1 = Math.max(V[o], V[o + 3], V[o + 6]);
      let y0 = Math.min(V[o + 1], V[o + 4], V[o + 7]), y1 = Math.max(V[o + 1], V[o + 4], V[o + 7]);
      let z0 = Math.min(V[o + 2], V[o + 5], V[o + 8]), z1 = Math.max(V[o + 2], V[o + 5], V[o + 8]);
      this.min[0] = Math.min(this.min[0], x0); this.min[1] = Math.min(this.min[1], y0); this.min[2] = Math.min(this.min[2], z0);
      this.max[0] = Math.max(this.max[0], x1); this.max[1] = Math.max(this.max[1], y1); this.max[2] = Math.max(this.max[2], z1);
      const ax = Math.floor((x0 - MARGIN) / CELL), bx = Math.floor((x1 + MARGIN) / CELL);
      const ay = Math.floor((y0 - MARGIN) / CELL), by = Math.floor((y1 + MARGIN) / CELL);
      const az = Math.floor((z0 - MARGIN) / CELL), bz = Math.floor((z1 + MARGIN) / CELL);
      for (let ix = ax; ix <= bx; ix++) for (let iy = ay; iy <= by; iy++) for (let iz = az; iz <= bz; iz++) {
        const k = ckey(ix, iy, iz); let a = g.get(k); if (!a) { a = []; g.set(k, a); } a.push(t);
      }
    }
    return this;
  }
  query(x, y, z) { return this.grid.get(ckey(Math.floor(x / CELL), Math.floor(y / CELL), Math.floor(z / CELL))); }
}

/** Point le plus proche de p sur le triangle t (Ericson, Real-Time Collision Detection 5.1.5) → écrit dans out */
function closestOnTri(V, o, px, py, pz, out) {
  const ax = V[o], ay = V[o + 1], az = V[o + 2], bx = V[o + 3], by = V[o + 4], bz = V[o + 5], cx = V[o + 6], cy = V[o + 7], cz = V[o + 8];
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) { out[0] = ax; out[1] = ay; out[2] = az; return; }
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) { out[0] = bx; out[1] = by; out[2] = bz; return; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); out[0] = ax + v * abx; out[1] = ay + v * aby; out[2] = az + v * abz; return; }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) { out[0] = cx; out[1] = cy; out[2] = cz; return; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); out[0] = ax + w * acx; out[1] = ay + w * acy; out[2] = az + w * acz; return; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    out[0] = bx + w * (cx - bx); out[1] = by + w * (cy - by); out[2] = bz + w * (cz - bz); return;
  }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  out[0] = ax + abx * v + acx * w; out[1] = ay + aby * v + acy * w; out[2] = az + abz * v + acz * w;
}

/* ---------------- obstacles mobiles ----------------
   k = { pose: { type, pivot:[x,y,z], ... }, boxes: [{ c:[x,y,z] (local), s:[sx,sy,sz], yaw? }], mat, r (rayon englobant) }
   Pose → { p:[x,y,z], R:[9] } (matrice de rotation ligne par ligne, local → monde) */
function rotAxis(ax, ay, az, a) {
  const l = Math.hypot(ax, ay, az) || 1; ax /= l; ay /= l; az /= l;
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [t * ax * ax + c, t * ax * ay - s * az, t * ax * az + s * ay,
          t * ax * ay + s * az, t * ay * ay + c, t * ay * az - s * ax,
          t * ax * az - s * ay, t * ay * az + s * ax, t * az * az + c];
}
const mul3 = (A, B) => [
  A[0] * B[0] + A[1] * B[3] + A[2] * B[6], A[0] * B[1] + A[1] * B[4] + A[2] * B[7], A[0] * B[2] + A[1] * B[5] + A[2] * B[8],
  A[3] * B[0] + A[4] * B[3] + A[5] * B[6], A[3] * B[1] + A[4] * B[4] + A[5] * B[7], A[3] * B[2] + A[4] * B[5] + A[5] * B[8],
  A[6] * B[0] + A[7] * B[3] + A[8] * B[6], A[6] * B[1] + A[7] * B[4] + A[8] * B[7], A[6] * B[2] + A[7] * B[5] + A[8] * B[8]];
const smooth01 = (x) => x * x * (3 - 2 * x);

export function kinPose(k, t) {
  const P = k.pose, pv = P.pivot, base = P.yaw ? rotAxis(0, 1, 0, P.yaw) : null;
  let p = pv.slice(), R;
  switch (P.type) {
    case 'spin': {                       // rotation continue autour d'un axe (moulin, croix, balancier)
      R = rotAxis(P.axis[0], P.axis[1], P.axis[2], (P.phase || 0) + t * P.speed); break;
    }
    case 'swing': {                      // pendule (ancre, marteau)
      R = rotAxis(P.axis[0], P.axis[1], P.axis[2], P.amp * Math.sin((P.phase || 0) + t * 2 * Math.PI / P.period)); break;
    }
    case 'slide': {                      // va-et-vient sinusoïdal
      const s = Math.sin((P.phase || 0) + t * 2 * Math.PI / P.period) * P.amp;
      p = [pv[0] + P.dir[0] * s, pv[1] + P.dir[1] * s, pv[2] + P.dir[2] * s]; R = [1, 0, 0, 0, 1, 0, 0, 0, 1]; break;
    }
    case 'piston': {                     // sort vite, reste, rentre lentement, attend
      const u = (((t + (P.phase || 0) * P.period) / P.period) % 1 + 1) % 1;
      let x;
      if (u < 0.12) x = smooth01(u / 0.12); else if (u < 0.4) x = 1; else if (u < 0.7) x = 1 - smooth01((u - 0.4) / 0.3); else x = 0;
      const s = x * P.amp;
      p = [pv[0] + P.dir[0] * s, pv[1] + P.dir[1] * s, pv[2] + P.dir[2] * s]; R = [1, 0, 0, 0, 1, 0, 0, 0, 1]; break;
    }
    default: R = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }
  if (base) R = mul3(base, R);
  return { p, R };
}
function kinPointWorld(pose, lx, ly, lz, out) {
  const R = pose.R;
  out[0] = pose.p[0] + R[0] * lx + R[1] * ly + R[2] * lz;
  out[1] = pose.p[1] + R[3] * lx + R[4] * ly + R[5] * lz;
  out[2] = pose.p[2] + R[6] * lx + R[7] * ly + R[8] * lz;
}

/* ---------------- monde d'un trou ---------------- */
export class World {
  /** @param {object} o { mesh, kin, zones, cup:[x,y,z], groundY, groundType, killY, tee } */
  constructor(o) {
    this.mesh = o.mesh; this.kin = o.kin || []; this.zones = o.zones || [];
    this.cup = o.cup; this.groundY = o.groundY ?? -50; this.groundType = o.groundType || 'grass';
    this.killY = o.killY ?? (this.groundY - 6);
    this.ceilY = o.ceilY ?? null;
    this.bounds = o.bounds || null;   // [minx, minz, maxx, maxz] au-delà = hors-jeu
    for (const k of this.kin) {
      if (k.r == null) { let r = 0; for (const b of k.boxes) r = Math.max(r, Math.hypot(Math.abs(b.c[0]) + b.s[0] / 2, Math.abs(b.c[1]) + b.s[1] / 2, Math.abs(b.c[2]) + b.s[2] / 2)); k.r = r + Math.hypot(...(k.pose.dir || [0, 0, 0])) * (k.pose.amp || 0); }
      k.matI = matId(k.mat || 'metalw');
      for (const b of k.boxes) { if (b.yaw) { b.R = rotAxis(0, 1, 0, b.yaw); } }
    }
  }
}

export function makeBall(id, p) {
  return { id, p: p.slice(), v: [0, 0, 0], awake: false, grounded: false, gn: [0, 1, 0], gmat: 0, gvs: [0, 0, 0],
    rest: 0, holed: false, holedT: 0, oob: null, oobT: 0, air: 0, lastHit: 0, start: p.slice(), t: 0, inPlay: true, gs: 1 };
}

const _c = [0, 0, 0], _w = [0, 0, 0], _w2 = [0, 0, 0];
const VS0 = [0, 0, 0];

/** Applique un contact : n normale unitaire (vers la balle), depth pénétration, vs vitesse de surface */
function contact(b, nx, ny, nz, depth, mi, vs, ev, t, prm) {
  const M = MAT_ARR[mi];
  b.touch = true;
  b.p[0] += nx * depth; b.p[1] += ny * depth; b.p[2] += nz * depth;
  const gs = b.gs || 1, up = ny * gs;
  const isFloor = M.kind === 'floor' || up > 0.7;
  let rx = b.v[0] - vs[0], ry = b.v[1] - vs[1], rz = b.v[2] - vs[2];
  const vn = rx * nx + ry * ny + rz * nz;
  if (vn < 0) {
    let e, imp = -vn;
    if (isFloor) {
      e = imp > 1.4 ? (M.kind === 'floor' ? M.e : 0.3) : 0;
      if (M.tramp && imp > 1.0) { e = Math.max(M.e, M.tramp / imp); if (ev && t - b.lastHit > 0.08) { ev.push({ k: 'tramp', b: b.id, p: b.p.slice(), s: imp }); b.lastHit = t; } }
      else if (ev && imp > 2.6 && t - b.lastHit > 0.12) { ev.push({ k: M.mud ? 'mud' : M.sand ? 'sand' : 'bounce', b: b.id, p: b.p.slice(), s: imp, m: mi }); b.lastHit = t; }
    } else {
      e = imp > 0.25 ? M.e : 0;
      if (ev && imp > (M.kick ? 0.6 : 1.1) && t - b.lastHit > 0.12) { ev.push({ k: M.kick ? 'bumper' : 'hit', b: b.id, p: b.p.slice(), s: imp, m: mi }); b.lastHit = t; }
    }
    rx -= (1 + e) * vn * nx; ry -= (1 + e) * vn * ny; rz -= (1 + e) * vn * nz;
    if (!isFloor) {
      if (M.kick && imp > 0.4) { rx += nx * M.kick; ry += ny * M.kick * 0.3; rz += nz * M.kick; }
      // frottement à l'impact : freine la composante tangentielle
      const tn = rx * nx + ry * ny + rz * nz, tx = rx - tn * nx, ty = ry - tn * ny, tz = rz - tn * nz, ts = Math.hypot(tx, ty, tz);
      if (ts > 1e-6) { const k = Math.max(0, 1 - (M.fr || 0.1) * (1 + e) * imp / ts); rx = tn * nx + tx * k; ry = tn * ny + ty * k; rz = tn * nz + tz * k; }
    }
    b.v[0] = rx + vs[0]; b.v[1] = ry + vs[1]; b.v[2] = rz + vs[2];
  }
  if (isFloor && up > -0.95) {
    // contact de roulement : on retient la normale la plus « porteuse »
    if (!b.grounded || depth > b._gd) {
      b.grounded = true; b._gd = depth; b.gn[0] = nx; b.gn[1] = ny; b.gn[2] = nz;
      b.gmat = M.kind === 'floor' ? mi : MAT_ID.stone; b.gvs = vs; b.gprm = prm;
    }
  }
}

/** Vrai si le segment a→b traverse un triangle du décor fixe (un muret, un sol) */
function segBlocked(mesh, a, b) {
  const V = mesh.V, seen = new Set(), steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / CELL) + 1);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, list = mesh.query(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u);
    if (!list) continue;
    for (const t of list) {
      if (seen.has(t)) continue; seen.add(t);
      const o = t * 9;
      const ux = V[o + 3] - V[o], uy = V[o + 4] - V[o + 1], uz = V[o + 5] - V[o + 2], vx = V[o + 6] - V[o], vy = V[o + 7] - V[o + 1], vz = V[o + 8] - V[o + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const da = (a[0] - V[o]) * nx + (a[1] - V[o + 1]) * ny + (a[2] - V[o + 2]) * nz, db = (b[0] - V[o]) * nx + (b[1] - V[o + 1]) * ny + (b[2] - V[o + 2]) * nz;
      if (da * db > 0) continue;
      const s = da / (da - db || 1e-12), px = a[0] + (b[0] - a[0]) * s - V[o], py = a[1] + (b[1] - a[1]) * s - V[o + 1], pz = a[2] + (b[2] - a[2]) * s - V[o + 2];
      const uu = ux * ux + uy * uy + uz * uz, vv = vx * vx + vy * vy + vz * vz, uv = ux * vx + uy * vy + uz * vz, wu = px * ux + py * uy + pz * uz, wv = px * vx + py * vy + pz * vz;
      const den = uv * uv - uu * vv; if (Math.abs(den) < 1e-12) continue;
      const s1 = (uv * wv - vv * wu) / den, t1 = (uv * wu - uu * wv) / den;
      if (s1 >= 0 && t1 >= 0 && s1 + t1 <= 1) return true;
    }
  }
  return false;
}

/** Contact avec une boîte orientée d'un obstacle mobile */
function kinContact(b, k, pose, poseN, h, ev, t, w) {
  const R = pose.R;
  for (const box of k.boxes) {
    // centre de la balle dans le repère de la boîte
    let dx = b.p[0] - pose.p[0], dy = b.p[1] - pose.p[1], dz = b.p[2] - pose.p[2];
    let lx = R[0] * dx + R[3] * dy + R[6] * dz, ly = R[1] * dx + R[4] * dy + R[7] * dz, lz = R[2] * dx + R[5] * dy + R[8] * dz;
    lx -= box.c[0]; ly -= box.c[1]; lz -= box.c[2];
    if (box.R) { const Q = box.R; const x = Q[0] * lx + Q[3] * ly + Q[6] * lz, y = Q[1] * lx + Q[4] * ly + Q[7] * lz, z = Q[2] * lx + Q[5] * ly + Q[8] * lz; lx = x; ly = y; lz = z; }
    const hx = box.s[0] / 2, hy = box.s[1] / 2, hz = box.s[2] / 2;
    const qx = Math.max(-hx, Math.min(hx, lx)), qy = Math.max(-hy, Math.min(hy, ly)), qz = Math.max(-hz, Math.min(hz, lz));
    let nx = lx - qx, ny = ly - qy, nz = lz - qz, d = Math.hypot(nx, ny, nz), depth;
    if (d > BALL_R) continue;
    if (d < 1e-6) {
      // centre à l'intérieur (la balle a été écrasée contre un muret) : on la fait sortir par la face la plus
      // proche qui ne la fait pas passer à travers le décor fixe ; le dessus de l'obstacle en dernier recours
      const cands = [[1, 0, 0, hx - lx], [-1, 0, 0, hx + lx], [0, 0, 1, hz - lz], [0, 0, -1, hz + lz], [0, 1, 0, hy - ly], [0, -1, 0, hy + ly]];
      cands.sort((a, c) => a[3] - c[3]);
      let pick = null;
      for (const c of cands) {
        let ux = c[0], uy = c[1], uz = c[2];
        if (box.R) { const Q = box.R; const x = Q[0] * ux + Q[1] * uy + Q[2] * uz, y = Q[3] * ux + Q[4] * uy + Q[5] * uz, z = Q[6] * ux + Q[7] * uy + Q[8] * uz; ux = x; uy = y; uz = z; }
        const wx = R[0] * ux + R[1] * uy + R[2] * uz, wy = R[3] * ux + R[4] * uy + R[5] * uz, wz = R[6] * ux + R[7] * uy + R[8] * uz;
        const L = c[3] + BALL_R;
        if (!w || !segBlocked(w.mesh, b.p, [b.p[0] + wx * L, b.p[1] + wy * L, b.p[2] + wz * L])) { pick = c; break; }
        if (c[1] === 1) pick = pick || c;
      }
      pick = pick || cands.find((c) => c[1] === 1);
      nx = pick[0]; ny = pick[1]; nz = pick[2]; depth = pick[3] + BALL_R;
    } else { nx /= d; ny /= d; nz /= d; depth = BALL_R - d; }
    // normale et point de contact en monde
    if (box.R) { const Q = box.R; const x = Q[0] * nx + Q[1] * ny + Q[2] * nz, y = Q[3] * nx + Q[4] * ny + Q[5] * nz, z = Q[6] * nx + Q[7] * ny + Q[8] * nz; nx = x; ny = y; nz = z; }
    const wx = R[0] * nx + R[1] * ny + R[2] * nz, wy = R[3] * nx + R[4] * ny + R[5] * nz, wz = R[6] * nx + R[7] * ny + R[8] * nz;
    // vitesse de surface : déplacement du point de contact entre t et t+h
    let cqx = qx, cqy = qy, cqz = qz;
    if (box.R) { const Q = box.R; const x = Q[0] * qx + Q[1] * qy + Q[2] * qz, y = Q[3] * qx + Q[4] * qy + Q[5] * qz, z = Q[6] * qx + Q[7] * qy + Q[8] * qz; cqx = x; cqy = y; cqz = z; }
    cqx += box.c[0]; cqy += box.c[1]; cqz += box.c[2];
    kinPointWorld(pose, cqx, cqy, cqz, _w); kinPointWorld(poseN, cqx, cqy, cqz, _w2);
    const vs = [(_w2[0] - _w[0]) / h, (_w2[1] - _w[1]) / h, (_w2[2] - _w[2]) / h];
    contact(b, wx, wy, wz, depth, k.matI, vs, ev, t, null);
  }
}

function cupContact(b, cup, ev, t) {
  const dx = b.p[0] - cup[0], dz = b.p[2] - cup[2], hd = Math.hypot(dx, dz);
  if (hd > CUP_R + BALL_R || b.p[1] > cup[1] + BALL_R + 0.02 || b.p[1] < cup[1] - CUP_DEPTH - BALL_R) return;
  const ux = hd > 1e-6 ? dx / hd : 1, uz = hd > 1e-6 ? dz / hd : 0;
  // lèvre (cercle)
  const qx = cup[0] + ux * CUP_R, qz = cup[2] + uz * CUP_R;
  let nx = b.p[0] - qx, ny = b.p[1] - cup[1], nz = b.p[2] - qz, d = Math.hypot(nx, ny, nz);
  if (d < BALL_R && d > 1e-6 && !(hd > CUP_R && b.p[1] > cup[1])) {
    // (au-dessus du sol et à l'extérieur, c'est le gazon qui porte la balle)
    contact(b, nx / d, ny / d, nz / d, BALL_R - d, MAT_ID.lip, VS0, ev, t, null);
  }
  if (hd < CUP_R && b.p[1] < cup[1]) {
    if (hd > CUP_R - BALL_R) contact(b, -ux, 0, -uz, hd - (CUP_R - BALL_R), MAT_ID.lip, VS0, null, t, null);
    const fl = cup[1] - CUP_DEPTH;
    if (b.p[1] - BALL_R < fl) contact(b, 0, 1, 0, fl - (b.p[1] - BALL_R), MAT_ID.felt, VS0, null, t, null);
    if (!b.holed && b.p[1] < cup[1] - BALL_R * 0.85 && hd < CUP_R - BALL_R * 0.25) {
      b.holed = true; b.holedT = t; if (ev) ev.push({ k: 'cup', b: b.id, p: b.p.slice(), s: Math.hypot(b.v[0], b.v[2]) });
    }
  }
}

function inBox(p, z) { return p[0] >= z.min[0] && p[0] <= z.max[0] && p[1] >= z.min[1] && p[1] <= z.max[1] && p[2] >= z.min[2] && p[2] <= z.max[2]; }

function setOOB(b, kind, ev, t) {
  if (b.oob || b.holed) return;
  b.oob = kind; b.oobT = 0;
  if (ev) ev.push({ k: kind, b: b.id, p: b.p.slice(), s: Math.hypot(b.v[0], b.v[1], b.v[2]) });
}

/** Un sous-pas de simulation pour une balle */
function subStep(w, b, t, h, ev) {
  const v = b.v, p = b.p;
  if (b.oob) {   // la balle coule ou rebondit encore un peu avant d'être replacée
    b.oobT += h;
    if (b.oob === 'water' || b.oob === 'lava') { v[0] *= 1 - 3 * h; v[2] *= 1 - 3 * h; v[1] = v[1] * (1 - 4 * h) - 2 * h; }
    else v[1] -= GRAV * h;
    p[0] += v[0] * h; p[1] += v[1] * h; p[2] += v[2] * h;
    if (b.oob !== 'water' && b.oob !== 'lava' && b.oob !== 'void' && p[1] - BALL_R < w.groundY && v[1] < 0) { p[1] = w.groundY + BALL_R; v[1] *= -0.35; v[0] *= 0.8; v[2] *= 0.8; }
    return;
  }
  // gravité : inversée dans les zones aimantées (on roule au plafond)
  let gs = 1;
  for (const z of w.zones) {
    if (z.type === 'antigrav') { if (inBox(p, z)) gs = -1; }
    else if (z.type === 'wind') { if (inBox(p, z)) { v[0] += z.f[0] * h; v[1] += z.f[1] * h; v[2] += z.f[2] * h; } }
    else if (z.type === 'slow' && inBox(p, z)) { const k = Math.max(0, 1 - (z.k || 2.2) * h); v[0] *= k; v[1] *= k; v[2] *= k; if (ev && !b.inSlow) ev.push({ k: 'slow', b: b.id, p: p.slice(), s: 1 }); b.inSlowT = b.t; }
  }
  b.inSlow = b.inSlowT === b.t;
  if (gs !== (b.gs || 1) && ev) ev.push({ k: 'flip', b: b.id, p: p.slice(), s: gs });
  b.gs = gs;
  v[1] -= GRAV * h * gs;
  const drag = 1 - 0.015 * h; v[0] *= drag; v[1] *= drag; v[2] *= drag;
  p[0] += v[0] * h; p[1] += v[1] * h; p[2] += v[2] * h;
  b.grounded = false; b.touch = false; b._gd = -1; b.gprm = null;

  // --- obstacles mobiles --- (avant le décor fixe : si un obstacle coince la balle contre un muret,
  // c'est le muret qui a le dernier mot et la balle ne peut plus être poussée à travers)
  if (w.kin.length) {
    for (const k of w.kin) {
      const pv = k.pose.pivot, dx = p[0] - pv[0], dy = p[1] - pv[1], dz = p[2] - pv[2], rr = k.r + BALL_R + 0.1;
      if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
      const pose = kinPose(k, t), poseN = kinPose(k, t + 0.004);
      kinContact(b, k, pose, poseN, 0.004, ev, t, w);
    }
  }
  // --- maillage statique ---
  const mesh = w.mesh, V = mesh.V, cup = w.cup;
  const list = mesh.query(p[0], p[1], p[2]);
  if (list) {
    for (let pass = 0; pass < 3; pass++) {
      let any = false;
      for (let i = 0; i < list.length; i++) {
        const tI = list[i], o = tI * 9;
        closestOnTri(V, o, p[0], p[1], p[2], _c);
        let nx = p[0] - _c[0], ny = p[1] - _c[1], nz = p[2] - _c[2];
        const d2 = nx * nx + ny * ny + nz * nz;
        if (d2 >= BALL_R * BALL_R) continue;
        const mi = mesh.M[tI];
        if (cup && MAT_ARR[mi].kind === 'floor') {   // le sol s'arrête au bord du trou
          const cx = _c[0] - cup[0], cz = _c[2] - cup[2];
          if (cx * cx + cz * cz < CUP_R * CUP_R && Math.abs(_c[1] - cup[1]) < 0.09) continue;
        }
        const d = Math.sqrt(d2);
        if (d < 1e-7) continue;
        nx /= d; ny /= d; nz /= d;
        const pi = tI * 3, P = mesh.P;
        const prm = (P[pi] || P[pi + 1] || P[pi + 2]) ? [P[pi], P[pi + 1], P[pi + 2]] : null;
        const M = MAT_ARR[mi];
        const vs = M.conveyor && prm ? [prm[0] * M.conveyor, prm[1] * M.conveyor, prm[2] * M.conveyor] : VS0;
        contact(b, nx, ny, nz, BALL_R - d, mi, vs, ev, t, prm);
        any = true;
      }
      if (!any) break;
    }
  }
  // --- trou ---
  if (cup) cupContact(b, cup, ev, t);

  // --- roulement : 5/7 de la gravité tangentielle + résistance au roulement ---
  if (b.grounded) {
    const n = b.gn, M = MAT_ARR[b.gmat], vs = b.gvs;
    // gravité tangentielle gt = G (n.y n - ŷ) ; on en retire 2/7
    const k27 = (2 / 7) * GRAV * h * gs;
    v[0] -= k27 * (n[1] * n[0]); v[1] -= k27 * (n[1] * n[1] - 1); v[2] -= k27 * (n[1] * n[2]);
    let rx = v[0] - vs[0], ry = v[1] - vs[1], rz = v[2] - vs[2];
    const rn = rx * n[0] + ry * n[1] + rz * n[2];
    let tx = rx - rn * n[0], ty = ry - rn * n[1], tz = rz - rn * n[2];
    const sp = Math.hypot(tx, ty, tz), dec = M.roll * h * Math.max(0.4, n[1] * gs);
    if (sp > dec) { const f = 1 - dec / sp; tx *= f; ty *= f; tz *= f; } else { tx = ty = tz = 0; }
    v[0] = vs[0] + tx + rn * n[0]; v[1] = vs[1] + ty + rn * n[1]; v[2] = vs[2] + tz + rn * n[2];
    if (M.boost && b.gprm) {
      const d = b.gprm, along = v[0] * d[0] + v[1] * d[1] + v[2] * d[2];
      if (along < M.boost) { const add = Math.min(M.boost - along, 55 * h); v[0] += d[0] * add; v[1] += d[1] * add; v[2] += d[2] * add; }
      if (ev && t - (b.lastBoost || -9) > 0.6) { ev.push({ k: 'boost', b: b.id, p: p.slice(), s: 1 }); }
      b.lastBoost = t;
    }
    b.air = 0;
  } else b.air += h;

  // vitesse maximale
  const s2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
  if (s2 > MAX_SPEED * MAX_SPEED) { const f = MAX_SPEED / Math.sqrt(s2); v[0] *= f; v[1] *= f; v[2] *= f; }

  // --- zones et hors-jeu ---
  for (const z of w.zones) {
    if (z.type === 'wind') continue;
    if (!inBox(p, z)) continue;
    if (z.type === 'water' || z.type === 'lava' || z.type === 'oob') { setOOB(b, z.type === 'oob' ? 'out' : z.type, ev, t); return; }
    if (z.type === 'tele' && t - (b.teleT || -9) > 0.6) {
      const sp = Math.hypot(v[0], v[2]) * (z.keep ?? 1) + (z.add || 0);
      p[0] = z.to[0]; p[1] = z.to[1]; p[2] = z.to[2];
      v[0] = Math.sin(z.yaw) * sp; v[1] = 0; v[2] = Math.cos(z.yaw) * sp; b.teleT = t;
      if (ev) ev.push({ k: 'tele', b: b.id, p: p.slice(), from: [(z.min[0] + z.max[0]) / 2, z.min[1] + 0.2, (z.min[2] + z.max[2]) / 2] });
    }
  }
  if (p[1] - BALL_R < w.groundY && !b.holed) {
    const gt = w.groundType;
    if (gt === 'water' || gt === 'lava') { setOOB(b, gt, ev, t); return; }
    if (gt === 'void') { setOOB(b, 'void', ev, t); return; }
    p[1] = w.groundY + BALL_R; if (v[1] < 0) v[1] *= -0.35;
    setOOB(b, 'out', ev, t); return;
  }
  if (p[1] < w.killY) { setOOB(b, w.groundType === 'void' ? 'void' : 'out', ev, t); return; }
  if (w.ceilY != null && p[1] > w.ceilY) { setOOB(b, 'void', ev, t); return; }
  if (w.bounds && (p[0] < w.bounds[0] || p[2] < w.bounds[1] || p[0] > w.bounds[2] || p[2] > w.bounds[3])) { setOOB(b, w.groundType === 'void' ? 'void' : 'out', ev, t); return; }
}

/** Collisions entre balles (masses égales, quasi élastiques) ; réveille une balle à l'arrêt */
function ballBall(balls, ev, t) {
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i]; if (!a.inPlay || a.holed || a.oob) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const c = balls[j]; if (!c.inPlay || c.holed || c.oob) continue;
      if (!a.awake && !c.awake) continue;
      const dx = c.p[0] - a.p[0], dy = c.p[1] - a.p[1], dz = c.p[2] - a.p[2], d2 = dx * dx + dy * dy + dz * dz, D = 2 * BALL_R;
      if (d2 >= D * D || d2 < 1e-10) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d, pen = (D - d) / 2;
      a.p[0] -= nx * pen; a.p[1] -= ny * pen; a.p[2] -= nz * pen; c.p[0] += nx * pen; c.p[1] += ny * pen; c.p[2] += nz * pen;
      const rv = (c.v[0] - a.v[0]) * nx + (c.v[1] - a.v[1]) * ny + (c.v[2] - a.v[2]) * nz;
      if (rv < 0) {
        const j2 = -(1 + 0.92) * rv / 2;
        a.v[0] -= j2 * nx; a.v[1] -= j2 * ny; a.v[2] -= j2 * nz; c.v[0] += j2 * nx; c.v[1] += j2 * ny; c.v[2] += j2 * nz;
        if (ev && -rv > 0.4) ev.push({ k: 'ball', b: a.awake ? a.id : c.id, o: a.awake ? c.id : a.id, p: [(a.p[0] + c.p[0]) / 2, (a.p[1] + c.p[1]) / 2, (a.p[2] + c.p[2]) / 2], s: -rv });
      }
      if (!a.awake) { a.awake = true; a.rest = 0; } if (!c.awake) { c.awake = true; c.rest = 0; }
    }
  }
}

/**
 * Avance la simulation d'un pas fixe TICK à partir du temps t (temps des obstacles).
 * @returns {boolean} vrai si au moins une balle est encore en mouvement
 */
export function tick(w, balls, t, ev, opts) {
  let maxS = 0;
  for (const b of balls) if (b.awake && !b.oob) maxS = Math.max(maxS, Math.hypot(b.v[0], b.v[1], b.v[2]));
  const n = Math.min(14, Math.max(1, Math.ceil(maxS * TICK / (0.42 * BALL_R))));
  const h = TICK / n;
  const collide = !opts || opts.collide !== false;
  for (let s = 0; s < n; s++) {
    const ts = t + s * h;
    for (const b of balls) if (b.awake && b.inPlay) subStep(w, b, ts, h, ev);
    if (collide && balls.length > 1) ballBall(balls, ev, ts);
  }
  let moving = false;
  for (const b of balls) {
    if (!b.awake || !b.inPlay) continue;
    b.t += TICK;
    if (b.oob) { if (b.oobT > 1.1) { b.awake = false; } else moving = true; continue; }
    if (b.holed) { if (t + TICK - b.holedT > 0.45) { b.awake = false; b.v[0] = b.v[1] = b.v[2] = 0; } else moving = true; continue; }
    const vs = b.grounded ? b.gvs : VS0;
    const rs = Math.hypot(b.v[0] - vs[0], b.v[1] - vs[1], b.v[2] - vs[2]);
    if (b.grounded && rs < 0.07 && vs === VS0) { b.rest += TICK; if (b.rest > 0.3) { b.awake = false; b.v[0] = b.v[1] = b.v[2] = 0; continue; } }
    // coincée entre deux parois de rocher (aucun sol sous elle) : elle ne vibre plus 30 s sur place
    else if (!b.grounded && b.touch && rs < 0.12 && vs === VS0) { b.rest += TICK; if (b.rest > 0.8) { b.awake = false; b.v[0] = b.v[1] = b.v[2] = 0; continue; } }
    else b.rest = 0;
    if (b.t > 30) { b.awake = false; b.v[0] = b.v[1] = b.v[2] = 0; continue; }   // sécurité
    moving = true;
  }
  return moving;
}

/** -1 si le point est dans une zone aimantée (gravité vers le haut), 1 sinon */
export function gravSign(w, p) { for (const z of w.zones) if (z.type === 'antigrav' && inBox(p, z)) return -1; return 1; }

/** Vecteur de frappe : direction horizontale (yaw), projetée sur le sol sous la balle */
export function shotVelocity(w, ball, yaw, power) {
  const sp = shotSpeed(power);
  let dx = Math.sin(yaw), dy = 0, dz = Math.cos(yaw);
  const n = groundNormal(w, ball.p);
  if (n) { const dn = dx * n[0] + dz * n[2]; dx -= dn * n[0]; dy -= dn * n[1]; dz -= dn * n[2]; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l; }
  return [dx * sp, dy * sp, dz * sp];
}
/** Normale du sol sous un point (null si la balle n'est pas posée) */
export function groundNormal(w, p) {
  const list = w.mesh.query(p[0], p[1], p[2]); if (!list) return null;
  // on ne garde que les surfaces qui portent la balle : collée contre un muret, c'est quand même le sol qui compte
  const gs = gravSign(w, p);
  let best = null, bd = BALL_R * 1.3;
  for (const tI of list) {
    closestOnTri(w.mesh.V, tI * 9, p[0], p[1], p[2], _c);
    const d = Math.hypot(p[0] - _c[0], p[1] - _c[1], p[2] - _c[2]);
    if (d >= bd || d <= 1e-6 || (p[1] - _c[1]) / d * gs <= 0.3) continue;
    bd = d; best = [(p[0] - _c[0]) / d, (p[1] - _c[1]) / d, (p[2] - _c[2]) / d];
  }
  return best;
}

/** Frappe la balle */
export function strike(w, ball, yaw, power) {
  ball.start = ball.p.slice(); ball.v = shotVelocity(w, ball, yaw, power);
  ball.awake = true; ball.rest = 0; ball.oob = null; ball.oobT = 0; ball.t = 0; ball.holed = false;
}

/** Remet une balle sortie à sa position avant le coup */
export function resetOOB(ball) {
  ball.p = ball.start.slice(); ball.v = [0, 0, 0]; ball.oob = null; ball.oobT = 0; ball.awake = false; ball.rest = 0;
}

/** Simulation complète d'un coup (bots, tests). Renvoie la balle finale et les événements. */
export function simulate(w, balls, t0, opts = {}) {
  const ev = opts.events ? [] : null, maxT = opts.maxT ?? 30;
  let t = t0, steps = 0;
  while (tick(w, balls, t, ev, opts)) { t += TICK; if (++steps > maxT / TICK) break; }
  return { t: t - t0, ev };
}

/** Pose une balle sur le sol en dessous de (x, y, z) : cherche la hauteur de repos */
export function settle(w, p) {
  const b = makeBall('_', [p[0], p[1] + 0.3, p[2]]); b.awake = true;
  for (let i = 0; i < 240 && b.awake; i++) tick(w, [b], 0, null);
  return b.p;
}
