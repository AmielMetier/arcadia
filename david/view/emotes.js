// Réactions rapides pendant la partie : émotes et petites phrases (identifiants courts envoyés sur le réseau).
export const EMOTES = [
  { id: 'top', glyph: '👍' }, { id: 'lol', glyph: '😂' }, { id: 'cool', glyph: '😎' }, { id: 'oh', glyph: '😱' },
  { id: 'grr', glyph: '😡' }, { id: 'cash', glyph: '💸' }, { id: 'fire', glyph: '🔥' }, { id: 'pls', glyph: '🙏' },
];
export const PHRASES = [
  { id: 'gg', text: 'Bien joué !' },
  { id: 'ouch', text: 'Aïe, ça pique…' },
  { id: 'merci', text: 'Merci pour le loyer 😏' },
  { id: 'deal', text: 'On échange ?' },
  { id: 'vite', text: 'Allez, on joue !' },
  { id: 'chance', text: 'Quelle chance !' },
  { id: 'nissa', text: 'Nissa la bella ! ☀️' },
  { id: 'fada', text: 'T\'es fada !' },
];
const ALL = new Map([...EMOTES.map((e) => [e.id, e]), ...PHRASES.map((p) => [p.id, p])]);
export const isEmote = (id) => ALL.has(id);
export const emoteOf = (id) => ALL.get(id);

// Réaction d'un bot à ce qui vient de se passer (ou null). Aléatoire et rare : un bot ne doit pas saouler.
export function botReaction(e, botIds, rnd = Math.random) {
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const bot = (id) => botIds.includes(id);
  if (e.k === 'PAY' && e.reason === 'rent' && e.amount >= 150) {
    if (bot(e.from) && rnd() < 0.5) return { from: e.from, id: pick(['grr', 'ouch', 'oh', 'fada']) };
    if (bot(e.to) && rnd() < 0.4) return { from: e.to, id: pick(['merci', 'cash', 'cool']) };
  }
  if (e.k === 'DICE' && e.dice[0] === e.dice[1] && bot(e.player) && rnd() < 0.2) return { from: e.player, id: pick(['fire', 'chance']) };
  if (e.k === 'BANKRUPT') { const other = botIds.filter((id) => id !== e.player); if (other.length && rnd() < 0.6) return { from: pick(other), id: 'gg' }; }
  if (e.k === 'JAIL' && bot(e.player) && rnd() < 0.35) return { from: e.player, id: pick(['oh', 'pls']) };
  if (e.k === 'AUCTION_END' && e.winner != null && bot(e.winner) && rnd() < 0.3) return { from: e.winner, id: 'cool' };
  if (e.k === 'TRADE_DONE' && bot(e.trade.to) && rnd() < 0.4) return { from: e.trade.to, id: 'top' };
  return null;
}
