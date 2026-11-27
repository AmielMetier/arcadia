// Niveaux 1 à 10 : réglages de chaque mode et difficulté qui s'adapte.
export const MODES = ['pulse', 'aiguillage', 'reseau', 'double'];
export const MIN_LEVEL = 1, MAX_LEVEL = 10;
export const WINDOW = 10, EVERY = 5, UP = 0.85, DOWN = 0.75;

const clampLevel = (lv) => Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(lv) || MIN_LEVEL));
const lerp = (a, b, lv) => a + (b - a) * (clampLevel(lv) - 1) / 9;

export function params(mode, level) {
  const lv = clampLevel(level);
  switch (mode) {
    case 'pulse': return { bpm: lerp(60, 110, lv), tol: lerp(0.18, 0.09, lv), lure: lerp(0.2, 0.4, lv) };
    case 'aiguillage': return { time: lerp(2.5, 1.2, lv), gapMin: Math.round(lerp(5, 2, lv)), gapMax: Math.round(lerp(7, 4, lv)) };
    case 'reseau': return { size: lv >= 5 ? 4 : 3, len: Math.round(lerp(3, 7, lv)), node: lerp(3, 1.5, lv), flash: lerp(1.5, 0.8, lv), step: lerp(0.7, 0.45, lv) };
    case 'double': return { bpm: lerp(60, 100, lv), silence: Math.round(lerp(2, 6, lv)), life: lerp(3, 1.5, lv), every: lerp(1.6, 1.0, lv) };
    default: throw new Error('mode inconnu : ' + mode);
  }
}

// Une partie commence un cran sous le niveau enregistré.
export const startLevel = (saved) => Math.max(MIN_LEVEL, clampLevel(saved) - 1);

// Niveau à enregistrer en fin de partie. Une partie qui n'a ni monté ni baissé garde le niveau enregistré :
// sinon le cran de mise en route ferait descendre le niveau d'une partie à l'autre.
export const nextSaved = (saved, start, end) => clampLevel(end === start ? saved : end);

export const newAdapt = (level) => ({ level: clampLevel(level), win: [], n: 0 });

// Un essai de plus. Tous les EVERY essais, on regarde les WINDOW derniers.
export function adapt(st, ok) {
  const win = [...st.win, !!ok].slice(-WINDOW);
  const n = st.n + 1;
  if (n < EVERY) return { level: st.level, win, n };
  const rate = win.filter(Boolean).length / win.length;
  let level = st.level;
  if (rate > UP) level = Math.min(MAX_LEVEL, level + 1);
  else if (rate < DOWN) level = Math.max(MIN_LEVEL, level - 1);
  return level === st.level ? { level, win, n: 0 } : { level, win: [], n: 0 };
}
