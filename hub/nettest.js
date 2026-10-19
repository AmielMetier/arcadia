/* Test de connexion : indique ce que le réseau laisse passer, pour comprendre pourquoi le multijoueur échoue.
   1. Serveur de mise en relation (PeerJS)      2. Connexion directe (STUN / UDP sortant)
   3. Relais PeerJS (3478)                       4. Relais Open Relay port 80, port 443 (TCP) et TLS 443
   5. Essai réel : deux connexions dans la page forcées à passer par un relais (des données circulent-elles ?) */
(function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Candidats ICE obtenus avec une seule configuration de serveur
  async function gather(server, ms = 6000) {
    const pc = new RTCPeerConnection({ iceServers: [server] });
    const types = new Set();
    pc.createDataChannel('t');
    const done = new Promise((res) => {
      pc.onicecandidate = (e) => { if (e.candidate) { const m = / typ (\w+)/.exec(e.candidate.candidate); if (m) types.add(m[1]); } else res(); };
      setTimeout(res, ms);
    });
    await pc.setLocalDescription(await pc.createOffer());
    await done;
    pc.close();
    return types;
  }

  // Deux pairs dans la même page, obligés de passer par le relais : le message fait-il l'aller-retour ?
  async function relayLoop(server, ms = 9000) {
    const cfg = { iceServers: [server], iceTransportPolicy: 'relay' };
    const a = new RTCPeerConnection(cfg), b = new RTCPeerConnection(cfg);
    a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate).catch(() => {});
    b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate).catch(() => {});
    const ok = new Promise((res) => {
      b.ondatachannel = (e) => { e.channel.onmessage = (m) => res(m.data === 'ping'); };
      setTimeout(() => res(false), ms);
    });
    const ch = a.createDataChannel('t');
    ch.onopen = () => ch.send('ping');
    await a.setLocalDescription(await a.createOffer());
    await b.setRemoteDescription(a.localDescription);
    await b.setLocalDescription(await b.createAnswer());
    await a.setRemoteDescription(b.localDescription);
    const r = await ok;
    a.close(); b.close();
    return r;
  }

  async function signaling(ms = 9000) {
    if (typeof Peer === 'undefined') return false;
    return new Promise((res) => {
      let p;
      try { p = new Peer(DDIce.peerOptions()); } catch (e) { res(false); return; }
      const end = (v) => { try { p.destroy(); } catch (e) {} res(v); };
      p.on('open', () => end(true)); p.on('error', () => end(false));
      setTimeout(() => end(false), ms);
    });
  }

  async function run(onStep) {
    await Promise.race([DDIce.ready, wait(2000)]);
    const R = {};
    const step = async (key, label, fn) => { onStep(key, label, null); const v = await fn().catch(() => false); R[key] = v; onStep(key, label, v); return v; };
    const or = DDIce.openRelay, base = or ? { username: or.username, credential: or.credential } : null;
    const host = 'staticauth.openrelay.metered.ca';
    await step('sig', 'Serveur de mise en relation', () => signaling());
    await step('direct', 'Connexion directe (UDP)', async () => (await gather(DDIce.STUN)).has('srflx'));
    await step('t3478', 'Relais PeerJS (port 3478)', async () => (await gather(DDIce.PEERJS_TURN)).has('relay'));
    if (base) {
      await step('t80', 'Relais port 80', async () => (await gather({ urls: `turn:${host}:80?transport=tcp`, ...base })).has('relay'));
      await step('t443', 'Relais port 443', async () => (await gather({ urls: `turn:${host}:443?transport=tcp`, ...base })).has('relay'));
      await step('tls', 'Relais chiffré TLS 443', async () => (await gather({ urls: `turns:${host}:443?transport=tcp`, ...base })).has('relay'));
    }
    if (DDIce.custom) await step('custom', 'Relais personnel', async () => (await gather(DDIce.custom)).has('relay'));
    // essai réel sur le meilleur relais disponible
    const best = DDIce.custom && R.custom ? DDIce.custom
      : R.tls ? { urls: `turns:${host}:443?transport=tcp`, ...base }
      : R.t443 ? { urls: `turn:${host}:443?transport=tcp`, ...base }
      : R.t80 ? { urls: `turn:${host}:80?transport=tcp`, ...base }
      : R.t3478 ? DDIce.PEERJS_TURN : null;
    if (best) await step('loop', 'Essai réel par le relais', () => relayLoop(best));
    else R.loop = false;
    return R;
  }

  function verdict(R) {
    const relay = R.loop;
    if (!R.sig) return { ok: false, text: "Le serveur de mise en relation est injoignable. Si tu es sur un wifi public, vérifie que tu as bien validé sa page de connexion (portail), puis recommence. Sinon, passe en partage de connexion 4G/5G." };
    if (R.direct && relay) return { ok: true, text: 'Tout passe : connexion directe possible, et relais disponible si besoin. Le multijoueur devrait marcher.' };
    if (relay) return { ok: true, text: 'Ton réseau bloque la connexion directe (classique sur un wifi public), mais le relais fonctionne : le jeu passera par lui. Un tout petit peu plus de latence, rien de gênant.' };
    if (R.direct) return { ok: false, text: "La connexion directe est possible mais aucun relais ne répond. Ça marchera avec des joueurs sur d'autres réseaux, mais pas forcément entre appareils du même wifi public (souvent isolés). Le partage de connexion règle le problème." };
    return { ok: false, text: 'Ton réseau bloque tout ce dont le jeu a besoin. Utilise le partage de connexion de ton téléphone (4G/5G) : ça marche à coup sûr.' };
  }

  window.DDNetTest = { run, verdict };
})();
