// Fenêtres d'interaction : titre de propriété, achat, enchère, échange, biens, fin de partie.
import { esc, money, el, inkOn } from './util.js';
import { spaceIcon } from './icons.js';
import { tokenSvg } from './tokens.js';
import { ownsGroup, level, groupHasBuildings, ownedBy, standings, netWorth } from '../engine/valuation.js';

/* ------------------------------------------------------------- titre de propriété */
export function deedHtml(board, S, i, { compact = false } = {}) {
  const sp = board.spaces[i];
  const hph = S ? S.cfg.housesPerHotel : 4;
  const line = (label, v) => `<li><span>${label}</span><i></i><b>${v}</b></li>`;
  let body;
  if (sp.type === 'street') {
    body = `<header style="background:${sp.color};color:${inkOn(sp.color)}"><small>TITRE DE PROPRIÉTÉ</small><b>${esc(sp.name)}</b></header>
      <p class="rent0">LOYER <b>${money(sp.rent[0])}</b></p>
      <ul>${[1, 2, 3, 4].filter((k) => k <= hph).map((k) => line(`Avec ${k} maison${k > 1 ? 's' : ''}`, money(sp.rent[k]))).join('')}${line('Avec HÔTEL', money(sp.rent[5]))}</ul>
      <div class="sep"></div>
      <p class="cost">Prix des maisons : <b>${money(sp.houseCost)}</b> chacune<br>Prix d'un hôtel : <b>${money(sp.houseCost)}</b> plus ${hph} maisons<br>Valeur hypothécaire : <b>${money(sp.mortgage)}</b></p>
      <p class="fine">Si un joueur possède TOUS les terrains d'un groupe de couleur, le loyer est doublé sur les terrains nus de ce groupe.</p>`;
  } else if (sp.type === 'station') {
    body = `<header class="plain"><span class="ico">${spaceIcon(sp)}</span><b>${esc(sp.name)}</b></header>
      <ul>${line('Loyer', money(sp.rent[0]))}${line('Si 2 pôles sont possédés', money(sp.rent[1]))}${line('Si 3 pôles sont possédés', money(sp.rent[2]))}${line('Si 4 pôles sont possédés', money(sp.rent[3]))}</ul>
      <div class="sep"></div><p class="cost">Valeur hypothécaire : <b>${money(sp.mortgage)}</b></p>`;
  } else {
    body = `<header class="plain"><span class="ico">${spaceIcon(sp)}</span><b>${esc(sp.name)}</b></header>
      <p class="util">Si l'on possède <b>UNE</b> compagnie, le loyer est <b>4 fois</b> le montant indiqué par les dés.</p>
      <p class="util">Si l'on possède <b>LES DEUX</b> compagnies, le loyer est <b>10 fois</b> le montant indiqué par les dés.</p>
      <div class="sep"></div><p class="cost">Valeur hypothécaire : <b>${money(sp.mortgage)}</b></p>`;
  }
  return `<div class="deed${compact ? ' compact' : ''}">${body}<p class="price">Prix d'achat ${money(sp.price)}</p></div>`;
}

/* ------------------------------------------------------------- gestionnaire */
export function mountModals(host) {
  const layer = el('div', 'modals');
  host.appendChild(layer);
  let cur = null; // { key, el, onClose }
  const api = {
    get key() { return cur && cur.key; },
    open(key, html, { cls = '', closable = true, onClose } = {}) {
      api.close(true);
      const box = el('div', 'modal ' + cls, (closable ? '<button class="mx" aria-label="Fermer">×</button>' : '') + html);
      const scrim = el('div', 'scrim'); scrim.appendChild(box); layer.appendChild(scrim);
      cur = { key, el: box, scrim, onClose, closable };
      if (closable) {
        box.querySelector('.mx').onclick = () => api.close();
        scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim) api.close(); });
      }
      box.animate([{ transform: 'translateY(24px) scale(.96)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.9,.3,1.1)' });
      const f = box.querySelector('[data-focus]') || box.querySelector('button:not(.mx)'); if (f) setTimeout(() => f.focus(), 30);
      return box;
    },
    close(silent) {
      if (!cur) return;
      const c = cur; cur = null; c.scrim.remove();
      if (!silent && c.onClose) c.onClose();
    },
    update(key, fn) { if (cur && cur.key === key) fn(cur.el); },
  };
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && cur && cur.closable) api.close(); });
  return api;
}

