// Tests du moteur de Site Noir (sitenoir/engine/) : node tools/test-sitenoir.mjs
// Carte (tout est atteignable, dans l'ordre des clés), déplacement, portes et clés, objets, preuves, générateur, ascenseur, coups, relève,
// sabotages, fin de partie, réseau (lignes et état), reprise d'hôte, parties entières entre bots.
import { Sim, DT, ITEMS, movePlayer, interactTarget, rowOf, applyRow, emptyInput, WAKE_T, GEN_T, LIFT, MAX_CAMS, cellSolid } from '../sitenoir/engine/sim.js';
import { buildMap, Nav, T, Z, W, H, DEEP, floorAt, hasLOS, zoneAt } from '../sitenoir/engine/map.js';

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗ ' + msg); } };
const section = (s) => console.log('• ' + s);

function newGame(opts = {}) {
  const sim = new Sim({ seed: opts.seed ?? 7, level: 'normal', ...opts });
  const s = sim.addPlayer({ id: 1, name: 'Ana', color: '#ff0000' });
  const m = sim.addPlayer({ id: 9, name: 'Mo', color: '#00ff00', role: 'm' });
  m.wake = 0;
  return { sim, s, m };
}
const run = (sim, sec) => { for (let i = 0; i < Math.round(sec / DT); i++) sim.step(DT); };
const place = (p, x, z, yaw = 0) => { p.x = x; p.z = z; p.yaw = yaw; p.inp.yaw = yaw; p.inp.pitch = 0; };
// regarde vers (x, z)
const look = (p, x, z) => { const a = Math.atan2(-(x - p.x), -(z - p.z)); p.yaw = a; p.inp.yaw = a; };

section('carte');
const M = buildMap();
{
  ok(M.doors.length >= 20, 'assez de portes');
  ok(M.lockers.length >= 12, 'des casiers partout');
  const nav = new Nav(M);
  // ouvert d'après l'ordre du jeu : sans clé on ne quitte pas l'aile A, avec le badge on atteint l'aile B, avec la clé le sous-sol
  const passWith = (keys) => (i) => { if (M.t[i] !== T.FLOOR) return false; const d = M.doorAt[i]; if (d < 0) return true; const D = M.doors[d]; if (D.kind === 'lift') return false; return !D.key || keys.includes(D.key); };
  const start = M.spawns.surv[0], s0 = [start[0] + 0.5, start[1] + 0.5];
  const reach = (x, z, keys) => !!nav.find(s0[0], s0[1], x, z, passWith(keys));
  const standable = (x, z) => { for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (M.t[(z + b) * W + x + a] === T.FLOOR) return [x + a + 0.5, z + b + 0.5]; return null; };
  // chaque meuble à fouiller s'atteint au bon moment
  const beside = (c) => { const cx = Math.floor(c.x), cz = Math.floor(c.z), l = []; for (let z = cz - 2; z <= cz + 2; z++) for (let x = cx - 2; x <= cx + 2; x++) if (M.t[z * W + x] === T.FLOOR && M.doorAt[z * W + x] < 0 && Math.hypot(x + 0.5 - c.x, z + 0.5 - c.z) <= 1.6) l.push([x + 0.5, z + 0.5]); return l; };
  for (const c of M.caches) {
    ok(c.zone === Z.A || c.zone === Z.B || c.zone === Z.SOUS, `meuble ${c.id} (${c.label} ${c.x},${c.z}) dans le bâtiment`);
    const keys = c.zone === Z.A ? [] : c.zone === Z.B ? ['bleu'] : ['bleu', 'orange'];
    ok(beside(c).some(([x, z]) => reach(x, z, keys)), `meuble ${c.id} (${c.label} ${c.x},${c.z}) atteignable avec ${keys.length} clé(s)`);
  }
  ok(M.caches.filter((c) => c.zone === Z.A).length >= 10 && M.caches.filter((c) => c.zone === Z.B).length >= 10 && M.caches.filter((c) => c.zone === Z.SOUS).length >= 6, 'assez de meubles à fouiller');
  const g = M.generator.panel;
  ok(reach(g.x, g.z, ['bleu', 'orange']), 'générateur atteignable avec les clés');
  ok(!reach(g.x, g.z, ['bleu']), 'générateur fermé sans la clé orange');
  ok(reach(M.liftCall.x, M.liftCall.z, ['bleu', 'orange']), 'palier de l\'ascenseur atteignable');
  for (const s of M.spots.trace) { const c = standable(s[0], s[1]); ok(c && reach(c[0], c[1], ['bleu', 'orange']), `trace atteignable (${s})`); }
  for (const s of M.spots.pile) { const c = standable(s[0], s[1]); ok(c && reach(c[0], c[1], ['bleu', 'orange']), `pile atteignable (${s})`); }
  for (const l of M.lockers) ok(reach(l.fx, l.fz, ['bleu', 'orange']), `casier ${l.id} accessible (${l.x},${l.z})`);
  for (const r of M.rooms) {
    if (r.zone === Z.PAD) continue;
    let c = null;
    for (let z = r.z0; z <= r.z1 && !c; z++) for (let x = r.x0; x <= r.x1 && !c; x++) if (M.t[z * W + x] === T.FLOOR && M.doorAt[z * W + x] < 0) c = [x + 0.5, z + 0.5];
    ok(c && reach(c[0], c[1], ['bleu', 'orange']), `pièce atteignable : ${r.name}`);
  }
  // chaque porte s'ouvre sur du sol, des deux côtés
  for (const d of M.doors) {
    const c = d.cells[0], cx = c % W, cz = (c / W) | 0, [ax, az] = d.axis === 'x' ? [0, 1] : [1, 0];
    const a = M.t[(cz + az) * W + cx + ax], b = M.t[(cz - az) * W + cx - ax];
    ok(a === T.FLOOR && b === T.FLOOR, `porte ${d.id} (${d.name}) dégagée des deux côtés`);
  }
  // le plan ne se superpose pas : rampes continues
  ok(Math.abs(floorAt(M, 45, 12.5)) < 0.01, 'rampe : haut à 0');
  ok(Math.abs(floorAt(M, 52, 12.5) - DEEP) < 0.01, 'rampe : bas à -4');
  ok(Math.abs(floorAt(M, 48.5, 12.5) - DEEP / 2) < 0.01, 'rampe : milieu');
  // monstre : ni dehors ni cabine ; depuis sa cage il atteint tout le bâtiment
  const mPass = (i) => { if (M.t[i] !== T.FLOOR) return false; const z = M.zone[i], d = M.doorAt[i]; return !(z === Z.OUTPOST || z === Z.PAD || z === Z.CABINE || d === M.liftBottom || d === M.liftTop); };
  ok(!!nav.find(M.spawns.monster.x, M.spawns.monster.z, g.x, g.z, mPass), 'le monstre atteint le générateur');
  ok(!!nav.find(M.spawns.monster.x, M.spawns.monster.z, 23.5, 45.5, mPass), 'le monstre atteint l\'accueil');
  ok(!nav.find(M.spawns.monster.x, M.spawns.monster.z, 24, 54, mPass), 'le monstre ne sort pas à l\'avant-poste');
}

