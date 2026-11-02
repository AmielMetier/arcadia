/* Poké Duel : combat en double (VGC). node tools/test-pokemon-vgc.mjs
   - deux Pokémon par camp, cibles, attaques de zone (×0,75, allié touché par Séisme), Abri, Intimidation sur les deux adversaires
   - remplacements après un K.O. ; emplacement vide quand le banc est vide
   - 300 combats complets entre bots (équipes de 4) : aucune erreur, chaque combat se termine */
import assert from 'node:assert/strict';
import { POKEMON_ROSTER, getPokemonById, createActivePokemon } from '../pokemon/engine/data.js';
import { createBattle, resolveActions, forceSwitch, getActivePokemon, calculateDamage, sidesOf } from '../pokemon/engine/battle.js';
import { chooseDoublesAction, chooseDoublesSwitch } from '../pokemon/engine/bot.js';
import { suggestItems } from '../pokemon/engine/items.js';
import { MOVES } from '../pokemon/engine/moves.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const mon = (id, o = {}) => { const p = { ...createActivePokemon(getPokemonById(id)), item: null, itemUsed: false, choiceLock: null, ...o }; p.moves = [...p.moves, 'protect']; return p; };
const battle = (a, b) => createBattle({ trainerA: { id: 1, name: 'A' }, trainerB: { id: 2, name: 'B' }, teamA: a, teamB: b, doubles: true });
const mv = (moveId, target) => ({ type: 'move', moveId, target });

{ // départ, Intimidation sur les deux adversaires
  const b = battle([mon(130, { ability: 'intimidate' }), mon(6), mon(3)], [mon(143, { ability: null }), mon(9, { ability: null })]);
  ok(sidesOf(b).length === 4 && getActivePokemon(b, 'C').id === 6 && getActivePokemon(b, 'D').id === 9, 'quatre Pokémon sur le terrain');
  resolveActions(b, { A: mv('protect'), C: mv('protect'), B: mv('protect'), D: mv('protect') });
  ok(b.teamB[0].statStages.atk === -1 && b.teamB[1].statStages.atk === -1, 'Intimidation touche les deux adversaires');
}
{ // Séisme : les deux adversaires et l'allié, ×0,75
  const b = battle([mon(248, { ability: null }), mon(25, { ability: null })], [mon(143, { ability: null, hp: 9999, maxHp: 9999 }), mon(9, { ability: null, hp: 9999, maxHp: 9999 })]);
  b.teamA[0].moves[0] = 'earthquake'; b.teamA[0].ppMap.earthquake = 10;
  const { events } = resolveActions(b, { A: mv('earthquake'), C: mv('protect'), B: mv('protect'), D: null });
  const hits = events.filter((e) => e.type === 'damage' && e.attSide === 'A').map((e) => e.defSide);
  ok(hits.includes('D') && !hits.includes('B') && events.some((e) => e.text && e.text.includes('se protège')), `Séisme touche D, Abri protège B et C (${hits})`);
  let one = 0, two = 0; const a = mon(248, { ability: null }), d = mon(143, { ability: null });
  for (let i = 0; i < 3000; i++) one += calculateDamage(a, d, MOVES.earthquake).damage;
  for (let i = 0; i < 300; i++) { const c = battle([mon(248, { ability: null }), mon(18, { ability: null })], [mon(143, { ability: null, hp: 9999, maxHp: 9999 }), mon(143, { ability: null, hp: 9999, maxHp: 9999 })]);
    c.teamA[0].moves[0] = 'earthquake'; c.teamA[0].ppMap.earthquake = 99;
    two += resolveActions(c, { A: mv('earthquake'), C: null, B: null, D: null }).events.find((e) => e.type === 'damage' && e.defSide === 'B').damage; }
  ok(Math.abs((two / 300) / (one / 3000) - 0.75) < 0.06, `attaque de zone ×0,75 (${((two / 300) / (one / 3000)).toFixed(2)})`);
}
{ // K.O. : remplacement de l'emplacement ; banc vide : emplacement vide
  const b = battle([mon(150, { ability: null }), mon(65, { ability: null })], [mon(143, { ability: null, hp: 1 }), mon(9, { ability: null }), mon(3, { ability: null })]);
  const atk = b.teamA[0].moves.find((k) => MOVES[k].power && MOVES[k].type === 'psychic') || b.teamA[0].moves[0];
  resolveActions(b, { A: mv(atk, 'B'), C: mv('protect'), B: null, D: mv('protect') });
  ok(b.phase === 'switch_forced' && b.need.includes('B'), 'Ronflex K.O. : B doit être remplacé');
  forceSwitch(b, 'B', 2);
  ok(b.phase === 'choose' && getActivePokemon(b, 'B').id === 3, 'Florizarre entre en B');
}

