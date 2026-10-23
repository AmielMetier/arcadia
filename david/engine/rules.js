// Moteur de règles de DavidSimulator.
// Fonction pure : reduce(state, action, board) → { ok, state, events, error }.
// Aucune dépendance au DOM ni à l'horloge : l'hôte, les tests et les bots utilisent le même code.
import { rngOf } from './rng.js';
import { makeConfig } from './modes.js';
import {
  isOwnable, groupSpaces, ownsGroup, level, groupHasBuildings, ownedBy, netWorth, standings,
  sameTeam, teamStandings, teamOf, teammate, teamOwnsGroup,
} from './valuation.js';

export const PHASES = ['roll', 'buy', 'auction', 'debt', 'end', 'over'];

// Actions possibles (champ `by` = id du joueur, ou 'host' pour les actions système).
export const ACTIONS = [
  'ROLL', 'PAY_BAIL', 'USE_JAIL_CARD', 'BUY', 'DECLINE', 'BID', 'PASS', 'END_TURN',
  'BUILD', 'SELL_BUILDING', 'MORTGAGE', 'UNMORTGAGE',
  'PROPOSE_TRADE', 'ACCEPT_TRADE', 'REJECT_TRADE', 'CANCEL_TRADE',
  'BANKRUPT', 'AUCTION_TIMEOUT', 'TIME_UP', 'PLAYER_LEFT', 'SET_BOT',
];

/* ------------------------------------------------------------------ création ------ */

// players : [{ id, name, color, bot, team? }] ; now : horodatage (ms) fourni par l'hôte.
// teams : 2 contre 2 (chaque joueur a team = 0 ou 1, deux joueurs par équipe).
export function createGame(board, { players, mode = 'classic', seed = 1, now = 0, house = null, teams = false }) {
  const cfg = makeConfig(board, mode, house, { teams });
  if (players.length < cfg.minPlayers || players.length > cfg.maxPlayers) {
    throw new Error(cfg.teams ? 'Le 2 contre 2 se joue à 4 joueurs.' : `Il faut entre ${cfg.minPlayers} et ${cfg.maxPlayers} joueurs.`);
  }
  if (cfg.teams && [0, 1].some((t) => players.filter((p) => p.team === t).length !== 2)) {
    throw new Error('Il faut deux joueurs dans chaque équipe.');
  }
  const s = {
    v: 1, board: board.id, mode, cfg, seed: seed >>> 0, seq: 0,
    players: players.map((p) => ({
      id: p.id, name: p.name, color: p.color, bot: !!p.bot, human: !p.bot, token: p.token || null,
      cash: cfg.startingCash, pos: 0, inJail: false, jailTries: 0, jailCards: [],
      bankrupt: false, bankruptAt: 0, left: false,
      ...(cfg.teams ? { team: p.team } : {}),
    })),
    props: {},
    bank: { houses: cfg.bankHouses, hotels: cfg.bankHotels },
    decks: {}, heldCards: {},
    pot: 0,
    turn: null, pendingBuy: null, auction: null, trades: [], debts: [], nextTradeId: 1,
    round: 1, turnCount: 0, over: false, winner: null, endReason: null, ranking: null,
    startedAt: now, endsAt: cfg.timeLimitMs ? now + cfg.timeLimitMs : null,
    stats: {
      visits: Array(40).fill(0), rentBySpace: Array(40).fill(0), history: [], dice: Array(13).fill(0), rolls: 0, doubles: 0,
      players: Object.fromEntries(players.map((p) => [p.id, {
        rentIn: 0, rentOut: 0, dist: 0, jailTurns: 0, goPassed: 0, bought: 0, built: 0, doubles: 0, taxes: 0,
      }])),
    },
    phase: 'roll',
  };
  for (const sp of board.spaces) if (isOwnable(sp)) s.props[sp.i] = { owner: null, houses: 0, hotel: false, mortgaged: false };
  const rng = rngOf(s);
  for (const deck of ['chance', 'chest']) {
    s.decks[deck] = { order: rng.shuffle(board.cards[deck].map((c) => c.id)), pos: 0 };
  }
  rng.shuffle(s.players); // ordre de jeu tiré au sort
  if (cfg.teams) {
    // 2 contre 2 : les équipes jouent en alternance (A, B, A, B), l'équipe qui commence est tirée au sort
    const first = rng.int(2), by = [first, 1 - first].map((t) => s.players.filter((p) => p.team === t));
    s.players = [by[0][0], by[1][0], by[0][1], by[1][1]];
  }
  const events = [];
  if (cfg.startingProperties) dealStartingProperties(s, board, rng, events);
  s.turn = freshTurn(0);
  recordHistory(s, board);
  settle(s);
  events.push({ k: 'TURN', player: s.players[0].id, round: 1 });
  return { state: s, events };
}

function dealStartingProperties(s, board, rng, events) {
  const pool = rng.shuffle(board.spaces.filter(isOwnable).map((sp) => sp.i));
  for (let k = 0; k < s.cfg.startingProperties; k++) {
    for (const p of s.players) {
      const idx = pool.findIndex((i) => {
        if (!s.cfg.startingPropertiesNoMonopoly) return true;
        const g = board.spaces[i].group;
        if (g === 'station' || g === 'utility') return true;
        return !groupSpaces(board, g).every((j) => j === i || s.props[j].owner === p.id);
      });
      if (idx < 0) continue;
      const [i] = pool.splice(idx, 1);
      s.props[i].owner = p.id;
      events.push({ k: 'GIFT', player: p.id, space: i });
    }
  }
}

const freshTurn = (cur) => ({ cur, mustRoll: true, doubles: 0, dice: null, rolls: 0 });

/* ------------------------------------------------------------------ accès ------ */

