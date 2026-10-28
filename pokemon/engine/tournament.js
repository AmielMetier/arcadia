// pokemon/engine/tournament.js
// Tournoi à élimination directe de Poké Duel (sans DOM, testable sous Node).
//
// Déroulé : draft (chaque dresseur garde 3 Pokémon parmi 6 proposés) → arbre tiré au sort →
// pour chaque match : aperçu des deux équipes et choix du Pokémon de tête → combat → résumé.
// La finale se joue au meilleur des 3 manches (réglage), les autres matchs en une manche.
// Les matchs bot contre bot sont simulés d'un coup ; un dresseur qui quitte perd par forfait.
//
// L'état est un objet JSON simple (diffusé tel quel aux invités, et repris si l'hôte change).
// Les équipes sont stockées en numéros de Pokédex ; les Pokémon de combat sont recréés à neuf à chaque manche.

import { POKEMON_ROSTER, getPokemonById, createActivePokemon } from './data.js';
import { createBattle, resolveTurn, forceSwitch } from './battle.js';
import { chooseBotAction } from './bot.js';
import { MOVES } from './moves.js';
import { TYPES, getEffectiveness } from './types.js';

export const OFFER_SIZE = 6;
export const TEAM_SIZE = 3;

export const BOT_TRAINERS = [
  { id: 901, name: 'Red', title: 'Légende', color: '#ff4b2b' },
  { id: 902, name: 'Blue', title: 'Rival', color: '#2b8cff' },
  { id: 903, name: 'Cynthia', title: 'Maître', color: '#ffd27a' },
  { id: 904, name: 'Peter', title: 'Dracologue', color: '#e0479e' },
  { id: 905, name: 'Ondine', title: 'Azuria', color: '#1fc7c1' },
  { id: 906, name: 'Pierre', title: 'Argenta', color: '#c08552' },
  { id: 907, name: 'Agatha', title: 'Conseil 4', color: '#a466c9' },
];

const TYPE_KEYS = Object.keys(TYPES);

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const same = (a, b) => a != null && b != null && String(a) === String(b);

export function getParticipant(t, pid) {
  return t.participants.find((p) => same(p.id, pid)) || null;
}

export function allMatches(t) {
  return t.rounds.flat();
}

export function getMatch(t, matchId) {
  return allMatches(t).find((m) => m.id === matchId) || null;
}

export function currentMatch(t) {
  return t.cur ? getMatch(t, t.cur) : null;
}

/** Côté ('A' | 'B') d'un dresseur dans un match, ou null s'il n'y joue pas. */
export function sideOf(match, pid) {
  if (!match) return null;
  if (same(match.a, pid)) return 'A';
  if (same(match.b, pid)) return 'B';
  return null;
}

export function winsNeeded(match) {
  return Math.ceil((match.bestOf || 1) / 2);
}

function roundName(matchesInRound) {
  if (matchesInRound === 1) return 'Finale';
  if (matchesInRound === 2) return 'Demi-finales';
  return 'Quarts de finale';
}

function poolFor(gen) {
  if (gen === 'kanto') return POKEMON_ROSTER.filter((p) => p.gen === 1);
  if (gen === 'hoenn') return POKEMON_ROSTER.filter((p) => p.gen === 2 || p.gen === 3);
  return [...POKEMON_ROSTER];
}

export function attackTypes(base) {
  return (base.cleanMoves || [])
    .map((id) => MOVES[id])
    .filter((m) => m && m.power > 0)
    .map((m) => m.type);
}

export function statTotal(base) {
  const s = base.stats;
  return s.hp + s.atk + s.def + s.spa + s.spd + s.spe;
}

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------

/**
 * Prépare `count` offres de 6 Pokémon. Une offre ne contient jamais deux fois le même Pokémon,
 * ni plus de deux Pokémon du même type principal ; les offres se recoupent le moins possible.
 */
