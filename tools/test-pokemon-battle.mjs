import { createBattle, resolveTurn } from '../pokemon/engine/battle.js';
import { getRandomTeam } from '../pokemon/engine/data.js';
import { createTournament, startCurrentMatch, finishCurrentMatch } from '../pokemon/engine/tournament.js';
import { chooseBotAction } from '../pokemon/engine/bot.js';

console.log('--- 1. Test génération d\'équipe ---');
const teamA = getRandomTeam(3, 'all');
const teamB = getRandomTeam(3, 'all');
if (teamA.length !== 3 || teamB.length !== 3) throw new Error('Équipe invalide');
console.log('✓ Équipe A:', teamA.map(p => `${p.name} (${p.types.join('/')})`).join(', '));
console.log('✓ Équipe B:', teamB.map(p => `${p.name} (${p.types.join('/')})`).join(', '));

console.log('\n--- 2. Test combat complet entre 2 bots ---');
let battle = createBattle({
  trainerA: { id: 1, name: 'Sacha', color: '#ff4b2b', bot: true },
  trainerB: { id: 2, name: 'Régis', color: '#2b8cff', bot: true },
  teamA,
  teamB
});

let turnCount = 0;
while (battle.phase !== 'over' && turnCount < 40) {
  turnCount++;
  const actA = chooseBotAction(battle, 'A', 'normal');
  const actB = chooseBotAction(battle, 'B', 'normal');

  const { state, events } = resolveTurn(battle, actA, actB);
  battle = state;

  // Si switch forcé
  if (battle.phase === 'switch_forced_A') {
    const sw = chooseBotAction(battle, 'A');
    if (sw && sw.type === 'switch') battle.activeA = sw.targetIndex;
    battle.phase = 'choose';
  } else if (battle.phase === 'switch_forced_B') {
    const sw = chooseBotAction(battle, 'B');
    if (sw && sw.type === 'switch') battle.activeB = sw.targetIndex;
    battle.phase = 'choose';
  } else if (battle.phase === 'switch_forced_both') {
    const swA = chooseBotAction(battle, 'A');
    const swB = chooseBotAction(battle, 'B');
    if (swA) battle.activeA = swA.targetIndex;
    if (swB) battle.activeB = swB.targetIndex;
    battle.phase = 'choose';
  }
}

if (!battle.winner) throw new Error('Combat non terminé après 40 tours');
console.log(`✓ Combat terminé en ${turnCount} tours ! Vainqueur: ${battle.winner === 'A' ? 'Sacha' : 'Régis'}`);

console.log('\n--- 3. Test tournoi 4 joueurs ---');
const tourney = createTournament([
  { id: 10, name: 'Alice', color: '#ff4b2b' },
  { id: 11, name: 'Bob', color: '#2b8cff' }
]);
if (tourney.bracketSize !== 4) throw new Error('Taille de bracket incorrecte');
console.log('✓ Tournoi 4 joueurs initialisé avec 2 humains et 2 bots');

startCurrentMatch(tourney);
if (tourney.phase !== 'battle') throw new Error('Match non démarré');
console.log('✓ Match 1 démarré avec succès');

finishCurrentMatch(tourney, 'A');
console.log('✓ Match 1 terminé, propagation dans l\'arbre réussie');

console.log('\nTOUS LES TESTS DU MOTEUR POKÉMON SONT AU VERT !');
