// Joueurs automatiques, en trois niveaux :
//  - facile : achète un peu au hasard, construit peu, ne propose jamais d'échange ;
//  - normal : règles simples et prévisibles (bot-normal.js) ;
//  - expert : valeur stratégique des terrains (compléter / bloquer un monopole), réserve adaptée aux loyers
//    qui le menacent, constructions guidées par le modèle de Markov, échanges proposés et évalués,
//    reste en prison quand le plateau devient dangereux.
// botAction renvoie la prochaine action d'un bot, ou null. `memory` (objet modifiable) garde la trace
// des échanges déjà proposés, pour ne pas harceler les autres joueurs.
import { currentPlayer } from './rules.js';
import { groupSpaces, ownsGroup, level, groupHasBuildings, ownedBy, isOwnable, sameTeam, teammate } from './valuation.js';
import { landingProbabilities } from './markov.js';
import { normalBot } from './bot-normal.js';

export const BOT_LEVELS = ['facile', 'normal', 'expert'];

export function botAction(s, board, pid, { level: lvl = 'normal', memory = {} } = {}) {
  // une proposition envoyée attend sa réponse avant la fin du tour (elle expirerait sinon)
  if (!s.over && !s.debts.length && !s.auction && s.trades.some((t) => t.from === pid) && currentPlayer(s).id === pid && s.phase === 'end') return null;
  if (s.cfg.teams) { const a = teamPlay(s, board, pid, memory); if (a) return a; }
  if (lvl === 'expert') return expertBot(s, board, pid, memory);
  if (lvl === 'facile') return easyBot(s, board, pid);
  return normalBot(s, board, pid);
}

/* ------------------------------------------------------------------ outils */
const P = (s, id) => s.players.find((p) => p.id === id);
// pseudo-aléa déterministe (même décision si on rejoue la même situation)
const chance = (s, pid, salt) => { let h = (s.seq * 2654435761 + pid * 40503 + salt * 97) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; return (h % 10000) / 10000; };
const isStreet = (board, i) => board.spaces[i].type === 'street';

function groupStatus(s, board, g, pid) {
  const sp = groupSpaces(board, g);
  const mine = sp.filter((j) => s.props[j].owner === pid).length;
  const bank = sp.filter((j) => s.props[j].owner == null).length;
  const byOwner = {};
  for (const j of sp) { const o = s.props[j].owner; if (o != null && o !== pid && !sameTeam(s, o, pid)) byOwner[o] = (byOwner[o] || 0) + 1; }
  // en 2 contre 2, les terrains du coéquipier comptent comme les siens (l'équipe les regroupera)
  const team = sp.filter((j) => sameTeam(s, s.props[j].owner, pid)).length;
  return { total: sp.length, mine: mine + team, bank, byOwner };
}

// Valeur stratégique d'un terrain pour `pid` (s'il le recevait)
function stratValue(s, board, pid, i) {
  const sp = board.spaces[i], pr = s.props[i];
  let v = sp.price;
  if (sp.type === 'street') {
    const g = groupStatus(s, board, sp.group, pid);
    const owned = g.mine + (pr.owner === pid ? 0 : 1);
    if (owned === g.total) v *= 2.6;                                      // complète un monopole
    else if (owned === g.total - 1 && g.bank >= 1) v *= 1.45;             // en approche, le reste est à la banque
    else if (owned >= 2) v *= 1.2;
    // bloquer un adversaire à qui il ne manque que ce terrain
    for (const [o, n] of Object.entries(g.byOwner)) if (+o !== pr.owner && n === g.total - 1 && pr.owner !== +o) v = Math.max(v, sp.price * 1.9);
    if (pr.owner != null && pr.owner !== pid) {
      // le céder casse-t-il un monopole du propriétaire ? (rare : on ne construit pas sur un groupe incomplet)
      const og = groupStatus(s, board, sp.group, pr.owner);
      if (og.mine === og.total) v *= 1.5;
    }
  } else if (sp.type === 'station') {
    const n = groupSpaces(board, sp.group).filter((j) => s.props[j].owner === pid && j !== i).length;
    v *= 1 + 0.3 * n;
  } else v *= groupSpaces(board, sp.group).some((j) => j !== i && s.props[j].owner === pid) ? 1.2 : 0.75;
  if (pr.mortgaged) v -= sp.mortgage * 1.1;
  return v;
}