export function makeOffers(count, gen = 'all', rng = Math.random) {
  const pool = poolFor(gen);
  let bag = shuffle(pool, rng);
  const offers = [];
  for (let k = 0; k < count; k++) {
    const offer = [];
    const typeCount = {};
    const fill = (strict) => {
      let i = 0;
      while (offer.length < OFFER_SIZE && i < bag.length) {
        const base = bag[i];
        const t0 = base.types[0];
        if (offer.includes(base.id) || (strict && (typeCount[t0] || 0) >= 2)) { i++; continue; }
        offer.push(base.id);
        typeCount[t0] = (typeCount[t0] || 0) + 1;
        bag.splice(i, 1);
      }
    };
    fill(true);
    if (offer.length < OFFER_SIZE) {
      // Sac épuisé : on repart du roster complet (des offres pourront alors se recouper)
      bag = shuffle(pool.filter((p) => !offer.includes(p.id)), rng);
      fill(true);
    }
    if (offer.length < OFFER_SIZE) fill(false);
    offers.push(offer);
  }
  return offers;
}

/** Note d'un trio : puissance brute, variété des types, couverture offensive, faiblesses communes. */
export function rateTeam(ids) {
  const bases = ids.map(getPokemonById).filter(Boolean);
  const total = bases.reduce((n, b) => n + statTotal(b), 0) / 60;
  const types = new Set(bases.flatMap((b) => b.types));
  const mTypes = [...new Set(bases.flatMap(attackTypes))];
  let coverage = 0;
  for (const def of TYPE_KEYS) {
    if (mTypes.some((mt) => getEffectiveness(mt, [def]) >= 2)) coverage++;
  }
  let shared = 0;
  for (const att of TYPE_KEYS) {
    if (bases.length && bases.filter((b) => getEffectiveness(att, b.types) >= 2).length >= 2) shared++;
  }
  return total + types.size * 4 + coverage * 3 - shared * 5;
}

/** Choisit les 3 meilleurs Pokémon d'une offre (pour les bots et les retardataires). */
export function autoDraft(offer) {
  let best = null;
  let bestScore = -Infinity;
  for (let i = 0; i < offer.length; i++) {
    for (let j = i + 1; j < offer.length; j++) {
      for (let k = j + 1; k < offer.length; k++) {
        const trio = [offer[i], offer[j], offer[k]];
        const sc = rateTeam(trio);
        if (sc > bestScore) { bestScore = sc; best = trio; }
      }
    }
  }
  return best || offer.slice(0, TEAM_SIZE);
}

/** Valide la sélection d'un dresseur. Retourne false si elle est invalide. */
export function submitDraft(t, pid, picks) {
  if (t.phase !== 'draft') return false;
  const p = getParticipant(t, pid);
  if (!p || p.bot || !Array.isArray(picks)) return false;
  const ids = [...new Set(picks.map(Number))];
  if (ids.length !== TEAM_SIZE || !ids.every((id) => p.offer.includes(id))) return false;
  p.team = ids;
  return true;
}

export function draftComplete(t) {
  return t.participants.every((p) => Array.isArray(p.team) && p.team.length === TEAM_SIZE);
}

/** Fin du draft : complète les équipes manquantes, puis règle exemptions, forfaits et matchs de bots. */
export function closeDraft(t, opts = {}) {
  for (const p of t.participants) {
    if (!p.team || p.team.length !== TEAM_SIZE) {
      p.team = autoDraft(p.offer);
      p.autoDrafted = true;
    }
  }
  t.phase = 'bracket';
  return resolveAutomatic(t, opts);
}

// ---------------------------------------------------------------------------
// Création du tournoi
// ---------------------------------------------------------------------------

/**
 * @param {Array} players dresseurs humains [{ id, name, color }]
 * @param {Object} options { gen, bots: 0|1, finalBestOf: 1|3, rng }
 */
