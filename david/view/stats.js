// Statistiques de DavidSimulator, en direct et en fin de partie :
// courbe du patrimoine tour par tour, heatmap du plateau, classement détaillé, analyse financière (Markov).
import { esc, money, el } from './util.js';
import { netWorth, standings } from '../engine/valuation.js';
import { landingProbabilities, propertyAnalysis } from '../engine/markov.js';

// Rampe séquentielle (une seule teinte, du clair au foncé) pour la heatmap
export const HEAT = ['#fbeee6', '#f6cdb9', '#ef9f80', '#e2704c', '#c4472a', '#8f2a12'];
export function heatColor(v, max) {
  if (!max || v <= 0) return null;
  const k = Math.min(HEAT.length - 1, Math.floor((v / max) * (HEAT.length - 1) + 0.5));
  return { bg: HEAT[k], ink: k >= 3 ? '#ffffff' : '#16181d' };
}

const kfmt = (n) => (Math.abs(n) >= 10000 ? `${(n / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€` : money(n));
const pct = (x, d = 1) => `${(x * 100).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const short = (n) => n.replace(/^Boulevard /, 'Bd ').replace(/^Avenue /, 'Av. ').replace(/ — .*/, '').replace('Caisse de communauté', 'Caisse').replace('Prison / Simple visite', 'Prison');

/* ------------------------------------------------------------- mini-courbe (cartes joueurs) */
export function sparkline(S, pid, color) {
  const h = S.stats.history.slice(-30).map((x) => x.worth[pid] ?? 0);
  if (h.length < 2) return '';
  const max = Math.max(...h), min = Math.min(...h), W = 64, Hh = 16;
  const y = (v) => (max === min ? Hh / 2 : Hh - 2 - ((v - min) / (max - min)) * (Hh - 4));
  const d = h.map((v, k) => `${k ? 'L' : 'M'}${((k / (h.length - 1)) * W).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return `<svg class="sparkl" viewBox="0 0 ${W} ${Hh}" aria-hidden="true"><path d="${d}" fill="none" stroke="#16181d" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/* ------------------------------------------------------------- courbe du patrimoine */
function lineChart(S, measure) {
  const hist = S.stats.history, players = S.players;
  if (hist.length < 2) return '<p class="hint empty">La courbe se dessine au fil des tours : reviens après quelques lancers.</p>';
  const W = 960, H = 330, L = 64, R = 110, T = 14, B = 34;
  const xs = hist.map((h) => h.t), x0 = xs[0], x1 = xs[xs.length - 1] || 1;
  const val = (h, id) => (measure === 'cash' ? (h.cash ? h.cash[id] : null) : h.worth[id]) ?? 0;
  let ymax = 0;
  for (const h of hist) for (const p of players) ymax = Math.max(ymax, val(h, p.id));
  const step = niceStep(ymax / 4);
  ymax = Math.max(step, Math.ceil(ymax / step) * step);
  const X = (t) => L + ((t - x0) / Math.max(1, x1 - x0)) * (W - L - R);
  const Y = (v) => T + (1 - v / ymax) * (H - T - B);
  let g = '';
  for (let v = 0; v <= ymax + 1e-9; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${L - 8}" y="${Y(v) + 4}" class="ax" text-anchor="end">${kfmt(v)}</text>`;
  const ticks = 6;
  for (let k = 0; k <= ticks; k++) { const t = Math.round(x0 + ((x1 - x0) * k) / ticks); g += `<text x="${X(t)}" y="${H - 10}" class="ax" text-anchor="middle">${t}</text>`; }
  g += `<text x="${W - 8}" y="${H - 10}" class="ax" text-anchor="end">tours</text>`;
  // courbes : liseré sombre sous la couleur du joueur (lisible même pour le jaune sur fond crème)
  const ends = [];
  for (const p of players) {
    const d = hist.map((h, k) => `${k ? 'L' : 'M'}${X(h.t).toFixed(1)} ${Y(val(h, p.id)).toFixed(1)}`).join(' ');
    g += `<path d="${d}" class="halo"/><path d="${d}" fill="none" stroke="${p.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"${p.bankrupt ? ' stroke-dasharray="6 5"' : ''}/>`;
    const last = val(hist[hist.length - 1], p.id);
    ends.push({ p, y: Y(last), v: last });
  }
  // étiquettes directes en bout de courbe, écartées pour ne pas se chevaucher
  ends.sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 15) ends[k].y = ends[k - 1].y + 15;
  for (const e of ends) g += `<circle cx="${W - R}" cy="${Y(e.v)}" r="4.5" fill="${e.p.color}" stroke="#16181d" stroke-width="2"/><text x="${W - R + 10}" y="${e.y + 4}" class="lab">${esc(e.p.name)}</text>`;
  return `<div class="chartwrap" data-chart="line"><svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Évolution ${measure === 'cash' ? 'du liquide' : 'du patrimoine net'} par tour">${g}
    <line class="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/><rect class="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/></svg>
    <div class="tip" hidden></div></div>`;
}
function niceStep(x) {
  if (x <= 0) return 500;
  const p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
function wireLine(box, S, measure) {
  const wrap = box.querySelector('[data-chart="line"]'); if (!wrap) return;
  const svg = wrap.querySelector('svg'), tip = wrap.querySelector('.tip'), cross = wrap.querySelector('.cross');
  const hist = S.stats.history, W = 960, L = 64, R = 110;
  const x0 = hist[0].t, x1 = hist[hist.length - 1].t || 1;
  const show = (clientX) => {
    const b = svg.getBoundingClientRect(), vx = ((clientX - b.left) / b.width) * W;
    const t = x0 + ((vx - L) / (W - L - R)) * (x1 - x0);
    let k = 0; for (let j = 1; j < hist.length; j++) if (Math.abs(hist[j].t - t) < Math.abs(hist[k].t - t)) k = j;
    const h = hist[k], px = L + ((h.t - x0) / Math.max(1, x1 - x0)) * (W - L - R);
    cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
    const rows = S.players.map((p) => ({ p, v: (measure === 'cash' ? (h.cash ? h.cash[p.id] : 0) : h.worth[p.id]) ?? 0 })).sort((a, b) => b.v - a.v);
    tip.replaceChildren();
    const head = el('div', 'th'); head.textContent = `Tour ${h.t} · manche ${h.r}`; tip.appendChild(head);
    for (const r of rows) {
      const row = el('div', 'tr'); const key = el('i'); key.style.background = r.p.color;
      const v = el('b'); v.textContent = money(r.v); const n = el('span'); n.textContent = r.p.name;
      row.append(key, v, n); tip.appendChild(row);
    }
    tip.hidden = false;
    const left = (px / W) * b.width;
    tip.style.left = Math.min(b.width - 190, Math.max(0, left + 14)) + 'px';
  };
  svg.addEventListener('pointermove', (e) => show(e.clientX));
  svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
}

/* ------------------------------------------------------------- heatmap */
export function heatValues(S, board, mode) {
  if (mode === 'rent') return S.stats.rentBySpace.slice();
  if (mode === 'theory') return landingProbabilities(board).map((p) => p * 100);
  return S.stats.visits.slice();
}
const heatLabel = (mode, v) => (mode === 'rent' ? kfmt(v) : mode === 'theory' ? `${v.toFixed(1)} %` : String(v));

function pos(i) {
  if (i <= 10) return [11, 11 - i];
  if (i <= 20) return [11 - (i - 10), 1];
  if (i <= 30) return [1, 1 + (i - 20)];
  return [1 + (i - 30), 11];
}
function heatmap(S, board, mode) {
  const vals = heatValues(S, board, mode), max = Math.max(...vals);
  const cells = board.spaces.map((sp) => {
    const [r, c] = pos(sp.i), v = vals[sp.i], col = heatColor(v, max);
    const style = `grid-row:${r};grid-column:${c};${col ? `background:${col.bg};color:${col.ink}` : ''}`;
    const band = sp.type === 'street' ? `<i style="background:${sp.color}"></i>` : '';
    return `<button class="hc" style="${style}" data-i="${sp.i}" aria-label="${esc(sp.name)} : ${esc(heatLabel(mode, v))}">${band}<span>${esc(short(sp.name))}</span><b>${v ? esc(heatLabel(mode, v)) : '·'}</b></button>`;
  }).join('');
  const total = vals.reduce((a, b) => a + b, 0);
  const top = vals.map((v, i) => [i, v]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const title = { visits: 'Cases les plus visitées', rent: 'Propriétés les plus rentables', theory: 'Probabilité d\'arrivée (Markov)' }[mode];
  const unit = { visits: 'arrêts', rent: 'de loyers perçus', theory: 'des arrêts à long terme' }[mode];
  return `<div class="heatbox">
    <div class="hgrid">${cells}
      <div class="hmid"><h3>${title}</h3>
        <div class="scale">${HEAT.map((c) => `<i style="background:${c}"></i>`).join('')}</div><div class="scalel"><span>peu</span><span>beaucoup</span></div>
        ${top.length ? `<ol class="top">${top.map(([i, v]) => `<li><span>${esc(board.spaces[i].name)}</span><b>${esc(heatLabel(mode, v))}</b></li>`).join('')}</ol>` : '<p class="hint">Pas encore de données.</p>'}
        <p class="hint">${mode === 'theory' ? 'Calcul : chaîne de Markov du plateau (dés, cartes, prison).' : `Total : ${esc(heatLabel(mode, total))} ${unit}`}</p>
      </div></div>
    <div class="tip" hidden></div></div>`;
}
function wireHeat(box, board, S, mode) {
  const vals = heatValues(S, board, mode), tip = box.querySelector('.heatbox .tip'), wrap = box.querySelector('.heatbox');
  for (const c of box.querySelectorAll('.hc')) {
    const i = +c.dataset.i, sp = board.spaces[i];
    const show = () => {
      tip.replaceChildren();
      const v = el('b'); v.textContent = vals[i] ? heatLabel(mode, vals[i]) : '0';
      const n = el('span'); n.textContent = sp.name;
      const extra = el('small');
      const pr = S.props[i];
      if (pr) { const o = S.players.find((p) => p.id === pr.owner); extra.textContent = o ? 'À ' + o.name : 'À la banque'; }
      tip.append(v, n, extra); tip.hidden = false;
      const b = c.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      tip.style.left = Math.min(w.width - 200, Math.max(0, b.left - w.left)) + 'px';
      tip.style.top = (b.bottom - w.top + 6) + 'px';
    };
    c.addEventListener('pointerenter', show); c.addEventListener('focus', show);
    c.addEventListener('pointerleave', () => { tip.hidden = true; }); c.addEventListener('blur', () => { tip.hidden = true; });
  }
}

/* ------------------------------------------------------------- classement */
const COLS = [
  ['total', 'Patrimoine net'], ['cash', 'Liquide'], ['immo', 'Immobilier'], ['monopolies', 'Monopoles'],
  ['rentIn', 'Loyers perçus'], ['rentOut', 'Loyers payés'], ['net', 'Solde loyers'], ['dist', 'Distance'],
  ['jailTurns', 'Tours en prison'], ['goPassed', 'Passages Départ'], ['doubles', 'Doubles'], ['bought', 'Achats'], ['built', 'Bâtiments'],
];
function rankRows(S, board) {
  const order = S.over && S.ranking ? S.ranking : standings(S, board).map((r) => r.id);
  return order.map((id, k) => {
    const p = S.players.find((q) => q.id === id), w = netWorth(S, board, id), st = S.stats.players[id];
    return { k: k + 1, p, total: p.bankrupt ? 0 : w.total, cash: w.cash, immo: w.property + w.buildings, monopolies: w.monopolies,
      rentIn: st.rentIn, rentOut: st.rentOut, net: st.rentIn - st.rentOut, dist: st.dist, jailTurns: st.jailTurns, goPassed: st.goPassed,
      doubles: st.doubles, bought: st.bought, built: st.built };
  });
}
function rankTable(S, board, sort) {
  let rows = rankRows(S, board);
  if (sort) rows = [...rows].sort((a, b) => b[sort] - a[sort]);
  const fmt = (key, v) => (['total', 'cash', 'immo', 'rentIn', 'rentOut', 'net'].includes(key) ? money(v) : key === 'dist' ? `${v} cases` : String(v));
  return `<div class="tablewrap"><table class="rank stat"><thead><tr><th>#</th><th>Joueur</th>${COLS.map(([k, l]) => `<th><button data-sort="${k}" class="${sort === k ? 'on' : ''}">${l}</button></th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr class="${r.p.bankrupt ? 'out' : ''}"><td>${r.k}</td><td class="who"><i class="dot" style="background:${r.p.color}"></i>${esc(r.p.name)}${r.p.bankrupt ? ' <small>faillite</small>' : ''}</td>
      ${COLS.map(([k]) => `<td class="${k === 'net' ? (r.net >= 0 ? 'pos' : 'neg') : ''}">${fmt(k, r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="hint">Clique sur un intitulé pour trier. Le rang (#) suit le patrimoine net${S.over ? ' final' : ''}.</p>`;
}

/* ------------------------------------------------------------- analyse financière */
function analysis(S, board, pid) {
  const { rows, opponents } = propertyAnalysis(S, board, pid);
  const p = S.players.find((q) => q.id === pid);
  if (!rows.length) return `<p class="hint empty">${esc(p.name)} ne possède encore aucune propriété.</p>`;
  rows.sort((a, b) => b.ev - a.ev);
  const ev = rows.reduce((s, r) => s + r.ev, 0), inv = rows.reduce((s, r) => s + r.invested, 0);
  const best = rows.filter((r) => r.nextGain != null).sort((a, b) => b.nextGain - a.nextGain)[0];
  return `<div class="kpis"><div><small>Revenu espéré</small><b>${money(ev)}</b><span>par tour de table</span></div>
    <div><small>Capital investi</small><b>${money(inv)}</b><span>terrains + bâtiments</span></div>
    <div><small>Rendement</small><b>${inv ? pct(ev / inv, 2) : '—'}</b><span>par tour de table</span></div>
    <div><small>Rentabilisé en</small><b>${ev > 0 ? Math.round(inv / ev) + ' tours' : '—'}</b><span>au rythme actuel</span></div></div>
    ${best ? `<p class="tipline">💡 Meilleur prochain investissement : une maison sur <b>${esc(best.name)}</b> rapporte environ <b>${pct(best.nextGain, 1)}</b> de son coût par tour de table.</p>` : ''}
    <div class="tablewrap"><table class="rank stat"><thead><tr><th>Propriété</th><th>P(arrivée)</th><th>Loyer actuel</th><th>Revenu espéré / tour</th><th>Investi</th><th>Rendement / tour</th><th>Rentabilisé en</th><th>+1 bâtiment</th></tr></thead>
    <tbody>${rows.map((r) => `<tr class="${r.mortgaged ? 'out' : ''}"><td class="who"><i class="chip" style="background:${r.color}"></i>${esc(r.name)}${r.mortgaged ? ' <small>hypothéquée</small>' : ''}</td>
      <td>${pct(r.p, 2)}</td><td>${money(r.rent)}</td><td>${money(r.ev)}</td><td>${money(r.invested)}</td><td>${pct(r.roi, 2)}</td>
      <td>${Number.isFinite(r.payback) ? Math.round(r.payback) + ' tours' : '—'}</td><td>${r.nextGain != null ? '+' + pct(r.nextGain, 1) : '—'}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">Modèle : probabilité d'arrêt à long terme (chaîne de Markov : dés, cartes, prison), loyers actuels, ${opponents} adversaire${opponents > 1 ? 's' : ''} en lice.
    Les compagnies sont estimées avec une somme moyenne de 7 aux dés. « +1 bâtiment » : revenu supplémentaire par tour rapporté au coût d'une maison.</p>`;
}

/* ------------------------------------------------------------- fenêtre */
export function openStats(M, board, getState, me, { onHeat, heatMode }) {
  let tab = 'worth', measure = 'worth', mode = heatMode || 'visits', sort = null;
  let who = me.id;
  const draw = () => {
    const S = getState();
    if (!S.players.some((p) => p.id === who)) who = S.players[0].id;
    const tabs = [['worth', 'Patrimoine'], ['heat', 'Plateau'], ['rank', 'Classement'], ['fin', 'Analyse financière']];
    let body = '';
    if (tab === 'worth') {
      body = `<div class="filters"><div class="seg">${[['worth', 'Patrimoine net'], ['cash', 'Liquide']].map(([k, l]) => `<button data-m="${k}" class="${measure === k ? 'sel' : ''}">${l}</button>`).join('')}</div>
        <div class="legend">${S.players.map((p) => `<span><i style="background:${p.color}"></i>${esc(p.name)}</span>`).join('')}</div></div>${lineChart(S, measure)}
        <div class="kpis live">${rankRows(S, board).map((r) => `<div><small><i class="dot" style="background:${r.p.color}"></i>${esc(r.p.name)}</small><b>${money(r.total)}</b><span>liquide ${money(r.cash)} · immo ${money(r.immo)} · ♛ ${r.monopolies}</span></div>`).join('')}</div>`;
    } else if (tab === 'heat') {
      body = `<div class="filters"><div class="seg">${[['visits', 'Visites'], ['rent', 'Loyers perçus'], ['theory', 'Probabilité théorique']].map(([k, l]) => `<button data-h="${k}" class="${mode === k ? 'sel' : ''}">${l}</button>`).join('')}</div>
        <button class="btn small yellow" id="heatOn">Afficher sur le plateau</button></div>${heatmap(S, board, mode)}`;
    } else if (tab === 'rank') body = rankTable(S, board, sort);
    else {
      body = `<div class="filters"><div class="seg">${S.players.map((p) => `<button data-who="${p.id}" class="${who === p.id ? 'sel' : ''}"><i style="background:${p.color}"></i>${esc(p.name)}</button>`).join('')}</div></div>${analysis(S, board, who)}`;
    }
    const box = M.open('stats', `<h2>Statistiques ${S.over ? 'de la partie' : 'en direct'}</h2>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="tabbody">${body}</div>`, { cls: 'stats' });
    for (const b of box.querySelectorAll('[data-tab]')) b.onclick = () => { tab = b.dataset.tab; draw(); };
    for (const b of box.querySelectorAll('[data-m]')) b.onclick = () => { measure = b.dataset.m; draw(); };
    for (const b of box.querySelectorAll('[data-h]')) b.onclick = () => { mode = b.dataset.h; draw(); };
    for (const b of box.querySelectorAll('[data-who]')) b.onclick = () => { who = +b.dataset.who; draw(); };
    for (const b of box.querySelectorAll('[data-sort]')) b.onclick = () => { sort = sort === b.dataset.sort ? null : b.dataset.sort; draw(); };
    const ho = box.querySelector('#heatOn'); if (ho) ho.onclick = () => { onHeat(mode); M.close(true); };
    if (tab === 'worth') wireLine(box, S, measure);
    if (tab === 'heat') wireHeat(box, board, S, mode);
  };
  draw();
  return { refresh: () => { if (M.key === 'stats') draw(); } };
}

export { heatLabel };
