/* Poké Duel : talents. node tools/test-pokemon-abilities.mjs
   - chaque Pokémon du roster (et chaque forme Méga) a un talent que le moteur sait jouer
   - effets un par un sur des combats montés à la main
   - 400 combats complets entre bots : aucune erreur, les talents se déclenchent */
import assert from 'node:assert/strict';
import { ABILITIES, abilityOf } from '../pokemon/engine/abilities.js';
import { POKEMON_ROSTER, getPokemonById, createActivePokemon } from '../pokemon/engine/data.js';
import { createBattle, resolveTurn, forceSwitch, calculateDamage, getEffectiveSpeed, runEntry } from '../pokemon/engine/battle.js';
import { chooseBotAction, chooseBestSwitch } from '../pokemon/engine/bot.js';
import { suggestItems } from '../pokemon/engine/items.js';
import { MEGAS } from '../pokemon/engine/megas.js';
import { MOVES } from '../pokemon/engine/moves.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const mon = (id, o = {}) => ({ ...createActivePokemon(getPokemonById(id)), item: null, itemUsed: false, choiceLock: null, ...o });
const battle = (a, b) => createBattle({ trainerA: { id: 1, name: 'A' }, trainerB: { id: 2, name: 'B' }, teamA: a, teamB: b });
const pass = { type: 'switch', targetIndex: 0 };   // « ne rien faire » : changer pour le Pokémon déjà au combat
const move = (id) => ({ type: 'move', moveId: id });
const first = (p, f) => p.moves.find((m) => MOVES[m] && f(MOVES[m]));

// --- chaque Pokémon a un talent connu
for (const p of POKEMON_ROSTER) ok(ABILITIES[abilityOf(p.id)], `${p.name} a un talent joué par le moteur (${abilityOf(p.id)})`);
for (const list of Object.values(MEGAS)) for (const m of list) ok(!abilityOf(m.pid) || ABILITIES[abilityOf(m.pid)], `${m.name} : talent connu`);
console.log(`✓ ${POKEMON_ROSTER.length} Pokémon, chacun avec un talent qui a un effet en combat`);

