// Fief Maudit : les coéquipiers IA. Un bot joue avec les mêmes entrées qu'un joueur (direction, clic, E, E tenu) :
// il relève un équipier à terre, se bat contre les squelettes qui approchent, charge les braseros au crépuscule
// et la nuit, et le jour coupe du bois près du village et le rentre à l'entrepôt. Il se déplace par les chemins
// de la grille (nav.js). Moteur PUR.
import { FUEL, REACH, CYCLE } from './sim.js';
import { TREE_R } from './map.js';

const THINK = 0.3;   // secondes entre deux décisions

export function botInput(sim, p) {
  const ai = p.ai || (p.ai = { fc: 0, uc: 0, goal: null, path: null, pathAt: -9, pathTo: null, think: 0, cool: 0, stuck: 0, tree: null });
  const out = { wx: 0, wz: 0, walk: false, jump: false, hold: false, fc: ai.fc, uc: ai.uc };
  if (p.down || p.dead) return out;
  ai.think -= 1 / 30; ai.cool -= 1 / 30;
  if (ai.think <= 0 || !ai.goal) { ai.think = THINK; ai.goal = decide(sim, p, ai); }
  const G = ai.goal;
  if (!G) return out;
  const d = Math.hypot(G.x - p.x, G.z - p.z);
  if (d > G.near) {
    // en route
    if (!ai.path || sim.t - ai.pathAt > 2.5 || Math.hypot(ai.pathTo[0] - G.x, ai.pathTo[1] - G.z) > 1.5) {
      ai.path = sim.nav.path(p.x, p.z, G.x, G.z, sim.fallen) || [[G.x, G.z]]; ai.pathAt = sim.t; ai.pathTo = [G.x, G.z];
    }
    while (ai.path.length > 1 && Math.hypot(ai.path[0][0] - p.x, ai.path[0][1] - p.z) < 0.7) ai.path.shift();
    const w = ai.path[0], wx = w[0] - p.x, wz = w[1] - p.z, wd = Math.hypot(wx, wz) || 1;
    out.wx = wx / wd; out.wz = wz / wd;
    if (p.speed < 0.6 && !p.act) { ai.stuck += 1 / 30; if (ai.stuck > 1) { ai.path = null; ai.stuck = 0; } } else ai.stuck = 0;
    return out;
  }
  // arrivé : le geste
  if (p.act) return out;
  if (G.kind === 'revive') out.hold = true;
  else if ((G.kind === 'fight' || G.kind === 'chop') && ai.cool <= 0) { out.fc = ++ai.fc; ai.cool = 0.25; }
  else if ((G.kind === 'pick' || G.kind === 'store' || G.kind === 'feed' || G.kind === 'take') && ai.cool <= 0) { out.uc = ++ai.uc; ai.cool = 0.8; }
  return out;
}

function decide(sim, p, ai) {
  const M = sim.map, dist = (o) => Math.hypot(o.x - p.x, o.z - p.z);
  const foes = sim.foes.filter((f) => f.state !== 'dead' && f.state !== 'rise');
  const close = foes.filter((f) => dist(f) < 2.6);
  // 1. relever un équipier, si personne ne le frappe dans le dos
  const down = sim.players.filter((o) => o !== p && o.down).sort((a, b) => dist(a) - dist(b))[0];
  if (down && dist(down) < 45 && !close.length) return { kind: 'revive', x: down.x, z: down.z, near: REACH.revive - 0.5 };
  // 2. se battre : squelettes près de lui, du feu ou d'un équipier
  const camp = M.campfire;
  const threat = foes.filter((f) => f.state !== 'awaken' || dist(f) < 4)
    .filter((f) => dist(f) < 14 || Math.hypot(f.x - camp.x, f.z - camp.z) < 24 || sim.players.some((o) => !o.bot && !o.down && Math.hypot(o.x - f.x, o.z - f.z) < 8))
    .sort((a, b) => dist(a) - dist(b))[0];
  if (threat && !p.carry) return { kind: 'fight', x: threat.x, z: threat.z, near: REACH.strike - 0.6 };
  const dark = sim.darkness > 0 || sim.clock.t > CYCLE.day - CYCLE.dusk - 40;
  // 3. une bûche en main : le brasero le plus vide, ou l'entrepôt
  if (p.carry) {
    if (dark) {
      const b = M.braziers.filter((o) => sim.braziers[o.id].fuel < FUEL.max - FUEL.log).sort((a, b2) => sim.braziers[a.id].fuel - sim.braziers[b2.id].fuel)[0];
      if (b) return { kind: 'feed', x: b.x, z: b.z, near: REACH.feed - 0.6 };
    }
    return { kind: 'store', x: M.depot.x, z: M.depot.z, near: REACH.store - 1.2 };
  }
  // 3b. les mains vides au crépuscule ou la nuit : reprendre du bois à l'entrepôt pour un brasero qui faiblit
  if (dark && sim.stock.bois > 0 && sim.goal >= 4 && M.braziers.some((o) => sim.braziers[o.id].fuel < FUEL.max - FUEL.log - 10))
    return { kind: 'take', x: M.depot.x, z: M.depot.z, near: REACH.store - 1.2 };
  // 4. la nuit sans ennemi proche : rester près du feu (et ramasser les bûches qui traînent près des braseros)
  const log = sim.logs.filter((l) => l.ready && Math.hypot(l.x - camp.x, l.z - camp.z) < (dark ? 25 : 60)).sort((a, b) => dist(a) - dist(b))[0];
  if (log) return { kind: 'pick', x: log.x, z: log.z, near: REACH.pick - 0.7 };
  if (sim.night) return { kind: 'guard', x: camp.x + Math.sin(p.id) * 4, z: camp.z + Math.cos(p.id) * 4, near: 1.5 };
  // 5. le jour : couper le bois le plus proche de l'entrepôt (on garde son arbre tant qu'il est debout)
  let t = ai.tree !== null && ai.tree !== undefined && !sim.trees[ai.tree].down ? M.trees[ai.tree] : null;
  if (!t) {
    const cand = M.trees.filter((o) => !sim.trees[o.id].down && Math.hypot(o.x, o.z) > 16 && !sim.players.some((q) => q !== p && q.ai && q.ai.tree === o.id));
    cand.sort((a, b) => Math.hypot(a.x - M.depot.x, a.z - M.depot.z) - Math.hypot(b.x - M.depot.x, b.z - M.depot.z));
    t = cand[0]; ai.tree = t ? t.id : null;
  }
  if (!t) return { kind: 'guard', x: camp.x + 3, z: camp.z + 3, near: 1.5 };
  // se placer côté village
  const a = Math.atan2(M.depot.x - t.x, M.depot.z - t.z), off = TREE_R * t.s + 0.9;
  return { kind: 'chop', x: t.x + Math.sin(a) * off, z: t.z + Math.cos(a) * off, near: 0.6 };
}