export function createTournament(players, options = {}) {
  const rng = options.rng || Math.random;
  const gen = options.gen || 'all';
  const botsAllowed = options.bots === undefined ? true : !!Number(options.bots);
  const finalBestOf = Number(options.finalBestOf) === 1 ? 1 : 3;
  const n = Math.max(1, players.length);

  // Taille de l'arbre. Sans bots, les places vides deviennent des exemptions (qualifié d'office).
  let size;
  if (n >= 5) size = 8;
  else if (n >= 3) size = 4;
  else size = botsAllowed ? 4 : 2; // en solo sans bots, il faut quand même un adversaire : un bot

  const humans = shuffle(players, rng).map((p) => ({
    id: p.id,
    name: p.name || 'Dresseur',
    color: p.color || '#ff4b2b',
    bot: false,
  }));

  const needBots = n === 1 ? size - 1 : (botsAllowed ? size - humans.length : 0);
  const bots = shuffle(BOT_TRAINERS, rng).slice(0, Math.max(0, needBots)).map((b) => ({
    id: b.id, name: b.name, title: b.title, color: b.color, bot: true,
  }));

  const participants = [...humans, ...bots];
  const offers = makeOffers(participants.length, gen, rng);
  participants.forEach((p, i) => {
    p.offer = offers[i];
    p.team = p.bot ? autoDraft(offers[i]) : null;
    p.gone = false;
    p.stats = { matchW: 0, gameW: 0, gameL: 0, ko: 0, lost: 0 };
  });

  // Placement : chaque match reçoit d'abord un humain (pas de bot contre bot tant qu'il reste
  // des humains à placer), puis on complète avec les bots — ou des exemptions sans bots.
  const k = size / 2;
  const slots = new Array(size).fill(null);
  const hq = [...humans];
  for (let i = 0; i < k && hq.length; i++) slots[2 * i] = hq.shift().id;
  for (let i = 0; i < k && hq.length; i++) slots[2 * i + 1] = hq.shift().id;
  const bq = [...bots];
  for (let s = 0; s < size; s++) if (slots[s] === null && bq.length) slots[s] = bq.shift().id;

  // Ordre des matchs et côtés tirés au sort
  let pairs = [];
  for (let i = 0; i < k; i++) {
    const pair = [slots[2 * i], slots[2 * i + 1]];
    pairs.push(rng() < 0.5 ? pair : [pair[1], pair[0]]);
  }
  pairs = shuffle(pairs, rng);

  const rounds = [];
  let count = k;
  let r = 0;
  for (;;) {
    const name = roundName(count);
    const round = [];
    for (let i = 0; i < count; i++) {
      round.push({
        id: `r${r}m${i}`,
        r, i,
        name,
        bestOf: count === 1 ? finalBestOf : 1,
        a: r === 0 ? pairs[i][0] : null,
        b: r === 0 ? pairs[i][1] : null,
        scoreA: 0,
        scoreB: 0,
        games: [],
        winner: null,
        status: 'pending', // 'pending' | 'live' | 'done'
        how: null,         // 'play' | 'sim' | 'bye' | 'forfeit'
      });
    }
    rounds.push(round);
    if (count === 1) break;
    count /= 2;
    r++;
  }

  return {
    v: 2,
    gen,
    size,
    finalBestOf,
    participants,
    rounds,
    phase: 'draft',  // 'draft' | 'bracket' | 'preview' | 'battle' | 'summary' | 'podium'
    cur: null,       // id du match en cours
    gameNo: 0,       // manche en cours du match (1, 2, 3)
    lead: { A: null, B: null },
    ready: { A: false, B: false },
    last: null,      // résumé de la dernière manche jouée
    recent: [],      // matchs réglés automatiquement depuis le dernier écran d'arbre
    mons: {},        // statistiques par Pokémon : { [pid]: { [dex]: { ko, fainted, games } } }
    champion: null,
    standings: [],
  };
}

// ---------------------------------------------------------------------------
// Avancement de l'arbre
// ---------------------------------------------------------------------------

function propagate(t, match) {
  const next = t.rounds[match.r + 1];
  if (!next) return;
  const nm = next[Math.floor(match.i / 2)];
  if (match.i % 2 === 0) nm.a = match.winner;
  else nm.b = match.winner;
}

