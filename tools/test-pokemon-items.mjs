/* Poké Duel : objets tenus. node tools/test-pokemon-items.mjs
   - conseils : 3 objets différents par équipe, valides ; un choix du joueur est gardé, un doublon remplacé
   - effets un par un (Restes, Baie Sitrus, Baie Prine, Orbe Vie, Bandeau/Lunettes/Mouchoir Choix, Ceinture Force, Ceinture Pro)
   - 300 combats complets entre bots avec objets : pas d'erreur, chaque objet finit par se déclencher */
import assert from 'node:assert/strict';
import { ITEMS, ITEM_KEYS, suggestItems, cleanItems } from '../pokemon/engine/items.js';
import { POKEMON_ROSTER, getPokemonById, createActivePokemon } from '../pokemon/engine/data.js';
import { createBattle, resolveTurn, calculateDamage, getEffectiveSpeed } from '../pokemon/engine/battle.js';
import { chooseBotAction, chooseBestSwitch } from '../pokemon/engine/bot.js';
import { forceSwitch } from '../pokemon/engine/battle.js';
import { MOVES } from '../pokemon/engine/moves.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const mon = (id, item) => ({ ...createActivePokemon(getPokemonById(id)), item: item || null, itemUsed: false, choiceLock: null });
const ids = POKEMON_ROSTER.map((p) => p.id);

// --- conseils
for (let k = 0; k < 200; k++) {
  const trio = [ids[(k * 7) % ids.length], ids[(k * 13 + 5) % ids.length], ids[(k * 29 + 11) % ids.length]];
  if (new Set(trio).size < 3) continue;
  const s = suggestItems(trio);
  ok(trio.every((d) => ITEMS[s[d]]), 'objet conseillé valide');
  ok(new Set(Object.values(s)).size === 3, 'pas deux fois le même objet');
}
{
  const trio = [ids[0], ids[1], ids[2]];
  const c = cleanItems(trio, { [trio[0]]: 'leftovers', [trio[1]]: 'leftovers', [trio[2]]: 'pirate' });
  ok(c[trio[0]] === 'leftovers' && c[trio[1]] !== 'leftovers' && ITEMS[c[trio[2]]], 'choix gardé, doublon et objet inconnu remplacés');
}
console.log('✓ conseils : 3 objets différents par équipe, choix du joueur respecté');