// Loyer qu'un joueur risque de payer au prochain tour (espérance + pire cas pondéré)
function exposure(s, board, pid) {
  const me = P(s, pid), pi = landingProbabilities(board);
  let worst = 0, expected = 0;
  for (let d = 2; d <= 12; d++) {
    const pd = (6 - Math.abs(7 - d)) / 36, i = (me.pos + d) % 40, pr = s.props[i], sp = board.spaces[i];
    if (!pr || pr.owner == null || pr.owner === pid || pr.mortgaged || sameTeam(s, pr.owner, pid)) continue;
    let rent;
    if (sp.type === 'street') rent = pr.hotel ? sp.rent[5] : pr.houses ? sp.rent[pr.houses] : sp.rent[0] * (ownsGroup(s, board, pr.owner, sp.group) ? 2 : 1);
    else if (sp.type === 'station') rent = sp.rent[groupSpaces(board, sp.group).filter((j) => s.props[j].owner === pr.owner).length - 1];
    else rent = 7 * sp.diceMultiplier[Math.min(2, groupSpaces(board, sp.group).filter((j) => s.props[j].owner === pr.owner).length) - 1];
    worst = Math.max(worst, rent); expected += pd * rent;
  }
  void pi;
  return { worst, expected };
}

function reserveFor(s, board, pid) {
  const ex = exposure(s, board, pid);
  const base = s.round < 6 ? 60 : 150;
  return Math.min(900, Math.max(base, ex.expected * 2.5, ex.worst * 0.45));
}

function debtAction(s, board, pid, smart) {
  const mine = ownedBy(s, board, pid);
  const pi = landingProbabilities(board);
  const sellable = mine.filter((i) => isStreet(board, i) && level(s, i) > 0)
    .filter((i) => level(s, i) === Math.max(...groupSpaces(board, board.spaces[i].group).map((j) => level(s, j))))
    .filter((i) => !s.props[i].hotel || s.bank.houses >= s.cfg.housesPerHotel);
  // l'expert hypothèque d'abord ce qui rapporte le moins, et ne vend ses maisons qu'en dernier recours
  const mortgageable = mine.filter((i) => !s.props[i].mortgaged)
    .filter((i) => !isStreet(board, i) || !groupHasBuildings(s, board, board.spaces[i].group))
    .sort((a, b) => (smart ? pi[a] * (ownsGroup(s, board, pid, board.spaces[a].group) ? 3 : 1) - pi[b] * (ownsGroup(s, board, pid, board.spaces[b].group) ? 3 : 1) : board.spaces[a].mortgage - board.spaces[b].mortgage));
  if (smart && mortgageable.length) return { type: 'MORTGAGE', space: mortgageable[0] };
  if (sellable.length) return { type: 'SELL_BUILDING', space: sellable.sort((a, b) => pi[a] - pi[b])[0] };
  if (mortgageable.length) return { type: 'MORTGAGE', space: mortgageable[0] };
  return { type: 'BANKRUPT' };
}

function sideValue(s, board, side, receiver) {
  return side.cash + side.props.reduce((n, i) => n + stratValue(s, board, receiver, i), 0) + side.cards.length * 40;
}
function givesMonopoly(s, board, props, to) {
  return props.some((i) => isStreet(board, i) && groupSpaces(board, board.spaces[i].group).every((j) => j === i || props.includes(j) || s.props[j].owner === to || sameTeam(s, s.props[j].owner, to)));
}