export const currentPlayer = (s) => s.players[s.turn.cur];
const P = (s, id) => s.players.find((p) => p.id === id);
const active = (s) => s.players.filter((p) => !p.bankrupt);

// Qui doit agir maintenant (pour l'interface et les bots).
export function actors(s) {
  if (s.over) return [];
  if (s.debts.length) return [s.debts[0].from];
  if (s.auction) return s.auction.active.filter((id) => !s.auction.passed.includes(id));
  return [currentPlayer(s).id];
}

/* ------------------------------------------------------------------ réducteur ------ */

class RuleError extends Error {}
const fail = (msg) => { throw new RuleError(msg); };

export function reduce(state, action, board) {
  if (!action || !ACTIONS.includes(action.type)) return { ok: false, state, events: [], error: 'Action inconnue.' };
  if (state.over && action.type !== 'PLAYER_LEFT') return { ok: false, state, events: [], error: 'La partie est terminée.' };
  const s = structuredClone(state);
  const ctx = { s, board, rng: rngOf(s), ev: [] };
  try {
    HANDLERS[action.type](ctx, action);
    settleDebts(ctx);
    pruneTrades(ctx);
    settle(s);
    s.seq++;
    return { ok: true, state: s, events: ctx.ev };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, state, events: [], error: e.message };
    throw e;
  }
}

// La phase découle toujours de l'état : pas de machine à états fragile à maintenir.
function settle(s) {
  if (s.over) s.phase = 'over';
  else if (s.debts.length) s.phase = 'debt';
  else if (s.auction) s.phase = 'auction';
  else if (s.pendingBuy != null) s.phase = 'buy';
  else s.phase = s.turn.mustRoll ? 'roll' : 'end';
}

function actor(ctx, a) {
  const p = P(ctx.s, a.by);
  if (!p) fail('Joueur inconnu.');
  if (p.bankrupt) fail('Vous avez fait faillite.');
  return p;
}

function onTurn(ctx, a, phases) {
  const p = actor(ctx, a), s = ctx.s;
  if (currentPlayer(s).id !== p.id) fail("Ce n'est pas votre tour.");
  settle(s);
  if (!phases.includes(s.phase)) fail('Action impossible pour le moment.');
  return p;
}

// Gestion de patrimoine (constructions, hypothèques) : pendant son tour, ou pour régler une dette.
function manager(ctx, a) {
  const p = actor(ctx, a), s = ctx.s;
  if (s.auction) fail("Attendez la fin de l'enchère.");
  const debtor = s.debts.length && s.debts[0].from === p.id;
  const myTurn = currentPlayer(s).id === p.id && !s.debts.length;
  if (!debtor && !myTurn) fail("Vous ne pouvez gérer vos biens que pendant votre tour ou pour régler une dette.");
  return p;
}

function teamProperty(ctx, p, i) {
  const sp = ctx.board.spaces[i], o = ctx.s.props[i] && ctx.s.props[i].owner;
  if (!sp || !isOwnable(sp)) fail('Case invalide.');
  if (o !== p.id && !(ctx.s.cfg.teams && o != null && sameTeam(ctx.s, o, p.id))) fail(ctx.s.cfg.teams ? 'Ce terrain n\'appartient pas à ton équipe.' : 'Cette propriété ne vous appartient pas.');
  return sp;
}

function ownProperty(ctx, p, i) {
  const sp = ctx.board.spaces[i];
  if (!sp || !isOwnable(sp)) fail('Case invalide.');
  if (ctx.s.props[i].owner !== p.id) fail("Cette propriété ne vous appartient pas.");
  return sp;
}

/* ------------------------------------------------------------------ argent ------ */

function transfer(ctx, from, to, amount, reason, space) {
  if (amount <= 0) return;
  from.cash -= amount;
  if (to) to.cash += amount;
  const st = ctx.s.stats;
  if (reason === 'rent') {
    st.players[from.id].rentOut += amount;
    st.players[to.id].rentIn += amount;
    if (space != null) st.rentBySpace[space] += amount;
  }
  if (reason === 'tax') st.players[from.id].taxes += amount;
  // règle maison : taxes, amendes et cartes payées à la banque vont dans la cagnotte du Parc gratuit
  const pot = !to && ctx.s.cfg.freeParkingJackpot && (reason === 'tax' || reason === 'card' || reason === 'bail');
  if (pot) ctx.s.pot = (ctx.s.pot || 0) + amount;
  ctx.ev.push({ k: 'PAY', from: from.id, to: to ? to.id : null, amount, reason, space, pot: pot || undefined });
}

function collect(ctx, p, amount, reason) {
  p.cash += amount;
  ctx.ev.push({ k: 'PAY', from: null, to: p.id, amount, reason });
}

// Paiement dû : réglé tout de suite si possible, sinon inscrit comme dette.
function charge(ctx, from, to, amount, reason, space) {
  if (amount <= 0 || from.bankrupt) return;
  if (!ctx.s.debts.length && from.cash >= amount) { transfer(ctx, from, to, amount, reason, space); return; }
  ctx.s.debts.push({ from: from.id, to: to ? to.id : null, amount, reason, space: space ?? null });
  ctx.ev.push({ k: 'DEBT', from: from.id, to: to ? to.id : null, amount, reason });
}

function settleDebts(ctx) {
  const s = ctx.s;
  while (s.debts.length) {
    const d = s.debts[0], from = P(s, d.from);
    if (from.bankrupt) { s.debts.shift(); continue; }
    if (from.cash < d.amount) break;
    let to = d.to != null ? P(s, d.to) : null;
    if (to && to.bankrupt) to = null;
    s.debts.shift();
    transfer(ctx, from, to, d.amount, d.reason, d.space);
  }
}

