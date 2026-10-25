// pokemon/engine/tournament.js
// Gestion de l'arbre de tournoi à élimination directe (1v1 avec spectateurs)
// Gère de 1 à 6 joueurs avec ajout automatique de bots (Red, Blue, Cynthia, Pierre, etc.)

import { getRandomTeam } from './data.js';
import { createBattle } from './battle.js';

export const BOT_TRAINERS = [
  { id: 901, name: 'Red (Légende)', color: '#ff4b2b', bot: true },
  { id: 902, name: 'Blue (Rival)', color: '#2b8cff', bot: true },
  { id: 903, name: 'Cynthia (Maître)', color: '#ffd27a', bot: true },
  { id: 904, name: 'Peter (Dracologue)', color: '#e0479e', bot: true },
  { id: 905, name: 'Ondine (Azuria)', color: '#1fc7c1', bot: true },
  { id: 906, name: 'Pierre (Argenta)', color: '#8a4b2a', bot: true },
  { id: 907, name: 'Agatha (Conseil 4)', color: '#704170', bot: true },
];

/**
 * Initialise un tournoi à élimination directe
 * @param {Array} players Liste des joueurs humains [{ id, name, color }]
 * @param {Object} options { gen: 'all'|'kanto'|'hoenn' }
 */
export function createTournament(players, options = {}) {
  const genFilter = options.gen || 'all';
  const humanCount = players.length;

  // Détermination de la taille du bracket : 2, 4 ou 8
  let bracketSize = 2;
  if (humanCount > 4) {
    bracketSize = 8;
  } else if (humanCount > 2 || (humanCount <= 2 && options.bots !== 0)) {
    bracketSize = 4;
  }

  // Liste complète des participants (humains + bots pour compléter)
  const participants = players.map(p => ({
    id: p.id,
    name: p.name,
    color: p.color || '#ff4b2b',
    bot: false,
    team: getRandomTeam(3, genFilter)
  }));

  let botIdx = 0;
  while (participants.length < bracketSize) {
    const botTemplate = BOT_TRAINERS[botIdx % BOT_TRAINERS.length];
    botIdx++;
    participants.push({
      id: botTemplate.id,
      name: botTemplate.name,
      color: botTemplate.color,
      bot: true,
      team: getRandomTeam(3, genFilter)
    });
  }

  // Mélange pour le tirage au sort (en évitant si possible deux humains au round 1 si bots)
  const shuffled = [...participants].sort(() => Math.random() - 0.5);

  // Construction des matchs du Tour 1
  const round1Matches = [];
  const matchCount = bracketSize / 2;
  for (let i = 0; i < matchCount; i++) {
    const p1 = shuffled[i * 2];
    const p2 = shuffled[i * 2 + 1];
    round1Matches.push({
      id: `m_r1_${i}`,
      roundName: matchCount === 1 ? 'Finale' : matchCount === 2 ? 'Demi-Finale' : 'Quart de Finale',
      matchIndex: i,
      playerA: p1,
      playerB: p2,
      winner: null,
      status: 'pending', // 'pending', 'active', 'finished'
      battle: null
    });
  }

  const rounds = [round1Matches];
  // Préparation des rounds suivants vides
  let currentMatches = matchCount;
  while (currentMatches > 1) {
    currentMatches /= 2;
    const nextRound = [];
    for (let i = 0; i < currentMatches; i++) {
      nextRound.push({
        id: `m_r${rounds.length + 1}_${i}`,
        roundName: currentMatches === 1 ? 'Grande Finale' : 'Demi-Finale',
        matchIndex: i,
        playerA: null,
        playerB: null,
        winner: null,
        status: 'pending',
        battle: null
      });
    }
    rounds.push(nextRound);
  }

  return {
    bracketSize,
    participants,
    rounds,
    currentRoundIdx: 0,
    currentMatchIdx: 0,
    activeBattle: null,
    champion: null,
    podium: [],
    phase: 'bracket_preview' // 'bracket_preview', 'battle', 'match_summary', 'podium'
  };
}

/**
 * Lance le match courant dans le tournoi
 */
export function startCurrentMatch(tournament) {
  const round = tournament.rounds[tournament.currentRoundIdx];
  const match = round[tournament.currentMatchIdx];

  if (!match || !match.playerA || !match.playerB) return null;

  // Création d'une nouvelle bataille fraîche avec équipes remises à neuf
  const battle = createBattle({
    trainerA: match.playerA,
    trainerB: match.playerB,
    teamA: match.playerA.team.map(p => ({
      ...p,
      hp: p.maxHp,
      fainted: false,
      status: null,
      toxicTurns: 0,
      statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
    })),
    teamB: match.playerB.team.map(p => ({
      ...p,
      hp: p.maxHp,
      fainted: false,
      status: null,
      toxicTurns: 0,
      statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
    }))
  });

  match.status = 'active';
  match.battle = battle;
  tournament.activeBattle = battle;
  tournament.phase = 'battle';

  return battle;
}

/**
 * Valide la fin du match en cours et fait avancer le vainqueur dans l'arbre
 */
export function finishCurrentMatch(tournament, winnerSide) {
  const round = tournament.rounds[tournament.currentRoundIdx];
  const match = round[tournament.currentMatchIdx];

  const winner = winnerSide === 'A' ? match.playerA : match.playerB;
  const loser = winnerSide === 'A' ? match.playerB : match.playerA;

  match.status = 'finished';
  match.winner = winner;

  // Propagation au tour suivant
  const nextRoundIdx = tournament.currentRoundIdx + 1;
  if (nextRoundIdx < tournament.rounds.length) {
    const nextMatchIdx = Math.floor(tournament.currentMatchIdx / 2);
    const nextMatch = tournament.rounds[nextRoundIdx][nextMatchIdx];
    const isPlayerA = tournament.currentMatchIdx % 2 === 0;

    if (isPlayerA) nextMatch.playerA = winner;
    else nextMatch.playerB = winner;
  }

  // Vérifier s'il reste des matchs dans ce round
  if (tournament.currentMatchIdx + 1 < round.length) {
    tournament.currentMatchIdx++;
    tournament.phase = 'bracket_preview';
  } else if (nextRoundIdx < tournament.rounds.length) {
    // Passer au round suivant
    tournament.currentRoundIdx++;
    tournament.currentMatchIdx = 0;
    tournament.phase = 'bracket_preview';
  } else {
    // Le tournoi est terminé !
    tournament.champion = winner;
    tournament.podium = [winner, loser];
    tournament.phase = 'podium';
  }

  return { winner, loser, tournament };
}
