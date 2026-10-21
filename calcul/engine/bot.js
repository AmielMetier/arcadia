// Bots de Tête de Calcul : pour chaque question, un délai de réponse et une réponse (juste ou plausible).
// Ils ne « calculent » pas : ils connaissent la réponse et se trompent selon leur niveau et la catégorie.
export const BOT_LEVELS = ['facile', 'normal', 'expert'];
const SKILL = {
  facile: { acc: 0.55, speed: 0.62, skip: 0.15 },
  normal: { acc: 0.75, speed: 0.45, skip: 0.07 },
  expert: { acc: 0.9, speed: 0.3, skip: 0.02 },
};
const HARD = { base: 1, astuce: 0.85, theorie: 0.85, fraction: 0.85, suite: 0.85, estim: 0.9, compte: 0.6, vf: 0.95, compare: 0.9, equation: 0.85, geo: 0.8, devinette: 0.7, chartier: 0.88 };

// q : question complète (avec la réponse) ; renvoie { delay (ms), raw } ou null (le bot sèche)
export function botAnswer(q, level, rnd = Math.random) {
  const k = SKILL[level] || SKILL.normal;
  const limit = q.time * 1000;
  if (rnd() < k.skip * (q.cat === 'compte' ? 2.5 : q.cat === 'devinette' ? 1.5 : 1)) return null;
  // temps de réponse : autour de speed × limite, jamais avant 1,2 s
  const spread = 0.55 + rnd() * 0.9;
  const delay = Math.max(1200, Math.min(limit - 300, limit * k.speed * spread * (q.cat === 'base' ? 0.8 : 1)));
  const right = rnd() < k.acc * (HARD[q.cat] || 1);
  if (q.isChartier || q.input === 'chartier') {
    if (right) return { delay, raw: q.correctChoice || q.answer };
    if (q.choices && q.choices.length) {
      const wrongs = q.choices.filter((c) => c !== q.correctChoice);
      const picked = wrongs[Math.floor(rnd() * wrongs.length)] || wrongs[0];
      return { delay, raw: picked };
    }
    return { delay, raw: '0' };
  }
  if (q.input === 'choice') return { delay: delay * 0.7 + 600, raw: String(right ? q.answer : (q.answer + 1 + Math.floor(rnd() * (q.choices.length - 1))) % q.choices.length) };
  if (q.input === 'expr') {
    if (right) return { delay, raw: q.sol };
    const [a, b] = q.nums; // une tentative ratée, mais qui utilise bien les nombres
    return { delay, raw: `${a} + ${b}` + (q.nums[2] ? ` × ${q.nums[2]}` : '') };
  }
  if (right) return { delay, raw: String(q.tol ? Math.round(q.answer * (1 + (rnd() - 0.5) * q.tol)) : q.answer) };
  return { delay, raw: String(nearMiss(q.answer, rnd)) };
}

// Erreur crédible : une retenue oubliée, une dizaine de travers…
function nearMiss(n, rnd) {
  if (!Number.isInteger(n)) return Math.round((n + (rnd() < 0.5 ? 0.25 : 0.5)) * 100) / 100;
  const mag = Math.abs(n) >= 1000 ? 100 : Math.abs(n) >= 100 ? 10 : 1;
  let d = (1 + Math.floor(rnd() * 3)) * mag * (rnd() < 0.5 ? -1 : 1);
  if (n + d < 0 || d === 0) d = mag;
  return n + d;
}

// Sabotage : le bot vise le premier du classement (lui excepté), pas à chaque fois
export function botSabotage(state, botId, rnd = Math.random) {
  const me = state.players.find((p) => p.id === botId);
  const attack = me && me.powers.find((pw) => pw !== 'shield');
  if (!attack || rnd() < 0.35) return null;
  const others = state.players.filter((p) => p.id !== botId && !(state.curses[p.id] || []).some((c) => c.power === attack));
  if (!others.length) return null;
  const target = others.sort((a, b) => b.score - a.score)[0];
  return { power: attack, target: target.id };
}
