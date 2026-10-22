// Tests du moteur de Fil Rouge : node tools/test-filrouge.mjs
import { createGame, act, tick, makeConfig, solutionOf, timeLeft, dropPlayer, fixRoles, teamsReady, canSeeManual, INTRO_MS, manualOf } from '../filrouge/engine/rules.js';
import { MODULES, pipeFlow } from '../filrouge/engine/modules.js';

let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.error('✗ ' + msg); } };

const P2 = [{ id: 1, name: 'A', color: '#f00', team: 0, role: 'defuser' }, { id: 2, name: 'B', color: '#00f', team: 0, role: 'expert' }];
const P4 = [
  { id: 1, name: 'A', team: 0, role: 'defuser' }, { id: 2, name: 'B', team: 0, role: 'expert' },
  { id: 3, name: 'C', team: 1, role: 'expert' }, { id: 4, name: 'D', team: 1, role: 'expert' },
];
const T0 = 1_000_000, GO = T0 + INTRO_MS + 10;

// 1. Pour 400 graines et toutes les difficultés : la solution désamorce, sans faute
for (let seed = 1; seed <= 400; seed++) {
  for (const diff of ['initiation', 'facile', 'normal', 'expert']) {
    let s = createGame({ players: P2, cfg: makeConfig({ diff }), seed: seed * 7919, now: T0 });
    const b = s.teams[0].bomb;
    ok(b.modules.length === [2, 3, 5, 7][s.cfg.diff], `nombre de modules ${diff}`);
    ok(new Set(b.modules.map((m) => m.slot)).size === b.modules.length && b.modules.every((m) => m.slot !== 1), 'emplacements distincts, chrono libre');
    // aucun module ne commence résolu
    const man = manualOf(s.edition);
    for (const mod of b.modules) {
      if (mod.type === 'pipes') ok(pipeFlow(mod).out !== MODULES.pipes.expect(mod, b, man), 'tuyaux pas déjà raccordés');
      if (mod.type === 'switches') ok(!mod.up.every((u, i) => u === MODULES.switches.expect(mod, b, man)[i]), 'leviers pas déjà bons');
      if (mod.type === 'wires') ok(MODULES.wires.expect(mod, b, man).some(Boolean), 'au moins un fil à couper');
    }
    let t = GO;
    for (const a of solutionOf(s, 0)) {
      const r = act(s, { by: 1, now: t += 50, ...a });
      ok(r.ok && r.result !== 'strike', `action refusée ou faute (graine ${seed}, ${diff}, ${JSON.stringify(a)})`);
      if (!r.ok) break;
      s = r.state;
    }
    ok(s.phase === 'over' && s.teams[0].status === 'defused' && s.teams[0].strikes === 0, `bombe désamorcée (graine ${seed}, ${diff})`);
  }
}

// 2. Fautes : 3 erreurs font exploser, le chrono accélère
{
  let s = createGame({ players: P2, cfg: makeConfig({ diff: 'normal' }), seed: 42, now: T0 });
  const before = timeLeft(s.teams[0], GO + 1000);
  let strikes = 0, t = GO;
  for (let m = 0; m < s.teams[0].bomb.modules.length && s.phase === 'play'; m++) {
    const mod = s.teams[0].bomb.modules[m];
    let a = null;
    const man = manualOf(s.edition);
    if (mod.type === 'wires') { const need = MODULES.wires.expect(mod, s.teams[0].bomb, man); a = { op: 'cut', i: need.findIndex((n) => !n) }; }
    else if (mod.type === 'switches' || mod.type === 'gauges') a = { op: 'submit' };
    else if (mod.type === 'pipes') a = { op: 'open' };
    else if (mod.type === 'chime') { const w = MODULES.chime.expect(mod, s.teams[0].bomb, man); a = { op: 'key', i: (w[0] + 1) % 4 }; }
    else if (mod.type === 'safe') { const w = MODULES.safe.expect(mod, s.teams[0].bomb, man); a = { op: 'enter' }; if (mod.pos === w[0]) { s = act(s, { by: 1, now: t, m, op: 'dial', d: 1 }).state; } }
    const r = act(s, { by: 1, now: t += 100, m, ...a });
    ok(r.result === 'strike', `faute attendue sur ${mod.type}`);
    s = r.state; strikes++;
    if (strikes === 1) ok(s.teams[0].clock.rate === 1.25, 'le chrono accélère après une faute');
  }
  ok(s.teams[0].status === 'boom' && s.phase === 'over', 'trois fautes : la bombe explose');
  ok(before > 0, 'chrono positif');
}