function finishMatch(t, match, winnerPid, how) {
  match.status = 'done';
  match.winner = winnerPid;
  match.how = match.how === 'sim' ? 'sim' : how;
  const w = getParticipant(t, winnerPid);
  if (w && how !== 'bye') w.stats.matchW++;
  propagate(t, match);
  if (!t.rounds[match.r + 1]) {
    t.champion = winnerPid;
    t.standings = computeStandings(t);
  }
}

export function isOver(t) {
  return t.champion != null;
}

function prevDone(t, m, slot) {
  const prev = t.rounds[m.r - 1];
  if (!prev) return true;
  const pm = prev[m.i * 2 + slot];
  return !pm || pm.status === 'done';
}

/**
 * Règle tout ce qui n'a pas besoin d'être joué : exemptions, forfaits (dresseur parti)
 * et matchs bot contre bot (simulés). Retourne la liste des matchs réglés.
 */
export function resolveAutomatic(t, opts = {}) {
  const done = [];
  let progressed = true;
  while (progressed && !isOver(t)) {
    progressed = false;
    for (const m of allMatches(t)) {
      if (m.status !== 'pending') continue;
      if (!prevDone(t, m, 0) || !prevDone(t, m, 1)) continue;
      if (m.a == null || m.b == null) {
        const solo = m.a ?? m.b;
        if (solo == null) { m.status = 'done'; m.how = 'bye'; propagate(t, m); }
        else finishMatch(t, m, solo, 'bye');
        done.push(m.id);
        progressed = true;
        continue;
      }
      const A = getParticipant(t, m.a);
      const B = getParticipant(t, m.b);
      if (A.gone || B.gone) {
        finishMatch(t, m, A.gone && !B.gone ? m.b : m.a, 'forfeit');
        done.push(m.id);
        progressed = true;
        continue;
      }
      if (A.bot && B.bot) {
        simulateMatch(t, m, opts.difficulty || 'normal');
        done.push(m.id);
        progressed = true;
      }
    }
  }
  t.recent = [...(t.recent || []), ...done];
  return done;
}

