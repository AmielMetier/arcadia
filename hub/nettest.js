/* Test de connexion : vérifie la connexion au serveur relais WebSocket (wss://) et le transit de paquets en salon. */
(function () {
  const getWsUrl = () => (window.DDNet && DDNet.getWsUrl ? DDNet.getWsUrl() : window.WS_SERVER_URL);

  function testWsConnect(ms = 8000) {
    return new Promise((res) => {
      let ws;
      try { ws = new WebSocket(getWsUrl()); } catch (e) { res(false); return; }
      let done = false;
      const end = (v) => { if (done) return; done = true; clearTimeout(to); try { ws.close(); } catch (e) {} res(v); };
      const to = setTimeout(() => end(false), ms);
      ws.onopen = () => end(true);
      ws.onerror = () => end(false);
    });
  }

  function testRelayLoop(ms = 9000) {
    return new Promise((res) => {
      let a, b;
      const roomId = 'nt-' + Math.random().toString(36).slice(2, 9);
      let done = false;
      const end = (v) => {
        if (done) return; done = true; clearTimeout(to);
        try { a && a.close(); } catch (e) {}
        try { b && b.close(); } catch (e) {}
        res(v);
      };
      const to = setTimeout(() => end(false), ms);
      try { a = new WebSocket(getWsUrl()); } catch (e) { end(false); return; }
      a.onopen = () => {
        a.send(JSON.stringify({ type: 'join_room', roomId, role: 'host' }));
      };
      a.onmessage = (ev) => {
        let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg.type === 'room_joined') {
          try { b = new WebSocket(getWsUrl()); } catch (e) { end(false); return; }
          b.onopen = () => b.send(JSON.stringify({ type: 'join_room', roomId, role: 'guest' }));
          b.onmessage = (ev2) => {
            let m2; try { m2 = JSON.parse(ev2.data); } catch (e) { return; }
            if (m2.type === 'room_joined') {
              b.send(JSON.stringify({ type: 'relay', roomId, to: 'host', data: { ping: 1 } }));
            } else if (m2.type === 'relay' && m2.data && m2.data.pong === 1) {
              end(true);
            }
          };
          b.onerror = () => end(false);
        } else if (msg.type === 'relay' && msg.data && msg.data.ping === 1) {
          a.send(JSON.stringify({ type: 'relay', roomId, to: msg.from, data: { pong: 1 } }));
        }
      };
      a.onerror = () => end(false);
    });
  }

  async function run(onStep) {
    const R = {};
    const step = async (key, label, fn) => { onStep(key, label, null); const v = await fn().catch(() => false); R[key] = v; onStep(key, label, v); return v; };
    await step('ws', 'Connexion au serveur WebSocket (wss://)', () => testWsConnect());
    if (R.ws) await step('loop', 'Échange de paquets via le relais', () => testRelayLoop());
    else R.loop = false;
    return R;
  }

  function verdict(R) {
    if (R.ws && R.loop) return { ok: true, text: 'Tout passe : le serveur relais WebSocket répond et les paquets circulent sans blocage.' };
    if (R.ws) return { ok: false, text: 'Le serveur WebSocket est joignable mais le relais de salon a échoué. Vérifie la version du serveur.' };
    return { ok: false, text: "Impossible de joindre le serveur relais WebSocket. Vérifie que WS_SERVER_URL est bien configuré et que le serveur est en ligne." };
  }

  window.DDNetTest = { run, verdict };
})();

