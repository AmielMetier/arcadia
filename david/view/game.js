// Vue de DavidSimulator : plateau 3D, interface de jeu et « réalisateur » qui met en scène les événements.
// Chaque mise à jour reçue (état + événements) est jouée dans l'ordre — dés, déplacements, paiements,
// achats, cartes — puis l'état final est appliqué. Si les mises à jour s'accumulent, la lecture accélère.
import { availableActions, currentPlayer, canPropose } from '../engine/rules.js';
import { netWorth } from '../engine/valuation.js';
import { mountBoard } from './board.js';
import { mountBoard3d } from './board3d.js';
import { mountDice } from './dice.js';
import { mountFx } from './fx.js';
import { sfx, audioContext } from './sfx.js';
import { createMusic } from './music.js';
import { tokenSvg } from './tokens.js';
import { mountSetup } from './setup.js';
import { EMOTES, PHRASES, emoteOf } from './emotes.js';
import { esc, money, el, wait, store, save } from './util.js';
import { mountModals, buyHtml, auctionHtml, propertyHtml, mineHtml, offerHtml, tradeComposeHtml, overHtml, billHtml, watchHtml, tradeChips } from './modals.js';
import { openStats, sparkline, heatValues, heatColor, heatLabel } from './stats.js';
import { standings, teamStandings, sameTeam, TEAM_NAMES } from '../engine/valuation.js';

