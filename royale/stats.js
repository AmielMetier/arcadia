// Statistiques des parties : lit le journal (journal.js), le résume et place sur la carte de l'île les atterrissages
// des joueurs et les éliminations. Exporte le journal en fichier et y fusionne ceux des amis.
import { generateMap, CELL, ILE } from './engine/map.js';
import { terrainImage, drawMap } from './view/maprender.js';
import { loadJournal, saveJournal } from './journal.js';

const $ = (s) => document.querySelector(s);
const cv = $('#map'), ctx = cv.getContext('2d');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = (s) => `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')}`;
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const WEAPON = { fusil: 'Fusil d\'assaut', pompe: 'Fusil à pompe', pistolet: 'Pistolet', smg: 'Pistolet-mitrailleur', sniper: 'Fusil de précision',
  roquette: 'Lance-roquettes', grenade: 'Grenade', pioche: 'Pioche', tempete: 'Tempête', chute: 'Chute', depart: 'Départ' };
const TEAMS = { 1: 'solo', 2: 'duos', 3: 'trios' };
const PERIODS = [['tout', 'Tout'], ['jour', 'Aujourd\'hui'], ['10', '10 dernières']];
const st = { list: loadJournal(), period: 'tout', map: null, terrain: null, mapSeed: null, box: null };

// ------------------------------------------------------------------ lecture du journal
function shown() {
  if (st.period === '10') return st.list.slice(0, 10);
  if (st.period === 'jour') { const d = new Date(); d.setHours(0, 0, 0, 0); return st.list.filter((m) => m.at >= d.getTime()); }
  return st.list;
}
// comment un joueur a fini sa partie
function fate(p, m) {
  if (p.out == null) return m.end === 'abandon' ? 'quitte' : 'vivant';
  if (p.how === 'depart') return 'quitte';
  if (p.how === 'tempete') return 'tempete';
  if (p.how === 'chute') return 'chute';
  return p.by === 'h' ? 'joueur' : 'bot';
}
const FATES = [['bot', 'Par un bot', 'var(--c-bot)'], ['joueur', 'Par un joueur', 'var(--c-hum)'], ['tempete', 'Tempête', 'var(--c-storm)'],
  ['chute', 'Chute', 'var(--c-fall)'], ['quitte', 'Partie quittée', 'var(--c-left)'], ['vivant', 'Jusqu\'au bout', 'var(--c-alive)']];