/* ------------------------------------------------------------------ déplacements ------ */

function move(ctx, p, steps, opts = {}) {
  const from = p.pos, to = (from + steps) % 40;
  if (from + steps >= 40) {
    // règle maison : salaire doublé quand on s'arrête pile sur Départ
    collect(ctx, p, ctx.s.cfg.goSalary * (to === 0 && ctx.s.cfg.doubleGoLanding ? 2 : 1), 'go');
    ctx.s.stats.players[p.id].goPassed++;
  }
  p.pos = to;
  ctx.s.stats.players[p.id].dist += steps;
  ctx.ev.push({ k: 'MOVE', player: p.id, from, to, steps });
  land(ctx, p, opts);
}

const moveTo = (ctx, p, target, opts) => move(ctx, p, (target - p.pos + 40) % 40, opts);

function sendToJail(ctx, p) {
  const from = p.pos;
  p.pos = ctx.s.cfg.jailPosition;
  p.inJail = true;
  p.jailTries = 0;
  if (currentPlayer(ctx.s).id === p.id) { ctx.s.turn.mustRoll = false; ctx.s.turn.doubles = 0; }
  ctx.ev.push({ k: 'JAIL', player: p.id, from });
}

function land(ctx, p, opts = {}) {
  const { s, board } = ctx, i = p.pos, sp = board.spaces[i];
  s.stats.visits[i]++;
  ctx.ev.push({ k: 'LAND', player: p.id, space: i });
  switch (sp.type) {
    case 'gotojail': sendToJail(ctx, p); break;
    case 'tax': charge(ctx, p, null, sp.amount, 'tax', i); break;
    case 'chance': case 'chest': drawCard(ctx, p, sp.type); break;
    case 'parking':
      if (s.cfg.freeParkingJackpot && s.pot > 0) { const won = s.pot; s.pot = 0; collect(ctx, p, won, 'jackpot'); }
      break;
    case 'street': case 'station': case 'utility': {
      const pr = s.props[i];
      if (pr.owner == null) { s.pendingBuy = i; break; }
      if (pr.owner === p.id || pr.mortgaged) break;
      const owner = P(s, pr.owner);
      if (owner.bankrupt) break;
      // 2 contre 2 : pas de loyer chez son coéquipier
      if (sameTeam(s, p.id, owner.id)) { ctx.ev.push({ k: 'NO_RENT', player: p.id, owner: owner.id, space: i }); break; }
      const rent = rentFor(ctx, i, opts);
      charge(ctx, p, owner, rent, 'rent', i);
      break;
    }
    default: break;
  }
}

export function rentFor(ctx, i, opts = {}) {
  const { s, board } = ctx, sp = board.spaces[i], pr = s.props[i];
  if (sp.type === 'street') {
    if (pr.hotel) return sp.rent[5];
    if (pr.houses > 0) return sp.rent[pr.houses];
    const double = s.cfg.doubleRentOnUnimprovedMonopoly && teamOwnsGroup(s, board, pr.owner, sp.group);
    return sp.rent[0] * (double ? 2 : 1);
  }
  const n = groupSpaces(board, sp.group).filter((j) => s.props[j].owner === pr.owner).length;
  if (sp.type === 'station') return sp.rent[n - 1] * (opts.rentMultiplier || 1);
  // compagnie : multiplicateur × total des dés (relancés si on y est envoyé par une carte)
  let total;
  if (opts.diceMultiplier && ctx.rng) {
    const d = [ctx.rng.die(), ctx.rng.die()];
    ctx.ev.push({ k: 'DICE', player: currentPlayer(s).id, dice: d, reason: 'utility' });
    total = d[0] + d[1];
  } else total = s.turn.dice ? s.turn.dice[0] + s.turn.dice[1] : 7;
  const mult = opts.diceMultiplier || sp.diceMultiplier[Math.min(n, 2) - 1];
  return total * mult;
}

/* ------------------------------------------------------------------ cartes ------ */

function drawCard(ctx, p, deckName) {
  const { s, board } = ctx, deck = s.decks[deckName];
  let id = null;
  for (let k = 0; k < deck.order.length; k++) {
    const c = deck.order[deck.pos];
    deck.pos = (deck.pos + 1) % deck.order.length;
    if (!s.heldCards[c]) { id = c; break; }
  }
  if (!id) return;
  const card = board.cards[deckName].find((c) => c.id === id), a = card.action;
  ctx.ev.push({ k: 'CARD', player: p.id, deck: deckName, card: id, text: card.text });
  switch (a.type) {
    case 'advance': moveTo(ctx, p, a.to); break;
    case 'advanceNearest': {
      let j = p.pos;
      do j = (j + 1) % 40; while (board.spaces[j].type !== a.kind);
      moveTo(ctx, p, j, { rentMultiplier: a.rentMultiplier, diceMultiplier: a.diceMultiplier });
      break;
    }
    case 'collect': collect(ctx, p, a.amount, 'card'); break;
    case 'pay': charge(ctx, p, null, a.amount, 'card'); break;
    case 'jailFree': s.heldCards[id] = p.id; p.jailCards.push(id); break;
    case 'back': {
      const from = p.pos;
      p.pos = (p.pos - a.steps + 40) % 40;
      s.stats.players[p.id].dist += a.steps;
      ctx.ev.push({ k: 'MOVE', player: p.id, from, to: p.pos, steps: -a.steps });
      land(ctx, p);
      break;
    }
    case 'goToJail': sendToJail(ctx, p); break;
    case 'repairs': {
      let houses = 0, hotels = 0;
      for (const i of ownedBy(s, board, p.id)) { const pr = s.props[i]; if (pr.hotel) hotels++; else houses += pr.houses; }
      charge(ctx, p, null, houses * a.house + hotels * a.hotel, 'card');
      break;
    }
    // en 2 contre 2, seuls les adversaires paient ou sont payés
    case 'payEach': for (const q of active(s)) if (q.id !== p.id && !sameTeam(s, p.id, q.id)) charge(ctx, p, q, a.amount, 'card'); break;
    case 'collectEach': for (const q of active(s)) if (q.id !== p.id && !sameTeam(s, p.id, q.id)) charge(ctx, q, p, a.amount, 'card'); break;
    default: break;
  }
}

