// Tests du moteur de Bastion Clash : node tools/test-bastion.mjs
// Règles et commandes sur des situations construites à la main, puis des parties de bots complètes.
import assert from 'node:assert/strict';
import { loadEngine, playBots } from './bastion-engine.mjs';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('✓', name); };

const humans = (k = 4) => Array.from({ length: k }, (_, i) => ({ id: i, name: 'P' + i, color: '#ff0000', bot: false }));
const fresh = (E, mode = 'ffa', k = 4, map = 'vallee') => E.createInitialState(humans(k), { map, mode, pace: 'standard' });
const step = (E, s, n = 1) => { for (let i = 0; i < n; i++) E.stepWorld(s, E.TICK_DT, []); };

t('changement d’équipe : réservé au 2v2, et seul l’hôte change l’équipe des autres', () => {
  const E = loadEngine();
  const ffa = fresh(E, 'ffa');
  assert.equal(E.executeCommand(ffa, 2, { op: 'TOGGLE_TEAM', targetId: 2 }, [], { authority: true }).ok, false, 'pas en FFA');
  const duo = fresh(E, '2v2_pvp');
  assert.equal(E.executeCommand(duo, 2, { op: 'TOGGLE_TEAM', targetId: 0 }, []).ok, false, 'un invité ne déplace pas un autre joueur');
  assert.equal(E.executeCommand(duo, 2, { op: 'TOGGLE_TEAM', targetId: 2 }, []).ok, true, 'un joueur change sa propre équipe');
  assert.equal(E.executeCommand(duo, 0, { op: 'TOGGLE_TEAM', targetId: 3 }, [], { authority: true }).ok, true, 'l’hôte peut déplacer un joueur');
});

t('classement : vainqueurs par score décroissant, puis éliminés du dernier au premier tombé', () => {
  const E = loadEngine();
  const s = fresh(E, '2v2_pvp');
  s.players[0].score = 1000; s.players[1].score = 100;
  for (const b of s.buildings) if (b.team === 1) b.hp = 0;
  step(E, s);
  assert.equal(s.over, true);
  assert.deepEqual([...s.ranking.slice(0, 2)], [0, 1], 'P0 (1500) devant P1 (600)');
});

t('destruction mutuelle : égalité, pas de vainqueur désigné', () => {
  const E = loadEngine();
  const s = fresh(E, 'ffa');
  for (const b of s.buildings) b.hp = 0;
  step(E, s);
  assert.equal(s.over, true);
  assert.equal(s.winnerTeam, null);
});

t('navette : les passagers sont à l’abri des éclaboussures et un passager mort libère sa place', () => {
  const E = loadEngine();
  const s = fresh(E, 'ffa');
  const marines = s.units.filter((u) => u.owner === 0 && u.kind === 'marine');
  const ship = { ...marines[0], id: 5555, kind: 'dropship', flying: true, hp: 310, maxHp: 310, radius: 16, cargo: [], mode: 'idle' };
  s.units.push(ship);
  const pass = marines[1];
  pass.boardedIn = ship.id; ship.cargo.push(pass.id); pass.x = ship.x; pass.y = ship.y;
  const tesla = { ...s.buildings.find((b) => b.owner === 1), id: 7777, kind: 'tesla', x: ship.x + 100, y: ship.y, radius: 28, constructing: false, queue: [], cd: 0 };
  s.buildings.push(tesla);
  step(E, s, 40);
  assert.equal(pass.hp, pass.maxHp, 'aucun dégât à l’intérieur');
  pass.hp = 0;
  step(E, s);
  assert.deepEqual([...ship.cargo], []);
});