function render() {
  $('#period').innerHTML = PERIODS.map(([k, l]) => `<button data-p="${k}" aria-pressed="${st.period === k}">${l}</button>`).join('');
  const list = shown(), el = $('#content');
  if (!list.length) {
    el.innerHTML = `<div class="card"><p class="empty">${st.list.length ? 'Aucune partie sur cette période.' : 'Aucune partie enregistrée dans ce navigateur. Héberge (ou joue seul) une partie d\'Island Rush jusqu\'au bout ou jusqu\'à l\'abandon : elle apparaîtra ici.'}</p></div>`;
    paint();
    return;
  }
  const done = list.filter((m) => m.end === 'fin'), people = list.flatMap((m) => (m.people || []).map((p) => ({ ...p, m })));
  const placed = people.filter((p) => p.place != null), wins = placed.filter((p) => p.place === 1 && p.m.end === 'fin').length;
  const shots = people.reduce((a, p) => a + (p.shots || 0), 0), hits = people.reduce((a, p) => a + (p.hits || 0), 0);
  const early = people.filter((p) => p.out != null && p.how !== 'depart' && p.out < 180).length;
  const stats = [
    [list.length, `parties${list.length - done.length ? ` · ${list.length - done.length} abandonnée${list.length - done.length > 1 ? 's' : ''}` : ''}`],
    [done.length ? mmss(avg(done.map((m) => m.dur))) : '—', 'durée moyenne d\'une partie'],
    [placed.length ? Math.round(avg(placed.map((p) => p.place))) + 'e' : '—', `place moyenne des joueurs (sur ${Math.round(avg(list.map((m) => m.places)))})`],
    [wins, `victoire${wins > 1 ? 's' : ''} de joueurs`],
    [people.length ? avg(people.map((p) => p.kills || 0)).toFixed(1) : '—', 'éliminations par joueur et par partie'],
    [shots ? Math.round(100 * hits / shots) + ' %' : '—', 'des tirs des joueurs touchent'],
    [people.length ? Math.round(100 * early / people.length) + ' %' : '—', 'des joueurs tombent avant 3 min'],
    [avgLanding(people), 'de la montgolfière au sol'],
  ];
  // comment tombent les joueurs
  const count = Object.fromEntries(FATES.map(([k]) => [k, 0]));
  for (const p of people) count[fate(p, p.m)]++;
  const fates = FATES.filter(([k]) => count[k]);
  // quand : par minute, joueurs et tous
  const mins = Math.max(1, ...list.map((m) => Math.ceil((m.dur || 0) / 60)));
  const hum = new Array(mins).fill(0), all = new Array(mins).fill(0);
  for (const p of people) if (p.out != null && p.how !== 'depart') hum[Math.min(mins - 1, Math.floor(p.out / 60))]++;
  for (const m of list) for (const d of m.deaths || []) all[Math.min(mins - 1, Math.floor(d[0] / 60))]++;
  const top = Math.max(1, ...all), topH = Math.max(1, ...hum);
  // armes des éliminations (tout le monde)
  const weapons = {};
  for (const m of list) for (const d of m.deaths || []) if (d[5] && d[5] !== 'depart') weapons[d[5]] = (weapons[d[5]] || 0) + 1;
  const wl = Object.entries(weapons).sort((a, b) => b[1] - a[1]), wTop = wl.length ? wl[0][1] : 1;
  const wTot = wl.reduce((a, [, n]) => a + n, 0);
  el.innerHTML = `
    <div class="card"><h2>En bref</h2><div class="stats">${stats.map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('')}</div></div>
    <div class="card"><h2>Comment finissent les joueurs</h2>
      <div class="bar">${fates.map(([k, , c]) => `<i style="--c:${c};width:${(100 * count[k] / people.length).toFixed(1)}%"></i>`).join('')}</div>
      <div class="barlegend">${fates.map(([k, l, c]) => `<span style="--c:${c}">${l} · ${count[k]}</span>`).join('')}</div></div>
    <div class="card"><h2>À quelle minute tombent les joueurs</h2>
      <div class="hist">${hum.map((n, i) => `<div><i style="--c:var(--c-bot);height:${(100 * n / topH).toFixed(0)}%" title="${n} joueur(s) à la ${i + 1}e minute"></i><small>${i}</small></div>`).join('')}</div>
      <p class="hint">Et toutes les éliminations, bots compris, minute par minute (le rythme d'une partie) :</p>
      <div class="hist">${all.map((n, i) => `<div><i style="--c:var(--c-left);height:${(100 * n / top).toFixed(0)}%" title="${n} élimination(s) à la ${i + 1}e minute"></i><small>${i}</small></div>`).join('')}</div></div>
    <div class="card"><h2>Éliminations par arme</h2>
      <div class="lines">${wl.map(([w, n]) => `<div class="l"><span>${WEAPON[w] || esc(w)}</span><i style="--c:${w === 'tempete' ? 'var(--c-storm)' : 'var(--accent)'};width:${(100 * n / wTop).toFixed(0)}%"></i><em>${Math.round(100 * n / wTot)} %</em></div>`).join('')}</div></div>
    <div class="card"><h2>Dernières parties</h2><ul class="games">${list.slice(0, 12).map(gameLine).join('')}</ul></div>`;
  paint();
}
function avgLanding(people) {
  const l = people.filter((p) => p.jump != null && p.land).map((p) => p.land[2] - p.jump);
  return l.length ? Math.round(avg(l)) + ' s' : '—';
}
function gameLine(m) {
  const d = new Date(m.at), when = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const who = (m.people || []).map((p) => {
    const f = fate(p, m), end = f === 'vivant' ? (p.place === 1 ? 'gagne' : 'en vie') : f === 'quitte' ? 'parti' : `${p.place}e, ${(FATES.find(([k]) => k === f) || [])[1].toLowerCase()}${p.out != null ? ' à ' + mmss(p.out) : ''}`;
    return `${esc(p.name)} : ${end}, ${p.kills || 0} élim.`;
  }).join(' · ');
  return `<li><span>${when} · ${m.places} joueurs, ${TEAMS[m.teams] || 'solo'}</span><span>${m.end === 'abandon' ? 'abandonnée' : mmss(m.dur)}</span><small>${who || 'aucun joueur humain'}</small></li>`;
}