function releaseCard(s, p, id) {
  p.jailCards = p.jailCards.filter((c) => c !== id);
  delete s.heldCards[id];
}

/* ------------------------------------------------------------------ tours ------ */

function nextTurn(ctx) {
  const s = ctx.s;
  if (s.over) return;
  recordHistory(s, ctx.board);
  let cur = s.turn.cur;
  for (let k = 0; k < s.players.length; k++) {
    cur = (cur + 1) % s.players.length;
    if (cur === 0) s.round++;
    if (!s.players[cur].bankrupt) break;
  }
  s.turn = freshTurn(cur);
  s.turnCount++;
  // les échanges se négocient pendant le tour de celui qui propose : les propositions sans réponse expirent
  for (const t of s.trades) ctx.ev.push({ k: 'TRADE_CANCELLED', trade: t.id, reason: 'turn' });
  s.trades = [];
  ctx.ev.push({ k: 'TURN', player: s.players[cur].id, round: s.round });
}

// Historique du patrimoine et du liquide, un point par fin de tour.
// Au-delà de HISTORY_MAX points, on garde un point sur deux (le premier et le dernier restent) :
// l'état reste léger même dans une très longue partie.
const HISTORY_MAX = 400;
function recordHistory(s, board) {
  const worth = {}, cash = {};
  for (const p of s.players) {
    worth[p.id] = p.bankrupt ? 0 : netWorth(s, board, p.id).total;
    cash[p.id] = p.bankrupt ? 0 : p.cash;
  }
  const h = s.stats.history;
  h.push({ t: s.turnCount, r: s.round, worth, cash });
  if (h.length > HISTORY_MAX) s.stats.history = h.filter((_, k) => k % 2 === 0 || k === h.length - 1);
}

function rollDice(ctx, p) {
  const d = [ctx.rng.die(), ctx.rng.die()];
  ctx.s.turn.dice = d;
  ctx.s.turn.rolls++;
  // historique des lancers de la partie (onglet « Dés » des statistiques)
  const st = ctx.s.stats;
  if (!st.dice) { st.dice = Array(13).fill(0); st.rolls = 0; st.doubles = 0; }
  st.dice[d[0] + d[1]]++; st.rolls++; if (d[0] === d[1]) st.doubles++;
  ctx.ev.push({ k: 'DICE', player: p.id, dice: d });
  return d;
}

/* ------------------------------------------------------------------ fin de partie ------ */

function endGame(ctx, reason) {
  const s = ctx.s;
  if (s.over) return;
  recordHistory(s, ctx.board);
  s.over = true;
  s.endReason = reason;
  s.pendingBuy = null;
  s.auction = null;
  s.debts = [];
  s.trades = [];
  s.ranking = standings(s, ctx.board).map((r) => r.id);
  s.winner = s.ranking[0];
  s.winnerTeam = s.cfg.teams ? teamStandings(s, ctx.board)[0].team : null;
  ctx.ev.push({ k: 'GAME_OVER', reason, winner: s.winner, ranking: s.ranking, team: s.winnerTeam ?? undefined });
}

