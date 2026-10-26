/* Amis : qui est en ligne, dans quel salon, et le rejoindre d'un clic (sans copier de code).
   Connexion à part de celle du salon, vers le même serveur relais (messages p_*).
   Chaque joueur a une clé secrète gardée dans son navigateur ; le serveur en tire son code ami public (8 caractères) :
   personne ne peut se faire passer pour lui. On ne voit l'état d'un joueur, et le code de son salon, que si l'amitié
   est mutuelle : une demande d'ami doit être acceptée.
   ?as=<nom> : identité d'ami séparée, pour tester à plusieurs dans le même navigateur.

   API : HubFriends.start(profil) · setMe(profil) · setState({ w: 'menu'|'room'|'solo', code, game, n, max, play })
         request(code) · accept(fid) · decline(fid) · remove(fid) · invite(fid, code, game) · isFriend(fid) · on(k, fn)
         backup() / restore(b) / forget() : la clé et les amis, pour emporter son compte sur un autre appareil
   Événements : change, me, request, added, sent, err, invite */
(function () {
  const QS = new URLSearchParams(location.search);
  const AS = (QS.get('as') || '').replace(/[^a-z0-9]/gi, '').slice(0, 12);
  const storeKey = (k) => k + (AS ? '_' + AS : '');
  const KEY_K = storeKey('hub_fkey'), LIST_K = storeKey('hub_friends');
  const FID_RE = /^[A-Z2-9]{8}$/;
  // en mode test entre onglets (?local), pas de serveur : les amis ne sont disponibles qu'avec ?ws=
  const OFFLINE = DDNet.LOCAL_TEST && !QS.has('ws');

  let key = DDProfile.get(KEY_K, null);
  if (typeof key !== 'string' || key.length < 16) {
    key = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('');
    DDProfile.set(KEY_K, key);
  }
  let saved = DDProfile.get(LIST_K, []);
  if (!Array.isArray(saved)) saved = [];

  const F = {
    fid: null,                 // notre code ami, donné par le serveur
    status: OFFLINE ? 'local' : 'off', // off · connecting · on · unsupported (serveur pas à jour) · local
    friends: saved.filter((f) => f && FID_RE.test(f.fid)),
    live: new Map(),           // amis mutuels en ligne : fid → { fid, name, color, st }
    requests: [],              // demandes reçues : [{ fid, name, color }]
    sent: new Set(),           // demandes envoyées : seule une réponse à l'une d'elles nous ajoute un ami
  };
  const handlers = {};
  F.on = (k, fn) => { (handlers[k] = handlers[k] || []).push(fn); };
  const emit = (k, ...a) => { for (const fn of handlers[k] || []) { try { fn(...a); } catch (e) { console.error(e); } } if (k !== 'change') emit('change'); };

  F.format = (fid) => (fid ? fid.slice(0, 4) + '-' + fid.slice(4) : '');
  F.parse = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  F.isFriend = (fid) => F.friends.some((f) => f.fid === fid);

  /* ---------- connexion ---------- */
  let ws = null, retry = 0, retryT = 0, helloT = 0, pingT = 0, pingAt = 0;
  let me = { name: '', color: '' }, state = { w: 'menu' }, stateKey = '';
  const send = (o) => { if (ws && ws.readyState === WebSocket.OPEN) { try { ws.send(JSON.stringify(o)); } catch (e) {} } };
  const save = () => DDProfile.set(LIST_K, F.friends.map(({ fid, name, color }) => ({ fid, name, color })));
  const sendFriends = () => send({ type: 'p_friends', friends: F.friends.map((f) => f.fid) });

  function connect() {
    if (OFFLINE) return;
    clearTimeout(retryT); retryT = 0;
    if (ws) return;
    if (F.status !== 'on' && F.status !== 'unsupported') F.status = 'connecting';
    let s;
    try { s = new WebSocket(DDNet.getWsUrl()); } catch (e) { later(); return; }
    ws = s;
    s.onopen = () => {
      send({ type: 'p_hello', key, name: me.name, color: me.color, st: state, friends: F.friends.map((f) => f.fid) });
      clearTimeout(helloT);
      // un serveur qui ne connaît pas encore les amis ne répond pas
      helloT = setTimeout(() => { if (ws === s && !F.fid) { F.status = 'unsupported'; emit('change'); } }, 8000);
    };
    s.onmessage = (e) => { if (ws === s) onMsg(e.data); };
    s.onclose = () => {
      if (ws !== s) return;
      ws = null; F.live.clear();
      if (F.status === 'on') F.status = 'connecting';
      emit('change');
      later();
    };
  }
  function later() { clearTimeout(retryT); retryT = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(retry++, 5))); }
  function drop() { const s = ws; ws = null; if (s) { s.onclose = s.onmessage = null; try { s.close(); } catch (e) {} } F.live.clear(); later(); }
  // Sonde toutes les 20 s : une connexion qui ne répond plus est remplacée
  setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (pingAt && Date.now() - pingAt > 10000) { pingAt = 0; drop(); return; }
    if (!pingAt) { pingAt = Date.now(); send({ type: 'ping', ts: pingAt }); }
  }, 20000);
  const wake = () => {
    if (OFFLINE) return;
    if (!ws) { retry = 0; connect(); return; }
    if (ws.readyState === WebSocket.OPEN && !pingAt) { pingAt = Date.now(); send({ type: 'ping', ts: pingAt }); setTimeout(() => { if (pingAt && Date.now() - pingAt > 4000) { pingAt = 0; drop(); } }, 4500); }
  };
  addEventListener('online', wake);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

  function rename(fid, name, color) {
    const f = F.friends.find((x) => x.fid === fid);
    if (f && (f.name !== name || f.color !== color)) { f.name = name; f.color = color; save(); }
  }
  function onMsg(raw) {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    switch (m.type) {
      case 'pong': pingAt = 0; break;
      case 'p_me': clearTimeout(helloT); F.fid = m.fid; F.status = 'on'; retry = 0; emit('me', m.fid); break;
      case 'p_list':
        F.live = new Map((m.list || []).map((c) => [c.fid, c]));
        for (const c of F.live.values()) rename(c.fid, c.name, c.color);
        emit('change'); break;
      case 'p_up': F.live.set(m.fid, m); rename(m.fid, m.name, m.color); emit('change'); break;
      case 'p_down': F.live.delete(m.fid); emit('change'); break;
      case 'p_req':
        // déjà ami (il nous a perdus, par exemple en changeant de navigateur) : on accepte tout de suite
        if (F.isFriend(m.from)) { send({ type: 'p_accept', to: m.from }); break; }
        if (!F.requests.some((r) => r.fid === m.from)) F.requests.push({ fid: m.from, name: m.name, color: m.color });
        emit('request', { fid: m.from, name: m.name, color: m.color }); break;
      case 'p_ok':
        if (!F.sent.has(m.from)) break;
        F.sent.delete(m.from);
        if (!F.isFriend(m.from)) { F.friends.push({ fid: m.from, name: m.name, color: m.color }); save(); sendFriends(); }
        emit('added', { fid: m.from, name: m.name }); break;
      case 'p_sent': emit('sent', m.to); break;
      case 'p_err': F.sent.delete(m.to); emit('err', m); break;
      case 'p_invite': if (F.isFriend(m.from)) emit('invite', m); break;
    }
  }

  /* ---------- API ---------- */
  F.start = (p) => { me = { name: p.name || 'Joueur', color: p.color }; connect(); };
  F.setMe = (p) => {
    const n = { name: p.name || 'Joueur', color: p.color };
    if (n.name === me.name && n.color === me.color) return;
    me = n; send({ type: 'p_state', name: me.name, color: me.color, st: state });
  };
  F.setState = (st) => {
    const k = JSON.stringify(st);
    if (k === stateKey) return;
    stateKey = k; state = st;
    send({ type: 'p_state', name: me.name, color: me.color, st });
  };
  // demande d'ami, par code ou depuis la liste des joueurs du salon
  F.request = (code) => {
    const fid = F.parse(code);
    if (!FID_RE.test(fid)) return 'invalid';
    if (fid === F.fid) return 'self';
    if (F.isFriend(fid)) return 'already';
    if (F.status !== 'on') return 'offline';
    F.sent.add(fid); send({ type: 'p_req', to: fid });
    return 'ok';
  };
  F.accept = (fid) => {
    const r = F.requests.find((x) => x.fid === fid);
    F.requests = F.requests.filter((x) => x.fid !== fid);
    if (r && !F.isFriend(fid)) { F.friends.push({ fid, name: r.name, color: r.color }); save(); sendFriends(); }
    send({ type: 'p_accept', to: fid });
    emit('change');
  };
  F.decline = (fid) => { F.requests = F.requests.filter((x) => x.fid !== fid); emit('change'); };
  F.remove = (fid) => { F.friends = F.friends.filter((x) => x.fid !== fid); F.live.delete(fid); save(); sendFriends(); emit('change'); };
  F.invite = (fid, code, game) => send({ type: 'p_invite', to: fid, code, game });
  F.storeKey = storeKey;
  // Compte sur un autre appareil : la clé secrète (donc le même code ami) et la liste d'amis
  F.backup = () => ({ k: key, f: F.friends.map(({ fid, name, color }) => [fid, name, color]) });
  F.restore = (b) => {
    if (!b || typeof b.k !== 'string' || b.k.length < 16 || b.k.length > 64) return false;
    const list = (Array.isArray(b.f) ? b.f : []).filter((x) => Array.isArray(x) && FID_RE.test(x[0]))
      .map(([fid, name, color]) => ({ fid, name: String(name || 'Joueur').slice(0, 12), color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#c9c0ad' }));
    DDProfile.set(KEY_K, b.k); DDProfile.set(LIST_K, list);
    return true;
  };
  F.forget = () => { DDProfile.set(KEY_K, null); DDProfile.set(LIST_K, []); };

  window.HubFriends = F;
})();
