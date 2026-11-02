// Tests du moteur de Mystère Mystère (mystery/engine/) : node tools/test-mystery.mjs
// Manoir (pièces, escaliers, passages, tout est joignable), déplacement, rôles, couteau, lancer, revolver, bavure,
// revolver tombé et héros, pièces d'or, coupure, fins de manche, secret des rôles sur le réseau, prédiction des invités,
// et des manches entières entre bots aux trois niveaux.
import assert from 'node:assert/strict';
import { buildMap, LV_Y, li, T, cellT, groundAt, hasLOS, solidAt } from '../mystery/engine/map.js';
import { Sim, DT, emptyInput, movePlayer, CD, STUN_T, KNIFE_RET, COIN_BAG, FL } from '../mystery/engine/sim.js';
import { buildNav, findPath, nodeOf } from '../mystery/engine/nav.js';

let n = 0;
const test = (name, fn) => { try { fn(); n++; console.log('✓', name); } catch (e) { console.error('✗', name); throw e; } };
const M = buildMap();
const inp = (o = {}) => ({ ...emptyInput(), ...o });
// une manche sans bots, avec des joueurs placés à la main
function setup(roles, opts = {}) {
  const sim = new Sim({ seed: 7, map: M, ...opts });
  roles.forEach((r, k) => { const p = sim.addPlayer({ id: k, name: 'J' + k, color: '#fff' }); sim.setRole(p, r); });
  sim.w.ph = 'play'; sim.w.intro = 0;
  return sim;
}
const put = (p, x, z, lv = 0, yaw = 0) => { p.x = x; p.z = z; p.lv = lv; p.y = LV_Y[li(lv)]; p.yaw = yaw; p.inp = inp({ yaw }); };
const steps = (sim, k) => { for (let i = 0; i < k; i++) sim.step(DT); return sim.drainEvents(); };
const press = (p, key, extra = {}) => { p.inp = { ...p.inp, ...extra, [key]: (p.inp[key] | 0) + 1 }; };

test('le manoir : trois niveaux, des pièces nommées, des escaliers et des passages secrets', () => {
  assert.ok(M.rooms.length >= 20, 'au moins 20 pièces');
  for (const lv of [-1, 0, 1]) assert.ok(M.rooms.some((r) => r.lv === lv), 'des pièces au niveau ' + lv);
  assert.equal(M.stairs.length, 5);
  assert.equal(M.passages.length, 3);
  assert.ok(M.spawns.length >= 12);
  for (const s of M.spawns) assert.equal(cellT(M, s.lv, Math.floor(s.x), Math.floor(s.z)), T.FLOOR, 'départ sur du sol');
  assert.ok(M.props.length > 100 && M.lights.length > 20);
});

test('chaque case libre est joignable depuis le hall (bots compris)', () => {
  const nav = buildNav(M), start = nodeOf(nav, M, 0, 20.5, 18.5), seen = new Set([start]), q = [start];
  while (q.length) { const a = q.pop(); for (const [b] of nav.adj.get(a) || []) if (!seen.has(b)) { seen.add(b); q.push(b); } }
  const bad = M.walk.filter((c) => !seen.has(nodeOf(nav, M, c.lv, c.x, c.z)));
  assert.equal(bad.length, 0, `${bad.length} cases injoignables`);
  assert.ok(findPath(nav, start, nodeOf(nav, M, -1, 40.5, 22.5)), 'un chemin jusqu\'à la salle des coffres');
});

test('on monte le grand escalier jusqu\'à la galerie, on ne l\'enjambe pas par le côté', () => {
  const sim = setup(['i']), p = sim.players[0];
  put(p, 13.9, 23.5, 0, 0); // au pied de l'escalier ouest, face au nord
  for (let i = 0; i < 300; i++) movePlayer(M, sim.w, p, inp({ my: 1, yaw: 0 }), DT);
  assert.equal(p.lv, 1, 'arrivé à l\'étage'); assert.ok(Math.abs(p.y - 4) < 0.01); assert.ok(p.z < 15);
  // par le côté depuis le hall, la marche est trop haute
  put(p, 16, 18, 0, Math.PI / 2); // face à l'ouest, contre la rampe
  for (let i = 0; i < 120; i++) movePlayer(M, sim.w, p, inp({ my: 1, yaw: Math.PI / 2 }), DT);
  assert.equal(p.lv, 0); assert.ok(p.x > 14.9, 'bloqué par le côté de l\'escalier');
});

