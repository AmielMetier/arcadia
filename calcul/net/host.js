// Hôte de Tête de Calcul : détient l'état, chronomètre les questions, juge les réponses et fait jouer les bots.
// Les invités n'envoient que { t:'ans', i, v } ; l'hôte renvoie l'état public (sans les réponses pendant une question).
// The Candidate : l'hôte fait tourner le code Python de chacun (tests cachés) et répond en privé aux jokers.
import { createGame, nextQuestion, answer, reveal, publicState, fullQuestion, restartQuestion, removePlayer, makeConfig, standings, sabotage, gradeCode, useJoker } from '../engine/rules.js';
import { buildProgram, scoreRun } from '../engine/code-data.js';
import { runPython, preloadPython } from '../view/py.js';
import { botAnswer, botSabotage, BOT_LEVELS } from '../engine/bot.js';
import { randomSeed } from '../engine/rng.js';
import { isEmote, botReaction } from '../view/emotes.js';

const BOT_NAMES = ['Prof Garibaldi', 'Mamé Rose', 'Tonton Jojo', 'Lou Pitchoun', 'Cousin Marius', 'Tata Mireille', 'Papé Fernand'];
const FINANCE_BOT_NAMES = [
  'Julien (Ex-McKinsey)',
  'Alexandre (M&A Lazard)',
  'Clara (Quant Citadel)',
  'Baptiste (PE KKR)',
  'Maxime (Sales Goldman)',
  'Sophie (Trader BNP)',
  'Inès (Structuration SocGen)',
  'Hugo (Hedge fund Londres)'
];
const COLORS = ['#ff4b2b', '#2b8cff', '#ffc531', '#2fbf71', '#b45cff', '#ff5fa2', '#1fc7c1', '#ff8a1f'];
export const MAX_TABLE = 8; // humains + bots autour de la table (jusqu'à 6 bots)
const ABSENT_MS = 15000; // un joueur parti du salon depuis 15 s quitte la partie

