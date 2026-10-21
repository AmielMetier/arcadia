// Règles de Tête de Calcul : fonctions pures, sans DOM ni réseau (testées sous Node par tools/test-calcul.mjs).
// L'hôte appelle ces fonctions avec l'heure courante ; les vues ne font qu'afficher l'état.
//
// Phases : 'intro' (compte à rebours) → 'question' → 'reveal' → 'question'… → 'over'
// Pendant 'question', les réponses (valeur, juste ou non) restent chez l'hôte : publicState() les masque.
import { CATS, DIFFS, THEMES, planCats, makeQuestion, publicQuestion, fmt } from './questions.js';
import { parseNumber, evalExpr, usesOnly } from './expr.js';

export const MODES = {
  classic: { label: 'Classique', desc: 'Tout le monde répond, les plus rapides marquent plus.' },
  peril:   { label: 'Péril', desc: 'Une erreur coûte des points : ne tente pas n\'importe quoi.' },
  eclair:  { label: 'Éclair', desc: 'Seul le premier qui trouve marque. Une erreur et tu es bloqué.' },
};
export const LENGTHS = [10, 15, 20];
export const INTRO_MS = 3500;
export const REVEAL_MS = 5200;
const GRACE_MS = 400; // réponse arrivée juste après la fin (latence réseau)

// Réglages du salon → configuration validée
export function makeConfig(s = {}) {
  return {
    mode: MODES[s.mode] ? s.mode : 'classic',
    len: LENGTHS.includes(Number(s.len)) ? Number(s.len) : 10,
    diff: DIFFS.includes(s.diff) ? s.diff : 'normal',
    theme: THEMES[s.theme] ? s.theme : 'mix',
    finale: s.finale == null ? true : Number(s.finale) === 1,
  };
}

export function createGame({ players, cfg, seed, now }) {
  if (!players.length) throw new Error('Aucun joueur');
  const c = makeConfig(cfg);
  return {
    v: 1, seed, cfg: c, startedAt: now,
    cats: planCats(seed, c.len, c.theme),
    players: players.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: !!p.bot,
      score: 0, streak: 0, bestStreak: 0, right: 0, wrong: 0, silent: 0, fastest: null, totalMs: 0, firsts: 0, byCat: {} })),
    idx: -1, phase: 'intro', endsAt: now + INTRO_MS, q: null, qAt: 0, answers: {}, last: null, history: [], ranking: null,
  };
}

const clone = (s) => JSON.parse(JSON.stringify(s));
export const isFinal = (s, idx = s.idx) => s.cfg.finale && idx === s.cfg.len - 1;
// Question n° idx ; si son texte est déjà sorti dans la partie, on en tire une autre (toujours de façon reproductible)
export function fullQuestion(s, idx = s.idx) {
  const seen = new Set(s.history.filter((h) => h.idx < idx).map((h) => h.text));
  let q;
  for (let salt = 0; salt < 8; salt++) { q = makeQuestion(s.seed, idx, s.cats[idx], s.cfg.diff, salt); if (!seen.has(q.text)) break; }
  return q;
}

// Question suivante (ou fin de partie)
export function nextQuestion(state, now) {
  const s = clone(state);
  if (s.idx + 1 >= s.cfg.len) return finish(s);
  s.idx++;
  const q = fullQuestion(s);
  s.q = { ...publicQuestion(q), n: s.idx + 1, pts: CATS[q.cat].pts * (isFinal(s) ? 2 : 1), final: isFinal(s) };
  s.phase = 'question'; s.qAt = now; s.endsAt = now + q.time * 1000; s.answers = {}; s.last = null;
  return s;
}

// Relance la question en cours (nouvel hôte après une migration : les réponses déjà données sont perdues)
export function restartQuestion(state, now) {
  const s = clone(state);
  if (s.phase !== 'question') return s;
  s.qAt = now; s.endsAt = now + s.q.time * 1000; s.answers = {};
  return s;
}

// Justesse d'une saisie
export function check(q, raw) {
  if (q.input === 'expr') {
    const n = parseNumber(raw);
    if (n != null) return { ok: false, error: 'Écris le calcul, pas seulement le résultat' };
    const e = evalExpr(raw);
    if (!e.ok) return { ok: false, error: e.error };
    if (!usesOnly(e.nums, q.nums)) return { ok: false, error: 'Utilise seulement les nombres proposés, une fois chacun' };
    return { ok: e.value.d === 1 && e.value.n === q.target, value: e.value.d === 1 ? e.value.n : e.value.n / e.value.d };
  }
  const n = parseNumber(raw);
  if (n == null) return { ok: false, error: 'Ce n\'est pas un nombre' };
  const ok = q.tol ? Math.abs(n - q.answer) <= q.tol * Math.abs(q.answer) : n === q.answer;
  return { ok, value: n };
}

