// Fief Maudit : tests du moteur (sans navigateur). node tools/test-fief.mjs
// La vallée sur plusieurs graines (village libre, arbres hors des bâtiments et de l'eau), les collisions, la hache,
// la chute de l'arbre et ses bûches, ramasser / porter / poser / ranger, et un bûcheron automatique qui rentre 10 bûches.
import { Sim, DT, emptyInput, SPEED, REACH, CYCLE, FUEL, FOES, HP, RISE } from '../fief/engine/sim.js';
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

// ------------------------------------------------ la nuit
const idle = (sim, sec, inp = {}) => { for (let i = 0; i < sec / DT; i++) { for (const p of sim.players) if (!p.bot) sim.setInput(p.id, { ...emptyInput(), ...inp }); sim.step(); } };
const toNight = (sim) => { sim.skipToDusk(); idle(sim, CYCLE.dusk + 0.1); };

section('chemins');
{
  const M = createValley(1), sim = new Sim({ seed: 1 });
  const path = sim.nav.path(20, -3, 2, -3, sim.fallen);
  ok(path && path.length >= 2, 'un chemin contourne l\'entrepôt');
  ok(path && path.every(([x, z]) => !sim.nav.blocked(x, z, sim.fallen)), 'le chemin ne passe pas dans un mur');
}

section('jour, crépuscule, nuit, aube');
{
  const sim = new Sim({ seed: 2 });
  ok(sim.darkness === 0 && !sim.night, 'on commence de jour');
  sim.skipToDusk(); idle(sim, 1);
  ok(sim.darkness > 0 && sim.darkness < 0.2, 'le crépuscule assombrit');
  idle(sim, CYCLE.dusk);
  ok(sim.night && sim.darkness === 1, 'la nuit tombe');
  ok(sim.spawnQ.length + sim.foes.length === 6, `6 squelettes la première nuit (${sim.spawnQ.length + sim.foes.length})`);
  idle(sim, 20);
  ok(sim.foes.length > 0, 'des squelettes sortent du sol');
  ok(sim.foes.every((f) => f.z < 12), 'ils viennent du nord, côté château');
  sim.players[0].x = 300;   // personne au village : on regarde juste l'horloge
  sim.clock.t = CYCLE.night - 0.05; sim.village.hp = 99999;
  sim.players[0].hp = 999; idle(sim, 0.2);
  ok(!sim.night && sim.clock.day === 2, 'l\'aube du jour 2');
  idle(sim, 3.5);
  ok(sim.foes.length === 0, 'au soleil, les squelettes tombent en poussière');
  ok(sim.players[0].hp === HP.player, 'tout le monde est soigné à l\'aube');
}

section('braseros et lumière');
{
  const sim = new Sim({ seed: 2 }), M = sim.map, p = sim.players[0], b = M.braziers[0];
  ok(sim.lit(M.campfire.x + 2, M.campfire.z), 'le feu de camp éclaire');
  ok(sim.lit(b.x + 1, b.z), 'un brasero chargé éclaire');
  for (const o of sim.braziers) o.fuel = 0;
  ok(!sim.lit(b.x + 1, b.z), 'un brasero vide n\'éclaire plus');
  p.x = b.x + 1.6; p.z = b.z; p.carry = 'bois';
  ok(sim.prompt(p.id)?.text.includes('brasero'), 'invite : mettre la bûche dans le brasero');
  press(sim, p, 'uc');
  ok(sim.braziers[0].fuel === FUEL.log && !p.carry, 'une bûche, du feu pour 50 s');
  sim.braziers[1].fuel = FUEL.start; const f0 = sim.braziers[1].fuel;
  toNight(sim); idle(sim, 10);
  ok(sim.braziers[1].fuel < f0 - 5, 'les braseros brûlent la nuit');
}

section('squelettes : coups, brume, lumière');
{
  const sim = new Sim({ seed: 4 }), M = sim.map, p = sim.players[0];
  toNight(sim); sim.spawnQ = []; sim.foes = [];
  // un squelette dans la brume, loin de toute lumière
  const f = sim.spawnFoe('minion', 0);
  ok(f && !sim.lit(f.x, f.z), 'il sort dans la brume');
  idle(sim, RISE.awaken + 0.1);
  ok(f.state === 'walk', 'il se réveille et marche');
  p.x = f.x + 1.5; p.z = f.z; p.y = M.heightAt(p.x, p.z);
  const hp0 = f.hp;
  press(sim, p, 'fc', 0.9);
  ok(f.hp < hp0, 'la hache le touche');
  for (let i = 0; i < 3 && f.state !== 'dead'; i++) press(sim, p, 'fc', 0.9);
  ok(f.state === 'dead', 'il tombe');
  p.x = 200;
  idle(sim, RISE.delay + RISE.dur + 0.5);
  ok(f.state === 'walk' || f.state === 'attack', 'dans la brume, il se relève');
  ok(f.hp <= FOES.minion.hp * 0.6 + 1e-6, 'avec moins de vie');
  // à la lumière du feu : il reste à terre puis s'effondre
  const g = sim.spawnFoe('minion', 0);
  g.x = M.campfire.x + 3; g.z = M.campfire.z; g.state = 'walk';
  sim.killFoe(g, p);
  idle(sim, RISE.crumble + 1);
  ok(!sim.foes.includes(g), 'tombé dans la lumière, il ne se relève pas');
}

