// Mollo ! — bots : ils remplissent p.inp comme un joueur (mêmes commandes, mêmes compteurs d'appuis).
// Aller vers quelqu'un par les points de passage, cogner, attraper un sonné, le porter au bord et le jeter ;
// en tombant, tendre les mains ; accrochés, se hisser.
import { ST, PN } from './sim.js';

const LV = {
  facile: { think: 0.34, punch: 0.45, grab: 0.25, charge: 0.1, react: 0.5 },
  normal: { think: 0.2, punch: 0.7, grab: 0.45, charge: 0.25, react: 0.8 },
  expert: { think: 0.12, punch: 0.9, grab: 0.65, charge: 0.4, react: 1 },
};
const DIRS = Array.from({ length: 8 }, (_, i) => [Math.sin(i * Math.PI / 4), Math.cos(i * Math.PI / 4)]);

// direction du vide le plus proche : { d, x, z }
function nearestEdge(A, x, y, z) {
  let best = { d: 9, x: 0, z: 0 };
  for (const [dx, dz] of DIRS) { const d = A.floorAhead(x, y, z, dx, dz, 6); if (d < best.d) best = { d, x: dx, z: dz }; }
  return best;
}
function walkable(A, x0, y, z0, x1, z1) {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 0.45);
  for (let k = 1; k <= n; k++) { const g = A.groundAt(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n, y + 0.6); if (!g || g.y < y - 0.5) return false; }
  return true;
}
// prochain point où marcher
function route(A, x, y, z, tx, tz) {
  if (walkable(A, x, y, z, tx, tz)) return [tx, tz];
  const N = A.nodes; if (!N || !N.length) return null;
  const near = (a, b) => { let k = -1, bd = 1e9; N.forEach((n, i) => { const d = (n[0] - a) ** 2 + (n[2] - b) ** 2; if (d < bd) { bd = d; k = i; } }); return k; };
  const s = near(x, z), g = near(tx, tz);
  if (s === g) return [N[g][0], N[g][2]];
  const prev = new Map([[s, s]]), q = [s];
  while (q.length && !prev.has(g)) { const i = q.shift(); for (const [a, b] of A.links) { const j = a === i ? b : b === i ? a : -1; if (j >= 0 && !prev.has(j)) { prev.set(j, i); q.push(j); } } }
  if (!prev.has(g)) return null;
  let i = g; while (prev.get(i) !== s) i = prev.get(i);
  // on est déjà au point de départ ? vers le suivant ; sinon on le rejoint d'abord
  const ds = Math.hypot(N[s][0] - x, N[s][2] - z);
  const n = ds > 0.8 && walkable(A, x, y, z, N[s][0], N[s][2]) ? N[s] : N[i];
  return [n[0], n[2]];
}

export function botThink(sim, b, dt) {
  const L = LV[b.level] || LV.normal, rng = sim.rng;
  const ai = b.ai || (b.ai = { t: rng.next() * L.think, mx: 0, mz: 0, pc: 0, jc: 0, gc: 0, grab: false, punch: false, jump: false, holdP: 0, wait: 0, carryT: 0 });
  ai.t -= dt; if (ai.wait > 0) ai.wait -= dt;
  if (ai.holdP > 0) { ai.holdP -= dt; if (ai.holdP <= 0) ai.punch = false; }
  if (ai.t <= 0) { ai.t = L.think * (0.7 + rng.next() * 0.6); decide(sim, b, ai, L); }
  b.inp = { mx: ai.mx, mz: ai.mz, jump: ai.jump, punch: ai.punch, grab: ai.grab, pc: ai.pc, jc: ai.jc, gc: ai.gc };
}

function go(ai, x, z) { const l = Math.hypot(x, z) || 1; ai.mx = Math.round(x / l * 100) / 100; ai.mz = Math.round(z / l * 100) / 100; }

