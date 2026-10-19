const WS_SERVER_URL = "wss://duo-drift-relay.onrender.com";

/* Réseau en étoile entre amis, via serveur relais WebSocket.
   L'hôte ouvre un salon <préfixe><CODE> ; les invités s'y connectent ; le serveur relaie les paquets.
   ?local dans l'adresse : remplace WebSocket par un BroadcastChannel pour tester entre onglets.
   ?ws=wss://... : surcharge l'URL du serveur relais.
   Usage : const net = DDNet.create({ prefix: 'ddhub-v1-', maxPeers: 5 }); net.host(cb) / net.join(code, cb). */
(function () {
  const CODE_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const genCode = () => Array.from({ length: 4 }, () => CODE_ALPHA[(Math.random() * CODE_ALPHA.length) | 0]).join('');
  const QS = new URLSearchParams(location.search);
  const LOCAL_TEST = QS.has('local');
  const getWsUrl = () => QS.get('ws') || WS_SERVER_URL;
  const getHttpUrl = () => getWsUrl().replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');

  // Réveil automatique du serveur Render dès l'ouverture de la page (évite l'attente de 50s à la création du salon)
  function wakeServer() {
    if (LOCAL_TEST) return;
    try { fetch(getHttpUrl(), { mode: 'no-cors', cache: 'no-store' }).catch(() => {}); } catch (e) {}
  }
  wakeServer();

  const BLOCKED = "Impossible de joindre le serveur relais WebSocket. Vérifie ta connexion internet ou réessaie dans quelques secondes.";

  function create({ prefix, maxPeers = 5 }) {
    const net = {
      ws: null, bc: null, links: new Map(), hostLink: null, cb: null, cidc: 0, role: null, code: null, roomId: null, pingIv: null, retryTo: null,
      // fixedCode : code imposé (migration d'hôte) ; sinon un code au hasard
      host(cb, fixedCode) {
        this.role = 'host'; this.cb = cb; this.links = new Map();
        const code = fixedCode || genCode(); this.code = code;
        const roomId = prefix + code; this.roomId = roomId;
        if (LOCAL_TEST) {
          const bc = new BroadcastChannel(roomId); this.bc = bc; setTimeout(() => cb.ready(code), 30);
          bc.onmessage = (e) => {
            const m = e.data; if (!m) return;
            if (m.k === 'hi') {
              if (this.links.size >= maxPeers) { bc.postMessage({ k: 'full', to: m.cid }); return; }
              const cid = m.cid;
              this.links.set(cid, { send: (x) => bc.postMessage({ k: 'd', to: cid, m: x }), close: () => bc.postMessage({ k: 'bye', to: cid }) });
              bc.postMessage({ k: 'ok', to: cid }); cb.join(cid);
            } else if (m.to === 'host') {
              if (m.k === 'd') { if (this.links.has(m.from)) cb.msg(m.from, m.m); } else if (m.k === 'bye') this._drop(m.from);
            }
          };
          return;
        }
        this._hostWs(cb, code, fixedCode, roomId, Date.now() + 60000);
      },
      _hostWs(cb, code, fixedCode, roomId, deadline) {
        wakeServer();
        let ws;
        try { ws = new WebSocket(getWsUrl()); } catch (e) { cb.error(BLOCKED); return; }
        this.ws = ws;
        let ready = false, retried = false;
        const retryOrFail = () => {
          if (retried || ready || this.cb !== cb) return;
          retried = true;
          this._stopKeepAlive();
          try { ws.close(); } catch (e) {}
          if (Date.now() < deadline) {
            this.retryTo = setTimeout(() => {
              if (this.cb === cb && this.role === 'host') this._hostWs(cb, code, fixedCode, roomId, deadline);
            }, 2500);
          } else {
            cb.error(BLOCKED);
          }
        };
        const sendWs = (obj) => { if (ws.readyState === WebSocket.OPEN) { try { ws.send(JSON.stringify(obj)); } catch (e) {} } };
        this._startKeepAlive(ws, roomId);
        ws.onopen = () => {
          sendWs({ type: 'join_room', roomId, role: 'host', maxPeers });
        };
        ws.onmessage = (ev) => {
          if (this.ws !== ws) return;
          let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
          if (!msg || typeof msg !== 'object') return;
          if (msg.type === 'pong') return;
          if (msg.type === 'ping') { sendWs({ type: 'pong', roomId }); return; }
          if (msg.type === 'room_joined') {
            ready = true; cb.ready(code);
            return;
          }
          if (msg.type === 'error') {
            if (msg.reason === 'unavailable-id') {
              retried = true;
              this._stopKeepAlive(); try { ws.close(); } catch (e) {} this.ws = null;
              if (fixedCode) cb.error('Code indisponible.'); else this.host(cb);
              return;
            }
            retried = true;
            cb.error(msg.message || 'Erreur de connexion.');
            return;
          }
          if (msg.type === 'peer_joined') {
            const cid = msg.cid;
            if (!cid) return;
            if (this.links.size >= maxPeers) {
              sendWs({ type: 'relay', roomId, to: cid, data: { _ctrl: 'full' } });
              return;
            }
            this.links.set(cid, {
              send: (x) => sendWs({ type: 'relay', roomId, to: cid, data: x }),
              close: () => sendWs({ type: 'relay', roomId, to: cid, data: { _ctrl: 'bye' } }),
            });
            sendWs({ type: 'relay', roomId, to: cid, data: { _ctrl: 'ok' } });
            cb.join(cid);
            return;
          }
          if (msg.type === 'peer_left') {
            if (msg.cid) this._drop(msg.cid);
            return;
          }
          if (msg.type === 'relay') {
            const cid = msg.from;
            const d = msg.data;
            if (!cid || !d) return;
            if (d._ctrl === 'hi') {
              if (this.links.has(cid)) return;
              if (this.links.size >= maxPeers) {
                sendWs({ type: 'relay', roomId, to: cid, data: { _ctrl: 'full' } });
                return;
              }
              this.links.set(cid, {
                send: (x) => sendWs({ type: 'relay', roomId, to: cid, data: x }),
                close: () => sendWs({ type: 'relay', roomId, to: cid, data: { _ctrl: 'bye' } }),
              });
              sendWs({ type: 'relay', roomId, to: cid, data: { _ctrl: 'ok' } });
              cb.join(cid);
              return;
            }
            if (d._ctrl === 'bye') { this._drop(cid); return; }
            if (this.links.has(cid)) cb.msg(cid, d);
          }
        };
        ws.onerror = () => {
          if (this.ws !== ws) return;
          if (!ready) retryOrFail();
        };
        ws.onclose = () => {
          if (this.ws !== ws) return;
          this._stopKeepAlive();
          if (!ready) retryOrFail();
        };
      },
      _drop(cid) { if (!this.links.has(cid)) return; this.links.delete(cid); if (this.cb && this.cb.leave) this.cb.leave(cid); },
      drop(cid) {
        const L = this.links.get(cid); if (!L) return;
        try { L.send({ t: 'bye' }); } catch (e) {}
        setTimeout(() => { try { L.close(); } catch (e) {} }, 80); this._drop(cid);
      },
      join(code, cb, timeout = 60000) {
        this.role = 'guest'; this.cb = cb; this.code = code;
        const roomId = prefix + code; this.roomId = roomId;
        let done = false; const fin = (fn, a) => { if (done) return; done = true; clearTimeout(to); clearTimeout(this.retryTo); fn(a); };
        let signaled = false;
        const deadline = Date.now() + timeout;
        const to = setTimeout(() => fin(cb.error, signaled ? "Aucun salon avec ce code ou l'hôte ne répond pas." : BLOCKED), timeout);
        if (LOCAL_TEST) {
          const cid = 'g' + Math.random().toString(36).slice(2, 9), bc = new BroadcastChannel(roomId); this.bc = bc; let closed = false;
          this.hostLink = { send: (x) => bc.postMessage({ k: 'd', to: 'host', from: cid, m: x }), close: () => bc.postMessage({ k: 'bye', to: 'host', from: cid }) };
          bc.onmessage = (e) => {
            const m = e.data; if (!m || m.to !== cid) return;
            if (m.k === 'ok') fin(cb.open);
            else if (m.k === 'full') fin(cb.error, `Le salon est complet (${maxPeers + 1} joueurs max).`);
            else if (m.k === 'd') cb.msg(m.m);
            else if (m.k === 'bye' && !closed) { closed = true; cb.close(); }
          };
          bc.postMessage({ k: 'hi', cid }); return;
        }
        const connectGuest = () => {
          if (done || this.cb !== cb) return;
          wakeServer();
          let ws;
          try { ws = new WebSocket(getWsUrl()); } catch (e) { fin(cb.error, BLOCKED); return; }
          this.ws = ws;
          let closed = false, retried = false;
          const sendWs = (obj) => { if (ws.readyState === WebSocket.OPEN) { try { ws.send(JSON.stringify(obj)); } catch (e) {} } };
          this._startKeepAlive(ws, roomId);
          const fireClose = () => { if (closed) return; closed = true; if (done && this.cb === cb) cb.close(); };
          const retryOrFail = () => {
            if (retried || done || this.cb !== cb) return;
            retried = true;
            this._stopKeepAlive();
            try { ws.close(); } catch (e) {}
            if (Date.now() < deadline) {
              this.retryTo = setTimeout(connectGuest, 2500);
            } else {
              fin(cb.error, BLOCKED);
            }
          };
          this.hostLink = {
            send: (x) => sendWs({ type: 'relay', roomId, to: 'host', data: x }),
            close: () => { sendWs({ type: 'relay', roomId, to: 'host', data: { _ctrl: 'bye' } }); try { ws.close(); } catch (e) {} },
          };
          ws.onopen = () => {
            signaled = true;
            sendWs({ type: 'join_room', roomId, role: 'guest' });
          };
          ws.onmessage = (ev) => {
            if (this.ws !== ws) return;
            let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
            if (!msg || typeof msg !== 'object') return;
            if (msg.type === 'pong') return;
            if (msg.type === 'ping') { sendWs({ type: 'pong', roomId }); return; }
            if (msg.type === 'room_joined') {
              sendWs({ type: 'relay', roomId, to: 'host', data: { _ctrl: 'hi' } });
              return;
            }
            if (msg.type === 'error') {
              retried = true;
              if (msg.reason === 'room-not-found') fin(cb.error, "Aucun salon avec ce code. Vérifie-le avec ton pote.");
              else if (msg.reason === 'room-full') fin(cb.error, `Le salon est complet (${maxPeers + 1} joueurs max).`);
              else fin(cb.error, msg.message || "Erreur de connexion.");
              return;
            }
            if (msg.type === 'host_left') {
              retried = true;
              if (!done) fin(cb.error, "Aucun salon avec ce code. Vérifie-le avec ton pote.");
              else fireClose();
              return;
            }
            if (msg.type === 'relay') {
              const d = msg.data;
              if (!d) return;
              if (d._ctrl === 'ok') { fin(cb.open); return; }
              if (d._ctrl === 'full') { fin(cb.error, `Le salon est complet (${maxPeers + 1} joueurs max).`); return; }
              if (d._ctrl === 'bye') { fireClose(); return; }
              if (!done) fin(cb.open);
              if (d.t === 'full') { fin(cb.error, `Le salon est complet (${maxPeers + 1} joueurs max).`); return; }
              cb.msg(d);
            }
          };
          ws.onerror = () => { if (this.ws !== ws) return; if (!done) retryOrFail(); else fireClose(); };
          ws.onclose = () => { if (this.ws !== ws) return; this._stopKeepAlive(); if (!done) retryOrFail(); else fireClose(); };
        };
        connectGuest();
      },
      _startKeepAlive(ws, roomId) {
        this._stopKeepAlive();
        this.pingIv = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ type: 'ping', roomId })); } catch (e) {}
          }
        }, 25000);
      },
      _stopKeepAlive() {
        if (this.pingIv) { clearInterval(this.pingIv); this.pingIv = null; }
      },
      toHost(m) { this.hostLink && this.hostLink.send(m); },
      to(cid, m) { const L = this.links.get(cid); L && L.send(m); },
      bcast(m, except) {
        if (LOCAL_TEST) {
          for (const [cid, L] of this.links) if (cid !== except) L.send(m);
          return;
        }
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.links.size > 0) {
          try {
            this.ws.send(JSON.stringify({ type: 'relay', roomId: this.roomId, except: except || undefined, data: m }));
          } catch (e) {}
        }
      },
      close() {
        this._stopKeepAlive();
        clearTimeout(this.retryTo);
        const w = this.ws, b = this.bc, roomId = this.roomId;
        if (this.role === 'host') {
          if (LOCAL_TEST) {
            const ls = [...this.links.values()]; for (const L of ls) L.send({ t: 'bye' });
            setTimeout(() => ls.forEach((L) => L.close()), 80);
          } else if (w && w.readyState === WebSocket.OPEN) {
            try { w.send(JSON.stringify({ type: 'relay', roomId, data: { t: 'bye' } })); } catch (e) {}
            try { w.send(JSON.stringify({ type: 'leave_room', roomId })); } catch (e) {}
          }
          this.links = new Map();
        } else if (this.hostLink) {
          const L = this.hostLink; L.send({ t: 'bye' });
          if (w && w.readyState === WebSocket.OPEN) {
            try { w.send(JSON.stringify({ type: 'leave_room', roomId })); } catch (e) {}
          }
          setTimeout(() => L.close(), 60);
        }
        this.hostLink = null; this.ws = null; this.bc = null; this.role = null; this.cb = null; this.code = null; this.roomId = null;
        setTimeout(() => { try { w && w.close(); } catch (e) {} try { b && b.close(); } catch (e) {} }, 150);
      },
    };
    return net;
  }

  window.WS_SERVER_URL = WS_SERVER_URL;
  window.DDNet = { create, LOCAL_TEST, BLOCKED, getWsUrl, wakeServer, WS_SERVER_URL };
})();

