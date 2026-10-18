// Vue de DavidSimulator : plateau 3D, interface de jeu et « réalisateur » qui met en scène les événements.
// Chaque mise à jour reçue (état + événements) est jouée dans l'ordre — dés, déplacements, paiements,
// achats, cartes — puis l'état final est appliqué. Si les mises à jour s'accumulent, la lecture accélère.
import { availableActions, currentPlayer } from '../engine/rules.js';
import { netWorth } from '../engine/valuation.js';
import { mountBoard } from './board.js';
import { mountDice } from './dice.js';
import { mountFx } from './fx.js';
import { sfx } from './sfx.js';
import { tokenSvg } from './tokens.js';
import { mountSetup } from './setup.js';
import { esc, money, el, wait } from './util.js';
import { mountModals, buyHtml, auctionHtml, propertyHtml, mineHtml, offerHtml, tradeComposeHtml, overHtml } from './modals.js';
import { openStats, sparkline, heatValues, heatColor, heatLabel } from './stats.js';
import { standings } from '../engine/valuation.js';

export function mountGame(root, board, { me, act, pick, start, exit }) {
  root.className = 'game';
  root.innerHTML = `
    <div class="stagehost" id="stagehost"></div>
    <header class="topbar">
      <div class="info"><b id="mode">DavidSimulator</b><span id="round"></span></div>
      <div class="timer" id="timer" hidden></div>
      <div class="tools">
        <button class="heatpill" id="heatPill" hidden title="Masquer la heatmap"></button>
        <button class="tool" id="tstats" title="Statistiques">📊</button>
        <button class="tool" id="t3d" title="Vue 3D ou vue de dessus">3D</button>
        <button class="tool" id="tcam" title="Caméra qui suit le pion">🎥</button>
        <button class="tool" id="tsnd" title="Son">🔊</button>
        <button class="tool quit" id="tquit">Quitter</button>
      </div>
    </header>
    <aside class="roster" id="roster" aria-label="Joueurs"></aside>
    <div class="actionbar" id="actionbar" aria-live="polite"></div>
    <div class="dock">
      <button class="btn ghost" id="bMine">Mes biens</button>
      <button class="btn ghost" id="bTrade">Échanger<i class="badge" id="tradeBadge" hidden></i></button>
    </div>
    <div class="logbox" id="logbox"><ol id="log"></ol></div>
    <div class="toast" id="toast" hidden role="status"></div>`;
  const $ = (s) => root.querySelector(s);

  const B = mountBoard($('#stagehost'), board, { onCell: (i) => openProperty(i) });
  const D = mountDice(root);
  const F = mountFx(root);
  const M = mountModals(root);
  B.onStep = () => sfx.play('hop');
  const SU = mountSetup(root, { me, pick, start, exit });

  let S = null, offset = 0, playing = false, first = true;
  const queue = [], seenAuto = new Set(), logLines = [];
  const cash = {}; // argent affiché (animé)
  const name = (id) => { const p = S && S.players.find((q) => q.id === id); return p ? p.name : 'la banque'; };
  const color = (id) => { const p = S && S.players.find((q) => q.id === id); return p ? p.color : '#16181d'; };
  const meP = () => S && S.players.find((p) => p.id === me.id);

  /* ---------------------------------------------------------- barre d'outils */
  const syncTools = () => { $('#t3d').textContent = B.is3d() ? '3D' : '2D'; $('#tcam').classList.toggle('off', !B.follow()); $('#tsnd').textContent = sfx.on ? '🔊' : '🔇'; };
  $('#t3d').onclick = () => { B.toggle3d(); syncTools(); };
  $('#tcam').onclick = () => { B.toggleFollow(); syncTools(); };
  $('#tsnd').onclick = () => { sfx.toggle(); syncTools(); };
  $('#tquit').onclick = () => { if (!S || S.over || confirm('Quitter la partie ?')) exit(); };
  $('#bMine').onclick = () => openMine();
  let statsCtl = null, heatMode = null;
  const HEAT_NAMES = { visits: 'Visites', rent: 'Loyers perçus', theory: 'Probabilité' };
  function openStatsWin() { if (!S) return; statsCtl = openStats(M, board, () => S, me, { onHeat: setHeat, heatMode: heatMode || 'visits' }); }
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
  $('#logbox').onclick = () => $('#logbox').classList.toggle('open');
  syncTools();

  /* ---------------------------------------------------------- journal */
  function describe(e) {
    switch (e.k) {
      case 'TURN': return `Au tour de ${name(e.player)}`;
      case 'DICE': return e.reason === 'utility' ? `${name(e.player)} relance : ${e.dice[0]} + ${e.dice[1]}` : `${name(e.player)} fait ${e.dice[0]} + ${e.dice[1]}${e.dice[0] === e.dice[1] ? ' (double)' : ''}`;
      case 'LAND': return `${name(e.player)} → ${board.spaces[e.space].name}`;
      case 'PAY':
        if (e.reason === 'rent') return `${name(e.from)} paie ${money(e.amount)} de loyer à ${name(e.to)}`;
        if (e.reason === 'go') return `${name(e.to)} touche ${money(e.amount)} (Départ)`;
        if (e.reason === 'tax') return `${name(e.from)} paie ${money(e.amount)} de taxe`;
        if (e.reason === 'bail') return `${name(e.from)} paie la caution`;
        if (e.reason === 'card') return e.from == null ? `${name(e.to)} reçoit ${money(e.amount)}` : `${name(e.from)} paie ${money(e.amount)}${e.to != null ? ' à ' + name(e.to) : ''}`;
        return null;
      case 'CARD': return `${e.deck === 'chance' ? 'Chance' : 'Caisse'} : ${e.text}`;
      case 'JAIL': return `${name(e.player)} va en prison`;
      case 'JAIL_OUT': return `${name(e.player)} sort de prison`;
      case 'BUY': return `${name(e.player)} achète ${board.spaces[e.space].name}`;
      case 'GIFT': return `${name(e.player)} reçoit ${board.spaces[e.space].name}`;
      case 'AUCTION_END': return e.winner != null ? `${name(e.winner)} remporte ${board.spaces[e.space].name} pour ${money(e.amount)}` : `${board.spaces[e.space].name} reste à la banque`;
      case 'BUILD': return `${name(e.player)} construit ${e.hotel ? 'un hôtel' : 'une maison'} · ${board.spaces[e.space].name}`;
      case 'MORTGAGE': return `${name(e.player)} hypothèque ${board.spaces[e.space].name}`;
      case 'UNMORTGAGE': return `${name(e.player)} lève l'hypothèque de ${board.spaces[e.space].name}`;
      case 'TRADE_DONE': return `Échange conclu : ${name(e.trade.from)} ⇄ ${name(e.trade.to)}`;
      case 'BANKRUPT': return `${name(e.player)} fait faillite`;
      case 'GAME_OVER': return `${name(e.winner)} remporte la partie !`;
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
    $('#roster').innerHTML = S.players.map((p) => {
      const w = netWorth(S, board, p.id);
      return `<div class="pcard-hud${p.id === cur ? ' cur' : ''}${p.bankrupt ? ' out' : ''}${p.id === me.id ? ' me' : ''}" data-pid="${p.id}" style="--pc:${p.color}">
        <span class="mini">${tokenSvg(p.token, p.color)}<i class="rk" title="Rang au patrimoine">${p.bankrupt ? '✕' : rank.get(p.id)}</i></span>
        <span class="who"><b>${esc(p.name)}</b><small>${p.id === me.id ? 'toi' : p.bot ? 'bot' : ''}${p.inJail ? ' · 🔒 prison' : ''}${p.jailCards.length ? ' · 🎟' : ''}</small></span>
        <span class="cash" title="Argent liquide">${money(cash[p.id] ?? p.cash)}</span>
        <span class="worth"><span title="Valeur immobilière">🏠 ${money(w.property + w.buildings)}</span><span title="Monopoles">♛ ${w.monopolies}</span><span class="net" title="Patrimoine net">Net ${money(w.total)}</span></span>
        <span class="sp">${sparkline(S, p.id, p.color)}</span>
        ${p.id === cur ? '<i class="playing">joue</i>' : ''}
      </div>`;
    }).join('');
    const mode = S.mode === 'express' ? 'Partie Express' : 'Partie classique';
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
        h = `<span class="status">${esc(sp.name)} · ${money(sp.price)}</span>${abtn('Acheter', { type: 'BUY' }, 'primary' + (p.cash < sp.price ? ' off' : ''))}${abtn('Enchères', { type: 'DECLINE' }, 'ghost')}<button class="btn ghost" data-open="buy">Voir le titre</button>`;
      } else if (S.phase === 'end') {
        h = `<span class="status">Construis, échange… ou passe la main</span>${abtn('Fin du tour ➜', { type: 'END_TURN' }, 'primary')}`;
      }
    } else {
      const c = currentPlayer(S);
      h = `<span class="status"><i class="dotc" style="background:${c.color}"></i>${esc(c.name)} joue…</span>`;
    }
    bar.innerHTML = h;
    const so = $('#showOver'); if (so) so.onclick = () => openOver();
    const inc = S.trades.filter((t) => t.to === me.id).length;
    $('#tradeBadge').hidden = !inc; $('#tradeBadge').textContent = inc;
    $('#bMine').disabled = $('#bTrade').disabled = !p || p.bankrupt || S.over;
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
      if (a.type === 'BID' || a.type === 'PASS') sfx.play('bid');
      return;
    }
    const o = e.target.closest('[data-open]');
    if (o) { const k = o.dataset.open; if (k === 'mine') openMine(); if (k === 'auction') openAuction(true); if (k === 'buy') openBuy(true); return; }
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
    partner = partner ?? others[0].id;
    const box = M.open('trade', tradeComposeHtml(board, S, me, partner), { cls: 'wide' });
    for (const b of box.querySelectorAll('[data-partner]')) b.onclick = () => openTrade(+b.dataset.partner);
    box.querySelector('#tSend').onclick = () => {
      const pick = (k) => [...box.querySelectorAll(`[data-${k}]:checked`)].map((x) => +x.dataset[k]);
      const mine = meP(), them = S.players.find((p) => p.id === partner);
      const g = { props: pick('g'), cash: Number(box.querySelector('#gCash').value) || 0, cards: box.querySelector('#gCard')?.checked ? [mine.jailCards[0]] : [] };
      const w = { props: pick('w'), cash: Number(box.querySelector('#wCash').value) || 0, cards: box.querySelector('#wCard')?.checked ? [them.jailCards[0]] : [] };
      act({ type: 'PROPOSE_TRADE', to: partner, give: g, want: w });
      M.close(true);
      toast('Proposition envoyée à ' + them.name);
    };
  }
  function openOffer(t) {
    if (seenAuto.has('offer:' + t.id)) return;
    seenAuto.add('offer:' + t.id);
    M.open('offer:' + t.id, offerHtml(board, S, t, name));
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
    else if (k.startsWith('offer:') && !S.trades.some((x) => 'offer:' + x.id === k)) M.close(true);
    else if (k.startsWith('buy') && S.phase !== 'buy') M.close(true);
  }

  /* ---------------------------------------------------------- application d'un état */
  function apply(state) {
    S = state;
    if (M.key === 'wait') M.close(true);
    for (const p of S.players) cash[p.id] = p.cash;
    B.sync(S);
    B.setCurrent(S.over ? null : currentPlayer(S).id);
    B.pulse(S.phase === 'buy' ? S.pendingBuy : -1);
    renderRoster(); renderActions(); autoModals(); tickTimer();
    if (heatMode) paintHeat();
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
        B.setCurrent(e.player); B.relax();
        S && renderRosterCur(e.player);
        if (!quick) { sfx.play('turn'); await F.banner(e.player === me.id ? 'À toi de jouer !' : `Au tour de ${nm(e.player)}`, `Tour ${e.round}`, col(e.player), 900 / speed); }
        break;
      case 'DICE':
        if (!quick) sfx.play('dice');
        await D.roll(e.dice, speed);
        if (e.dice[0] === e.dice[1] && !e.reason && !quick) { const pt = B.pawnScreen(e.player); if (pt) F.float(pt.x, pt.y - 30, 'DOUBLE !', 'gold'); }
        break;
      case 'MOVE':
        await B.hop(e.player, e.steps, speed);
        break;
      case 'LAND': break;
      case 'PAY': {
        const a = e.from != null ? cardPoint(e.from) : (e.reason === 'go' ? B.cellScreen(0) : bankPoint());
        const b = e.to != null ? cardPoint(e.to) : bankPoint();
        if (e.from != null) { setCash(e.from, (cash[e.from] ?? 0) - e.amount, !quick); if (!quick && a) F.float(a.x, a.y, '−' + money(e.amount), 'minus'); }
        if (e.to != null) { setCash(e.to, (cash[e.to] ?? 0) + e.amount, !quick); }
        if (quick) break;
        if (e.reason === 'go') { const c = B.cellScreen(0); F.float(c.x, c.y, '+' + money(e.amount), 'plus'); }
        sfx.play(e.to != null ? 'coin' : 'pay');
        const big = e.reason === 'rent' || e.reason === 'go' || e.reason === 'card' || e.reason === 'trade' || e.reason === 'tax' || e.reason === 'buy' || e.reason === 'auction';
        if (big) await F.bills(a, b, e.amount, speed);
        if (e.to != null && b) F.float(b.x, b.y, '+' + money(e.amount), 'plus');
        break;
      }
      case 'CARD':
        if (!quick) { sfx.play('card'); await F.card(e.deck, e.text, speed); }
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
        const c = B.cells[e.space]; c.classList.add('owned'); c.style.setProperty('--own', col(e.player));
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
        const c = B.cells[e.space]; c.classList.add('owned'); c.style.setProperty('--own', col(e.winner));
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
      case 'TRADE_OFFER': if (e.trade.to === me.id) sfx.play('card'); break;
      case 'TRADE_DONE':
        if (!quick) { sfx.play('buy'); await F.banner('Échange conclu', `${nm(e.trade.from)} ⇄ ${nm(e.trade.to)}`, '#2fbf71', 900 / speed); }
        break;
      case 'TRADE_REJECTED': if (e.by !== me.id && next.players && !quick) toast(`${nm(e.by)} refuse l'échange`); break;
      case 'DEBT':
        if (e.from === me.id && !quick) await F.banner('Il te manque de l\'argent', `Tu dois ${money(e.amount)}`, '#e3262f', 1000 / speed);
        break;
      case 'BANKRUPT':
        sfx.play('bankrupt');
        if (!quick) await F.banner(`${nm(e.player)} fait faillite`, '', '#16181d', 1200 / speed);
        break;
      case 'GAME_OVER':
        sfx.play('win'); F.confetti();
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
      if (String(M.key).startsWith('buy') || String(M.key).startsWith('offer')) M.close(true);
      for (const e of it.events) {
        try { await play(e, speed, it.state); } catch (err) { console.error(err); }
      }
      apply(it.state);
    }
    playing = false; root.classList.remove('busy');
    setTimeout(() => { if (!playing) B.relax(); }, 900);
  }

  /* ---------------------------------------------------------- chrono */
  function tickTimer() {
    if (!S || !S.endsAt) return;
    const left = Math.max(0, S.endsAt - (Date.now() + offset));
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    const t = $('#timer'); t.textContent = `⏱ ${m}:${String(s).padStart(2, '0')}`; t.classList.toggle('hot', left < 5 * 60000);
  }
  setInterval(tickTimer, 500);

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
          if (wasFirst) {
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
  };
}