function decide(sim, b, ai, L) {
  const A = sim.arena, rng = sim.rng, pel = b.p[PN.P], che = b.p[PN.C];
  ai.jump = false;
  if (b.st === ST.KO) { ai.mx = ai.mz = 0; ai.grab = false; if (rng.next() < L.react) ai.pc++; return; }
  if (sim.ph === 'count') { ai.mx = ai.mz = 0; ai.grab = false; return; }
  const holdingBox = b.grip.some((q) => q && q.box), holding = b.grip.find((q) => q && q.o);
  // en l'air ou accroché : les mains d'abord, puis se hisser
  if (holdingBox) { ai.grab = true; ai.jump = true; ai.mx = ai.mz = 0; return; }
  if (!b.grounded) { ai.grab = rng.next() < L.react || ai.grab; const c = A.groundAt(A.x0 / 2 + A.x1 / 2, A.z0 / 2 + A.z1 / 2, 99); void c; go(ai, (A.x0 + A.x1) / 2 - pel.x, (A.z0 + A.z1) / 2 - pel.z); return; }
  // on tient quelqu'un : on le soulève s'il est sonné, on va au bord, on lâche
  if (holding) {
    ai.grab = true; ai.carryT += L.think;
    const edge = nearestEdge(A, pel.x, b.gy, pel.z);
    go(ai, edge.x, edge.z);
    if (!b.lifting) ai.jump = true;
    const dist = b.lifting ? 2.8 : 1.3;
    if (edge.d < dist || ai.carryT > 3.5) { ai.grab = false; ai.carryT = 0; ai.wait = 0.5; }
    return;
  }
  ai.carryT = 0; ai.grab = false;
  // qui viser : le plus proche, surtout s'il est sonné
  let tgt = null, ts = Infinity;
  for (const o of sim.players.values()) {
    if (o === b || o.st === ST.OUT) continue;
    const c = o.p[PN.C], d = Math.hypot(c.x - che.x, c.z - che.z, (c.y - che.y) * 0.7);
    const s = d - (o.st === ST.KO ? 2 : 0) - o.dz + (o.id === ai.tgt ? -0.6 : 0) + rng.next() * 0.6;
    if (s < ts) { ts = s; tgt = o; }
  }
  const edge = nearestEdge(A, pel.x, b.gy, pel.z);
  if (!tgt) { go(ai, (A.x0 + A.x1) / 2 - pel.x, (A.z0 + A.z1) / 2 - pel.z); return; }
  ai.tgt = tgt.id;
  const tp = tgt.p[PN.C], dx = tp.x - pel.x, dz = tp.z - pel.z, d = Math.hypot(dx, dz);
  // trop près du vide : on revient d'abord, sauf pour un coup à portée
  if (edge.d < 0.7 && d > 1.2) { go(ai, -edge.x, -edge.z); return; }
  if (d < 1.15 && Math.abs(tp.y - che.y) < 1.2) {
    go(ai, dx, dz);
    if (ai.wait > 0) return;
    if ((tgt.st === ST.KO || tgt.dz > 0.45) && rng.next() < L.grab + 0.3) { ai.grab = true; ai.wait = 0.2; return; }
    if (rng.next() < L.grab * 0.2) { ai.grab = true; ai.wait = 0.2; return; }
    if (rng.next() < L.punch) {
      if (rng.next() < L.charge) { ai.holdP = 0.4; ai.punch = true; ai.pc++; ai.wait = 0.7; }
      else { ai.holdP = 0.04; ai.punch = true; ai.pc++; ai.wait = 0.28; }
    }
    return;
  }
  // un élan pour un coup de pied sauté, de temps en temps
  if (d > 1.6 && d < 2.6 && rng.next() < L.charge * 0.25 && edge.d > 2.5) { go(ai, dx, dz); ai.jc++; ai.wait = 0.1; setKick(ai); return; }
  if (ai.kickT > 0) { ai.kickT -= L.think; ai.pc++; ai.holdP = 0.04; ai.punch = true; ai.kickT = 0; }
  const r = route(A, pel.x, b.gy, pel.z, tp.x, tp.z);
  if (r) go(ai, r[0] - pel.x, r[1] - pel.z);
  else if (edge.d < 2) go(ai, -edge.x, -edge.z);
  else { ai.mx = ai.mz = 0; }
}
function setKick(ai) { ai.kickT = 1; }