/** Prochain match à jouer par des humains (les deux places sont connues). */
export function nextPlayableMatch(t) {
  for (const m of allMatches(t)) {
    if (m.status !== 'done' && m.a != null && m.b != null) return m;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Aperçu d'équipe et choix du Pokémon de tête
// ---------------------------------------------------------------------------

/** Pokémon de tête conseillé : celui qui s'en sort le mieux face à l'équipe adverse. */
export function chooseLead(teamIds, oppIds) {
  const opp = oppIds.map(getPokemonById).filter(Boolean);
  let best = 0;
  let bestScore = -Infinity;
  teamIds.forEach((id, idx) => {
    const me = getPokemonById(id);
    if (!me) return;
    const mt = attackTypes(me);
    let score = me.stats.spe / 40;
    for (const o of opp) {
      const att = Math.max(1, ...mt.map((ty) => getEffectiveness(ty, o.types)));
      const def = Math.max(...o.types.map((ty) => getEffectiveness(ty, me.types)));
      score += att - def;
    }
    if (score > bestScore) { bestScore = score; best = idx; }
  });
  return best;
}

/** Ouvre l'aperçu de la manche suivante du match. */
export function openPreview(t, match) {
  match.status = 'live';
  t.cur = match.id;
  t.phase = 'preview';
  t.gameNo = match.games.filter((g) => g.winner).length + 1;
  t.lead = { A: null, B: null };
  t.ready = { A: false, B: false };
  const A = getParticipant(t, match.a);
  const B = getParticipant(t, match.b);
  if (A.bot) { t.lead.A = chooseLead(A.team, B.team); t.ready.A = true; }
  if (B.bot) { t.lead.B = chooseLead(B.team, A.team); t.ready.B = true; }
}

export function setLead(t, side, idx) {
  if (t.phase !== 'preview' || !['A', 'B'].includes(side)) return false;
  const i = Number(idx);
  if (!(i >= 0 && i < TEAM_SIZE)) return false;
  t.lead[side] = i;
  return true;
}

export function setReady(t, side, leadIdx) {
  if (t.phase !== 'preview' || !['A', 'B'].includes(side)) return false;
  if (leadIdx != null) setLead(t, side, leadIdx);
  t.ready[side] = true;
  return true;
}

function teamFor(ids, leadIdx) {
  const order = [...ids];
  const li = leadIdx >= 0 && leadIdx < order.length ? leadIdx : 0;
  const [lead] = order.splice(li, 1);
  order.unshift(lead);
  return order.map((id) => createActivePokemon(getPokemonById(id)));
}

/** Crée le combat de la manche en cours (équipes remises à neuf, Pokémon de tête en premier). */
export function buildBattle(t, match) {
  const A = getParticipant(t, match.a);
  const B = getParticipant(t, match.b);
  if (t.lead.A == null) t.lead.A = chooseLead(A.team, B.team);
  if (t.lead.B == null) t.lead.B = chooseLead(B.team, A.team);
  const battle = createBattle({
    trainerA: A,
    trainerB: B,
    teamA: teamFor(A.team, t.lead.A),
    teamB: teamFor(B.team, t.lead.B),
  });
  t.phase = 'battle';
  return battle;
}

/**
 * K.O. attribués pendant un tour : chaque Pokémon tombé est crédité au Pokémon actif d'en face.
 * Retourne [{ side, dex }] où side est le camp qui marque.
 */
export function koCredits(battle, events) {
  const out = [];
  for (const ev of events || []) {
    if (ev.type !== 'faint') continue;
    const scorer = ev.side === 'A' ? 'B' : 'A';
    const team = scorer === 'A' ? battle.teamA : battle.teamB;
    const act = team[scorer === 'A' ? battle.activeA : battle.activeB];
    out.push({ side: scorer, dex: act ? act.id : null });
  }
  return out;
}

function monStat(t, pid, dex) {
  const key = String(pid);
  t.mons[key] = t.mons[key] || {};
  t.mons[key][dex] = t.mons[key][dex] || { ko: 0, fainted: 0, games: 0 };
  return t.mons[key][dex];
}

/**
 * Enregistre la fin d'une manche. `credits` = liste cumulée des K.O. de la manche.
 * Une manche nulle n'est pas comptée (elle se rejoue).
 */
export function recordGame(t, match, battle, credits = []) {
  const winner = battle.winner === 'A' || battle.winner === 'B' ? battle.winner : null;
  const A = getParticipant(t, match.a);
  const B = getParticipant(t, match.b);
  const snap = (team) => team.map((p) => ({ dex: p.id, hp: p.hp, maxHp: p.maxHp, fainted: !!p.fainted }));
  const koBy = { A: {}, B: {} };
  for (const c of credits) if (c.dex != null) koBy[c.side][c.dex] = (koBy[c.side][c.dex] || 0) + 1;

  const game = {
    no: match.games.length + 1,
    winner,
    turns: battle.turn || 1,
    teamA: snap(battle.teamA),
    teamB: snap(battle.teamB),
    koBy,
  };
  match.games.push(game);

  if (winner) {
    if (winner === 'A') match.scoreA++;
    else match.scoreB++;
    (winner === 'A' ? A : B).stats.gameW++;
    (winner === 'A' ? B : A).stats.gameL++;
  }
  for (const [side, P, team] of [['A', A, battle.teamA], ['B', B, battle.teamB]]) {
    for (const p of team) {
      const s = monStat(t, P.id, p.id);
      s.games++;
      if (p.fainted) { s.fainted++; P.stats.lost++; }
      const k = koBy[side][p.id] || 0;
      s.ko += k;
      P.stats.ko += k;
    }
  }

  const need = winsNeeded(match);
  const matchOver = match.scoreA >= need || match.scoreB >= need;
  t.last = {
    matchId: match.id,
    game: game.no,
    winner,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    matchOver,
  };
  if (matchOver) finishMatch(t, match, match.scoreA > match.scoreB ? match.a : match.b, 'play');
  return { decided: !!winner, matchOver };
}

/** Un dresseur quitte la partie : il perd son match en cours et tous ses matchs à venir. */
export function markGone(t, pid) {
  const p = getParticipant(t, pid);
  if (!p || p.gone || p.bot) return null;
  p.gone = true;
  if (!p.team) p.team = autoDraft(p.offer);
  const m = currentMatch(t);
  const side = sideOf(m, pid);
  if (m && side && m.status === 'live') {
    finishMatch(t, m, side === 'A' ? m.b : m.a, 'forfeit');
    t.last = {
      matchId: m.id, game: t.gameNo, winner: side === 'A' ? 'B' : 'A',
      scoreA: m.scoreA, scoreB: m.scoreB, matchOver: true, forfeit: true,
    };
    return m;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Simulation (bot contre bot, tests)
// ---------------------------------------------------------------------------

/** Joue un combat entier hors écran. Retourne { battle, credits }. */
export function simulateBattle(battle, difficulty = 'normal', maxTurns = 150) {
  const credits = [];
  let guard = 0;
  while (battle.phase !== 'over' && guard++ < maxTurns) {
    if (battle.phase === 'choose') {
      const actA = chooseBotAction(battle, 'A', difficulty);
      const actB = chooseBotAction(battle, 'B', difficulty);
      const { state, events } = resolveTurn(battle, actA, actB);
      Object.assign(battle, state);
      credits.push(...koCredits(battle, events));
    }
    for (const side of ['A', 'B']) {
      if (battle.phase === `switch_forced_${side}` || battle.phase === 'switch_forced_both') {
        const sw = chooseBotAction(battle, side, difficulty);
        if (sw && sw.type === 'switch') forceSwitch(battle, side, sw.targetIndex);
      }
    }
  }
  if (battle.phase !== 'over') {
    // Combat interminable : avantage au camp qui garde le plus de PV (en pourcentage)
    const pct = (team) => team.reduce((n, p) => n + (p.fainted ? 0 : p.hp / p.maxHp), 0);
    battle.phase = 'over';
    battle.winner = pct(battle.teamA) >= pct(battle.teamB) ? 'A' : 'B';
  }
  return { battle, credits };
}

/** Joue un match entier (toutes ses manches) sans affichage. */
export function simulateMatch(t, match, difficulty = 'normal') {
  match.status = 'live';
  match.how = 'sim';
  let safety = 0;
  while (match.status !== 'done' && safety++ < 9) {
    t.lead = { A: null, B: null };
    const battle = buildBattle(t, match);
    const { credits } = simulateBattle(battle, difficulty);
    recordGame(t, match, battle, credits);
  }
  if (match.status !== 'done') finishMatch(t, match, match.a, 'sim');
  t.lead = { A: null, B: null };
}

// ---------------------------------------------------------------------------
// Classement final
// ---------------------------------------------------------------------------

/** Place de chaque dresseur : 1 champion, 2 finaliste, 3 demi-finalistes, 5 quart-finalistes. */
export function placeOf(t, pid) {
  if (same(t.champion, pid)) return 1;
  const R = t.rounds.length;
  let last = 0;
  t.rounds.forEach((round, r) => {
    if (round.some((m) => same(m.a, pid) || same(m.b, pid))) last = r;
  });
  return 2 ** (R - 1 - last) + 1;
}

export function computeStandings(t) {
  return t.participants
    .map((p) => ({ id: p.id, place: placeOf(t, p.id) }))
    .sort((x, y) => x.place - y.place || getParticipant(t, y.id).stats.ko - getParticipant(t, x.id).stats.ko);
}

/** Pokémon le plus décisif du tournoi (le plus de K.O., puis le moins de défaites). */
export function tournamentMvp(t) {
  let best = null;
  for (const [pid, mons] of Object.entries(t.mons || {})) {
    for (const [dex, s] of Object.entries(mons)) {
      const score = s.ko * 10 - s.fainted * 3 + s.games;
      if (!best || score > best.score) best = { pid, dex: Number(dex), ...s, score };
    }
  }
  return best;
}
