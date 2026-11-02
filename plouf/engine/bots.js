// Plouf ! — bots : rester au sec, se placer derrière ceux qui sont au bord et les pousser vers l'eau, ramasser
// et lancer les pastèques, jeter à l'eau ceux qu'ils attrapent ; tombés, ils deviennent des mouettes qui visent.
// Un bot remplit p.inp comme un joueur (mêmes commandes, mêmes compteurs d'appuis) : la simulation ne fait pas de différence.
import { ST } from './sim.js';

const LV = {
  // rest : souffle entre deux attaques (s) ; care : chance de voir le danger ; aggro : attirance pour ceux qui sont au bord
  facile: { think: 0.42, err: 1.0, care: 0.55, charge: [0.05, 0.3], aggro: 0.45, grab: 0.12, reach: 1.45, aim: 1.4, rest: 2.0 },
  normal: { think: 0.24, err: 0.5, care: 0.85, charge: [0.15, 0.55], aggro: 0.7, grab: 0.25, reach: 1.6, aim: 0.8, rest: 1.3 },
  expert: { think: 0.13, err: 0.18, care: 1, charge: [0.3, 0.8], aggro: 0.7, grab: 0.4, reach: 1.7, aim: 0.35, rest: 1.3 },
};
const DIRS = Array.from({ length: 16 }, (_, i) => [Math.sin(i * Math.PI / 8), Math.cos(i * Math.PI / 8)]);

// distance et direction de l'eau la plus proche (jusqu'à 3,6 m)
function water(A, x, z) {
  for (let r = 0.3; r <= 3.6; r += 0.3) {
    let sx = 0, sz = 0, n = 0;
    for (const [dx, dz] of DIRS) if (!A.support(x + dx * r, z + dz * r)) { sx += dx; sz += dz; n++; }
    if (n) { const l = Math.hypot(sx, sz) || 1; return { d: r, x: sx / l, z: sz / l }; }
  }
  return { d: 9, x: 0, z: 0 };
}

// case sûre vers laquelle se replier : solide, entourée de planches, pas trop loin
function refuge(A, x, z) {
  let best = null, bs = -Infinity;
  for (let i = 0; i < A.st.length; i++) {
    if (A.st[i] !== 1) continue;
    const c = A.center(i), col = i % A.cols, row = (i / A.cols) | 0;
    let nb = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const cc = col + dc, rr = row + dr;
      if ((dc || dr) && cc >= 0 && rr >= 0 && cc < A.cols && rr < A.rows && A.st[rr * A.cols + cc] === 1) nb++;
    }
    const s = nb - Math.hypot(c.x - x, c.z - z) * 0.35;
    if (s > bs) { bs = s; best = c; }
  }
  return best;
}

// prochain point où marcher pour aller de (x0, z0) à (x1, z1) sans passer par l'eau : chemin de case en case
// (largeur d'abord, les cases branlantes évitées), puis la case la plus lointaine qu'on voit en ligne droite
function clear(A, x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0, d = Math.hypot(dx, dz), n = Math.ceil(d / 0.3);
  const ox = d > 0 ? -dz / d * 0.3 : 0, oz = d > 0 ? dx / d * 0.3 : 0;
  for (let k = 1; k <= n; k++) {
    const x = x0 + dx * k / n, z = z0 + dz * k / n;
    if (A.support(x, z) !== 1 || !A.support(x + ox, z + oz) || !A.support(x - ox, z - oz)) return false;
  }
  return true;
}
function path(A, x0, z0, x1, z1) {
  const s = A.cellAt(x0, z0), g = A.cellAt(x1, z1);
  if (g < 0 || !A.solid(g)) return null;
  if (s === g || clear(A, x0, z0, x1, z1)) return { x: x1, z: z1 };
  if (s < 0) return A.center(g);
  const prev = new Int16Array(A.st.length).fill(-1); prev[s] = s;
  const q = [s];
  for (let h = 0; h < q.length && prev[g] < 0; h++) {
    const i = q[h], c = i % A.cols, r = (i / A.cols) | 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= A.cols || rr >= A.rows) continue;
      const j = rr * A.cols + cc;
      if (prev[j] >= 0 || (A.st[j] !== 1 && j !== g)) continue;
      prev[j] = i; q.push(j);
    }
  }
  if (prev[g] < 0) return null;
  const cells = []; for (let i = g; i !== s; i = prev[i]) cells.push(i);
  cells.reverse();
  let wp = A.center(cells[0]);
  for (const i of cells) { const c = A.center(i); if (clear(A, x0, z0, c.x, c.z)) wp = c; else break; }
  return wp;
}