section('graines : place des objets');
{
  const seen = new Set();
  for (let s = 1; s <= 60; s++) {
    const sim = new Sim({ seed: s });
    const where = (k) => sim.M.caches.filter((c) => sim.w.caches[c.id].loot === k);
    const b = where('bleu'), o = where('orange'), f = where('fuse');
    ok(b.length === 1 && b[0].zone === Z.A, `badge caché en aile A (graine ${s})`);
    ok(o.length === 1 && o[0].zone === Z.B, `clé cachée en aile B (graine ${s})`);
    ok(f.length === 4 && f.some((c) => c.zone === Z.A) && f.some((c) => c.zone === Z.B) && f.some((c) => c.zone === Z.SOUS), `fusibles répartis (graine ${s})`);
    ok(!sim.w.items.some((i) => ['bleu', 'orange', 'fuse'].includes(i.k)), 'rien de visible au départ');
    const zones = new Set(sim.w.traces.map((t) => t.zone));
    ok(zones.has(Z.A) && zones.has(Z.B) && zones.has(Z.SOUS), `traces dans les 3 zones (graine ${s})`);
    ok(sim.w.traces.length === 5, 'cinq traces');
    seen.add(`${b[0].x},${b[0].z}`);
  }
  ok(seen.size > 3, 'le badge change de place');
}

section('déplacement');
{
  const { sim, s } = newGame();
  const inp = { ...emptyInput(), my: 1, yaw: 0 };
  place(s, 22.5, 52.5, 0);
  const z0 = s.z;
  for (let i = 0; i < 60; i++) movePlayer(M, sim.w, s, inp, DT);
  ok(Math.abs(s.z - (z0 - 3)) < 0.05, 'marche 3 m/s vers le nord');
  place(s, 26.5, 49, 0);
  for (let i = 0; i < 200; i++) movePlayer(M, sim.w, s, inp, DT);
  ok(s.z >= 48 + 0.29, 'le mur arrête');
  place(s, 22.9, 48.6, 0);
  for (let i = 0; i < 200; i++) movePlayer(M, sim.w, s, inp, DT);
  ok(s.z > 48, 'la porte fermée arrête');
  sim.w.doors[0].open = true;
  for (let i = 0; i < 200; i++) movePlayer(M, sim.w, s, inp, DT);
  ok(s.z < 47, 'la porte ouverte laisse passer');
  // course et endurance
  place(s, 20, 55, 0); s.stam = 100;
  const run2 = { ...emptyInput(), my: 1, run: true, yaw: Math.PI / 2 };
  const x0 = s.x; for (let i = 0; i < 60; i++) movePlayer(M, sim.w, s, run2, DT);
  ok(Math.abs(s.x - (x0 - 4.7)) < 0.08, 'court plus vite');
  ok(s.stam < 90, 'courir fatigue');
  for (let i = 0; i < 60 * 8; i++) movePlayer(M, sim.w, s, { ...run2, yaw: i % 200 < 100 ? -Math.PI / 2 : Math.PI / 2 }, DT);
  ok(s.stam < 20, 'l\'endurance s\'épuise');
  // rampe
  sim.w.doors[M.doors.findIndex((d) => d.name === 'Salle des machines')].open = true;
  place(s, 46, 13, 0);
  const east = { ...emptyInput(), my: 1, yaw: -Math.PI / 2 };
  for (let i = 0; i < 60 * 3; i++) movePlayer(M, sim.w, s, east, DT);
  ok(s.y < -3.5, 'la rampe descend');
  // le monstre court plus vite mais pas dehors
  const m = sim.monster; place(m, 23, 46, 0); sim.w.doors[0].open = true;
  const n = { ...emptyInput(), my: 0, mx: 0, yaw: 0 }; n.my = -1; n.yaw = 0;
  for (let i = 0; i < 300; i++) movePlayer(M, sim.w, m, n, DT);
  ok(m.z < 48, 'le monstre ne franchit pas le sas vers dehors');
}