export async function mountGame(root, board, { me, act, pick, start, exit, chooseSave, deleteSave, emote = () => {}, team = () => {}, chat = () => {} }) {
  root.className = 'game';
  root.innerHTML = `
    <div class="stagehost" id="stagehost"></div>
    <header class="topbar">
      <div class="info"><b id="mode">DavidSimulator</b><span id="round"></span></div>
      <div class="timer" id="timer" hidden></div>
      <div class="tools">
        <button class="heatpill" id="heatPill" hidden title="Masquer la heatmap"></button>
        <button class="tool" id="tstats" title="Statistiques">📊</button>
        <button class="tool" id="tcenter" title="Recentrer la caméra" hidden>⌖</button>
        <button class="tool" id="t3d" title="Vue 3D ou vue de dessus">3D</button>
        <button class="tool" id="trend" title="Plateau en vraie 3D ou plateau classique">🧊</button>
        <button class="tool" id="tcam" title="Caméra qui suit le pion">🎥</button>
        <button class="tool" id="tmus" title="Musique d'ambiance">🎵</button>
        <button class="tool" id="tsnd" title="Bruitages">🔊</button>
        <button class="tool" id="tvol" title="Volume de la musique et des effets" aria-label="Volume">🎚️</button>
        <button class="tool quit" id="tquit">Quitter</button>
      </div>
    </header>
    <aside class="roster" id="roster" aria-label="Joueurs"></aside>
    <div class="actionbar" id="actionbar" aria-live="polite"></div>
    <div class="diceread" id="diceread" hidden aria-live="polite"></div>
    <div class="tradefeed" id="tradeFeed" aria-live="polite" aria-label="Échanges en direct entre les autres joueurs"></div>
    <div class="dock">
      <button class="btn ghost emobtn" id="bEmote" title="Réagir (touche R)" aria-expanded="false">😀</button>
      <button class="btn ghost" id="bMine">Mes biens</button>
      <button class="btn ghost" id="bTrade">Échanger<i class="badge" id="tradeBadge" hidden></i></button>
      <button class="btn ghost" id="bChat" hidden title="Chat d'équipe (touche T)">💬 Équipe<i class="badge" id="chatBadge" hidden></i></button>
    </div>
    <div class="tchat" id="tchat" hidden role="dialog" aria-label="Chat d'équipe">
      <div class="tch"><b>Chat d'équipe</b><small>🔒 seul ton coéquipier le lit</small><button class="tchx" id="tchatX" aria-label="Fermer">✕</button></div>
      <ol class="tchlog" id="tchatLog"><li class="tchempty">Coordonnez-vous ici : l'équipe adverse ne voit rien.</li></ol>
      <div class="tchquick">${['Je bâtis chez toi ?', 'Garde du cash !', 'Achète-la !', 'J\'ai besoin d\'argent', 'On échange ?', 'Bien joué 👏'].map((q) => `<button type="button" data-q="${q}">${q}</button>`).join('')}</div>
      <form class="tchform" id="tchatF" autocomplete="off"><input id="tchatIn" maxlength="200" placeholder="Message à ton coéquipier…" aria-label="Message"><button class="btn small">Envoyer</button></form>
    </div>
    <div class="logbox" id="logbox"><ol id="log"></ol></div>
    <div class="toast" id="toast" hidden role="status"></div>`;
  const $ = (s) => root.querySelector(s);
  // pincement du pavé tactile / Ctrl + molette : on zoome le plateau, jamais la page entière (Chrome zoomait toute la page
  // dès que le pointeur passait sur un panneau au lieu du plateau)
  addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

  // plateau en vraie 3D (WebGL) ; plateau CSS classique si WebGL est indisponible ou si le joueur le préfère
  let B = null;
  // plateau en vraie 3D par défaut sur ordinateur ; plateau classique (plus léger) par défaut sur écran tactile
  const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  const wantCss = new URLSearchParams(location.search).has('css') || store('david_renderer', touch ? 'css' : '3d') === 'css';
  if (!wantCss) {
    try { B = await mountBoard3d($('#stagehost'), board, { onCell: (i) => openProperty(i) }); root.classList.add('webgl'); }
    catch (e) { console.warn('Plateau 3D indisponible, plateau classique utilisé.', e); $('#stagehost').innerHTML = ''; B = null; }
  }
  if (!B) B = mountBoard($('#stagehost'), board, { onCell: (i) => openProperty(i) });
  const D = mountDice(root);
  const F = mountFx(root);
  const M = mountModals(root);
  B.onStep = () => sfx.play('hop');
  const SU = mountSetup(root, { me, pick, start, exit, chooseSave, deleteSave, team });

  let S = null, offset = 0, playing = false, first = true;
  const queue = [], seenAuto = new Set(), logLines = [];
  const cash = {}; // argent affiché (animé)
  const name = (id) => { const p = S && S.players.find((q) => q.id === id); return p ? p.name : 'la banque'; };
  const color = (id) => { const p = S && S.players.find((q) => q.id === id); return p ? p.color : '#16181d'; };
  const meP = () => S && S.players.find((p) => p.id === me.id);

  /* ---------------------------------------------------------- barre d'outils */
  const music = createMusic(audioContext);
  // le navigateur n'autorise le son qu'après un geste : la musique démarre au premier clic ou touche
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (music.on) music.start(); }, { once: true, capture: true });
  DDVolume.panel($('#tvol'));
  $('#tmus').onclick = () => { music.toggle(); syncTools(); };
  const syncTools = () => {
    $('#tmus').classList.toggle('off', !music.on); $('#tmus').title = music.on ? 'Couper la musique' : 'Mettre la musique'; $('#t3d').textContent = B.is3d() ? '3D' : '2D'; $('#tcam').classList.toggle('off', !B.follow()); $('#tsnd').textContent = sfx.on ? '🔊' : '🔇'; };
  $('#t3d').onclick = () => { B.toggle3d(); syncTools(); };
  $('#tcenter').hidden = !B.recenter;
  $('#tcenter').onclick = () => B.recenter && B.recenter();
  $('#trend').onclick = () => {
    const next = B.kind === '3d' ? 'css' : '3d';
    save('david_renderer', next);
    toast(next === 'css' ? 'Plateau classique à la prochaine partie' : 'Plateau en vraie 3D à la prochaine partie');
  };
  $('#tcam').onclick = () => { B.toggleFollow(); syncTools(); };
  $('#tsnd').onclick = () => { sfx.toggle(); syncTools(); };
  $('#tquit').onclick = () => { if (!S || S.over || confirm("Quitter la partie ?\nElle est sauvegardée : l'hôte pourra la reprendre depuis l'écran de choix des pions.")) exit(); };
  $('#bMine').onclick = () => openMine();
  let statsCtl = null, heatMode = null;
  const HEAT_NAMES = { visits: 'Visites', rent: 'Loyers perçus', theory: 'Probabilité' };
  function openStatsWin() { if (!S) return; statsCtl = openStats(M, board, () => S, me, { onHeat: setHeat, heatMode: heatMode || 'visits' }); }
  // Ambiance musicale : enchères, tension (dette, peu d'argent, fin de chrono, faillite proche), sinon calme
  function moodOf(s) {
    if (s.auction) return 'auction';
    const p = s.players.find((q) => q.id === me.id);
    const anyLow = s.players.some((q) => !q.bankrupt && q.cash < 150);
    const late = s.endsAt && s.endsAt - (Date.now() + offset) < 5 * 60000;
    if (s.debts.length || anyLow || late || (p && !p.bankrupt && p.cash < 300)) return 'tense';
    return 'calm';
  }
  function setHeat(mode) {
    heatMode = mode;
    $('#heatPill').hidden = !mode;
    if (mode) $('#heatPill').textContent = `Heatmap : ${HEAT_NAMES[mode]} ✕`;
    paintHeat();
  }
  function paintHeat() {
    if (!S || !heatMode) { B.heat(null); return; }
    const vals = heatValues(S, board, heatMode), max = Math.max(...vals);
    B.heat(vals.map((v) => { const c = heatColor(v, max); return c ? { ...c, label: heatLabel(heatMode, v) } : null; }));
  }
  $('#tstats').onclick = () => openStatsWin();
  $('#heatPill').onclick = () => setHeat(null);
  $('#bTrade').onclick = () => openTrade();

  /* ---------------------------------------------------------- réactions */
  const emoPanel = el('div', 'emopanel', `<div class="emogrid">${EMOTES.map((e) => `<button data-emo="${e.id}" aria-label="${e.id}">${e.glyph}</button>`).join('')}</div>
    <div class="emophr">${PHRASES.map((p) => `<button data-emo="${p.id}">${esc(p.text)}</button>`).join('')}</div>`);
  emoPanel.hidden = true; root.appendChild(emoPanel);
  const toggleEmo = (v = emoPanel.hidden) => { emoPanel.hidden = !v; $('#bEmote').setAttribute('aria-expanded', String(v)); };
  $('#bEmote').onclick = () => toggleEmo();
  let emoLast = 0;
  emoPanel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-emo]'); if (!b) return;
    if (Date.now() - emoLast < 1200) { sfx.play('error'); return; }
    emoLast = Date.now(); emote(b.dataset.emo); toggleEmo(false);
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !emoPanel.hidden) { toggleEmo(false); return; }
    if ((e.key === 'r' || e.key === 'R') && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !M.key) toggleEmo();
  });
  addEventListener('pointerdown', (e) => { if (!emoPanel.hidden && !e.target.closest('.emopanel, #bEmote')) toggleEmo(false); });
  /* ---------------------------------------------------------- 2 contre 2 : chat d'équipe */
  let unread = 0;
  const chatBox = $('#tchat'), chatLog = $('#tchatLog');
  function toggleChat(v) {
    chatBox.hidden = v == null ? !chatBox.hidden : !v;
    if (!chatBox.hidden) { unread = 0; $('#chatBadge').hidden = true; chatLog.scrollTop = chatLog.scrollHeight; setTimeout(() => $('#tchatIn').focus(), 30); }
  }
  $('#bChat').onclick = () => toggleChat();
  $('#tchatX').onclick = () => toggleChat(false);
  $('#tchatF').onsubmit = (e) => { e.preventDefault(); const i = $('#tchatIn'), v = i.value.trim(); if (!v) return; chat(v); i.value = ''; };
  for (const b of chatBox.querySelectorAll('[data-q]')) b.onclick = () => chat(b.dataset.q);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !chatBox.hidden) { toggleChat(false); return; }
    if ((e.key === 't' || e.key === 'T') && S && S.cfg.teams && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !M.key) { e.preventDefault(); toggleChat(true); }
  });
  function showChat(m) {
    chatLog.querySelector('.tchempty')?.remove();
    const mine = m.from === me.id;
    const li = el('li', mine ? 'me' : '');
    li.style.setProperty('--c', m.color || '#16181d');
    li.innerHTML = `<b>${esc(mine ? 'Toi' : m.name)}</b><span></span>`;
    li.querySelector('span').textContent = m.text;
    chatLog.appendChild(li);
    while (chatLog.children.length > 80) chatLog.firstChild.remove();
    chatLog.scrollTop = chatLog.scrollHeight;
    if (mine) return;
    sfx.play('bid');
    if (chatBox.hidden) {
      unread++; const b = $('#chatBadge'); b.textContent = unread; b.hidden = false;
      // aperçu dans une bulle à côté de la carte du coéquipier
      const card = cardEl(m.from);
      if (card) {
        card.querySelector('.bubble')?.remove();
        const bub = el('div', 'bubble chatbub'); bub.textContent = '💬 ' + (m.text.length > 60 ? m.text.slice(0, 57) + '…' : m.text);
        card.appendChild(bub); setTimeout(() => bub.classList.add('out'), 3600); setTimeout(() => bub.remove(), 4000);
      }
    }
  }

  function showEmote(from, id) {
    const em = emoteOf(id); if (!em || !S) return;
    const p = S.players.find((q) => q.id === from); if (!p) return;
    sfx.play('bid');
    const big = !!em.glyph;
    // bulle à côté de la carte du joueur
    const card = cardEl(from);
    if (card) {
      card.querySelector('.bubble')?.remove();
      const bub = el('div', 'bubble' + (big ? ' big' : ''));
      bub.textContent = em.glyph || em.text; card.appendChild(bub);
      setTimeout(() => bub.classList.add('out'), 2600); setTimeout(() => bub.remove(), 3000);
    }
    // au-dessus du pion sur le plateau
    const pt = B.pawnScreen && B.pawnScreen(from);
    if (pt) {
      const f = el('div', 'emofloat' + (big ? ' big' : ''));
      f.textContent = em.glyph || em.text; f.style.left = pt.x + 'px'; f.style.top = (pt.y - 34) + 'px'; f.style.setProperty('--c', p.color);
      root.appendChild(f);
      f.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-90%) scale(1.15)', opacity: 1, offset: 0.15 },
        { transform: 'translate(-50%,-110%) scale(1)', opacity: 1, offset: 0.75 }, { transform: 'translate(-50%,-160%) scale(.9)', opacity: 0 }],
      { duration: 2400, easing: 'ease-out' }).finished.then(() => f.remove());
    }
    log({ k: 'EMOTE', player: from, text: em.glyph || em.text });
  }
  $('#logbox').onclick = () => $('#logbox').classList.toggle('open');
  syncTools();

  /* ---------------------------------------------------------- journal */
  function describe(e) {
    switch (e.k) {
      case 'TURN': return `Au tour de ${name(e.player)}`;
      case 'EMOTE': return `${name(e.player)} : ${e.text}`;
      case 'DICE': return e.reason === 'utility' ? `${name(e.player)} relance : ${e.dice[0]} + ${e.dice[1]}` : `${name(e.player)} fait ${e.dice[0]} + ${e.dice[1]}${e.dice[0] === e.dice[1] ? ' (double)' : ''}`;
      case 'LAND': return `${name(e.player)} → ${board.spaces[e.space].name}`;
      case 'PAY':
        if (e.reason === 'rent') return `${name(e.from)} paie ${money(e.amount)} de loyer à ${name(e.to)}`;
        if (e.reason === 'go') return `${name(e.to)} touche ${money(e.amount)} (Départ)`;
        if (e.reason === 'jackpot') return `${name(e.to)} remporte la cagnotte : ${money(e.amount)} !`;
        if (e.reason === 'tax') return `${name(e.from)} paie ${money(e.amount)} de taxe`;
        if (e.reason === 'bail') return `${name(e.from)} paie la caution`;
        if (e.reason === 'bankrupt') return `${name(e.from)} solde ${money(e.amount)} ${e.to != null ? 'à ' + name(e.to) : 'à la banque'} avant de sortir`;
        if (e.reason === 'inherit') return `${name(e.to)} récupère ${money(e.amount)} de son coéquipier`;
        if (e.reason === 'card') return e.from == null ? `${name(e.to)} reçoit ${money(e.amount)}` : `${name(e.from)} paie ${money(e.amount)}${e.to != null ? ' à ' + name(e.to) : ''}`;
        return null;
      case 'CARD': return `${e.deck === 'chance' ? 'Chance' : 'Caisse'} : ${e.text}`;
      case 'APPARITION': return `✨ Sylvain Durif apparaît au milieu du plateau pour 3 tours`;
      case 'APPARITION_END': return `Le buste de Sylvain Durif s'efface du plateau`;
      case 'JAIL': return `${name(e.player)} va en prison`;
      case 'JAIL_OUT': return `${name(e.player)} sort de prison`;
      case 'BUY': return `${name(e.player)} achète ${board.spaces[e.space].name}`;
      case 'GIFT': return `${name(e.player)} reçoit ${board.spaces[e.space].name}`;
      case 'AUCTION_END': return e.winner != null ? `${name(e.winner)} remporte ${board.spaces[e.space].name} pour ${money(e.amount)}` : `${board.spaces[e.space].name} reste à la banque`;
      case 'BUILD': return `${name(e.player)} construit ${e.hotel ? 'un hôtel' : 'une maison'} · ${board.spaces[e.space].name}`;
      case 'MORTGAGE': return `${name(e.player)} hypothèque ${board.spaces[e.space].name}`;
      case 'UNMORTGAGE': return `${name(e.player)} lève l'hypothèque de ${board.spaces[e.space].name}`;
      case 'TRADE_DONE': return `Échange conclu : ${name(e.trade.from)} ⇄ ${name(e.trade.to)}`;
      case 'TRADE_CANCELLED': return e.reason === 'turn' ? 'Proposition d\'échange expirée (fin du tour)' : null;
      case 'TRADE_OFFER': return `${name(e.trade.from)} propose un échange à ${name(e.trade.to)}`;
      case 'TRADE_REJECTED': { const t = tradeById(e.trade); return t ? `${name(e.by)} refuse l'échange de ${name(t.from)}` : `${name(e.by)} refuse un échange`; }
      case 'NO_RENT': return `${name(e.player)} est chez son coéquipier : pas de loyer`;
      case 'BANKRUPT': return e.heir != null ? `${name(e.player)} fait faillite : son coéquipier ${name(e.heir)} reprend ses biens` : `${name(e.player)} fait faillite`;
      case 'BOT': return e.bot ? `${name(e.player)} est déconnecté : un bot joue à sa place` : `${name(e.player)} est de retour`;
      case 'HOST_CHANGED': return `${name(e.host)} est le nouvel hôte de la partie`;
      case 'GAME_OVER': return e.team != null ? `${TEAM_NAMES[e.team]} remporte la partie !` : `${name(e.winner)} remporte la partie !`;
      default: return null;
    }
  }
  function log(e) {
    const t = describe(e); if (!t) return;
    logLines.push({ t, turn: e.k === 'TURN' }); logLines.splice(0, Math.max(0, logLines.length - 80));
    $('#log').innerHTML = logLines.slice(-30).map((l) => `<li class="${l.turn ? 'turn' : ''}">${esc(l.t)}</li>`).join('');
    $('#log').scrollTop = 1e6;
  }

  /* ---------------------------------------------------------- joueurs */
  function cardEl(id) { return $(`#roster [data-pid="${id}"]`); }
  function cardPoint(id) {
    const c = cardEl(id); if (!c) return null;
    const b = c.querySelector('.cash').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }
  function bankPoint() { const b = B.stage.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }
  function setCash(id, v, animate) {
    const from = cash[id] ?? v; cash[id] = v;
    const c = cardEl(id); if (!c) return;
    const out = c.querySelector('.cash');
    if (!animate || from === v) { out.textContent = money(v); return; }
    const t0 = performance.now(), dur = 600;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); out.textContent = money(from + (v - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
    c.classList.remove('gain', 'loss'); void c.offsetWidth; c.classList.add(v > from ? 'gain' : 'loss');
  }
  function renderRoster() {
    const cur = S.over ? null : currentPlayer(S).id;
    const rank = new Map(standings(S, board).map((r, k) => [r.id, k + 1]));
    const card = (p) => {
      const w = netWorth(S, board, p.id);
      return `<div class="pcard-hud${p.id === cur ? ' cur' : ''}${p.bankrupt ? ' out' : ''}${p.id === me.id ? ' me' : ''}" data-pid="${p.id}" style="--pc:${p.color}">
        <span class="mini">${tokenSvg(p.token, p.color)}<i class="rk" title="Rang au patrimoine">${p.bankrupt ? '✕' : rank.get(p.id)}</i></span>
        <span class="who"><b>${esc(p.name)}</b><small>${p.id === me.id ? 'toi' : sameTeam(S, me.id, p.id) ? 'coéquipier' : p.bot ? 'bot' : ''}${p.inJail ? ' · 🔒 prison' : ''}${p.jailCards.length ? ' · 🎟' : ''}</small></span>
        <span class="cash" title="Argent liquide">${money(cash[p.id] ?? p.cash)}</span>
        <span class="worth"><span title="Valeur immobilière">🏠 ${money(w.property + w.buildings)}</span><span title="Monopoles">♛ ${w.monopolies}</span><span class="net" title="Patrimoine net">Net ${money(w.total)}</span></span>
        <span class="sp">${sparkline(S, p.id, p.color)}</span>
        ${p.id === cur ? '<i class="playing">joue</i>' : ''}
      </div>`;
    };
    if (S.cfg.teams) {
      // 2 contre 2 : une colonne par équipe, avec le patrimoine cumulé
      const lead = teamStandings(S, board)[0];
      $('#roster').innerHTML = [0, 1].map((t) => {
        const ts = teamStandings(S, board).find((x) => x.team === t);
        const mine = S.players.some((p) => p.id === me.id && p.team === t);
        return `<div class="teamhead t${t}${mine ? ' mine' : ''}"><b>${TEAM_NAMES[t]}${mine ? ' · toi' : ''}</b><span>${ts.alive ? money(ts.total) : 'faillite'}${lead.team === t && ts.alive ? ' ♛' : ''}</span></div>`
          + S.players.filter((p) => p.team === t).map(card).join('');
      }).join('');
    } else $('#roster').innerHTML = S.players.map(card).join('');
    const mode = (S.mode === 'express' ? 'Partie Express' : 'Partie classique') + (S.cfg.teams ? ' · 2 contre 2' : '');
    $('#mode').textContent = mode; $('#round').textContent = `Tour ${S.round}`;
    $('#timer').hidden = !S.endsAt;
  }

  /* ---------------------------------------------------------- barre d'action */
  const abtn = (label, action, cls = '') => `<button class="btn ${cls}" data-act='${esc(JSON.stringify(action))}'>${label}</button>`;
  function renderActions() {
    const bar = $('#actionbar'), p = meP();
    let h = '';
    if (!p) h = `<span class="status">Tu regardes la partie</span>`;
    else if (S.over) h = `<span class="status">Partie terminée</span><button class="btn" id="showOver">Voir le classement</button>`;
    else if (p.bankrupt) h = `<span class="status">Tu as fait faillite. Tu peux suivre la fin de la partie.</span>`;
    else if (S.debts.length) {
      const d = S.debts[0];
      h = d.from === me.id
        ? `<span class="status warn">Il te manque <b>${money(d.amount - p.cash)}</b> pour payer ${money(d.amount)} à ${esc(name(d.to))}</span><button class="btn yellow" data-open="mine">Vendre ou hypothéquer</button>${abtn('Faillite', { type: 'BANKRUPT' }, 'ghost')}`
        : `<span class="status">${esc(name(d.from))} cherche ${money(d.amount)}…</span>`;
    } else if (S.auction) {
      h = `<span class="status">Enchères : ${esc(board.spaces[S.auction.space].name)}</span><button class="btn yellow" data-open="auction">Ouvrir l'enchère</button>`;
    } else if (currentPlayer(S).id === me.id) {
      if (S.phase === 'roll') {
        if (p.inJail && S.turn.rolls === 0) {
          h = `<span class="status">En prison · essai ${p.jailTries + 1}/${S.cfg.maxJailTurns}</span>${abtn('🎲 Tenter un double', { type: 'ROLL' }, 'primary')}`
            + (p.cash >= S.cfg.jailFine ? abtn(`Payer ${money(S.cfg.jailFine)}`, { type: 'PAY_BAIL' }, 'ghost') : '')
            + (p.jailCards.length ? abtn('Utiliser la carte', { type: 'USE_JAIL_CARD' }, 'ghost') : '');
        } else h = `<span class="status">${S.turn.rolls ? 'Double ! Rejoue' : 'À toi de jouer'}</span>${abtn('🎲 Lancer les dés', { type: 'ROLL' }, 'primary')}`;
      } else if (S.phase === 'buy') {
        const sp = board.spaces[S.pendingBuy];
        h = `<span class="status">${esc(sp.name)} · ${money(sp.price)}</span>${abtn('Acheter', { type: 'BUY' }, 'primary' + (p.cash < sp.price ? ' off' : ''))}${abtn(S.cfg.auctionWhenDeclined ? 'Enchères' : 'Ne pas acheter', { type: 'DECLINE' }, 'ghost')}<button class="btn ghost" data-open="buy">Voir le titre</button>`;
      } else if (S.phase === 'end') {
        const out = S.trades.find((t) => t.from === me.id);
        h = out
          ? `<span class="status">En attente de la réponse de ${esc(name(out.to))}…</span>${abtn('Annuler la proposition', { type: 'CANCEL_TRADE', trade: out.id }, 'ghost')}${abtn('Fin du tour ➜', { type: 'END_TURN' }, 'primary')}`
          : `<span class="status">Construis, échange… ou passe la main</span>${abtn('Fin du tour ➜', { type: 'END_TURN' }, 'primary')}`;
      }
    } else {
      const c = currentPlayer(S), wait = S.trades.find((t) => t.from === c.id);
      const left = wait && S.tradeUntil && S.tradeUntil[wait.id] ? ` · <b data-until="${S.tradeUntil[wait.id]}" data-short>…</b>` : '';
      if (wait && wait.to === me.id) h = `<span class="status"><i class="dotc" style="background:${c.color}"></i>${esc(c.name)} attend ta réponse${left}</span><button class="btn yellow" data-open="offer">Voir la proposition</button>`;
      else if (wait) h = `<span class="status"><i class="dotc" style="background:${c.color}"></i>${esc(c.name)} attend la réponse de ${esc(name(wait.to))}${left}</span>`;
      else h = `<span class="status"><i class="dotc" style="background:${c.color}"></i>${esc(c.name)} joue…</span>`;
    }
    bar.innerHTML = h;
    const so = $('#showOver'); if (so) so.onclick = () => openOver();
    const inc = S.trades.filter((t) => t.to === me.id).length;
    $('#tradeBadge').hidden = !inc; $('#tradeBadge').textContent = inc;
    $('#bMine').disabled = $('#bTrade').disabled = !p || p.bankrupt || S.over;
    // les échanges se proposent pendant son tour : en dehors, le bouton sert seulement à lire une proposition reçue
    const can = p && canPropose(S, me.id);
    $('#bTrade').classList.toggle('dim', !!p && !can && !inc);
    $('#bTrade').title = can ? 'Proposer un échange' : inc ? 'Voir la proposition reçue' : 'Les échanges se proposent pendant ton tour';
  }

  // délégation : tout bouton data-act envoie l'action ; data-open ouvre une fenêtre
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b) {
      const a = JSON.parse(b.dataset.act);
      const live = a.type === 'BID' || a.type === 'PASS';
      if (b.classList.contains('off') || (root.classList.contains('busy') && !live)) { sfx.play('error'); return; }
      try { act(a); } catch (err) { console.error(err); }
      if (['BUY', 'DECLINE', 'ACCEPT_TRADE', 'REJECT_TRADE', 'BANKRUPT'].includes(a.type)) M.close(true);
      if (a.type === 'ACCEPT_TRADE' || a.type === 'REJECT_TRADE') B.tradeMarks(null);
      if (a.type === 'BID' || a.type === 'PASS') sfx.play('bid');
      return;
    }
    const o = e.target.closest('[data-open]');
    if (o) {
      const k = o.dataset.open; if (k === 'mine') openMine(); if (k === 'auction') openAuction(true); if (k === 'buy') openBuy(true);
      if (k === 'offer') { const t = S && S.trades.find((x) => x.to === me.id); if (t) { seenAuto.delete('offer:' + t.id); openOffer(t); } }
      return;
    }
    // carte d'un échange : la case clignote sur le plateau
    const pk = e.target.closest('[data-peek]');
    if (pk) { const i = +pk.dataset.peek; B.pulse(i); setTimeout(() => B.pulse(S && S.phase === 'buy' ? S.pendingBuy : -1), 1600); return; }
    const pc = e.target.closest('[data-prop]');
    if (pc) openProperty(+pc.dataset.prop);
  });
  // Espace / Entrée : action principale
  addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !M.key && !/INPUT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) {
      const p = $('#actionbar .primary'); if (p) { e.preventDefault(); p.click(); }
    }
  });

  /* ---------------------------------------------------------- fenêtres */
  function openProperty(i) {
    if (!S) return;
    B.select(i);
    M.open('prop:' + i, propertyHtml(board, S, me, i, name), { cls: 'wide', onClose: () => B.select(-1) });
  }
  function openMine() {
    if (!S || !meP()) return;
    const box = M.open('mine', mineHtml(board, S, me), { cls: 'wide' });
    box.querySelector('#openTrade').onclick = () => openTrade();
  }
  function openBuy(force) {
    if (!S || S.phase !== 'buy' || currentPlayer(S).id !== me.id) return;
    const key = 'buy:' + S.seq;
    if (!force && seenAuto.has('buy:' + S.pendingBuy + ':' + S.turnCount)) return;
    seenAuto.add('buy:' + S.pendingBuy + ':' + S.turnCount);
    B.select(S.pendingBuy);
    M.open(key, buyHtml(board, S, me), { cls: 'wide', onClose: () => B.select(-1) });
  }
  let auctionKey = '', auctionClock = 0;
  function openAuction(force) {
    if (!S || !S.auction) return;
    const k = 'auction:' + S.auction.space + ':' + S.turnCount;
    if (!force && seenAuto.has(k) && !String(M.key).startsWith('auction')) return;
    seenAuto.add(k);
    const box = M.open('auction', auctionHtml(board, S, me, name), { cls: 'wide' });
    wireAuction(box);
  }
  function wireAuction(box) {
    const go = box.querySelector('#bidGo');
    if (go) {
      const send = () => { const v = Math.floor(Number(box.querySelector('#bidIn').value)); if (v > 0) { act({ type: 'BID', amount: v }); sfx.play('bid'); } };
      go.onclick = send;
      box.querySelector('#bidIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    }
    // barre de temps : 12 s depuis la dernière nouvelle offre
    const key = S.auction.bids + ':' + S.auction.passed.length;
    if (key !== auctionKey) { auctionKey = key; auctionClock = performance.now(); }
    const bar = box.querySelector('.timebar i');
    if (bar) bar.style.animation = 'none', void bar.offsetWidth, bar.style.animation = `drain 12s linear ${-(performance.now() - auctionClock) / 1000}s forwards`;
  }
  function openTrade(partner) {
    if (!S || !meP() || meP().bankrupt) return;
    const others = S.players.filter((p) => !p.bankrupt && p.id !== me.id);
    if (!others.length) return;
    if (S.auction) { toast("Attends la fin de l'enchère."); return; }
    if (!canPropose(S, me.id)) {
      const t = S.trades.find((x) => x.to === me.id);
      if (t) { seenAuto.delete('offer:' + t.id); openOffer(t); return; }
      toast('Les échanges se proposent pendant ton tour.'); sfx.play('error'); return;
    }
    // par défaut : le coéquipier en 2 contre 2, sinon le premier adversaire
    partner = partner ?? (others.find((p) => sameTeam(S, me.id, p.id)) || others[0]).id;
    const box = M.open('trade', tradeComposeHtml(board, S, me, partner), { cls: 'wide docked', onClose: () => B.tradeMarks(null) });
    for (const b of box.querySelectorAll('[data-partner]')) b.onclick = () => openTrade(+b.dataset.partner);
    // les terrains cochés sont signalés sur le plateau
    const marks = () => {
      const list = [];
      for (const x of box.querySelectorAll('[data-g]:checked')) list.push({ i: +x.dataset.g, kind: 'give', label: 'Tu donnes' });
      for (const x of box.querySelectorAll('[data-w]:checked')) list.push({ i: +x.dataset.w, kind: 'get', label: 'Tu reçois' });
      B.tradeMarks(list);
    };
    box.addEventListener('change', marks); marks();
    // l'argent proposé s'affiche en billet
    box.addEventListener('input', (e) => {
      if (!/^(g|w)Cash$/.test(e.target.id)) return;
      const v = Math.max(0, Math.floor(Number(e.target.value) || 0)), old = e.target.parentElement.querySelector('[data-bill]');
      if (old) old.outerHTML = billHtml(v, v ? '' : ' empty');
    });
    box.querySelector('#tSend').onclick = () => {
      const pick = (k) => [...box.querySelectorAll(`[data-${k}]:checked`)].map((x) => +x.dataset[k]);
      const mine = meP(), them = S.players.find((p) => p.id === partner);
      const g = { props: pick('g'), cash: Number(box.querySelector('#gCash').value) || 0, cards: box.querySelector('#gCard')?.checked ? [mine.jailCards[0]] : [] };
      const w = { props: pick('w'), cash: Number(box.querySelector('#wCash').value) || 0, cards: box.querySelector('#wCard')?.checked ? [them.jailCards[0]] : [] };
      act({ type: 'PROPOSE_TRADE', to: partner, give: g, want: w });
      M.close(true); B.tradeMarks(null);
      toast('Proposition envoyée à ' + them.name);
    };
  }
  function offerMarks(t) {
    return [...t.give.props.map((i) => ({ i, kind: 'get', label: 'Tu reçois' })), ...t.want.props.map((i) => ({ i, kind: 'give', label: 'Tu donnes' }))];
  }
  function openOffer(t) {
    if (seenAuto.has('offer:' + t.id)) return;
    seenAuto.add('offer:' + t.id);
    M.open('offer:' + t.id, offerHtml(board, S, t, name), { cls: 'wide docked', onClose: () => B.tradeMarks(null) });
    B.tradeMarks(offerMarks(t));
  }
  function openOver() {
    const box = M.open('over', overHtml(board, S, name), { cls: 'wide', closable: true });
    box.querySelector('#backHub').onclick = exit;
    box.querySelector('#overStats').onclick = () => openStatsWin();
  }

  // fenêtres qui s'ouvrent d'elles-mêmes selon la situation
  function autoModals() {
    if (S.over) { if (M.key !== 'over' && !seenAuto.has('over')) { seenAuto.add('over'); openOver(); } return; }
    if (S.auction) {
      if (String(M.key).startsWith('auction')) { const box = M.open('auction', auctionHtml(board, S, me, name), { cls: 'wide' }); wireAuction(box); }
      else openAuction(false);
      return;
    }
    if (String(M.key).startsWith('auction')) M.close(true);
    if (S.phase === 'buy' && currentPlayer(S).id === me.id && !S.debts.length) { openBuy(false); return; }
    const t = S.trades.find((x) => x.to === me.id && !seenAuto.has('offer:' + x.id));
    if (t && !M.key) { openOffer(t); return; }
    // une fenêtre de bien ouverte se met à jour avec l'état
    const k = String(M.key || '');
    if (k.startsWith('prop:')) M.open(k, propertyHtml(board, S, me, +k.slice(5), name), { cls: 'wide', onClose: () => B.select(-1) });
    else if (k === 'mine') openMine();
    else if (k.startsWith('offer:') && !S.trades.some((x) => 'offer:' + x.id === k)) { M.close(true); B.tradeMarks(null); }
    else if (k.startsWith('watch:') && !S.trades.some((x) => 'watch:' + x.id === k) && !ended.has(+k.slice(6))) { M.close(true); B.tradeMarks(null); }
    else if (k === 'trade' && !canPropose(S, me.id)) { M.close(true); B.tradeMarks(null); }
    else if (k.startsWith('buy') && S.phase !== 'buy') M.close(true);
  }

  /* ---------------------------------------------------------- échanges des autres, en direct */
  // Chaque proposition entre deux autres joueurs apparaît dans un fil à droite, avec son contenu et son compte à rebours ;
  // un clic l'ouvre en lecture seule avec les terrains signalés sur le plateau. Le résultat reste affiché quelques secondes.
  const ended = new Map(); // id → { t, result, until }
  let feedFlash = null;
  const tradeById = (id) => (S && S.trades.find((x) => x.id === id)) || null;
  function endTrade(t, result) {
    if (!t || t.from === me.id || t.to === me.id) return;
    ended.set(t.id, { t, result, until: Date.now() + 4000 });
    if (String(M.key) === 'watch:' + t.id) {
      const msg = { done: 'Échange accepté ✓', rejected: 'Échange refusé', expired: 'Proposition expirée', cancelled: 'Proposition retirée' }[result];
      const h = root.querySelector('.modal h2'); if (h) h.textContent = msg;
      setTimeout(() => { if (String(M.key) === 'watch:' + t.id) { M.close(true); B.tradeMarks(null); } }, 1600);
    }
    setTimeout(renderFeed, 4100);
  }
  function renderFeed() {
    if (!S) return;
    const now = Date.now();
    for (const [id, x] of ended) if (x.until < now) ended.delete(id);
    const live = S.over ? [] : S.trades.filter((t) => t.from !== me.id && t.to !== me.id).map((t) => ({ t, result: null }));
    const done = [...ended.values()].filter((x) => !live.some((l) => l.t.id === x.t.id));
    const list = [...live, ...done].slice(0, 3);
    const RES = { done: ['ok', 'accepté ✓'], rejected: ['ko', 'refusé ✗'], expired: ['ko', 'expiré'], cancelled: ['ko', 'retiré'] };
    $('#tradeFeed').innerHTML = list.map(({ t, result }) => {
      const r = result && RES[result];
      const until = !result && S.tradeUntil && S.tradeUntil[t.id];
      return `<button class="tfcard${r ? ' ' + r[0] : ''}${feedFlash === t.id ? ' new' : ''}" data-watch="${t.id}" ${r ? 'disabled' : ''} title="${r ? '' : 'Regarder cet échange'}">
        <span class="tfh"><i class="dotc" style="background:${color(t.from)}"></i><b>${esc(name(t.from))}</b><span class="arr">→</span><i class="dotc" style="background:${color(t.to)}"></i><b>${esc(name(t.to))}</b>
          <em>${r ? r[1] : until ? `<span data-until="${until}" data-short>…</span>` : 'en attente'}</em></span>
        <span class="tfrow"><small>donne</small>${tradeChips(board, t.give)}</span>
        <span class="tfrow"><small>contre</small>${tradeChips(board, t.want)}</span></button>`;
    }).join('');
    feedFlash = null;
  }
  function openWatch(id) {
    const t = tradeById(id); if (!t) return;
    M.open('watch:' + id, watchHtml(board, S, t, name), { cls: 'wide docked', onClose: () => B.tradeMarks(null) });
    B.tradeMarks([...t.give.props.map((i) => ({ i, kind: 'done', label: '→ ' + name(t.to), color: color(t.to) })),
      ...t.want.props.map((i) => ({ i, kind: 'done', label: '→ ' + name(t.from), color: color(t.from) }))]);
    tickTimer();
  }
  $('#tradeFeed').addEventListener('click', (e) => { const b = e.target.closest('[data-watch]'); if (b && !b.disabled) openWatch(+b.dataset.watch); });

  /* ---------------------------------------------------------- application d'un état */
  function apply(state) {
    S = state;
    $('#bChat').hidden = !(S.cfg && S.cfg.teams);
    if (!(S.cfg && S.cfg.teams)) chatBox.hidden = true;
    if (M.key === 'wait') M.close(true);
    for (const p of S.players) cash[p.id] = p.cash;
    B.sync(S);
    B.setCurrent(S.over ? null : currentPlayer(S).id);
    B.pulse(S.phase === 'buy' ? S.pendingBuy : -1);
    renderRoster(); renderActions(); autoModals(); renderFeed(); tickTimer();
    if (heatMode) paintHeat();
    music.setMood(moodOf(S));
    music.duck(S.over);
    if (statsCtl && M.key === 'stats') statsCtl.refresh();
  }

  /* ---------------------------------------------------------- mise en scène */
  async function play(e, speed, next) {
    const nm = (id) => { const p = next.players.find((q) => q.id === id); return p ? p.name : 'la banque'; };
    const col = (id) => { const p = next.players.find((q) => q.id === id); return p ? p.color : '#16181d'; };
    log(e);
    const quick = speed > 3;
    switch (e.k) {
      case 'TURN':
        // caméra qui suit : elle va directement sur le pion du joueur suivant ; sinon vue d'ensemble
        // au début de son propre tour, la caméra qui suit reprend même si on avait déplacé la vue
        if (e.player === me.id && B.resumeFollow) B.resumeFollow();
        B.setCurrent(e.player); if (B.follow()) B.focusPawn(e.player, speed); else B.relax();
        $('#diceread').hidden = true;
        S && renderRosterCur(e.player);
        if (!quick) { sfx.play('turn'); await F.banner(e.player === me.id ? 'À toi de jouer !' : `Au tour de ${nm(e.player)}`, `Tour ${e.round}`, col(e.player), 900 / speed); }
        break;
      case 'DICE':
        if (!quick) sfx.play('dice');
        await (B.rollDice ? B.rollDice(e.dice, speed, e.player) : D.roll(e.dice, speed));
        diceRead(e, col(e.player));
        if (e.dice[0] === e.dice[1] && !e.reason && !quick) { const pt = B.pawnScreen(e.player); if (pt) F.float(pt.x, pt.y - 30, 'DOUBLE !', 'gold'); }
        break;
      case 'MOVE':
        await B.hop(e.player, e.steps, speed);
        break;
      case 'LAND': break;
      case 'PAY': {
        const a = e.from != null ? cardPoint(e.from) : (e.reason === 'go' ? B.cellScreen(0) : e.reason === 'jackpot' ? B.cellScreen(20) : bankPoint());
        const b = e.to != null ? cardPoint(e.to) : (e.pot ? B.cellScreen(20) : bankPoint());
        if (e.reason === 'jackpot' && !quick) await F.banner('Cagnotte !', `${nm(e.to)} empoche ${money(e.amount)}`, '#2fbf71', 1100 / speed);
        if (e.from != null) { setCash(e.from, (cash[e.from] ?? 0) - e.amount, !quick); if (!quick && a) F.float(a.x, a.y, '−' + money(e.amount), 'minus'); }
        if (e.to != null) { setCash(e.to, (cash[e.to] ?? 0) + e.amount, !quick); }
        if (quick) break;
        if (e.reason === 'go') { const c = B.cellScreen(0); F.float(c.x, c.y, '+' + money(e.amount), 'plus'); }
        sfx.play(e.to != null ? 'coin' : 'pay');
        const big = ['rent', 'go', 'card', 'trade', 'tax', 'buy', 'auction', 'jackpot', 'bail'].includes(e.reason);
        if (big) await F.bills(a, b, e.amount, speed);
        if (e.to != null && b) F.float(b.x, b.y, '+' + money(e.amount), 'plus');
        break;
      }
      case 'CARD':
        if (B.drawCard) B.drawCard(e.deck);
        if (!quick) { sfx.play('card'); await F.card(e.deck, e.text, speed); }
        break;
      case 'APPARITION':
        if (!quick) { sfx.play('apparition'); F.banner('Apparition !', 'Sylvain Durif trône au milieu du plateau', '#b45cff', 1500 / speed); }
        if (B.apparition) await B.apparition(true, !quick);
        break;
      case 'APPARITION_END':
        if (B.apparition) await B.apparition(false, !quick);
        break;
      case 'SPEEDING':
        if (!quick) await F.banner('Trois doubles !', 'Excès de vitesse sur la voie Mathis', '#e3262f', 1000 / speed);
        break;
      case 'JAIL':
        if (!quick) sfx.play('jail');
        await B.slide(e.player, 10, true, speed);
        if (!quick) await F.banner(`${nm(e.player)} va en prison`, '', '#F7941D', 900 / speed);
        break;
      case 'JAIL_OUT': {
        const pt = B.pawnScreen(e.player); if (pt && !quick) F.float(pt.x, pt.y - 20, 'Libéré !', 'gold');
        await B.slide(e.player, 10, false, speed * 2);
        break;
      }
      case 'BUY': case 'GIFT': {
        B.markOwner(e.space, col(e.player));
        if (quick) break;
        const p = B.cellScreen(e.space), sp = board.spaces[e.space];
        sfx.play('buy'); F.burst(p.x, p.y, col(e.player)); F.stamp(p.x, p.y, e.k === 'GIFT' ? 'OFFERT' : 'VENDU', col(e.player));
        await F.deed(p, cardPoint(e.player), sp.color || '#2b2f3a', sp.name, e.k === 'GIFT' ? speed * 2 : speed);
        break;
      }
      case 'AUCTION_START':
        if (!quick) { await F.banner('Enchères !', next.players ? board.spaces[e.space].name : '', '#1C5FB4', 900 / speed); }
        break;
      case 'BID': if (!quick) sfx.play('bid'); break;
      case 'AUCTION_END': {
        if (e.winner == null || quick) break;
        B.markOwner(e.space, col(e.winner));
        const p = B.cellScreen(e.space); sfx.play('buy'); F.stamp(p.x, p.y, 'ADJUGÉ', col(e.winner)); F.burst(p.x, p.y, col(e.winner));
        await wait(700 / speed);
        break;
      }
      case 'BUILD': {
        B.sync(next, { animateBuild: !quick });
        if (quick) break;
        sfx.play('build');
        const p = B.cellScreen(e.space); F.burst(p.x, p.y, e.hotel ? '#e3262f' : '#2fbf71', 8);
        await wait(450 / speed);
        break;
      }
      case 'SELL': case 'MORTGAGE': case 'UNMORTGAGE': {
        B.sync(next);
        if (quick) break;
        const p = B.cellScreen(e.space);
        F.stamp(p.x, p.y, e.k === 'MORTGAGE' ? 'HYPOTHÉQUÉE' : e.k === 'UNMORTGAGE' ? 'LEVÉE' : 'VENDU', e.k === 'MORTGAGE' ? '#6d675c' : '#2fbf71');
        sfx.play('pay');
        await wait(350 / speed);
        break;
      }
      case 'TRADE_OFFER':
        if (e.trade.to === me.id) sfx.play('card');
        else if (e.trade.from !== me.id && !quick) { sfx.play('bid'); feedFlash = e.trade.id; }
        break;
      case 'TRADE_DONE': {
        endTrade(e.trade, 'done');
        if (quick) break;
        sfx.play('buy');
        // tout le monde voit sur le plateau ce qui a changé de main
        const t = e.trade, moved = [...t.give.props.map((i) => ({ i, to: t.to })), ...t.want.props.map((i) => ({ i, to: t.from }))];
        B.sync(next);
        B.tradeMarks(moved.map((m) => ({ i: m.i, kind: 'done', label: '→ ' + nm(m.to), color: col(m.to) })));
        for (const m of moved) { const c = B.cellScreen(m.i); F.stamp(c.x, c.y, 'ÉCHANGÉ', col(m.to)); }
        await F.banner('Échange conclu', `${nm(t.from)} ⇄ ${nm(t.to)}`, '#2fbf71', 900 / speed);
        setTimeout(() => { if (!String(M.key || '').match(/^(offer|trade)/)) B.tradeMarks(null); }, 2600);
        break;
      }
      case 'NO_RENT': {
        if (quick) break;
        const c = B.cellScreen(e.space); F.float(c.x, c.y - 10, 'Coéquipier : pas de loyer', 'gold');
        await wait(500 / speed);
        break;
      }
      case 'TRADE_REJECTED': {
        const t = tradeById(e.trade); if (t) endTrade(t, 'rejected');
        if (t && t.from === me.id && !quick) toast(`${nm(e.by)} refuse ton échange`);
        break;
      }
      case 'TRADE_CANCELLED': { const t = tradeById(e.trade); if (t) endTrade(t, e.reason === 'turn' ? 'expired' : 'cancelled'); break; }
      case 'DEBT':
        if (e.from === me.id && !quick) await F.banner('Il te manque de l\'argent', `Tu dois ${money(e.amount)}`, '#e3262f', 1000 / speed);
        break;
      case 'BOT': case 'HOST_CHANGED': {
        const t2 = describe(e); if (t2) toast(t2);
        break;
      }
      case 'BANKRUPT':
        sfx.play('bankrupt');
        if (!quick) await F.banner(`${nm(e.player)} fait faillite`, '', '#16181d', 1200 / speed);
        break;
      case 'GAME_OVER':
        if (e.team != null) F.banner(`${TEAM_NAMES[e.team]} l'emporte !`, '', '#2fbf71', 1600);
        if (music.on) music.win(); else sfx.play('win');
        F.confetti();
        break;
      default: break;
    }
  }
  function renderRosterCur(id) {
    for (const c of root.querySelectorAll('.pcard-hud')) c.classList.toggle('cur', +c.dataset.pid === id);
  }

  async function run() {
    if (playing) return;
    playing = true; root.classList.add('busy');
    while (queue.length) {
      const it = queue.shift();
      const backlog = queue.length;
      const speed = backlog >= 6 ? 8 : backlog >= 3 ? 3 : backlog >= 1 ? 1.7 : 1;
      if (String(M.key).startsWith('buy')) M.close(true); // une proposition d'échange reste ouverte tant qu'elle existe
      for (const e of it.events) {
        try { await play(e, speed, it.state); } catch (err) { console.error(err); }
      }
      apply(it.state);
    }
    playing = false; root.classList.remove('busy');
    // la caméra qui suit reste sur le pion jusqu'au tour suivant
    setTimeout(() => { if (!playing && !B.follow()) B.relax(); }, 900);
  }

  /* ---------------------------------------------------------- chrono */
  function tickTimer() {
    // comptes à rebours des propositions d'échange
    for (const e of root.querySelectorAll('[data-until]')) {
      const left = Math.max(0, +e.dataset.until - (Date.now() + offset)), sec = Math.ceil(left / 1000);
      const txt = sec >= 60 ? '1 min' : `${sec} s`;
      if (e.hasAttribute('data-short')) e.textContent = txt;
      else {
        const l = e.querySelector('[data-left]'); if (l) l.textContent = txt;
        const bar = e.querySelector('.tbar i'); if (bar) bar.style.width = (100 * left / (+e.dataset.total || 60000)) + '%';
      }
      e.classList.toggle('hot', left < 15000);
    }
    if (!S || !S.endsAt) return;
    const left = Math.max(0, S.endsAt - (Date.now() + offset));
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    const t = $('#timer'); t.textContent = `⏱ ${m}:${String(s).padStart(2, '0')}`; t.classList.toggle('hot', left < 5 * 60000);
  }
  setInterval(tickTimer, 250);

  // lecture des dés : la somme jouée reste affichée jusqu'au tour suivant (les dés 3D se lisent mal de biais)
  function diceRead(e, c) {
    const box = $('#diceread'), d = e.dice, dbl = d[0] === d[1];
    box.innerHTML = `<i class="dc" style="background:${c}"></i>${e.reason === 'utility' ? 'Relance compagnie : ' : ''}<b>${d[0]}</b> + <b>${d[1]}</b> = <strong>${d[0] + d[1]}</strong>${dbl && !e.reason ? '<em>double</em>' : ''}`;
    box.hidden = false; box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
  }

  let toastT = 0;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200);
  }

  return {
    update(state, events, off) {
      offset = off || 0;
      if (first || !events.length) {
        const wasFirst = first; first = false;
        if (!playing && !queue.length) {
          SU.hide();
          apply(state);
          const resumed = events.find((e) => e.k === 'RESUMED');
          if (wasFirst && resumed) {
            F.banner('Partie reprise', `Tour ${state.round} · bon retour à Nice !`, '#1C5FB4', 1600);
            logLines.push({ t: `Partie reprise au tour ${state.round}`, turn: true });
          } else if (wasFirst) {
            B.intro();
            for (const e of events) log(e);
            F.banner(state.mode === 'express' ? 'Partie Express' : 'Partie classique', 'Bonne chance à Nice !', '#e3262f', 1500);
            if (events.some((e) => e.k === 'GIFT')) toast('Mode Express : 3 propriétés offertes à chacun');
          }
          return;
        }
      }
      queue.push({ state, events });
      run();
    },
    setup(s) { if (!S) SU.render(s); },
    toast(msg) { sfx.play('error'); toast(msg); },
    board: B, // tests (?debug)
    emote(from, id) { showEmote(from, id); },
    chat(m) { showChat(m); },
  };
}
