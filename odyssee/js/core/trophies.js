// odyssee/js/core/trophies.js — Système de Journal des Trophées, Médailles B2W2,
// Historique Face-à-Face et Séries de Victoires (Win Streaks)

export const TROPHIES_CATALOG = [
  {
    id: 'pvp_first_win',
    title: 'Premier Sang',
    desc: 'Remporter votre tout premier duel en combat PvP.',
    tier: 'bronze',
    category: 'combat',
    reward: { item: 'rare-candy', count: 2, label: 'Super Bonbon ×2' },
    check: (st) => {
      const w = st.pvp?.totalWins || 0;
      return { current: Math.min(w, 1), max: 1, done: w >= 1 };
    }
  },
  {
    id: 'pvp_two_players',
    title: 'Premier Réseau',
    desc: 'Battre au moins 2 dresseurs différents en duel.',
    tier: 'bronze',
    category: 'reseau',
    reward: { item: 'hyper-potion', count: 3, label: 'Hyper Potion ×3' },
    check: (st) => {
      const beaten = Object.values(st.pvp?.players || {}).filter((p) => (p.wins || 0) >= 1).length;
      return { current: Math.min(beaten, 2), max: 2, done: beaten >= 2 };
    }
  },
  {
    id: 'pvp_five_same_player',
    title: 'Rival Éternel',
    desc: 'Battre 5 fois le même dresseur en duel.',
    tier: 'silver',
    category: 'rival',
    reward: { item: 'leftovers', count: 1, label: 'Restes ×1' },
    check: (st) => {
      const list = Object.values(st.pvp?.players || {}).map((p) => p.wins || 0);
      const m = list.length ? Math.max(...list) : 0;
      return { current: Math.min(m, 5), max: 5, done: m >= 5 };
    }
  },
  {
    id: 'pvp_ten_same_player',
    title: 'Némésis Suprême',
    desc: 'Battre 10 fois le même dresseur en duel.',
    tier: 'gold',
    category: 'rival',
    reward: { item: 'master-ball', count: 1, label: 'Master Ball ×1' },
    check: (st) => {
      const list = Object.values(st.pvp?.players || {}).map((p) => p.wins || 0);
      const m = list.length ? Math.max(...list) : 0;
      return { current: Math.min(m, 10), max: 10, done: m >= 10 };
    }
  },
  {
    id: 'pvp_streak_3',
    title: 'Étincelle Guerrière',
    desc: 'Aligner une série de 3 victoires consécutives sans défaite.',
    tier: 'bronze',
    category: 'streak',
    reward: { item: 'super-potion', count: 5, label: 'Super Potion ×5' },
    check: (st) => {
      const s = st.pvp?.bestStreak || 0;
      return { current: Math.min(s, 3), max: 3, done: s >= 3 };
    }
  },
  {
    id: 'pvp_streak_5',
    title: 'Flamme Ardente',
    desc: 'Aligner une série de 5 victoires consécutives sans défaite.',
    tier: 'silver',
    category: 'streak',
    reward: { item: 'life-orb', count: 1, label: 'Orbe Vie ×1' },
    check: (st) => {
      const s = st.pvp?.bestStreak || 0;
      return { current: Math.min(s, 5), max: 5, done: s >= 5 };
    }
  },
  {
    id: 'pvp_streak_10',
    title: 'Légende Invaincue',
    desc: 'Aligner une série mythique de 10 victoires consécutives sans aucune défaite !',
    tier: 'platinum',
    category: 'streak',
    reward: { item: 'rare-candy', count: 5, label: 'Super Bonbon ×5' },
    check: (st) => {
      const s = st.pvp?.bestStreak || 0;
      return { current: Math.min(s, 10), max: 10, done: s >= 10 };
    }
  },
  {
    id: 'pvp_five_players',
    title: 'Globe-Trotteur',
    desc: 'Battre 5 dresseurs différents en duel.',
    tier: 'silver',
    category: 'reseau',
    reward: { item: 'choice-band', count: 1, label: 'Bandeau Choix ×1' },
    check: (st) => {
      const beaten = Object.values(st.pvp?.players || {}).filter((p) => (p.wins || 0) >= 1).length;
      return { current: Math.min(beaten, 5), max: 5, done: beaten >= 5 };
    }
  },
  {
    id: 'pvp_ten_players',
    title: 'Grand Maître du Réseau',
    desc: 'Battre 10 dresseurs différents en duel.',
    tier: 'platinum',
    category: 'reseau',
    reward: { item: 'focus-sash', count: 2, label: 'Ceinture Force ×2' },
    check: (st) => {
      const beaten = Object.values(st.pvp?.players || {}).filter((p) => (p.wins || 0) >= 1).length;
      return { current: Math.min(beaten, 10), max: 10, done: beaten >= 10 };
    }
  },
  {
    id: 'pvp_ten_battles',
    title: 'Vétéran de l\'Arène',
    desc: 'Disputer au moins 10 combats PvP au total.',
    tier: 'bronze',
    category: 'combat',
    reward: { item: 'full-restore', count: 3, label: 'Guérison ×3' },
    check: (st) => {
      const tot = (st.pvp?.totalWins || 0) + (st.pvp?.totalLosses || 0) + (st.pvp?.totalDraws || 0);
      return { current: Math.min(tot, 10), max: 10, done: tot >= 10 };
    }
  },
  {
    id: 'pvp_twentyfive_wins',
    title: 'Champion de la Ligue',
    desc: 'Cumuler 25 victoires en combat PvP au total.',
    tier: 'gold',
    category: 'combat',
    reward: { item: 'rocky-helmet', count: 1, label: 'Casque Brut ×1' },
    check: (st) => {
      const w = st.pvp?.totalWins || 0;
      return { current: Math.min(w, 25), max: 25, done: w >= 25 };
    }
  },
  {
    id: 'pvp_fifty_wins',
    title: 'Seigneur des Duels',
    desc: 'Cumuler 50 victoires en combat PvP au total.',
    tier: 'platinum',
    category: 'combat',
    reward: { item: 'master-ball', count: 2, label: 'Master Ball ×2' },
    check: (st) => {
      const w = st.pvp?.totalWins || 0;
      return { current: Math.min(w, 50), max: 50, done: w >= 50 };
    }
  }
];