section('objets et portes à clé');
{
  const { sim, s } = newGame();
  const door = M.doors.findIndex((d) => d.key === 'bleu');
  const cb = M.caches.find((c) => sim.w.caches[c.id].loot === 'bleu');
  // sans clé
  place(s, 7.5, 24.7, 0);
  let tg = interactTarget(M, sim.w, sim.players, s);
  ok(tg && tg.kind === 'door' && tg.ok === false, 'porte verrouillée : refus');
  s.inp.uc = 1; sim.step(DT);
  ok(!sim.w.doors[door].open && !sim.w.doors[door].unlocked, 'reste fermée');
  // ramasser le badge
  s.botTarget = { kind: 'cache', id: cb.id };
  place(s, cb.x, cb.z + 1);
  tg = interactTarget(M, sim.w, sim.players, s);
  ok(tg && tg.kind === 'cache' && tg.hold, 'on peut fouiller : ' + JSON.stringify(tg));
  s.inp.use = true; run(sim, 2); ok(!sim.w.caches[cb.id].done, 'fouille en cours');
  s.inp.use = false; run(sim, 0.1); s.inp.use = true; run(sim, 2); ok(!sim.w.caches[cb.id].done, 'lâcher recommence la fouille');
  run(sim, 2.2); s.inp.use = false; s.botTarget = null;
  ok(sim.w.caches[cb.id].done, 'meuble fouillé');
  ok(s.inv.some((q) => q && q.k === 'bleu') && !sim.w.items.some((i) => i.k === 'bleu'), 'le badge trouvé va droit dans le sac');
  ok(s.inv[0] && s.inv[0].k === 'photo', 'on part avec l\'appareil photo');
  // sac plein : il reste sur le meuble, et on peut l'y prendre
  s.inv = [{ k: 'photo', n: 6 }, { k: 'pile', n: 1 }, { k: 'emf', n: 1 }];
  const cb2 = M.caches.find((c) => sim.w.caches[c.id].loot === 'orange');
  s.botTarget = { kind: 'cache', id: cb2.id }; place(s, cb2.x, cb2.z + 1); s.y = cb2.y; s.inp.use = true; run(sim, 3.2); s.inp.use = false; s.botTarget = null;
  ok(sim.w.items.some((i) => i.k === 'orange') && !s.inv.some((q) => q && q.k === 'orange'), 'sac plein : la clé reste sur le meuble');
  sim.w.items = sim.w.items.filter((i) => i.k !== 'orange');
  const b = sim.dropItem('bleu', 1, s.x, s.z - 0.5);
  s.inv = [{ k: 'photo', n: 6 }, null, null];
  look(s, b.x, b.z);
  tg = interactTarget(M, sim.w, sim.players, s);
  ok(tg && tg.kind === 'item', 'on voit le badge : ' + JSON.stringify(tg));
  s.inp.uc = 2; sim.step(DT);
  ok(s.inv.some((q) => q && q.k === 'bleu'), 'badge pris');
  ok(!sim.w.items.includes(b), 'le badge n\'est plus au sol');
  // ouvrir
  place(s, 7.5, 24.7, 0);
  s.inp.uc = 3; sim.step(DT);
  ok(sim.w.doors[door].unlocked && sim.w.doors[door].open, 'le badge déverrouille');
  ok(M.doors.filter((d) => d.key === 'bleu').some((d) => !sim.w.doors[d.id].unlocked), 'chaque porte se déverrouille à part');
  // lâcher le badge
  s.sel = s.inv.findIndex((q) => q && q.k === 'bleu'); s.inp.sel = s.sel; s.inp.dc = 1; sim.step(DT);
  ok(!s.inv.some((q) => q && q.k === 'bleu') && sim.w.items.some((i) => i.k === 'bleu'), 'lâché au sol');
  // la porte déverrouillée s'ouvre sans clé
  sim.w.items = sim.w.items.filter((i) => i.k !== 'bleu');
  s.inp.uc = 4; sim.step(DT);
  ok(!sim.w.doors[door].open, 'on referme');
  s.inp.uc = 5; sim.step(DT);
  ok(sim.w.doors[door].open, 'on rouvre sans la clé');
  // caisses : prendre un seul exemplaire, stock qui baisse
  const crate = sim.w.items.find((i) => i.k === 'emf' && i.stock), n0 = crate.n;
  place(s, crate.x, crate.z + 1); look(s, crate.x, crate.z);
  s.inp.uc = 6; sim.step(DT);
  ok(s.inv.some((q) => q && q.k === 'emf') && crate.n === n0 - 1, 'caisse : capteur pris, stock - 1');
  s.inp.uc = 7; sim.step(DT);
  ok(crate.n === n0 - 1, 'pas deux fois le même outil');
  // inventaire plein : échange avec la case tenue
  s.inv = [{ k: 'photo', n: 6 }, { k: 'cams', n: 2 }, { k: 'emf', n: 1 }]; s.sel = 1; s.inp.sel = 1;
  const pile = sim.dropItem('pile', 1, s.x, s.z - 0.5);
  look(s, pile.x, pile.z);
  s.inp.uc = 8; sim.step(DT);
  ok(s.inv.some((q) => q && q.k === 'pile') && sim.w.items.some((i) => i.k === 'cams'), 'inventaire plein : l\'objet tenu tombe');
  // pile
  s.batt = 5; s.inp.rc = 1; sim.step(DT);
  ok(s.batt > 99 && !s.inv.some((q) => q && q.k === 'pile'), 'la pile recharge la lampe');
}