// ------------------------------------------------------------------ carte
async function prepareMap() {
  const list = shown(), seeds = new Map();
  for (const m of list) seeds.set(m.map || ILE, (seeds.get(m.map || ILE) || 0) + 1);
  const seed = [...seeds.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ILE;
  if (seed === st.mapSeed) return;
  $('#busy').hidden = false;
  await new Promise((r) => setTimeout(r, 30));
  st.map = generateMap(seed); st.mapSeed = seed;
  st.terrain = terrainImage(st.map, { ppm: 0.5 });
  let x0 = st.map.size, z0 = st.map.size, x1 = 0, z1 = 0;
  for (let c = 0; c < st.map.gn * st.map.gn; c++) {
    if (st.map.ground[c] === 0) continue;
    const i = c % st.map.gn, j = (c - i) / st.map.gn;
    x0 = Math.min(x0, i); x1 = Math.max(x1, i + 1); z0 = Math.min(z0, j); z1 = Math.max(z1, j + 1);
  }
  st.box = { x0: x0 * CELL, z0: z0 * CELL, x1: x1 * CELL, z1: z1 * CELL };
  $('#busy').hidden = true;
}
function paint() {
  if (!st.map) return;
  const r = cv.getBoundingClientRect(), w = r.width, h = r.height, dpr = Math.min(2, devicePixelRatio || 1);
  if (w < 10 || h < 10) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const b = st.box, s = Math.min(w / (b.x1 - b.x0 + 60), h / (b.z1 - b.z0 + 60)), view = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, s, w, h, dpr };
  drawMap(ctx, st.map, st.terrain, view, { layers: { relief: true, routes: true, batiments: true, vegetation: true, noms: true }, level: 0 });
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const at = (x, z) => [(x - view.x) * s + w / 2, (z - view.z) * s + h / 2];
  // (des formes à part, pour ne pas les confondre avec les pastilles des lieux) bot éliminé : petit point ; atterrissage
  // d'un joueur : losange ; joueur éliminé : croix
  const dot = (x, z, r, c) => { const [px, pz] = at(x, z); ctx.beginPath(); ctx.arc(px, pz, r, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); };
  const diamond = (x, z, r, c) => {
    const [px, pz] = at(x, z);
    ctx.beginPath(); ctx.moveTo(px, pz - r); ctx.lineTo(px + r, pz); ctx.lineTo(px, pz + r); ctx.lineTo(px - r, pz); ctx.closePath();
    ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#16181d'; ctx.stroke();
  };
  const cross = (x, z, r, c) => {
    const [px, pz] = at(x, z);
    ctx.beginPath(); ctx.moveTo(px - r, pz - r); ctx.lineTo(px + r, pz + r); ctx.moveTo(px + r, pz - r); ctx.lineTo(px - r, pz + r);
    ctx.lineCap = 'round'; ctx.lineWidth = 5.5; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = c; ctx.stroke();
  };
  const css = getComputedStyle(document.documentElement), col = (v) => css.getPropertyValue(v).trim();
  const list = shown().filter((m) => (m.map || ILE) === st.mapSeed);
  ctx.globalAlpha = 0.7;
  for (const m of list) for (const d of m.deaths || []) if (!d[3] && d[5] !== 'depart') dot(d[1], d[2], 2.4, '#3a3f47');
  ctx.globalAlpha = 1;
  for (const m of list) for (const p of m.people || []) if (p.land) diamond(p.land[0], p.land[1], 6, col('--c-land'));
  for (const m of list) for (const d of m.deaths || []) if (d[3] && d[5] !== 'depart') cross(d[1], d[2], 5, col('--c-bot'));
}

// ------------------------------------------------------------------ journal : exporter, ajouter, effacer
$('#period').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  st.period = b.dataset.p;
  await prepareMap(); render();
});
$('#export').onclick = () => {
  const blob = new Blob([JSON.stringify(st.list, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'), d = new Date();
  a.href = URL.createObjectURL(blob); a.download = `island-rush-journal-${d.toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$('#import').onclick = () => $('#file').click();
$('#file').onchange = async () => {
  const f = $('#file').files[0];
  if (!f) return;
  try {
    const more = JSON.parse(await f.text());
    if (!Array.isArray(more)) throw new Error('format');
    const before = st.list.length;
    st.list = saveJournal([...st.list, ...more.filter((m) => m && m.id != null && Array.isArray(m.people))]);
    $('#note').textContent = `${st.list.length - before} partie(s) ajoutée(s) depuis ${f.name}.`;
  } catch (e) { $('#note').textContent = 'Ce fichier n\'est pas un journal d\'Island Rush.'; }
  $('#file').value = '';
  await prepareMap(); render();
};
$('#clear').onclick = async () => {
  if (!confirm('Effacer toutes les parties de ce journal ?')) return;
  st.list = saveJournal([]);
  render();
};
addEventListener('resize', paint);
// une partie finie dans un autre onglet : on la voit en revenant ici
addEventListener('storage', async (e) => { if (e.key === 'royale_journal') { st.list = loadJournal(); await prepareMap(); render(); } });

render();
await prepareMap();
render();
