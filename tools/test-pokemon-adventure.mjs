// tools/test-pokemon-adventure.mjs
// Suite de tests unitaires complète pour le Mode Aventure Kalos-Sud (Menton) - Master Edition.

import assert from 'node:assert';
import {
  STARTER_OPTIONS,
  createAdventurePokemon,
  checkLevelUp,
  calculateCatchSuccess,
  rollWildEncounter,
  ADVENTURE_TRAINERS,
  createTrainerParty,
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
  removeItem,
  buyItem,
  useItemOutsideBattle,
  setLeadPokemon,
  depositToBox,
  withdrawFromBox
} from '../pokemon/adventure/player.js';
import { createAdventureNetwork } from '../pokemon/adventure/net.js';

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

console.log('\n--- 2. Test Montée de Niveau, Apprentissage de Capacités & Évolution ---');
const testCharmander = createAdventurePokemon(4, 8); // Salamèche N.8
const oldHp = testCharmander.maxHp;
testCharmander.exp = testCharmander.expNext; // Passage au N.9 -> Évolution en Reptincel (ID 5) !
const leveled = checkLevelUp(testCharmander);
assert.strictEqual(leveled, true, 'Doit monter de niveau');
assert.strictEqual(testCharmander.level, 9, 'Niveau doit être 9');
assert.strictEqual(testCharmander.id, 5, 'Salamèche doit évoluer en Reptincel (ID 5) au niveau 9');
assert.strictEqual(testCharmander.name, 'Reptincel');
assert(testCharmander.maxHp > oldHp, 'PV max doivent augmenter après évolution');
assert(testCharmander.lastLevelUp && testCharmander.lastLevelUp.evolvedTo === 'Reptincel');
console.log(`✓ Salamèche a évolué en ${testCharmander.name} (N.9) ! PV: ${oldHp} -> ${testCharmander.maxHp}, moves: ${testCharmander.moves.join(', ')}`);

console.log('\n--- 3. Test Formule de Capture Officielle ---');
const wildFletchling = createAdventurePokemon(661, 3); // Passerouge sauvage
const resFull = calculateCatchSuccess(wildFletchling, 1.0);
assert(typeof resFull.success === 'boolean');
assert(resFull.shakes >= 0 && resFull.shakes <= 3);

wildFletchling.currentHp = 1;
wildFletchling.status = 'sleep';
let catches = 0;
for (let i = 0; i < 50; i++) {
  if (calculateCatchSuccess(wildFletchling, 1.5).success) catches++;
}
assert(catches >= 35, 'Taux de capture très élevé à 1 PV avec Super Ball et sommeil');
console.log(`✓ Test de capture réussi (Passerouge affaibli capturé ${catches}/50 fois avec Super Ball)`);

console.log('\n--- 4. Test Rencontres Sauvages & Dresseurs PNJ / Championne Solène ---');
for (let i = 0; i < 20; i++) {
  const wildGrass = rollWildEncounter('grass');
  assert(wildGrass.level >= 2 && wildGrass.level <= 8, 'Niveau cohérent');
  const wildWater = rollWildEncounter('water');
  assert(wildWater.level >= 3 && wildWater.level <= 8, 'Niveau aquatique cohérent');
}
assert(ADVENTURE_TRAINERS.length >= 5, 'Au moins 5 dresseurs dont la Championne Solène');
const gymLeader = ADVENTURE_TRAINERS.find(t => t.isGymLeader);
assert(gymLeader, 'Championne Solène présente');
const gymParty = createTrainerParty(gymLeader);
assert.strictEqual(gymParty.length, 3, 'Solène possède 3 Pokémon');
console.log(`✓ Dresseurs PNJ et Championne ${gymLeader.name} (${gymParty.map(p => p.name).join(', ')}) validés`);

console.log('\n--- 5. Test Carte de Menton, Boutique, Arène & Collisions ---');
const map = createMentonMap();
assert.strictEqual(map.length, MAP_HEIGHT, 'Hauteur de carte correcte');
assert.strictEqual(map[0].length, MAP_WIDTH, 'Largeur de carte correcte');