t('pathfinding : une unité contourne un mur de bâtiments au lieu de s’y coller', () => {
  const E = loadEngine();
  const s = fresh(E, 'ffa', 2);
  const m = s.units.find((u) => u.owner === 0 && u.kind === 'marine');
  // Un rideau de Murs en travers, entre l'unité et sa destination
  m.x = 1500; m.y = 1200;
  for (let k = -3; k <= 3; k++) s.buildings.push({ id: 9000 + k, kind: 'wall', owner: 0, team: 0, x: 1600, y: 1200 + k * 40, hp: 1100, maxHp: 1100, radius: 20, constructing: false, buildStarted: true, queue: [] });
  E.executeCommand(s, 0, { op: 'UNIT_ORDER', mode: 'move', x: 1700, y: 1200, unitIds: [m.id] }, []);
  step(E, s, 30 * 12);
  assert.ok(Math.hypot(m.x - 1700, m.y - 1200) < 40, `arrivée (${Math.round(m.x)}, ${Math.round(m.y)})`);
});

t('partie de 4 bots : rapide, cibles réparties, armées qui sortent', () => {
  const E = loadEngine({ seed: 1 });
  let worst = 0, total = 0, steps = 0;
  const firstTargets = new Map();
  const s = playBots(E, {
    minutes: 12,
    onStep(st, fx, d) {
      worst = Math.max(worst, d); total += d; steps++;
      for (const p of st.players) {
        if (!p.bot || p.botTargetId == null || firstTargets.has(p.id)) continue;
        const b = st.buildings.find((x) => x.id === p.botTargetId);
        if (b) firstTargets.set(p.id, b.owner);
      }
    },
  });
  assert.ok(total / steps < 8, `pas moyen ${(total / steps).toFixed(2)} ms`);
  const victims = new Set(firstTargets.values());
  assert.ok(victims.size >= 3, `au moins 3 QG différents visés (${[...firstTargets].join(' ')})`);
  const away = s.units.filter((u) => u.kind !== 'scv' && !u.flying && (() => { const p = s.players.find((q) => q.id === u.owner); return Math.hypot(u.x - p.spawnX, u.y - p.spawnY) > 700; })());
  assert.ok(away.length > 0, 'des unités ont quitté leur base');
});

t('instantanés : compacts, filtrés par le brouillard, sans perte pour son équipe', () => {
  const E = loadEngine({ seed: 3 });
  const s = playBots(E, { minutes: 5 });
  const legacy = JSON.stringify({ units: s.units, buildings: s.buildings }).length;
  const full = E.packState(s, { viewer: null });
  const fog = E.packState(s, { viewer: { team: s.players[0].team } });
  const fullLen = JSON.stringify(full).length, fogLen = JSON.stringify(fog).length;
  assert.ok(fullLen < legacy * 0.55, `format compact ${fullLen} o contre ${legacy} o`);
  assert.ok(fogLen < fullLen, `brouillard ${fogLen} o < complet ${fullLen} o`);
  const back = E.unpackState(JSON.parse(JSON.stringify(fog)));
  const team = s.players[0].team;
  // Rien d'ennemi hors de vue, et les ressources adverses ne sont pas transmises
  for (const u of back.units) if (u.team !== team) assert.ok(E.teamSees(team, u.x, u.y), 'unité ennemie visible');
  for (const p of back.players) if (p.team !== team) assert.equal(p.minerals, 0);
  // Mes unités reviennent à l'identique (aux arrondis près)
  for (const u of s.units.filter((x) => x.team === team)) {
    const v = back.units.find((x) => x.id === u.id);
    assert.ok(v && Math.abs(v.x - u.x) < 0.06 && v.kind === u.kind && v.mode === u.mode && v.hp === Math.round(u.hp), 'unité ' + u.id);
  }
  assert.equal(back.partial, true);
});

t('joueur parti : un bot garde sa base et la fait tourner', () => {
  const E = loadEngine({ seed: 4 });
  const s = fresh(E, 'ffa', 2);
  s.players[1].afk = true;
  const scv0 = s.units.filter((u) => u.owner === 1 && u.kind === 'scv').length;
  for (let i = 0; i < 30 * 40; i++) { E.stepWorld(s, E.TICK_DT, []); if (i % 38 === 0) E.runBots(s, []); }
  const scv1 = s.units.filter((u) => u.owner === 1 && u.kind === 'scv').length;
  assert.ok(scv1 > scv0, `VCS ${scv0} -> ${scv1}`);
  assert.ok(s.buildings.some((b) => b.owner === 1 && b.kind !== 'hq'), 'au moins une construction');
});