section('lampe');
{
  const { sim, s } = newGame();
  s.torch = true; s.batt = 1;
  run(sim, 3);
  ok(!s.torch && s.batt === 0, 'la lampe s\'éteint à plat');
  s.inp.tc = 1; sim.step(DT);
  ok(!s.torch, 'pas de rallumage sans pile');
}

section('preuves');
{
  const { sim, s, m } = newGame();
  const tr = sim.w.traces[0];
  s.inv = [{ k: 'emf', n: 1 }, null, null]; s.sel = 0; s.inp.sel = 0;
  place(s, tr.x, tr.z); s.y = tr.y;
  place(m, 70, 40); m.y = DEEP;
  s.inp.fire = true;
  run(sim, 3.2);
  ok(tr.done && s.proofs === 1, 'trace enregistrée en 3 s');
  s.inp.fire = false;
  // photo : sonne le monstre et compte une preuve, une seule fois par joueur
  const a = newGame();
  a.s.inv = [{ k: 'photo', n: 6 }, null, null];
  place(a.s, 22, 25, Math.PI / 2 * 0); place(a.m, 22, 25.2 - 6); a.m.y = 0;
  // ils sont dans le couloir nord : le monstre se trouve dans la direction -z, derrière un mur ; on le met dans le même couloir
  place(a.s, 12, 25.5); place(a.m, 18, 25.5); look(a.s, a.m.x, a.m.z); a.m.y = 0; a.s.y = 0;
  a.s.inp.fc = 1; a.sim.step(DT);
  ok(a.s.proofs === 1, 'photo : une preuve');
  ok(a.m.stun > 0 && a.m.immune > 0, 'l\'éclair sonne le monstre');
  ok(a.s.inv[0].n === 5, 'une pellicule en moins');
  a.m.stun = 0; a.m.immune = 0; a.s.flashCd = 0;
  a.s.inp.fc = 2; a.sim.step(DT);
  ok(a.s.proofs === 1, 'pas de seconde preuve photo');
  ok(a.m.stun > 0, 'mais l\'éclair marche encore');
  // photo ratée : mur entre eux
  const b = newGame();
  b.s.inv = [{ k: 'photo', n: 6 }, null, null];
  place(b.s, 14, 36); place(b.m, 14, 31); look(b.s, b.m.x, b.m.z); b.sim.w.doors.forEach((q) => { q.open = false; });
  b.s.inp.fc = 1; b.sim.step(DT);
  ok(b.s.proofs === 0 && b.m.stun === 0, 'photo à travers une porte fermée : rien');
  // audio
  const c = newGame();
  c.s.inv = [{ k: 'emf', n: 1 }, null, null]; c.sim.w.traces.length = 0;
  place(c.s, 12, 25.5); place(c.m, 18, 25.5); c.s.y = 0; c.m.y = 0; c.s.inp.fire = true;
  run(c.sim, 4.2);
  ok(c.s.proofs === 1 && c.s.audio, 'scan audio près du monstre');
}