export function startHost({ bridge, solo, settings, me, onState, onSetup, onError, onAck = () => {}, onEmote = () => {}, onNote = () => {}, initial = null }) {
  let state = null, timer = 0, reported = false;
  const botTimers = [];
  const cfg = makeConfig(settings);
  const level = BOT_LEVELS.includes(settings.level) ? settings.level : 'normal';
  const botCount = (n) => Math.max(solo ? 1 : 0, Math.min(Number(settings.bots ?? (solo ? 2 : 0)), 6, MAX_TABLE - n));

  function broadcast() {
    const pub = publicState(state);
    if (!solo) bridge.send('all', { t: 'st', s: pub, now: Date.now() });
    onState(pub, 0);
    if (state.phase === 'over' && !reported) { reported = true; reportResult(); }
  }

  // Fin de partie : classement transmis au Hub (historique et classement entre potes)
  function reportResult() {
    if (!bridge.embedded || !bridge.report) return;
    bridge.report({
      id: `calcul-${state.startedAt}-${state.players.map((p) => p.id).join('.')}`,
      mode: { classic: 'Classique', chartier: 'The Candidate', peril: 'Péril', eclair: 'Éclair' }[state.cfg.mode] || state.cfg.mode,
      players: state.ranking.map((id, k) => {
        const p = state.players.find((q) => q.id === id);
        return { id: p.bot ? null : p.id, name: p.name, color: p.color, bot: p.bot, rank: k + 1, score: p.score };
      }),
    });
  }

  /* ---------------------------------------------------------- déroulé : minuteur unique sur state.endsAt */
  function schedule() {
    clearTimeout(timer);
    for (const t of botTimers.splice(0)) clearTimeout(t);
    if (!state || state.phase === 'over') return;
    timer = setTimeout(step, Math.max(0, state.endsAt - Date.now()));
    if (state.phase === 'question') planBots();
  }
  function step() {
    const now = Date.now();
    if (state.phase === 'question') { state = reveal(state, now); broadcast(); botsReact(); }
    else { state = nextQuestion(state, now); broadcast(); }
    schedule();
    if (state.phase === 'reveal') botsSabotage(); // après schedule(), qui annule les minuteurs des bots
  }
  function planBots() {
    const q = fullQuestion(state), idx = state.idx;
    for (const p of state.players) {
      if (!p.bot || p.out || state.answers[p.id]) continue;
      if (state.duel && state.duel.winner == null && !state.duel.ids.includes(p.id)) continue; // face-à-face : seuls les deux finalistes
      const a = botAnswer(q, level);
      if (!a) continue;
      const due = state.qAt + a.delay - Date.now();
      botTimers.push(setTimeout(() => submit(p.id, a.raw, idx, a.passed), Math.max(200, due)));
    }
  }

  // tout le monde a répondu (ou un premier juste en Éclair) : petite pause, puis révélation
  function closeSoon() {
    clearTimeout(timer);
    state.endsAt = Math.min(state.endsAt, Date.now() + 700);
    timer = setTimeout(step, 700);
  }

  function submit(by, raw, idx, botPassed) {
    if (!state) return { ok: false, error: 'La partie n’a pas commencé.' };
    const r = answer(state, { by, raw, idx, now: Date.now() });
    if (!r.ok) return r;
    state = r.state;
    if (r.pending) {
      // un bot connaît son score ; le code d'un joueur passe par Python
      if (botPassed != null) grade(by, idx, botPassed, fullQuestion(state).tests.length, null);
      else runCode(by, idx, String(raw));
    }
    if (r.done) closeSoon();
    broadcast();
    return r;
  }
  async function runCode(by, idx, code) {
    const q = fullQuestion(state);
    const out = await runPython(buildProgram(code, q.fn, q.tests, { lang: q.lang, ordered: q.ordered }));
    const total = q.tests.length, passed = scoreRun(out, total);
    if (!state || state.idx !== idx) return;
    // le détail des tests (sans les valeurs attendues) ne va qu'à l'auteur du code
    note(by, { t: 'graded', i: idx, passed, total, error: out.error, offline: !!out.offline, tests: out.tests.map((t) => t.ok) });
    grade(by, idx, passed, total, out.tests.map((t) => (t.ok ? 1 : 0)));
  }
  function grade(by, idx, passed, total, detail) {
    const r = gradeCode(state, { by, idx, passed, total, detail });
    if (!r.ok) return;
    state = r.state;
    if (r.done) closeSoon();
    broadcast();
  }
  // message réservé à un joueur (moi : directement à la vue)
  function note(to, m) {
    if (to === me.id) onNote(m);
    else if (!solo && !state.players.find((p) => p.id === to)?.bot) bridge.send(to, m);
  }
  function joker(by, kind) {
    if (!state) return { ok: false, error: 'La partie n’a pas commencé.' };
    const r = useJoker(state, { by, kind: String(kind) });
    if (!r.ok) return r;
    state = r.state; broadcast();
    note(by, { t: 'jok', ...r.info });
    return r;
  }
  function sabo(by, power, target) {
    if (!state) return { ok: false, error: 'La partie n’a pas commencé.' };
    const r = sabotage(state, { by, power: String(power), target: Number(target) });
    if (!r.ok) return r;
    state = r.state; broadcast();
    return r;
  }
  // les bots qui ont un pouvoir le lancent pendant la révélation, sur le meneur
  function botsSabotage() {
    if (!state.cfg.sabotage) return;
    for (const p of state.players) {
      if (!p.bot || p.out) continue;
      const a = botSabotage(state, p.id);
      if (a) botTimers.push(setTimeout(() => { if (state.phase === 'reveal') sabo(p.id, a.power, a.target); }, 1200 + Math.random() * 2200));
    }
  }

  // accusé de réception pour le joueur seul : en Éclair, il apprend tout de suite s'il est bloqué
  const ackOf = (r) => ({ t: 'ack', i: state.idx, locked: state.cfg.mode === 'eclair' && !r.right });

  /* ---------------------------------------------------------- réactions */
  const lastEmote = {};
  function emote(from, id) {
    if (!isEmote(id)) return;
    const now = Date.now();
    if (now - (lastEmote[from] || 0) < 1200) return;
    lastEmote[from] = now;
    if (!solo) bridge.send('all', { t: 'emo', from, id });
    onEmote(from, id);
  }
  function botsReact() {
    const bots = state.players.filter((p) => p.bot && !p.out).map((p) => p.id);
    const r = bots.length && botReaction(state.last, bots);
    if (r) setTimeout(() => emote(r.from, r.id), 900 + Math.random() * 1200);
  }

  /* ---------------------------------------------------------- avant-partie */
  const roomPlayers = () => (solo ? [{ id: me.id, name: me.name, color: me.color }] : bridge.players);
  function setupState() {
    const players = roomPlayers().map((p) => ({ id: p.id, name: p.name, color: p.color, ready: solo || p.id === me.id || bridge.readyMap[p.id] === 'calcul' }));
    return { players, cfg, level, bots: botCount(players.filter((p) => p.ready).length), hostId: me.id };
  }
  function pushSetup() {
    if (state && state.phase !== 'over') return;
    const s = setupState();
    if (!solo) bridge.send('all', { t: 'setup', s });
    onSetup(s);
  }

  function begin() {
    const humans = setupState().players.filter((p) => p.ready);
    const players = humans.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    const used = new Set(players.map((p) => p.color));
    const botPool = cfg.mode === 'chartier' ? FINANCE_BOT_NAMES : BOT_NAMES;
    // le nombre de bots se calcule une fois, d'après les seuls humains (sinon la table qui se remplit le réduit)
    const nBots = botCount(players.length);
    for (let k = 0; k < nBots; k++) {
      const color = COLORS.find((c) => !used.has(c)) || COLORS[k]; used.add(color);
      players.push({ id: 100 + k, name: botPool[k % botPool.length], color, bot: true });
    }
    reported = false;
    try { state = createGame({ players, cfg, seed: randomSeed(), now: Date.now() }); }
    catch (e) { onError(e.message); return; }
    if (state.cats.includes('code')) preloadPython();
    broadcast(); schedule();
  }

  if (initial) {
    // reprise du rôle d'hôte après le départ du précédent : la question en cours repart de zéro
    state = initial.phase === 'question' ? restartQuestion(initial, Date.now() + 1500) : { ...initial, endsAt: Math.max(initial.endsAt, Date.now() + 1500) };
    if (state.phase === 'over') reported = true;
    setTimeout(() => { broadcast(); schedule(); }, 300);
  } else setTimeout(pushSetup, 0);

  if (!solo) {
    const absentSince = {};
    setInterval(() => {
      if (!state || state.phase === 'over') return;
      const now = Date.now();
      for (const p of state.players) {
        if (p.bot || p.id === me.id) continue;
        if (bridge.players.some((q) => q.id === p.id)) { delete absentSince[p.id]; continue; }
        absentSince[p.id] = absentSince[p.id] || now;
        if (now - absentSince[p.id] > ABSENT_MS) { state = removePlayer(state, p.id); broadcast(); }
      }
    }, 2000);
    bridge.on('roster', pushSetup);
    bridge.on('msg', (from, m) => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'sync') { if (state) bridge.send(from, { t: 'st', s: publicState(state), now: Date.now() }); else pushSetup(); }
      if (m.t === 'emote') emote(from, String(m.id));
      if (m.t === 'sab') { const r = sabo(from, m.power, m.target); if (!r.ok) bridge.send(from, { t: 'err', msg: r.error }); }
      if (m.t === 'jok') { const r = joker(from, m.kind); if (!r.ok) bridge.send(from, { t: 'err', msg: r.error }); }
      if (m.t === 'ans') {
        const r = submit(from, String(m.v ?? '').slice(0, 6000), Number(m.i)); // l'identité vient du salon, jamais du message
        bridge.send(from, r.ok ? ackOf(r) : { t: 'err', msg: r.error, soft: !!r.soft });
      }
    });
  }

  return {
    answer(raw) {
      const r = submit(me.id, raw, state && state.idx);
      if (!r.ok) onError(r.error, r.soft); else onAck(ackOf(r));
    },
    emote(id) { emote(me.id, id); },
    sabotage(power, target) { const r = sabo(me.id, power, target); if (!r.ok) onError(r.error); },
    joker(kind) { const r = joker(me.id, kind); if (!r.ok) onError(r.error); },
    start() { if (!state || state.phase === 'over') begin(); },
    get state() { return state; },
    get standings() { return state ? standings(state) : []; },
  };
}