test('l\'escalier de la cuisine descend à la cave', () => {
  const sim = setup(['i']), p = sim.players[0];
  put(p, 2, 1.6, 0, Math.PI); // en haut, face au sud
  for (let i = 0; i < 260; i++) movePlayer(M, sim.w, p, inp({ my: 1, yaw: Math.PI }), DT);
  assert.equal(p.lv, -1); assert.ok(Math.abs(p.y + 4) < 0.01);
});

test('le passage secret : fermé c\'est un mur, E l\'ouvre, il se referme tout seul', () => {
  const sim = setup(['i', 'i']), p = sim.players[0], ps = M.passages[0];
  put(sim.players[1], 6, 5);
  put(p, 38.6, 10.9, 0, -Math.PI / 2); // devant la bibliothèque pivotante, face à l'est
  for (let i = 0; i < 60; i++) movePlayer(M, sim.w, p, inp({ my: 1, yaw: -Math.PI / 2 }), DT);
  assert.ok(p.x < 39.8, 'le rayonnage bloque');
  press(p, 'uc', { yaw: -Math.PI / 2 }); const ev = steps(sim, 1);
  assert.ok(ev.some((e) => e.e === 'pass' && e.open), 'ouvert'); assert.ok(sim.w.pass[ps.id] > 0);
  for (let i = 0; i < 80; i++) movePlayer(M, sim.w, p, inp({ my: 1, yaw: -Math.PI / 2 }), DT);
  assert.ok(p.x > 41, 'on passe dans le recoin');
  p.x = 38; p.inp = inp(); steps(sim, Math.ceil(8 / DT));
  assert.equal(sim.w.pass[ps.id], 0, 'refermé');
});

test('le saut retombe au sol', () => {
  const sim = setup(['i']), p = sim.players[0];
  put(p, 20.5, 18.5);
  movePlayer(M, sim.w, p, inp({ jump: true }), DT);
  assert.ok(p.air && p.vy > 0);
  for (let i = 0; i < 90; i++) movePlayer(M, sim.w, p, inp({ jump: false }), DT);
  assert.ok(!p.air && p.y === 0);
});

test('les rôles : un meurtrier, un shérif, des innocents ; on évite le meurtrier de la manche d\'avant', () => {
  let again = 0;
  for (let s = 0; s < 200; s++) {
    const sim = new Sim({ seed: s, map: M });
    for (let k = 0; k < 7; k++) sim.addPlayer({ id: k, name: 'J' + k, color: '#fff' });
    sim.assignRoles({ avoid: [0] });
    assert.equal(sim.players.filter((p) => p.role === 'm').length, 1);
    assert.equal(sim.players.filter((p) => p.role === 's').length, 1);
    if (sim.byId.get(0).role === 'm') again++;
  }
  assert.ok(again < 200 / 7, 'moins souvent meurtrier deux fois de suite');
});

test('coup de couteau : touche devant, pas derrière ; temps de recharge', () => {
  const sim = setup(['m', 'i', 'i', 's']), [m, a, b] = sim.players;
  put(sim.players[3], 6, 5);
  put(m, 20.5, 18.5, 0, 0); put(a, 20.5, 17, 0); put(b, 20.5, 20.2, 0);
  m.inp = inp({ draw: true, yaw: 0 }); steps(sim, 20);
  press(m, 'fc'); let ev = steps(sim, 1);
  assert.ok(ev.some((e) => e.e === 'kill' && e.id === a.id && e.how === 'knife'));
  assert.equal(b.st, 'ok', 'celui de derrière vit encore');
  m.inp.yaw = Math.PI; press(m, 'fc'); ev = steps(sim, 1);
  assert.equal(b.st, 'ok', 'recharge : pas de second coup aussitôt');
  steps(sim, Math.ceil(CD.stab / DT)); press(m, 'fc'); steps(sim, 1);
  assert.equal(b.st, 'dead');
});