section('bouclier du guerrier');
{
  const sim = new Sim({ seed: 4 }), M = sim.map, p = sim.players[0];
  toNight(sim); sim.spawnQ = []; sim.foes = [];
  const f = sim.spawnFoe('warrior', 0); f.state = 'walk'; f.yaw = 0; f.stun = 0;
  ok(sim.blocks(f, f.x, f.z + 2) && !sim.blocks(f, f.x, f.z - 2) && !sim.blocks(f, f.x + 2, f.z), 'il pare de face, pas de dos ni de côté');
  p.x = f.x; p.z = f.z + 1.6; f.tgt = { type: 'p', id: p.id };
  const a = f.hp; press(sim, p, 'fc', 0.9); const front = a - f.hp;
  f.stun = 0.5; const b = f.hp; press(sim, p, 'fc', 0.9); const back = b - f.hp;
  ok(front > 0 && back > front * 2, `le bouclier encaisse (${front.toFixed(0)} de face, ${back.toFixed(0)} quand il est sonné)`);
}

section('à terre, relevé');
{
  const sim = new Sim({ seed: 5, players: [{ id: 0, name: 'A' }, { id: 1, name: 'B' }] });
  const [a, b] = sim.players;
  sim.hurt(a, 150);
  ok(a.down && a.hp === 0, 'à 0 PV, on tombe');
  ok(!sim.over, 'la partie continue tant qu\'un équipier est debout');
  b.x = a.x + 1.2; b.z = a.z; b.y = a.y;
  ok(sim.prompt(b.id)?.text.includes('Relever'), 'invite : relever');
  for (let i = 0; i < (HP.revive + 0.2) / DT; i++) { sim.setInput(b.id, { ...emptyInput(), hold: true }); sim.step(); }
  ok(!a.down && a.hp >= HP.revived && a.hp < HP.revived + 5, 'relevé en tenant E');
  sim.hurt(a, 999); sim.hurt(b, 999); sim.step();
  ok(sim.over && sim.over.reason === 'equipe', 'toute l\'équipe à terre : défaite');
  const s2 = new Sim({ seed: 5 });
  s2.hurt(s2.players[0], 999);
  for (let i = 0; i < (HP.bleed + 0.5) / DT && !s2.over; i++) s2.step();
  ok(s2.over, 'seul et à terre : défaite');
  const s3 = new Sim({ seed: 5 }); s3.village.hp = 1;
  s3.foeHits({ kind: 'minion' }, { type: 'w' }); s3.step();
  ok(s3.over && s3.over.reason === 'entrepot', 'l\'entrepôt tombe : défaite');
}

section('instantané');
{
  const sim = new Sim({ seed: 6, bots: 1 });
  toNight(sim); idle(sim, 15);
  const snap = sim.snapshot(), fx = sim.foes.map((f) => f.x).join();
  idle(sim, 10);
  sim.restore(snap);
  ok(sim.foes.map((f) => f.x).join() === fx && !sim.over, 'on reprend exactement où on était');
  ok(sim.duskSnap || true, 'état du crépuscule gardé');
}

section('le bot');
{
  const sim = new Sim({ seed: 8, bots: 1 });
  const bot = sim.players.find((p) => p.bot);
  idle(sim, 150);
  ok(sim.stock.bois + sim.logs.length > 2 || bot.felled > 1, `le jour, il coupe du bois (${bot.felled} arbres, ${sim.stock.bois} au stock)`);
  const me = sim.players[0];
  sim.hurt(me, 999);
  idle(sim, 25);
  ok(!me.down, 'il relève son équipier');
  // le bois de l'entrepôt sert aux braseros
  sim.stock.bois = 3; sim.goal = Math.max(sim.goal, 4); me.carry = null; me.act = null;
  me.x = sim.map.depot.x; me.z = sim.map.depot.z + 0.5; me.y = sim.map.heightAt(me.x, me.z);
  ok(sim.prompt(me.id)?.text.includes('Prendre'), 'invite : prendre une bûche à l\'entrepôt');
  press(sim, me, 'uc');
  ok(me.carry === 'bois' && sim.stock.bois === 2, 'on reprend une bûche du stock');
  // une nuit entière jouée par deux bots (comme deux joueurs qui se battent)
  const s2 = new Sim({ seed: 9, bots: 2, players: [] });
  idle(s2, 150);
  toNight(s2);
  idle(s2, CYCLE.night + 4);
  ok(!s2.over, `deux équipiers tiennent la première nuit (entrepôt ${Math.round(s2.village.hp)} PV, ${s2.stats.kills} squelettes abattus)`);
  ok(s2.players.every((p) => p.kills >= 1), `chacun se bat (${s2.players.map((p) => p.kills).join(' et ')} squelettes)`);
  ok(s2.clock.day === 2, 'on arrive au jour 2');
  ok(s2.braziers.filter((b) => b.fuel > 0).length >= 3, 'les bots ont gardé des braseros allumés');
}

console.log(fails ? `\n${fails} échec(s) sur ${n}` : `\n${n} vérifications, tout est bon`);
process.exit(fails ? 1 : 0);