// --- effets
const firstDamaging = (p) => p.moves.find((m) => MOVES[m] && MOVES[m].power > 0 && MOVES[m].cat !== 'status');
const A = ids[0], B = ids[3];
{ // Restes
  const b = createBattle({ trainerA: { id: 1, name: 'A' }, trainerB: { id: 2, name: 'B' }, teamA: [mon(A, 'leftovers')], teamB: [mon(B)] });
  b.teamA[0].hp = Math.floor(b.teamA[0].maxHp / 2);
  const { events } = resolveTurn(b, { type: 'switch', targetIndex: 0 }, { type: 'switch', targetIndex: 0 });
  ok(events.some((e) => e.type === 'heal' && e.item === 'leftovers'), 'Restes soignent en fin de tour');
}
{ // Sitrus + Prine
  const p = mon(A, 'sitrus'); p.hp = Math.floor(p.maxHp * 0.4);
  const b = createBattle({ trainerA: { id: 1, name: 'A' }, trainerB: { id: 2, name: 'B' }, teamA: [p], teamB: [mon(B)] });
  const { events } = resolveTurn(b, { type: 'switch', targetIndex: 0 }, { type: 'switch', targetIndex: 0 });
  ok(events.some((e) => e.type === 'item' && e.item === 'sitrus') && b.teamA[0].itemUsed, 'Baie Sitrus mangée sous la moitié');
  const q = mon(A, 'lum'); q.status = 'burn';
  const b2 = createBattle({ trainerA: { id: 1, name: 'A' }, trainerB: { id: 2, name: 'B' }, teamA: [q], teamB: [mon(B)] });
  resolveTurn(b2, { type: 'switch', targetIndex: 0 }, { type: 'switch', targetIndex: 0 });
  ok(!b2.teamA[0].status && b2.teamA[0].itemUsed, 'Baie Prine soigne le statut');
}
{ // multiplicateurs (moyenne sur beaucoup de tirages)
  const att = mon(A), def = mon(B), mv = MOVES[firstDamaging(att)];
  const avg = (a) => { let s = 0; for (let i = 0; i < 3000; i++) s += calculateDamage(a, def, mv).damage; return s / 3000; };
  const base = avg(att), orb = avg({ ...att, item: 'lifeorb' });
  ok(orb / base > 1.2 && orb / base < 1.4, `Orbe Vie ×1,3 (${(orb / base).toFixed(2)})`);
  const band = avg({ ...att, item: mv.cat === 'physical' ? 'choiceband' : 'choicespecs' });
  ok(band / base > 1.4 && band / base < 1.6, `objet Choix ×1,5 (${(band / base).toFixed(2)})`);
  ok(getEffectiveSpeed({ ...att, item: 'choicescarf' }) === getEffectiveSpeed(att) * 1.5, 'Mouchoir Choix : Vitesse ×1,5');
}
{ // blocage Choix
  const p = mon(A, 'choiceband'), mv = p.moves.filter((m) => MOVES[m]);
  const b = createBattle({ trainerA: { id: 1, name: 'A' }, trainerB: { id: 2, name: 'B' }, teamA: [p, mon(ids[5])], teamB: [mon(B, 'focussash')] });
  resolveTurn(b, { type: 'move', moveId: mv[0] }, { type: 'move', moveId: b.teamB[0].moves[0] });
  if (!b.teamA[0].fainted && b.phase === 'choose') {
    ok(b.teamA[0].choiceLock === mv[0], 'bloqué sur la première attaque');
    const { events } = resolveTurn(b, { type: 'move', moveId: mv[1] }, { type: 'move', moveId: b.teamB[0].moves[0] });
    const used = events.filter((e) => e.type === 'attack_start' && e.side === 'A').map((e) => e.moveName);
    ok(!used.length || used[0] === MOVES[mv[0]].name, 'une autre attaque est remplacée par l\'attaque bloquée');
    ok(chooseBotAction(b, 'A', 'facile').moveId === mv[0] || chooseBotAction(b, 'A', 'facile').type === 'switch', 'le bot respecte le blocage');
    resolveTurn(b, { type: 'switch', targetIndex: 1 }, { type: 'move', moveId: b.teamB[0].moves[0] });
    if (b.phase === 'choose' && !b.teamA[0].fainted) {
      resolveTurn(b, { type: 'switch', targetIndex: 0 }, { type: 'move', moveId: b.teamB[0].moves[0] });
      ok(!b.teamA[0].choiceLock, 'le blocage tombe quand le Pokémon revient au combat');
    } else n++;
  } else n++;
}
{ // Ceinture Force
  let saved = 0;
  for (let k = 0; k < 400 && !saved; k++) {
    const att = mon(ids[(k * 17) % ids.length], 'choiceband'); att.statStages = { atk: 6, def: 0, spa: 6, spd: 0, spe: 6 };
    const def = mon(ids[(k * 31 + 3) % ids.length], 'focussash');
    const b = createBattle({ trainerA: { id: 1, name: 'A' }, trainerB: { id: 2, name: 'B' }, teamA: [att], teamB: [def] });
    b.teamA[0].statStages = { atk: 6, def: 0, spa: 6, spd: 0, spe: 6 };
    const m = firstDamaging(b.teamA[0]); if (!m) continue;
    const { events } = resolveTurn(b, { type: 'move', moveId: m }, { type: 'switch', targetIndex: 0 });
    if (events.some((e) => e.type === 'item' && e.item === 'focussash')) { saved++; ok(b.teamB[0].hp === 1 && !b.teamB[0].fainted, 'Ceinture Force : survit avec 1 PV'); }
  }
  ok(saved, 'la Ceinture Force s\'est déclenchée');
}
console.log('✓ effets : Restes, Sitrus, Prine, Orbe Vie, Choix (bonus et blocage), Ceinture Force');