test('couteau rangé : le clic ne fait rien ; à travers un mur non plus', () => {
  const sim = setup(['m', 'i', 's']), [m, a] = sim.players;
  put(sim.players[2], 6, 5);
  put(m, 20.5, 18.5, 0, 0); put(a, 20.5, 17);
  press(m, 'fc'); steps(sim, 2);
  assert.equal(a.st, 'ok');
  put(m, 11.5, 4.5, 0, -Math.PI / 2); put(a, 13.5, 2.5); m.inp = inp({ draw: true, yaw: -Math.PI / 2 }); steps(sim, 20);
  press(m, 'fc'); steps(sim, 1);
  assert.equal(a.st, 'ok', 'le mur protège');
});

test('lancer : le couteau tue de loin, se plante, revient tout seul ou se ramasse', () => {
  const sim = setup(['m', 'i', 'i', 's']), [m, a] = sim.players;
  put(sim.players[2], 6, 5); put(sim.players[3], 8, 5);
  put(m, 20.5, 23, 0, 0); put(a, 20.5, 13.5);
  m.inp = inp({ draw: true, yaw: 0, pitch: -0.04 }); steps(sim, 20);
  press(m, 'sc'); const ev = steps(sim, 60);
  assert.ok(ev.some((e) => e.e === 'throw'));
  assert.ok(ev.some((e) => e.e === 'kill' && e.id === a.id && e.how === 'throw'), 'touché à 9 m');
  assert.equal(m.hasKnife, false);
  steps(sim, Math.ceil(KNIFE_RET / DT) + 5);
  assert.equal(m.hasKnife, true, 'revenu tout seul');
  // un lancer dans le mur, puis on va le ramasser
  put(m, 20.5, 20, 0, 0); m.inp = inp({ draw: true, yaw: 0 }); steps(sim, 20);
  press(m, 'sc'); steps(sim, 60);
  const k = sim.w.knives[0]; assert.ok(k && !k.fly, 'planté dans le décor');
  put(m, k.x, k.z + 0.5, 0, 0); m.inp = inp(); steps(sim, 2);
  assert.equal(m.hasKnife, true, 'ramassé en passant dessus');
});

test('revolver : le shérif abat le meurtrier et les innocents gagnent', () => {
  const sim = setup(['s', 'm', 'i']), [s, m] = sim.players;
  put(sim.players[2], 6, 5);
  put(s, 20.5, 23, 0, 0); put(m, 20.5, 14);
  s.inp = inp({ draw: true, yaw: 0, pitch: -0.06 }); steps(sim, 20);
  press(s, 'fc'); const ev = steps(sim, 1);
  assert.ok(ev.some((e) => e.e === 'shot' && e.hit === m.id));
  assert.equal(sim.w.ph, 'over'); assert.equal(sim.w.win, 'i'); assert.equal(sim.w.hero, s.id);
  assert.ok(s.score >= 300);
});

test('bavure : l\'innocent meurt, le shérif est sonné et lâche le revolver ; un innocent le ramasse et devient héros', () => {
  const sim = setup(['s', 'i', 'm', 'i']), [s, a, m, b] = sim.players;
  put(m, 6, 5); put(s, 20.5, 23, 0, 0); put(a, 20.5, 16); put(b, 25, 23);
  s.inp = inp({ draw: true, yaw: 0, pitch: -0.05 }); steps(sim, 20);
  press(s, 'fc'); const ev = steps(sim, 1);
  assert.equal(a.st, 'dead');
  assert.ok(ev.some((e) => e.e === 'misfire')); assert.ok(ev.some((e) => e.e === 'gundrop'));
  assert.ok(s.stun > STUN_T - 0.1 && !s.hasGun);
  assert.equal(sim.w.guns.length, 1);
  // le meurtrier ne peut pas le prendre
  const g = sim.w.guns[0];
  put(m, g.x, g.z + 0.2); steps(sim, 3);
  assert.equal(m.hasGun, false); assert.equal(sim.w.guns.length, 1);
  put(m, 6, 5);
  put(b, g.x + 0.3, g.z); const ev2 = steps(sim, 2);
  assert.ok(ev2.some((e) => e.e === 'gunpick' && e.id === b.id));
  assert.equal(b.role, 'h'); assert.ok(b.hasGun); assert.equal(sim.w.guns.length, 0);
});