function bankrupt(ctx, p, creditorId, owed = Infinity) {
  const { s, board } = ctx;
  const creditor = creditorId != null ? P(s, creditorId) : null;
  // 2 contre 2 : le coéquipier encore en jeu hérite des biens (voir plus bas)
  const heir = s.cfg.teams ? s.players.find((q) => q.id !== p.id && !q.bankrupt && sameTeam(s, q.id, p.id)) : null;
  // 1) bâtiments revendus à la banque à moitié prix
  for (const i of ownedBy(s, board, p.id)) {
    const pr = s.props[i], sp = board.spaces[i];
    if (pr.hotel) { p.cash += (sp.houseCost * (s.cfg.housesPerHotel + 1)) / 2; s.bank.hotels++; pr.hotel = false; }
    if (pr.houses) { p.cash += (sp.houseCost * pr.houses) / 2; s.bank.houses += pr.houses; pr.houses = 0; }
  }
  const props = ownedBy(s, board, p.id);
  if (heir) {
    // 2a') 2 contre 2 : le créancier n'est payé qu'à hauteur de la dette, avec l'argent qui reste ;
    //      le reste de l'argent, les terrains (hypothèques comprises) et les cartes passent au coéquipier
    const toCreditor = creditor && !creditor.bankrupt && !sameTeam(s, creditor.id, p.id) ? Math.min(p.cash, owed) : 0;
    if (toCreditor > 0) transfer(ctx, p, creditor, toCreditor, 'bankrupt');
    else if (!creditor && owed !== Infinity && p.cash > 0) transfer(ctx, p, null, Math.min(p.cash, owed), 'bankrupt');
    if (p.cash > 0) transfer(ctx, p, heir, p.cash, 'inherit');
    for (const i of props) s.props[i].owner = heir.id;
    for (const c of p.jailCards) { s.heldCards[c] = heir.id; heir.jailCards.push(c); }
  } else if (creditor && !creditor.bankrupt) {
    // 2a) tout revient au créancier ; il paie 10 % sur les terrains hypothéqués reçus
    if (p.cash > 0) transfer(ctx, p, creditor, p.cash, 'bankrupt');
    for (const i of props) {
      s.props[i].owner = creditor.id;
      if (s.props[i].mortgaged) {
        const fee = Math.min(creditor.cash, Math.ceil(board.spaces[i].mortgage * s.cfg.mortgageInterest));
        if (fee > 0) transfer(ctx, creditor, null, fee, 'interest', i);
      }
    }
    for (const c of p.jailCards) { s.heldCards[c] = creditor.id; creditor.jailCards.push(c); }
  } else {
    // 2b) dette envers la banque : les terrains redeviennent libres
    for (const i of props) Object.assign(s.props[i], { owner: null, mortgaged: false });
    for (const c of p.jailCards) delete s.heldCards[c];
  }
  p.jailCards = [];
  p.cash = 0;
  p.bankrupt = true;
  // 2 contre 2 : une couleur qui n'est plus complète pour l'équipe perd ses bâtiments (revendus à moitié prix)
  if (s.cfg.teams) {
    for (const g of Object.keys(board.groups)) {
      for (const i of groupSpaces(board, g)) {
        const pr = s.props[i], o = pr.owner != null ? P(s, pr.owner) : null;
        if (!o || o.bankrupt || level(s, i) === 0 || teamOwnsGroup(s, board, o.id, g)) continue;
        const sp = board.spaces[i], n = pr.hotel ? s.cfg.housesPerHotel + 1 : pr.houses;
        if (pr.hotel) s.bank.hotels++; else s.bank.houses += pr.houses;
        pr.hotel = false; pr.houses = 0;
        collect(ctx, o, (sp.houseCost * n) / 2, 'sell');
        ctx.ev.push({ k: 'SELL', player: o.id, space: i, houses: 0, hotel: false });
      }
    }
  }
  p.inJail = false;
  p.bankruptAt = s.seq + 1;
  s.debts = s.debts.filter((d) => d.from !== p.id);
  s.trades = s.trades.filter((t) => t.from !== p.id && t.to !== p.id);
  if (s.auction) {
    s.auction.passed.push(p.id);
    if (s.auction.bidder === p.id) { s.auction.bidder = null; s.auction.high = 0; }
  }
  ctx.ev.push({ k: 'BANKRUPT', player: p.id, creditor: creditor ? creditor.id : null, ...(heir ? { heir: heir.id, props: props.length } : {}) });

  if (s.cfg.endOnFirstBankruptcy) { endGame(ctx, 'bankruptcy'); return; }
  if (s.cfg.teams && new Set(active(s).map((q) => q.team)).size <= 1) { endGame(ctx, 'lastTeam'); return; }
  if (active(s).length <= 1) { endGame(ctx, 'lastStanding'); return; }
  if (s.auction) maybeCloseAuction(ctx);
  if (currentPlayer(s).id === p.id) { s.pendingBuy = null; s.auction = null; nextTurn(ctx); }
}

/* ------------------------------------------------------------------ enchères ------ */

function startAuction(ctx, i) {
  const s = ctx.s;
  s.pendingBuy = null;
  const cur = s.turn.cur, order = [];
  for (let k = 0; k < s.players.length; k++) {
    const p = s.players[(cur + k) % s.players.length];
    if (!p.bankrupt) order.push(p.id);
  }
  s.auction = { space: i, high: 0, bidder: null, active: order, passed: [], bids: 0 };
  ctx.ev.push({ k: 'AUCTION_START', space: i });
}

function closeAuction(ctx) {
  const s = ctx.s, a = s.auction;
  s.auction = null;
  if (a.bidder != null) {
    const w = P(s, a.bidder);
    transfer(ctx, w, null, a.high, 'auction', a.space);
    s.props[a.space].owner = w.id;
    s.stats.players[w.id].bought++;
    ctx.ev.push({ k: 'AUCTION_END', space: a.space, winner: w.id, amount: a.high });
  } else ctx.ev.push({ k: 'AUCTION_END', space: a.space, winner: null, amount: 0 });
}

function maybeCloseAuction(ctx) {
  const a = ctx.s.auction;
  const left = a.active.filter((id) => !a.passed.includes(id));
  if (left.length === 0 || (a.bidder != null && left.length === 1 && left[0] === a.bidder)) closeAuction(ctx);
}

/* ------------------------------------------------------------------ échanges ------ */

// On propose un échange pendant son tour (ou pour réunir l'argent d'une dette) ; on peut répondre à tout moment.
export function canPropose(s, pid) {
  if (s.over || s.auction) return false;
  const p = P(s, pid);
  if (!p || p.bankrupt) return false;
  if (s.debts.length) return s.debts[0].from === pid;
  return currentPlayer(s).id === pid;
}

// Retire les propositions devenues impossibles (argent dépensé, terrain vendu, bâti ou hypothéqué entre-temps)
function pruneTrades(ctx) {
  const s = ctx.s;
  if (!s.trades.length) return;
  s.trades = s.trades.filter((t) => {
    const from = P(s, t.from), to = P(s, t.to);
    let ok = from && to && !from.bankrupt && !to.bankrupt;
    if (ok) { try { checkSide(ctx, from, t.give, true); checkSide(ctx, to, t.want, false); } catch (e) { if (!(e instanceof RuleError)) throw e; ok = false; } }
    if (!ok) ctx.ev.push({ k: 'TRADE_CANCELLED', trade: t.id, reason: 'invalid' });
    return ok;
  });
}

const emptySide = () => ({ cash: 0, props: [], cards: [] });

function cleanSide(x) {
  x = x || {};
  return {
    cash: Math.max(0, Math.floor(Number(x.cash) || 0)),
    props: [...new Set((x.props || []).map(Number))],
    cards: [...new Set(x.cards || [])],
  };
}

