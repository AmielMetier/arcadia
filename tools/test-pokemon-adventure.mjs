// tools/test-pokemon-adventure.mjs
// Suite de tests unitaires pour le Mode Aventure Kalos-Sud (Menton).

import assert from 'node:assert';
import {
  STARTER_OPTIONS,
  createAdventurePokemon,
  checkLevelUp,
  calculateCatchSuccess,
  rollWildEncounter,
  ITEMS
} from '../pokemon/adventure/data.js';
import {
  createMentonMap,
  isSolid,
  getTile,
  TILE,
  MAP_WIDTH,
  MAP_HEIGHT
} from '../pokemon/adventure/map.js';
import {
  getInitialPlayerData,
  giveStarter,
  healParty,
  addPokemonToPlayer,
  addItem,
  removeItem
} from '../pokemon/adventure/player.js';

console.log('--- 1. Test des Espèces et Starters de Menton ---');
assert.strictEqual(STARTER_OPTIONS.length, 6, 'Il doit y avoir 6 starters au choix');
for (const st of STARTER_OPTIONS) {
  const poke = createAdventurePokemon(st.id, 5);
  assert.strictEqual(poke.level, 5, `${st.name} doit démarrer au niveau 5`);
  assert(poke.maxHp >= 18, `${st.name} doit avoir au moins 18 PV max`);
  assert.strictEqual(poke.currentHp, poke.maxHp, 'PV pleins au départ');
  assert(poke.moves.length >= 2, `${st.name} doit avoir au moins 2 capacités de départ`);
  console.log(`✓ Starter ${st.name} (N.5) : ${poke.currentHp} PV, ${poke.stats.atk} ATK, ${poke.stats.def} DEF, moves: ${poke.moves.join(', ')}`);
}

console.log('\n--- 2. Test Montée de Niveau & EXP ---');
const testFroakie = createAdventurePokemon(656, 5); // Grenousse
const oldHp = testFroakie.maxHp;
const oldAtk = testFroakie.stats.atk;
testFroakie.exp = testFroakie.expNext; // EXP suffisant
const leveled = checkLevelUp(testFroakie);
assert.strictEqual(leveled, true, 'Doit monter de niveau');
assert.strictEqual(testFroakie.level, 6, 'Niveau doit être 6');
assert(testFroakie.maxHp >= oldHp, 'PV max doivent augmenter');
assert(testFroakie.stats.atk >= oldAtk, 'Attaque doit augmenter');
console.log(`✓ Grenousse a atteint le niveau 6 ! PV: ${testFroakie.maxHp} (+${testFroakie.maxHp - oldHp}), ATK: ${testFroakie.stats.atk}`);

console.log('\n--- 3. Test Formule de Capture Officielle ---');
const wildFletchling = createAdventurePokemon(661, 3); // Passerouge sauvage
// Pleine vie
const resFull = calculateCatchSuccess(wildFletchling, 1.0);
assert(typeof resFull.success === 'boolean');
assert(resFull.shakes >= 0 && resFull.shakes <= 3);

// PV affaiblis à 1 PV et endormi
wildFletchling.currentHp = 1;
wildFletchling.status = 'sleep';
let catches = 0;
for (let i = 0; i < 50; i++) {
  if (calculateCatchSuccess(wildFletchling, 1.5).success) catches++; // Super Ball
}
assert(catches >= 35, 'Taux de capture très élevé à 1 PV avec Super Ball et sommeil');
console.log(`✓ Test de capture réussi (Passerouge affaibli capturé ${catches}/50 fois avec Super Ball)`);

console.log('\n--- 4. Test Rencontres Sauvages (Hautes Herbes & Bord de Mer) ---');
for (let i = 0; i < 20; i++) {
  const wildGrass = rollWildEncounter('grass');
  assert(wildGrass.level >= 2 && wildGrass.level <= 6, 'Niveau cohérent');
  const wildWater = rollWildEncounter('water');
  assert(wildWater.level >= 3 && wildWater.level <= 6, 'Niveau aquatique cohérent');
}
console.log('✓ 20 rencontres sauvages simulées avec succès dans les hautes herbes et sur la côte');

