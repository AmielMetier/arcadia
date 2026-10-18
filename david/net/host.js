// Hôte de DavidSimulator : détient l'état, applique le moteur, fait jouer les bots et gère les minuteurs.
// Les invités n'envoient que des intentions ({ t:'act', a }) ; l'hôte renvoie l'état complet et les événements.
import { createGame, reduce, actors } from '../engine/rules.js';
import { botAction } from '../engine/bot.js';
import { randomSeed } from '../engine/rng.js';

const BOT_NAMES = ['Mamé Rose', 'Tonton Jojo', 'Lou Pitchoun', 'Cousin Marius', 'Tata Nine'];
const COLORS = ['#ff4b2b', '#2b8cff', '#ffc531', '#2fbf71', '#b45cff', '#ff5fa2', '#1fc7c1', '#ff8a1f'];
const AUCTION_IDLE_MS = 12000;
const START_WAIT_MS = 10000;

export function startHost({ board, bridge, solo, settings, me, onState, onWaiting, onError }) {
  let state = null;
  let botTimer = 0, auctionTimer = 0, auctionKey = '', clock = 0;
  const humans = new Set();

  function broadcast(events) {
    if (!solo) bridge.send('all', { t: 'st', s: state, ev: events, now: Date.now() });
    try { localStorage.setItem('david_save', JSON.stringify({ at: Date.now(), state })); } catch (e) {}
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
      const a = botAction(state, board, id);
      if (!a) continue;
      const delay = a.type === 'ROLL' ? 900 : a.type === 'END_TURN' ? 700 : a.type === 'BID' || a.type === 'PASS' ? 650 : 500;
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
        auctionTimer = setTimeout(() => apply({ type: 'AUCTION_TIMEOUT', by: 'host' }), AUCTION_IDLE_MS);
      }
    } else { auctionKey = ''; clearTimeout(auctionTimer); }
  }

  function begin(humanIds) {
    if (state) return;
    const roster = solo ? [{ id: me.id, name: me.name, color: me.color }] : bridge.players.filter((p) => humanIds.includes(p.id));
    const players = roster.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: false }));
    for (const p of players) humans.add(p.id);
    let bots = Math.max(0, Math.min(Number(settings.bots ?? (solo ? 3 : 0)), 6 - players.length));
    if (players.length + bots < 2) bots = 2 - players.length;
    const used = new Set(players.map((p) => p.color));
    for (let k = 0; k < bots; k++) {
      const color = COLORS.find((c) => !used.has(c)) || COLORS[k]; used.add(color);
      players.push({ id: 100 + k, name: BOT_NAMES[k], color, bot: true });
    }
    try {
      const g = createGame(board, { players, mode: settings.mode === 'express' ? 'express' : 'classic', seed: randomSeed(), now: Date.now() });
      state = g.state;
      broadcast(g.events);
      schedule();
      if (state.endsAt) clock = setInterval(() => { if (state && !state.over && Date.now() >= state.endsAt) apply({ type: 'TIME_UP', by: 'host' }); }, 1000);
    } catch (e) { onError(e.message); }
  }

  if (solo) { setTimeout(() => begin([me.id]), 0); }
  else {
    // on attend que le jeu de chaque joueur du salon soit chargé (10 s maximum)
    const t0 = Date.now();
    const check = () => {
      if (state) return;
      const ids = bridge.players.map((p) => p.id);
      const ready = ids.filter((id) => id === me.id || bridge.readyMap[id] === 'david');
      onWaiting(ready, ids);
      if (ready.length === ids.length || Date.now() - t0 > START_WAIT_MS) begin(ready);
    };
    bridge.on('roster', () => {
      check();
      if (!state) return;
      // un joueur parti du salon (ou revenu au salon) quitte la partie
      for (const id of humans) {
        const inRoom = bridge.players.some((p) => p.id === id);
        const p = state.players.find((q) => q.id === id);
        if (!inRoom && p && !p.bankrupt && !state.over) apply({ type: 'PLAYER_LEFT', by: 'host', player: id });
      }
    });
    const poll = setInterval(() => { if (state) clearInterval(poll); else check(); }, 500);
    bridge.on('msg', (from, m) => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'sync' && state) bridge.send(from, { t: 'st', s: state, ev: [], now: Date.now() });
      if (m.t === 'act' && m.a && typeof m.a === 'object') {
        const r = apply({ ...m.a, by: from }); // l'identité vient du salon, jamais du message
        if (!r.ok) bridge.send(from, { t: 'err', msg: r.error });
      }
    });
  }

  return {
    act(a) { const r = apply({ ...a, by: me.id }); if (!r.ok) onError(r.error); },
    get state() { return state; },
  };
}
