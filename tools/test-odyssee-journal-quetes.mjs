// arcadia/tools/test-odyssee-journal-quetes.mjs
// Test unitaire du système de Journal des Quêtes et du Suivi d'Objectif (v3.63)

import assert from 'node:assert/strict';
import { getAllQuests, getTrackedQuest, setTrackedQuest, QUEST_CATEGORIES } from '../odyssee/js/core/questsData.js';

console.log('--- Test Journal des Quêtes & Suivi d\'Objectif ---');

// Mock Game
function makeGame(badgesCount = 0, flags = {}, party = []) {
  const badges = Array(8).fill(false);
  for (let i = 0; i < badgesCount; i++) badges[i] = true;
  return {
    state: {
      badges,
      flags,
      party,
      box: [],
      pokedex: {},
      trackedQuest: null,
    },
    badgeCount() {
      return this.state.badges.filter(Boolean).length;
    },
    locationName() {
      return 'Bourg Saule';
    },
  };
}

// 1. Catégories et registre initial
const g1 = makeGame(0);
const q1 = getAllQuests(g1);
console.log(`✓ Quêtes trouvées : ${q1.length} (attendu: 18)`);
assert.equal(q1.length, 18, 'Doit contenir exactement 18 quêtes');

const mainQuests = q1.filter((q) => q.cat === 'main');
const sideQuests = q1.filter((q) => q.cat === 'side');
const npcQuests = q1.filter((q) => q.cat === 'npc');

assert.equal(mainQuests.length, 2, '2 quêtes principales (Ligue + Éclipse)');
assert.equal(sideQuests.length, 8, '8 quêtes secondaires aventure');
assert.equal(npcQuests.length, 8, '8 missions habitants story');

// 2. Progression de la quête principale de la Ligue
const ligueQuest0 = q1.find((q) => q.id === 'ligue');
assert.equal(ligueQuest0.step, 1, 'Au début sans starter : étape 1 (Labo Saule)');
assert.equal(ligueQuest0.status, 'active');
assert.ok(ligueQuest0.destination, 'A une destination');
assert.ok(ligueQuest0.direction, 'A des indications');

const g1bis = makeGame(0, { starter: 1 });
const q1bis = getAllQuests(g1bis);
const ligueQuest0bis = q1bis.find((q) => q.id === 'ligue');
assert.equal(ligueQuest0bis.step, 2, 'Avec starter : étape 2 (Arène 1 Hector)');

const g2 = makeGame(4);
const q2 = getAllQuests(g2);
const ligueQuest4 = q2.find((q) => q.id === 'ligue');
assert.equal(ligueQuest4.step, 6, 'Avec 4 badges : étape 6 (Arène 5 Sibylle)');
assert.match(ligueQuest4.destination, /Mirage/);

const g3 = makeGame(8, { ligue: 1 });
const q3 = getAllQuests(g3);
const ligueQuest8 = q3.find((q) => q.id === 'ligue');
assert.equal(ligueQuest8.step, 10, 'Avec 8 badges et ligue : terminée');
assert.equal(ligueQuest8.status, 'done');

// 3. Quête secondaire ponyta
const gPonyta = makeGame(0, { 'Q:ponyta': 1 });
const qPonyta = getAllQuests(gPonyta).find((q) => q.id === 'ponyta');
assert.equal(qPonyta.status, 'active');
assert.equal(qPonyta.step, 1);
assert.match(qPonyta.destination, /Sylvebourg/);

const gPonytaDone = makeGame(0, { 'Q:ponyta': 'fin' });
const qPonytaDone = getAllQuests(gPonytaDone).find((q) => q.id === 'ponyta');
assert.equal(qPonytaDone.status, 'done');

// 4. Suivi d'objectif (Tracked Quest)
const gTrack = makeGame(0);
// Par défaut, aucune quête spécifiée => première quête active (ligue)
const defTracked = getTrackedQuest(gTrack);
assert.ok(defTracked, 'Une quête par défaut doit être suivie');
assert.equal(defTracked.id, 'ligue');

// Suivre explicitement une autre quête
setTrackedQuest(gTrack, 'ponyta');
assert.equal(gTrack.state.trackedQuest, 'ponyta');
const customTracked = getTrackedQuest(gTrack);
assert.equal(customTracked.id, 'ponyta');
assert.equal(customTracked.isTracked, true);

// Dé-suivre
setTrackedQuest(gTrack, null);
assert.equal(gTrack.state.trackedQuest, null);

console.log('✓ Tous les tests de quêtes et suivi ont validé avec succès !');
