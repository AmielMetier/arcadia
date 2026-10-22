// Hôte de Fil Rouge : répartit les équipes et les rôles, détient la bombe de chaque équipe,
// juge chaque manipulation, fait tourner les chronos et relaie le chat (à l'équipe seulement en duel).
import { createGame, act, tick, makeConfig, dropPlayer, rebase, fixRoles, teamsReady } from '../engine/rules.js';
import { randomSeed } from '../engine/rng.js';

const ABSENT_MS = 15000;
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, n);

export function startHost({ bridge, solo, settings, me, on, initial = null }) {
  let state = null, reported = false;
  const cfg = makeConfig(settings);
  const picks = {};

  /* ---------------------------------------------------------- envoi */
  function broadcast(ev = []) {
    if (!solo) bridge.send('all', { t: 'st', s: state, now: Date.now(), ev });
    on.state(state, 0, ev);
    if (state.phase === 'over' && !reported) { reported = true; reportResult(); }
  }
  function reportResult() {
    if (!bridge.embedded || !bridge.report || state.players.length < 2) return;
    const coop = state.cfg.mode === 'coop';
    const rankOf = (team) => (coop ? (state.teams[0].status === 'defused' ? 1 : 2) : state.ranking.indexOf(team) + 1);
    bridge.report({
      id: `filrouge-${state.startedAt}-${state.players.map((p) => p.id).join('.')}`,
      mode: coop ? 'Coopération' : 'Duel',
      players: state.players.map((p) => {
        const t = state.teams[p.team];
        return { id: p.id, name: p.name, color: p.color, bot: false, rank: rankOf(p.team), score: t.status === 'defused' ? Math.round(t.left / 1000) : t.solved };
      }),
    });
  }

  /* ---------------------------------------------------------- avant-partie : équipes et rôles */
  const roomPlayers = () => (solo ? [{ id: me.id, name: me.name, color: me.color }] : bridge.players.map((p) => ({ id: p.id, name: p.name, color: p.color })));
  function setupState() {
    const list = roomPlayers().map((p) => ({ ...p, ready: solo || p.id === me.id || bridge.readyMap[p.id] === 'filrouge' }));
    for (const p of list) {
      if (picks[p.id]) continue;
      const team = cfg.mode === 'versus' ? (list.filter((q) => picks[q.id] && picks[q.id].team === 0).length <= list.filter((q) => picks[q.id] && picks[q.id].team === 1).length ? 0 : 1) : 0;
      const hasDef = list.some((q) => picks[q.id] && picks[q.id].team === team && picks[q.id].role === 'defuser');
      picks[p.id] = { team, role: hasDef ? 'expert' : 'defuser' };
    }
    const players = fixRoles(list.map((p) => ({ ...p, ...picks[p.id] })), cfg.mode);
    return { players, cfg, hostId: me.id, error: teamsReady(players.filter((p) => p.ready), cfg.mode) };
  }
  function pushSetup() {
    if (state && state.phase !== 'over') return;
    const s = setupState();
    if (!solo) bridge.send('all', { t: 'setup', s });
    on.setup(s);
  }
  function pick(id, m) {
    if (state && state.phase === 'play') return;
    const cur = picks[id] || { team: 0, role: 'expert' };
    const team = m.team === undefined ? cur.team : Math.max(0, Math.min(cfg.mode === 'versus' ? 1 : 0, Number(m.team) | 0));
    let role = m.role === undefined ? cur.role : m.role === 'defuser' ? 'defuser' : 'expert';
    // on rejoint une autre équipe : on y est démineur seulement s'il n'y en a pas
    if (team !== cur.team && m.role === undefined) role = Object.entries(picks).some(([k, p]) => Number(k) !== id && p.team === team && p.role === 'defuser') ? 'expert' : 'defuser';
    // devenir démineur : l'ancien démineur de l'équipe devient expert
    if (role === 'defuser') for (const [k, p] of Object.entries(picks)) if (Number(k) !== id && p.team === team && p.role === 'defuser') p.role = 'expert';
    picks[id] = { team, role };
    if (state && state.phase === 'over') state = null;
    pushSetup();
  }
  function shuffleTeams() {
    const ids = setupState().players.filter((p) => p.ready).map((p) => p.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const nT = cfg.mode === 'versus' ? 2 : 1;
    ids.forEach((id, k) => { picks[id] = { team: k % nT, role: k < nT ? 'defuser' : 'expert' }; });
    pushSetup();
  }
  function begin() {
    const s = setupState();
    if (s.error) { on.error(s.error); return; }
    reported = false;
    try { state = createGame({ players: s.players.filter((p) => p.ready).map(({ ready, ...p }) => p), cfg, seed: randomSeed(), now: Date.now() }); }
    catch (e) { on.error(e.message); return; }
    broadcast([{ k: 'start' }]);
  }

  /* ---------------------------------------------------------- jeu */
  function manipulate(by, a) {
    if (!state) return { ok: false, error: 'La partie n’a pas commencé.' };
    const r = act(state, { by, m: Number(a.m), op: clean(a.op, 10), i: Number(a.i), d: Number(a.d), now: Date.now() });
    if (!r.ok) return r;
    state = r.state; broadcast(r.ev);
    return r;
  }
  setInterval(() => {
    if (!state || state.phase !== 'play') return;
    const r = tick(state, Date.now());
    if (r.ev.length) { state = r.state; broadcast(r.ev); }
  }, 200);

  function chat(from, text) {
    text = clean(text, 140).trim();
    if (!text) return;
    const roomP = roomPlayers().find((p) => p.id === from) || { name: '?', color: '#888' };
    const inGame = state && state.players.find((p) => p.id === from);
    const team = inGame ? inGame.team : (picks[from] ? picks[from].team : 0);
    const msg = { t: 'chat', from, name: roomP.name, color: roomP.color, text, team };
    // duel en cours : l'équipe adverse n'entend rien
    const secret = state && state.phase === 'play' && state.cfg.mode === 'versus';
    const to = secret ? state.players.filter((p) => p.team === team).map((p) => p.id) : roomPlayers().map((p) => p.id);
    for (const id of to) { if (id === me.id) on.chat(msg); else if (!solo) bridge.send(id, msg); }
  }

  /* ---------------------------------------------------------- reprise après migration d'hôte */
  if (initial && initial.state) {
    state = rebase(initial.state, initial.offset || 0);
    if (state.phase === 'over') reported = true;
    for (const p of state.players) picks[p.id] = { team: p.team, role: p.role };
    setTimeout(() => broadcast([]), 300);
  } else setTimeout(pushSetup, 0);

  if (!solo) {
    const absentSince = {};
    setInterval(() => {
      if (!state || state.phase !== 'play') return;
      const now = Date.now();
      for (const p of state.players) {
        if (p.id === me.id) continue;
        if (bridge.players.some((q) => q.id === p.id)) { delete absentSince[p.id]; continue; }
        absentSince[p.id] = absentSince[p.id] || now;
        if (now - absentSince[p.id] > ABSENT_MS) { const r = dropPlayer(state, p.id, now); state = r.state; broadcast(r.ev); }
      }
    }, 2000);
    bridge.on('roster', pushSetup);
    bridge.on('msg', (from, m) => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'sync') { if (state) bridge.send(from, { t: 'st', s: state, now: Date.now(), ev: [] }); else pushSetup(); }
      else if (m.t === 'pick') pick(from, m);
      else if (m.t === 'chat') chat(from, m.text);
      else if (m.t === 'act') { const r = manipulate(from, m); if (!r.ok) bridge.send(from, { t: 'err', msg: r.error, soft: !!r.soft }); }
    });
  }

  return {
    isHost: true,
    act(a) { const r = manipulate(me.id, a); if (!r.ok) on.error(r.error, r.soft); },
    pick(m) { pick(me.id, m); },
    chat(text) { chat(me.id, text); },
    shuffle: shuffleTeams,
    start() { if (!state || state.phase === 'over') begin(); },
    again() { state = null; pushSetup(); },
    get state() { return state; },
    get offset() { return 0; },
  };
}