/* ------------------------------------------------------------------ 2 contre 2 : jeu d'équipe (tous niveaux) */
// Ne renvoie une action que pour ce qui concerne le coéquipier ; sinon le bot joue selon son niveau.
function teamPlay(s, board, pid, memory) {
  if (s.over) return null;
  const me = P(s, pid), mate = teammate(s, pid);
  if (!me || me.bankrupt || !mate) return null;
  // proposition du coéquipier : acceptée sauf si elle casse un de mes monopoles ou me laisse sans le sou
  const offer = s.trades.find((t) => t.to === pid && t.from === mate.id);
  if (offer) {
    const breaks = offer.want.props.some((i) => isStreet(board, i) && ownsGroup(s, board, pid, board.spaces[i].group) && !givesMonopoly(s, board, offer.want.props, mate.id));
    const ok = !breaks && me.cash - offer.want.cash >= 50;
    return { type: ok ? 'ACCEPT_TRADE' : 'REJECT_TRADE', trade: offer.id };
  }
  // enchère : on ne surenchérit pas sur son coéquipier
  const au = s.auction;
  if (au && au.bidder === mate.id && au.active.includes(pid) && !au.passed.includes(pid)) return { type: 'PASS' };
  if (mate.bankrupt || s.debts.length || au || currentPlayer(s).id !== pid || s.phase !== 'end') return null;
  if (s.trades.some((t) => t.from === pid)) return null;
  // regrouper un groupe de couleur détenu à deux : celui qui en a le plus le récupère (à égalité, le plus riche)
  for (const g of Object.keys(board.groups)) {
    if (g === 'station' || g === 'utility') continue;
    const sp = groupSpaces(board, g);
    if (sp.some((j) => s.props[j].owner !== pid && s.props[j].owner !== mate.id) || groupHasBuildings(s, board, g)) continue;
    const mine = sp.filter((j) => s.props[j].owner === pid), theirs = sp.filter((j) => s.props[j].owner === mate.id);
    if (!mine.length || !theirs.length) continue;
    const key = `team:${g}:${s.turnCount >> 3}`;
    if (memory[key]) continue;
    memory[key] = true;
    const iKeep = mine.length > theirs.length || (mine.length === theirs.length && me.cash >= mate.cash);
    const none = { cash: 0, props: [], cards: [] };
    return iKeep ? { type: 'PROPOSE_TRADE', to: mate.id, give: none, want: { ...none, props: theirs } }
      : { type: 'PROPOSE_TRADE', to: mate.id, give: { ...none, props: mine }, want: none };
  }
  // coup de pouce : un coéquipier presque à sec reçoit un peu d'argent
  const key = `help:${s.turnCount}`;
  if (mate.cash < 150 && me.cash > 700 && !memory[key]) {
    memory[key] = true;
    return { type: 'PROPOSE_TRADE', to: mate.id, give: { cash: Math.min(300, Math.floor((me.cash - 400) / 2 / 10) * 10), props: [], cards: [] }, want: { cash: 0, props: [], cards: [] } };
  }
  return null;
}