assert.strictEqual(getTile(map, 6, 6), TILE.LAB_TABLE, 'Table du labo à (6,6)');
assert.strictEqual(getTile(map, 17, 6), TILE.NURSE_DESK, 'Comptoir infirmière à (17,6)');
assert.strictEqual(getTile(map, 19, 6), TILE.PC_BOX, 'PC à (19,6)');
assert.strictEqual(getTile(map, 19, 14), TILE.MART_DESK, 'Boutique Pokémon à (19,14)');
assert.strictEqual(getTile(map, 38, 4), TILE.DOOR, 'Porte de l\'Arène de Menton à (38,4)');
assert.strictEqual(getTile(map, 12, 15), TILE.FOUNTAIN, 'Fontaine à (12,15)');
assert.strictEqual(getTile(map, 9, 13), TILE.LEMON_TREE, 'Citronnier à (9,13)');

assert.strictEqual(isSolid(map, 6, 6), true, 'Table labo solide');
assert.strictEqual(isSolid(map, 19, 14), true, 'Comptoir boutique solide');
assert.strictEqual(isSolid(map, 6, 7), false, 'Intérieur labo marchable');
assert.strictEqual(isSolid(map, 10, 29), true, 'Mer solide');
assert.strictEqual(isSolid(map, 10, 25), false, 'Sable plage marchable');
console.log('✓ Lieux emblématiques de Menton (Labo, Centre, Boutique, Arène) et collisions validés');

console.log('\n--- 6. Test Joueur, Boutique, Soin Hors Combat, Suiveur & PC ---');
const player = getInitialPlayerData('Red', '#ff0000');
giveStarter(player, 4); // Salamèche
assert.strictEqual(player.pokedex.caught.includes(4), true, 'Salamèche enregistré dans le Pokédex');

for (let i = 0; i < 6; i++) {
  addPokemonToPlayer(player, createAdventurePokemon(25, 5)); // Pikachu
}
assert.strictEqual(player.party.length, 6, 'Équipe plafonnée à 6');
assert.strictEqual(player.box.length, 1, '7e Pokémon stocké dans la Boîte PC');

// Changement de Pokémon en tête (Suiveur)
setLeadPokemon(player, 1);
assert.strictEqual(player.party[0].name, 'Pikachu', 'Pikachu est passé en tête d\'équipe');

// Dépôt et retrait PC
const depRes = depositToBox(player, 0);
assert.strictEqual(depRes.ok, true);
assert.strictEqual(player.party.length, 5);
assert.strictEqual(player.box.length, 2);

const witRes = withdrawFromBox(player, 0);
assert.strictEqual(witRes.ok, true);
assert.strictEqual(player.party.length, 6);

// Boutique Pokémon
const startMoney = player.money;
const buyRes = buyItem(player, 'super_ball', 2);
assert.strictEqual(buyRes.ok, true);
assert.strictEqual(player.money, startMoney - ITEMS.super_ball.price * 2);
assert.strictEqual(player.inventory.super_ball, 2);

// Utilisation de Potion hors combat
player.party[0].currentHp = 5;
const useRes = useItemOutsideBattle(player, 'potion', 0);
assert.strictEqual(useRes.ok, true);
assert(player.party[0].currentHp > 5);
console.log('✓ Boutique, Sac hors combat, Pokémon suiveur, Pokédex et transferts PC validés');

console.log('\n--- 7. Test Réseau Multijoueur HubBridge (2 arguments) ---');
let sentTarget = null;
let sentPayload = null;
let msgListener = null;
const mockBridge = {
  send(to, m) {
    sentTarget = to;
    sentPayload = m;
  },
  on(ev, fn) {
    if (ev === 'msg') msgListener = fn;
  }
};
let remoteList = [];
const net = createAdventureNetwork({
  bridge: mockBridge,
  me: { id: 'p1', name: 'Red', color: '#ff0000' },
  onRemoteUpdate: (list) => { remoteList = list; }
});
net.broadcastPos(player);
assert.strictEqual(sentTarget, 'all');
assert.strictEqual(sentPayload.t, 'adv_pos');
assert.strictEqual(sentPayload.leadPokeId, player.party[0].id);

// Réception d'un message HubBridge ('msg', fromId, payload)
msgListener('p2', {
  t: 'adv_join',
  id: 'p2',
  name: 'Serena',
  color: '#3b82f6',
  avatar: 'green',
  x: 12,
  y: 15,
  dir: 'down',
  leadPokeId: 653
});
assert.strictEqual(remoteList.length, 1);
assert.strictEqual(remoteList[0].name, 'Serena');
assert.strictEqual(remoteList[0].leadPokeId, 653);
console.log('✓ Synchronisation multijoueur HubBridge et Pokémon suiveur distant validés');

console.log('\nTOUS LES TESTS DU MODE AVENTURE KALOS-SUD (MASTER EDITION) SONT AU VERT !');