section('générateur et ascenseur');
{
  const { sim, s, m } = newGame();
  s.proofs = 1;
  place(m, 10, 3); m.y = 0;
  const L = sim.w.lift;
  sim.w.doors.forEach((d, i) => { if (M.doors[i].key) { d.unlocked = true; d.open = true; } });
  const g = M.generator.panel;
  // appel refusé sans courant
  place(s, M.liftCall.x, M.liftCall.z - 1); s.y = DEEP; look(s, M.liftCall.x, M.liftCall.z);
  let tg = interactTarget(M, sim.w, sim.players, s);
  ok(tg && tg.kind === 'call' && !tg.ok, 'ascenseur sans courant : refus');
  s.inp.uc = 1; sim.step(DT);
  ok(L.state === 'idle' && L.at === 'top', 'il ne bouge pas');
  // fusibles d'abord
  place(s, g.x, g.z); s.y = DEEP; look(s, M.generator.x, M.generator.z);
  tg = interactTarget(M, sim.w, sim.players, s);
  ok(tg && tg.kind === 'fuse' && tg.ok === false, 'sans fusible : refus');
  s.inp.use = true; run(sim, 2); ok(sim.w.gen === 0, 'pas de réparation sans fusibles'); s.inp.use = false;
  s.inv = [{ k: 'fuse', n: 3 }, null, null];
  for (let i = 1; i <= 3; i++) { s.inp.uc = 100 + i; sim.step(DT); ok(sim.w.parts === i, `fusible ${i} branché`); }
  ok(!s.inv[0], 'fusibles utilisés');
  // réparation maintenue
  s.inp.use = true;
  run(sim, GEN_T / 2);
  ok(Math.abs(sim.w.gen - 50) < 3, `moitié à mi-temps (${sim.w.gen})`);
  s.inp.use = false; const g0 = sim.w.gen; run(sim, 1);
  ok(sim.w.gen === g0, 'rien sans maintenir');
  s.inp.use = true; run(sim, GEN_T / 2 + 1);
  ok(sim.w.gen === 100 && sim.w.genOn, 'générateur relancé');
  s.inp.use = false;
  ok(sim.w.doors[M.liftTop].open, 'la cabine, en haut, s\'ouvre');
  // appel
  place(s, M.liftCall.x, M.liftCall.z - 1); s.y = DEEP; look(s, M.liftCall.x, M.liftCall.z);
  s.inp.uc = 200; sim.step(DT);
  ok(L.state === 'moving' && L.dir === -1, 'on l\'appelle');
  ok(!sim.w.doors[M.liftTop].open, 'porte du haut fermée en route');
  run(sim, LIFT.firstDown + 0.2);
  ok(L.at === 'bottom' && sim.w.doors[M.liftBottom].open, 'arrivée en bas, porte ouverte');
  // entrer, monter
  place(s, 60, 45, 0); s.y = DEEP;
  tg = interactTarget(M, sim.w, sim.players, s);
  ok(tg && tg.kind === 'go' && tg.ok, 'bouton de la cabine : ' + JSON.stringify(tg));
  s.inp.uc = 201; sim.step(DT);
  ok(L.go > 0, 'compte à rebours');
  run(sim, LIFT.go + 0.5);
  ok(L.state === 'moving' && L.dir === 1, 'il monte');
  ok(!sim.w.doors[M.liftBottom].open, 'porte du bas fermée');
  run(sim, LIFT.up / 2);
  ok(s.y > DEEP + 0.5 && s.y < -0.5, 'le joueur monte avec la cabine : ' + s.y);
  run(sim, LIFT.up / 2 + 0.3);
  ok(L.at === 'top' && sim.w.doors[M.liftTop].open, 'arrivée en haut');
  ok(Math.abs(s.y) < 0.01, 'au niveau du sol');
  // sortir : vers le sud
  s.inp.my = 1; s.inp.yaw = Math.PI; s.inp.mx = 0;
  run(sim, 2);
  ok(s.st === 'out', 'extrait à la sortie de la cabine');
  ok(sim.w.ph === 'over' && sim.w.win === 's', 'les enquêteurs gagnent');
  ok(sim.w.banked === 1, 'preuve comptée');
  const r = sim.ranking();
  ok(r[0].id === 1 && r[0].won, 'classement : l\'enquêteur devant');

  // sans preuve : pas d'extraction
  const b = newGame();
  place(b.s, 60, 52); b.s.y = 0;
  run(b.sim, 0.2);
  ok(b.s.st === 'ok', 'sans preuve, pas d\'extraction');
}

