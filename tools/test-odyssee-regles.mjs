// tools/test-odyssee-regles.mjs — Odyssée : règles de combat précises, une par bug corrigé (audit du 15 novembre 2026).
// Les 600 combats de test-odyssee.mjs vérifient que rien ne plante ; ici on vérifie que les règles sont justes.
//   node tools/test-odyssee-regles.mjs      (à lancer quand on touche à odyssee/js/core/battle.js ou mon.js)
import { Battle } from '../odyssee/js/core/battle.js';
import { createMon, healFull, levelEvolution } from '../odyssee/js/core/mon.js';
import { MOVES } from '../odyssee/js/data/moves.js';
import { SPECIES } from '../odyssee/js/data/species.js';

const key = Object.fromEntries(Object.values(MOVES).map((m) => [m.key, m.id]));
const sp = (n) => +Object.keys(SPECIES).find((k) => SPECIES[k].n === n);
let seed = 1; const rng = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const mk = (n, lvl, moves, o = {}) => createMon(sp(n), lvl, { moves: moves.map((k) => key[k]), iv: Array(6).fill(31), rng, shiny: false, ...o });
const texts = (ev) => ev.filter((e) => e.t === 'msg').map((e) => e.text);
const wild = (me, foe, bag = {}) => { const b = new Battle({ rng, player: { name: 'A', party: [].concat(me), bag }, foe: { name: 'w', party: [foe] } }); b.start(); return b; };
const trainer = (me, foes, tr = {}) => { const b = new Battle({ rng, player: { name: 'A', party: [].concat(me), bag: {} }, foe: { name: 'T', party: [].concat(foes), trainer: { cls: 'Dresseur', name: 'Bob', prize: 20, ...tr } } }); b.start(); return b; };
let fails = 0; const ok = (c, msg) => { console.log((c ? '  ✓ ' : '  ✗ ') + msg); if (!c) fails++; };