const norm = (x, z) => { const l = Math.hypot(x, z); return l > 1e-4 ? [x / l, z / l, l] : [0, 0, 0]; };

export function botThink(sim, p, dt) {
  const L = LV[p.level] || LV.normal, rng = sim.rng;
  const ai = p.ai || (p.ai = { t: rng.next() * L.think, mx: 0, mz: 0, pc: 0, gc: 0, push: false, hold: 0, chg: 0, tgt: -1, tgtT: 0, ct: 0, rest: 0 });
  if (ai.push) { ai.chg += dt; if (ai.chg >= ai.hold || p.st !== ST.RUN || p.stun > 0) { ai.push = false; ai.rest = L.rest * (0.6 + rng.next() * 0.8); } }
  if (ai.rest > 0) ai.rest -= dt;
  if (p.ck) ai.ct += dt; else ai.ct = 0;
  ai.t -= dt;
  if (ai.t <= 0) { ai.t = L.think * (0.7 + rng.next() * 0.6); decide(sim, p, ai, L); }
  p.inp = { mx: ai.mx, mz: ai.mz, push: ai.push, pc: ai.pc, gc: ai.gc };
}

function steer(ai, x, z) { const [nx, nz] = norm(x, z); ai.mx = Math.round(nx * 100) / 100; ai.mz = Math.round(nz * 100) / 100; }
function facing(p, x, z) { const [nx, nz] = norm(x, z); return Math.sin(p.yaw) * nx + Math.cos(p.yaw) * nz; }

