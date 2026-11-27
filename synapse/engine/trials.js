// Tirage des essais de chaque mode (aléa reproductible passé en argument).

// Pulse : formes et couleurs des signaux. Un leurre change la forme ET la couleur.
export const SHAPES = ['rond', 'carré', 'triangle', 'losange'];
export const COLORS = [
  { id: 'bleu', hex: '#38BDF8' }, { id: 'ambre', hex: '#FBBF24' },
  { id: 'violet', hex: '#A78BFA' }, { id: 'blanc', hex: '#F8FAFC' },
];
export const pulseTarget = (rng) => ({ shape: rng.pick(SHAPES), color: rng.int(COLORS.length) });
export function pulseSignal(rng, target, lureShare) {
  if (!rng.chance(lureShare)) return { lure: false, shape: target.shape, color: target.color };
  const shapes = SHAPES.filter((s) => s !== target.shape);
  const colors = COLORS.map((_, i) => i).filter((i) => i !== target.color);
  return { lure: true, shape: rng.pick(shapes), color: rng.pick(colors) };
}

// Aiguillage : rond / carré, couleur 0 / 1. Règle 'color' ou 'shape'.
export const figure = (rng) => ({ shape: rng.chance(0.5) ? 'rond' : 'carré', color: rng.int(2) });
export const sideOf = (fig, rule) => (rule === 'color' ? (fig.color === 0 ? 'left' : 'right') : (fig.shape === 'rond' ? 'left' : 'right'));
export const ruleGap = (rng, min, max) => rng.range(Math.min(min, max), Math.max(min, max));

// Réseau : séquence sans répétition immédiate, épreuve « l'intrus ».
export function sequence(rng, cells, len) {
  const out = [];
  while (out.length < len) {
    const c = rng.int(cells);
    if (c !== out[out.length - 1]) out.push(c);
  }
  return out;
}
export function oddOne(rng, count) {
  const base = rng.pick(['rond', 'carré', 'losange']);
  const other = rng.pick(['rond', 'carré', 'losange'].filter((s) => s !== base));
  const odd = rng.int(count);
  return { odd, shapes: Array.from({ length: count }, (_, i) => (i === odd ? other : base)) };
}

// Double Tempo : consigne des pastilles et nombres tirés (environ une sur deux à cliquer).
export const DOT_RULES = [
  { id: 'pairs', label: 'les nombres pairs', test: (n) => n % 2 === 0 },
  { id: 'impairs', label: 'les nombres impairs', test: (n) => n % 2 === 1 },
  { id: 'grands', label: 'les nombres plus grands que 5', test: (n) => n > 5 },
  { id: 'petits', label: 'les nombres plus petits que 5', test: (n) => n < 5 },
];
export const ruleById = (id) => DOT_RULES.find((r) => r.id === id) || DOT_RULES[0];
export function dotNumber(rng, rule) {
  const want = rng.chance(0.5);
  const pool = [1, 2, 3, 4, 6, 7, 8, 9].filter((n) => rule.test(n) === want);
  return rng.pick(pool);
}
// Battements entendus avant chaque silence (le silence dure `silence` temps).
export const soundRun = (rng) => rng.range(6, 10);
