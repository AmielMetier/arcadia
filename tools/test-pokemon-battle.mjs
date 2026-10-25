// tools/test-pokemon-battle.mjs
// Test automatisé du moteur de combat et de tournoi Pokémon 3v3

import { getRandomTeam } from '../pokemon/engine/data.js';
import { createBattle, resolveTurn, forceSwitch } from '../pokemon/engine/battle.js';
import { chooseBotAction } from '../pokemon/engine/bot.js';
import { createTournament, startCurrentMatch, finishCurrentMatch } from '../pokemon/engine/tournament.js';

console.log('--- 1. Test génération d\'équipe ---');
const teamA = getRandomTeam(3);
const teamB = getRandomTeam(3);
if (teamA.length !== 3 || teamB.length !== 3) throw new Error('Équipes de taille invalide');
console.log(`✓ Équipe A: ${teamA.map(p => `${p.name} (${p.types.join('/')})`).join(', ')}`);
console.log(`✓ Équipe B: ${teamB.map(p => `${p.name} (${p.types.join('/')})`).join(', ')}`);

console.log('\n--- 2. Test combat complet entre 2 bots ---');
const battle = createBattle({
  trainerA: { id: 1, name: 'Sacha', color: '#ff4b2b', bot: true },
  trainerB: { id: 2, name: 'Régis', color: '#2b8cff', bot: true },
  teamA,
  teamB
});

let turnCount = 0;
while (battle.phase !== 'over' && turnCount < 80) {
  turnCount++;
  const actA = chooseBotAction(battle, 'A');
  const actB = chooseBotAction(battle, 'B');

  const { state } = resolveTurn(battle, actA, actB);
  Object.assign(battle, state);

  // Résolution des K.O. et remplacements forcés
  if (battle.phase === 'switch_forced_A' || battle.phase === 'switch_forced_both') {
    const swA = chooseBotAction(battle, 'A');
    if (swA && swA.type === 'switch') forceSwitch(battle, 'A', swA.targetIndex);
  }
  if (battle.phase === 'switch_forced_B' || battle.phase === 'switch_forced_both') {
    const swB = chooseBotAction(battle, 'B');
    if (swB && swB.type === 'switch') forceSwitch(battle, 'B', swB.targetIndex);
  }
}

if (!battle.winner) throw new Error('Combat non terminé après 80 tours');
console.log(`✓ Combat terminé en ${turnCount} tours ! Vainqueur: ${battle.winner === 'A' ? 'Sacha' : 'Régis'}`);

console.log('\n--- 3. Test tournoi 2 joueurs (Duel Direct 1v1 sans bots) ---');
const tourneyDuo = createTournament([
  { id: 10, name: 'Alice', color: '#ff4b2b' },
  { id: 11, name: 'Bob', color: '#2b8cff' }
]);
if (tourneyDuo.bracketSize !== 2) throw new Error('Taille de bracket duo incorrecte');
if (tourneyDuo.participants.filter(p => p.bot).length !== 0) throw new Error('Un duo ne doit avoir aucun bot');
console.log('✓ Tournoi 2 joueurs initialisé en Duel direct 1v1 (0 bots)');

startCurrentMatch(tourneyDuo);
if (tourneyDuo.phase !== 'battle') throw new Error('Match non démarré');
console.log('✓ Duel Alice vs Bob démarré avec succès');

finishCurrentMatch(tourneyDuo, 'A');
if (tourneyDuo.champion.name !== 'Alice') throw new Error('Champion incorrect');
console.log('✓ Duel terminé, Alice couronnée championne');

console.log('\n--- 4. Test tournoi 4 joueurs (0 bots) ---');
const tourney4 = createTournament([
  { id: 10, name: 'Alice', color: '#ff4b2b' },
  { id: 11, name: 'Bob', color: '#2b8cff' },
  { id: 12, name: 'Charlie', color: '#2fbf71' },
  { id: 13, name: 'David', color: '#ffd27a' }
]);
if (tourney4.bracketSize !== 4) throw new Error('Taille de bracket 4 joueurs incorrecte');
if (tourney4.participants.filter(p => p.bot).length !== 0) throw new Error('4 joueurs humains ne doivent avoir aucun bot');
console.log('✓ Tournoi 4 joueurs humains initialisé (0 bots, 2 demi-finales)');

console.log('\nTOUS LES TESTS DU MOTEUR POKÉMON SONT AU VERT !');