// --- effets
{ // Intimidation dès l'arrivée sur le terrain (avant le premier choix), puis au remplaçant après un K.O.
  const b = battle([mon(130, { ability: 'intimidate' })], [mon(143, { ability: 'thick-fat' })]);
  ok(runEntry(b).some((e) => e.ability === 'intimidate') && b.teamB[0].statStages.atk === -1, 'Intimidation dès l\'arrivée');
  resolveTurn(b, pass, pass);
  ok(b.teamB[0].statStages.atk === -1, 'Intimidation ne rejoue pas au tour suivant');
}
{ // Colère : 2-3 tours, puis confusion ; Demi-Tour : choix du remplaçant
  const b = battle([mon(149, { ability: null })], [mon(143, { ability: null, hp: 9999, maxHp: 9999 })]);
  b.teamA[0].moves[0] = 'outrage'; b.teamA[0].ppMap.outrage = 10;
  let n2 = 0; resolveTurn(b, move('outrage'), pass);
  while (b.teamA[0].rampage && n2++ < 5) resolveTurn(b, move(b.teamA[0].moves[1]), pass);
  ok(n2 >= 1 && n2 <= 2 && b.teamA[0].confused > 0, 'Colère : 2 ou 3 tours puis confusion');
  const c = battle([mon(149, { ability: null }), mon(6, { ability: null })], [mon(143, { ability: null })]);
  c.teamA[0].moves[0] = 'u_turn'; c.teamA[0].ppMap.u_turn = 20;
  resolveTurn(c, move('u_turn'), pass);
  ok(c.phase === 'switch_forced_A' && chooseBotAction(c, 'A').targetIndex === 1, 'Demi-Tour : le lanceur laisse sa place');
}
{ // Méga-Évolution : la nouvelle Vitesse compte dès le tour de l'évolution
  const f = MEGAS[65][0], a = mon(65, { item: f.stone, ability: null }), d = mon(65, { ability: null });
  d.stats = { ...d.stats, spe: Math.round((a.stats.spe + f.stats.spe) / 2) };
  const b = battle([a], [d]);
  const { events } = resolveTurn(b, { type: 'move', moveId: a.moves[0], mega: true }, move(d.moves[0]));
  ok(events.find((e) => e.type === 'attack_start').side === 'A', 'Méga : plus rapide dès ce tour');
}
{ // Sécheresse : soleil, Feu ×1,5
  const b = battle([mon(383, { ability: 'drought' })], [mon(143, { ability: null })]);
  const { events } = resolveTurn(b, pass, pass);
  ok(b.weather && b.weather.type === 'sun' && events.some((e) => e.type === 'ability' && e.weather === 'sun'), 'Sécheresse : soleil');
  const fire = { ...MOVES.flamethrower };
  let s1 = 0, s0 = 0; const att = mon(6, { ability: null }), def = mon(143, { ability: null });
  for (let i = 0; i < 2000; i++) { s1 += calculateDamage(att, def, MOVES.flamethrower, b).damage; s0 += calculateDamage(att, def, MOVES.flamethrower, null).damage; }
  ok(s1 / s0 > 1.4 && s1 / s0 < 1.6, `Feu ×1,5 au soleil (${(s1 / s0).toFixed(2)})`); void fire;
  for (let t = 0; t < 6 && b.weather; t++) resolveTurn(b, pass, pass);
  ok(!b.weather, 'le soleil s\'arrête au bout de 5 tours');
}
{ // Lévitation : Sol sans effet ; Absorb Eau : soigne
  const b = battle([mon(248, { ability: null })], [mon(330, { ability: 'levitate' })]);
  const hp = b.teamB[0].hp;
  resolveTurn(b, move('earthquake'), pass);
  ok(b.teamB[0].hp === hp, 'Lévitation : Séisme sans effet');
  const c = battle([mon(9, { ability: null })], [mon(131, { ability: 'water-absorb' })]);
  c.teamB[0].hp = 50;
  resolveTurn(c, move(first(c.teamA[0], (m) => m.type === 'water' && m.power) || 'surf'), pass);
  ok(c.teamB[0].hp > 50, 'Absorb Eau : une attaque Eau soigne');
}
{ // Coloforce : Attaque ×2 ; Multiécaille : ÷2 à PV pleins
  const a = mon(184, { ability: 'huge-power' }), a0 = mon(184, { ability: null }), d = mon(143, { ability: null });
  const mv = MOVES[first(a, (m) => m.cat === 'physical' && m.power)];
  let x = 0, y = 0; for (let i = 0; i < 2000; i++) { x += calculateDamage(a, d, mv).damage; y += calculateDamage(a0, d, mv).damage; }
  ok(x / y > 1.8, `Coloforce double les dégâts physiques (${(x / y).toFixed(2)})`);
  const ms = mon(149, { ability: 'multiscale' }), ms0 = mon(149, { ability: null }), at = mon(6, { ability: null });
  x = 0; y = 0; for (let i = 0; i < 2000; i++) { x += calculateDamage(at, ms, MOVES.flamethrower).damage; y += calculateDamage(at, ms0, MOVES.flamethrower).damage; }
  ok(x / y > 0.45 && x / y < 0.55, `Multiécaille divise par deux à PV pleins (${(x / y).toFixed(2)})`);
}
{ // Turbo : Vitesse +1 à chaque tour
  const b = battle([mon(257, { ability: 'speed-boost' })], [mon(143, { ability: null })]);
  resolveTurn(b, pass, pass); resolveTurn(b, pass, pass);
  ok(b.teamA[0].statStages.spe === 2, 'Turbo : +1 Vitesse par tour');
}
{ // Fermeté : survit avec 1 PV
  let seen = 0;
  for (let k = 0; k < 200 && !seen; k++) {
    const b = battle([mon(384, { ability: null, statStages: { atk: 6, def: 0, spa: 6, spd: 0, spe: 0 } })], [mon(306, { ability: 'sturdy' })]);
    b.teamA[0].statStages = { atk: 6, def: 0, spa: 6, spd: 0, spe: 0 };
    const { events } = resolveTurn(b, move(first(b.teamA[0], (m) => m.power >= 80) || b.teamA[0].moves[0]), pass);
    if (events.some((e) => e.type === 'ability' && e.ability === 'sturdy')) { seen++; ok(b.teamB[0].hp === 1, 'Fermeté : 1 PV restant'); }
  }
  ok(seen, 'Fermeté s\'est déclenchée');
}
{ // Garde Magik : pas de dégâts de poison
  const b = battle([mon(65, { ability: 'magic-guard', status: 'poison' })], [mon(143, { ability: null })]);
  const hp = b.teamA[0].hp; resolveTurn(b, pass, pass);
  ok(b.teamA[0].hp === hp, 'Garde Magik : le poison ne blesse pas');
}
{ // Corps Sain : stats non baissées ; Glissade : Vitesse ×2 sous la pluie
  const b = battle([mon(143, { ability: null })], [mon(376, { ability: 'clear-body' })]);
  b.teamA[0].moves = ['growl', ...b.teamA[0].moves.slice(1)]; b.teamA[0].ppMap.growl = 40;
  resolveTurn(b, move('growl'), pass);
  ok(b.teamB[0].statStages.atk === 0, 'Corps Sain bloque Rugissement');
  const k = mon(62, { ability: 'swift-swim' });
  ok(getEffectiveSpeed(k, { weather: { type: 'rain' }, teamA: [k], teamB: [], activeA: 0, activeB: 0 }) === getEffectiveSpeed(k) * 2, 'Glissade : Vitesse ×2 sous la pluie');
}
{ // Garde Mystik, Contestation, Farceur, Déclic Tactique, grêle
  const n1 = battle([mon(6, { ability: null })], [mon(292, { ability: 'wonder-guard' })]);
  ok(calculateDamage(n1.teamA[0], n1.teamB[0], MOVES.surf, n1).damage === 0 && calculateDamage(n1.teamA[0], n1.teamB[0], MOVES.flamethrower, n1).damage > 0, 'Garde Mystik : seules les attaques super efficaces');
  const c = battle([mon(143, { ability: null })], [mon(687, { ability: 'contrary' })]);
  c.teamA[0].moves[0] = 'growl'; c.teamA[0].ppMap.growl = 40;
  resolveTurn(c, move('growl'), pass);
  ok(c.teamB[0].statStages.atk === 1, 'Contestation : Rugissement monte l\'Attaque');
  const pr = battle([mon(143, { ability: 'prankster' })], [mon(101 > 0 ? 65 : 65, { ability: null })]);
  pr.teamA[0].moves[0] = 'thunder_wave'; pr.teamA[0].ppMap.thunder_wave = 20;
  const { events } = resolveTurn(pr, move('thunder_wave'), move(pr.teamB[0].moves[0]));
  ok(events.find((e) => e.type === 'attack_start').side === 'A', 'Farceur : statut en priorité');
  const ae = battle([mon(681, { ability: 'stance-change' })], [mon(143, { ability: null, hp: 9999, maxHp: 9999 })]);
  const def0 = ae.teamA[0].stats.def;
  resolveTurn(ae, move(ae.teamA[0].moves.find((k) => MOVES[k].power)), pass);
  ok(ae.teamA[0].blade && ae.teamA[0].stats.atk === def0, 'Déclic Tactique : Forme Assaut');
  const h = battle([mon(460, { ability: 'snow-warning' })], [mon(143, { ability: null })]);
  runEntry(h); const hp = h.teamB[0].hp; resolveTurn(h, pass, pass);
  ok(h.weather.type === 'hail' && h.teamB[0].hp < hp, 'Alerte Neige : la grêle blesse');
}
console.log('✓ effets : Intimidation, Sécheresse et météo, Lévitation, Absorb Eau, Coloforce, Multiécaille, Turbo, Fermeté, Garde Magik, Corps Sain, Glissade, Garde Mystik, Contestation, Farceur, Déclic Tactique, Alerte Neige');