section('coups, relève, achèvement');
{
  const { sim, s, m } = newGame();
  const q = sim.addPlayer({ id: 2, name: 'Bea', color: '#0000ff' });
  place(s, 15, 25.5); place(m, 16.6, 25.5); look(m, s.x, s.z); m.inp.yaw = m.yaw; s.y = m.y = 0;
  place(q, 12, 25.5); q.y = 0;
  m.inp.fc = 1; run(sim, 0.4);
  ok(s.hp === 66 && s.st === 'ok', 'premier coup : 66 PV');
  ok(m.slow > 0, 'le monstre est ralenti après un coup');
  ok(s.inv0 > 0, 'l\'adrénaline protège un instant');
  m.cd.atk = 0; s.inv0 = 0; s.x = 15; m.inp.fc = 2; run(sim, 0.4);
  ok(s.hp === 32 && s.st === 'ok', 'deuxième coup : 32 PV');
  m.cd.atk = 0; s.inv0 = 0; s.x = 15; m.inp.fc = 3; run(sim, 0.4);
  ok(s.st === 'down', 'troisième coup : à terre');
  ok(m.sated > 0, 'le monstre est repu');
  m.cd.atk = 0; m.inp.fc = 4; run(sim, 0.4);
  ok(m.atkT <= 0 && m.cd.atk === 0, 'repu : il ne peut plus frapper');
  m.sated = 0; m.stall = 0;
  // relève par l'équipier
  place(q, s.x - 1, s.z); look(q, s.x, s.z); q.y = 0;
  place(m, 40, 25.5); m.inp.yaw = 0;
  q.inp.use = true; run(sim, 2);
  ok(s.st === 'down', 'pas encore relevé');
  q.inp.use = false; run(sim, 0.1); q.inp.use = true; run(sim, 2);
  ok(s.st === 'down', 'lâcher remet le compteur à zéro');
  run(sim, 2.2);
  ok(s.st === 'ok' && s.hp === 50, 'relevé en maintenant 4 s');
  q.inp.use = false;
  ok(s.downs === 1, 'premier passage à terre compté');
  // le monstre n'achève pas au premier passage
  sim.knockDown(q, m); place(m, q.x - 1, q.z); look(m, q.x, q.z); m.y = q.y; m.stall = 0; m.inp.use = true;
  run(sim, 2);
  ok(q.st === 'down', 'pas d\'achèvement la première fois');
  m.inp.use = false;
  place(m, 40, 25.5);
  run(sim, 34);
  ok(q.st === 'ok' && q.hp === 50, 'on se relève seul la première fois');
  // saignement : la seconde fois est mortelle
  sim.knockDown(s, m); s.proofs = 2; s.inv = [{ k: 'orange', n: 1 }, null, null];
  ok(s.downs === 2, 'second passage à terre');
  run(sim, 46);
  ok(s.st === 'dead', 'meurt au bout de 45 s');
  ok(sim.w.items.some((i) => i.k === 'orange') && sim.w.items.some((i) => i.k === 'preuve' && i.n === 2), 'ses objets et ses preuves restent au sol');
  // achèvement
  sim.knockDown(q, m); place(m, q.x - 1, q.z); look(m, q.x, q.z); m.inp.use = true; m.y = q.y; m.stall = 0;
  run(sim, 1.6);
  ok(q.st === 'dead', 'achevé en 1,4 s');
  ok(m.kills >= 1, 'compté');
  ok(sim.w.ph === 'over' && sim.w.win === 'm', 'le monstre gagne quand plus personne ne reste');
}

section('casiers');
{
  const { sim, s, m } = newGame();
  const l = M.lockers[0];
  place(s, l.fx, l.fz); look(s, l.x, l.z); s.y = l.y;
  place(m, 30, 25.5);
  s.inp.uc = 1; sim.step(DT);
  ok(s.hide === l.id && !s.torch, 'caché, lampe éteinte');
  const x0 = s.x; s.inp.my = 1; run(sim, 0.5); ok(s.x === x0, 'on ne bouge pas caché'); s.inp.my = 0;
  // le monstre ne le frappe pas
  place(m, l.fx, l.fz); look(m, l.x, l.z); m.y = l.y; m.inp.fc = 1; run(sim, 0.4);
  ok(s.hp === 100, 'pas de coup à travers le casier');
  // mais il fouille
  m.inp.uc = 1; sim.step(DT);
  ok(s.st === 'down' && s.hide === -1, 'fouille : débusqué et à terre');
  // sortie volontaire
  const a = newGame();
  place(a.s, l.fx, l.fz); look(a.s, l.x, l.z); a.s.y = l.y;
  a.s.inp.uc = 1; a.sim.step(DT); a.s.inp.uc = 2; a.sim.step(DT);
  ok(a.s.hide === -1 && Math.hypot(a.s.x - l.fx, a.s.z - l.fz) < 0.01, 'sort devant le casier');
  ok(!cellSolid(M, a.sim.w, a.s, Math.floor(a.s.z) * W + Math.floor(a.s.x)), 'la sortie n\'est pas dans un mur');
  for (const k of M.lockers) ok(M.t[Math.floor(k.fz) * W + Math.floor(k.fx)] === T.FLOOR, `devant du casier ${k.id} libre`);
}

