// pokemon/net/host.js
// Hôte autoritaire de Poké Duel : gère le tournoi, chronomètre les tours, fait jouer les bots et synchronise tous les joueurs.

import { createTournament, startCurrentMatch, finishCurrentMatch } from '../engine/tournament.js';
import { resolveTurn, forceSwitch, estimateTurnDuration } from '../engine/battle.js';
import { chooseBotAction } from '../engine/bot.js';

export function startHost({ bridge, solo, settings, me, onState, onSetup, onError }) {
  let tournament = null;
  let timerInterval = null;
  let turnEndsAt = 0;
  let pendingActions = { A: null, B: null };
  let reported = false;

  const timerSecs = Number(settings.timer) || 25;
  const genFilter = settings.gen || 'all';
  const difficulty = settings.level || 'normal';

  function getHumanPlayers() {
    if (solo) return [{ id: me.id, name: me.name, color: me.color }];
    if (bridge && Array.isArray(bridge.players) && bridge.players.length > 0) {
      const list = bridge.players.map(p => ({
        id: p.id,
        name: p.name || 'Dresseur',
        color: p.color || '#ff4b2b'
      }));
      // S'assurer que le joueur local est toujours dans la liste
      if (!list.some(p => String(p.id) === String(me.id))) {
        list.unshift({ id: me.id, name: me.name, color: me.color });
      }
      return list;
    }
    return [{ id: me.id, name: me.name, color: me.color }];
  }

  function broadcast(extraEvents = []) {
    if (!tournament) return;
    const pub = {
      phase: tournament.phase,
      bracketSize: tournament.bracketSize,
      rounds: tournament.rounds,
      currentRoundIdx: tournament.currentRoundIdx,
      currentMatchIdx: tournament.currentMatchIdx,
      champion: tournament.champion,
      podium: tournament.podium,
      battle: tournament.activeBattle,
      turnEndsAt,
      timerSecs,
      events: extraEvents,
      submittedA: !!pendingActions.A,
      submittedB: !!pendingActions.B
    };

    if (!solo && bridge) bridge.send('all', { t: 'st', s: pub, now: Date.now() });
    onState(pub, 0);

    if (tournament.phase === 'podium' && !reported) {
      reported = true;
      reportResults();
    }
  }

  function reportResults() {
    if (!bridge || !bridge.embedded || !bridge.report || !tournament || !tournament.champion) return;
    bridge.report({
      id: `pokemon-${Date.now()}`,
      mode: 'Tournoi 3v3',
      players: tournament.participants.map((p, idx) => ({
        id: p.bot ? null : p.id,
        name: p.name,
        color: p.color,
        bot: p.bot,
        rank: String(p.id) === String(tournament.champion.id) ? 1 : idx + 2,
        score: String(p.id) === String(tournament.champion.id) ? 300 : 100
      }))
    });
  }

  function startTurnTimer() {
    clearInterval(timerInterval);
    turnEndsAt = Date.now() + timerSecs * 1000;
    pendingActions = { A: null, B: null };

    const b = tournament.activeBattle;
    if (!b) return;

    // Si l'un des dresseurs est un bot, planifier sa réponse avec un temps de réflexion réaliste
    if (b.trainerA.bot) {
      setTimeout(() => {
        if (tournament && tournament.activeBattle === b && !pendingActions.A) {
          submitAction('A', chooseBotAction(b, 'A', difficulty));
        }
      }, 900 + Math.random() * 900);
    }
    if (b.trainerB.bot) {
      setTimeout(() => {
        if (tournament && tournament.activeBattle === b && !pendingActions.B) {
          submitAction('B', chooseBotAction(b, 'B', difficulty));
        }
      }, 1100 + Math.random() * 900);
    }

    timerInterval = setInterval(() => {
      const remaining = turnEndsAt - Date.now();
      if (remaining <= 0) {
        clearInterval(timerInterval);
        onTurnTimeout();
      }
    }, 500);
  }

  function onTurnTimeout() {
    const b = tournament.activeBattle;
    if (!b || b.phase === 'over') return;

    // Attribuer une action par défaut aux joueurs retardataires
    if (!pendingActions.A) {
      pendingActions.A = chooseBotAction(b, 'A', 'facile');
    }
    if (!pendingActions.B) {
      pendingActions.B = chooseBotAction(b, 'B', 'facile');
    }

    executeTurnResolution();
  }

  function submitAction(side, action) {
    if (!tournament || !tournament.activeBattle || tournament.activeBattle.phase === 'over') return;
    const b = tournament.activeBattle;

    // Cas d'un switch forcé après un K.O.
    if (b.phase === 'switch_forced_A' && side === 'A' && action.type === 'switch') {
      const ev = forceSwitch(b, 'A', action.targetIndex);
      if (ev) {
        broadcast([ev]);
        if (b.phase === 'choose') startTurnTimer();
      }
      return;
    }
    if (b.phase === 'switch_forced_B' && side === 'B' && action.type === 'switch') {
      const ev = forceSwitch(b, 'B', action.targetIndex);
      if (ev) {
        broadcast([ev]);
        if (b.phase === 'choose') startTurnTimer();
      }
      return;
    }
    if (b.phase === 'switch_forced_both') {
      if (side === 'A' && action.type === 'switch') forceSwitch(b, 'A', action.targetIndex);
      if (side === 'B' && action.type === 'switch') forceSwitch(b, 'B', action.targetIndex);
      broadcast();
      if (b.phase === 'choose') startTurnTimer();
      return;
    }

    if (b.phase !== 'choose') return;

    if (side === 'A') pendingActions.A = action;
    if (side === 'B') pendingActions.B = action;

    broadcast();

    // Si les deux joueurs ont validé leur coup
    if (pendingActions.A && pendingActions.B) {
      clearInterval(timerInterval);
      setTimeout(executeTurnResolution, 400);
    }
  }

  function executeTurnResolution() {
    if (!tournament || !tournament.activeBattle) return;
    const b = tournament.activeBattle;
    const actA = pendingActions.A;
    const actB = pendingActions.B;
    pendingActions = { A: null, B: null };

    const { state, events } = resolveTurn(b, actA, actB);
    tournament.activeBattle = state;

    broadcast(events);

    // Calcul du temps nécessaire pour dérouler toutes les animations du tour
    const animDuration = estimateTurnDuration(events);

    if (state.phase === 'over') {
      // Fin du combat : laisser le temps de voir la victoire avant l'arbre
      setTimeout(() => {
        finishCurrentMatch(tournament, state.winner);
        broadcast();
      }, animDuration + 2500);
    } else if (state.phase.startsWith('switch_forced')) {
      // Attendre la fin complète des animations du tour avant que les bots ne choisissent leur remplaçant
      setTimeout(() => {
        if ((state.phase === 'switch_forced_A' || state.phase === 'switch_forced_both') && state.trainerA.bot) {
          setTimeout(() => {
            const sw = chooseBotAction(state, 'A', difficulty);
            if (sw && sw.type === 'switch') forceSwitch(state, 'A', sw.targetIndex);
            broadcast();
            if (state.phase === 'choose') startTurnTimer();
          }, 800);
        }
        if ((state.phase === 'switch_forced_B' || state.phase === 'switch_forced_both') && state.trainerB.bot) {
          setTimeout(() => {
            const sw = chooseBotAction(state, 'B', difficulty);
            if (sw && sw.type === 'switch') forceSwitch(state, 'B', sw.targetIndex);
            broadcast();
            if (state.phase === 'choose') startTurnTimer();
          }, 1000);
        }
      }, animDuration);
    } else {
      // Démarrer le chronomètre du prochain tour UNIQUEMENT après la fin des animations
      setTimeout(() => {
        startTurnTimer();
      }, animDuration);
    }
  }

  function startMatch() {
    if (!tournament) return;
    const battle = startCurrentMatch(tournament);
    if (!battle) return;
    broadcast();
    startTurnTimer();
  }

  function startNewTournament() {
    reported = false;
    const humans = getHumanPlayers();
    tournament = createTournament(humans, {
      gen: genFilter,
      bots: settings.bots !== undefined ? Number(settings.bots) : 1
    });
    broadcast();
  }

  if (!solo && bridge) {
    // Mettre à jour l'arbre de tournoi dynamiquement si des joueurs rejoignent avant le match 1
    bridge.on('roster', () => {
      if (!tournament) return;
      if (tournament.phase === 'bracket_preview' && tournament.currentRoundIdx === 0 && tournament.currentMatchIdx === 0) {
        const currentHumanIds = tournament.participants
          .filter(p => !p.bot)
          .map(p => String(p.id))
          .sort()
          .join(',');
        const newHumans = getHumanPlayers();
        const newHumanIds = newHumans
          .map(p => String(p.id))
          .sort()
          .join(',');

        if (currentHumanIds !== newHumanIds) {
          startNewTournament();
        }
      }
    });

    // Écoute des messages réseau envoyés par les invités
    bridge.on('msg', (from, m) => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'action' && tournament && tournament.activeBattle) {
        const b = tournament.activeBattle;
        if (String(b.trainerA.id) === String(from)) submitAction('A', m.action);
        else if (String(b.trainerB.id) === String(from)) submitAction('B', m.action);
      } else if (m.t === 'start_match') {
        startMatch();
      } else if (m.t === 'restart') {
        startNewTournament();
      } else if (m.t === 'sync') {
        broadcast();
      }
    });
  }

  // Initialisation du tournoi
  startNewTournament();

  return {
    startMatch,
    restart: startNewTournament,
    submitAction(action) {
      if (!tournament || !tournament.activeBattle) return;
      const b = tournament.activeBattle;
      if (String(b.trainerA.id) === String(me.id)) submitAction('A', action);
      else if (String(b.trainerB.id) === String(me.id)) submitAction('B', action);
    }
  };
}