console.log('\n--- 5. Test Carte de Menton & Détections de Collisions ---');
const map = createMentonMap();
assert.strictEqual(map.length, MAP_HEIGHT, 'Hauteur de carte correcte');
assert.strictEqual(map[0].length, MAP_WIDTH, 'Largeur de carte correcte');

// Vérification des points d'intérêt majeurs
assert.strictEqual(getTile(map, 6, 6), TILE.LAB_TABLE, 'Table du labo à (6,6)');
assert.strictEqual(getTile(map, 17, 6), TILE.NURSE_DESK, 'Comptoir infirmière à (17,6)');
assert.strictEqual(getTile(map, 19, 6), TILE.PC_BOX, 'PC à (19,6)');
assert.strictEqual(getTile(map, 12, 15), TILE.FOUNTAIN, 'Fontaine à (12,15)');
assert.strictEqual(getTile(map, 9, 13), TILE.LEMON_TREE, 'Citronnier à (9,13)');
assert.strictEqual(getTile(map, 15, 13), TILE.LEMON_TREE, 'Citronnier à (15,13)');

// Collisions
assert.strictEqual(isSolid(map, 6, 6), true, 'Table labo solide');
assert.strictEqual(isSolid(map, 17, 6), true, 'Comptoir infirmière solide');
assert.strictEqual(isSolid(map, 6, 7), false, 'Intérieur labo marchable');
assert.strictEqual(isSolid(map, 6, 8), false, 'Porte labo marchable');
assert.strictEqual(isSolid(map, 10, 29), true, 'Mer solide');
assert.strictEqual(isSolid(map, 10, 25), false, 'Sable plage marchable');
console.log('✓ Lieux emblématiques de Menton et collisions validés');

console.log('\n--- 6. Test Joueur, Sac, Citrons de Menton & Soins ---');
const player = getInitialPlayerData('Red', '#ff0000');
assert.strictEqual(player.hasStarter, false);
assert.strictEqual(player.party.length, 0);

// Choix starter
const myStarter = giveStarter(player, 4); // Salamèche
assert.strictEqual(player.hasStarter, true);
assert.strictEqual(player.party.length, 1);
assert.strictEqual(player.party[0].name, 'Salamèche');

// Ajout de 6 autres Pokémon pour tester le débordement vers la boîte PC
for (let i = 0; i < 7; i++) {
  const p = createAdventurePokemon(16, 3); // Roucool
  addPokemonToPlayer(player, p);
}
assert.strictEqual(player.party.length, 6, 'Équipe plafonnée à 6');
assert.strictEqual(player.box.length, 2, 'Les suivants vont dans la boîte PC');

// Dégâts et soin
player.party[0].currentHp = 2;
player.party[0].status = 'burn';
player.party[1].currentHp = 0;
player.party[1].fainted = true;

const healedCount = healParty(player);
assert.strictEqual(healedCount, 2, '2 Pokémon soignés');
assert.strictEqual(player.party[0].currentHp, player.party[0].maxHp, 'PV restaurés au max');
assert.strictEqual(player.party[0].status, null, 'Statut guéri');
assert.strictEqual(player.party[1].fainted, false, 'K.O. relevé');

// Cueillette de Citrons de Menton
addItem(player, 'citron_menton', 3);
assert.strictEqual(player.inventory.citron_menton, 5, '2 de base + 3 cueillis = 5 citrons');
const used = removeItem(player, 'citron_menton', 1);
assert.strictEqual(used, true);
assert.strictEqual(player.inventory.citron_menton, 4);
console.log('✓ Gestion équipe, débordement PC, cueillette et soin validés');

console.log('\nTOUS LES TESTS DU MODE AVENTURE KALOS-SUD SONT AU VERT !');