// 3. Chrono : à zéro, la bombe explose
{
  let s = createGame({ players: P2, cfg: makeConfig({ diff: 'facile' }), seed: 7, now: T0 });
  s = tick(s, GO + 299_000).state; ok(s.phase === 'play', 'encore en vie à 1 s de la fin');
  s = tick(s, GO + 301_000).state; ok(s.teams[0].status === 'boom' && s.phase === 'over', 'explosion à la fin du chrono');
}

// 4. Rôles : l'expert ne touche pas la bombe ; démineur désigné d'office ; duel avec bombes identiques
{
  const s = createGame({ players: P4, cfg: makeConfig({ mode: 'versus' }), seed: 99, now: T0 });
  ok(JSON.stringify(s.teams[0].bomb) === JSON.stringify(s.teams[1].bomb), 'duel : les deux bombes sont identiques');
  ok(s.players.find((p) => p.id === 3).role === 'defuser', 'équipe sans démineur : le premier le devient');
  ok(!act(s, { by: 2, now: GO, m: 0, op: 'open' }).ok, 'un expert ne peut pas agir');
  ok(!act(s, { by: 1, now: T0 + 100, m: 0, op: 'open' }).ok, 'pas d’action avant le top départ');
  // l'équipe 1 désamorce : elle gagne, l'autre s'arrête
  let st = s, t = GO;
  for (const a of solutionOf(st, 1)) st = act(st, { by: 3, now: t += 40, ...a }).state;
  ok(st.phase === 'over' && st.winner === 1 && st.teams[0].status === 'stopped', 'duel : la première équipe qui désamorce gagne');
  // sabotage envoyé à l'autre équipe à chaque module désamorcé
  const r = act(s, { by: 3, now: GO, ...solutionOf(s, 1).find((a) => a.op === 'cut' || a.op === 'submit' || a.op === 'open' || a.op === 'enter' || a.op === 'key') });
  ok(r.ok, 'action du démineur adverse acceptée');
  ok(fixRoles([{ id: 1, team: 0, role: 'defuser' }, { id: 2, team: 0, role: 'defuser' }], 'coop').filter((p) => p.role === 'defuser').length === 1, 'un seul démineur par équipe');
}

// 4 bis. Le démineur n'a jamais le manuel : au moins 2 par équipe
{
  ok(teamsReady([{ id: 1, team: 0, role: 'defuser' }], 'coop') !== '', 'seul : partie refusée');
  ok(teamsReady(fixRoles(P2, 'coop'), 'coop') === '', 'à deux : partie acceptée');
  ok(teamsReady(fixRoles(P4.slice(0, 3), 'versus'), 'versus') !== '', 'duel à 3 : refusé');
  ok(teamsReady(fixRoles(P4, 'versus'), 'versus') === '', 'duel 2 contre 2 : accepté');
  let threw = false; try { createGame({ players: P2.slice(0, 1), cfg: makeConfig({}), seed: 1, now: T0 }); } catch (e) { threw = true; }
  ok(threw, 'createGame refuse un joueur seul');
  const s = createGame({ players: P4, cfg: makeConfig({ mode: 'versus' }), seed: 3, now: T0 });
  ok(s.players.every((p) => canSeeManual(s, p.id) === (p.role === 'expert')), 'seuls les experts ont le manuel');
}

// 5. Départ d'un joueur : un coéquipier reprend la bombe ; équipe vide = abandon
{
  const s = createGame({ players: P4, cfg: makeConfig({ mode: 'versus' }), seed: 5, now: T0 });
  const a = dropPlayer(s, 1, GO).state;
  ok(a.players.find((p) => p.id === 2).role === 'defuser', 'le coéquipier devient démineur');
  const b = dropPlayer(dropPlayer(s, 3, GO).state, 4, GO).state;
  ok(b.teams[1].status === 'boom' && b.phase === 'over' && b.winner === 0, 'équipe vide : abandon, l’autre gagne');
}

// 6. Manuel : même édition → mêmes règles ; éditions différentes → règles différentes
{
  const a = JSON.stringify(manualOf(1234)), b = JSON.stringify(manualOf(1234)), c = JSON.stringify(manualOf(1235));
  ok(a === b && a !== c, 'le manuel dépend de son édition');
}

console.log(fails ? `${fails} échec(s) sur ${checks} vérifications` : `✓ ${checks} vérifications réussies`);
process.exit(fails ? 1 : 0);
