// Joueur automatique : renvoie la prochaine action d'un bot, ou null s'il n'a rien à faire.
// Volontairement simple et prévisible : achète quand il garde une réserve, construit sur ses monopoles,
// enchérit jusqu'à la valeur du terrain, refuse les échanges qui donnent un monopole à l'adversaire.
import { currentPlayer } from './rules.js';
import { groupSpaces, ownsGroup, level, groupHasBuildings, ownedBy, isOwnable } from './valuation.js';

const RESERVE = 150;

function completesGroup(s, board, pid, i) {
  const sp = board.spaces[i];
  return groupSpaces(board, sp.group).every((j) => j === i || s.props[j].owner === pid);
}

function propValue(s, board, pid, i) {
  const sp = board.spaces[i];
  return sp.price * (completesGroup(s, board, pid, i) ? 1.8 : 1);
}

export function botAction(s, board, pid) {
  if (s.over) return null;
  const me = s.players.find((p) => p.id === pid);
  if (!me || me.bankrupt) return null;

  // 1) dette : vendre, hypothéquer, sinon faillite
  if (s.debts.length) {
    if (s.debts[0].from !== pid) return null;
    const mine = ownedBy(s, board, pid);
    const sellable = mine.filter((i) => board.spaces[i].type === 'street' && level(s, i) > 0)
      .filter((i) => level(s, i) === Math.max(...groupSpaces(board, board.spaces[i].group).map((j) => level(s, j))))
      .filter((i) => !s.props[i].hotel || s.bank.houses >= s.cfg.housesPerHotel);
    if (sellable.length) return { type: 'SELL_BUILDING', space: sellable[0] };
    const mortgageable = mine.filter((i) => !s.props[i].mortgaged)
      .filter((i) => board.spaces[i].type !== 'street' || !groupHasBuildings(s, board, board.spaces[i].group))
      .sort((a, b) => board.spaces[a].mortgage - board.spaces[b].mortgage);
    if (mortgageable.length) return { type: 'MORTGAGE', space: mortgageable[0] };
    return { type: 'BANKRUPT' };
  }

  // 2) enchère
  if (s.auction) {
    const au = s.auction;
    if (!au.active.includes(pid) || au.passed.includes(pid) || au.bidder === pid) return null;
    const limit = Math.min(me.cash - RESERVE / 2, propValue(s, board, pid, au.space));
    const step = au.high < 100 ? 10 : 20;
    const next = au.high + step;
    return next <= limit ? { type: 'BID', amount: next } : { type: 'PASS' };
  }

  // 3) propositions reçues
  const offer = s.trades.find((t) => t.to === pid);
  if (offer) {
    const worth = (side, owner) => side.cash + side.props.reduce((n, i) => n + propValue(s, board, owner, i), 0) + side.cards.length * 50;
    const givesMonopoly = offer.want.props.some((i) => board.spaces[i].type === 'street' && completesGroup(s, board, offer.from, i));
    const breaksMine = offer.want.props.some((i) => board.spaces[i].type === 'street' && ownsGroup(s, board, pid, board.spaces[i].group));
    const ok = !givesMonopoly && !breaksMine && worth(offer.give, pid) >= worth(offer.want, offer.from) * 1.15 && me.cash >= offer.want.cash;
    return { type: ok ? 'ACCEPT_TRADE' : 'REJECT_TRADE', trade: offer.id };
  }

  if (currentPlayer(s).id !== pid) return null;

  // 4) mon tour
  if (s.phase === 'roll') {
    if (me.inJail && s.turn.rolls === 0) {
      if (me.jailCards.length) return { type: 'USE_JAIL_CARD' };
      const early = s.round < 12;
      if (early && me.cash >= s.cfg.jailFine + 300) return { type: 'PAY_BAIL' };
    }
    return { type: 'ROLL' };
  }
  if (s.phase === 'buy') {
    const sp = board.spaces[s.pendingBuy];
    const key = completesGroup(s, board, pid, s.pendingBuy);
    if (me.cash >= sp.price && (me.cash - sp.price >= RESERVE || key)) return { type: 'BUY' };
    return { type: 'DECLINE' };
  }
  if (s.phase === 'end') {
    // construire sur le terrain le moins bâti de chaque monopole
    for (const g of Object.keys(board.groups)) {
      if (g === 'station' || g === 'utility' || !ownsGroup(s, board, pid, g)) continue;
      const sp = groupSpaces(board, g);
      if (sp.some((j) => s.props[j].mortgaged)) continue;
      const cost = board.spaces[sp[0]].houseCost;
      if (me.cash - cost < RESERVE + 50) continue;
      const lowest = sp.reduce((a, b) => (level(s, b) < level(s, a) ? b : a));
      if (s.props[lowest].hotel) continue;
      const toHotel = s.props[lowest].houses === s.cfg.housesPerHotel;
      if (toHotel ? s.bank.hotels < 1 : s.bank.houses < 1) continue;
      return { type: 'BUILD', space: lowest };
    }
    // lever une hypothèque si l'argent abonde
    const mortgaged = ownedBy(s, board, pid).filter((i) => s.props[i].mortgaged);
    for (const i of mortgaged) {
      const sp = board.spaces[i];
      if (me.cash > sp.mortgage * 1.1 + 400) return { type: 'UNMORTGAGE', space: i };
    }
    return { type: 'END_TURN' };
  }
  return null;
}

export { isOwnable };
