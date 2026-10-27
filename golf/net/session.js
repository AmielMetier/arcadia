// Birdie Party — la partie en réseau. L'hôte fait autorité : il tient l'état (règles), calcule chaque coup
// (le moteur est déterministe, mais c'est le résultat de l'hôte qui compte), fait jouer les bots et diffuse.
// Les invités envoient leur coup quand c'est leur tour, et leur posture (visée, club, armé) pour que les autres
// voient le swing en direct. Le jeu ne parle jamais au réseau directement : tout passe par HubBridge.
//
// Tout le monde avance au même rythme : l'hôte attend que chaque joueur ait fini de regarder un coup avant de passer
// au suivant, et que chacun soit prêt (présentation du trou finie) avant de faire jouer un bot. Une page cachée
// répond tout de suite (personne ne l'attend) ; un joueur absent à son tour est relancé, puis on joue pour lui.
//
// Protocole :
//   invité → hôte : { t:'shot', no, club, aim, power, curve }   coup du joueur dont c'est le tour (no = numéro du coup)
//                   { t:'pose', aim, club, back }               posture (volatile, ~10 fois par seconde)
//                   { t:'seen', no }                            « j'ai fini de regarder le coup no »
//                   { t:'ready', no }                           « je vois le tour no (prêt à regarder le prochain coup) »
//                   { t:'away', on }                            page cachée / revenue
//                   { t:'sync' }                                « renvoie-moi l'état »
//   hôte → tous :   { t:'setup', set }                          réglages choisis par l'hôte au menu (avant la partie)
//                   { t:'menu', set }                           retour au menu (l'hôte va changer de parcours)
//                   { t:'st', R }                               état de la partie (après chaque coup animé)
//                   { t:'shot', ev }                            un coup vient d'être joué (paramètres + résultat)
//                   { t:'pose', id, aim, club, back }           posture du joueur qui joue
//                   { t:'note', text, id? }                     message à afficher (à un joueur, ou à tous)
import { HOLES, buildHole, windFor, COURSES } from '../engine/course.js';
import { simulate } from '../engine/physics.js';
import { newRound, startHole, applyShot, holeOver, finishHole, leave, ranking, MAX_STROKES } from '../engine/rules.js';
import { botShot, BOT_NAMES } from '../engine/bot.js';
import { putterRange, PUTTER } from '../engine/clubs.js';

const COLORS = ['#ff4b2b', '#2b8cff', '#ffc531', '#2fbf71', '#b45cff', '#ff5fa2', '#1fc7c1', '#ff8a1f'];
const TEAM_SIZE = { '2v2': 2, '3v3': 3 };
const TEAMS = [{ name: 'Équipe bleue', color: '#2b7bff' }, { name: 'Équipe rouge', color: '#ff4b2b' }];
const TIMES = ['jour', 'crepuscule', 'soir'];
const holeCache = new Map();
export function holeByNumber(n) {
  if (!holeCache.has(n)) holeCache.set(n, buildHole(HOLES.find((h) => h.n === n)));
  return holeCache.get(n);
}
export const currentHole = (R) => (R && R.hi < R.holes.length ? holeByNumber(R.holes[R.hi]) : null);
export const windOf = (R) => { const h = currentHole(R); return h ? windFor(h, R.seed, R.wind) : { speed: 0, dir: 0, x: 0, z: 0 }; };
const clone = (o) => JSON.parse(JSON.stringify(o));
const WIND = { calme: 0, normal: 1, fort: 1.6 };
const hiddenNow = () => typeof document !== 'undefined' && document.hidden;
// joueur humain qui ne joue pas : rappel, puis coup joué pour lui (plus vite si sa page est cachée)
const TURN_HURRY_MS = 45000, TURN_MS = 60000, AWAY_TURN_MS = 20000;

// balle d'entrée de la simulation (posée sur son tee au départ)
export function simBall(hole, b) { return { x: b.x, z: b.z, lie: b.lie, y: hole.heightAt(b.x, b.z) + (b.lie === 'tee' ? 0.04 : 0.021) }; }

