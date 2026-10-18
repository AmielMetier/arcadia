/* Salon commun du Hub, construit sur DDNet. L'hôte fait autorité sur la liste des joueurs,
   le jeu choisi et l'état « prêt » de chaque joueur dans ce jeu ; il relaie les messages des jeux.

   Protocole (champ t) :
     invité → hôte : hello {name,color,lvl} · me {name,color,lvl} · chat {txt} · ready {game} · g {to,m} · ping · bye
     hôte → invité : welcome {id} · lobby {players,game,ready,code,host} · chat {...} · g {from,m} · pong · full · bye
   `g` transporte les messages d'un jeu ; le Hub ne les lit pas. `to` vaut un id de joueur, 'host' ou 'all'. */
(function () {
  const MAX_PLAYERS = 6;
  const PREFIX = 'ddhub-v1-';
  const PALETTE = ['#ff4b2b', '#2b8cff', '#ffc531', '#2fbf71', '#b45cff', '#ff5fa2', '#1fc7c1', '#ff8a1f'];
  const clean = (s, n) => String(s || '').replace(/[<>&"]/g, '').trim().slice(0, n);
  const cleanName = (s) => clean(s, 12) || 'Joueur';

  function createRoom(handlers) {
    const net = DDNet.create({ prefix: PREFIX, maxPeers: MAX_PLAYERS - 1 });
    const R = {
      mode: null,               // 'host' | 'guest' | 'solo'
      code: null, myId: 0, hostId: 0,
      players: [],              // [{ id, name, color, lvl, cid? }]
      game: null,               // { id, settings } ou null
      ready: {},                // { playerId: gameId }
      chat: [],
      pings: {}, lastRecv: 0, lastRecvC: {},
      get isHost() { return this.mode === 'host' || this.mode === 'solo'; },
      get me() { return this.players.find((p) => p.id === this.myId); },
    };
    const emit = (k, ...a) => { if (handlers[k]) handlers[k](...a); };
    const pub = () => ({ players: R.players.map(({ cid, ...p }) => p), game: R.game, ready: R.ready, code: R.code, host: R.hostId });
    const changed = () => { if (R.mode === 'host') net.bcast({ t: 'lobby', ...pub() }); emit('update', R); };
    const pushChat = (c) => { R.chat.push(c); R.chat = R.chat.slice(-40); emit('chat', c); };
    const sys = (txt) => { const c = { id: -1, txt, sys: true }; pushChat(c); if (R.mode === 'host') net.bcast({ t: 'chat', ...c }); };

    function deliverGame(from, to, m) {
      // côté hôte : un message de jeu venant de `from` (id) vers `to`
      if (to === 'host' || to === R.myId) { emit('game', from, m); return; }
      if (to === 'all') {
        emit('game', from, m);
        for (const p of R.players) if (p.cid && p.id !== from) net.to(p.cid, { t: 'g', from, m });
        return;
      }
      const p = R.players.find((q) => q.id === to);
      if (p && p.cid) net.to(p.cid, { t: 'g', from, m });
    }

    /* ---------- hôte ---------- */
    function onHostMsg(cid, m) {
      if (!m || typeof m !== 'object') return;
      R.lastRecvC[cid] = performance.now();
      const p = R.players.find((q) => q.cid === cid);
      switch (m.t) {
        case 'hello': {
          if (p) return;
          if (R.players.length >= MAX_PLAYERS) { net.to(cid, { t: 'full' }); net.drop(cid); return; }
          const used = new Set(R.players.map((q) => q.id)); let id = 0; while (used.has(id)) id++;
          const usedC = new Set(R.players.map((q) => q.color));
          const color = PALETTE.includes(m.color) && !usedC.has(m.color) ? m.color : PALETTE.find((c) => !usedC.has(c));
          const np = { id, cid, name: cleanName(m.name), color, lvl: Math.max(1, Math.min(99, m.lvl | 0)) };
          R.players.push(np);
          net.to(cid, { t: 'welcome', id, chat: R.chat.slice(-20) });
          sys(np.name + ' a rejoint le salon'); changed();
          break;
        }
        case 'me': if (p) { p.name = cleanName(m.name); p.lvl = Math.max(1, Math.min(99, m.lvl | 0)); changed(); } break;
        case 'chat': if (p) { const txt = clean(m.txt, 140); if (txt) { const c = { id: p.id, name: p.name, color: p.color, txt }; pushChat(c); net.bcast({ t: 'chat', ...c }); } } break;
        case 'ready': if (p) { if (m.game) R.ready[p.id] = m.game; else delete R.ready[p.id]; changed(); } break;
        case 'g': if (p) deliverGame(p.id, m.to, m.m); break;
        case 'ping': net.to(cid, { t: 'pong', ts: m.ts }); break;
        case 'pong': if (p) R.pings[p.id] = performance.now() - m.ts; break;
        case 'bye': net._drop(cid); break;
      }
    }
    function onHostLeave(cid) {
      const i = R.players.findIndex((q) => q.cid === cid); delete R.lastRecvC[cid];
      if (i < 0) return;
      const p = R.players[i]; R.players.splice(i, 1); delete R.ready[p.id]; delete R.pings[p.id];
      sys(p.name + ' a quitté le salon'); emit('left', p); changed();
    }

    /* ---------- invité ---------- */
    function onGuestMsg(m) {
      if (!m || typeof m !== 'object') return;
      R.lastRecv = performance.now();
      switch (m.t) {
        case 'welcome': R.myId = m.id | 0; R.chat = Array.isArray(m.chat) ? m.chat : []; emit('joined', R); break;
        case 'lobby': {
          const before = R.players;
          R.players = Array.isArray(m.players) ? m.players : []; R.game = m.game || null; R.ready = m.ready || {}; R.hostId = m.host | 0;
          for (const q of before) if (!R.players.some((x) => x.id === q.id)) emit('left', q);
          emit('update', R); break;
        }
        case 'chat': pushChat(m); break;
        case 'g': emit('game', m.from, m.m); break;
        case 'ping': net.toHost({ t: 'pong', ts: m.ts }); break;
        case 'pong': R.pings[R.myId] = performance.now() - m.ts; break;
        case 'full': emit('error', 'Le salon est complet (6 joueurs max).'); break;
        case 'bye': emit('closed', "L'hôte a fermé le salon."); break;
      }
    }

    /* ---------- API ---------- */
    Object.assign(R, {
      host(me) {
        R.mode = 'host'; R.myId = 0; R.hostId = 0; R.players = [{ id: 0, name: cleanName(me.name), color: me.color, lvl: me.lvl | 0 || 1 }];
        R.chat = []; R.ready = {}; R.game = null;
        net.host({
          ready(code) { R.code = code; emit('joined', R); changed(); },
          join(cid) { R.lastRecvC[cid] = performance.now(); },
          msg: onHostMsg, leave: onHostLeave,
          error(msg) { emit('error', msg); },
        });
      },
      join(code, me) {
        R.mode = 'guest'; R.players = []; R.chat = []; R.myId = -1; R.code = code;
        net.join(code, {
          open() { R.lastRecv = performance.now(); net.toHost({ t: 'hello', name: me.name, color: me.color, lvl: me.lvl }); },
          msg: onGuestMsg,
          close() { if (R.mode === 'guest') emit('closed', "Connexion perdue avec l'hôte."); },
          error(msg) { R.mode = null; emit('error', msg); },
        });
      },
      solo(me) {
        R.mode = 'solo'; R.myId = 0; R.hostId = 0; R.code = null; R.chat = []; R.ready = {}; R.game = null;
        R.players = [{ id: 0, name: cleanName(me.name), color: me.color, lvl: me.lvl | 0 || 1 }];
        setTimeout(() => { emit('joined', R); emit('update', R); }, 0);
      },
      leave() { net.close(); R.mode = null; R.players = []; R.game = null; R.ready = {}; R.code = null; },
      updateMe(me) {
        if (R.isHost) { const p = R.me; if (p) { p.name = cleanName(me.name); p.lvl = me.lvl | 0 || 1; changed(); } }
        else if (R.mode === 'guest') net.toHost({ t: 'me', name: me.name, lvl: me.lvl });
      },
      sendChat(txt) {
        txt = clean(txt, 140); if (!txt) return;
        if (R.isHost) { const p = R.me; const c = { id: p.id, name: p.name, color: p.color, txt }; pushChat(c); if (R.mode === 'host') net.bcast({ t: 'chat', ...c }); }
        else net.toHost({ t: 'chat', txt });
      },
      // L'hôte choisit le jeu (ou null pour revenir au salon). Tous les Hub suivent.
      setGame(id, settings) {
        if (!R.isHost) return;
        R.game = id ? { id, settings: settings || {}, n: Date.now() } : null;
        if (!id) R.ready = {};
        changed();
      },
      // Le jeu de ce joueur est prêt (ou fermé si game = null).
      setReady(game) {
        if (R.isHost) { if (game) R.ready[R.myId] = game; else delete R.ready[R.myId]; changed(); }
        else net.toHost({ t: 'ready', game });
      },
      sendGame(to, m) {
        if (R.isHost) deliverGame(R.myId, to, m);
        else net.toHost({ t: 'g', to, m });
      },
      kick(id) { const p = R.players.find((q) => q.id === id); if (R.mode === 'host' && p && p.cid) net.drop(p.cid); },
      // à appeler régulièrement : pings et détection des déconnexions silencieuses
      tick(now) {
        if (R.mode === 'host') {
          net.bcast({ t: 'ping', ts: now });
          for (const p of R.players) if (p.cid && now - (R.lastRecvC[p.cid] || now) > 15000) net.drop(p.cid);
        } else if (R.mode === 'guest' && net.hostLink) {
          net.toHost({ t: 'ping', ts: now });
          if (R.lastRecv && now - R.lastRecv > 15000) { R.lastRecv = 0; emit('closed', "Connexion perdue avec l'hôte."); }
        }
      },
    });
    return R;
  }

  window.DDRoom = { create: createRoom, MAX_PLAYERS, PALETTE, cleanName };
})();
