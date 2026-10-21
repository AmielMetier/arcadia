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

// Sabotage : une série de 3 bonnes réponses rapporte un pouvoir, à lancer sur un adversaire entre deux questions.
// Il agit sur sa question suivante. Le bouclier, gardé en réserve, annule le prochain sabotage reçu.
export const POWERS = {
  fog:    { label: 'Brouillard', icon: '🌫️', desc: 'Question floue pendant 5 secondes' },
  time:   { label: 'Chrono volé', icon: '⏱️', desc: '5 secondes de moins pour répondre' },
  flip:   { label: 'Tête à l\'envers', icon: '🙃', desc: 'Question affichée à l\'envers' },
  shield: { label: 'Bouclier', icon: '🛡️', desc: 'Bloque le prochain sabotage reçu' },
};
export const STEAL_MS = 5000;
export const FOG_MS = 5000;
export const SAB_EXTRA_MS = 3500;
const MAX_POWERS = 2;

// Réglages du salon → configuration validée
export function makeConfig(s = {}) {
  return {
    mode: MODES[s.mode] ? s.mode : 'classic',
    len: LENGTHS.includes(Number(s.len)) ? Number(s.len) : 10,
    diff: DIFFS.includes(s.diff) ? s.diff : 'normal',
    theme: THEMES[s.theme] ? s.theme : 'mix',
    finale: s.finale == null ? true : Number(s.finale) === 1,
    sabotage: s.sabotage == null ? true : Number(s.sabotage) === 1,
  };
}

export function createGame({ players, cfg, seed, now }) {
  if (!players.length) throw new Error('Aucun joueur');
  const c = makeConfig(cfg);
  return {
    v: 1, seed, cfg: c, startedAt: now,
    cats: planCats(seed, c.len, c.theme),
    players: players.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: !!p.bot,
      score: 0, streak: 0, bestStreak: 0, right: 0, wrong: 0, silent: 0, fastest: null, totalMs: 0, firsts: 0, byCat: {},
      powers: [], sabSent: 0, sabTaken: 0 })),
    idx: -1, phase: 'intro', endsAt: now + INTRO_MS, q: null, qAt: 0, answers: {}, last: null, history: [], ranking: null,
    curses: {}, active: {}, sabs: [],
  };
}

const clone = (s) => JSON.parse(JSON.stringify(s));
export const isFinal = (s, idx = s.idx) => s.cfg.finale && idx === s.cfg.len - 1;
// Question n° idx ; si son texte est déjà sorti dans la partie, on en tire une autre (toujours de façon reproductible)
export function fullQuestion(s, idx = s.idx) {
  const seen = new Set(s.history.filter((h) => h.idx < idx).map((h) => h.key));
  let q;
  for (let salt = 0; salt < 8; salt++) { q = makeQuestion(s.seed, idx, s.cats[idx], s.cfg.diff, salt); if (!seen.has(q.key)) break; }
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
  // les sabotages lancés pendant la révélation s'appliquent maintenant
  s.active = s.curses || {}; s.curses = {};
  return s;
}

// Fin de la question pour ce joueur (le chrono volé la raccourcit)
export const deadlineOf = (s, id) => s.endsAt - ((s.active && s.active[id] || []).some((c) => c.power === 'time') ? STEAL_MS : 0);
const limitOf = (s, q, id) => q.time * 1000 - ((s.active && s.active[id] || []).some((c) => c.power === 'time') ? STEAL_MS : 0);

// Lancer un pouvoir → { ok, state, blocked }
export function sabotage(state, { by, power, target }) {
  if (!state.cfg.sabotage) return { ok: false, error: 'Sabotage désactivé' };
  if (state.phase !== 'reveal' || state.idx + 1 >= state.cfg.len) return { ok: false, error: 'On sabote entre deux questions' };
  if (power === 'shield' || !POWERS[power]) return { ok: false, error: 'Pouvoir inconnu' };
  const s = clone(state);
  const me = s.players.find((p) => p.id === by), them = s.players.find((p) => p.id === Number(target));
  if (!me || !them || me.id === them.id) return { ok: false, error: 'Cible invalide' };
  const k = me.powers.indexOf(power);
  if (k < 0) return { ok: false, error: 'Tu n\'as pas ce pouvoir' };
  if ((s.curses[them.id] || []).some((c) => c.power === power)) return { ok: false, error: `${them.name} a déjà ce sabotage` };
  me.powers.splice(k, 1);
  const shield = them.powers.indexOf('shield');
  const blocked = shield >= 0;
  if (blocked) them.powers.splice(shield, 1);
  else { (s.curses[them.id] = s.curses[them.id] || []).push({ power, from: me.id }); them.sabTaken++; }
  me.sabSent++;
  s.sabs.push({ n: s.sabs.length + 1, idx: s.idx, from: me.id, to: them.id, power, blocked });
  return { ok: true, state: s, blocked };
}

// Relance la question en cours (nouvel hôte après une migration : les réponses déjà données sont perdues)
export function restartQuestion(state, now) {
  const s = clone(state);
  if (s.phase !== 'question') return s;
  s.qAt = now; s.endsAt = now + s.q.time * 1000; s.answers = {};
  return s;
}

