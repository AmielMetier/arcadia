// Tableau de bord : série, courbes (une valeur par jour joué), historique, export et import. Tout reste dans le navigateur.
import { CURVES, series } from '../engine/stats.js';
import { parse, MAX_BYTES } from '../engine/save.js';
import { dayKey } from '../engine/days.js';
import { store } from './store.js';
import { ask, dayStreak } from './screens.js';

const TITLES = { pulse: 'Pulse', aiguillage: 'Aiguillage', reseau: 'Réseau', double: 'Double Tempo' };
const SOURCES = { rt: 'Aiguillage, Réseau et Double Tempo', lure: 'Pulse', switch: 'Aiguillage', rhythm: 'Pulse et Double Tempo' };
const shortDay = (k) => { const [, m, d] = k.split('-'); return `${d}/${m}`; };

function chart(c) {
  const pts = series(store.data.history, c.key).slice(-60);
  if (!pts.length) return `<figure class="chart"><figcaption>${c.title} <span>(${c.unit})</span></figcaption><p class="empty">Pas encore de données. Jouer à ${SOURCES[c.key]} pour voir cette courbe.</p></figure>`;
  const W = 340, H = 150, px = 34, py = 16;
  const vs = pts.map((p) => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (c.unit === '%') { lo = Math.min(lo, 0); hi = Math.max(hi, 100); }
  if (hi - lo < 1) { lo -= 1; hi += 1; }
  const x = (i) => (pts.length === 1 ? W / 2 : px + (i * (W - px - 10)) / (pts.length - 1));
  const y = (v) => H - py - ((v - lo) / (hi - lo)) * (H - 2 * py);
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return `<figure class="chart"><figcaption>${c.title} <span>(${c.unit})</span><b>${last.v} ${c.unit}</b></figcaption>
    <svg viewBox="0 0 ${W} ${H + 18}" role="img" aria-label="${c.title} : ${pts.length} jours, dernière valeur ${last.v} ${c.unit}">
      <line x1="${px}" x2="${W - 6}" y1="${y(hi)}" y2="${y(hi)}" class="gl"/><line x1="${px}" x2="${W - 6}" y1="${y(lo)}" y2="${y(lo)}" class="gl"/>
      <text x="${px - 6}" y="${y(hi) + 4}" class="ax" text-anchor="end">${Math.round(hi)}</text><text x="${px - 6}" y="${y(lo) + 4}" class="ax" text-anchor="end">${Math.round(lo)}</text>
      <polyline points="${line}" class="ln"/>
      ${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.5" class="pt"><title>${shortDay(p.day)} : ${p.v} ${c.unit}</title></circle>`).join('')}
      <text x="${x(0)}" y="${H + 12}" class="ax" text-anchor="${pts.length === 1 ? 'middle' : 'start'}">${shortDay(pts[0].day)}</text>
      ${pts.length > 1 ? `<text x="${x(pts.length - 1)}" y="${H + 12}" class="ax" text-anchor="end">${shortDay(last.day)}</text>` : ''}
    </svg></figure>`;
}

function historyRows(tbody) {
  tbody.textContent = '';
  const games = store.data.history.slice(-15).reverse();
  if (!games.length) { const tr = tbody.insertRow(); const td = tr.insertCell(); td.colSpan = 6; td.textContent = 'Aucune partie terminée pour l\'instant.'; return; }
  for (const g of games) {
    const tr = tbody.insertRow();
    const d = new Date(g.at);
    const cells = [`${shortDay(g.day)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, TITLES[g.mode] + (g.session ? ' (session)' : ''), `${Math.round(g.dur)} s`, g.score, `${g.acc} %`, `${g.lv0} → ${g.lv1}`];
    for (const c of cells) tr.insertCell().textContent = String(c);
  }
}

export function showBoard(root, { back }) {
  const render = () => {
    const h = store.data.history, s = dayStreak();
    root.innerHTML = `<section class="board">
      <header class="board-head"><h2>Tableau de bord</h2><button type="button" data-go="menu">Menu</button></header>
      <div class="board-top">
        <div class="kpi"><span>Série de jours</span><b>${s}</b></div>
        <div class="kpi"><span>Parties terminées</span><b>${h.length}</b></div>
        <div class="kpi levels"><span>Niveaux enregistrés</span><p>${Object.entries(TITLES).map(([k, t]) => `${t} <b>${store.data.levels[k]}</b>`).join(' · ')}</p></div>
      </div>
      <div class="charts">${CURVES.map(chart).join('')}</div>
      <div class="board-bottom">
        <div class="hist"><h3>Dernières parties</h3><table class="tbl"><thead><tr><th>Date</th><th>Épreuve</th><th>Durée</th><th>Score</th><th>Réussite</th><th>Niveau</th></tr></thead><tbody></tbody></table></div>
        <div class="data"><h3>Données</h3><p>Tout reste dans ce navigateur : rien n'est envoyé ailleurs.</p>
          <div class="row col"><button type="button" data-act="export">Exporter</button><button type="button" data-act="import">Importer</button><button type="button" class="danger" data-act="clear">Tout effacer</button></div>
          <input type="file" accept="application/json,.json" hidden>
          <p class="msg" role="status"></p></div>
      </div></section>`;
    historyRows(root.querySelector('tbody'));
    root.querySelector('[data-go="menu"]').focus({ preventScroll: true });
  };
  render();
  const msg = (t) => { root.querySelector('.msg').textContent = t; };

  root.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.go === 'menu') return back();
    const act = b.dataset.act;
    if (act === 'export') {
      const url = URL.createObjectURL(new Blob([JSON.stringify(store.data, null, 1)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = `synapse-${dayKey(new Date())}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      msg('Fichier exporté.');
    } else if (act === 'import') root.querySelector('input[type=file]').click();
    else if (act === 'clear') {
      if (await ask('Effacer toutes les données de ce navigateur : niveaux, réglages et historique ? Cette action est définitive.', 'Tout effacer')) { store.clear(); render(); msg('Données effacées.'); }
    }
  };
  root.onchange = async (e) => {
    const input = e.target;
    if (input.type !== 'file' || !input.files[0]) return;
    const file = input.files[0];
    input.value = '';
    if (file.size > MAX_BYTES) return msg('Fichier refusé : il est trop volumineux.');
    const r = parse(await file.text());
    if (!r.ok) return msg('Fichier refusé : ' + r.error + '.');
    const n = r.data.history.length;
    if (!(await ask(`Remplacer les données de ce navigateur par celles du fichier (${n} partie${n > 1 ? 's' : ''}) ?`, 'Remplacer'))) return msg('Import annulé.');
    store.replace(r.data); render(); msg('Données importées.');
  };
  return { render };
}
