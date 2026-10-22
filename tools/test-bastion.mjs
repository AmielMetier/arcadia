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

console.log(`\n${n} tests réussis`);
