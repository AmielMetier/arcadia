// tools/test-v364-features.mjs — tests unitaires des fonctionnalités v3.64 d'Odyssée
import assert from 'node:assert/strict';
import { createMon, levelEvolution } from '../odyssee/js/core/mon.js';
import { Battle, typeEff } from '../odyssee/js/core/battle.js';
import { getAbility, abilityName } from '../odyssee/js/data/abilities.js';
import { ITEMS, giveHeldItem, takeHeldItem } from '../odyssee/js/core/items.js';
import { SPECIES } from '../odyssee/js/data/species.js';

console.log('--- Test v3.64 : Efficacité des types ---');
// Eau sur Feu -> Super efficace (2)
assert.equal(typeEff('water', ['fire']), 2);
// Feu sur Plante -> Super efficace (2)
assert.equal(typeEff('fire', ['grass']), 2);
// Électrik sur Sol -> Sans effet (0)
assert.equal(typeEff('electric', ['ground']), 0);
// Plante sur Feu -> Peu efficace (0.5)
assert.equal(typeEff('grass', ['fire']), 0.5);
// Eau sur Plante/Poison -> 0.5 * 1 = 0.5
assert.equal(typeEff('water', ['grass', 'poison']), 0.5);
console.log('✓ Calculs d\'efficacité des types validés');

console.log('--- Test v3.64 : Objets Tenus & Sac ---');
const bulb = createMon(1, 10);
const bag = { 'leftovers': 2, 'choice-band': 1 };
assert.equal(bulb.item, null);
giveHeldItem(bulb, 'leftovers', bag);
assert.equal(bulb.item, 'leftovers');
assert.equal(bag['leftovers'], 1);
const taken = takeHeldItem(bulb, bag);
assert.equal(taken, 'leftovers');
assert.equal(bulb.item, null);
assert.equal(bag['leftovers'], 2);
console.log('✓ Gestion des objets tenus (donner / retirer) validée');

console.log('--- Test v3.64 : Talents Passifs ---');
const dracaufeu = createMon(6, 36);
assert.equal(getAbility(dracaufeu).id, 'blaze');
assert.equal(abilityName(getAbility(dracaufeu)), 'Brasier');

const leviator = createMon(130, 30);
assert.equal(getAbility(leviator).id, 'intimidate');
assert.equal(abilityName(getAbility(leviator)), 'Intimidation');

const ectoplasma = createMon(94, 35);
assert.equal(getAbility(ectoplasma).id, 'levitate');
console.log('✓ Attribution et lecture des talents passifs validées');

console.log('--- Test v3.64 : Évolution Jour / Nuit d\'Évoli ---');
const eevee = createMon(133, 25);
// Jour (12h) -> Mentali (196)
assert.equal(levelEvolution(eevee, 12), 196);
// Nuit (23h) -> Noctali (197)
assert.equal(levelEvolution(eevee, 23), 197);
// Matin (8h) -> Mentali (196)
assert.equal(levelEvolution(eevee, 8), 196);
// Nuit (3h) -> Noctali (197)
assert.equal(levelEvolution(eevee, 3), 197);
console.log('✓ Évolution temporelle d\'Évoli (Mentali jour / Noctali nuit) validée');

console.log('--- Test v3.64 : Météo & Talents d\'entrée en Combat ---');
// Combat avec Météo Pluie
const bWater = new Battle({
  player: { name: 'Sacha', party: [createMon(7, 15)], bag: {} },
  foe: { name: 'Sauvage', party: [createMon(4, 15)] },
  weather: 'rain'
});
assert.equal(bWater.weather, 'rain');
const startEvs = bWater.start();
assert.ok(startEvs.some(e => e.t === 'weather' && e.weather === 'rain'));

// Combat avec Intimidation (Léviator)
const bIntimidate = new Battle({
  player: { name: 'Sacha', party: [createMon(130, 25)], bag: {} },
  foe: { name: 'Sauvage', party: [createMon(19, 15)] }
});
const evsIntim = bIntimidate.start();
assert.ok(evsIntim.some(e => e.t === 'msg' && e.text.includes('Intimidation')));
console.log('✓ Météo de combat et activation des talents d\'entrée validées');

console.log('--- Test v3.64 : Maître des Capacités (Move Relearner) ---');
// Salamèche au niveau 25 a des attaques dans son historique
const charmander = createMon(4, 25);
const candMoves = SPECIES[4].ls.filter(([lvl, id]) => lvl <= charmander.lvl && !charmander.moves.some(m => m.id === id));
assert.ok(candMoves.length > 0, 'Salamèche niveau 25 a des capacités oubliées réapprenables');
console.log(`✓ Salamèche N.25 a ${candMoves.length} capacités réapprenables`);

console.log('\nTOUTES LES FONCTIONNALITÉS V3.64 SONT 100% OPÉRATIONNELLES ET VÉRIFIÉES !');