section('sabotages');
{
  const { sim, s, m } = newGame();
  // lumières
  place(m, 12, 25.5); m.y = 0; m.inp.a1 = 1; sim.step(DT);
  ok(sim.w.dark[Z.A] > 0 && m.cd.lights > 0, 'le noir dans l\'aile A');
  run(sim, 26);
  ok(!sim.w.dark[Z.A], 'la lumière revient');
  // porte bloquée 10 s
  const id = M.doors.findIndex((d) => d.name === 'Bureau 1');
  place(m, 13.5, 36.5); look(m, M.doors[id].x, M.doors[id].z); m.y = 0;
  sim.w.doors[id].open = true;
  m.inp.a2 = 1; sim.step(DT);
  ok(sim.w.doors[id].jam > 0 && !sim.w.doors[id].open, 'porte bloquée et fermée');
  place(s, 13.8, 36); s.y = 0; look(s, M.doors[id].x, M.doors[id].z);
  const tg = interactTarget(M, sim.w, sim.players, s);
  ok(tg && tg.ok === false, 'l\'enquêteur ne l\'ouvre pas');
  run(sim, 10.2);
  ok(sim.w.doors[id].jam === 0, 'fin du blocage');
  // caméra
  sim.w.cams.push({ id: 99, x: 20, y: 2.3, z: 36, yaw: 0, wall: true, by: 1 });
  place(m, 18, 36); look(m, 20, 36); m.y = 0;
  m.inp.a3 = 1; sim.step(DT);
  ok(!sim.w.cams.length, 'caméra détruite');
  // poser une caméra : limite
  s.inv = [{ k: 'cams', n: 2 }, null, null]; s.sel = 0; s.inp.sel = 0;
  place(s, 26, 25, 0); s.y = 0;
  s.inp.fc = 1; sim.step(DT);
  ok(sim.w.cams.length === 1 && s.inv[0].n === 1, 'caméra posée');
  ok(sim.w.cams[0].wall, 'sur le mur');
  for (let i = 0; i < MAX_CAMS; i++) sim.w.cams.push({ id: 100 + i, x: 0, y: 0, z: 0, yaw: 0 });
  s.inp.fc = 2; sim.step(DT);
  ok(s.inv[0].n === 1, `pas plus de ${MAX_CAMS}`);
  // le monstre en cage ne fait rien
  const c = new Sim({ seed: 3 }); const cm = c.addPlayer({ id: 1, name: 'M', color: '#111111', role: 'm' }); c.addPlayer({ id: 2, name: 'S', color: '#222222' });
  const x0 = cm.x; cm.inp.my = 1; cm.inp.a1 = 1; cm.inp.fc = 1;
  run(c, 5);
  ok(Math.abs(cm.wake - (WAKE_T - 5)) < 0.1, 'le compte à rebours tourne');
  ok(cm.x !== x0, 'enfermé : le monstre peut marcher dans sa pièce');
  ok(!Object.keys(c.w.dark).length && cm.atkT <= 0, 'enfermé : pas de pouvoir');
  const alpha = c.M.doors.filter((d) => d.name === 'Labo Alpha');
  ok(alpha.length && alpha.every((d) => c.w.doors[d.id].jam > 0 && !c.w.doors[d.id].open), 'enfermé : ses portes sont bloquées');
  cm.inp.my = 1; run(c, 12); const zn = zoneAt(c.M, cm.x, cm.z); ok(cm.x >= 10 && cm.x <= 19 && cm.z >= 6 && cm.z <= 19 && zn === Z.B, 'enfermé : il ne sort pas de la pièce');
  run(c, WAKE_T);
  ok(cm.wake === 0 && alpha.every((d) => !(c.w.doors[d.id].jam > 0)), 'réveillé : les portes se débloquent');
}

section('hurlement, kit caméras, table de matériel');
{
  const { sim, s, m } = newGame();
  place(m, 30, 25); m.y = 0; place(s, 35, 25); s.y = 0; s.stam = 100;
  m.inp.rc = 1; sim.step(DT);
  ok(m.cd.roar > 0 && s.stam <= 70.5, 'le hurlement coupe le souffle tout près');
  ok(sim.drainEvents().some((e) => e.e === 'roar'), 'tout le monde l\'entend');
  const stam = s.stam; m.inp.rc = 2; sim.step(DT); ok(s.stam >= stam, 'puis il faut attendre');
  s.inv = [{ k: 'cams', n: 1 }, null, null]; s.sel = 0; s.inp.sel = 0; place(s, 30, 25); s.inp.fc = (s.inp.fc | 0) + 1; sim.step(DT);
  ok(sim.w.cams.length === 1 && s.inv[0] && s.inv[0].n === 0, 'le kit vide reste dans le sac : il ouvre les écrans');
  s.inp.fc++; sim.step(DT); ok(sim.w.cams.length === 1, 'plus de caméra à poser');
  const stock = sim.w.items.filter((i) => i.stock);
  ok(stock.length === 3 && stock.every((i) => M.t[Math.floor(i.z) * M.W + Math.floor(i.x)] === T.PROP), 'trois objets sur la table de matériel, et rien d\'autre');
  ok(!ITEMS.tablet, 'la tablette fait partie du kit');
}

section('signalétique');
{
  const nav = new Nav(M), walk = (i) => M.t[i] === T.FLOOR;
  for (const r of M.routes) ok(nav.find(r.a[0], r.a[1], r.b[0], r.b[1], walk), `la bande ${r.a} → ${r.b} suit un chemin`);
  for (const g of M.signs) {
    const cx = Math.floor(g.x + g.nx * 0.5), cz = Math.floor(g.z + g.nz * 0.5), bx = Math.floor(g.x - g.nx * 0.5), bz = Math.floor(g.z - g.nz * 0.5);
    ok(M.t[cz * M.W + cx] !== T.WALL && M.t[bz * M.W + bx] !== T.FLOOR, `panneau ${g.text} (${g.x}, ${g.z}) posé sur un mur, face à un passage`);
  }
}