/* ------------------------------------------------------------------ expert */
function expertBot(s, board, pid, memory) {
  if (s.over) return null;
  const me = P(s, pid);
  if (!me || me.bankrupt) return null;
  if (s.debts.length) return s.debts[0].from === pid ? debtAction(s, board, pid, true) : null;
  const reserve = reserveFor(s, board, pid);

  if (s.auction) {
    const au = s.auction;
    if (!au.active.includes(pid) || au.passed.includes(pid) || au.bidder === pid) return null;
    const limit = Math.min(me.cash - reserve * 0.5, stratValue(s, board, pid, au.space) * 1.05);
    const step = au.high < 100 ? 10 : au.high < 300 ? 20 : 50;
    return au.high + step <= limit ? { type: 'BID', amount: au.high + step } : { type: 'PASS' };
  }

  const offer = s.trades.find((t) => t.to === pid);
  if (offer) {
    const gain = sideValue(s, board, offer.give, pid), loss = sideValue(s, board, offer.want, offer.from);
    const dangerous = givesMonopoly(s, board, offer.want.props, offer.from) && !givesMonopoly(s, board, offer.give.props, pid);
    const ok = !dangerous && gain >= loss * 1.08 && me.cash - offer.want.cash >= Math.min(reserve, 200);
    return { type: ok ? 'ACCEPT_TRADE' : 'REJECT_TRADE', trade: offer.id };
  }

  if (currentPlayer(s).id !== pid) return null;

  if (s.phase === 'roll') {
    if (me.inJail && s.turn.rolls === 0) {
      // en fin de partie, la prison protège des loyers : on y reste si les adversaires ont bâti
      const danger = s.players.some((q) => q.id !== pid && !q.bankrupt && ownedBy(s, board, q.id).some((i) => level(s, i) > 0));
      if (!danger) {
        if (me.jailCards.length) return { type: 'USE_JAIL_CARD' };
        if (me.cash >= s.cfg.jailFine + reserve) return { type: 'PAY_BAIL' };
      }
    }
    return { type: 'ROLL' };
  }
  if (s.phase === 'buy') {
    const sp = board.spaces[s.pendingBuy], v = stratValue(s, board, pid, s.pendingBuy);
    if (me.cash >= sp.price && (me.cash - sp.price >= reserve || v >= sp.price * 1.4)) return { type: 'BUY' };
    return { type: 'DECLINE' };
  }
  if (s.phase === 'end') {
    // 1) construire là où une maison rapporte le plus (modèle de Markov)
    const pi = landingProbabilities(board), opp = s.players.filter((q) => !q.bankrupt && q.id !== pid).length;
    let best = null;
    for (const g of Object.keys(board.groups)) {
      if (g === 'station' || g === 'utility' || !ownsGroup(s, board, pid, g)) continue;
      const sp = groupSpaces(board, g);
      if (sp.some((j) => s.props[j].mortgaged)) continue;
      const minLv = Math.min(...sp.map((j) => level(s, j)));
      for (const j of sp) {
        const pr = s.props[j], spc = board.spaces[j];
        if (pr.hotel || level(s, j) !== minLv) continue;
        const toHotel = pr.houses === s.cfg.housesPerHotel;
        if (toHotel ? s.bank.hotels < 1 : s.bank.houses < 1) continue;
        const cur = pr.houses ? spc.rent[pr.houses] : spc.rent[0] * 2;
        const nxt = toHotel ? spc.rent[5] : spc.rent[pr.houses + 1];
        const gain = (pi[j] * (nxt - cur) * opp) / spc.houseCost;
        if (!best || gain > best.gain) best = { j, gain, cost: spc.houseCost };
      }
    }
    if (best && me.cash - best.cost >= reserve) return { type: 'BUILD', space: best.j };
    // 2) lever une hypothèque sur un monopole, puis ailleurs, si l'argent abonde
    const morts = ownedBy(s, board, pid).filter((i) => s.props[i].mortgaged)
      .sort((a, b) => Number(ownsGroup(s, board, pid, board.spaces[b].group)) - Number(ownsGroup(s, board, pid, board.spaces[a].group)));
    for (const i of morts) { const c = board.spaces[i].mortgage * 1.1; if (me.cash - c >= reserve + 150) return { type: 'UNMORTGAGE', space: i }; }
    // 3) proposer un échange pour compléter un monopole (au plus un par tour, sans harceler)
    if (!s.trades.some((t) => t.from === pid)) {
      const prop = tradeIdea(s, board, pid, reserve, memory);
      if (prop) return prop;
    }
    return { type: 'END_TURN' };
  }
  return null;
}

