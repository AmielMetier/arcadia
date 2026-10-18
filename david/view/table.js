// Vue provisoire de DavidSimulator (étape 2) : plateau en grille, panneau d'actions, échanges, journal.
// Elle sera remplacée à l'étape 3 par le plateau isométrique animé ; elle permet déjà de jouer en ligne.
import { availableActions, currentPlayer, actors } from '../engine/rules.js';
import { netWorth, ownsGroup, level, groupHasBuildings, ownedBy, isOwnable, standings } from '../engine/valuation.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// position (ligne, colonne) de chaque case sur une grille 11 × 11, Départ en bas à droite
function cellPos(i) {
  if (i <= 10) return [11, 11 - i];
  if (i <= 20) return [11 - (i - 10), 1];
  if (i <= 30) return [1, 1 + (i - 20)];
  return [1 + (i - 30), 11];
}
const side = (i) => (i % 10 === 0 ? 'corner' : i < 10 ? 'bottom' : i < 20 ? 'left' : i < 30 ? 'top' : 'right');
const ICON = { go: '➜', jail: '▦', parking: '🅿', gotojail: '👮', chance: '?', chest: '✦', tax: '€', station: '🚉', utility: '💧' };

export function mountTable(root, board, { me, act, exit, isHost }) {
  root.className = '';
  root.innerHTML = `
    <div class="table">
      <div class="boardwrap"><div class="board" id="board">
        <div class="center">
          <div class="brand"><b>David</b><span>Simulator</span><small>Édition Nice</small></div>
          <div class="dice" id="dice" aria-live="polite"></div>
          <div class="cardbox" id="cardbox" hidden></div>
          <ol class="log" id="log"></ol>
        </div>
      </div></div>
      <aside class="side">
        <header class="top"><div><b id="mode"></b><small id="round"></small></div><div class="timer" id="timer" hidden></div>
          <button class="btn small ghost" id="quit">Quitter</button></header>
        <section class="players" id="players"></section>
        <section class="panel" id="panel"></section>
        <section class="panel" id="detail" hidden></section>
        <section class="panel" id="mine"></section>
        <section class="panel" id="trades"></section>
      </aside>
    </div>
    <div class="overlay" id="overlay" hidden></div>
    <div class="toast" id="toast" hidden role="status"></div>`;
  const $ = (s) => root.querySelector(s);
  const boardEl = $('#board');
  let S = null, offset = 0, selected = null, tradeOpen = false;
  const logLines = [];

  // cases
  for (const sp of board.spaces) {
    const [r, c] = cellPos(sp.i);
    const el = document.createElement('button');
    el.className = `cell s-${side(sp.i)} t-${sp.type}`;
    el.style.gridRow = r; el.style.gridColumn = c;
    el.dataset.i = sp.i;
    const stripe = sp.type === 'street' ? `<i class="stripe" style="background:${sp.color}"></i>` : '';
    const icon = ICON[sp.type] ? `<em class="ic">${ICON[sp.type]}</em>` : '';
    const price = sp.price ? `<small class="pr">${money(sp.price)}</small>` : sp.amount ? `<small class="pr">−${money(sp.amount)}</small>` : '';
    el.innerHTML = `${stripe}<span class="nm">${icon}${esc(sp.name)}</span>${price}<span class="bld"></span><span class="tok"></span>`;
    el.title = sp.name;
    el.onclick = () => { selected = sp.i; renderDetail(); };
    boardEl.appendChild(el);
  }
  $('#quit').onclick = () => { if (!S || S.over || confirm('Quitter la partie ?')) exit(); };

  const name = (id) => { const p = S && S.players.find((q) => q.id === id); return p ? p.name : 'la banque'; };
  const spName = (i) => board.spaces[i].name;
  const meP = () => S && S.players.find((p) => p.id === me.id);

  /* -------------------------------------------------------------- journal */
  function describe(e) {
    switch (e.k) {
      case 'TURN': return `— Au tour de ${name(e.player)}`;
      case 'DICE': return e.reason === 'utility' ? `${name(e.player)} relance les dés : ${e.dice[0]} + ${e.dice[1]}` : `${name(e.player)} lance ${e.dice[0]} + ${e.dice[1]}${e.dice[0] === e.dice[1] ? ' (double !)' : ''}`;
      case 'LAND': return `${name(e.player)} arrive sur ${spName(e.space)}`;
      case 'PAY':
        if (e.reason === 'rent') return `${name(e.from)} paie ${money(e.amount)} de loyer à ${name(e.to)}`;
        if (e.reason === 'go') return `${name(e.to)} touche ${money(e.amount)} en passant par Départ`;
        if (e.reason === 'tax') return `${name(e.from)} paie ${money(e.amount)} de taxe`;
        if (e.reason === 'bail') return `${name(e.from)} paie ${money(e.amount)} de caution`;
        if (e.reason === 'card') return e.from == null ? `${name(e.to)} reçoit ${money(e.amount)}` : `${name(e.from)} paie ${money(e.amount)}${e.to != null ? ' à ' + name(e.to) : ''}`;
        if (e.reason === 'interest') return `${name(e.from)} paie ${money(e.amount)} d'intérêts`;
        if (e.reason === 'trade' || e.reason === 'bankrupt') return null;
        return null;
      case 'CARD': return `${e.deck === 'chance' ? 'Chance' : 'Caisse de communauté'} — ${e.text}`;
      case 'JAIL': return `${name(e.player)} va en prison`;
      case 'SPEEDING': return `Trois doubles d'affilée : ${name(e.player)} file en prison`;
      case 'JAIL_OUT': return `${name(e.player)} sort de prison${e.how === 'doubles' ? ' grâce à un double' : e.how === 'card' ? ' avec sa carte' : ''}`;
      case 'BUY': return `${name(e.player)} achète ${spName(e.space)} pour ${money(e.price)}`;
      case 'GIFT': return `${name(e.player)} reçoit ${spName(e.space)}`;
      case 'AUCTION_START': return `Enchères pour ${spName(e.space)}`;
      case 'BID': return `${name(e.player)} offre ${money(e.amount)}`;
      case 'PASS': return `${name(e.player)} passe`;
      case 'AUCTION_END': return e.winner != null ? `${name(e.winner)} remporte ${spName(e.space)} pour ${money(e.amount)}` : `Personne ne veut de ${spName(e.space)}`;
      case 'BUILD': return `${name(e.player)} construit ${e.hotel ? 'un hôtel' : 'une maison'} sur ${spName(e.space)}`;
      case 'SELL': return `${name(e.player)} vend un bâtiment sur ${spName(e.space)}`;
      case 'MORTGAGE': return `${name(e.player)} hypothèque ${spName(e.space)}`;
      case 'UNMORTGAGE': return `${name(e.player)} lève l'hypothèque de ${spName(e.space)}`;
      case 'TRADE_OFFER': return `${name(e.trade.from)} propose un échange à ${name(e.trade.to)}`;
      case 'TRADE_DONE': return `Échange conclu entre ${name(e.trade.from)} et ${name(e.trade.to)}`;
      case 'TRADE_REJECTED': return `${name(e.by)} refuse l'échange`;
      case 'DEBT': return `${name(e.from)} doit ${money(e.amount)} et n'a pas assez de liquide`;
      case 'BANKRUPT': return `${name(e.player)} fait faillite${e.creditor != null ? ' au profit de ' + name(e.creditor) : ''}`;
      case 'GAME_OVER': return `Fin de partie : ${name(e.winner)} l'emporte !`;
      default: return null;
    }
  }

  /* -------------------------------------------------------------- rendu */
  function renderBoard() {
    for (const el of boardEl.querySelectorAll('.cell')) {
      const i = +el.dataset.i, pr = S.props[i];
      el.classList.toggle('sel', selected === i);
      if (pr) {
        const owner = S.players.find((p) => p.id === pr.owner);
        el.style.setProperty('--own', owner ? owner.color : 'transparent');
        el.classList.toggle('owned', !!owner);
        el.classList.toggle('mort', pr.mortgaged);
        el.querySelector('.bld').innerHTML = pr.hotel ? '<i class="hotel"></i>' : '<i class="house"></i>'.repeat(pr.houses);
      }
      const here = S.players.filter((p) => !p.bankrupt && p.pos === i);
      el.querySelector('.tok').innerHTML = here.map((p) =>
        `<i class="pawn${currentPlayer(S).id === p.id ? ' cur' : ''}${p.inJail ? ' jailed' : ''}" style="background:${p.color}" title="${esc(p.name)}">${esc(p.name[0] || '?')}</i>`).join('');
    }
    const d = S.turn.dice;
    $('#dice').innerHTML = d ? `<span>${DIE[d[0]]}</span><span>${DIE[d[1]]}</span>` : '<span class="off">⚀</span><span class="off">⚀</span>';
  }

  function renderPlayers() {
    const cur = currentPlayer(S).id;
    $('#players').innerHTML = S.players.map((p) => {
      const w = netWorth(S, board, p.id);
      return `<div class="pl${p.id === cur && !S.over ? ' cur' : ''}${p.bankrupt ? ' out' : ''}">
        <i class="dot" style="background:${p.color}"></i>
        <span class="nm">${esc(p.name)}${p.id === me.id ? ' <small>(toi)</small>' : ''}${p.bot ? ' <small>bot</small>' : ''}${p.inJail ? ' <small class="jl">prison</small>' : ''}</span>
        <span class="cash">${money(p.cash)}</span>
        <small class="worth" title="Patrimoine net · monopoles">${money(w.total)} · ${w.monopolies}♛</small>
      </div>`;
    }).join('');
    const mode = S.mode === 'express' ? 'Partie Express' : 'Partie classique';
    $('#mode').textContent = mode;
    $('#round').textContent = ` · tour ${S.round}`;
    $('#timer').hidden = !S.endsAt;
  }

  function btn(label, action, cls = '') { return `<button class="btn ${cls}" data-act='${esc(JSON.stringify(action))}'>${esc(label)}</button>`; }

  function renderPanel() {
    const p = meP(), panel = $('#panel');
    const keepBid = panel.querySelector('#bidIn') ? panel.querySelector('#bidIn').value : '';
    if (!p) { panel.innerHTML = '<p class="muted">Tu regardes la partie.</p>'; return; }
    if (S.over) { panel.innerHTML = '<p class="muted">Partie terminée.</p>'; return; }
    const can = availableActions(S, board, me.id);
    const cur = currentPlayer(S);
    let h = '';
    if (S.auction) {
      const a = S.auction, sp = board.spaces[a.space];
      h += `<h3>Enchères : ${esc(sp.name)}</h3><p>Prix affiché ${money(sp.price)} · meilleure offre <b>${a.bidder != null ? money(a.high) + ' (' + esc(name(a.bidder)) + ')' : 'aucune'}</b></p>`;
      if (can.includes('BID')) {
        h += `<div class="row">${[10, 50, 100].map((n) => btn('+' + n, { type: 'BID', amount: a.high + n }, 'small yellow')).join('')}
          <input type="number" id="bidIn" min="${a.high + 1}" step="1" placeholder="${a.high + 1}" value="${esc(keepBid)}"><button class="btn small" id="bidGo">Offrir</button></div>`;
        if (can.includes('PASS')) h += btn('Passer', { type: 'PASS' }, 'ghost small');
        else h += '<p class="muted">Tu as la meilleure offre.</p>';
      } else h += '<p class="muted">Tu ne participes plus à cette enchère.</p>';
      h += '<p class="muted small">Clôture après 12 s sans nouvelle offre.</p>';
    } else if (S.debts.length) {
      const d = S.debts[0];
      if (d.from === me.id) {
        h += `<h3>Il te manque ${money(d.amount - p.cash)}</h3><p>Tu dois ${money(d.amount)} à ${esc(name(d.to))}. Vends des bâtiments, hypothèque ou propose un échange : la dette se règle dès que tu as la somme.</p>`;
        h += btn('Déclarer faillite', { type: 'BANKRUPT' }, 'ghost');
      } else h += `<p class="muted">${esc(name(d.from))} cherche ${money(d.amount)} pour payer sa dette…</p>`;
    } else if (cur.id === me.id) {
      if (S.phase === 'roll') {
        h += `<h3>À toi de jouer${S.turn.rolls ? ' (double, rejoue)' : ''}</h3>`;
        if (p.inJail) h += `<p>Tu es en prison (essai ${p.jailTries + 1}/${S.cfg.maxJailTurns}).</p>`;
        h += btn(p.inJail ? 'Tenter un double' : 'Lancer les dés', { type: 'ROLL' }, 'big');
        if (can.includes('PAY_BAIL')) h += btn(`Payer ${money(S.cfg.jailFine)}`, { type: 'PAY_BAIL' }, 'ghost');
        if (can.includes('USE_JAIL_CARD')) h += btn('Utiliser la carte', { type: 'USE_JAIL_CARD' }, 'ghost');
      } else if (S.phase === 'buy') {
        const sp = board.spaces[S.pendingBuy];
        h += `<h3>${esc(sp.name)} est à vendre</h3><p>Prix : <b>${money(sp.price)}</b> · tu as ${money(p.cash)}</p>`;
        h += btn('Acheter', { type: 'BUY' }, 'big') + btn('Mettre aux enchères', { type: 'DECLINE' }, 'ghost');
        selected = S.pendingBuy;
      } else if (S.phase === 'end') {
        h += '<h3>Ton tour se termine</h3><p class="muted">Construis, hypothèque ou échange avant de passer la main.</p>';
        h += btn('Fin du tour', { type: 'END_TURN' }, 'big');
      }
    } else {
      h += `<p class="muted">${cur.bot ? 'Le bot' : ''} ${esc(cur.name)} joue…</p>`;
    }
    panel.innerHTML = h;
    const go = panel.querySelector('#bidGo');
    if (go) go.onclick = () => { const v = Math.floor(Number(panel.querySelector('#bidIn').value)); if (v > 0) act({ type: 'BID', amount: v }); };
  }

  function rentLine(sp) {
    if (sp.type === 'street') {
      const lbl = ['Terrain nu', '1 maison', '2 maisons', '3 maisons', '4 maisons', 'Hôtel'];
      const hph = S.cfg.housesPerHotel;
      return sp.rent.map((r, k) => (k > hph && k < 5 ? '' : `<tr><td>${lbl[k]}</td><td>${money(r)}</td></tr>`)).join('');
    }
    if (sp.type === 'station') return sp.rent.map((r, k) => `<tr><td>${k + 1} pôle${k ? 's' : ''}</td><td>${money(r)}</td></tr>`).join('');
    return `<tr><td>1 compagnie</td><td>4 × les dés</td></tr><tr><td>2 compagnies</td><td>10 × les dés</td></tr>`;
  }

  function renderDetail() {
    const box = $('#detail');
    if (selected == null || !S) { box.hidden = true; return; }
    const sp = board.spaces[selected];
    box.hidden = false;
    if (!isOwnable(sp)) {
      box.innerHTML = `<h3>${esc(sp.name)}</h3><button class="x" aria-label="Fermer">×</button>`;
    } else {
      const pr = S.props[selected], mine = pr.owner === me.id;
      const lv = pr.hotel ? 'hôtel' : pr.houses ? pr.houses + ' maison' + (pr.houses > 1 ? 's' : '') : '';
      let h = `<button class="x" aria-label="Fermer">×</button><h3><i class="chip" style="background:${sp.color}"></i>${esc(sp.name)}</h3>
        <p class="muted">${esc(board.groups[sp.group].name)}${sp.district ? ' · ' + esc(sp.district) : ''}</p>
        <table class="rents">${rentLine(sp)}</table>
        <p class="small">Prix ${money(sp.price)} · hypothèque ${money(sp.mortgage)}${sp.houseCost ? ' · maison ' + money(sp.houseCost) : ''}</p>
        <p>Propriétaire : <b>${pr.owner == null ? 'la banque' : esc(name(pr.owner))}</b>${lv ? ' · ' + lv : ''}${pr.mortgaged ? ' · <b>hypothéquée</b>' : ''}</p>`;
      if (mine && !S.over) {
        const can = availableActions(S, board, me.id);
        const row = [];
        if (can.includes('BUILD') && sp.type === 'street' && ownsGroup(S, board, me.id, sp.group) && !pr.hotel) {
          row.push(btn(pr.houses === S.cfg.housesPerHotel ? 'Construire un hôtel' : 'Construire une maison', { type: 'BUILD', space: selected }, 'small'));
        }
        if (can.includes('SELL_BUILDING') && level(S, selected) > 0) row.push(btn('Vendre un bâtiment', { type: 'SELL_BUILDING', space: selected }, 'small ghost'));
        if (can.includes('MORTGAGE') && !pr.mortgaged) row.push(btn(`Hypothéquer (+${money(sp.mortgage)})`, { type: 'MORTGAGE', space: selected }, 'small ghost'));
        if (can.includes('UNMORTGAGE') && pr.mortgaged) row.push(btn(`Lever (−${money(sp.mortgage + Math.ceil(sp.mortgage * S.cfg.mortgageInterest))})`, { type: 'UNMORTGAGE', space: selected }, 'small ghost'));
        if (row.length) h += `<div class="row wrap">${row.join('')}</div>`;
      }
      box.innerHTML = h;
    }
    box.querySelector('.x').onclick = () => { selected = null; renderDetail(); renderBoard(); };
    renderBoard();
  }

  function renderMine() {
    const mine = ownedBy(S, board, me.id);
    const p = meP();
    $('#mine').innerHTML = `<h3>Tes propriétés</h3>` + (mine.length
      ? `<div class="chips">${mine.map((i) => { const sp = board.spaces[i], pr = S.props[i];
          return `<button class="pchip${pr.mortgaged ? ' mort' : ''}" data-sel="${i}"><i style="background:${sp.color}"></i>${esc(sp.name)}${pr.hotel ? ' 🏨' : pr.houses ? ' ' + '⌂'.repeat(pr.houses) : ''}</button>`; }).join('')}</div>`
      : '<p class="muted">Aucune pour l\'instant.</p>')
      + (p && p.jailCards.length ? `<p class="small">🎟 ${p.jailCards.length} carte${p.jailCards.length > 1 ? 's' : ''} « Libéré de prison »</p>` : '');
    for (const b of $('#mine').querySelectorAll('[data-sel]')) b.onclick = () => { selected = +b.dataset.sel; renderDetail(); };
  }

  function sideText(sd) {
    const parts = sd.props.map((i) => board.spaces[i].name);
    if (sd.cash) parts.push(money(sd.cash));
    if (sd.cards.length) parts.push(sd.cards.length + ' carte(s) prison');
    return parts.length ? parts.join(', ') : 'rien';
  }

  function renderTrades() {
    const box = $('#trades');
    if (!meP() || meP().bankrupt || S.over) { box.innerHTML = ''; return; }
    const inc = S.trades.filter((t) => t.to === me.id), out = S.trades.filter((t) => t.from === me.id);
    let h = '<h3>Échanges</h3>';
    for (const t of inc) h += `<div class="offer"><p><b>${esc(name(t.from))}</b> te donne ${esc(sideText(t.give))}<br>contre ${esc(sideText(t.want))}</p>
      <div class="row">${btn('Accepter', { type: 'ACCEPT_TRADE', trade: t.id }, 'small')}${btn('Refuser', { type: 'REJECT_TRADE', trade: t.id }, 'small ghost')}</div></div>`;
    for (const t of out) h += `<div class="offer mine"><p>Proposé à <b>${esc(name(t.to))}</b> : ${esc(sideText(t.give))} contre ${esc(sideText(t.want))}</p>${btn('Annuler', { type: 'CANCEL_TRADE', trade: t.id }, 'small ghost')}</div>`;
    h += `<button class="btn small yellow" id="tradeNew" ${S.auction ? 'disabled' : ''}>Proposer un échange</button>`;
    box.innerHTML = h;
    $('#tradeNew').onclick = openTrade;
  }

  function openTrade() {
    const others = S.players.filter((p) => !p.bankrupt && p.id !== me.id);
    if (!others.length) return;
    tradeOpen = true;
    const ov = $('#overlay'); ov.hidden = false;
    let partner = others[0].id;
    const tradable = (pid) => ownedBy(S, board, pid).filter((i) => board.spaces[i].type !== 'street' || !groupHasBuildings(S, board, board.spaces[i].group));
    const col = (pid, key) => tradable(pid).map((i) => `<label class="ck"><input type="checkbox" data-${key}="${i}"><i style="background:${board.spaces[i].color}"></i>${esc(board.spaces[i].name)}${S.props[i].mortgaged ? ' (hyp.)' : ''}</label>`).join('') || '<p class="muted small">Rien à échanger.</p>';
    function draw() {
      const them = S.players.find((p) => p.id === partner), mine = meP();
      ov.innerHTML = `<div class="modal"><h2>Proposer un échange</h2>
        <label class="lbl">Avec</label><div class="seg">${others.map((p) => `<button data-p="${p.id}" class="${p.id === partner ? 'sel' : ''}">${esc(p.name)}</button>`).join('')}</div>
        <div class="cols"><div><h3>Tu donnes</h3>${col(me.id, 'g')}<label class="lbl">Argent (max ${money(mine.cash)})</label><input type="number" id="gCash" min="0" max="${mine.cash}" value="0">
          ${mine.jailCards.length ? '<label class="ck"><input type="checkbox" id="gCard"> Carte « Libéré de prison »</label>' : ''}</div>
        <div><h3>Tu demandes</h3>${col(partner, 'w')}<label class="lbl">Argent</label><input type="number" id="wCash" min="0" value="0">
          ${them.jailCards.length ? '<label class="ck"><input type="checkbox" id="wCard"> Sa carte « Libéré de prison »</label>' : ''}</div></div>
        <div class="row end"><button class="btn ghost" id="tCancel">Annuler</button><button class="btn" id="tSend">Envoyer la proposition</button></div></div>`;
      for (const b of ov.querySelectorAll('[data-p]')) b.onclick = () => { partner = +b.dataset.p; draw(); };
      ov.querySelector('#tCancel').onclick = closeOverlay;
      ov.querySelector('#tSend').onclick = () => {
        const pick = (k) => [...ov.querySelectorAll(`[data-${k}]:checked`)].map((x) => +x.dataset[k]);
        const g = { props: pick('g'), cash: Number(ov.querySelector('#gCash').value) || 0, cards: ov.querySelector('#gCard') && ov.querySelector('#gCard').checked ? [mine.jailCards[0]] : [] };
        const w = { props: pick('w'), cash: Number(ov.querySelector('#wCash').value) || 0, cards: ov.querySelector('#wCard') && ov.querySelector('#wCard').checked ? [them.jailCards[0]] : [] };
        act({ type: 'PROPOSE_TRADE', to: partner, give: g, want: w });
        closeOverlay();
      };
    }
    draw();
  }
  function closeOverlay() { tradeOpen = false; const ov = $('#overlay'); ov.hidden = true; ov.innerHTML = ''; if (S && S.over) renderOver(); }

  function renderOver() {
    const ov = $('#overlay'); ov.hidden = false;
    const why = { bankruptcy: 'Première faillite : la partie Express s\'arrête.', time: 'Fin du chrono de 40 minutes.', lastStanding: 'Il ne reste qu\'un joueur solvable.' }[S.endReason] || '';
    const rows = standings(S, board);
    ov.innerHTML = `<div class="modal over"><div class="crown">♛</div><h2>${esc(name(S.winner))} l'emporte !</h2><p class="muted">${why}</p>
      <table class="rank"><tr><th>#</th><th>Joueur</th><th>Patrimoine</th><th>Liquide</th><th>Loyers perçus</th></tr>
      ${rows.map((r, k) => { const p = S.players.find((q) => q.id === r.id); return `<tr class="${p.bankrupt ? 'out' : ''}"><td>${k + 1}</td><td><i class="dot" style="background:${p.color}"></i>${esc(p.name)}</td><td>${p.bankrupt ? 'faillite' : money(r.total)}</td><td>${money(r.cash)}</td><td>${money(S.stats.players[p.id].rentIn)}</td></tr>`; }).join('')}</table>
      <p class="muted small">Les statistiques détaillées arrivent à l'étape 4.</p>
      <button class="btn big" id="back">Retour au salon</button></div>`;
    ov.querySelector('#back').onclick = exit;
  }

  // délégation : tout bouton portant data-act envoie l'action
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    try { act(JSON.parse(b.dataset.act)); } catch (err) { console.error(err); }
  });

  function tickTimer() {
    if (!S || !S.endsAt) return;
    const left = Math.max(0, S.endsAt - (Date.now() + offset));
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    const t = $('#timer'); t.textContent = `${m}:${String(s).padStart(2, '0')}`; t.classList.toggle('hot', left < 5 * 60000);
  }
  setInterval(tickTimer, 500);

  let toastT = 0;
  return {
    update(state, events, off) {
      S = state; offset = off || 0;
      for (const e of events) {
        const t = describe(e); if (t) logLines.push(t);
        if (e.k === 'CARD') { const cb = $('#cardbox'); cb.hidden = false; cb.className = 'cardbox ' + e.deck; cb.innerHTML = `<b>${e.deck === 'chance' ? 'Chance' : 'Caisse de communauté'}</b>${esc(e.text)}`; }
        if (e.k === 'TURN') $('#cardbox').hidden = true;
      }
      logLines.splice(0, Math.max(0, logLines.length - 60));
      $('#log').innerHTML = logLines.slice(-14).map((l) => `<li class="${l.startsWith('—') ? 'turn' : ''}">${esc(l)}</li>`).join('');
      $('#overlay').hidden = !tradeOpen; if (!tradeOpen) $('#overlay').innerHTML = '';
      renderPlayers(); renderPanel(); renderBoard(); renderDetail(); renderMine(); renderTrades(); tickTimer();
      if (S.over && !tradeOpen) renderOver();
    },
    waiting(ready, all, players) {
      const ov = $('#overlay'); ov.hidden = false;
      ov.innerHTML = `<div class="modal"><h2>Installation du plateau…</h2><p>Joueurs prêts : ${ready.length}/${all.length}</p>
        <p class="muted small">${players.map((p) => esc(p.name) + (ready.includes(p.id) ? ' ✓' : ' …')).join(' · ')}</p></div>`;
    },
    toast(msg) {
      const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200);
    },
  };
}

export { actors };