test('le shérif tué au couteau lâche son revolver', () => {
  const sim = setup(['m', 's', 'i']), [m, s] = sim.players;
  put(sim.players[2], 6, 5);
  put(m, 20.5, 18.5, 0, 0); put(s, 20.5, 17.2);
  m.inp = inp({ draw: true, yaw: 0 }); steps(sim, 20);
  press(m, 'fc'); const ev = steps(sim, 1);
  assert.ok(ev.some((e) => e.e === 'kill' && e.sheriff));
  assert.ok(ev.some((e) => e.e === 'gundrop'));
  assert.equal(sim.w.sheriffDead, true);
});

test('pièces d\'or : elles apparaissent, se ramassent, la bourse est limitée', () => {
  const sim = setup(['i', 'm', 's']), p = sim.players[0];
  put(sim.players[1], 6, 5); put(sim.players[2], 8, 5);
  steps(sim, Math.ceil(30 / DT));
  assert.ok(sim.w.coins.length > 10, 'des pièces partout');
  const c = sim.w.coins[0];
  put(p, c.x, c.z, c.lv); const ev = steps(sim, 1);
  assert.ok(ev.some((e) => e.e === 'coin' && e.id === p.id)); assert.equal(p.coins, 1);
  p.coins = COIN_BAG; const c2 = sim.w.coins[0]; put(p, c2.x, c2.z, c2.lv); steps(sim, 1);
  assert.equal(p.coins, COIN_BAG);
});

test('coupure de courant : le meurtrier seulement, avec un temps de recharge', () => {
  const sim = setup(['m', 'i', 's']), [m, a] = sim.players;
  put(m, 6, 5); put(a, 10, 5); put(sim.players[2], 8, 5);
  press(a, 'bc'); steps(sim, 1); assert.equal(sim.w.bo, 0, 'un innocent ne peut pas');
  press(m, 'bc'); steps(sim, 1); assert.equal(sim.w.bo, 0, 'pas tout de suite au début');
  steps(sim, Math.ceil(CD.boFirst / DT));
  press(m, 'bc'); const ev = steps(sim, 1);
  assert.ok(sim.w.bo > 0 && ev.some((e) => e.e === 'blackout'));
  steps(sim, Math.ceil(13 / DT)); assert.equal(sim.w.bo, 0, 'la lumière revient');
});

test('fins de manche : tout le monde mort, ou l\'aube', () => {
  const sim = setup(['m', 'i', 's']);
  sim.kill(sim.players[1], sim.players[0], 'knife'); sim.kill(sim.players[2], sim.players[0], 'knife'); steps(sim, 1);
  assert.equal(sim.w.win, 'm'); assert.ok(sim.players[0].score >= 500);
  const sim2 = setup(['m', 'i', 's'], { duration: 2 });
  for (const p of sim2.players) put(p, 6 + p.id * 3, 5);
  steps(sim2, Math.ceil(2.1 / DT));
  assert.equal(sim2.w.win, 'i'); assert.equal(sim2.w.why, 'time');
});

test('réseau : personne ne connaît les rôles avant la fin, sauf sa propre fiche', () => {
  const sim = setup(['m', 's', 'i']);
  const w = JSON.parse(JSON.stringify(sim.world()));
  assert.equal(w.roles, null);
  assert.ok(!JSON.stringify(w).includes('"role"'), 'aucun rôle dans l\'état public');
  for (const r of sim.rows()) assert.equal(r.length, 9);
  assert.equal(sim.sheet(sim.players[0]).role, 'm');
  // couteau rangé : rien dans la rangée ; sorti : le drapeau est visible de tous (c'est le jeu)
  const m = sim.players[0]; put(m, 20.5, 18.5); put(sim.players[1], 6, 5); put(sim.players[2], 8, 5);
  steps(sim, 2); assert.equal(sim.row(m)[6] & FL.KNIFE, 0);
  m.inp = inp({ draw: true }); steps(sim, 2); assert.ok(sim.row(m)[6] & FL.KNIFE);
  sim.kill(sim.players[1], m, 'knife'); sim.kill(sim.players[2], m, 'knife'); steps(sim, 1);
  assert.equal(sim.world().roles[m.id], 'm', 'révélés à la fin');
});

