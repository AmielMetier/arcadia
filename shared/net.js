const WS_SERVER_URL = "wss://duo-drift-relay.onrender.com";

/* Réseau en étoile entre amis, via serveur relais WebSocket.
   L'hôte ouvre un salon <préfixe><CODE> ; les invités s'y connectent ; le serveur relaie les paquets.
   ?local dans l'adresse : remplace WebSocket par un BroadcastChannel pour tester entre onglets.
   ?ws=wss://... : surcharge l'URL du serveur relais.
   Usage : const net = DDNet.create({ prefix: 'ddhub-v1-', maxPeers: 5 }); net.host(cb) / net.join(code, cb).

   Messages « volatils » (to / toHost / bcast avec vol = true) : instantanés d'état envoyés en continu, dont seul le plus
   récent compte. Quand la connexion sature (tampon d'envoi plein), on les saute au lieu de les empiler : sinon la file
   d'attente grossit et le joueur se retrouve avec des secondes de retard (ping à 1 500 ms) alors que sa connexion est bonne.
   Le serveur relais fait de même pour chaque destinataire. */
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
  const SEND_BUFFER_MAX = 48 * 1024; // au-delà, la connexion n'arrive plus à suivre : les messages volatils attendront le suivant
  const isVol = (o) => o === true || !!(o && o.volatile);

  function create({ prefix, maxPeers = 5 }) {
    const net = {
      ws: null, bc: null, links: new Map(), hostLink: null, cb: null, cidc: 0, role: null, code: null, roomId: null, pingIv: null, retryTo: null,
      proto: 1, stats: { sent: 0, dropped: 0 },
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
          if (msg.type === 'pong') { this._pong(msg.ts); return; }
          if (msg.type === 'ping') { sendWs({ type: 'pong', roomId, ts: msg.ts }); return; }
          if (msg.type === 'room_joined') {
            this.proto = msg.proto || 1; // 2 : le serveur relaie sans relire les données et protège les connexions lentes
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
            if (this.links.size >= maxPeers && !this.links.has(cid)) {
              sendWs({ type: 'relay', roomId, to: cid, data: { _ctrl: 'full' } });
              return;
            }
            this.links.set(cid, {
              send: (x, v) => this._relay(cid, x, v),
              close: () => this._sendWs({ type: 'relay', roomId, to: cid, data: { _ctrl: 'bye' } }),
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
              if (!this.links.has(cid) && this.links.size >= maxPeers) {
                sendWs({ type: 'relay', roomId, to: cid, data: { _ctrl: 'full' } });
                return;
              }
              this.links.set(cid, {
                send: (x, v) => this._relay(cid, x, v),
                close: () => this._sendWs({ type: 'relay', roomId, to: cid, data: { _ctrl: 'bye' } }),
              });
              sendWs({ type: 'relay', roomId, to: cid, data: { _ctrl: 'ok' } });
              cb.join(cid);
              return;
            }
            if (d._ctrl === 'bye') { this._drop(cid); return; }
            if (!this.links.has(cid)) {
              this.links.set(cid, {
                send: (x, v) => this._relay(cid, x, v),
                close: () => this._sendWs({ type: 'relay', roomId, to: cid, data: { _ctrl: 'bye' } }),
              });
              cb.join(cid);
            }
            cb.msg(cid, d);
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
          else if (this.role === 'host' && this.cb === cb) {
            this.retryTo = setTimeout(() => {
              if (this.cb === cb && this.role === 'host') this._hostWs(cb, code, code, roomId, Date.now() + 60000);
            }, 1200);
          }
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
            send: (x, v) => this._relay('host', x, v),
            close: () => { this._sendWs({ type: 'relay', roomId, to: 'host', data: { _ctrl: 'bye' } }); try { ws.close(); } catch (e) {} },
          };
          ws.onopen = () => {
            signaled = true;
            sendWs({ type: 'join_room', roomId, role: 'guest' });
          };
          ws.onmessage = (ev) => {
            if (this.ws !== ws) return;
            let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
            if (!msg || typeof msg !== 'object') return;
            if (msg.type === 'pong') { this._pong(msg.ts); return; }
            if (msg.type === 'ping') { sendWs({ type: 'pong', roomId, ts: msg.ts }); return; }
            if (msg.type === 'room_joined') {
              this.proto = msg.proto || 1;
              sendWs({ type: 'relay', roomId, to: 'host', data: { _ctrl: 'hi' } });
              return;
            }
            if (msg.type === 'error') {
              retried = true;
              if (msg.reason === 'room-not-found') {
                if (done) fireClose();
                else fin(cb.error, "Aucun salon avec ce code. Vérifie-le avec ton pote.");
              } else if (msg.reason === 'room-full') fin(cb.error, `Le salon est complet (${maxPeers + 1} joueurs max).`);
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
          ws.onerror = () => { if (this.ws !== ws) return; if (!done) retryOrFail(); };
          ws.onclose = () => {
            if (this.ws !== ws) return;
            this._stopKeepAlive();
            if (!done) retryOrFail();
            else if (this.role === 'guest' && this.cb === cb && !closed) {
              // Reconnexion transparente au même salon si la WebSocket a eu une micro-coupure
              this.retryTo = setTimeout(() => {
                if (this.role === 'guest' && this.cb === cb && !closed) {
                  done = false;
                  connectGuest();
                }
              }, 1000);
            }
          };
        };
        connectGuest();
      },
      _sendWs(obj) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          try { this.ws.send(JSON.stringify(obj)); } catch (e) {}
        }
      },
      // Paquet de jeu vers 'host', un invité (cid) ou 'all' (except : cid exclu)
      _relay(to, data, vol, except) {
        const ws = this.ws;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const v = isVol(vol);
        if (v && (ws.bufferedAmount > SEND_BUFFER_MAX || this._lagging())) { this.stats.dropped++; return; }
        this.stats.sent++;
        try {
          if (this.proto >= 2) {
            // trame compacte : en-tête court + données brutes, que le serveur retransmet sans les relire
            const h = { to }; if (except) h.x = except; if (v) h.v = 1;
            ws.send('#' + JSON.stringify(h) + '\n' + JSON.stringify(data));
          } else ws.send(JSON.stringify({ type: 'relay', roomId: this.roomId, to: to === 'all' ? undefined : to, except: except || undefined, v: v ? 1 : undefined, data }));
        } catch (e) {}
      },
      // Sonde vers le relais toutes les 250 ms (garde aussi la connexion ouverte). Si la réponse tarde nettement plus
      // que d'habitude, nos envois s'empilent : on saute les instantanés d'état le temps que la file se vide.
      _startKeepAlive(ws, roomId) {
        this._stopKeepAlive();
        this.probeAt = 0; this.lats = [];
        this.pingIv = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN || this.probeAt) return;
          this.probeAt = performance.now();
          try { ws.send(JSON.stringify({ type: 'ping', roomId, ts: this.probeAt })); } catch (e) {}
        }, 250);
      },
      _pong(ts) {
        if (!ts) return;
        const lat = Math.max(1, Math.round(performance.now() - ts));
        this.rtt = lat;
        if (ts === this.probeAt) this.probeAt = 0;
        this.lats.push(lat); if (this.lats.length > 40) this.lats.shift();
        this.baseLat = Math.min(...this.lats);
      },
      _lagging() {
        const base = this.baseLat == null ? 150 : this.baseLat;
        if (this.probeAt && performance.now() - this.probeAt > base + 150) return true;
        return this.rtt != null && this.rtt > base + 150;
      },
      _stopKeepAlive() {
        if (this.pingIv) { clearInterval(this.pingIv); this.pingIv = null; }
      },
      toHost(m, vol) { this.hostLink && this.hostLink.send(m, vol); },
      to(cid, m, vol) { const L = this.links.get(cid); L && L.send(m, vol); },
      bcast(m, except, vol) {
        if (LOCAL_TEST) {
          for (const [cid, L] of this.links) if (cid !== except) L.send(m);
          return;
        }
        if (this.links.size > 0) this._relay('all', m, vol, except);
      },
      // taille du tampon d'envoi (diagnostic)
      get buffered() { return this.ws ? this.ws.bufferedAmount : 0; },
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