{ // un drapeau de K.O. resté dans une sauvegarde ne bloque plus le combat suivant
  seed = 12345; const me = mk('Pikachu', 5, ['thunder-shock']); me._ko = true; healFull(me);
  const b = trainer([me, mk('Rattata', 5, ['tackle'])], [mk('Onix', 40, ['rock-throw'])]);
  b.playerAction({ type: 'move', idx: 0 });
  ok(me.hp === 0 && b.state === 'switch', 'K.O. annoncé et remplaçant demandé malgré un ancien drapeau _ko');
}
{ // Bluff : premier tour seulement
  seed = 7; const me = mk('Persian', 30, ['fake-out']), foe = mk('Ronflex', 50, ['body-slam']);
  const b = trainer(me, foe); me.stats[0] = me.hp = 9999;
  const e1 = texts(b.playerAction({ type: 'move', idx: 0 })), e2 = texts(b.playerAction({ type: 'move', idx: 0 }));
  ok(e1.some((t) => /a peur/.test(t)), 'Bluff apeure au premier tour');
  ok(e2.some((t) => /échoue/.test(t)) && !e2.some((t) => /a peur/.test(t)), 'Bluff échoue ensuite');
}
{ // Vol interrompu : le Pokémon redescend
  let stuck = 0, n = 0;
  for (let s = 1; s <= 200; s++) { seed = s * 97; const me = mk('Roucarnage', 50, ['fly']); me.status = 'par'; const b = wild(me, mk('Ronflex', 50, ['splash']));
    b.playerAction({ type: 'move', idx: 0 }); if (!b.sides[0].v.invuln) continue; n++;
    b.playerAction({ type: 'move', idx: 0 }); if (b.sides[0].v.invuln && !b.sides[0].v.charge) stuck++; }
  ok(n > 50 && stuck === 0, `Vol + paralysie : ${n} envols, aucun Pokémon resté invulnérable`);
}
{ // objets Choix
  seed = 5; const me = mk('Dracolosse', 60, ['dragon-claw', 'earthquake'], { item: 'choice-band' }); const b = wild(me, mk('Ronflex', 80, ['splash']));
  b.playerAction({ type: 'move', idx: 0 }); const e = texts(b.playerAction({ type: 'move', idx: 1 }));
  ok(e.length === 1 && /ne laisse utiliser que/.test(e[0]), 'Bandeau Choix : bloqué sur la première attaque');
}
{ // puissances manquantes
  const dmg = (k, foeMove = 'splash') => { seed = 3; const me = mk('Dracolosse', 60, [k]), foe = mk('Ronflex', 50, [foeMove]); const b = wild(me, foe); const h = foe.hp; b.playerAction({ type: 'move', idx: 0 }); return [h - foe.hp, me.hp]; };
  ok(dmg('electro-ball')[0] > 10, 'Boule Élek fait de vrais dégâts');
  ok(dmg('heat-crash')[0] > 10, 'Tacle Feu fait de vrais dégâts');
  const fg = dmg('final-gambit'); ok(fg[0] > 100 && fg[1] === 0, 'Tout ou Rien : les PV du lanceur en dégâts, et il tombe');
}
{ // deux évolutions par niveau : les deux existent
  const tos = new Set(); for (let uid = 1; uid <= 20; uid++) tos.add(levelEvolution({ sp: sp('Chenipotte'), lvl: 50, uid }));
  ok(tos.size === 2, 'Chenipotte évolue en Armulys ou en Blindalys selon le Pokémon');
  ok(levelEvolution({ sp: sp('Bulbizarre'), lvl: 16, uid: 3 }) === sp('Herbizarre'), 'une évolution simple ne change pas');
}
{ // soin adverse : le statut disparaît aussi à l'écran
  seed = 9; const me = mk('Pikachu', 50, ['thunder-wave', 'thunder-shock']), foe = mk('Ronflex', 50, ['splash']);
  const b = trainer(me, foe, { ai: 'smart', items: { 'full-restore': 2 } }); b.playerAction({ type: 'move', idx: 0 });
  const ev = b.playerAction({ type: 'move', idx: 1 });
  ok(ev.some((e) => e.t === 'status' && e.side === 1 && e.status === null), 'Guérison adverse : événement de statut envoyé');
}
{ // défauts mineurs
  seed = 2; let me = mk('Électrode', 50, ['explosion']), foe = mk('Ectoplasma', 50, ['splash']); let b = wild(me, foe);
  b.playerAction({ type: 'move', idx: 0 }); ok(me.hp === 0, 'Explosion sur une immunité : le lanceur tombe quand même');
  seed = 2; me = mk('Pikachu', 50, ['thunder-wave']); foe = mk('Magnéti', 50, ['splash']); b = wild(me, foe);
  b.playerAction({ type: 'move', idx: 0 }); ok(!foe.status, 'un type Électrik ne peut pas être paralysé');
  seed = 2; me = mk('Florizarre', 50, ['solar-beam']); foe = mk('Ronflex', 50, ['splash']); b = new Battle({ rng, weather: 'sun', player: { name: 'A', party: [me], bag: {} }, foe: { name: 'w', party: [foe] } }); b.start();
  const h = foe.hp; b.playerAction({ type: 'move', idx: 0 }); ok(foe.hp < h, 'Lance-Soleil part tout de suite au soleil');
  seed = 2; me = mk('Pikachu', 50, ['thunder-shock']); b = trainer(me, mk('Ronflex', 50, ['splash'])); b.bag['poke-ball'] = 3; b.playerAction({ type: 'item', item: 'poke-ball' });
  ok(b.bag['poke-ball'] === 3, 'une Ball déviée par un dresseur n\'est pas perdue');
  seed = 4; me = mk('Pikachu', 50, ['thunder-shock']); const me2 = mk('Rattata', 50, ['tackle']); b = wild([me, me2], mk('Ronflex', 50, ['splash'])); b.sides[0].v.trap = 3;
  const e = texts(b.playerAction({ type: 'switch', idx: 1 })); ok(/pris au piège/.test(e[0] || '') && b.sides[0].active === 0, 'pris au piège : pas de rappel');
  seed = 2; me = mk('Pikachu', 50, ['counter']); foe = mk('Ronflex', 50, ['splash']); b = wild(me, foe); const ev = b.playerAction({ type: 'move', idx: 0 });
  ok(texts(ev).some((t) => /échoue/.test(t)) && !ev.some((x) => x.t === 'hit'), 'Riposte sans coup reçu : échec, sans animation de coup');
}
{ // équilibrage : l'IA forte connaît Lévitation ; Évoli n'évolue plus par le niveau ; attaques choisies des Champions
  const { getAbility } = await import('../odyssee/js/data/abilities.js'); const { movesChoisies } = await import('../odyssee/js/core/mon.js');
  let me; for (let i = 0; i < 80 && !me; i++) { seed = 11 + i; const c = mk('Smogogo', 50, ['splash']); if (getAbility(c)?.id === 'levitate') me = c; }
  const foe = mk('Rhinoféros', 50, ['earthquake', 'rock-slide', 'stomp']); me.stats[0] = me.hp = 9999;
  const b = trainer(me, foe, { ai: 'smart' }); let seisme = 0;
  for (let n = 0; n < 12 && b.state === 'choose'; n++) { if (texts(b.playerAction({ type: 'move', idx: 0 })).some((t) => /utilise Séisme/.test(t))) seisme++; me.moves[0].pp = 10; }
  ok(!!me && seisme === 0, 'IA « smart » : jamais Séisme sur un Pokémon en Lévitation');
  ok(levelEvolution({ sp: 133, lvl: 60, uid: 1 }, 12) == null, 'Évoli n\'évolue plus tout seul avec le niveau');
  const ms = movesChoisies(sp('Dracolosse'), 81).map((id) => MOVES[id].key);
  ok(ms.length === 4 && ms.includes('dragon-dance') && !ms.includes('hyper-beam'), 'attaques choisies : Dracolosse garde Danse Draco, sans Ultralaser');
  seed = 5; const cap = mk('Pikachu', 13, ['thunder-shock']), cap2 = mk('Rattata', 13, ['tackle']);
  const bc = new Battle({ rng, cap: 13, player: { name: 'A', party: [cap, cap2], bag: {} }, foe: { name: 'T', party: [mk('Chenipan', 2, ['tackle']), mk('Chenipan', 2, ['tackle']), mk('Chenipan', 2, ['tackle'])], trainer: { cls: 'D', name: 'B', prize: 1 } } }); bc.start();
  let dits = 0; for (let n = 0; n < 8 && bc.state === 'choose'; n++) dits += texts(bc.playerAction({ type: 'move', idx: 0 })).filter((t) => /limite de niveau/.test(t)).length;
  ok(dits === 1, 'limite de niveau : annoncée une seule fois par combat');
}
console.log(fails ? `\nRÈGLES DE COMBAT : ${fails} échec(s)` : '\nRÈGLES DE COMBAT : OK');
process.exit(fails ? 1 : 0);