export const STREAK_RANKS = [
  { min: 0, title: 'Challenger', desc: 'En apprentissage', icon: 'medal_bronze', flame: 'none' },
  { min: 3, title: '🔥 En Série', desc: 'Série de 3 victoires', icon: 'medal_silver', flame: 'low' },
  { min: 5, title: '🔥🔥 Flamboyant', desc: 'Série de 5 victoires', icon: 'medal_gold', flame: 'medium' },
  { min: 10, title: '⚡ Foudre d\'Élite', desc: 'Série de 10 victoires', icon: 'medal_platinum', flame: 'high' },
  { min: 15, title: '👑 Légende Invaincue', desc: 'Record absolu du réseau', icon: 'streak_crown', flame: 'legend' }
];

export function getStreakRank(streak = 0, bestStreak = 0) {
  const eff = Math.max(streak, bestStreak);
  let rank = STREAK_RANKS[0];
  for (const r of STREAK_RANKS) {
    if (eff >= r.min) rank = r;
  }
  return { ...rank, currentStreak: streak, bestStreak };
}

/** Assure que st.pvp est correctement initialisé */
export function ensurePvpState(st) {
  if (!st) return null;
  st.pvp ||= {
    totalWins: 0,
    totalLosses: 0,
    totalDraws: 0,
    currentStreak: 0,
    bestStreak: 0,
    players: {},
    trophies: {}
  };
  st.pvp.totalWins ||= 0;
  st.pvp.totalLosses ||= 0;
  st.pvp.totalDraws ||= 0;
  st.pvp.currentStreak ||= 0;
  st.pvp.bestStreak ||= 0;
  st.pvp.players ||= {};
  st.pvp.trophies ||= {};
  return st.pvp;
}

/**
 * Enregistre le résultat d'un duel PvP contre un joueur.
 * @param {object} st État de sauvegarde du jeu (game.state)
 * @param {string} foeName Nom de l'adversaire
 * @param {'win'|'lose'|'tie'|'draw'} result Résultat du combat
 * @returns {{ newlyUnlocked: Array, streakChanged: boolean, rankChanged: boolean, rank: object }}
 */
