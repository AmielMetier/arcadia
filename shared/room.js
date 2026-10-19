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
  const cleanUid = (s) => (/^[a-z0-9]{6,16}$/.test(String(s)) ? String(s) : null);
  const RES = () => window.DDResults;

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
      if (to === 'host' || Number(to) === Number(R.myId)) { emit('game', from, m); return; }
      if (to === 'all') {
        emit('game', from, m);
        for (const p of R.players) if (p.cid && Number(p.id) !== Number(from)) net.to(p.cid, { t: 'g', from, m });
        return;
      }
      const p = R.players.find((q) => Number(q.id) === Number(to));
      if (p && p.cid) net.to(p.cid, { t: 'g', from, m });
    }

    /* ---------- hôte ---------- */
    function onHostMsg(cid, m) {
      if (!m || typeof m !== 'object') return;
      R.lastRecvC[cid] = performance.now();
      let p = R.players.find((q) => q.cid === cid);
      if (!p && Number.isInteger(m.fromId) && m.fromId !== R.hostId) {
        const byId = R.players.find((q) => q.id === m.fromId);
        if (byId) { byId.cid = cid; p = byId; }
      }
      switch (m.t) {
        case 'hello': {
          const uid = cleanUid(m.uid);
          const existing = p || (uid && R.players.find((q) => q.uid === uid && q.id !== R.hostId && !q.cid))
            || (Number.isInteger(m.prevId) && m.prevId > 0 && R.players.find((q) => q.id === m.prevId && !q.cid));
          if (existing) {
            existing.cid = cid;
            existing.name = cleanName(m.name);
            if (m.ready) R.ready[existing.id] = m.ready;
            net.to(cid, { t: 'welcome', id: existing.id, chat: R.chat.slice(-20) });
            changed();
            return;
          }
          if (R.players.length >= MAX_PLAYERS) { net.to(cid, { t: 'full' }); net.drop(cid); return; }
          const used = new Set(R.players.map((q) => q.id)); let id = 0; while (used.has(id)) id++;
          // après une migration d'hôte, chacun garde son numéro (le jeu en cours en dépend)
          const prev = Number.isInteger(m.prevId) ? m.prevId : -1;
          if (prev >= 0 && !used.has(prev)) id = prev;
          const usedC = new Set(R.players.map((q) => q.color));
          const color = PALETTE.includes(m.color) && !usedC.has(m.color) ? m.color : PALETTE.find((c) => !usedC.has(c));
          const np = { id, cid, name: cleanName(m.name), color, lvl: Math.max(1, Math.min(99, m.lvl | 0)), uid: uid || 'g' + Math.random().toString(36).slice(2, 10) };
          R.players.push(np);
          if (m.ready) R.ready[id] = m.ready;
          net.to(cid, { t: 'welcome', id, chat: R.chat.slice(-20) });
          sys(np.name + (prev >= 0 ? ' est reconnecté' : ' a rejoint le salon')); changed();
          break;
        }
        case 'me': if (p) { p.name = cleanName(m.name); p.lvl = Math.max(1, Math.min(99, m.lvl | 0)); changed(); } break;
        case 'res': if (p && Array.isArray(m.list) && RES()) { const added = RES().merge(m.list.slice(0, 150)); if (added) { net.bcast({ t: 'res', list: RES().all().slice(0, 150) }); emit('results'); } } break;
        case 'chat': if (p) { const txt = clean(m.txt, 140); if (txt) { const c = { id: p.id, name: p.name, color: p.color, txt }; pushChat(c); net.bcast({ t: 'chat', ...c }); } } break;
        case 'ready': if (p) { if (m.game) R.ready[p.id] = m.game; else delete R.ready[p.id]; changed(); } break;
        case 'g': if (p) deliverGame(p.id, m.to, m.m, cid); break;
        case 'ping':
          if (p && Number.isFinite(m.myPing)) R.pings[p.id] = Math.round(m.myPing);
          if (net.rtt) R.pings[R.hostId] = net.rtt;
          net.to(cid, { t: 'pong', ts: m.ts, pings: R.pings });
          break;
        case 'pong':
          if (p) R.pings[p.id] = Math.max(1, Math.round(performance.now() - m.ts));
          if (net.rtt) R.pings[R.hostId] = net.rtt;
          break;
        case 'bye': net._drop(cid); break;
      }
    }
    function onHostLeave(cid) {
      const i = R.players.findIndex((q) => q.cid === cid); delete R.lastRecvC[cid];
      if (i < 0) return;
      // Si une partie est en cours, on conserve le joueur dans R.players (cid = null) pour qu'il puisse se reconnecter sans perdre ses troupes !
      if (R.game) {
        R.players[i].cid = null;
        return;
      }
      const p = R.players[i]; R.players.splice(i, 1); delete R.ready[p.id]; delete R.pings[p.id];
      sys(p.name + ' a quitté le salon'); emit('left', p); changed();
    }

    /* ---------- invité ---------- */
    function onGuestMsg(m) {
      if (!m || typeof m !== 'object') return;
      R.lastRecv = performance.now();
      switch (m.t) {
        case 'welcome': R.myId = m.id | 0; R.chat = Array.isArray(m.chat) ? m.chat : []; emit('joined', R);
          if (RES()) net.toHost({ t: 'res', list: RES().all().slice(0, 150) });
          break;
        case 'res': if (Array.isArray(m.list) && RES() && RES().merge(m.list.slice(0, 150))) emit('results'); break;
        case 'lobby': {
          const before = R.players;
          R.players = Array.isArray(m.players) ? m.players : []; R.game = m.game || null; R.ready = m.ready || {}; R.hostId = m.host | 0;
          if (m.pings) Object.assign(R.pings, m.pings);
          for (const q of before) if (!R.players.some((x) => x.id === q.id)) emit('left', q);
          emit('update', R); break;
        }
        case 'chat': pushChat(m); break;
        case 'g': emit('game', m.from, m.m); break;
        case 'ping':
          if (m.pings) Object.assign(R.pings, m.pings);
          net.toHost({ t: 'pong', ts: m.ts, fromId: R.myId });
          break;
        case 'pong':
          if (m.pings) Object.assign(R.pings, m.pings);
          R.pings[R.myId] = Math.max(1, Math.round(performance.now() - m.ts));
          break;
        case 'full': emit('error', 'Le salon est complet (6 joueurs max).'); break;
        case 'bye': migrate("L'hôte a quitté le salon."); break;
      }
    }

    /* ---------- migration d'hôte ----------
       Si l'hôte disparaît, le joueur restant au plus petit numéro devient hôte, sous un nouveau code
       que tout le monde peut calculer ; les autres s'y reconnectent en gardant leur numéro. */
    let myReady = null, migrating = false;
    const CODE_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    function deriveCode(code, id) {
      let h = 2166136261;
      for (const ch of String(code) + ':' + id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
      let out = ''; for (let k = 0; k < 4; k++) { out += CODE_ALPHA[h % CODE_ALPHA.length]; h = Math.floor(h / CODE_ALPHA.length) + 7919 * (k + 1); }
      return out;
    }
    function migrate(reason) {
      if (R.mode !== 'guest' || migrating) return;
      const oldHost = R.hostId;
      const cands = R.players.filter((p) => p.id !== oldHost).map((p) => p.id).sort((a, b) => a - b);
      if (!cands.length || R.myId < 0) { emit('closed', reason); return; }
      migrating = true;
      const succ = cands[0], succName = (R.players.find((p) => p.id === succ) || {}).name || '?';
      const code2 = deriveCode(R.code, succ);
      const me = R.me || { name: 'Joueur', color: PALETTE[0], lvl: 1 };
      emit('migrating', { to: succ, name: succName, me: succ === R.myId });
      net.close();
      setTimeout(() => {
        if (succ === R.myId) becomeHost(code2, me);
        else rejoin(code2, me, Date.now() + 20000);
      }, 400);
    }
    function becomeHost(code, me) {
      R.mode = 'host'; R.hostId = R.myId; R.lastRecvC = {}; R.pings = {};
      R.players = [{ id: R.myId, name: cleanName(me.name), color: me.color, lvl: me.lvl | 0 || 1, uid: me.uid }];
      R.ready = myReady ? { [R.myId]: myReady } : {};
      let tries = 0;
      const go = () => net.host({
        ready(c) { migrating = false; R.code = c; sys('Tu es maintenant l\'hôte du salon.'); emit('migrated', R); changed(); },
        join(cid) { R.lastRecvC[cid] = performance.now(); },
        msg: onHostMsg, leave: onHostLeave,
        error(msg) { if (++tries < 6) setTimeout(go, 1500); else { migrating = false; emit('closed', msg); } },
      }, code);
      go();
    }
    function rejoin(code, me, deadline) {
      R.mode = 'guest'; R.code = code;
      net.join(code, {
        open() {
          migrating = false; R.lastRecv = performance.now();
          net.toHost({ t: 'hello', name: me.name, color: me.color, lvl: me.lvl, uid: me.uid, prevId: R.myId, ready: myReady });
        },
        msg: (m) => { onGuestMsg(m); if (m && m.t === 'welcome') emit('migrated', R); },
        close() { if (R.mode === 'guest') migrate("Connexion perdue avec l'hôte."); },
        error(msg) {
          if (Date.now() < deadline) { R.mode = 'guest'; setTimeout(() => rejoin(code, me, deadline), 1500); }
          else { migrating = false; R.mode = null; emit('closed', 'Impossible de joindre le nouvel hôte.'); }
        },
      }, 4000);
    }

    /* ---------- API ---------- */
    Object.assign(R, {
      host(me) {
        R.mode = 'host'; R.myId = 0; R.hostId = 0; R.players = [{ id: 0, name: cleanName(me.name), color: me.color, lvl: me.lvl | 0 || 1, uid: me.uid }];
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
          open() { R.lastRecv = performance.now(); net.toHost({ t: 'hello', name: me.name, color: me.color, lvl: me.lvl, uid: me.uid }); },
          msg: onGuestMsg,
          close() { if (R.mode === 'guest') migrate("Connexion perdue avec l'hôte."); },
          error(msg) { R.mode = null; emit('error', msg); },
        });
      },
      solo(me) {
        R.mode = 'solo'; R.myId = 0; R.hostId = 0; R.code = null; R.chat = []; R.ready = {}; R.game = null;
        R.players = [{ id: 0, name: cleanName(me.name), color: me.color, lvl: me.lvl | 0 || 1, uid: me.uid }];
        setTimeout(() => { emit('joined', R); emit('update', R); }, 0);
      },
      leave() { migrating = false; myReady = null; net.close(); R.mode = null; R.players = []; R.game = null; R.ready = {}; R.code = null; },
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
        myReady = game || null;
        if (R.isHost) { if (game) R.ready[R.myId] = game; else delete R.ready[R.myId]; changed(); }
        else net.toHost({ t: 'ready', game });
      },
      // Résultat d'une partie (envoyé par le jeu de l'hôte) : enregistré et partagé avec tout le salon
      addResult(rec) {
        if (!RES() || !RES().merge([rec])) return;
        if (R.mode === 'host') net.bcast({ t: 'res', list: [rec] });
        else if (R.mode === 'guest') net.toHost({ t: 'res', list: [rec] });
        emit('results');
      },
      sendGame(to, m) {
        if (R.isHost) deliverGame(R.myId, to, m);
        else net.toHost({ t: 'g', fromId: R.myId, to, m });
      },
      kick(id) { const p = R.players.find((q) => q.id === id); if (R.mode === 'host' && p && p.cid) net.drop(p.cid); },
      // à appeler régulièrement : pings temps réel sans déconnecter les joueurs en arrière-plan
      tick(now) {
        if (R.mode === 'host') {
          if (net.rtt) R.pings[R.hostId] = net.rtt;
          net.bcast({ t: 'ping', ts: now, pings: R.pings });
        } else if (R.mode === 'guest' && net.hostLink) {
          net.toHost({ t: 'ping', ts: now, fromId: R.myId, myPing: R.pings[R.myId] });
        }
      },
    });
    return R;
  }

  window.DDRoom = { create: createRoom, MAX_PLAYERS, PALETTE, cleanName };
})();