// Une réponse de joueur → { ok, state, done } ; done : la question peut être révélée tout de suite
export function answer(state, { by, raw, idx, now }) {
  if (state.phase !== 'question') return { ok: false, error: 'Pas de question en cours' };
  if (idx != null && idx !== state.idx) return { ok: false, error: 'Trop tard, question suivante !' };
  const p = state.players.find((q) => q.id === by);
  if (!p) return { ok: false, error: 'Tu ne joues pas cette partie' };
  if (state.answers[by]) return { ok: false, error: 'Tu as déjà répondu' };
  if (now > state.endsAt + GRACE_MS) return { ok: false, error: 'Temps écoulé' };
  const q = fullQuestion(state);
  const c = check(q, String(raw ?? '').slice(0, 60));
  // saisie illisible : on prévient le joueur sans lui compter de réponse (sauf en Éclair, où il faut assumer)
  if (c.error && state.cfg.mode !== 'eclair') return { ok: false, error: c.error, soft: true };
  const s = clone(state);
  s.answers[by] = { at: Math.max(0, Math.min(now, s.endsAt) - s.qAt), raw: String(raw ?? '').slice(0, 40), ok: !!c.ok };
  const active = s.players.map((x) => x.id);
  const all = active.every((id) => s.answers[id]);
  const done = all || (s.cfg.mode === 'eclair' && c.ok);
  return { ok: true, state: s, done, right: !!c.ok };
}

// Calcul des points de la question et passage en révélation
export function reveal(state, now) {
  if (state.phase !== 'question') return state;
  const s = clone(state);
  const q = fullQuestion(s);
  const base = CATS[q.cat].pts * 100 * (isFinal(s) ? 2 : 1);
  const limit = q.time * 1000;
  const correct = Object.entries(s.answers).filter(([, a]) => a.ok).sort((a, b) => a[1].at - b[1].at).map(([id]) => +id);
  const results = s.players.map((p) => {
    const a = s.answers[p.id];
    const r = { id: p.id, raw: a ? a.raw : null, ok: !!(a && a.ok), at: a ? a.at : null, pts: 0, tags: [] };
    const cat = (p.byCat[q.cat] = p.byCat[q.cat] || { n: 0, ok: 0 });
    cat.n++;
    if (r.ok) {
      const rank = correct.indexOf(p.id);
      if (s.cfg.mode === 'eclair') { r.pts = rank === 0 ? base : 0; }
      else {
        r.pts = Math.round((base * (0.5 + 0.5 * Math.max(0, 1 - a.at / limit))) / 10) * 10;
        if (rank === 0 && correct.length > 1) { r.pts += 50; r.tags.push('eclair'); }
      }
      p.streak++; p.bestStreak = Math.max(p.bestStreak, p.streak);
      if (p.streak >= 3 && s.cfg.mode !== 'eclair') { const b = Math.min(100, 25 * (p.streak - 2)); r.pts += b; r.tags.push('serie'); r.streak = p.streak; }
      if (rank === 0) p.firsts++;
      p.right++; cat.ok++; p.totalMs += a.at;
      p.fastest = p.fastest == null ? a.at : Math.min(p.fastest, a.at);
    } else {
      p.streak = 0;
      if (a) {
        p.wrong++;
        if (s.cfg.mode === 'peril') { r.pts = -Math.round(base / 2); r.tags.push('peril'); }
      } else p.silent++;
    }
    p.score += r.pts;
    return r;
  });
  s.last = { idx: s.idx, show: q.show, tip: q.tip, cat: q.cat, results, final: isFinal(s) };
  s.history.push({ idx: s.idx, cat: q.cat, kind: q.kind, text: q.text, eq: q.eq, show: q.show, results: results.map(({ id, ok, at, pts }) => ({ id, ok, at, pts })) });
  s.phase = 'reveal'; s.endsAt = now + REVEAL_MS + (q.cat === 'compte' ? 1500 : 0);
  // les réponses deviennent publiques
  return s;
}

export function standings(s) {
  return [...s.players].sort((a, b) => b.score - a.score || b.right - a.right || a.totalMs - b.totalMs).map((p) => p.id);
}

function finish(s) {
  s.phase = 'over'; s.endsAt = 0; s.q = null; s.answers = {};
  s.ranking = standings(s);
  return s;
}

// Joueur parti : il ne bloque plus la fin anticipée des questions
export function removePlayer(state, id) {
  const s = clone(state);
  s.players = s.players.filter((p) => p.id !== id);
  delete s.answers[id];
  return s;
}

// Ce que l'hôte envoie à tout le monde : pendant une question, seulement « a répondu » (et le blocage en Éclair)
export function publicState(s) {
  if (s.phase !== 'question') return s;
  const answers = {};
  for (const [id, a] of Object.entries(s.answers)) answers[id] = s.cfg.mode === 'eclair' && !a.ok ? { done: true, locked: true } : { done: true };
  return { ...s, answers };
}

export const describeAnswer = (q, raw) => (q && q.input === 'expr' ? String(raw).replace(/\*/g, '×') : fmt(parseNumber(raw) ?? 0));