export function recordPvpMatch(st, foeName, result) {
  ensurePvpState(st);
  const pvp = st.pvp;
  const name = String(foeName || 'Inconnu').trim();
  const oldRank = getStreakRank(pvp.currentStreak, pvp.bestStreak);

  // Initialisation de la fiche joueur adverse
  pvp.players[name] ||= {
    name,
    wins: 0,
    losses: 0,
    draws: 0,
    streakAgainst: 0,
    bestStreakAgainst: 0,
    lastResult: null,
    lastDate: null
  };
  const pRecord = pvp.players[name];

  if (result === 'win') {
    pvp.totalWins++;
    pvp.currentStreak++;
    if (pvp.currentStreak > pvp.bestStreak) {
      pvp.bestStreak = pvp.currentStreak;
    }
    pRecord.wins++;
    pRecord.streakAgainst = (pRecord.streakAgainst || 0) + 1;
    if (pRecord.streakAgainst > (pRecord.bestStreakAgainst || 0)) {
      pRecord.bestStreakAgainst = pRecord.streakAgainst;
    }
  } else if (result === 'lose') {
    pvp.totalLosses++;
    pvp.currentStreak = 0;
    pRecord.losses++;
    pRecord.streakAgainst = 0;
  } else {
    // Égalité
    pvp.totalDraws++;
    pRecord.draws = (pRecord.draws || 0) + 1;
  }

  pRecord.lastResult = result;
  pRecord.lastDate = Date.now();

  // Vérification des trophées débloqués
  const newlyUnlocked = [];
  for (const trophy of TROPHIES_CATALOG) {
    const userTrophy = pvp.trophies[trophy.id];
    if (!userTrophy || !userTrophy.unlocked) {
      const status = trophy.check(st);
      if (status.done) {
        pvp.trophies[trophy.id] = {
          unlocked: true,
          unlockedAt: Date.now(),
          claimed: false
        };
        newlyUnlocked.push(trophy);
      }
    }
  }

  const newRank = getStreakRank(pvp.currentStreak, pvp.bestStreak);
  const rankChanged = newRank.title !== oldRank.title;

  return {
    newlyUnlocked,
    streakChanged: result === 'win' || result === 'lose',
    rankChanged,
    rank: newRank,
    currentStreak: pvp.currentStreak,
    bestStreak: pvp.bestStreak
  };
}

/**
 * Réclame la récompense d'un trophée débloqué.
 * @param {object} st État de sauvegarde du jeu
 * @param {string} trophyId Identifiant du trophée
 * @returns {{ ok: boolean, message?: string, reward?: object }}
 */
export function claimTrophyReward(st, trophyId) {
  ensurePvpState(st);
  const trophy = TROPHIES_CATALOG.find((t) => t.id === trophyId);
  if (!trophy) return { ok: false, message: 'Trophée introuvable.' };

  const userTrophy = st.pvp.trophies[trophyId];
  if (!userTrophy || !userTrophy.unlocked) {
    return { ok: false, message: 'Ce trophée n\'est pas encore débloqué.' };
  }
  if (userTrophy.claimed) {
    return { ok: false, message: 'Récompense déjà réclamée.' };
  }

  // Distribution dans le sac
  st.bag ||= {};
  const it = trophy.reward.item;
  const count = trophy.reward.count || 1;
  st.bag[it] = (st.bag[it] || 0) + count;

  userTrophy.claimed = true;
  userTrophy.claimedAt = Date.now();

  return {
    ok: true,
    reward: trophy.reward,
    item: it,
    count,
    label: trophy.reward.label
  };
}

/**
 * Retourne le résumé complet des statistiques PvP et trophées.
 */
export function getPvpSummary(st) {
  ensurePvpState(st);
  const pvp = st.pvp;
  const totalMatches = pvp.totalWins + pvp.totalLosses + pvp.totalDraws;
  const winRate = totalMatches > 0 ? ((pvp.totalWins / totalMatches) * 100).toFixed(1) : '0.0';

  const playersList = Object.values(pvp.players).sort((a, b) => {
    const totA = a.wins + a.losses + (a.draws || 0);
    const totB = b.wins + b.losses + (b.draws || 0);
    return totB - totA || (b.lastDate || 0) - (a.lastDate || 0);
  });

  const unlockedCount = Object.values(pvp.trophies).filter((t) => t.unlocked).length;
  const claimedCount = Object.values(pvp.trophies).filter((t) => t.claimed).length;
  const claimableCount = unlockedCount - claimedCount;

  const rank = getStreakRank(pvp.currentStreak, pvp.bestStreak);

  return {
    totalWins: pvp.totalWins,
    totalLosses: pvp.totalLosses,
    totalDraws: pvp.totalDraws,
    totalMatches,
    winRate: `${winRate}%`,
    currentStreak: pvp.currentStreak,
    bestStreak: pvp.bestStreak,
    rank,
    playersCount: playersList.length,
    players: playersList,
    trophiesTotal: TROPHIES_CATALOG.length,
    unlockedCount,
    claimedCount,
    claimableCount
  };
}

/** Détermine le statut face à un adversaire donné */
export function getHeadToHeadStatus(record) {
  if (!record) return { label: 'Inconnu', cls: 'neutral' };
  if (record.wins > record.losses) {
    return { label: '👑 Domination', cls: 'domination', desc: `Vous menez face à ce dresseur (+${record.wins - record.losses})` };
  }
  if (record.wins === record.losses) {
    return { label: '⚖️ Égalité', cls: 'equality', desc: 'Score parfaitement équilibré' };
  }
  return { label: '⚔️ Revanche Requise', cls: 'revenge', desc: `Revanche à prendre (-${record.losses - record.wins})` };
}
