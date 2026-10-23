// Bots de Tête de Calcul : pour chaque question, un délai de réponse et une réponse (juste ou plausible).
// Ils ne « calculent » pas : ils connaissent la réponse et se trompent selon leur niveau et la catégorie.
export const BOT_LEVELS = ['facile', 'normal', 'expert'];
const SKILL = {
  facile: { acc: 0.55, speed: 0.62, skip: 0.15 },
  normal: { acc: 0.75, speed: 0.45, skip: 0.07 },
  expert: { acc: 0.9, speed: 0.3, skip: 0.02 },
};
const HARD = { base: 1, astuce: 0.85, theorie: 0.85, fraction: 0.85, suite: 0.85, estim: 0.9, compte: 0.6, vf: 0.95, compare: 0.9, equation: 0.85, geo: 0.8, devinette: 0.7, visuel: 0.8 };

// q : question complète (avec la réponse) ; renvoie { delay (ms), raw } ou null (le bot sèche)
// (pour le code : { delay, raw, passed }, le nombre de tests que son programme réussit)
export function botAnswer(q, level, rnd = Math.random) {
  const k = SKILL[level] || SKILL.normal;
  const limit = q.time * 1000;
  if (rnd() < k.skip * (q.cat === 'compte' ? 2.5 : q.cat === 'devinette' ? 1.5 : 1)) return null;
  // temps de réponse : autour de speed × limite, jamais avant 1,2 s
  const spread = 0.55 + rnd() * 0.9;
  const delay = Math.max(1200, Math.min(limit - 300, limit * k.speed * spread * (q.cat === 'base' ? 0.8 : 1)));
  // The Candidate : plus le tour est avancé, plus les bots se trompent
  const right = rnd() < k.acc * (q.isChartier ? [1, 0.97, 0.86, 0.72][q.tier || 2] : HARD[q.cat] || 1);
  if (q.input === 'code') {
    // un bot code en 30 s à 2 min selon son niveau ; quand il se trompe, quelques tests passent quand même
    const T = q.tests.length;
    const passed = right ? T : rnd() < 0.6 ? Math.floor(rnd() * T) : 0;
    return { delay: Math.min(limit - 5000, limit * (0.15 + k.speed * 0.5) * (0.7 + rnd() * 0.6)), raw: '# bot', passed };
  }
  // une mauvaise réponse tombe souvent dans le piège, comme un vrai candidat
  const trapped = !right && rnd() < 0.35;
  if (q.input === 'choice') {
    if (trapped && q.trap >= 0) return { delay: delay * 0.7 + 600, raw: String(q.trap) };
    return { delay: delay * 0.7 + 600, raw: String(right ? q.answer : (q.answer + 1 + Math.floor(rnd() * (q.choices.length - 1))) % q.choices.length) };
  }
  if (trapped && q.traps && q.traps.length) return { delay, raw: String(q.traps[Math.floor(rnd() * q.traps.length)]) };
  if (q.tolMode === 'factor') {
    // ordre de grandeur : juste = dans le facteur toléré, faux = bien au-delà
    const f = right ? Math.pow(q.tol, (rnd() - 0.5) * 1.2) : Math.pow(q.tol, (rnd() < 0.5 ? -1 : 1) * (1.5 + rnd()));
    return { delay, raw: String(+(q.answer * f).toPrecision(3)) };
  }
  if (q.input === 'expr') {
    if (right) return { delay, raw: q.sol };
    const [a, b] = q.nums; // une tentative ratée, mais qui utilise bien les nombres
    return { delay, raw: `${a} + ${b}` + (q.nums[2] ? ` × ${q.nums[2]}` : '') };
  }
  if (right) return { delay, raw: String(q.tol ? (Number.isInteger(q.answer) ? Math.round : (x) => +x.toPrecision(3))(q.answer * (1 + (rnd() - 0.5) * q.tol)) : q.answer) };
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