function checkSide(ctx, owner, side, needCash) {
  const { s, board } = ctx;
  for (const i of side.props) {
    const sp = board.spaces[i];
    if (!sp || !isOwnable(sp) || s.props[i].owner !== owner.id) fail(`${sp ? sp.name : 'Case'} n'appartient pas à ${owner.name}.`);
    if (sp.type === 'street' && groupHasBuildings(s, board, sp.group)) {
      fail(`Vendez d'abord les bâtiments du groupe de ${sp.name}.`);
    }
  }
  for (const c of side.cards) if (!owner.jailCards.includes(c)) fail(`${owner.name} n'a pas cette carte.`);
  if (needCash && owner.cash < side.cash) fail(`${owner.name} n'a pas assez d'argent.`);
}

function giveSide(ctx, from, to, side) {
  const { s, board } = ctx;
  if (side.cash) transfer(ctx, from, to, side.cash, 'trade');
  for (const i of side.props) {
    s.props[i].owner = to.id;
    if (s.props[i].mortgaged) charge(ctx, to, null, Math.ceil(board.spaces[i].mortgage * s.cfg.mortgageInterest), 'interest', i);
  }
  for (const c of side.cards) { releaseCard(s, from, c); s.heldCards[c] = to.id; to.jailCards.push(c); }
}

/* ------------------------------------------------------------------ actions ------ */