t('commandes vérifiées par l’hôte : scan, réparation, raffinerie, numéro de chantier', () => {
  const E = loadEngine();
  const s = fresh(E, 'ffa', 2);
  const scv = s.units.find((u) => u.owner === 0 && u.kind === 'scv');
  const enemyHq = s.buildings.find((b) => b.owner === 1 && b.kind === 'hq');
  enemyHq.hp = 1000;
  E.executeCommand(s, 0, { op: 'UNIT_ORDER', mode: 'build', targetId: enemyHq.id, unitIds: [scv.id] }, []);
  assert.notEqual(scv.mode, 'build', 'pas de réparation chez l’adversaire');
  s.players[0].minerals = 500;
  const myHq = s.buildings.find((b) => b.owner === 0 && b.kind === 'hq');
  myHq.hp = 0; s.buildings = s.buildings.filter((b) => b !== myHq);
  assert.equal(E.executeCommand(s, 0, { op: 'SCAN', x: 900, y: 900 }, []).ok, false, 'pas de scan sans QG');
  const s2 = fresh(E, 'ffa', 2);
  const r = E.executeCommand(s2, 0, { op: 'BUILD', kind: 'pylon', x: s2.players[0].spawnX + 160, y: s2.players[0].spawnY + 40, bldId: 2 * 100000 + 5 }, []);
  if (r.ok) assert.ok(Math.floor(r.bldId / 100000) !== 2, 'le numéro d’un autre joueur est refusé');
});

t('cartes : chaque carte et chaque format se génèrent jouables', () => {
  for (const map of ['vallee', 'magma', 'glace', 'desert', 'ruines']) {
    for (const mode of ['ffa', '2v2_pvp', '1v1']) {
      const E = loadEngine();
      const s = E.createInitialState(humans(mode === '1v1' ? 3 : 4), { map, mode });
      assert.equal(s.players.length, mode === '1v1' ? 2 : 4, `${map}/${mode} : joueurs`);
      for (const p of s.players) {
        assert.ok(!E.isBlockedAt(p.spawnX, p.spawnY), `${map}/${mode} : départ praticable`);
        const hq = s.buildings.find((b) => b.owner === p.id && b.kind === 'hq');
        assert.ok(E.MINERAL_NODES.filter((m) => Math.hypot(m.x - hq.x, m.y - hq.y) < 220).length >= 5, `${map}/${mode} : cristaux au départ`);
        // Toutes les bases de départ sont reliées entre elles par le sol
        const f = E.getFlowField(E.nearestFreeCell(E.pathCellOf(s.players[0].spawnX, s.players[0].spawnY)));
        assert.ok(Number.isFinite(f[E.nearestFreeCell(E.pathCellOf(p.spawnX, p.spawnY))]), `${map}/${mode} : base ${p.id} accessible`);
      }
      if (mode === '1v1') assert.equal(E.WORLD_SIZE, 3000);
    }
  }
});

t('vagues : la Horde attaque, une vague repoussée paie une prime, la dernière donne la victoire', () => {
  const E = loadEngine({ seed: 6 });
  const s = E.createInitialState(humans(2), { map: 'vallee', mode: 'waves' });
  assert.ok(s.players.slice(0, 2).every((p) => p.team === 0), 'joueurs dans la même équipe');
  assert.ok(s.players.some((p) => p.horde));
  while (s.waves.n === 0) step(E, s);
  const foes = s.units.filter((u) => u.owner === E.HORDE_ID);
  assert.ok(foes.length >= 3, 'une vague apparaît');
  const before = s.players[0].minerals;
  for (const u of foes) u.hp = 0;
  step(E, s, 2);
  assert.equal(s.waves.cleared, 1);
  assert.ok(s.players[0].minerals >= before + 150, 'prime versée');
  s.waves.n = s.waves.total; s.waves.cleared = s.waves.total - 1;
  step(E, s, 2);
  assert.equal(s.over, true);
  assert.equal(s.winnerTeam, 0, 'les défenseurs gagnent');
});

console.log(`\n${n} tests réussis`);
