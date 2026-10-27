// Écrans de Fil Rouge : avant-partie (équipes, rôles), jeu (bombe 3D pour le démineur, manuel pour l'expert),
// bandeau d'état, chat d'équipe et fin de partie.
import { createScene } from './scene.js';
import { mountManual } from './manual.js';
import { sfx } from './sfx.js';
import { DIFFS, TEAMS, timeLeft, manualOf } from '../engine/rules.js';
import { makeBomb } from '../engine/modules.js';
import { rngOf, randomSeed } from '../engine/rng.js';
import { MODULE_INFO } from '../engine/manual.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const mmss = (ms) => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const QUICK = ['Décris-moi le module', 'Quelle couleur ?', 'Retourne la bombe', 'Le n° de lot ?', 'Attends…', 'Vas-y !', 'Je me suis trompé'];
const SAB_LABEL = { noir: '⚡ Coupure de courant', fumee: '💨 Fumigène', secousse: '🫨 Secousse', encre: '🖋️ Encre renversée' };

export function mountGame(root, { me, session, exit }) {
  root.className = '';
  root.innerHTML = `
  <div class="fr">
    <div class="stage" id="stage"></div>
    <div class="manualBox" id="manualBox" hidden></div>
    <div class="dark" id="dark" hidden></div>
    <header class="hud" id="hud" hidden>
      <div class="team" id="hTeam"></div>
      <div class="clock"><b id="hTime">--:--</b><span id="hStrikes"></span></div>
      <div class="prog" id="hProg"></div>
      <div class="opp" id="hOpp" hidden></div>
      <div class="tools">
        <button class="tool" id="tReset" title="Remettre la bombe de face (R)" hidden>⟲</button>
        <button class="tool" id="tFlip" title="Retourner la bombe (F)" hidden>⇋</button>
        <button class="tool" id="tSet" title="Réglages" aria-label="Réglages">⚙️</button>
        <button class="tool quit" id="tQuit">Quitter</button>
      </div>
    </header>
    <aside class="help" id="help" hidden>
      <button class="hx" id="helpX" aria-label="Masquer l'aide">–</button>
      <b>Commandes</b><div class="hb" id="helpBody"></div>
    </aside>
    <div class="pad" id="pad" hidden>
      <button data-r="x,-1">▲</button><button data-r="z,1">⟲</button><button data-r="z,-1">⟳</button>
      <button data-r="y,-1">◀</button><button data-r="x,1">▼</button><button data-r="y,1">▶</button>
    </div>
    <section class="chat" id="chat" hidden>
      <div class="log" id="chatLog" aria-live="polite"></div>
      <div class="quick" id="quick">${QUICK.map((q) => `<button>${esc(q)}</button>`).join('')}</div>
      <form id="chatForm"><input id="chatIn" maxlength="140" autocomplete="off" placeholder="Message à ton équipe… (Entrée)"><button class="btn small">➤</button></form>
    </section>
    <div class="toasts" id="toasts"></div>
    <div class="flash" id="flash"></div>
    <div class="overlay" id="setup" hidden></div>
    <div class="overlay" id="over" hidden></div>
  </div>`;
  const $ = (s) => root.querySelector(s);

  const HELP = {
    bomb: `<div><kbd data-code="KeyW">Z</kbd><kbd data-code="KeyS">S</kbd> basculer · <kbd data-code="KeyA">Q</kbd><kbd data-code="KeyD">D</kbd> pivoter · <kbd data-code="KeyQ">A</kbd><kbd data-code="KeyE">E</kbd> tourner</div>
      <div><kbd>R</kbd> de face · <kbd>F</kbd> retourner · <kbd>Échap</kbd> reculer</div>
      <div>Clic sur un module : zoom · clic sur une pièce : agir</div>
      <div>Glisser : tourner · molette : zoom</div>`,
    book: `<div>Clic page droite / gauche ou <kbd>←</kbd><kbd>→</kbd> : tourner les pages</div>
      <div>Onglets sur la tranche : aller au module</div>
      <div>Molette : zoom · glisser : déplacer</div>`,
  };
  // les touches de rotation sont lues par position : on affiche la lettre du clavier de chacun (AZERTY par défaut)
  let layout = null;
  try { if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then((m) => { layout = m; setHelp(); }).catch(() => {}); } catch (e) {}
  function setHelp() {
    $('#helpBody').innerHTML = role === 'expert' ? HELP.book : HELP.bomb;
    if (layout) for (const k of root.querySelectorAll('#helpBody kbd[data-code]')) { const l = layout.get(k.dataset.code); if (l) k.textContent = l.toUpperCase(); }
  }
  let previewEd = 0;
  let scene = null, manual = null, manualEd = 0, gameKey = '', state = null, offset = 0, setupS = null;
  let myTeam = 0, role = 'expert', manualOpen = false, lastSolved = -1;

  /* ---------------------------------------------------------- scène 3D (créée une fois) */
  function ensureScene() {
    if (scene) return scene;
    try {
      scene = createScene($('#stage'), { onPick: pick, onFocus: () => {}, onBook: () => sfx.page() });
      scene.onSecond((sec, rate) => { if (role === 'defuser') sfx.tick(sec <= 10 || rate > 1); });
    } catch (e) {
      console.error(e);
      $('#stage').innerHTML = '<div class="nogl">Ton navigateur n\'affiche pas la 3D (WebGL). Prends le rôle d\'expert, ou essaie un autre navigateur.</div>';
      scene = null;
    }
    return scene;
  }
  // décor de l'avant-partie : une bombe d'exemple sur la table
  function previewBomb() {
    if (!ensureScene() || gameKey) return;
    const Q = new URLSearchParams(location.search);
    const ed = previewEd = +Q.get('ed') || 1000 + Math.floor(Math.random() * 9000);
    const team = { bomb: makeBomb(rngOf({ seed: +Q.get('seed') || randomSeed() }), manualOf(ed), +Q.get('d') || 2), strikes: 0, status: 'live', clock: { left: 300000, at: Date.now() + 1e9, rate: 1 } };
    scene.setBomb(team, { edition: ed, maxStrikes: 3 });
    scene.setTeam(team, 0);
    gameKey = 'preview';
  }

  /* ---------------------------------------------------------- manipulations */
  function pick(p) {
    if (!state || state.phase !== 'play' || role !== 'defuser') return;
    const t = state.teams[myTeam];
    if (!t || t.status !== 'live') return;
    const mod = t.bomb.modules[p.m];
    if (p.op === 'play') { sfx.melody(manualOf(state.edition).chime.melodies[mod.mel].notes); return; }
    if (mod && mod.solved) { sfx.click(); return; }
    ({ cut: () => sfx.cut(), dial: () => sfx.dial(), flip: () => sfx.clack(), rot: () => sfx.clack(), key: () => sfx.key(p.i), open: () => sfx.water(), knob: () => sfx.dial() }[p.op] || (() => sfx.click()))();
    session.act({ m: p.m, op: p.op, i: p.i, d: p.d });
  }

  /* ---------------------------------------------------------- chat */
  $('#chatForm').onsubmit = (e) => { e.preventDefault(); const v = $('#chatIn').value.trim(); if (v) session.chat(v); $('#chatIn').value = ''; $('#chatIn').blur(); };
  for (const b of root.querySelectorAll('#quick button')) b.onclick = () => session.chat(b.textContent);
  function chat(m) {
    const log = $('#chatLog');
    const el = document.createElement('div');
    el.className = 'msg' + (m.from === me.id ? ' me' : '');
    el.innerHTML = `<b style="color:${esc(m.color)}">${esc(m.name)}</b> ${esc(m.text)}`;
    log.appendChild(el);
    while (log.children.length > 40) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
    if (m.from !== me.id) sfx.chat();
  }

  /* ---------------------------------------------------------- outils */
  DDVolume.panel($('#tSet'), { kinds: ['fx'], accent: '#c8102e' }); // pas de musique dans Fil Rouge
  $('#tQuit').onclick = exit;
  $('#tReset').onclick = () => scene && scene.reset();
  $('#tFlip').onclick = () => scene && scene.flip();
  $('#helpX').onclick = () => { $('#help').classList.toggle('mini'); };
  // l'aide se replie d'elle-même au bout de quelques secondes de jeu
  let helpTimer = 0;
  const foldHelp = () => { clearTimeout(helpTimer); helpTimer = setTimeout(() => $('#help').classList.add('mini'), 15000); };
  for (const b of root.querySelectorAll('#pad button')) {
    let iv = 0;
    const [ax, s] = b.dataset.r.split(',');
    const go = () => { if (scene) scene.rotate(ax, Number(s) * 0.12); };
    b.onpointerdown = (e) => { e.preventDefault(); go(); iv = setInterval(go, 40); };
    b.onpointerup = b.onpointerleave = () => clearInterval(iv);
  }
  if (matchMedia('(pointer: coarse)').matches) root.querySelector('.fr').classList.add('touch');
  window.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'Enter' && !$('#chat').hidden) { e.preventDefault(); $('#chatIn').focus(); }
  });

  // secours sans 3D : manuel HTML (experts seulement)
  function setManualOpen(v) {
    manualOpen = v;
    root.querySelector('.fr').classList.toggle('split', role === 'defuser' && manualOpen);
    $('#manualBox').hidden = !(role === 'expert' || manualOpen);
  }
  function ensureManual(ed) {
    if (manual && manualEd === ed) return;
    manual = mountManual($('#manualBox'), ed); manualEd = ed;
  }

  function toast(text, kind = '') {
    const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3200);
  }
  function flash(kind) { const f = $('#flash'); f.className = 'flash ' + kind; void f.offsetWidth; f.classList.add('on'); }

  /* ---------------------------------------------------------- avant-partie */
  function setup(s) {
    setupS = s; state = null;
    $('#over').hidden = true; $('#hud').hidden = true; $('#chat').hidden = false; $('#help').hidden = true; $('#pad').hidden = true;
    $('#manualBox').hidden = true; root.querySelector('.fr').classList.remove('split', 'expert');
    $('#stage').hidden = false;
    if (gameKey !== 'preview') { gameKey = ''; previewBomb(); }
    if (scene) { scene.setBombVisible(true); scene.setBookView(false, false); scene.setManual(null); }
    const versus = s.cfg.mode === 'versus';
    const mine = s.players.find((p) => p.id === me.id);
    const host = session.isHost;
    const col = (t) => {
      const ps = s.players.filter((p) => p.team === t);
      return `<div class="tcol" style="--tc:${versus ? TEAMS[t].color : '#ffc531'}"><h3>${versus ? esc(TEAMS[t].name) : 'Ton équipe'}</h3>
        ${ps.map((p) => `<div class="prow${p.id === me.id ? ' me' : ''}${p.ready ? '' : ' wait'}"><i style="background:${esc(p.color)}"></i><span>${esc(p.name)}</span>
          <em class="${p.role}">${p.role === 'defuser' ? '💣 Démineur' : '📘 Expert'}</em>${p.ready ? '' : '<small>charge…</small>'}</div>`).join('') || '<div class="prow empty">Personne</div>'}
        ${mine && versus && mine.team !== t ? `<button class="btn small ghost" data-team="${t}">Rejoindre</button>` : ''}</div>`;
    };
    $('#setup').innerHTML = `<div class="card setupcard">
      <div class="brand"><h1>FIL ROUGE</h1><p>Un démineur, un manuel, et pas le droit à l'erreur.</p></div>
      <div class="pills"><span class="pill">${versus ? '⚔️ Duel · 2 équipes, même bombe' : '🤝 Coopération'}</span><span class="pill">${esc(DIFFS[s.cfg.diff].label)} · ${[2, 3, 5, 7][s.cfg.diff]} modules · ${mmss(DIFFS[s.cfg.diff].time * 1000)}</span><span class="pill">${s.cfg.strikes} faute${s.cfg.strikes > 1 ? 's' : ''} max</span>${versus && s.cfg.sabotage ? '<span class="pill">🧨 Sabotages</span>' : ''}</div>
      <div class="teams${versus ? ' two' : ''}">${col(0)}${versus ? col(1) : ''}</div>
      ${mine ? `<div class="mine"><span>Ton rôle :</span>
        <button class="btn small ${mine.role === 'defuser' ? '' : 'ghost'}" data-role="defuser">💣 Démineur</button>
        <button class="btn small ${mine.role === 'expert' ? 'yellow' : 'ghost'}" data-role="expert">📘 Expert</button></div>` : ''}
      <div class="how">
        <div><b>💣 Le démineur</b> voit la bombe en 3D, la tourne et la manipule… mais n'a pas le manuel.</div>
        <div><b>📘 L'expert</b> a le manuel… mais ne voit pas la bombe. Parlez-vous (vocal ou chat d'équipe) !</div>
        ${versus ? '<div><b>⚔️ Duel</b> : les deux équipes ont la même bombe. La première qui la désamorce gagne. Chaque module désamorcé envoie un sabotage à l\'autre équipe.</div>' : ''}
        <div><b>À deux minimum</b> : une personne à la bombe, une personne au manuel${versus ? ' — en duel, 2 par équipe' : ''}. Le démineur n'a jamais le manuel.</div>
      </div>
      ${s.error ? `<p class="err">${esc(s.error)}</p>` : ''}
      <div class="row end">${host ? `${s.players.length > 1 ? '<button class="btn ghost" id="sShuffle">🎲 Au hasard</button>' : ''}<button class="btn big primary" id="sGo" ${s.error ? 'disabled' : ''}>Lancer la partie</button>` : '<span class="waiting">L\'hôte lance la partie…</span>'}<button class="btn ghost" id="sExit">Retour au salon</button></div>
    </div>`;
    $('#setup').hidden = false;
    for (const b of root.querySelectorAll('#setup [data-role]')) b.onclick = () => session.pick({ role: b.dataset.role });
    for (const b of root.querySelectorAll('#setup [data-team]')) b.onclick = () => session.pick({ team: Number(b.dataset.team) });
    if ($('#sShuffle')) $('#sShuffle').onclick = () => session.shuffle();
    if ($('#sGo')) $('#sGo').onclick = () => session.start();
    $('#sExit').onclick = exit;
  }

  /* ---------------------------------------------------------- partie */
  function update(s, off, ev = []) {
    state = s; offset = off;
    const p = s.players.find((q) => q.id === me.id);
    myTeam = p ? p.team : 0;
    const newRole = p ? p.role : 'expert';
    const key = `${s.seed}-${s.startedAt}`;
    $('#setup').hidden = true;
    const team = s.teams[myTeam];
    if (key !== gameKey) {
      gameKey = key; lastSolved = -1;
      $('#chatLog').innerHTML = '';
      manualOpen = false;
      if (ensureScene()) { scene.setBomb(team, { edition: s.edition, maxStrikes: s.cfg.strikes }); scene.setBookView(false, false); }
      if (now() < team.clock.at) countdown(team.clock.at);
      $('#help').classList.remove('mini'); foldHelp();
    }
    role = newRole;
    if (!p) role = 'expert'; // spectateur : il lit le manuel
    const fr = root.querySelector('.fr');
    if (scene) {
      // tout est dans la pièce : l'expert a le manuel devant lui, sans la bombe
      scene.setBombVisible(role === 'defuser');
      scene.setManual(role === 'expert' ? s.edition : null);
      scene.setBookView(role === 'expert', role === 'expert');
      $('#manualBox').hidden = true;
    } else {
      ensureManual(s.edition);
      fr.classList.toggle('expert', role === 'expert');
      $('#stage').hidden = role === 'expert';
      setManualOpen(manualOpen);
    }
    $('#help').hidden = s.phase !== 'play';
    $('#pad').hidden = role !== 'defuser' || s.phase !== 'play';
    $('#tReset').hidden = $('#tFlip').hidden = role !== 'defuser';
    $('#hud').hidden = false; $('#chat').hidden = false;
    setHelp();
    if (scene) scene.setTeam(team, off);
    lastSolved = team.solved;

    // en-tête
    const versus = s.cfg.mode === 'versus';
    $('#hTeam').innerHTML = `<i style="background:${versus ? team.color : '#ffc531'}"></i>${versus ? esc(team.name) : 'Coopération'}<small>${p ? (p.role === 'defuser' ? '💣 Démineur' : '📘 Expert') : 'Spectateur'}</small>`;
    $('#hProg').innerHTML = team.bomb.modules.map((m, k) => `<button data-m="${k}" class="${m.solved ? 'ok' : ''}" title="${MODULE_INFO[m.type].name}${m.slot >= 6 ? ' (au dos)' : ''}" ${role === 'defuser' ? '' : 'tabindex="-1"'}>${MODULE_INFO[m.type].icon}</button>`).join('');
    for (const b of root.querySelectorAll('#hProg button')) b.onclick = () => { if (scene && role === 'defuser') scene.focusModule(Number(b.dataset.m), true); };
    const opp = versus ? s.teams[1 - myTeam] : null;
    $('#hOpp').hidden = !opp;
    if (opp) $('#hOpp').innerHTML = `<i style="background:${opp.color}"></i>${esc(opp.name)} <b>${opp.solved}/${opp.bomb.modules.length}</b> ${'●'.repeat(opp.strikes)}${'○'.repeat(Math.max(0, s.cfg.strikes - opp.strikes))}${opp.status === 'boom' ? ' 💥' : opp.status === 'defused' ? ' ✅' : ''}`;

    for (const e of ev) handleEvent(e, s);
    if (s.phase === 'over') setTimeout(() => showOver(s), ev.some((e) => e.k === 'boom' && e.team === myTeam) ? 1700 : 600);
    else $('#over').hidden = true;
  }

  function handleEvent(e, s) {
    const mine = e.team === myTeam;
    if (e.k === 'strike' && mine) { sfx.strike(); flash('red'); if (scene) scene.strike(e.m); toast('Faute !', 'bad'); }
    else if (e.k === 'solve' && mine) { sfx.solve(); toast(`${MODULE_INFO[s.teams[myTeam].bomb.modules[e.m].type].name} désamorcé !`, 'good'); }
    else if (e.k === 'boom' && mine) { sfx.boom(); flash('white'); if (scene && role === 'defuser') scene.explode(); }
    else if (e.k === 'defused' && mine) { sfx.win(); flash('green'); confetti(); }
    else if (e.k === 'boom' && !mine) toast(`💥 ${s.teams[e.team].name} a sauté !`);
    else if (e.k === 'solve' && !mine && s.cfg.mode === 'versus') toast(`${s.teams[e.team].name} a désamorcé un module`);
    else if (e.k === 'sab' && mine) sabotage(e.kind, s.teams[e.from].name);
    else if (e.k === 'promote' && mine && e.id === me.id) toast('Ton démineur est parti : à toi la bombe !', 'good');
  }

  function sabotage(kind, from) {
    sfx.sabotage();
    toast(`${SAB_LABEL[kind]} — ${from}`, 'bad');
    if (scene) {
      if (kind !== 'encre') scene.sabotage(kind);
      else if (role === 'expert' || scene.bookOn) scene.inkBook(6);
      else scene.sabotage('fumee');
    } else if (kind === 'encre' && manual) manual.ink(6);
    else {
      const fr = root.querySelector('.fr');
      const cls = { noir: 'sab-noir', fumee: 'sab-fumee', secousse: 'sab-secousse' }[kind];
      fr.classList.add(cls); setTimeout(() => fr.classList.remove(cls), kind === 'secousse' ? 2500 : 5000);
    }
  }

  function countdown(at) {
    const el = document.createElement('div'); el.className = 'count';
    root.querySelector('.fr').appendChild(el);
    const step = () => {
      const left = at - now();
      if (left <= 0) { el.textContent = 'GO !'; el.classList.add('go'); setTimeout(() => el.remove(), 700); return; }
      el.textContent = String(Math.ceil(left / 1000));
      setTimeout(step, 100);
    };
    step();
  }
  const now = () => Date.now() + offset;

  function confetti() {
    const box = document.createElement('div'); box.className = 'confetti';
    for (let k = 0; k < 70; k++) { const i = document.createElement('i'); i.style.left = Math.random() * 100 + '%'; i.style.background = ['#ff4b2b', '#ffc531', '#2fbf71', '#2b8cff', '#ff5fa2'][k % 5]; i.style.animationDelay = Math.random() * 0.6 + 's'; i.style.animationDuration = 1.6 + Math.random() * 1.4 + 's'; box.appendChild(i); }
    root.querySelector('.fr').appendChild(box); setTimeout(() => box.remove(), 3600);
  }

  function showOver(s) {
    if (state !== s || s.phase !== 'over') return;
    const versus = s.cfg.mode === 'versus';
    const t = s.teams[myTeam];
    let title, sub;
    if (versus) {
      const w = s.teams[s.winner];
      title = s.winner === myTeam ? 'VICTOIRE !' : 'DÉFAITE…';
      sub = w.status === 'defused' ? `${esc(w.name)} a désamorcé sa bombe (${mmss(w.left)} restantes).` : `${esc(w.name)} est la dernière équipe debout.`;
    } else if (t.status === 'defused') { title = 'BOMBE DÉSAMORCÉE !'; sub = `Il restait ${mmss(t.left)} au chrono. Bravo l'équipe.`; }
    else { title = 'BOUM.'; sub = `${t.solved} module${t.solved > 1 ? 's' : ''} sur ${t.bomb.modules.length} désamorcé${t.solved > 1 ? 's' : ''}. On refait ?`; }
    const status = { defused: '✅ Désamorcée', boom: '💥 Explosée', stopped: '⏹️ Arrêtée', live: '…' };
    $('#over').innerHTML = `<div class="card overcard ${t.status === 'defused' || s.winner === myTeam ? 'win' : 'lose'}">
      <h1>${title}</h1><p>${sub}</p>
      <table class="res"><thead><tr><th>Équipe</th><th>Bombe</th><th>Modules</th><th>Fautes</th><th>Chrono</th></tr></thead><tbody>
      ${(s.ranking || s.teams.map((x) => x.i)).map((i) => { const x = s.teams[i]; return `<tr><td><i style="background:${versus ? x.color : '#ffc531'}"></i>${versus ? esc(x.name) : 'Équipe'}<small>${s.players.filter((p) => p.team === i).map((p) => esc(p.name)).join(', ')}</small></td><td>${status[x.status]}</td><td>${x.solved}/${x.bomb.modules.length}</td><td>${x.strikes}</td><td>${mmss(x.left ?? 0)}</td></tr>`; }).join('')}
      </tbody></table>
      <p class="ed">Manuel édition ${s.edition} · lot ${esc(t.bomb.lot)}</p>
      <div class="row end">${session.isHost ? '<button class="btn big primary" id="oAgain">Rejouer</button>' : '<span class="waiting">L\'hôte peut relancer une partie…</span>'}<button class="btn ghost" id="oExit">Retour au salon</button></div></div>`;
    $('#over').hidden = false;
    $('#help').hidden = true; $('#pad').hidden = true;
    if ($('#oAgain')) $('#oAgain').onclick = () => session.again();
    $('#oExit').onclick = exit;
  }

  // chrono du bandeau
  setInterval(() => {
    if (!state) return;
    const t = state.teams[myTeam], ms = timeLeft(t, now());
    $('#hTime').textContent = t.status === 'defused' ? 'OK' : mmss(ms);
    $('#hTime').classList.toggle('hot', t.status === 'live' && ms < 30000);
    $('#hStrikes').innerHTML = Array.from({ length: state.cfg.strikes }, (_, k) => `<i class="${k < t.strikes ? 'on' : ''}"></i>`).join('') + (t.clock.rate > 1 && t.status === 'live' ? `<small>×${t.clock.rate.toFixed(2)}</small>` : '');
  }, 100);

  return {
    setup, update, chat, toast,
    error(msg, soft) { if (msg) toast(msg, soft ? '' : 'bad'); },
    get scene() { return scene; },
  };
}