// ------------------------------------------------------------------ hôte (et partie solo)
// speed : accélère les délais (tests hors navigateur)
export function startHost({ bridge, solo, settings: set0 = {}, me, emit, initial = null, speed = 1 }) {
  let settings = { ...set0 };
  let R = initial ? clone(initial) : null, busy = false, reported = false, ended = false;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms / speed); timers.add(t); return t; };
  const send = (m, vol) => { if (!solo) bridge.send('all', m, vol ? { volatile: true } : undefined); };
  const publish = () => {
    const s = clone(R); emit({ type: 'state', R: s }); send({ t: 'st', R: s });
    if (hiddenNow()) vote('ready', R.shotNo, me.id);
    watchTurn();
  };

  // absent : page cachée, ou connexion coupée (le salon lui garde sa place le temps qu'il revienne)
  const absent = (id) => id !== me.id && (away.has(id) || (!solo && !!bridge.players.find((q) => q.id === id)?.away));
  // qui regarde la partie : les joueurs humains encore là et présents, l'hôte compris
  const viewers = () => R.players.filter((p) => !p.bot && !p.left && (solo || p.id === me.id || bridge.players.some((q) => q.id === p.id)) && !absent(p.id)).map((p) => p.id);
  // votes : « vu » (fin de l'animation d'un coup), « prêt » (le tour est affiché) ; par numéro de coup
  const votes = { seen: new Map(), ready: new Map() };
  const vote = (kind, no, id) => {
    const m = votes[kind];
    if (!m.has(no)) m.set(no, new Set());
    m.get(no).add(id);
    for (const k of m.keys()) if (k < no - 4) m.delete(k);
  };
  const everyone = (kind, no) => { const v = votes[kind].get(no); return !!R && !!v && viewers().every((id) => v.has(id)); };
  const away = new Set(); // joueurs dont la page est cachée
  let turnGone = false;   // le joueur dont c'est le tour était-il absent quand son compte a démarré

  // repart de zéro : plus de coup en attente, de vote ni de compte à rebours de la partie d'avant
  function clear() {
    for (const t of timers) clearTimeout(t);
    timers.clear(); turnT = []; botWait = null; busy = false;
    votes.seen.clear(); votes.ready.clear();
  }
  function begin() {
    clear(); ended = false; reported = false;
    const course = COURSES[settings.course] || COURSES.campagne;
    // test : ?hole=N démarre la partie à ce trou du parcours
    const holes = settings.startHole ? course.holes.filter((n) => n >= settings.startHole) : course.holes;
    const humans = (solo ? [{ id: me.id, name: me.name, color: me.color }] : bridge.players.map((p) => ({ id: p.id, name: p.name, color: p.color }))).slice(0, 6);
    // équipes (2 contre 2, 3 contre 3) : les bots complètent les deux équipes
    const size = TEAM_SIZE[settings.teams] || 0;
    const nb = size ? Math.max(0, size * 2 - humans.length) : Math.max(0, Math.min(4 - humans.length, +(settings.bots ?? (solo ? 1 : 0)) || 0));
    const used = new Set(humans.map((p) => p.color));
    const free = COLORS.filter((c) => !used.has(c));
    const bots = Array.from({ length: nb }, (_, k) => ({ id: 'b' + k, name: BOT_NAMES[k], color: free[k % free.length], bot: true, level: settings.level || 'normal' }));
    const seed = (Date.now() & 0x7fffffff) || 1;
    const players = [...humans, ...bots];
    // les humains sont répartis d'une équipe à l'autre, puis les bots comblent les places
    if (size) { const n = [0, 0]; for (const p of players) { const k = n[0] < size && (n[0] <= n[1] || n[1] >= size) ? 0 : 1; p.team = k; n[k]++; } }
    R = newRound({ holes: holes.length ? holes : course.holes, players: size ? players.slice(0, size * 2) : players, seed, wind: WIND[settings.wind] ?? 1, teams: size ? TEAMS : null });
    R.time = TIMES.includes(settings.time) ? settings.time : 'jour';
    R.course = settings.course || 'campagne';
    R.started = Date.now();
    startHole(R, currentHole(R));
    publish();
    scheduleBot();
  }

  // un coup demandé par le joueur `pid` (humain ou bot)
  function shot(pid, p) {
    if (!R || R.phase !== 'play' || busy) return;
    const i = R.turn, P = R.players[i];
    if (!P || P.id !== pid || (p.no != null && p.no !== R.shotNo)) return;
    const hole = currentHole(R), wind = windOf(R);
    const from = { ...P.ball }, ball = simBall(hole, from);
    const club = Math.max(0, Math.min(PUTTER, p.club | 0));
    const params = {
      club, traj: 'mid', aim: +p.aim || 0, power: Math.max(0, Math.min(1.25, +p.power || 0)), curve: Math.max(-1.6, Math.min(1.6, +p.curve || 0)),
      seed: (R.seed * 31 + R.shotNo * 977 + i * 13) >>> 0,
    };
    const putt = putterRange(Math.hypot(hole.pin.x - from.x, hole.pin.z - from.z));
    const res = simulate(hole, ball, params, wind, { putt });
    const before = P.strokes;
    const out = applyShot(R, hole, i, { kind: res.kind, end: res.end, surf: res.surf });
    const ev = { no: R.shotNo - 1, i, pid, params, putt, from, res: { kind: res.kind, end: res.end, surf: res.surf, n: res.n, dist: res.dist }, out, strokes: P.strokes, before };
    busy = true; stopTurn();
    emit({ type: 'shot', ev });
    send({ t: 'shot', ev });
    if (hiddenNow()) vote('seen', ev.no, me.id);
    // filet de sécurité : quelqu'un ne répond plus (page figée, message perdu) ; on avance quand même
    later(() => advance(ev.no), (res.n / 60 * 2.9 + 9) * 1000);
  }

  // un joueur a fini de regarder le coup no : quand tout le monde l'a vu, on avance
  function seen(no, id) {
    vote('seen', no, id);
    if (busy && R && no === R.shotNo - 1 && everyone('seen', no)) advance(no);
  }
  // trou suivant, joueur suivant ou fin de partie
  function advance(no) {
    if (!busy || !R || no !== R.shotNo - 1) return;
    busy = false;
    if (holeOver(R)) {
      finishHole(R);
      if (R.phase === 'over') { publish(); finish(); return; }
      startHole(R, currentHole(R));
    }
    publish();
    scheduleBot();
  }

  // un bot joue quand tout le monde voit son tour (présentation du trou finie chez chacun), après un temps de réflexion ;
  // filet de sécurité si quelqu'un ne répond pas
  let botWait = null;
  function scheduleBot() {
    if (!R || R.phase !== 'play') return;
    const P = R.players[R.turn];
    if (!P || !P.bot) return;
    const no = R.shotNo, hi = R.hi;
    let started = false;
    const go = () => { if (started) return; started = true; botWait = null; later(play, 1500 + Math.random() * 700); };
    botWait = { no, go };
    later(go, P.strokes === 0 && R.players.every((q) => q.strokes === 0) ? 25000 : 12000);
    if (everyone('ready', no)) go();
    function play() {
      if (!R || R.shotNo !== no || R.hi !== hi) return;
      const hole = currentHole(R);
      const s = botShot(hole, simBall(hole, P.ball), windOf(R), P.level, (R.seed + no * 7) >>> 0);
      // le bot arme son swing sous les yeux de tous, puis frappe
      const pose = { t: 'pose', id: P.id, aim: s.aim, club: s.club, back: 0 };
      let k = 0;
      const arm = () => {
        if (!R || R.shotNo !== no) return;
        k++; pose.back = Math.min(s.power, k / 14) ; emit({ type: 'pose', ...pose }); send(pose, true);
        if (k < 14 * Math.min(1, s.power) + 2) later(arm, 45); else shot(P.id, { ...s, no });
      };
      emit({ type: 'pose', ...pose }); send(pose, true);
      later(arm, 700);
    }
  }
  function ready(no, id) {
    vote('ready', no, id);
    if (botWait && botWait.no === no && everyone('ready', no)) botWait.go();
    // son tour s'affiche enfin chez lui (après la carte de score et le survol) : le compte part de là
    if (R && no === R.shotNo && R.players[R.turn]?.id === id && !busy) watchTurn();
  }

  // joueur humain à son tour : rappel au bout de 45 s sans rien faire, puis coup joué pour lui à 60 s (20 s si sa page
  // est cachée). Viser, changer de club ou armer relance le compte.
  let turnT = [];
  function stopTurn() { for (const t of turnT) { clearTimeout(t); timers.delete(t); } turnT = []; }
  function watchTurn() {
    stopTurn();
    if (solo || !R || R.phase !== 'play' || busy) return;
    const P = R.players[R.turn];
    if (!P || P.bot) return;
    const no = R.shotNo, gone = absent(P.id) || (P.id === me.id && hiddenNow());
    turnGone = gone;
    const mine = () => R && R.shotNo === no && R.players[R.turn] === P && !busy;
    if (!gone) turnT.push(later(() => { if (mine()) note('Plus que 15 s pour jouer, sinon le coup part tout seul !', P.id); }, TURN_HURRY_MS));
    turnT.push(later(() => {
      if (!mine()) return;
      const hole = currentHole(R), s = botShot(hole, simBall(hole, P.ball), windOf(R), 'normal', (R.seed + no * 11) >>> 0);
      note(`${P.name} ne joue pas : son coup part tout seul`);
      shot(P.id, { ...s, no });
    }, gone ? AWAY_TURN_MS : TURN_MS));
  }
  // message à afficher : à un joueur (id), ou à tous
  function note(text, id) {
    if (id == null || id === me.id) emit({ type: 'note', text });
    if (!solo) { if (id == null) send({ t: 'note', text }); else if (id !== me.id) bridge.send(id, { t: 'note', text }); }
  }
  function setAway(id, on) {
    if (on) away.add(id); else away.delete(id);
    recheck();
  }
  // quelqu'un est parti, s'est absenté ou est revenu : on n'attend plus les absents, et le compte du joueur dont c'est
  // le tour s'adapte (10 s s'il n'est pas là)
  function recheck() {
    if (!R || R.phase !== 'play') return;
    if (busy) { if (everyone('seen', R.shotNo - 1)) advance(R.shotNo - 1); return; }
    if (botWait && everyone('ready', botWait.no)) botWait.go();
    const P = R.players[R.turn];
    if (P && !P.bot && absent(P.id) !== turnGone) watchTurn();
  }

  function finish() {
    if (ended) return; ended = true;
    if (reported || !bridge.embedded) return;
    reported = true;
    const pars = R.holes.map((n) => holeByNumber(n).par);
    const rk = ranking(R, pars);
    try {
      bridge.report({
        id: `golf-${R.started}-${R.players.map((p) => p.id).join('.')}`,
        mode: (COURSES[R.course] || COURSES.campagne).label.split(' · ')[0],
        players: rk.map((x) => ({ id: typeof x.id === 'number' ? x.id : null, name: x.name, color: x.color, bot: x.bot, rank: x.rank, score: x.stableford })),
      });
    } catch (e) { console.warn(e); }
  }

  // messages des invités
  const onMsg = (from, m) => {
    if (!m || typeof m !== 'object') return;
    // pas encore de partie : l'invité voit les réglages du menu
    if (m.t === 'sync') bridge.send(from, R ? { t: 'st', R: clone(R) } : { t: 'setup', set: settings });
    else if (m.t === 'shot') shot(from, m);
    else if (m.t === 'seen') seen(m.no | 0, from);
    else if (m.t === 'ready') ready(m.no | 0, from);
    else if (m.t === 'away') setAway(from, !!m.on);
    else if (m.t === 'pose' && R && R.players[R.turn]?.id === from) {
      const pose = { t: 'pose', id: from, aim: +m.aim || 0, club: m.club | 0, back: +m.back || 0 };
      emit({ type: 'pose', ...pose }); send(pose, true);
      watchTurn(); // il est là : le compte repart
    }
  };
  if (!solo) bridge.on('msg', onMsg);
  // un joueur quitte le salon : il ne joue plus
  if (!solo) bridge.on('roster', () => {
    if (!R || R.phase === 'over') return;
    let changed = false;
    for (const p of R.players) if (!p.bot && !p.left && !bridge.players.some((q) => q.id === p.id)) { leave(R, currentHole(R), p.id); changed = true; }
    if (!changed) return recheck(); // peut-être une absence ou un retour
    // ceux qui restent ont peut-être déjà tout vu
    if (busy) { if (everyone('seen', R.shotNo - 1)) advance(R.shotNo - 1); return; }
    if (holeOver(R)) { busy = true; advance(R.shotNo - 1); } else { publish(); scheduleBot(); }
  });

  if (R) { busy = false; publish(); scheduleBot(); }
  return {
    get state() { return R; }, isHost: true,
    begin,
    // menu : l'hôte change un réglage (les invités le voient), ou y revient après une partie
    configure(set) { settings = { ...set }; send({ t: 'setup', set: settings }); },
    menu() { clear(); R = null; send({ t: 'menu', set: settings }); },
    // le joueur local joue son coup
    shot: (p) => shot(me.id, { ...p, no: R ? R.shotNo : 0 }),
    pose: (p) => { if (R && R.players[R.turn]?.id === me.id) { const pose = { t: 'pose', id: me.id, ...p }; send(pose, true); watchTurn(); } },
    // le joueur local a fini de regarder le coup no / voit le tour no / cache ou retrouve sa page
    done: (no) => seen(no, me.id),
    ready: (no) => ready(no, me.id),
    away(on) {
      setAway(me.id, on);
      if (on && R) { ready(R.shotNo, me.id); if (busy) seen(R.shotNo - 1, me.id); }
    },
    resync() {},
    stop() { for (const t of timers) clearTimeout(t); timers.clear(); R = null; },
  };
}