/* ------------------------------------------------------------- contenus */
const btn = (label, action, cls = '') => `<button class="btn ${cls}" data-act='${esc(JSON.stringify(action))}'>${label}</button>`;

export function buyHtml(board, S, me) {
  const i = S.pendingBuy, sp = board.spaces[i], p = S.players.find((q) => q.id === me.id);
  const ok = p.cash >= sp.price;
  return `<div class="split">${deedHtml(board, S, i)}<div class="side">
    <h3>À vendre !</h3><p>Tu es sur <b>${esc(sp.name)}</b>. Tu as <b>${money(p.cash)}</b>.</p>
    ${btn(`Acheter · ${money(sp.price)}`, { type: 'BUY' }, 'big block' + (ok ? '' : ' off'))}
    ${ok ? '' : '<p class="hint">Pas assez de liquide : hypothèque ou vends dans « Mes biens », ou laisse partir aux enchères.</p>'}
    ${btn('Mettre aux enchères', { type: 'DECLINE' }, 'ghost block')}
    <p class="hint">Si tu n'achètes pas, la propriété est mise aux enchères entre tous les joueurs.</p></div></div>`;
}

export function auctionHtml(board, S, me, name) {
  const a = S.auction, sp = board.spaces[a.space];
  const mine = a.active.includes(me.id) && !a.passed.includes(me.id);
  const p = S.players.find((q) => q.id === me.id);
  const left = a.active.filter((id) => !a.passed.includes(id));
  const chips = a.active.map((id) => { const q = S.players.find((x) => x.id === id);
    return `<span class="bidder${a.passed.includes(id) ? ' out' : ''}${a.bidder === id ? ' lead' : ''}"><i style="background:${q.color}"></i>${esc(q.name)}</span>`; }).join('');
  let ctl = '';
  if (mine) {
    ctl = a.bidder === me.id ? '<p class="lead-msg">Tu as la meilleure offre. Attends que les autres passent…</p>'
      : `<div class="bids">${[10, 50, 100].map((n) => btn('+' + n + ' €', { type: 'BID', amount: a.high + n }, 'yellow' + (a.high + n > p.cash ? ' off' : ''))).join('')}</div>
        <div class="row"><input type="number" id="bidIn" min="${a.high + 1}" max="${p.cash}" step="1" placeholder="${a.high + 1}" aria-label="Montant de l'offre">
        <button class="btn" id="bidGo">Offrir</button>${btn('Passer', { type: 'PASS' }, 'ghost')}</div>`;
  } else if (p && !p.bankrupt) ctl = '<p class="hint">Tu ne participes plus à cette enchère.</p>';
  return `<div class="split">${deedHtml(board, S, a.space, { compact: true })}<div class="side">
    <h3>Enchères</h3>
    <div class="high"><small>Meilleure offre</small><b>${a.bidder != null ? money(a.high) : '—'}</b><span>${a.bidder != null ? esc(name(a.bidder)) : 'Aucune offre pour l\'instant'}</span></div>
    <div class="timebar"><i></i></div>
    <div class="bidders">${chips}</div>
    ${ctl}
    <p class="hint">Prix affiché ${money(sp.price)} · ${left.length} en lice · clôture après 12 s sans nouvelle offre</p></div></div>`;
}