test('prédiction des invités : rejouer les commandes donne la position de l\'hôte', () => {
  const sim = setup(['i', 'm', 's']), p = sim.players[0];
  put(sim.players[1], 6, 5); put(sim.players[2], 8, 5);
  put(p, 20.5, 23.5);
  const copy = { ...p, inp: undefined };
  const w = JSON.parse(JSON.stringify(sim.world()));
  const seq = [];
  for (let i = 0; i < 400; i++) seq.push(inp({ my: i < 300 ? 1 : 0, mx: i % 120 < 30 ? 1 : 0, yaw: i < 200 ? 0 : 0.6, run: i % 50 < 25, jump: i === 90 }));
  for (const s of seq) { p.inp = s; sim.step(DT); }
  for (const s of seq) movePlayer(M, { ...sim.w, pass: w.pass, ph: 'play' }, copy, s, DT);
  assert.ok(Math.hypot(copy.x - p.x, copy.z - p.z) < 1e-6 && Math.abs(copy.y - p.y) < 1e-6, 'même position');
});

test('mode découverte : pas de mort, les coups laissent un marqueur', () => {
  const sim = new Sim({ seed: 3, mode: 'explore', map: M });
  const a = sim.addPlayer({ id: 0, name: 'A', color: '#fff' }), b = sim.addPlayer({ id: 1, name: 'B', color: '#fff' });
  sim.assignRoles(); assert.equal(a.role, 'x'); assert.ok(a.hasKnife && a.hasGun);
  steps(sim, 60);
  put(a, 20.5, 18.5, 0, 0); put(b, 20.5, 17); a.inp = inp({ draw: true, ws: 0 }); steps(sim, 20);
  press(a, 'fc'); const ev = steps(sim, 1);
  assert.equal(b.st, 'ok'); assert.ok(ev.some((e) => e.e === 'hitmark'));
  assert.equal(sim.w.t, -1, 'pas de chrono');
});

test('vue et tirs : la galerie voit le hall, le mur cache la cuisine', () => {
  assert.ok(hasLOS(M, null, 0, 20.5, 23, 20.5, 12));
  assert.ok(!hasLOS(M, null, 0, 20.5, 18, 6, 5));
  assert.ok(!solidAt(M, null, 20.5, 3, 18), 'le vide au-dessus du hall');
  assert.ok(solidAt(M, null, 6.5, 3.95, 5.5), 'la dalle de l\'étage');
  assert.equal(groundAt(M, 0, 13.5, 15.2) > 3.5, true, 'haut de l\'escalier');
});

test('manches entières entre bots (3 niveaux) : elles finissent, sans bot coincé', () => {
  const res = { m: 0, i: 0 };
  let stepsN = 0; const t0 = performance.now();
  for (const level of ['facile', 'normal', 'expert']) {
    for (let g = 0; g < 4; g++) {
      const sim = new Sim({ seed: 500 + g, level, map: M });
      for (let k = 0; k < 8; k++) sim.addPlayer({ id: k, name: 'B' + k, color: '#fff', bot: true, model: k % 6 });
      sim.assignRoles();
      sim.w.ph = 'play'; sim.w.intro = 0;
      const still = new Map();
      while (sim.w.ph !== 'over') {
        sim.step(DT); sim.drainEvents(); stepsN++;
        if (stepsN % 30 === 0) for (const p of sim.players) {
          if (p.st !== 'ok' || !p.brain || !p.brain.path || p.brain.idle > 0 || p.brain.known != null || p.role === 'm') { still.delete(p.id); continue; } // en duel ou à l'affût, on a le droit d'attendre
          const s = still.get(p.id);
          if (s && Math.hypot(s.x - p.x, s.z - p.z) < 0.05) { s.n++; assert.ok(s.n < 12, `bot ${p.id} (${p.role}, ${p.brain.goal?.tag}, connu=${p.brain.known}, stun=${p.stun}, dir=${p.inp.mx},${p.inp.my}) immobile en ${p.lv}:${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)} vers ${JSON.stringify(p.brain.path && p.brain.path.length)}`); }
          else still.set(p.id, { x: p.x, z: p.z, n: 0 });
        }
        assert.ok(sim.time < 200, 'la manche finit avant 200 s');
      }
      res[sim.w.win]++;
    }
  }
  const ms = (performance.now() - t0) / stepsN;
  console.log(`   meurtrier ${res.m} · innocents ${res.i} · ${ms.toFixed(3)} ms par pas`);
  assert.ok(res.m >= 2 && res.i >= 2, 'aucun camp n\'écrase l\'autre');
  assert.ok(ms < 2, 'un pas coûte moins de 2 ms');
});

console.log(`\n${n} tests réussis`);
