/* Réseau en étoile entre amis, extrait de Duo Drift.
   L'hôte ouvre un identifiant PeerJS <préfixe><CODE> ; les invités s'y connectent ; l'hôte relaie.
   ?local dans l'adresse : remplace WebRTC par un BroadcastChannel pour tester entre onglets.
   Usage : const net = DDNet.create({ prefix: 'ddhub-v1-', maxPeers: 5 }); net.host(cb) / net.join(code, cb). */
(function () {
  const CODE_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const genCode = () => Array.from({ length: 4 }, () => CODE_ALPHA[(Math.random() * CODE_ALPHA.length) | 0]).join('');
  const LOCAL_TEST = new URLSearchParams(location.search).has('local');

  function peerErr(e) {
    const t = e && e.type;
    if (t === 'peer-unavailable') return "Aucun salon avec ce code. Vérifie-le avec ton pote.";
    if (t === 'browser-incompatible') return "Ton navigateur ne gère pas le WebRTC. Essaie Chrome, Firefox ou Edge.";
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') {
      return "Impossible de joindre le serveur de mise en relation. Vérifie ta connexion internet.";
    }
    return "Erreur de connexion (" + (t || 'inconnue') + ").";
  }

  function create({ prefix, maxPeers = 5 }) {
    const net = {
      peer: null, bc: null, links: new Map(), hostLink: null, cb: null, cidc: 0, role: null, code: null,
      host(cb) {
        this.role = 'host'; this.cb = cb; this.links = new Map(); const code = genCode(); this.code = code;
        if (LOCAL_TEST) {
          const bc = new BroadcastChannel(prefix + code); this.bc = bc; setTimeout(() => cb.ready(code), 30);
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
        if (typeof Peer === 'undefined') { cb.error("La bibliothèque réseau n'a pas pu se charger."); return; }
        const peer = new Peer(prefix + code, { debug: 1 }); this.peer = peer;
        peer.on('open', () => cb.ready(code));
        peer.on('connection', (c) => {
          if (this.links.size >= maxPeers) {
            c.on('open', () => { try { c.send({ t: 'full' }); } catch (e) {} setTimeout(() => { try { c.close(); } catch (e) {} }, 500); });
            return;
          }
          const cid = 'c' + (++this.cidc);
          c.on('open', () => {
            this.links.set(cid, { send: (x) => { if (c.open) { try { c.send(x); } catch (e) {} } }, close: () => { try { c.close(); } catch (e) {} } });
            cb.join(cid);
          });
          c.on('data', (d) => { if (this.links.has(cid)) cb.msg(cid, d); });
          c.on('close', () => this._drop(cid)); c.on('error', () => this._drop(cid));
        });
        peer.on('disconnected', () => { if (this.peer === peer && !peer.destroyed) { try { peer.reconnect(); } catch (e) {} } });
        peer.on('error', (e) => {
          if (this.peer !== peer) return;
          if (e.type === 'unavailable-id') { peer.destroy(); this.peer = null; this.host(cb); return; }
          if (e.type === 'peer-unavailable') return;
          cb.error(peerErr(e));
        });
      },
      _drop(cid) { if (!this.links.has(cid)) return; this.links.delete(cid); if (this.cb && this.cb.leave) this.cb.leave(cid); },
      drop(cid) {
        const L = this.links.get(cid); if (!L) return;
        try { L.send({ t: 'bye' }); } catch (e) {}
        setTimeout(() => { try { L.close(); } catch (e) {} }, 80); this._drop(cid);
      },
      join(code, cb) {
        this.role = 'guest'; this.cb = cb; this.code = code;
        let done = false; const fin = (fn, a) => { if (done) return; done = true; clearTimeout(to); fn(a); };
        const to = setTimeout(() => fin(cb.error, "Pas de réponse. Vérifie le code et que ton pote a bien créé le salon."), 15000);
        if (LOCAL_TEST) {
          const cid = 'g' + Math.random().toString(36).slice(2, 9), bc = new BroadcastChannel(prefix + code); this.bc = bc; let closed = false;
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
        if (typeof Peer === 'undefined') { fin(cb.error, "La bibliothèque réseau n'a pas pu se charger."); return; }
        const peer = new Peer({ debug: 1 }); this.peer = peer;
        peer.on('open', () => {
          const c = peer.connect(prefix + code, { reliable: true, serialization: 'json' }); let closed = false;
          const fire = () => { if (closed) return; closed = true; if (done && net.cb === cb) cb.close(); };
          this.hostLink = { send: (x) => { if (c.open) { try { c.send(x); } catch (e) {} } }, close: () => { try { c.close(); } catch (e) {} } };
          c.on('open', () => fin(cb.open)); c.on('data', (d) => cb.msg(d)); c.on('close', fire); c.on('error', fire);
        });
        peer.on('error', (e) => { if (this.peer !== peer) return; if (!done) fin(cb.error, peerErr(e)); });
      },
      toHost(m) { this.hostLink && this.hostLink.send(m); },
      to(cid, m) { const L = this.links.get(cid); L && L.send(m); },
      bcast(m, except) { for (const [cid, L] of this.links) if (cid !== except) L.send(m); },
      close() {
        const p = this.peer, b = this.bc;
        if (this.role === 'host') {
          const ls = [...this.links.values()]; for (const L of ls) L.send({ t: 'bye' });
          setTimeout(() => ls.forEach((L) => L.close()), 80); this.links = new Map();
        } else if (this.hostLink) { const L = this.hostLink; L.send({ t: 'bye' }); setTimeout(() => L.close(), 60); }
        this.hostLink = null; this.peer = null; this.bc = null; this.role = null; this.cb = null; this.code = null;
        setTimeout(() => { try { p && p.destroy(); } catch (e) {} try { b && b.close(); } catch (e) {} }, 150);
      },
    };
    return net;
  }

  window.DDNet = { create, LOCAL_TEST };
})();
