/* Pont entre un jeu (dans une iframe) et le Hub qui détient le salon et la connexion.
   Le jeu reste jouable seul : HubBridge.embedded vaut false quand la page n'est pas ouverte par le Hub.

   API :
     HubBridge.embedded                 lancé depuis le Hub ?
     HubBridge.info                     { role: 'host'|'guest'|'solo', myId, hostId, code, game, settings }
     HubBridge.players / readyMap       joueurs du salon / { id: jeu prêt }
     HubBridge.on('init'|'roster'|'msg', fn)
     HubBridge.signalReady()            ce jeu écoute : les autres peuvent lui parler
     HubBridge.send(to, m, opts)        to = id de joueur, 'host' ou 'all' ; opts.volatile : instantané d'état continu
                                        (sauté si la connexion sature, seul le plus récent est livré)
     HubBridge.exit()                   retour au salon
     HubBridge.patchNet(Net)            remplace un objet Net façon Duo Drift par le canal du Hub */
(function () {
  const qs = new URLSearchParams(location.search);
  const embedded = qs.get('hub') === '1' && window.parent !== window;
  const target = location.origin === 'null' ? '*' : location.origin;
  const H = {
    embedded,
    info: { role: qs.get('role') || 'solo', code: qs.get('code') || null, game: qs.get('game') || null, myId: 0, hostId: 0, settings: {} },
    players: [], readyMap: {}, pings: {}, initDone: false, handlers: {},
  };
  const emit = (k, ...a) => (H.handlers[k] || []).forEach((f) => { try { f(...a); } catch (e) { console.error(e); } });
  const post = (o) => { if (embedded) parent.postMessage({ dd: 'hub', ...o }, target); };

  H.on = (k, fn) => {
    (H.handlers[k] = H.handlers[k] || []).push(fn);
    if (k === 'init' && H.initDone) setTimeout(() => fn(H.info), 0);
  };
  H.signalReady = () => post({ k: 'ready' });
  H.send = (to, m, opts) => post(opts && opts.volatile ? { k: 'send', to, m, v: 1 } : { k: 'send', to, m });
  H.exit = () => post({ k: 'exit' });
  // Fin de partie : le jeu de l'hôte transmet le classement au Hub (historique et classement entre potes)
  H.report = (r) => post({ k: 'result', r });
  H.playerName = (id) => { const p = H.players.find((q) => q.id === id); return p ? p.name : '?'; };

  window.addEventListener('message', (e) => {
    if (e.source !== window.parent) return;
    const d = e.data; if (!d || d.dd !== 'hub') return;
    if (d.k === 'init') {
      Object.assign(H.info, d.info); H.players = d.info.players || []; H.readyMap = d.info.ready || {}; H.pings = d.info.pings || {};
      H.initDone = true; emit('init', H.info); emit('roster', H.players, H.readyMap);
    } else if (d.k === 'roster') {
      H.players = d.players || []; H.readyMap = d.ready || {}; H.info.hostId = d.hostId;
      if (d.pings) Object.assign(H.pings, d.pings);
      if (d.role) H.info.role = d.role;
      if (d.code) H.info.code = d.code;
      emit('roster', H.players, H.readyMap);
    } else if (d.k === 'pings') {
      if (d.pings) Object.assign(H.pings, d.pings);
      emit('pings', H.pings);
    } else if (d.k === 'msg') emit('msg', d.from, d.m);
  });
  if (embedded) post({ k: 'hello' });

  // Duo Drift parle à un objet Net (host/join/to/bcast…) : on le branche sur le salon du Hub.
  // Côté hôte, chaque joueur dont le jeu est prêt devient un « lien » 'p<id>'.
  H.patchNet = (Net) => {
    let cb = null, role = null, opened = false, openedHost = null;
    const joined = new Set();
    const isReady = (id) => H.readyMap[id] === H.info.game;
    function sync() {
      if (!cb) return;
      if (role === 'host') {
        const ids = H.players.map((p) => p.id).filter((id) => id !== H.info.myId && isReady(id));
        for (const id of ids) if (!joined.has(id)) { joined.add(id); cb.join('p' + id); }
        for (const id of [...joined]) if (!ids.includes(id)) { joined.delete(id); if (cb.leave) cb.leave('p' + id); }
      } else if (role === 'guest') {
        const hostReady = isReady(H.info.hostId);
        // une course ne survit pas à un changement d'hôte : retour propre au salon
        const hostChanged = opened && openedHost !== H.info.hostId;
        if (hostReady && !opened) { opened = true; openedHost = H.info.hostId; Net.hostLink = { hub: true }; cb.open(); }
        else if ((!hostReady || hostChanged) && opened) { opened = false; Net.hostLink = null; if (cb.close) cb.close(); }
      }
    }
    H.on('roster', sync);
    H.on('msg', (from, m) => {
      if (!cb) return;
      if (role === 'host') { if (joined.has(from)) cb.msg('p' + from, m); }
      else if (opened && from === H.info.hostId) cb.msg(m);
    });
    Object.assign(Net, {
      host(c) {
        role = 'host'; cb = c; Net.cb = c; Net.role = 'host';
        H.signalReady();
        H.on('init', () => { c.ready(H.info.code || 'SOLO'); sync(); });
      },
      join(code, c) {
        role = 'guest'; cb = c; Net.cb = c; Net.role = 'guest';
        H.signalReady();
        H.on('init', sync);
      },
      toHost(m, vol) { H.send('host', m, { volatile: !!vol }); },
      to(cid, m, vol) { H.send(Number(String(cid).slice(1)), m, { volatile: !!vol }); },
      bcast(m, except, vol) { for (const id of joined) if ('p' + id !== except) H.send(id, m, { volatile: !!vol }); },
      drop(cid) { const id = Number(String(cid).slice(1)); H.send(id, { t: 'bye' }); Net._drop(cid); },
      _drop(cid) { const id = Number(String(cid).slice(1)); if (joined.delete(id) && cb && cb.leave) cb.leave(cid); },
      close() { cb = null; Net.cb = null; Net.hostLink = null; Net.role = null; joined.clear(); opened = false; },
    });
    Net.links = { get size() { return joined.size; } };
    return Net;
  };

  window.HubBridge = H;
})();
