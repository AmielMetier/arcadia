/* Hub : profil, salon commun et lancement des jeux dans une iframe.
   Le salon (DDRoom) vit ici pendant toute la session : changer de jeu ne coupe pas la connexion. */
(function () {
  const VERSION = '2.4';
  const $ = (s) => document.querySelector(s);
  const ORIGIN = location.origin === 'null' ? '*' : location.origin;
  const GAMES = window.HUB_GAMES;
  const gameDef = (id) => GAMES.find((g) => g.id === id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let me = DDProfile.load();
  let room = null;
  let frame = null;        // { game, n, el, loaded }
  let leftGame = null;     // partie quittée volontairement (pas de rechargement automatique)
  const pick = { game: GAMES[0].id, settings: {} };
  for (const g of GAMES) {
    pick.settings[g.id] = {};
    for (const s of g.settings || []) pick.settings[g.id][s.key] = DDProfile.get('hub_set_' + g.id + '_' + s.key, s.def);
  }

  function showScreen(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id); }
  let toastT = 0;
  function toast(msg, ms = 2800) {
    let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms);
  }

  /* ------------------------------------------------------------ accueil */
  $('#ver').textContent = 'v' + VERSION;
  $('#shelf').innerHTML = GAMES.map((g) => `<div class="mini"><div class="cv">${g.cover}</div><div><b>${esc(g.title)}</b><small>${esc(g.tag)} · ${g.minPlayers === 1 ? 'seul ou' : g.minPlayers + ' à'} ${g.maxPlayers} joueurs</small></div></div>`).join('');
  $('#name').value = me.name;
  $('#name').addEventListener('input', (e) => { me.name = e.target.value.slice(0, 12); DDProfile.save(me); if (room) room.updateMe(me); });
  function renderSwatches() {
    const box = $('#swatches'); box.innerHTML = '';
    for (const c of DDProfile.PALETTE) {
      const b = document.createElement('button'); b.className = 'sw' + (c === me.color ? ' sel' : ''); b.style.background = c;
      b.setAttribute('aria-label', 'Couleur ' + c); b.onclick = () => { me.color = c; DDProfile.save(me); renderSwatches(); };
      box.appendChild(b);
    }
  }
  renderSwatches();
  const joinParam = new URLSearchParams(location.search).get('join');
  if (joinParam) { $('#joinCode').value = joinParam.toUpperCase().slice(0, 4); }
  $('#joinCode').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('#joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnJoin').click(); });
  const homeErr = (m) => { $('#homeErr').textContent = m || ''; };
  const busy = (b) => { for (const id of ['#btnHost', '#btnJoin', '#btnSolo']) $(id).disabled = b; };
  const profile = () => ({ name: DDRoom.cleanName(me.name), color: me.color, lvl: me.lvl });

  $('#btnHost').onclick = () => { homeErr(''); busy(true); $('#btnHost').textContent = 'Création…'; newRoom(); room.host(profile()); };
  $('#btnJoin').onclick = () => {
    const code = $('#joinCode').value.trim().toUpperCase();
    if (code.length !== 4) { homeErr('Le code fait 4 caractères.'); return; }
    homeErr(''); busy(true); $('#btnJoin').textContent = 'Connexion…'; newRoom(); room.join(code, profile());
  };
  $('#btnSolo').onclick = () => { homeErr(''); newRoom(); room.solo(profile()); };

  function goHome(msg) {
    if (room) room.leave();
    room = null; closeFrame(false); leftGame = null;
    busy(false); $('#btnHost').textContent = 'Créer un salon'; $('#btnJoin').textContent = 'Rejoindre';
    showScreen('home'); homeErr(msg || '');
    history.replaceState(null, '', location.pathname + (DDNet.LOCAL_TEST ? '?local' : ''));
  }

  /* ------------------------------------------------------------ salon */
  function newRoom() {
    if (room) room.leave();
    $('#chatLog').innerHTML = '';
    room = DDRoom.create({
      joined() { busy(false); $('#btnHost').textContent = 'Créer un salon'; $('#btnJoin').textContent = 'Rejoindre'; showScreen(frame ? 'play' : 'room'); renderRoom(); },
      update() { renderRoom(); syncFrame(); postRoster(); },
      chat(c) { appendChat(c); },
      game(from, m) { if (frame && frame.loaded) frame.el.contentWindow.postMessage({ dd: 'hub', k: 'msg', from, m }, ORIGIN); },
      error(msg) { if ($('#home').classList.contains('on')) goHome(msg); else toast(msg, 4000); },
      closed(msg) { goHome(msg); },
    });
  }
  setInterval(() => { if (room) { room.tick(performance.now()); renderPings(); } }, 2000);

  function appendChat(c) {
    const p = document.createElement('p');
    if (c.sys) { p.className = 'sys'; p.textContent = c.txt; }
    else p.innerHTML = `<b style="color:${esc(c.color || '#16181d')}">${esc(c.name)}</b> ${esc(c.txt)}`;
    const log = $('#chatLog'); log.appendChild(p); log.scrollTop = log.scrollHeight;
  }
  $('#chatForm').onsubmit = (e) => { e.preventDefault(); const v = $('#chatIn').value; if (v.trim() && room) room.sendChat(v); $('#chatIn').value = ''; };
  $('#btnLeave').onclick = () => goHome();
  $('#btnCopy').onclick = () => {
    const url = location.origin + location.pathname + '?join=' + room.code + (DDNet.LOCAL_TEST ? '&local' : '');
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
      () => toast('Lien copié : envoie-le à tes potes'), () => toast('Code du salon : ' + room.code));
  };
  $('#btnRejoin').onclick = () => { leftGame = null; syncFrame(); };

  function renderPings() {
    if (!room) return;
    for (const el of document.querySelectorAll('[data-ping]')) {
      const v = room.pings[el.dataset.ping]; el.textContent = v != null ? Math.round(v) + ' ms' : '';
    }
  }

  function renderRoom() {
    if (!room) return;
    const solo = room.mode === 'solo';
    $('#codeBox').hidden = solo; $('#chatBox').hidden = solo;
    $('#code').textContent = room.code || '----';
    const host = room.isHost;
    // joueurs
    const rows = room.players.map((p) => {
      const tags = [];
      if (p.id === room.hostId) tags.push('<span class="pill">Hôte</span>');
      if (room.ready[p.id]) tags.push('<span class="pill in">En jeu</span>');
      return `<div class="pl"><span class="dot" style="background:${esc(p.color)}"></span><span class="nm">${esc(p.name)}${p.id === room.myId ? ' <small>(toi)</small>' : ''}</span>${tags.join('')}${p.id !== room.myId ? `<small data-ping="${p.id}"></small>` : ''}</div>`;
    });
    if (!solo) for (let k = room.players.length; k < DDRoom.MAX_PLAYERS; k++) rows.push('<div class="pl empty">Place libre</div>');
    $('#players').innerHTML = rows.join('');
    renderPings();
    // partie en cours que l'on a quittée
    const running = room.game && !frame;
    $('#runBanner').hidden = !running;
    if (running) $('#runText').textContent = 'Partie de ' + gameDef(room.game.id).title + ' en cours';
    // jeux
    const n = room.players.length;
    $('#games').innerHTML = GAMES.map((g) => {
      const tooMany = n > g.maxPlayers;
      const sel = (room.game ? room.game.id : pick.game) === g.id && (host || room.game);
      return `<button class="game${sel ? ' sel' : ''}${tooMany ? ' off' : ''}" data-game="${g.id}" ${host && !tooMany ? '' : 'tabindex="-1"'} aria-pressed="${sel}">
        <span class="cv">${g.cover}</span>
        <span class="tx"><span class="tg">${esc(g.tag)}</span><b>${esc(g.title)}</b><p>${esc(g.desc)}</p>
        ${tooMany ? `<span class="why">${g.maxPlayers} joueurs maximum</span>` : ''}</span></button>`;
    }).join('');
    for (const b of document.querySelectorAll('.game')) b.onclick = () => {
      if (!host || room.game) return;
      const g = gameDef(b.dataset.game); if (n > g.maxPlayers) return;
      pick.game = g.id; renderRoom();
    };
    renderLaunch();
  }

  function renderLaunch() {
    const box = $('#launchBox'), host = room.isHost;
    if (room.game) {
      box.innerHTML = host
        ? `<div class="row" style="align-items:center;justify-content:space-between"><span class="wait"><i></i>Partie de ${esc(gameDef(room.game.id).title)} en cours</span><button class="btn small ghost" id="btnStop">Arrêter pour tout le monde</button></div>`
        : `<span class="wait"><i></i>Partie de ${esc(gameDef(room.game.id).title)} en cours</span>`;
      const st = $('#btnStop'); if (st) st.onclick = () => room.setGame(null);
      return;
    }
    if (!host) { box.innerHTML = '<span class="wait"><i></i>L\'hôte choisit le jeu…</span>'; return; }
    const g = gameDef(pick.game), set = pick.settings[g.id], n = room.players.length;
    const segs = (g.settings || []).map((s) => {
      const opts = s.options.filter(([v]) => s.key !== 'bots' || n + Number(v) <= g.maxPlayers);
      return `<div><div class="lbl">${esc(s.label)}</div><div class="seg" role="group" aria-label="${esc(s.label)}">${opts.map(([v, l]) =>
        `<button data-k="${s.key}" data-v="${v}" class="${String(set[s.key]) === String(v) ? 'sel' : ''}">${esc(l)}</button>`).join('')}</div></div>`;
    }).join('');
    const ok = n <= g.maxPlayers;
    box.innerHTML = `<h2>${esc(g.title)}</h2>${segs ? `<div class="setrow">${segs}</div>` : ''}
      <button class="btn big block ${g.id === 'david' ? 'blue' : ''}" id="btnLaunch" ${ok ? '' : 'disabled'}>Lancer ${esc(g.title)}</button>`;
    for (const b of box.querySelectorAll('.seg button')) b.onclick = () => {
      const v = isNaN(Number(b.dataset.v)) ? b.dataset.v : Number(b.dataset.v);
      set[b.dataset.k] = v; DDProfile.set('hub_set_' + g.id + '_' + b.dataset.k, v); renderLaunch();
    };
    $('#btnLaunch').onclick = () => { leftGame = null; room.setGame(g.id, { ...set }); };
  }

  /* ------------------------------------------------------------ jeu dans l'iframe */
  function syncFrame() {
    if (!room) return;
    const g = room.game;
    if (!g) { if (frame) closeFrame(true); leftGame = null; return; }
    if (frame && frame.n !== g.n) closeFrame(false);
    if (!frame && leftGame !== g.n) openFrame(g);
  }

  function openFrame(g) {
    const def = gameDef(g.id);
    DDProfile.save(me);
    const role = room.mode === 'solo' ? 'solo' : room.isHost ? 'host' : 'guest';
    const q = new URLSearchParams({ hub: '1', role, game: g.id });
    if (room.code) q.set('code', room.code);
    let src = def.url + '?' + q.toString() + (DDNet.LOCAL_TEST ? '&local' : '');
    const el = document.createElement('iframe');
    el.title = def.title; el.src = src; el.allow = 'autoplay; fullscreen; gamepad';
    $('#play').innerHTML = ''; $('#play').appendChild(el);
    frame = { game: g.id, n: g.n, el, loaded: false };
    el.addEventListener('load', () => { try { el.contentWindow.focus(); } catch (e) {} });
    showScreen('play');
    renderRoom();
  }

  function closeFrame(toRoom) {
    if (!frame) return;
    frame.el.remove(); frame = null; $('#play').innerHTML = '';
    if (room) room.setReady(null);
    if (toRoom && room) { showScreen('room'); renderRoom(); }
  }

  function postRoster() {
    if (!frame || !frame.loaded || !room) return;
    frame.el.contentWindow.postMessage({ dd: 'hub', k: 'roster', players: room.players.map(({ cid, ...p }) => p), ready: room.ready, hostId: room.hostId }, ORIGIN);
  }

  window.addEventListener('message', (e) => {
    if (!frame || e.source !== frame.el.contentWindow) return;
    const d = e.data; if (!d || d.dd !== 'hub' || !room) return;
    switch (d.k) {
      case 'hello':
        frame.loaded = true;
        frame.el.contentWindow.postMessage({ dd: 'hub', k: 'init', info: {
          role: room.mode === 'solo' ? 'solo' : room.isHost ? 'host' : 'guest',
          myId: room.myId, hostId: room.hostId, code: room.code, game: frame.game,
          settings: room.game ? room.game.settings : {},
          players: room.players.map(({ cid, ...p }) => p), ready: room.ready,
        } }, ORIGIN);
        break;
      case 'ready': room.setReady(frame.game); break;
      case 'send': room.sendGame(d.to, d.m); break;
      case 'exit':
        if (room.isHost) room.setGame(null);
        else { leftGame = frame.n; closeFrame(true); }
        break;
    }
  });

  addEventListener('pagehide', () => { try { if (room) room.leave(); } catch (e) {} });
  if (joinParam) $('#name').focus();
})();