function tradeIdea(s, board, pid, reserve, memory) {
  const me = P(s, pid);
  for (const g of Object.keys(board.groups)) {
    if (g === 'station' || g === 'utility') continue;
    const sp = groupSpaces(board, g), st = groupStatus(s, board, g, pid);
    if (st.mine === 0 || st.mine === st.total || st.bank > 0) continue;
    const owners = Object.keys(st.byOwner).map(Number);
    if (owners.length !== 1) continue;                     // un seul adversaire détient le reste
    const other = owners[0], wanted = sp.filter((j) => s.props[j].owner === other);
    if (wanted.some((j) => level(s, j) > 0)) continue;
    const key = `${pid}>${other}:${wanted.join(',')}`;
    const mem = memory[key] || { tries: 0, at: -99 };
    if (mem.tries >= 3 || s.turnCount - mem.at < 8) continue;
    const base = wanted.reduce((n, j) => n + board.spaces[j].price, 0);
    let cash = Math.round(base * (1.35 + 0.3 * mem.tries) / 10) * 10;
    // monnaie d'échange : un terrain qui intéresse l'autre sans lui donner de monopole
    const mine = ownedBy(s, board, pid).filter((j) => !sp.includes(j) && !(isStreet(board, j) && groupHasBuildings(s, board, board.spaces[j].group)));
    const sweet = mine.filter((j) => !givesMonopoly(s, board, [j], other) && !(isStreet(board, j) && groupStatus(s, board, board.spaces[j].group, pid).mine >= 2))
      .sort((a, b) => stratValue(s, board, other, b) - stratValue(s, board, other, a))[0];
    const give = { cash: 0, props: [], cards: [] };
    if (sweet != null) { give.props.push(sweet); cash = Math.max(0, cash - Math.round(board.spaces[sweet].price * 0.8 / 10) * 10); }
    if (me.cash - cash < Math.min(reserve, 250)) cash = Math.max(0, me.cash - Math.min(reserve, 250));
    give.cash = cash;
    if (sideValue(s, board, give, other) < base * 1.1) continue; // offre trop faible pour être honnête
    memory[key] = { tries: mem.tries + 1, at: s.turnCount };
    return { type: 'PROPOSE_TRADE', to: other, give, want: { cash: 0, props: wanted, cards: [] } };
  }
  return null;
}

/* ------------------------------------------------------------------ facile */
function easyBot(s, board, pid) {
  if (s.over) return null;
  const me = P(s, pid);
  if (!me || me.bankrupt) return null;
  if (s.debts.length) return s.debts[0].from === pid ? debtAction(s, board, pid, false) : null;
  if (s.auction) {
    const au = s.auction;
    if (!au.active.includes(pid) || au.passed.includes(pid) || au.bidder === pid) return null;
    const limit = Math.min(me.cash - 50, board.spaces[au.space].price * 0.8);
    return au.high + 10 <= limit ? { type: 'BID', amount: au.high + 10 } : { type: 'PASS' };
  }
  const offer = s.trades.find((t) => t.to === pid);
  if (offer) {
    const fair = offer.give.cash + offer.give.props.reduce((n, i) => n + board.spaces[i].price, 0)
      >= offer.want.cash + offer.want.props.reduce((n, i) => n + board.spaces[i].price, 0) * 1.2;
    return { type: fair && me.cash >= offer.want.cash ? 'ACCEPT_TRADE' : 'REJECT_TRADE', trade: offer.id };
  }
  if (currentPlayer(s).id !== pid) return null;
  if (s.phase === 'roll') {
    if (me.inJail && s.turn.rolls === 0 && me.jailCards.length) return { type: 'USE_JAIL_CARD' };
    return { type: 'ROLL' };
  }
  if (s.phase === 'buy') {
    const sp = board.spaces[s.pendingBuy];
    return me.cash - sp.price >= 50 && chance(s, pid, 1) < 0.6 ? { type: 'BUY' } : { type: 'DECLINE' };
  }
  if (s.phase === 'end') {
    if (chance(s, pid, 2) < 0.35) {
      for (const g of Object.keys(board.groups)) {
        if (g === 'station' || g === 'utility' || !ownsGroup(s, board, pid, g)) continue;
        const sp = groupSpaces(board, g);
        if (sp.some((j) => s.props[j].mortgaged)) continue;
        const lowest = sp.reduce((a, b) => (level(s, b) < level(s, a) ? b : a));
        if (s.props[lowest].hotel) continue;
        const toHotel = s.props[lowest].houses === s.cfg.housesPerHotel;
        if ((toHotel ? s.bank.hotels : s.bank.houses) < 1) continue;
        if (me.cash - board.spaces[lowest].houseCost >= 100) return { type: 'BUILD', space: lowest };
      }
    }
    return { type: 'END_TURN' };
  }
  return null;
}

export { isOwnable };