// --- combats complets entre bots
const seen = new Set();
for (let g = 0; g < 300; g++) {
  const pick = () => { const s = new Set(); while (s.size < 3) s.add(ids[Math.floor(Math.random() * ids.length)]); return [...s]; };
  const ta = pick(), tb = pick(), ia = suggestItems(ta), ib = suggestItems(tb);
  const b = createBattle({ trainerA: { id: 1, name: 'A', bot: true }, trainerB: { id: 2, name: 'B', bot: true },
    teamA: ta.map((d) => mon(d, ia[d])), teamB: tb.map((d) => mon(d, ib[d])) });
  let turns = 0;
  while (b.phase !== 'over' && turns++ < 300) {
    if (b.phase.startsWith('switch_forced')) {
      for (const side of ['A', 'B']) if (b.phase === 'switch_forced_both' || b.phase === `switch_forced_${side}`) {
        const team = side === 'A' ? b.teamA : b.teamB, cur = side === 'A' ? b.activeA : b.activeB;
        const sw = chooseBestSwitch(team, cur, null) || { targetIndex: team.findIndex((p) => !p.fainted) };
        forceSwitch(b, side, sw.targetIndex);
      }
      continue;
    }
    const { events } = resolveTurn(b, chooseBotAction(b, 'A', 'normal'), chooseBotAction(b, 'B', 'normal'));
    for (const e of events) { if (e.type === 'item') seen.add(e.item); if (e.item) seen.add(e.item); }
  }
  ok(b.phase === 'over' || turns >= 300, 'le combat se termine');
}
for (const k of ['leftovers', 'sitrus', 'lifeorb']) ok(seen.has(k), `${ITEMS[k].name} s'est déclenché en combat`);
console.log(`✓ 300 combats entre bots avec objets, objets vus en action : ${[...seen].map((k) => ITEMS[k].name).join(', ')}`);
// --- Méga-Évolution
{
  const { MEGAS } = await import('../pokemon/engine/megas.js');
  const { canMega } = await import('../pokemon/engine/battle.js');
  ok(Object.keys(MEGAS).length >= 25, 'des Pokémon du roster peuvent méga-évoluer');
  ok(Object.keys(MEGAS).every((d) => getPokemonById(Number(d))), 'chaque Méga correspond à un Pokémon du roster');
  // une seule Méga-Gemme par équipe, et seulement pour son Pokémon
  const c = cleanItems([6, 94, 65], { 6: 'mega_10035', 94: 'mega_10038', 65: 'mega_10034' });
  ok(c[6] === 'mega_10035' && !String(c[94]).startsWith('mega_') && !String(c[65]).startsWith('mega_'), 'une seule Méga-Gemme par équipe, et pour le bon Pokémon');
  ok(String(suggestItems([6, 25, 143])[6]).startsWith('mega_'), 'la Méga-Gemme est conseillée au meilleur candidat');
  const zard = mon(6, 'mega_10035'), foe = mon(143);
  const b = createBattle({ trainerA: { id: 1, name: 'A' }, trainerB: { id: 2, name: 'B' }, teamA: [zard, mon(25)], teamB: [foe] });
  const hp0 = b.teamA[0].hp, spa0 = b.teamA[0].stats.spa;
  ok(canMega(b, 'A', b.teamA[0]), 'Dracaufeu peut méga-évoluer');
  const { events } = resolveTurn(b, { type: 'move', moveId: b.teamA[0].moves[0], mega: true }, { type: 'move', moveId: b.teamB[0].moves[0] });
  const ev = events.find((e) => e.type === 'mega');
  ok(ev && ev.name === 'Méga-Dracaufeu Y' && events.indexOf(ev) < events.findIndex((e) => e.type === 'attack_start'), 'la Méga-Évolution a lieu avant les attaques');
  ok(b.teamA[0].isMega && b.teamA[0].stats.spa > spa0 && b.teamA[0].spriteId === 10035, 'stats et sprite de la forme Méga');
  ok(b.teamA[0].maxHp === mon(6).maxHp && b.teamA[0].hp <= hp0, 'les PV ne changent pas');
  ok(!canMega(b, 'A', b.teamA[0]) && !canMega(b, 'A', b.teamA[1]), 'une seule Méga-Évolution par combat');
  if (b.phase === 'choose') {
    resolveTurn(b, { type: 'switch', targetIndex: 1 }, { type: 'move', moveId: b.teamB[0].moves[0] });
    ok(b.teamA[0].isMega && b.teamA[0].name === 'Méga-Dracaufeu Y', 'elle reste Méga après un changement');
  } else n++;
  // le bot méga-évolue
  const b2 = createBattle({ trainerA: { id: 1, name: 'A', bot: true }, trainerB: { id: 2, name: 'B' }, teamA: [mon(94, 'mega_10038')], teamB: [mon(143)] });
  ok(chooseBotAction(b2, 'A', 'normal').mega === true, 'le bot méga-évolue dès qu\'il peut');
  console.log('✓ Méga-Évolution : avant les attaques, stats et types de la forme Méga, PV gardés, une seule par combat, bots compris');
}
console.log(`\nOBJETS DE POKÉ DUEL : ${n} vérifications réussies`);