section('générateur saboté, soin');
{
  const { sim, s, m } = newGame();
  sim.w.parts = 3; sim.w.gen = 50;
  place(m, M.generator.panel.x, M.generator.panel.z); m.y = DEEP; look(m, M.generator.x, M.generator.z); m.inp.use = true;
  run(sim, 2.7);
  ok(sim.w.gen === 35 && m.cd.smash > 0, 'le monstre fait perdre 15 %');
  run(sim, 3); ok(sim.w.gen === 35, 'une fois, puis il doit attendre');
  s.hp = 50; place(s, 20, 55); s.y = 0; run(sim, 5);
  ok(Math.abs(s.hp - 70) < 0.5, 'on se soigne à l\'avant-poste');
}

section('temps écoulé');
{
  const { sim, s } = newGame({ duration: 3 });
  run(sim, 3.2);
  ok(s.st === 'dead' && sim.w.ph === 'over' && sim.w.win === 'm', 'temps écoulé : le monstre gagne');
  ok(sim.w.end === 'purge', 'cause : purge');
  const b = newGame({ duration: 3 });
  const q = b.sim.addPlayer({ id: 2, name: 'B', color: '#0000ff' });
  b.s.proofs = 1; place(b.s, 60, 53); b.s.y = 0; b.sim.step(DT);
  ok(b.s.st === 'out', 'extrait');
  run(b.sim, 3.2);
  ok(q.st === 'dead' && b.sim.w.win === 's', 'un seul sorti avec une preuve : les enquêteurs gagnent');
}

section('réseau et reprise');
{
  const { sim, s, m } = newGame();
  s.inv = [{ k: 'photo', n: 4 }, null, null]; s.proofs = 1; s.batt = 42; s.hp = 50;
  place(s, 12.34, 25.5, 1.234); s.y = 0; run(sim, 0.1);
  const row = rowOf(s), q = {};
  applyRow(q, JSON.parse(JSON.stringify(row)));
  ok(Math.abs(q.x - s.x) < 0.011 && Math.abs(q.z - s.z) < 0.011 && Math.abs(q.yaw - s.yaw) < 0.002, 'la ligne garde la position');
  ok(q.hp === 50 && Math.round(q.batt) === Math.round(s.batt) && q.st === 'ok', 'la ligne garde l\'état');
  const bytes = JSON.stringify(sim.rows()).length;
  ok(bytes < 400, `lignes compactes (${bytes} o pour 2 joueurs)`);
  const world = JSON.parse(JSON.stringify(sim.world()));
  ok(JSON.stringify(world).length < 12000, `état complet raisonnable (${JSON.stringify(world).length} o)`);
  // reprise
  const r = Sim.restore(world, JSON.parse(JSON.stringify(sim.rows())));
  ok(r.players.length === 2 && r.byId.get(1).proofs === 1 && r.byId.get(1).inv[0].n === 4, 'reprise : objets gardés');
  ok(Math.abs(r.byId.get(1).x - s.x) < 0.02, 'reprise : position');
  ok(r.monster && r.monster.id === 9, 'reprise : monstre');
  ok(r.w.items.length === sim.w.items.length && r.w.traces.length === sim.w.traces.length, 'reprise : monde');
  run(r, 1);
  ok(r.w.t > sim.w.t, 'reprise : ça continue');
  // un joueur parti : un bot le remplace et la partie continue
  sim.replaceByBot(1);
  ok(s.bot, 'un bot prend sa place');
  run(sim, 3);
  ok(s.st === 'ok', 'le bot joue');
}

section('parties entières entre bots');
{
  const out = {};
  let stuckMax = 0;
  for (const level of ['facile', 'normal', 'expert']) {
    let sw = 0, n = 0, tSum = 0, proofs = 0, noEnd = 0;
    for (let seed = 1; seed <= 2; seed++) {
      const sim = new Sim({ seed: seed * 101, level });
      for (let i = 0; i < 4; i++) sim.addPlayer({ id: i + 1, name: 'B' + i, color: '#888888', bot: true });
      sim.addPlayer({ id: 9, name: 'Monstre', color: '#000000', bot: true, role: 'm' });
      const t0 = Date.now();
      while (sim.w.ph !== 'over' && sim.w.t < 1000) { sim.step(DT); sim.drainEvents(); }
      if (sim.w.ph !== 'over') noEnd++;
      n++; if (sim.w.win === 's') sw++; tSum += sim.w.t; proofs += sim.w.banked;
      stuckMax = Math.max(stuckMax, sim.botStuck || 0);
      for (const p of sim.players) ok(Number.isFinite(p.x) && Number.isFinite(p.z), 'positions finies');
      ok(sim.w.items.every((i) => Number.isFinite(i.x)), 'objets finis');
      ok(Date.now() - t0 < 30000, 'pas trop lent');
    }
    out[level] = { enquêteurs: `${sw}/${n}`, durée: Math.round(tSum / n) + ' s', preuves: (proofs / Math.max(1, sw)).toFixed(1), sansFin: noEnd };
    ok(noEnd === 0, `toutes les parties finissent (${level})`);
  }
  console.log('  ', JSON.stringify(out));
  console.log('   blocages de bots au pire :', stuckMax);
}

console.log(`\n${pass} vérifications réussies, ${fail} échecs`);
process.exit(fail ? 1 : 0);