export function propertyHtml(board, S, me, i, name) {
  const sp = board.spaces[i], pr = S.props[i];
  if (!pr) return `<h3>${esc(sp.name)}</h3><p class="hint">Case spéciale.</p>`;
  const mine = pr.owner === me.id;
  const lv = pr.hotel ? 'Un hôtel' : pr.houses ? `${pr.houses} maison${pr.houses > 1 ? 's' : ''}` : 'Aucun bâtiment';
  let actions = '';
  if (mine && !S.over) {
    const row = [];
    const canManage = !S.auction && ((S.debts.length && S.debts[0].from === me.id) || (!S.debts.length && S.players[S.turn.cur].id === me.id));
    if (canManage) {
      if (sp.type === 'street' && ownsGroup(S, board, me.id, sp.group) && !pr.hotel && !S.debts.length) {
        row.push(btn(pr.houses === S.cfg.housesPerHotel ? `Construire un hôtel · ${money(sp.houseCost)}` : `Construire une maison · ${money(sp.houseCost)}`, { type: 'BUILD', space: i }));
      }
      if (sp.type === 'street' && level(S, i) > 0) row.push(btn(`Vendre un bâtiment · +${money(sp.houseCost / 2)}`, { type: 'SELL_BUILDING', space: i }, 'ghost'));
      if (!pr.mortgaged) row.push(btn(`Hypothéquer · +${money(sp.mortgage)}`, { type: 'MORTGAGE', space: i }, 'ghost'));
      else if (!S.debts.length) row.push(btn(`Lever l'hypothèque · ${money(sp.mortgage + Math.ceil(sp.mortgage * S.cfg.mortgageInterest))}`, { type: 'UNMORTGAGE', space: i }, 'ghost'));
    }
    actions = row.length ? `<div class="stack">${row.join('')}</div>` : '<p class="hint">Tu peux gérer tes biens pendant ton tour, ou pour régler une dette.</p>';
  }
  return `<div class="split">${deedHtml(board, S, i)}<div class="side">
    <h3>${pr.owner == null ? 'À la banque' : (mine ? 'À toi' : 'À ' + esc(name(pr.owner)))}</h3>
    <p>${sp.type === 'street' ? lv : ''}${pr.mortgaged ? ' · <b class="warn">hypothéquée</b>' : ''}</p>
    ${actions}</div></div>`;
}

export function mineHtml(board, S, me) {
  const p = S.players.find((q) => q.id === me.id);
  const list = ownedBy(S, board, me.id);
  const groups = {};
  for (const i of list) (groups[board.spaces[i].group] = groups[board.spaces[i].group] || []).push(i);
  const w = netWorth(S, board, me.id);
  const rows = Object.keys(board.groups).filter((g) => groups[g]).map((g) => {
    const full = board.groups[g].spaces.length;
    return `<div class="grp"><div class="gh"><i style="background:${board.groups[g].color}"></i>${esc(board.groups[g].name)} <small>${groups[g].length}/${full}${ownsGroup(S, board, me.id, g) && g !== 'station' && g !== 'utility' ? ' · monopole ♛' : ''}</small></div>
      <div class="gl">${groups[g].map((i) => { const sp = board.spaces[i], pr = S.props[i];
        return `<button class="pcard${pr.mortgaged ? ' mort' : ''}" data-prop="${i}"><b>${esc(sp.name)}</b><span>${pr.hotel ? '🏨 hôtel' : pr.houses ? '⌂'.repeat(pr.houses) : ''}${pr.mortgaged ? 'hypothéquée' : ''}</span></button>`; }).join('')}</div></div>`;
  }).join('');
  return `<h2>Mes biens</h2>
    <div class="kpis"><div><small>Liquide</small><b>${money(p.cash)}</b></div><div><small>Immobilier</small><b>${money(w.property + w.buildings)}</b></div><div><small>Patrimoine</small><b>${money(w.total)}</b></div><div><small>Monopoles</small><b>${w.monopolies}</b></div></div>
    ${rows || '<p class="hint">Tu ne possèdes encore rien. Achète en tombant sur une case libre !</p>'}
    ${p.jailCards.length ? `<p>🎟 ${p.jailCards.length} carte${p.jailCards.length > 1 ? 's' : ''} « Libéré de prison »</p>` : ''}
    <div class="row end"><button class="btn yellow" id="openTrade">Proposer un échange</button></div>`;
}

const sideText = (board, sd) => {
  const parts = sd.props.map((i) => esc(board.spaces[i].name));
  if (sd.cash) parts.push(money(sd.cash));
  if (sd.cards.length) parts.push('carte « Libéré de prison »');
  return parts.length ? parts.join(', ') : 'rien';
};

export function offerHtml(board, S, t, name) {
  return `<h2>Proposition d'échange</h2>
    <div class="swap"><div><small>${esc(name(t.from))} te donne</small><p>${sideText(board, t.give)}</p></div><div class="arrow">⇄</div>
    <div><small>en échange de</small><p>${sideText(board, t.want)}</p></div></div>
    <div class="row end">${btn('Refuser', { type: 'REJECT_TRADE', trade: t.id }, 'ghost')}${btn('Accepter', { type: 'ACCEPT_TRADE', trade: t.id })}</div>`;
}