// ------------------------------------------------------------------ invité
export function startClient({ bridge, me, emit }) {
  let R = null, gotState = false, gotSetup = false, lastShot = -1, alive = true, tick = 0;
  // on redemande l'état tant qu'on ne l'a pas ; au menu, de temps en temps (au cas où le départ se serait perdu)
  const ask = setInterval(() => { if (!gotState && (!gotSetup || ++tick % 4 === 0)) bridge.send('host', { t: 'sync' }); }, 1500);
  bridge.send('host', { t: 'sync' });
  bridge.on('msg', (from, m) => {
    if (!alive || !m || typeof m !== 'object') return;
    if (m.t === 'st' && m.R) {
      gotState = true; R = m.R; emit({ type: 'state', R: m.R });
      if (hiddenNow()) bridge.send('host', { t: 'ready', no: R.shotNo }); // page cachée : personne ne m'attend
    } else if (m.t === 'shot' && m.ev) {
      lastShot = m.ev.no; emit({ type: 'shot', ev: m.ev });
      if (hiddenNow()) bridge.send('host', { t: 'seen', no: m.ev.no });
    } else if (m.t === 'setup' && !R && m.set && typeof m.set === 'object') { gotSetup = true; emit({ type: 'setup', set: m.set }); }
    else if (m.t === 'menu') { R = null; gotState = false; gotSetup = true; emit({ type: 'menu', set: m.set && typeof m.set === 'object' ? m.set : {} }); }
    else if (m.t === 'pose' && m.id !== me.id) emit({ type: 'pose', ...m });
    else if (m.t === 'note' && typeof m.text === 'string') emit({ type: 'note', text: m.text.slice(0, 120) });
  });
  let lastPose = 0;
  return {
    get state() { return R; }, isHost: false,
    begin() {},
    shot: (p) => bridge.send('host', { t: 'shot', no: R ? R.shotNo : 0, ...p }),
    pose: (p) => { const now = performance.now(); if (now - lastPose < 90) return; lastPose = now; bridge.send('host', { t: 'pose', ...p }, { volatile: true }); },
    done: (no) => bridge.send('host', { t: 'seen', no }),
    ready: (no) => bridge.send('host', { t: 'ready', no }),
    away(on) {
      bridge.send('host', { t: 'away', on });
      if (on) { if (R) bridge.send('host', { t: 'ready', no: R.shotNo }); if (lastShot >= 0) bridge.send('host', { t: 'seen', no: lastShot }); }
    },
    resync: () => bridge.send('host', { t: 'sync' }),
    stop() { alive = false; clearInterval(ask); },
  };
}

export { MAX_STROKES };
