// Règles de Tête de Calcul : fonctions pures, sans DOM ni réseau (testées sous Node par tools/test-calcul.mjs).
// L'hôte appelle ces fonctions avec l'heure courante ; les vues ne font qu'afficher l'état.
//
// Phases : 'intro' (compte à rebours) → 'question' → 'reveal' → 'question'… → 'over'
// Pendant 'question', les réponses (valeur, juste ou non) restent chez l'hôte : publicState() les masque.
import { CATS, DIFFS, THEMES, planCats, makeQuestion, publicQuestion, fmt, chartierTier } from './questions.js';
import { parseNumber, evalExpr, usesOnly } from './expr.js';

export const MODES = {
  classic:  { label: 'Classique', desc: 'Tout le monde répond, les plus rapides marquent plus.' },
  chartier: { label: 'The Candidate', desc: 'L\'entretien impitoyable de Pierre Chartier : finance de marché, calcul mental et brainteasers, de plus en plus durs.' },
  peril:   { label: 'Péril', desc: 'Une erreur coûte des points : ne tente pas n\'importe quoi.' },
  eclair:  { label: 'Éclair', desc: 'Seul le premier qui trouve marque. Une erreur et tu es bloqué.' },
};
export const LENGTHS = [10, 15, 20, 30];
export const INTRO_MS = 3500;
export const REVEAL_MS = 5200;
const GRACE_MS = 400; // réponse arrivée juste après la fin (latence réseau)

// The Candidate : 3 vies. Une mauvaise réponse en coûte une, la réponse piège deux, le silence une.
// À la fin de chaque tour (premier tour → desk → comité final), le dernier du classement est éliminé
// tant qu'il reste au moins trois candidats. La partie s'arrête quand il n'en reste qu'un.
export const LIVES = 3;
export const JOKERS = {
  half:   { label: '50/50', icon: '✂️', desc: 'Retire deux mauvaises réponses' },
  friend: { label: 'Appel à un ami', icon: '📞', desc: 'Un ami te souffle une réponse (il se trompe parfois)' },
};
const FRIEND_ACC = { 1: 0.85, 2: 0.75, 3: 0.62 };
const MAX_RAW = 60, MAX_CODE = 6000;

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
    theme: (s.mode === 'chartier' || !THEMES[s.theme]) ? (s.mode === 'chartier' ? 'chartier' : 'mix') : s.theme,
    len: LENGTHS.includes(Number(s.len)) ? Number(s.len) : 10,
    diff: DIFFS.includes(s.diff) ? s.diff : 'normal',

    finale: s.finale == null ? true : Number(s.finale) === 1,
    sabotage: s.sabotage == null ? true : Number(s.sabotage) === 1,
    lives: s.mode === 'chartier' ? LIVES : 0,
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
      powers: [], sabSent: 0, sabTaken: 0,
      lives: c.lives, out: false, outIdx: null, outWhy: null, traps: 0, jokers: c.lives ? Object.keys(JOKERS) : [] })),
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
  for (let salt = 0; salt < 8; salt++) { q = makeQuestion(s.seed, idx, s.cats[idx], s.cfg.diff, salt, s.cfg.len); if (!seen.has(q.key)) break; }
  return q;
}

