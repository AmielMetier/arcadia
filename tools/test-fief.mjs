// Fief Maudit : tests du moteur (sans navigateur). node tools/test-fief.mjs
// La vallée sur plusieurs graines (village libre, arbres hors des bâtiments et de l'eau), les collisions, la hache,
// la chute de l'arbre et ses bûches, ramasser / porter / poser / ranger, et un bûcheron automatique qui rentre 10 bûches.
import { Sim, DT, emptyInput, SPEED, REACH } from '../fief/engine/sim.js';
import { createValley, rectOf, R_PLAY, WATER } from '../fief/engine/map.js';

let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('  ✗ ' + m); } };
const section = (t) => console.log('• ' + t);

section('vallée');
for (const seed of [1, 2, 7, 42, 1234]) {
  const M = createValley(seed);
  ok(M.trees.length > 150, `graine ${seed} : assez d'arbres (${M.trees.length})`);
  for (const t of M.trees) {
    for (const b of [...M.buildings, ...M.castle]) { const R = rectOf(b, 1); if (t.x > R.x0 && t.x < R.x1 && t.z > R.z0 && t.z < R.z1) { ok(false, `graine ${seed} : arbre ${t.id} dans ${b.id}`); break; } }
    if (M.heightAt(t.x, t.z) < WATER + 0.5) ok(false, `graine ${seed} : arbre ${t.id} dans l'eau`);
  }
  const [sx, sz] = M.collide(M.spawn.x, M.spawn.z, 0.42, () => false);
  ok(Math.hypot(sx - M.spawn.x, sz - M.spawn.z) < 1e-6, `graine ${seed} : le départ est libre`);
  ok(!M.isWater(M.depot.x, M.depot.z), `graine ${seed} : la porte de l'entrepôt est au sec`);
  ok(Math.abs(M.heightAt(0, 0)) < 1.5, `graine ${seed} : le village est à plat (${M.heightAt(0, 0).toFixed(2)})`);
}

section('collisions');
{
  const M = createValley(1), w = M.warehouse;
  const [x, z] = M.collide(w.x, w.z, 0.42, () => false);
  const R = rectOf(w);
  ok(!(x > R.x0 && x < R.x1 && z > R.z0 && z < R.z1), 'on ne reste pas dans un mur');
  const t = M.trees[0];
  const [tx, tz] = M.collide(t.x + 0.1, t.z, 0.42, () => false);
  ok(Math.hypot(tx - t.x, tz - t.z) >= 0.42 + 0.5 * t.s, 'un arbre debout bloque');
  const [fx] = M.collide(t.x + 0.1, t.z, 0.42, (id) => id === t.id);
  ok(Math.abs(fx - (t.x + 0.1)) < 1e-6, 'un arbre abattu ne bloque plus');
  const [bx, bz] = M.collide(500, 0, 0.42, () => false);
  ok(Math.hypot(bx, bz) <= R_PLAY + 1e-6, 'on ne sort pas de la vallée');
}

// ------------------------------------------------ petit bûcheron automatique
function goTo(sim, p, x, z, maxT = 40) {
  const t0 = sim.t;
  let stuck = 0, side = 1, lastD = Infinity;
  while (sim.t - t0 < maxT) {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.9) return true;
    let wx = dx / d, wz = dz / d;
    if (stuck > 12) { const a = Math.atan2(wx, wz) + side * 1.3; wx = Math.sin(a); wz = Math.cos(a); if (stuck > 40) { stuck = 0; side = -side; } }
    sim.setInput(p.id, { ...emptyInput(), wx, wz, fc: p._fc || 0, uc: p._uc || 0 });
    sim.step();
    if (d > lastD - 0.02) stuck++; else if (stuck <= 12) stuck = 0;
    lastD = d;
  }
  return false;
}
function press(sim, p, k, wait = 1.2) {
  p['_' + k] = (p['_' + k] || 0) + 1;
  for (let i = 0; i < wait / DT; i++) { sim.setInput(p.id, { ...emptyInput(), fc: p._fc || 0, uc: p._uc || 0 }); sim.step(); }
}