const HANDLERS = {
  ROLL(ctx, a) {
    const p = onTurn(ctx, a, ['roll']), s = ctx.s, t = s.turn;
    // aléa frais fourni par l'hôte (crypto.getRandomValues) mêlé à la graine : chaque lancer est indépendant
    if (Number.isInteger(a.entropy)) s.seed = (s.seed ^ (a.entropy >>> 0)) >>> 0;
    const d = rollDice(ctx, p), doubles = d[0] === d[1], total = d[0] + d[1];
    if (doubles) s.stats.players[p.id].doubles++;
    if (p.inJail) {
      t.mustRoll = false;
      if (doubles) {
        p.inJail = false; p.jailTries = 0;
        ctx.ev.push({ k: 'JAIL_OUT', player: p.id, how: 'doubles' });
        move(ctx, p, total);
      } else {
        p.jailTries++;
        s.stats.players[p.id].jailTurns++;
        if (p.jailTries >= s.cfg.maxJailTurns) {
          p.inJail = false; p.jailTries = 0;
          ctx.ev.push({ k: 'JAIL_OUT', player: p.id, how: 'fine' });
          charge(ctx, p, null, s.cfg.jailFine, 'bail');
          move(ctx, p, total);
        }
      }
      return;
    }
    if (doubles) {
      t.doubles++;
      if (t.doubles >= s.cfg.doublesToJail) { ctx.ev.push({ k: 'SPEEDING', player: p.id }); sendToJail(ctx, p); return; }
    }
    t.mustRoll = doubles;
    move(ctx, p, total);
    if (p.inJail) t.mustRoll = false;
  },

  PAY_BAIL(ctx, a) {
    const p = onTurn(ctx, a, ['roll']), s = ctx.s;
    if (!p.inJail) fail("Vous n'êtes pas en prison.");
    if (s.turn.rolls > 0) fail('Vous avez déjà lancé les dés ce tour-ci.');
    if (p.cash < s.cfg.jailFine) fail("Pas assez d'argent pour payer la caution.");
    transfer(ctx, p, null, s.cfg.jailFine, 'bail');
    p.inJail = false; p.jailTries = 0;
    ctx.ev.push({ k: 'JAIL_OUT', player: p.id, how: 'bail' });
  },

  USE_JAIL_CARD(ctx, a) {
    const p = onTurn(ctx, a, ['roll']), s = ctx.s;
    if (!p.inJail) fail("Vous n'êtes pas en prison.");
    if (s.turn.rolls > 0) fail('Vous avez déjà lancé les dés ce tour-ci.');
    if (!p.jailCards.length) fail("Vous n'avez pas de carte « Libéré de prison ».");
    releaseCard(s, p, p.jailCards[0]);
    p.inJail = false; p.jailTries = 0;
    ctx.ev.push({ k: 'JAIL_OUT', player: p.id, how: 'card' });
  },

  BUY(ctx, a) {
    const p = onTurn(ctx, a, ['buy']), s = ctx.s, i = s.pendingBuy, sp = ctx.board.spaces[i];
    if (p.cash < sp.price) fail("Pas assez d'argent : hypothéquez, vendez ou passez aux enchères.");
    transfer(ctx, p, null, sp.price, 'buy', i);
    s.props[i].owner = p.id;
    s.pendingBuy = null;
    s.stats.players[p.id].bought++;
    ctx.ev.push({ k: 'BUY', player: p.id, space: i, price: sp.price });
  },

  DECLINE(ctx, a) {
    onTurn(ctx, a, ['buy']);
    const s = ctx.s, i = s.pendingBuy;
    if (s.cfg.auctionWhenDeclined) startAuction(ctx, i);
    else { s.pendingBuy = null; ctx.ev.push({ k: 'DECLINED', space: i }); }
  },

  BID(ctx, a) {
    const p = actor(ctx, a), s = ctx.s, au = s.auction;
    if (!au) fail("Aucune enchère en cours.");
    if (!au.active.includes(p.id) || au.passed.includes(p.id)) fail("Vous ne participez plus à cette enchère.");
    const amount = Math.floor(Number(a.amount));
    if (!(amount > au.high)) fail(`L'offre doit dépasser ${au.high} €.`);
    if (amount > p.cash) fail("Vous n'avez pas assez d'argent.");
    au.high = amount; au.bidder = p.id; au.bids++;
    ctx.ev.push({ k: 'BID', player: p.id, amount });
    maybeCloseAuction(ctx);
  },

  PASS(ctx, a) {
    const p = actor(ctx, a), au = ctx.s.auction;
    if (!au) fail("Aucune enchère en cours.");
    if (!au.active.includes(p.id) || au.passed.includes(p.id)) fail("Vous ne participez plus à cette enchère.");
    if (au.bidder === p.id) fail("Vous avez la meilleure offre.");
    au.passed.push(p.id);
    ctx.ev.push({ k: 'PASS', player: p.id });
    maybeCloseAuction(ctx);
  },

  AUCTION_TIMEOUT(ctx, a) {
    if (a.by !== 'host') fail('Réservé à l’hôte.');
    if (!ctx.s.auction) fail("Aucune enchère en cours.");
    closeAuction(ctx);
  },

  END_TURN(ctx, a) {
    onTurn(ctx, a, ['end']);
    nextTurn(ctx);
  },

  BUILD(ctx, a) {
    const p = manager(ctx, a), { s, board } = ctx, i = Number(a.space);
    if (s.debts.length) fail("Réglez d'abord votre dette.");
    // en 2 contre 2, on peut aussi bâtir (à ses frais) sur les terrains de son coéquipier
    const sp = teamProperty(ctx, p, i);
    if (sp.type !== 'street') fail('On ne construit que sur les terrains.');
    if (!teamOwnsGroup(s, board, p.id, sp.group)) fail(s.cfg.teams ? 'Il faut que ton équipe possède tout le groupe de couleur.' : 'Il faut posséder tout le groupe de couleur.');
    const g = groupSpaces(board, sp.group), hph = s.cfg.housesPerHotel, pr = s.props[i];
    if (g.some((j) => s.props[j].mortgaged)) fail('Un terrain du groupe est hypothéqué.');
    if (pr.hotel) fail('Il y a déjà un hôtel.');
    if (level(s, i) > Math.min(...g.map((j) => level(s, j)))) fail('Construisez de façon égale sur tout le groupe.');
    if (p.cash < sp.houseCost) fail("Pas assez d'argent.");
    if (pr.houses < hph) {
      if (s.bank.houses < 1) fail("La banque n'a plus de maisons.");
      pr.houses++; s.bank.houses--;
      transfer(ctx, p, null, sp.houseCost, 'build', i);
      ctx.ev.push({ k: 'BUILD', player: p.id, space: i, houses: pr.houses, hotel: false });
    } else {
      if (s.bank.hotels < 1) fail("La banque n'a plus d'hôtels.");
      pr.houses = 0; pr.hotel = true; s.bank.houses += hph; s.bank.hotels--;
      transfer(ctx, p, null, sp.houseCost, 'build', i);
      ctx.ev.push({ k: 'BUILD', player: p.id, space: i, houses: 0, hotel: true });
    }
    s.stats.players[p.id].built++;
  },

  SELL_BUILDING(ctx, a) {
    const p = manager(ctx, a), { s, board } = ctx, i = Number(a.space);
    // en 2 contre 2, les bâtiments d'une couleur d'équipe se vendent aussi chez le coéquipier (toujours de façon égale)
    const sp = teamProperty(ctx, p, i);
    if (sp.type !== 'street' || level(s, i) === 0) fail("Aucun bâtiment à vendre ici.");
    const g = groupSpaces(board, sp.group), hph = s.cfg.housesPerHotel, pr = s.props[i];
    if (level(s, i) < Math.max(...g.map((j) => level(s, j)))) fail('Vendez de façon égale sur tout le groupe.');
    const refund = Math.floor((sp.houseCost * s.cfg.buildingResaleRatio));
    if (pr.hotel) {
      if (s.bank.houses < hph) fail(`La banque n'a pas ${hph} maisons pour remplacer l'hôtel.`);
      pr.hotel = false; pr.houses = hph; s.bank.hotels++; s.bank.houses -= hph;
    } else { pr.houses--; s.bank.houses++; }
    collect(ctx, p, refund, 'sell');
    ctx.ev.push({ k: 'SELL', player: p.id, space: i, houses: pr.houses, hotel: pr.hotel });
  },

  MORTGAGE(ctx, a) {
    const p = manager(ctx, a), { s, board } = ctx, i = Number(a.space);
    const sp = ownProperty(ctx, p, i), pr = s.props[i];
    if (pr.mortgaged) fail('Déjà hypothéquée.');
    if (sp.type === 'street' && groupHasBuildings(s, board, sp.group)) fail("Vendez d'abord les bâtiments du groupe.");
    pr.mortgaged = true;
    collect(ctx, p, sp.mortgage, 'mortgage');
    ctx.ev.push({ k: 'MORTGAGE', player: p.id, space: i });
  },

  UNMORTGAGE(ctx, a) {
    const p = manager(ctx, a), s = ctx.s, i = Number(a.space);
    if (s.debts.length) fail("Réglez d'abord votre dette.");
    const sp = ownProperty(ctx, p, i), pr = s.props[i];
    if (!pr.mortgaged) fail("Cette propriété n'est pas hypothéquée.");
    const cost = sp.mortgage + Math.ceil(sp.mortgage * s.cfg.mortgageInterest);
    if (p.cash < cost) fail(`Il faut ${cost} € pour lever l'hypothèque.`);
    transfer(ctx, p, null, cost, 'unmortgage', i);
    pr.mortgaged = false;
    ctx.ev.push({ k: 'UNMORTGAGE', player: p.id, space: i });
  },

  PROPOSE_TRADE(ctx, a) {
    const p = actor(ctx, a), s = ctx.s, to = P(s, a.to);
    if (s.auction) fail("Attendez la fin de l'enchère.");
    if (!canPropose(s, p.id)) fail("Les échanges se proposent pendant son tour.");
    if (!to || to.bankrupt || to.id === p.id) fail('Partenaire invalide.');
    const give = cleanSide(a.give), want = cleanSide(a.want);
    if (!give.cash && !give.props.length && !give.cards.length && !want.cash && !want.props.length && !want.cards.length) {
      fail("L'échange est vide.");
    }
    checkSide(ctx, p, give, true);
    checkSide(ctx, to, want, false);
    s.trades = s.trades.filter((t) => !(t.from === p.id && t.to === to.id));
    const trade = { id: s.nextTradeId++, from: p.id, to: to.id, give, want };
    s.trades.push(trade);
    ctx.ev.push({ k: 'TRADE_OFFER', trade });
  },

  ACCEPT_TRADE(ctx, a) {
    const p = actor(ctx, a), s = ctx.s, t = s.trades.find((x) => x.id === a.trade);
    if (!t || t.to !== p.id) fail('Proposition introuvable.');
    if (s.auction) fail("Attendez la fin de l'enchère.");
    const from = P(s, t.from);
    checkSide(ctx, from, t.give, true);
    checkSide(ctx, p, t.want, true);
    s.trades = s.trades.filter((x) => x.id !== t.id);
    giveSide(ctx, from, p, t.give);
    giveSide(ctx, p, from, t.want);
    // les autres propositions devenues impossibles sont retirées
    s.trades = s.trades.filter((x) => {
      try { checkSide(ctx, P(s, x.from), x.give, false); checkSide(ctx, P(s, x.to), x.want, false); return true; } catch { return false; }
    });
    ctx.ev.push({ k: 'TRADE_DONE', trade: t });
  },

  REJECT_TRADE(ctx, a) {
    const p = actor(ctx, a), s = ctx.s, t = s.trades.find((x) => x.id === a.trade);
    if (!t || t.to !== p.id) fail('Proposition introuvable.');
    s.trades = s.trades.filter((x) => x.id !== t.id);
    ctx.ev.push({ k: 'TRADE_REJECTED', trade: t.id, by: p.id });
  },

  CANCEL_TRADE(ctx, a) {
    const p = actor(ctx, a), s = ctx.s, t = s.trades.find((x) => x.id === a.trade);
    if (!t || t.from !== p.id) fail('Proposition introuvable.');
    s.trades = s.trades.filter((x) => x.id !== t.id);
    ctx.ev.push({ k: 'TRADE_CANCELLED', trade: t.id });
  },

  BANKRUPT(ctx, a) {
    const p = actor(ctx, a), s = ctx.s;
    if (!s.debts.length || s.debts[0].from !== p.id) fail("Vous n'avez pas de dette à régler.");
    const owed = s.debts.filter((d) => d.from === p.id && d.to === s.debts[0].to).reduce((t, d) => t + d.amount, 0);
    bankrupt(ctx, p, s.debts[0].to, owed);
  },

  // Un joueur quitte la partie : ses biens reviennent à la banque.
  PLAYER_LEFT(ctx, a) {
    if (a.by !== 'host') fail('Réservé à l’hôte.');
    const p = P(ctx.s, a.player);
    if (!p || p.bankrupt) return;
    p.left = true;
    if (ctx.s.over) return;
    bankrupt(ctx, p, null);
  },

  // Un joueur déconnecté est joué par un bot ; il reprend la main à son retour.
  SET_BOT(ctx, a) {
    if (a.by !== 'host') fail('Réservé à l’hôte.');
    const p = P(ctx.s, a.player);
    if (!p || p.bankrupt || p.bot === !!a.bot) return;
    p.bot = !!a.bot;
    ctx.ev.push({ k: 'BOT', player: p.id, bot: p.bot });
  },

  TIME_UP(ctx, a) {
    if (a.by !== 'host') fail('Réservé à l’hôte.');
    if (!ctx.s.endsAt) fail("Cette partie n'a pas de limite de temps.");
    endGame(ctx, 'time');
  },
};

