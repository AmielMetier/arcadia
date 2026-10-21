// Réactions rapides pendant la partie : émotes et petites phrases (identifiants courts envoyés sur le réseau).
export const EMOTES = [
  { id: 'top', glyph: '👍' }, { id: 'lol', glyph: '😂' }, { id: 'cool', glyph: '😎' }, { id: 'oh', glyph: '😱' },
  { id: 'brain', glyph: '🧠' }, { id: 'fire', glyph: '🔥' }, { id: 'sweat', glyph: '😅' }, { id: 'grr', glyph: '😡' },
];
export const PHRASES = [
  { id: 'gg', text: 'Bien joué !' },
  { id: 'easy', text: 'Trop facile 😏' },
  { id: 'calc', text: 'T\'as une calculette ?!' },
  { id: 'oups', text: 'J\'ai glissé…' },
  { id: 'vite', text: 'Plus vite que l\'éclair ⚡' },
  { id: 'fada', text: 'T\'es fada !' },
];
const ALL = new Map([...EMOTES.map((e) => [e.id, e]), ...PHRASES.map((p) => [p.id, p])]);
export const isEmote = (id) => ALL.has(id);
export const emoteOf = (id) => ALL.get(id);

// Réaction d'un bot après une révélation (ou null). Rare, pour ne pas saouler.
export function botReaction(last, botIds, rnd = Math.random) {
  if (!last) return null;
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const res = last.results.filter((r) => botIds.includes(r.id));
  const champ = res.find((r) => r.tags.includes('eclair') || r.tags.includes('serie'));
  if (champ && rnd() < 0.45) return { from: champ.id, id: pick(['easy', 'cool', 'brain', 'vite']) };
  const miss = res.find((r) => r.raw != null && !r.ok);
  if (miss && rnd() < 0.35) return { from: miss.id, id: pick(['oups', 'sweat', 'grr', 'oh']) };
  const human = last.results.find((r) => !botIds.includes(r.id) && r.tags.includes('eclair'));
  if (human && res.length && rnd() < 0.35) return { from: pick(res).id, id: pick(['gg', 'calc', 'fada', 'top']) };
  return null;
}