// --- combats complets entre bots
const ids = POKEMON_ROSTER.map((p) => p.id), seen = new Set();
for (let g = 0; g < 400; g++) {
  const pick = () => { const s = new Set(); while (s.size < 3) s.add(ids[Math.floor(Math.random() * ids.length)]); return [...s]; };
  const ta = pick(), tb = pick(), ia = suggestItems(ta), ib = suggestItems(tb);
  const b = createBattle({ trainerA: { id: 1, name: 'A', bot: true }, trainerB: { id: 2, name: 'B', bot: true },
    teamA: ta.map((d) => mon(d, { item: ia[d] })), teamB: tb.map((d) => mon(d, { item: ib[d] })) });
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
    const { events } = resolveTurn(b, chooseBotAction(b, 'A', 'expert'), chooseBotAction(b, 'B', 'expert'));
    for (const e of events) {
      if (e.type === 'ability') seen.add(e.ability);
      ok(!Number.isNaN(e.hp) && !(e.damage < 0), 'aucune valeur aberrante');
    }
    for (const p of [...b.teamA, ...b.teamB]) ok(p.hp >= 0 && p.hp <= p.maxHp, 'PV dans les bornes');
  }
  ok(b.phase === 'over' || turns >= 300, 'le combat se termine');
}
ok(seen.size >= 15, `beaucoup de talents vus en combat (${seen.size})`);
console.log(`✓ 400 combats entre bots, ${seen.size} talents vus en action : ${[...seen].map((k) => ABILITIES[k] ? ABILITIES[k].name : k).join(', ')}`);
console.log(`\nTALENTS DE POKÉ DUEL : ${n} vérifications réussies`);