/* ------------------------------------------------------------------ aides pour l'interface ------ */

// Liste des actions qu'un joueur peut tenter maintenant (sans garantie qu'elles réussissent).
export function availableActions(s, board, pid) {
  if (s.over) return [];
  const p = P(s, pid);
  if (!p || p.bankrupt) return [];
  const out = [];
  const isCur = currentPlayer(s).id === pid;
  if (s.auction) {
    const au = s.auction;
    if (au.active.includes(pid) && !au.passed.includes(pid)) { out.push('BID'); if (au.bidder !== pid) out.push('PASS'); }
  } else if (s.debts.length) {
    if (s.debts[0].from === pid) out.push('BANKRUPT', 'SELL_BUILDING', 'MORTGAGE');
  } else if (isCur) {
    if (s.phase === 'roll') {
      out.push('ROLL');
      if (p.inJail && s.turn.rolls === 0) { out.push('PAY_BAIL'); if (p.jailCards.length) out.push('USE_JAIL_CARD'); }
    }
    if (s.phase === 'buy') out.push('BUY', 'DECLINE');
    if (s.phase === 'end') out.push('END_TURN');
    out.push('BUILD', 'SELL_BUILDING', 'MORTGAGE', 'UNMORTGAGE');
  }
  if (!s.auction) {
    if (canPropose(s, pid)) out.push('PROPOSE_TRADE');
    if (s.trades.some((t) => t.to === pid)) out.push('ACCEPT_TRADE', 'REJECT_TRADE');
    if (s.trades.some((t) => t.from === pid)) out.push('CANCEL_TRADE');
  }
  return out;
}

export { netWorth, standings, ownedBy, ownsGroup, level, groupSpaces, isOwnable, emptySide, sameTeam, teamStandings, teamOf, teammate, teamOwnsGroup };