export function tradeComposeHtml(board, S, me, partner) {
  const others = S.players.filter((p) => !p.bankrupt && p.id !== me.id);
  const mine = S.players.find((p) => p.id === me.id), them = S.players.find((p) => p.id === partner);
  const tradable = (pid) => ownedBy(S, board, pid).filter((i) => board.spaces[i].type !== 'street' || !groupHasBuildings(S, board, board.spaces[i].group));
  const col = (pid, key) => tradable(pid).map((i) => `<label class="ck"><input type="checkbox" data-${key}="${i}"><i style="background:${board.spaces[i].color}"></i>${esc(board.spaces[i].name)}${S.props[i].mortgaged ? ' <small>(hyp.)</small>' : ''}</label>`).join('') || '<p class="hint">Rien d\'échangeable.</p>';
  const out = S.trades.filter((t) => t.from === me.id);
  return `<h2>Proposer un échange</h2>
    <div class="seg">${others.map((p) => `<button data-partner="${p.id}" class="${p.id === partner ? 'sel' : ''}"><i style="background:${p.color}"></i>${esc(p.name)}</button>`).join('')}</div>
    <div class="cols"><div><h3>Tu donnes</h3>${col(me.id, 'g')}<label class="lbl">Argent (tu as ${money(mine.cash)})</label><input type="number" id="gCash" min="0" max="${mine.cash}" value="0">
      ${mine.jailCards.length ? '<label class="ck"><input type="checkbox" id="gCard"> Ta carte « Libéré de prison »</label>' : ''}</div>
    <div><h3>Tu demandes</h3>${col(partner, 'w')}<label class="lbl">Argent</label><input type="number" id="wCash" min="0" value="0">
      ${them.jailCards.length ? '<label class="ck"><input type="checkbox" id="wCard"> Sa carte « Libéré de prison »</label>' : ''}</div></div>
    ${out.length ? `<p class="hint">En attente : ${out.map((t) => `proposition à ${esc(S.players.find((q) => q.id === t.to).name)}${btn('Annuler', { type: 'CANCEL_TRADE', trade: t.id }, 'ghost tiny')}`).join(' · ')}</p>` : ''}
    <p class="hint">Les terrains d'un groupe bâti ne s'échangent pas : vends d'abord les bâtiments. Un terrain hypothéqué coûte 10 % d'intérêts à celui qui le reçoit.</p>
    <div class="row end"><button class="btn" id="tSend">Envoyer la proposition</button></div>`;
}

export function overHtml(board, S, name) {
  const rows = standings(S, board);
  const why = { bankruptcy: 'Première faillite : la partie Express s\'arrête au patrimoine.', time: 'Fin du chrono de 40 minutes : victoire au patrimoine.', lastStanding: 'Il ne reste qu\'un joueur solvable.' }[S.endReason] || '';
  const top = rows.slice(0, 3).map((r) => S.players.find((q) => q.id === r.id));
  const order = [top[1], top[0], top[2]];
  const podium = order.map((p, k) => p ? `<div class="pod p${[2, 1, 3][k]}"><div class="pw">${tokenSvg(p.token, p.color)}</div><b>${esc(p.name)}</b><div class="step">${[2, 1, 3][k]}</div></div>` : '<div class="pod empty"></div>').join('');
  return `<div class="over"><h2>${esc(name(S.winner))} l'emporte !</h2><p class="hint">${why}</p>
    <div class="podium">${podium}</div>
    <table class="rank"><tr><th>#</th><th>Joueur</th><th>Patrimoine</th><th>Loyers perçus</th><th>Loyers payés</th><th>Distance</th><th>Prison</th></tr>
    ${rows.map((r, k) => { const p = S.players.find((q) => q.id === r.id), st = S.stats.players[p.id];
      return `<tr class="${p.bankrupt ? 'out' : ''}"><td>${k + 1}</td><td><i class="dot" style="background:${p.color}"></i>${esc(p.name)}</td><td>${p.bankrupt ? 'faillite' : money(r.total)}</td><td>${money(st.rentIn)}</td><td>${money(st.rentOut)}</td><td>${st.dist} cases</td><td>${st.jailTurns} tour${st.jailTurns > 1 ? 's' : ''}</td></tr>`; }).join('')}</table>
    <div class="row end"><button class="btn big yellow" id="overStats">📊 Statistiques détaillées</button><button class="btn big" id="backHub">Retour au salon</button></div></div>`;
}