// Question suivante (ou fin de partie)
export function nextQuestion(state, now) {
  const s = clone(state);
  if (s.idx + 1 >= s.cfg.len || s.endEarly) return finish(s);
  s.idx++;
  const q = fullQuestion(s);
  s.q = { ...publicQuestion(q), n: s.idx + 1, pts: q.pts * (isFinal(s) ? 2 : 1), final: isFinal(s) };
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

// Justesse d'une saisie
export function check(q, raw) {
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
  if (q.input === 'code') {
    if (!String(raw).trim()) return { ok: false, error: 'Écris ton code avant de l’envoyer' };
    return { ok: false, pending: true };
  }
  const n = parseNumber(raw);
  if (n == null) return { ok: false, error: 'Ce n\'est pas un nombre' };
  const ok = q.tolMode === 'factor' && q.tol ? n > 0 && n >= q.answer / q.tol && n <= q.answer * q.tol
    : q.tol ? Math.abs(n - q.answer) <= q.tol * Math.abs(q.answer) : n === q.answer;
  return { ok, value: n };
}

// La réponse choisie est-elle le piège prévu par l'examinateur ? (choix, ou valeur classique à saisir)
export function isTrap(q, raw) {
  if (q.input === 'choice') return q.trap >= 0 && Number(raw) === q.trap;
  if (q.input !== 'num' || !q.traps || !q.traps.length) return false;
  const n = parseNumber(raw);
  return n != null && q.traps.some((t) => Math.abs(n - t) <= Math.max(1e-9, Math.abs(t) * 0.005));
}

const alive = (s) => s.players.filter((p) => !p.out);

// Une réponse de joueur → { ok, state, done } ; done : la question peut être révélée tout de suite
export function answer(state, { by, raw, idx, now }) {
  if (state.phase !== 'question') return { ok: false, error: 'Pas de question en cours' };
  if (idx != null && idx !== state.idx) return { ok: false, error: 'Trop tard, question suivante !' };
  const p = state.players.find((q) => q.id === by);
  if (!p) return { ok: false, error: 'Tu ne joues pas cette partie' };
  if (p.out) return { ok: false, error: 'Tu es éliminé : tu regardes la suite' };
  if (state.answers[by]) return { ok: false, error: 'Tu as déjà répondu' };
  if (now > deadlineOf(state, by) + GRACE_MS) return { ok: false, error: 'Temps écoulé' };
  const q = fullQuestion(state);
  const text = String(raw ?? '').slice(0, q.input === 'code' ? MAX_CODE : MAX_RAW);
  const c = check(q, text);
  // saisie illisible : on prévient le joueur sans lui compter de réponse (sauf en Éclair, où il faut assumer)
  if (c.error && state.cfg.mode !== 'eclair') return { ok: false, error: c.error, soft: true };
  const s = clone(state);
  s.answers[by] = { at: Math.max(0, Math.min(now, deadlineOf(s, by)) - s.qAt), raw: q.input === 'code' ? text : text.slice(0, 40), ok: !!c.ok,
    trap: !c.ok && isTrap(q, text), ...(c.pending ? { pending: true, passed: 0, total: q.tests.length } : {}) };
  const done = allDone(s) || (s.cfg.mode === 'eclair' && c.ok);
  return { ok: true, state: s, done, right: !!c.ok, pending: !!c.pending };
}

// Tous les candidats encore en lice ont répondu, et tous les codes envoyés ont été corrigés
const allDone = (s) => alive(s).every((p) => s.answers[p.id] && !s.answers[p.id].pending);

// Résultat de la correction d'un code par l'hôte (tests réussis sur le total)
export function gradeCode(state, { by, idx, passed, total, detail = null }) {
  if (state.phase !== 'question' || idx !== state.idx) return { ok: false, error: 'Question déjà close' };
  const a = state.answers[by];
  if (!a || !a.pending) return { ok: false, error: 'Rien à corriger' };
  const s = clone(state);
  const n = Math.max(0, Math.min(total, passed | 0));
  s.answers[by] = { ...a, pending: false, passed: n, total, ok: n === total, detail };
  return { ok: true, state: s, done: allDone(s) };
}

// Joker (une fois par partie chacun) → { ok, state, info } ; info n'est envoyée qu'au joueur qui l'a demandé
export function useJoker(state, { by, kind }) {
  if (!state.cfg.lives) return { ok: false, error: 'Pas de joker dans ce mode' };
  if (state.phase !== 'question') return { ok: false, error: 'Pas de question en cours' };
  const p = state.players.find((x) => x.id === by);
  if (!p || p.out) return { ok: false, error: 'Tu ne joues plus cette partie' };
  if (!JOKERS[kind] || !p.jokers.includes(kind)) return { ok: false, error: 'Joker déjà utilisé' };
  if (state.answers[by]) return { ok: false, error: 'Tu as déjà répondu' };
  const q = fullQuestion(state);
  if (q.input !== 'choice') return { ok: false, error: 'Les jokers servent sur les questions à choix' };
  const s = clone(state);
  const me = s.players.find((x) => x.id === by);
  me.jokers = me.jokers.filter((k) => k !== kind);
  // tirage reproductible (graine de la partie, question, joueur)
  const h = (s.seed ^ Math.imul(s.idx + 11, 2654435761) ^ Math.imul(by + 5, 40503) ^ (kind === 'half' ? 0x5bd1e995 : 0x1b873593)) >>> 0;
  let info;
  if (kind === 'half') {
    // on retire deux mauvaises réponses qui ne sont pas le piège : il reste la bonne… et le piège
    const others = q.choices.map((_, k) => k).filter((k) => k !== q.answer && k !== q.trap);
    while (others.length > 2) others.splice(h % others.length, 1);
    info = { kind, idx: s.idx, removed: others };
  } else {
    const right = (h % 1000) / 1000 < (FRIEND_ACC[q.tier] || 0.75);
    info = { kind, idx: s.idx, suggest: right ? q.answer : (q.trap >= 0 ? q.trap : (q.answer + 1) % q.choices.length) };
  }
  (s.jokerLog = s.jokerLog || []).push({ idx: s.idx, by, kind });
  return { ok: true, state: s, info };
}

// Calcul des points de la question et passage en révélation
export function reveal(state, now) {
  if (state.phase !== 'question') return state;
  const s = clone(state);
  const q = fullQuestion(s);
  const base = q.pts * 100 * (isFinal(s) ? 2 : 1);
  const isCode = q.input === 'code';
  const correct = Object.entries(s.answers).filter(([, a]) => a.ok).sort((a, b) => a[1].at - b[1].at).map(([id]) => +id);
  const eliminated = [];
  const results = s.players.map((p) => {
    if (p.out) return { id: p.id, raw: null, ok: false, at: null, pts: 0, tags: [], out: true };
    const a = s.answers[p.id];
    // un code encore en correction à la fin du temps ne rapporte rien
    const passed = isCode && a && !a.pending ? a.passed : 0, total = isCode ? q.tests.length : 0;
    const r = { id: p.id, raw: a ? (isCode ? `${passed}/${total}` : a.raw) : null, ok: !!(a && a.ok), at: a ? a.at : null, pts: 0, tags: [],
      ...(isCode ? { passed, total, detail: a && a.detail ? a.detail : null } : {}) };
    const cat = (p.byCat[q.cat] = p.byCat[q.cat] || { n: 0, ok: 0 });
    cat.n++;
    // code : des points pour chaque test réussi, même si tous ne passent pas
    const partial = isCode && !r.ok && passed > 0 ? passed / total : 0;
    if (r.ok || partial) {
      const rank = correct.indexOf(p.id);
      const share = r.ok ? 1 : partial;
      if (s.cfg.mode === 'eclair') { r.pts = rank === 0 ? base : 0; }
      else {
        r.pts = Math.round((base * share * (0.5 + 0.5 * Math.max(0, 1 - a.at / limitOf(s, q, p.id)))) / 10) * 10;
        if (r.ok && rank === 0 && correct.length > 1) { r.pts += 50; r.tags.push('eclair'); }
      }
    }
    if (r.ok) {
      const rank = correct.indexOf(p.id);
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
      // The Candidate : vies perdues (piège : deux ; code avec au moins un test réussi : aucune)
      if (s.cfg.lives && !partial) {
        const lost = a && a.trap ? 2 : 1;
        if (a && a.trap) { r.tags.push('trap'); p.traps++; }
        r.lost = Math.min(lost, p.lives);
        p.lives = Math.max(0, p.lives - lost);
        if (!p.lives) { p.out = true; p.outIdx = s.idx; p.outWhy = 'vies'; eliminated.push({ id: p.id, why: 'vies' }); }
      }
    }
    p.score += r.pts;
    return r;
  });
  // fin d'un tour : le dernier du classement saute, s'il reste au moins trois candidats
  const tierNow = s.cfg.lives ? chartierTier(Math.max(0, DIFFS.indexOf(s.cfg.diff)), s.idx, s.cfg.len) : 0;
  const tierNext = s.cfg.lives && s.idx + 1 < s.cfg.len ? chartierTier(Math.max(0, DIFFS.indexOf(s.cfg.diff)), s.idx + 1, s.cfg.len) : tierNow;
  let tierEnd = null;
  if (s.cfg.lives && tierNext !== tierNow) {
    tierEnd = tierNow;
    const left = alive(s);
    if (left.length >= 3) {
      const last = [...left].sort((x, y) => x.score - y.score || x.right - y.right || y.totalMs - x.totalMs)[0];
      last.out = true; last.outIdx = s.idx; last.outWhy = 'palier';
      eliminated.push({ id: last.id, why: 'palier' });
      const r = results.find((x) => x.id === last.id); if (r) r.tags.push('cut');
    }
  }
  // dernier debout : entre joueurs, la partie s'arrête quand il n'en reste qu'un ; seul contre des bots,
  // on finit l'entretien pour le score ; plus aucun humain en lice : terminé
  const standing = alive(s).length, humans = s.players.filter((p) => !p.bot);
  if (s.cfg.lives && (standing === 0 || !humans.some((p) => !p.out) || (humans.length > 1 && standing <= 1))) s.endEarly = true;
  s.last = { idx: s.idx, show: q.show, tip: q.tip, cat: q.cat, results, final: isFinal(s), choices: q.choices, answer: q.input === 'choice' ? q.answer : null, trap: q.input === 'choice' ? q.trap : -1,
    isChartier: q.isChartier, tier: q.tier, input: q.input, unit: q.unit, eliminated, tierEnd, endEarly: !!s.endEarly };
  s.history.push({ idx: s.idx, key: q.key, cat: q.cat, kind: q.kind, text: q.text, fig: q.fig, sub: q.sub, eq: q.eq, show: q.show, tip: q.tip, choices: q.choices, input: q.input, isChartier: q.isChartier, tier: q.tier, rubric: q.rubric, pts: q.pts, unit: q.unit,
    results: results.map(({ id, ok, at, pts, raw, out }) => ({ id, ok, at, pts, raw, out })) });
  // pause plus longue quand quelqu'un peut saboter : le temps de choisir son pouvoir et sa cible
  const canSab = s.cfg.sabotage && s.idx + 1 < s.cfg.len && s.players.some((p) => !p.out && p.powers.some((pw) => pw !== 'shield'));
  s.revealMs = REVEAL_MS + (q.cat === 'compte' ? 1500 : 0) + (q.isChartier ? 2300 : 0) + (isCode ? 4000 : 0) + (eliminated.length ? 2500 : 0) + (canSab ? SAB_EXTRA_MS : 0);
  s.phase = 'reveal'; s.endsAt = now + s.revealMs;
  // les réponses deviennent publiques
  return s;
}

// Classement : les candidats encore en lice d'abord, puis les éliminés (le dernier tombé devant)
export function standings(s) {
  return [...s.players].sort((a, b) => (a.out - b.out) || (a.out && b.out ? b.outIdx - a.outIdx : 0)
    || b.score - a.score || b.right - a.right || a.totalMs - b.totalMs).map((p) => p.id);
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
  if (s.phase !== 'question') return { ...s, answers: {} };
  const answers = {};
  for (const [id, a] of Object.entries(s.answers)) answers[id] = s.cfg.mode === 'eclair' && !a.ok ? { done: true, locked: true } : a.pending ? { done: true, grading: true } : { done: true };
  return { ...s, answers };
}

// Réponse d'un joueur telle qu'on l'affiche (« Vrai », « 3/7 », « 2 491 », « (8 + 4) × 5 »)
export function describeAnswer(q, raw) {
  if (raw == null) return '—';
  if (q && q.input === 'choice') return q.choices[Number(raw)] ?? String(raw);
  if (q && q.input === 'expr') return String(raw).replace(/\*/g, '×');
  if (q && q.input === 'code') return String(raw);
  const n = parseNumber(raw);
  return n == null ? String(raw) : fmt(n);
}