{ // 2 contre 2 entre joueurs : chaque emplacement ne peut envoyer que les Pokémon de son dresseur
  const b = createBattle({ trainerA: { id: 1, name: 'A & C' }, trainerB: { id: 2, name: 'B & D' }, doubles: true,
    teamA: [mon(150, { ability: null }), mon(6), mon(3), mon(25, { hp: 1, ability: null }), mon(9), mon(130)],
    teamB: [mon(143, { ability: null }), mon(65), mon(94), mon(149), mon(248), mon(376)],
    pools: { A: [0, 1, 2], C: [3, 4, 5], B: [0, 1, 2], D: [3, 4, 5] }, owners: { A: 1, C: 3, B: 2, D: 4 } });
  ok(getActivePokemon(b, 'C').id === 25 && getActivePokemon(b, 'D').id === 149, 'chaque joueur commence avec son premier Pokémon');
  const atk = b.teamB[0].moves.find((k) => MOVES[k].power) ;
  resolveActions(b, { A: mv('protect'), C: null, B: mv(atk, 'C'), D: mv('protect') });
  ok(b.phase === 'switch_forced' && b.need.includes('C'), 'Pikachu K.O. : C doit être remplacé');
  ok(!forceSwitch(b, 'C', 1), 'C ne peut pas envoyer un Pokémon du coéquipier');
  ok(forceSwitch(b, 'C', 4) && getActivePokemon(b, 'C').id === 9, 'C envoie un des siens');
}

// combats complets entre bots
const ids = POKEMON_ROSTER.map((p) => p.id);
let turnsTotal = 0, spreadSeen = 0, protectSeen = 0;
for (let g = 0; g < 300; g++) {
  const pick = () => { const s = new Set(); while (s.size < 4) s.add(ids[Math.floor(Math.random() * ids.length)]); return [...s]; };
  const ta = pick(), tb = pick(), ia = suggestItems(ta), ib = suggestItems(tb);
  const b = battle(ta.map((d) => mon(d, { item: ia[d] })), tb.map((d) => mon(d, { item: ib[d] })));
  let turns = 0;
  while (b.phase !== 'over' && turns++ < 300) {
    if (b.phase === 'switch_forced') { for (const s of [...b.need]) forceSwitch(b, s, chooseDoublesSwitch(b, s).targetIndex); continue; }
    const acts = {}; for (const s of sidesOf(b)) acts[s] = chooseDoublesAction(b, s, 'expert');
    const { events } = resolveActions(b, acts);
    for (const e of events) {
      ok(!Number.isNaN(e.hp) && !(e.damage < 0), 'aucune valeur aberrante');
      if (e.type === 'damage' && MOVES[Object.keys(MOVES).find((k) => MOVES[k].name === e.moveName)]?.spread) spreadSeen++;
      if (e.text && e.text.includes('se protège')) protectSeen++;
    }
    for (const p of [...b.teamA, ...b.teamB]) ok(p.hp >= 0 && p.hp <= p.maxHp, 'PV dans les bornes');
  }
  turnsTotal += turns;
  ok(b.phase === 'over', `le combat ${g} se termine (${b.phase})`);
}
ok(spreadSeen > 0 && protectSeen > 0, 'les bots utilisent les attaques de zone et Abri');
console.log(`✓ 300 combats en double entre bots, ${(turnsTotal / 300).toFixed(1)} tours en moyenne, ${spreadSeen} coups de zone, ${protectSeen} Abri`);
console.log(`\nVGC DE POKÉ DUEL : ${n} vérifications réussies`);