function decide(sim, p, ai, L) {
  const A = sim.arena, rng = sim.rng;
  if (p.st === ST.HELD) { ai.pc++; if (!p.lift) { const w = water(A, p.x, p.z); steer(ai, -w.x, -w.z); } return; } // on gigote pour se dégager, et on tire vers l'intérieur
  if (p.st === ST.DOWN) { ai.pc++; ai.mx = ai.mz = 0; return; }         // à plat : on martèle pour se relever
  if (p.st === ST.HANG) { const h = p.hg; if (h) { steer(ai, -h.nx, -h.nz); if (rng.next() < L.care) ai.pc++; } return; } // suspendu : on se hisse
  if (p.st === ST.GULL) { gull(sim, p, ai, L); return; }
  if (p.st !== ST.RUN || sim.ph === 'count') { ai.mx = ai.mz = 0; ai.rest = L.rest * (1 + rng.next()); return; } // au départ, on souffle un peu
  if (ai.push) { // en train d'armer : on garde la cible en ligne de mire
    const q = sim.players.get(ai.tgt);
    if (q && q.st === ST.RUN) steer(ai, q.x - p.x + (rng.next() - 0.5) * L.err * 0.5, q.z - p.z + (rng.next() - 0.5) * L.err * 0.5);
    return;
  }
  const w = sim.wind && sim.wind.warn <= 0 ? [Math.sin(sim.wind.a), Math.cos(sim.wind.a)] : null;
  const me = water(A, p.x, p.z);

  // 1. danger : l'eau tout près, ou la planche qui branle sous les pieds : on s'écarte du bord, ou on rejoint un refuge
  if ((me.d <= 0.6 || A.shaking(p.x, p.z) || (w && me.d < 1.6 && me.x * w[0] + me.z * w[1] > 0.3)) && rng.next() < L.care) {
    if (me.d < 9 && A.support(p.x - me.x * 0.9, p.z - me.z * 0.9) === 1 && !A.shaking(p.x - me.x * 0.9, p.z - me.z * 0.9)) { steer(ai, -me.x - (w ? w[0] * 0.5 : 0), -me.z - (w ? w[1] * 0.5 : 0)); return; }
    if (goTo(ai, A, p, refuge(A, p.x, p.z))) return;
  }

  // 2. on porte quelqu'un : direction l'eau, et on le jette
  if (p.ck === 2) {
    const wd = water(A, p.x, p.z);
    steer(ai, wd.x, wd.z);
    if (facing(p, wd.x, wd.z) > 0.8 || ai.ct > 1.1) { ai.gc++; ai.mx = ai.mz = 0; }
    return;
  }

  // cibles : les adversaires debout, de préférence près du bord
  let tgt = null, ts = Infinity;
  for (const q of sim.players.values()) {
    if (q === p || (q.st !== ST.RUN && q.st !== ST.DOWN && q.st !== ST.HANG)) continue;
    const d = Math.hypot(q.x - p.x, q.z - p.z), qw = water(A, q.x, q.z);
    let s = d - (3.6 - Math.min(3.6, qw.d)) * 1.2 * L.aggro + (q.id === ai.tgt ? -0.8 : 0) + rng.next() * L.err;
    if (q.st === ST.DOWN) s -= 1.5 * L.aggro;                 // à plat : facile à soulever et à jeter
    if (q.st === ST.HANG) s += d < 3.5 ? -2.5 : 4;            // suspendu tout près : un coup de pied et c'est réglé
    if (q.dz > 0.5) s -= 0.6;                                 // déjà étourdi : encore un coup
    if (s < ts) { ts = s; tgt = q; }
  }

  // 3. une pastèque en main : on vise et on lance
  if (p.ck === 1) {
    if (tgt) {
      const lead = 0.35;
      const tx = tgt.x + tgt.vx * lead - p.x + (rng.next() - 0.5) * L.aim, tz = tgt.z + tgt.vz * lead - p.z + (rng.next() - 0.5) * L.aim;
      steer(ai, tx, tz);
      const d = Math.hypot(tx, tz);
      if ((facing(p, tx, tz) > 0.9 && d < 6.5) || ai.ct > 2.5) { ai.gc++; ai.mx = ai.mz = 0; }
    } else ai.gc++;
    return;
  }

  // 4. une pastèque pas loin : on va la chercher
  if (!ai.fetch || !sim.objs.some((o) => o.id === ai.fetch && o.st === 0)) {
    ai.fetch = 0;
    const m = sim.objs.find((o) => o.k === 'melon' && o.st === 0 && Math.hypot(o.x - p.x, o.z - p.z) < 5);
    if (m && rng.next() < L.grab * 2) ai.fetch = m.id;
  }
  const melon = ai.fetch && sim.objs.find((o) => o.id === ai.fetch);
  if (melon) {
    if (Math.hypot(melon.x - p.x, melon.z - p.z) < 0.9) { steer(ai, melon.x - p.x, melon.z - p.z); ai.gc++; return; }
    if (goTo(ai, A, p, melon)) return;
    ai.fetch = 0;
  }

  if (!tgt) { if (!goTo(ai, A, p, refuge(A, p.x, p.z))) ai.mx = ai.mz = 0; return; }
  if (p.dz > 0.65 && rng.next() < L.care && goTo(ai, A, p, refuge(A, p.x, p.z))) return;
  ai.tgt = tgt.id;
  const qw = water(A, tgt.x, tgt.z);
  const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz);
  const lined = qw.d < 3.6 ? facingVec(dx, dz, qw.x, qw.z) : 1; // la cible est-elle entre moi et l'eau ?

  // 5a. un suspendu : on s'approche du bord et on lui tape sur les doigts (un jab)
  if (tgt.st === ST.HANG) {
    const h = tgt.hg, gx = h ? h.ax - h.nx * 0.25 : tgt.x, gz = h ? h.az - h.nz * 0.25 : tgt.z;
    if (d < 0.95 && facing(p, dx, dz) > 0.5) { ai.hold = 0.04; ai.pc++; ai.push = true; ai.chg = 0; steer(ai, dx, dz); return; }
    if (!goTo(ai, A, p, { x: gx, z: gz })) steer(ai, dx, dz);
    return;
  }
  // 5b. un adversaire à plat tout près : on le soulève (puis on va le jeter à l'eau)
  if (tgt.st === ST.DOWN) { if (d < 1.2) { if (rng.next() < L.grab + 0.25) { steer(ai, dx, dz); ai.gc++; ai.rest = L.rest * 0.5; } return; } if (goTo(ai, A, p, tgt)) return; }
  // 5c. tout près d'un adversaire au bord : on l'attrape pour le traîner à l'eau
  if (ai.rest <= 0 && d < 1.0 && qw.d < 1.6 && rng.next() < L.grab && facing(p, dx, dz) > 0.5) { ai.gc++; ai.rest = L.rest; return; }

  // 6. bien placé (et reposé) : on arme et on pousse
  if (ai.rest <= 0 && d < L.reach && (lined > 0.55 || qw.d < 1) && facing(p, dx, dz) > 0.6) {
    const [lo, hi] = L.charge;
    ai.hold = tgt.dz > 0.55 && rng.next() < 0.7 ? 0.04 : lo + rng.next() * (hi - lo) * (d < 1 ? 0.5 : 1);
    ai.pc++; ai.push = true; ai.chg = 0;
    steer(ai, dx, dz);
    return;
  }

  // 7. sinon : se placer derrière lui, côté terre, par les planches
  let gx = tgt.x - qw.x * 1.1, gz = tgt.z - qw.z * 1.1;
  if (qw.d >= 3.6 || A.support(gx, gz) !== 1) { gx = tgt.x; gz = tgt.z; }
  if (Math.hypot(gx - p.x, gz - p.z) < 0.4) { steer(ai, dx, dz); return; }
  const wp = path(A, p.x, p.z, gx, gz) || path(A, p.x, p.z, tgt.x, tgt.z);
  if (!wp) { if (!goTo(ai, A, p, refuge(A, p.x, p.z))) ai.mx = ai.mz = 0; return; }
  let [sx, sz] = norm(wp.x - p.x, wp.z - p.z);
  if (w) { sx -= w[0] * 0.35; sz -= w[1] * 0.35; }
  steer(ai, sx + (rng.next() - 0.5) * L.err * 0.3, sz + (rng.next() - 0.5) * L.err * 0.3);
}

