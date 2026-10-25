// pokemon/net/host.js
// Hôte autoritaire de Poké Duel : gère le tournoi, chronomètre les tours, fait jouer les bots et synchronise tous les joueurs.

import { createTournament, startCurrentMatch, finishCurrentMatch } from '../engine/tournament.js';
import { resolveTurn, forceSwitch } from '../engine/battle.js';
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
    const list = bridge.players.filter(p => p.id === me.id || bridge.readyMap[p.id] === 'pokemon');
    return list.length ? list : [{ id: me.id, name: me.name, color: me.color }];
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

    if (!solo) bridge.send('all', { t: 'st', s: pub, now: Date.now() });
    onState(pub, 0);

    if (tournament.phase === 'podium' && !reported) {
      reported = true;
      reportResults();
    }
  }

  function reportResults() {
    if (!bridge.embedded || !bridge.report || !tournament || !tournament.champion) return;
    bridge.report({
      id: `pokemon-${Date.now()}`,
      mode: 'Tournoi 3v3',
      players: tournament.participants.map((p, idx) => ({
        id: p.bot ? null : p.id,
        name: p.name,
        color: p.color,
        bot: p.bot,
        rank: p.id === tournament.champion.id ? 1 : idx + 2,
        score: p.id === tournament.champion.id ? 300 : 100
      }))
    });
  }

  function startTurnTimer() {
    clearInterval(timerInterval);
    turnEndsAt = Date.now() + timerSecs * 1000;
    pendingActions = { A: null, B: null };

    const b = tournament.activeBattle;
    if (!b) return;

    // Si l'un des dresseurs est un bot, planifier sa réponse
    if (b.trainerA.bot) {
      setTimeout(() => {
        if (tournament && tournament.activeBattle === b && !pendingActions.A) {
          submitAction('A', chooseBotAction(b, 'A', difficulty));
        }
      }, 700 + Math.random() * 800);
    }
    if (b.trainerB.bot) {
      setTimeout(() => {
        if (tournament && tournament.activeBattle === b && !pendingActions.B) {
          submitAction('B', chooseBotAction(b, 'B', difficulty));
        }
      }, 900 + Math.random() * 800);
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

    if (state.phase === 'over') {
      // Fin du combat !
      setTimeout(() => {
        finishCurrentMatch(tournament, state.winner);
        broadcast();
      }, 3500);
    } else if (state.phase.startsWith('switch_forced')) {
      // Si un bot doit forcer son switch
      if ((state.phase === 'switch_forced_A' || state.phase === 'switch_forced_both') && state.trainerA.bot) {
        setTimeout(() => {
          const sw = chooseBotAction(state, 'A', difficulty);
          if (sw && sw.type === 'switch') forceSwitch(state, 'A', sw.targetIndex);
          broadcast();
          if (state.phase === 'choose') startTurnTimer();
        }, 1200);
      }
      if ((state.phase === 'switch_forced_B' || state.phase === 'switch_forced_both') && state.trainerB.bot) {
        setTimeout(() => {
          const sw = chooseBotAction(state, 'B', difficulty);
          if (sw && sw.type === 'switch') forceSwitch(state, 'B', sw.targetIndex);
          broadcast();
          if (state.phase === 'choose') startTurnTimer();
        }, 1400);
      }
    } else {
      startTurnTimer();
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

  // Écoute des messages réseau envoyés par les invités
  bridge.on('msg', (from, m) => {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'action' && tournament && tournament.activeBattle) {
      const b = tournament.activeBattle;
      if (b.trainerA.id === from) submitAction('A', m.action);
      else if (b.trainerB.id === from) submitAction('B', m.action);
    } else if (m.t === 'start_match' && from === me.id) {
      startMatch();
    } else if (m.t === 'restart' && from === me.id) {
      startNewTournament();
    }
  });

  // Initialisation du tournoi
  startNewTournament();

  return {
    startMatch,
    restart: startNewTournament,
    submitAction(action) {
      if (!tournament || !tournament.activeBattle) return;
      const b = tournament.activeBattle;
      if (b.trainerA.id === me.id) submitAction('A', action);
      else if (b.trainerB.id === me.id) submitAction('B', action);
    }
  };
}