function normalize(str) {
  return String(str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function checkChartier(q, raw) {
  const inputStr = String(raw ?? '').trim();
  if (!inputStr) return { ok: false, error: 'Saisie vide' };

  if (q.choices && q.choices.length) {
    const exactChoice = q.choices.find((c) => c === inputStr);
    if (exactChoice) {
      return { ok: exactChoice === q.correctChoice, value: exactChoice };
    }

    if (/^[1-4]$/.test(inputStr)) {
      const numIdx = parseInt(inputStr, 10);
      if (numIdx >= 1 && numIdx <= q.choices.length) {
        const selected = q.choices[numIdx - 1];
        return { ok: selected === q.correctChoice, value: selected };
      }
    }

    if (/^[a-d]$/i.test(inputStr)) {
      const letterIdx = ['a', 'b', 'c', 'd'].indexOf(inputStr.toLowerCase());
      if (letterIdx >= 0 && letterIdx < q.choices.length) {
        const selected = q.choices[letterIdx];
        return { ok: selected === q.correctChoice, value: selected };
      }
    }
  }

  const normInput = normalize(inputStr);
  const normCorrect = normalize(q.correctChoice);
  const normClean = normalize(q.answer);

  if (normInput && (normInput === normCorrect || normInput === normClean)) {
    return { ok: true, value: q.answer };
  }

  if (q.aliases && Array.isArray(q.aliases)) {
    for (const a of q.aliases) {
      const normA = normalize(a);
      if (normInput === normA) return { ok: true, value: q.answer };
      if (normA.length >= 5 && normInput.includes(normA)) {
        return { ok: true, value: q.answer };
      }
    }
  }

  const nInp = parseNumber(inputStr);
  const nAns = parseNumber(q.answer);
  if (nInp != null && nAns != null) {
    if (nInp === nAns) return { ok: true, value: nInp };
  }

  return { ok: false, value: inputStr };
}

// Justesse d'une saisie
export function check(q, raw) {
  if (q.isChartier || q.input === 'chartier') {
    return checkChartier(q, raw);
  }
  if (q.input === 'choice') {
    const k = /^\d$/.test(String(raw).trim()) ? Number(raw) : -1;
    if (k < 0 || k >= q.choices.length) return { ok: false, error: 'Choisis une des réponses' };
    return { ok: k === q.answer, value: k };
  }
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
  if (now > deadlineOf(state, by) + GRACE_MS) return { ok: false, error: 'Temps écoulé' };
  const q = fullQuestion(state);
  const c = check(q, String(raw ?? '').slice(0, 60));
  // saisie illisible : on prévient le joueur sans lui compter de réponse (sauf en Éclair, où il faut assumer)
  if (c.error && state.cfg.mode !== 'eclair') return { ok: false, error: c.error, soft: true };
  const s = clone(state);
  s.answers[by] = { at: Math.max(0, Math.min(now, deadlineOf(s, by)) - s.qAt), raw: String(raw ?? '').slice(0, 40), ok: !!c.ok };
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
        r.pts = Math.round((base * (0.5 + 0.5 * Math.max(0, 1 - a.at / limitOf(s, q, p.id)))) / 10) * 10;
        if (rank === 0 && correct.length > 1) { r.pts += 50; r.tags.push('eclair'); }
      }
      p.streak++; p.bestStreak = Math.max(p.bestStreak, p.streak);
      if (p.streak >= 3 && s.cfg.mode !== 'eclair') { const b = Math.min(100, 25 * (p.streak - 2)); r.pts += b; r.tags.push('serie'); r.streak = p.streak; }
      if (rank === 0) p.firsts++;
      // sabotage : un pouvoir toutes les 3 bonnes réponses d'affilée (tiré de la graine, donc reproductible)
      if (s.cfg.sabotage && p.streak % 3 === 0 && p.powers.length < MAX_POWERS && s.idx + 1 < s.cfg.len) {
        const list = Object.keys(POWERS), h = (s.seed ^ Math.imul(s.idx + 7, 2654435761) ^ Math.imul(p.id + 3, 40503)) >>> 0;
        const pw = list[h % list.length];
        p.powers.push(pw); r.tags.push('power'); r.power = pw;
      }
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
  s.history.push({ idx: s.idx, key: q.key, cat: q.cat, kind: q.kind, text: q.text, fig: q.fig, sub: q.sub, eq: q.eq, show: q.show, tip: q.tip, choices: q.choices, input: q.input,
    results: results.map(({ id, ok, at, pts, raw }) => ({ id, ok, at, pts, raw })) });
  // pause plus longue quand quelqu'un peut saboter : le temps de choisir son pouvoir et sa cible
  const canSab = s.cfg.sabotage && s.idx + 1 < s.cfg.len && s.players.some((p) => p.powers.some((pw) => pw !== 'shield'));
  s.revealMs = REVEAL_MS + (q.cat === 'compte' ? 1500 : 0) + (canSab ? SAB_EXTRA_MS : 0);
  s.phase = 'reveal'; s.endsAt = now + s.revealMs;
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

// Réponse d'un joueur telle qu'on l'affiche (« Vrai », « 3/7 », « 2 491 », « (8 + 4) × 5 »)
export function describeAnswer(q, raw) {
  if (raw == null) return '—';
  if (q && q.input === 'choice') return q.choices[Number(raw)] ?? String(raw);
  if (q && q.input === 'expr') return String(raw).replace(/\*/g, '×');
  const n = parseNumber(raw);
  return n == null ? String(raw) : fmt(n);
}