// marcher vers un point par les planches ; false si on n'y arrive pas
function goTo(ai, A, p, to) {
  if (!to) return false;
  const wp = path(A, p.x, p.z, to.x, to.z);
  if (!wp) return false;
  if (Math.hypot(wp.x - p.x, wp.z - p.z) < 0.15) { ai.mx = ai.mz = 0; return true; }
  steer(ai, wp.x - p.x, wp.z - p.z);
  return true;
}

function facingVec(ax, az, bx, bz) { const [x1, z1] = norm(ax, az), [x2, z2] = norm(bx, bz); return x1 * x2 + z1 * z2; }

// mouette : survoler un joueur encore debout et lâcher la sardine en anticipant sa course
function gull(sim, p, ai, L) {
  const rng = sim.rng;
  ai.tgtT -= 0.2;
  let q = sim.players.get(ai.tgt);
  if (!q || q.st !== ST.RUN || q === p || ai.tgtT <= 0) {
    const alive = [...sim.players.values()].filter((x) => x !== p && x.st === ST.RUN);
    q = alive.length ? alive[Math.floor(rng.next() * alive.length)] : null;
    ai.tgt = q ? q.id : -1; ai.tgtT = 4 + rng.next() * 4;
    ai.ex = (rng.next() - 0.5) * L.aim * 1.6; ai.ez = (rng.next() - 0.5) * L.aim * 1.6;
  }
  if (!q) { steer(ai, -p.x, -p.z); return; }
  const tx = q.x + q.vx * 0.5 + ai.ex - p.x, tz = q.z + q.vz * 0.5 + ai.ez - p.z, d = Math.hypot(tx, tz);
  const k = Math.min(1, d / 1.5) / Math.max(d, 1e-4); // ralentit en arrivant au-dessus de la cible
  ai.mx = Math.round(tx * k * 100) / 100; ai.mz = Math.round(tz * k * 100) / 100;
  if (d < 0.7 && p.cd <= 0 && rng.next() < 0.5) ai.pc++;
}