section('hache, bûches, entrepôt');
{
  const sim = new Sim({ seed: 3 });
  const p = sim.players[0], M = sim.map;
  // l'arbre le plus proche du départ
  const tree = [...M.trees].sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  const a = Math.atan2(p.x - tree.x, p.z - tree.z);
  ok(goTo(sim, p, tree.x + Math.sin(a) * 1.4, tree.z + Math.cos(a) * 1.4), 'aller à l\'arbre');
  ok(sim.prompt(p.id)?.key === 'Clic', 'invite : couper l\'arbre');
  let hits = 0;
  for (let i = 0; i < 6 && !sim.trees[tree.id].down; i++) { press(sim, p, 'fc'); hits++; }
  ok(sim.trees[tree.id].down, `l'arbre tombe (${hits} coups)`);
  ok(hits === 3, 'un bûcheron abat un arbre en 3 coups');
  ok(sim.logs.length === 2, 'deux bûches');
  ok(sim.goal === 1, 'tutoriel : étape bûche');
  press(sim, p, 'fc', 1.5);   // les bûches finissent de tomber
  const l = sim.logs[0];
  ok(goTo(sim, p, l.x + 0.6, l.z), 'aller à la bûche');
  ok(sim.prompt(p.id)?.text.includes('Ramasser'), 'invite : ramasser');
  press(sim, p, 'uc');
  ok(p.carry === 'bois' && sim.logs.length === 1, 'la bûche est portée');
  press(sim, p, 'fc');
  ok(sim.trees.filter((t) => t.down).length === 1 && !p.act, 'on ne frappe pas en portant');
  // porter ralentit
  const x0 = p.x, z0 = p.z;
  for (let i = 0; i < 30; i++) { sim.setInput(p.id, { ...emptyInput(), wx: 1, fc: p._fc, uc: p._uc }); sim.step(); }
  ok(Math.hypot(p.x - x0, p.z - z0) <= SPEED.carry * 1.01 + 1e-6, 'on porte moins vite');
  press(sim, p, 'uc');
  ok(!p.carry && sim.logs.length === 2, 'poser la bûche par terre');
  press(sim, p, 'uc');
  ok(p.carry === 'bois', 'la reprendre');
  ok(goTo(sim, p, M.depot.x, M.depot.z, 60), 'aller à l\'entrepôt');
  ok(sim.prompt(p.id)?.text.includes('entrepôt'), 'invite : ranger');
  press(sim, p, 'uc');
  ok(sim.stock.bois === 1 && !p.carry, 'la bûche est rangée');
  ok(sim.goal === 3, 'tutoriel : 10 bûches');
}

// un segment traverse-t-il un bâtiment ? (le bûcheron de test ne sait pas contourner)
function clear(M, ax, az, bx, bz) {
  for (const b of M.boxes) for (let i = 0; i <= 40; i++) { const x = ax + (bx - ax) * i / 40, z = az + (bz - az) * i / 40; if (x > b.x0 - 0.6 && x < b.x1 + 0.6 && z > b.z0 - 0.6 && z < b.z1 + 0.6) return false; }
  return true;
}

section('dix bûches');
{
  const sim = new Sim({ seed: 11 });
  const p = sim.players[0], M = sim.map;
  let guard = 0;
  while (sim.stock.bois < 10 && guard++ < 40) {
    if (!sim.logs.some((l) => l.ready)) {
      const tree = M.trees.filter((t) => !sim.trees[t.id].down && clear(M, M.depot.x - 0.8, M.depot.z, t.x, t.z)).sort((a, b) => Math.hypot(a.x - M.depot.x, a.z - M.depot.z) - Math.hypot(b.x - M.depot.x, b.z - M.depot.z))[0];
      const a = Math.atan2(M.depot.x - tree.x, M.depot.z - tree.z);
      goTo(sim, p, tree.x + Math.sin(a) * 1.4, tree.z + Math.cos(a) * 1.4);
      for (let i = 0; i < 5 && !sim.trees[tree.id].down; i++) press(sim, p, 'fc');
      press(sim, p, 'fc', 1.5);
      if (!sim.trees[tree.id].down) { sim.trees[tree.id].down = true; continue; }
    }
    const l = sim.logs.filter((o) => o.ready).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    goTo(sim, p, l.x, l.z);
    press(sim, p, 'uc');
    if (p.carry) { goTo(sim, p, M.depot.x, M.depot.z, 60); press(sim, p, 'uc'); }
  }
  ok(sim.stock.bois >= 10, `10 bûches rentrées (${sim.stock.bois} en ${Math.round(sim.t)} s)`);
  ok(sim.goal === 4, 'tutoriel terminé');
  ok(REACH.store > 2, 'portée de l\'entrepôt');
}

console.log(fails ? `\n${fails} échec(s) sur ${n}` : `\n${n} vérifications, tout est bon`);
process.exit(fails ? 1 : 0);
