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
 * @param {Object} options { gen: 'all'|'kanto'|'hoenn', bots: 0|1 }
 */
export function createTournament(players, options = {}) {
  const genFilter = options.gen || 'all';
  const humanCount = players.length;

  // Détermination de la taille du bracket : 2, 4 ou 8
  // Si 2 humains dans le salon : duel direct 1v1 (Grande Finale immédiate, 0 bots !)
  // Si 3 ou 4 humains : tournoi à 4 (0 ou 1 bot pour compléter si 3 humains)
  // Si 5 ou 6 humains : tournoi à 8
  // Si solo (1 humain) : tournoi à 4 avec 3 bots (ou duel avec 1 bot si bots désactivés)
  let bracketSize = 2;
  if (humanCount >= 5) {
    bracketSize = 8;
  } else if (humanCount >= 3) {
    bracketSize = 4;
  } else if (humanCount === 2) {
    bracketSize = 2;
  } else {
    bracketSize = (options.bots === 0) ? 2 : 4;
  }

  // Humains d'abord (chacun reçoit son équipe aléatoire de 3 Pokémon)
  const humanParticipants = players.map(p => ({
    id: p.id,
    name: p.name,
    color: p.color || '#ff4b2b',
    bot: false,
    team: getRandomTeam(3, genFilter)
  }));

  // Bots ajoutés UNIQUEMENT si le bracket a besoin de participants supplémentaires
  const botParticipants = [];
  let botIdx = 0;
  const neededBots = Math.max(0, bracketSize - humanParticipants.length);
  for (let i = 0; i < neededBots; i++) {
    const botTemplate = BOT_TRAINERS[botIdx % BOT_TRAINERS.length];
    botIdx++;
    botParticipants.push({
      id: botTemplate.id,
      name: botTemplate.name,
      color: botTemplate.color,
      bot: true,
      team: getRandomTeam(3, genFilter)
    });
  }

  const participants = [...humanParticipants, ...botParticipants];

  // Construction des matchs du Tour 1 avec appariement intelligent
  const round1Matches = [];
  const matchCount = bracketSize / 2;

  if (bracketSize === 2) {
    // Duel direct : Grande Finale immédiate entre les 2 participants !
    round1Matches.push({
      id: 'm_r1_0',
      roundName: 'Grande Finale',
      matchIndex: 0,
      playerA: participants[0],
      playerB: participants[1],
      winner: null,
      status: 'pending',
      battle: null
    });
  } else if (bracketSize === 4) {
    let pA1, pA2, pB1, pB2;
    if (humanParticipants.length === 1) {
      // 1 humain + 3 bots : l'humain joue en premier dans le Match 0 !
      pA1 = humanParticipants[0];
      pA2 = botParticipants[0];
      pB1 = botParticipants[1];
      pB2 = botParticipants[2];
    } else if (humanParticipants.length === 2) {
      // 2 humains dans un bracket de 4 : chacun dans une demi pour se retrouver en finale
      pA1 = humanParticipants[0];
      pA2 = botParticipants[0];
      pB1 = humanParticipants[1];
      pB2 = botParticipants[1];
    } else if (humanParticipants.length === 3) {
      // 3 humains + 1 bot : deux humains s'affrontent, le 3e affronte le bot
      pA1 = humanParticipants[0];
      pA2 = humanParticipants[1];
      pB1 = humanParticipants[2];
      pB2 = botParticipants[0];
    } else {
      // 4 humains : 2 demi-finales 100% humaines sans aucun bot !
      pA1 = humanParticipants[0];
      pA2 = humanParticipants[1];
      pB1 = humanParticipants[2];
      pB2 = humanParticipants[3];
    }

    round1Matches.push({
      id: 'm_r1_0',
      roundName: 'Demi-Finale',
      matchIndex: 0,
      playerA: pA1,
      playerB: pA2,
      winner: null,
      status: 'pending',
      battle: null
    });
    round1Matches.push({
      id: 'm_r1_1',
      roundName: 'Demi-Finale',
      matchIndex: 1,
      playerA: pB1,
      playerB: pB2,
      winner: null,
      status: 'pending',
      battle: null
    });
  } else {
    // bracketSize === 8 : Quarts de finale
    const h = [...humanParticipants];
    const b = [...botParticipants];
    for (let i = 0; i < matchCount; i++) {
      const p1 = h.length > 0 ? h.shift() : b.shift();
      const p2 = h.length > 0 ? h.shift() : b.shift();
      round1Matches.push({
        id: `m_r1_${i}`,
        roundName: 'Quart de Finale',
        matchIndex: i,
        playerA: p1,
        playerB: p2,
        winner: null,
        status: 'pending',
        battle: null
      });
    }
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
