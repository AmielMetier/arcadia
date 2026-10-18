// Hôte de DavidSimulator : détient l'état, applique le moteur, fait jouer les bots et gère les minuteurs.
// Les invités n'envoient que des intentions ({ t:'act', a }) ; l'hôte renvoie l'état complet et les événements.
import { createGame, reduce, actors } from '../engine/rules.js';
import { botAction, BOT_LEVELS } from '../engine/bot.js';
import { randomSeed } from '../engine/rng.js';
import { cleanHouse } from '../engine/modes.js';
import { remapPlayers, resumeAt, proposeMapping } from '../engine/resume.js';
import { saves } from './saves.js';
import { TOKEN_IDS } from '../view/tokens.js';

const BOT_NAMES = ['Mamé Rose', 'Tonton Jojo', 'Lou Pitchoun', 'Cousin Marius', 'Tata Nine'];
const COLORS = ['#ff4b2b', '#2b8cff', '#ffc531', '#2fbf71', '#b45cff', '#ff5fa2', '#1fc7c1', '#ff8a1f'];
const AUCTION_IDLE_MS = 12000;

const ABSENT_MS = 20000; // délai avant qu'un bot remplace un joueur déconnecté

// initial : état d'une partie en cours, quand ce joueur reprend le rôle d'hôte après le départ du précédent
export function startHost({ board, bridge, solo, settings, me, onState, onSetup, onError, initial = null }) {
  let state = null;
  const level = BOT_LEVELS.includes(settings.level) ? settings.level : 'normal';
  const botMemory = {}; // échanges déjà proposés par les bots
  let botTimer = 0, auctionTimer = 0, auctionKey = '', clock = 0;
  const humans = new Set();

  // Durée approximative de la mise en scène chez les joueurs : les bots attendent la fin des animations.
  let pace = 0;
  function paceOf(events) {
    let ms = 0;
    for (const e of events) {
      if (e.k === 'DICE') ms += 1300;
      else if (e.k === 'MOVE') ms += Math.abs(e.steps) * 190 + 250;
      else if (e.k === 'CARD') ms += 1700 + e.text.length * 22;
      else if (e.k === 'TURN') ms += 950;
      else if (e.k === 'JAIL') ms += 1600;
      else if (e.k === 'BUY' || e.k === 'GIFT') ms += 1300;
      else if (e.k === 'AUCTION_END') ms += 800;
      else if (e.k === 'PAY') ms += ['rent', 'go', 'card', 'tax', 'buy', 'auction', 'trade'].includes(e.reason) ? 1000 : 150;
      else if (e.k === 'AUCTION_START' || e.k === 'TRADE_DONE' || e.k === 'BANKRUPT' || e.k === 'DEBT' || e.k === 'SPEEDING') ms += 1000;
      else if (e.k === 'BUILD') ms += 500;
    }
    return ms;
  }

  function broadcast(events) {
    pace = paceOf(events);
    if (!solo) bridge.send('all', { t: 'st', s: state, ev: events, now: Date.now() });
    saves.put(state);
    onState(state, events, 0);
  }

  function apply(action) {
    if (!state) return { ok: false, error: 'La partie n’a pas commencé.' };
    const r = reduce(state, action, board);
    if (!r.ok) return r;
    state = r.state;
    broadcast(r.events);
    schedule();
    return r;
  }

  function schedule() {
    clearTimeout(botTimer);
    if (!state || state.over) { clearInterval(clock); clearTimeout(auctionTimer); return; }
    // bots qui doivent agir : acteurs du moment + destinataires d'une proposition d'échange
    const ids = new Set(actors(state));
    for (const t of state.trades) ids.add(t.to);
    for (const id of ids) {
      const p = state.players.find((q) => q.id === id);
      if (!p || !p.bot || p.bankrupt) continue;
      const a = botAction(state, board, id, { level, memory: botMemory });
      if (!a) continue;
      const delay = pace + (a.type === 'ROLL' ? 700 : a.type === 'END_TURN' ? 600 : a.type === 'BID' || a.type === 'PASS' ? 900 : 450);
      botTimer = setTimeout(() => {
        const r = apply({ ...a, by: id });
        if (!r.ok) console.warn('bot', id, a, r.error);
      }, delay);
      break;
    }
    // enchère : clôture après quelques secondes sans nouvelle offre
    if (state.auction) {
      const key = state.auction.space + ':' + state.auction.bids + ':' + state.auction.passed.length;
      if (key !== auctionKey) {
        auctionKey = key; clearTimeout(auctionTimer);
        auctionTimer = setTimeout(() => apply({ type: 'AUCTION_TIMEOUT', by: 'host' }), AUCTION_IDLE_MS + pace);
      }
    } else { auctionKey = ''; clearTimeout(auctionTimer); }
  }

  /* ---------------------------------------------------------- avant-partie : choix des pions */
  const picks = {}; // id du joueur → pion
  let resumeId = null; // partie sauvegardée choisie par l'hôte
  const mode = settings.mode === 'express' ? 'express' : 'classic';
  const house = cleanHouse({ jackpot: Number(settings.jackpot) === 1, doubleGo: Number(settings.doubleGo) === 1, auctions: settings.auctions == null || Number(settings.auctions) === 1, cash: settings.cash });
  const botCount = (n) => { let b = Math.max(0, Math.min(Number(settings.bots ?? (solo ? 3 : 0)), 6 - n)); if (n + b < 2) b = 2 - n; return b; };
  function setupState() {
    const room = solo ? [{ id: me.id, name: me.name, color: me.color }] : bridge.players;
    const players = room.map((p) => ({ id: p.id, name: p.name, color: p.color, ready: solo || p.id === me.id || bridge.readyMap[p.id] === 'david' }));
    for (const id of Object.keys(picks)) if (!players.some((p) => p.id === +id)) delete picks[id];
    const list = saves.list();
    if (resumeId && !list.some((s) => s.id === resumeId)) resumeId = null;
    let resume = null;
    if (resumeId) {
      const sv = saves.get(resumeId);
      const map = proposeMapping(sv.state.players, players.filter((p) => p.ready));
      resume = { id: resumeId, at: sv.at, round: sv.state.round, mode: sv.state.mode, house: sv.state.cfg.house,
        seats: sv.state.players.map((p) => ({ name: p.name, token: p.token, color: p.color, bankrupt: p.bankrupt, cash: p.cash,
          to: map[p.id].bot ? null : (players.find((r) => r.id === map[p.id].id) || {}).name })) };
    }
    return { players, picks: { ...picks }, mode, house, level, bots: botCount(players.filter((p) => p.ready).length), hostId: me.id, saves: list, resume };
  }
  function pushSetup() {
    if (state) return;
    const s = setupState();
    if (!solo) bridge.send('all', { t: 'setup', s });
    onSetup(s);
  }
  function pick(id, token) {
    if (state) return 'La partie a déjà commencé.';
    if (!TOKEN_IDS.includes(token)) return 'Pion inconnu.';
    if (Object.entries(picks).some(([k, v]) => v === token && +k !== id)) return 'Ce pion est déjà pris.';
    picks[id] = token;
    pushSetup();
    return null;
  }

  // Reprise d'une partie sauvegardée avec les joueurs présents
  function resume() {
    const sv = saves.get(resumeId);
    if (!sv) { onError('Sauvegarde introuvable.'); return; }
    const room = setupState().players.filter((p) => p.ready);
    const map = proposeMapping(sv.state.players, room);
    try {
      state = resumeAt(remapPlayers(sv.state, map), sv.at, Date.now());
      for (const p of state.players) if (!p.bot) humans.add(p.id);
      broadcast([{ k: 'RESUMED', round: state.round }]);
      schedule();
      if (state.endsAt) clock = setInterval(() => { if (state && !state.over && Date.now() >= state.endsAt) apply({ type: 'TIME_UP', by: 'host' }); }, 1000);
    } catch (e) { onError(e.message); }
  }

  function begin(humanIds) {
    if (state) return;
    const roster = solo ? [{ id: me.id, name: me.name, color: me.color }] : bridge.players.filter((p) => humanIds.includes(p.id));
    const players = roster.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: false, token: picks[p.id] }));
    for (const p of players) humans.add(p.id);
    const bots = botCount(players.length);
    const used = new Set(players.map((p) => p.color));
    for (let k = 0; k < bots; k++) {
      const color = COLORS.find((c) => !used.has(c)) || COLORS[k]; used.add(color);
      players.push({ id: 100 + k, name: BOT_NAMES[k], color, bot: true });
    }
    // pions restants : au hasard pour les bots et les retardataires
    const free = TOKEN_IDS.filter((tk) => !players.some((p) => p.token === tk)).sort(() => Math.random() - 0.5);
    for (const p of players) if (!p.token) p.token = free.shift();
    try {
      const g = createGame(board, { players, mode, seed: randomSeed(), now: Date.now(), house });
      state = g.state;
      state.gid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7); // identifiant de sauvegarde
      broadcast(g.events);
      schedule();
      if (state.endsAt) clock = setInterval(() => { if (state && !state.over && Date.now() >= state.endsAt) apply({ type: 'TIME_UP', by: 'host' }); }, 1000);
    } catch (e) { onError(e.message); }
  }

  if (initial) {
    // reprise du rôle d'hôte : on repart du dernier état connu
    state = initial;
    for (const p of state.players) if (p.human ?? !p.bot) humans.add(p.id);
    setTimeout(() => { broadcast([{ k: 'HOST_CHANGED', host: me.id }]); schedule(); }, 300);
    if (state.endsAt) clock = setInterval(() => { if (state && !state.over && Date.now() >= state.endsAt) apply({ type: 'TIME_UP', by: 'host' }); }, 1000);
  } else setTimeout(pushSetup, 0);
  if (!solo) {
    // présence des joueurs : un absent depuis ABSENT_MS est remplacé par un bot, et reprend la main à son retour
    const absentSince = {};
    const presence = () => {
      if (!state || state.over) return;
      const now = Date.now();
      for (const id of humans) {
        const inRoom = bridge.players.some((p) => p.id === id);
        const p = state.players.find((q) => q.id === id);
        if (!p || p.bankrupt) continue;
        if (inRoom) {
          delete absentSince[id];
          if (p.bot && id !== me.id) apply({ type: 'SET_BOT', by: 'host', player: id, bot: false });
        } else {
          absentSince[id] = absentSince[id] || now;
          if (!p.bot && now - absentSince[id] >= ABSENT_MS) apply({ type: 'SET_BOT', by: 'host', player: id, bot: true });
        }
      }
    };
    setInterval(presence, 2000);
    bridge.on('roster', () => { pushSetup(); presence(); });
    bridge.on('msg', (from, m) => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'sync') { if (state) bridge.send(from, { t: 'st', s: state, ev: [], now: Date.now() }); else pushSetup(); }
      if (m.t === 'pick') { const err = pick(from, String(m.token)); if (err) bridge.send(from, { t: 'err', msg: err }); }
      if (m.t === 'act' && m.a && typeof m.a === 'object') {
        const r = apply({ ...m.a, by: from }); // l'identité vient du salon, jamais du message
        if (!r.ok) bridge.send(from, { t: 'err', msg: r.error });
      }
    });
  }

  return {
    act(a) { const r = apply({ ...a, by: me.id }); if (!r.ok) onError(r.error); },
    pick(token) { const err = pick(me.id, token); if (err) onError(err); },
    start() { if (state) return; if (resumeId) resume(); else begin(setupState().players.filter((p) => p.ready).map((p) => p.id)); },
    chooseSave(id) { if (state) return; resumeId = id || null; pushSetup(); },
    deleteSave(id) { saves.remove(id); if (resumeId === id) resumeId = null; pushSetup(); },
    get state() { return state; },
    // tests uniquement (?debug) : modifier l'état puis le rediffuser
    debug(fn) { fn(state); broadcast([]); schedule(); },
  };
}
