// Aperçu de l'île en 2D : générer une île à partir d'une graine, la parcourir (molette, glisser), voir les plans des
// bâtiments étage par étage, la tempête phase par phase et le trajet de la montgolfière.
import { generateMap, planStorm, planFlight, CELL, STOREY, GROUND, MATS, ILE } from './engine/map.js';
import { terrainImage, drawMap, gridRef, buildingAt, POI_COLORS } from './view/maprender.js';

const $ = (s) => document.querySelector(s);
const cv = $('#map'), ctx = cv.getContext('2d');
const LAYERS = [
  ['relief', 'Relief', true], ['courbes', 'Courbes de niveau', false], ['routes', 'Routes', true], ['batiments', 'Bâtiments', true],
  ['vegetation', 'Arbres et rochers', true], ['vehicules', 'Véhicules', true], ['coffres', 'Coffres', true], ['butin', 'Butin au sol', false],
  ['noms', 'Noms', true], ['grille', 'Grille', true], ['tempete', 'Tempête', false], ['vol', 'Montgolfière', false],
];
const st = {
  map: null, terrain: null, view: { x: 700, z: 700, s: 0.5 }, layers: Object.fromEntries(LAYERS.map(([k, , v]) => [k, v])),
  storm: null, flight: null, stormSeed: 1, phase: 0, level: 0, sel: null, hover: null, box: null,
};
const fmt = (n) => n.toLocaleString('fr-FR');
const pct = (v) => Math.round(v * 100) + ' %';
const ORD = ['RDC', '1er', '2e', '3e', '4e'];
const MAX_S = 14;

// ------------------------------------------------------------------ génération
async function build(seed) {
  $('#busy').hidden = false;
  await new Promise((r) => setTimeout(r, 30)); // laisse le message s'afficher
  st.map = generateMap(seed);
  st.terrain = terrainImage(st.map, { contours: st.layers.courbes });
  st.stormSeed = seed * 31 + 7;
  plan();
  st.sel = null; st.hover = null;
  st.box = islandBox(st.map);
  $('#seed').value = seed;
  history.replaceState(null, '', '#graine=' + seed);
  renderSide();
  fit(false);
  $('#busy').hidden = true;
}
function plan() {
  st.storm = planStorm(st.map, st.stormSeed);
  st.flight = planFlight(st.map, st.stormSeed);
  const ph = $('#phase');
  ph.max = st.storm.length - 1;
  st.phase = Math.min(st.phase, st.storm.length - 1);
  ph.value = st.phase;
  phaseText();
}
function islandBox(map) {
  let x0 = map.size, z0 = map.size, x1 = 0, z1 = 0;
  for (let c = 0; c < map.gn * map.gn; c++) {
    if (map.ground[c] === 0) continue;
    const i = c % map.gn, j = (c - i) / map.gn;
    x0 = Math.min(x0, i); x1 = Math.max(x1, i + 1); z0 = Math.min(z0, j); z1 = Math.max(z1, j + 1);
  }
  return { x0: x0 * CELL, z0: z0 * CELL, x1: x1 * CELL, z1: z1 * CELL };
}

// ------------------------------------------------------------------ dessin
let pending = false;
function draw() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; paint(); });
}
function size() {
  const r = cv.getBoundingClientRect();
  return { w: r.width, h: r.height };
}
function paint() {
  if (!st.map) return;
  const { w, h } = size(), dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  drawMap(ctx, st.map, st.terrain, { ...st.view, w, h, dpr }, {
    layers: st.layers, storm: st.storm, phase: st.phase, flight: st.flight, level: st.level, sel: st.sel, hover: st.hover,
  });
  // échelle : une longueur ronde d'environ 100 px
  const m = [10, 20, 50, 100, 200, 500].find((v) => v * st.view.s >= 70) || 500;
  $('#scale').innerHTML = `${m} m<i style="width:${Math.round(m * st.view.s)}px"></i>`;
}

// ------------------------------------------------------------------ vue : zoom, déplacement, vols
const clampS = (s) => Math.max(minS(), Math.min(MAX_S, s));
function minS() { const { w, h } = size(); return Math.min(w, h) / (st.map ? st.map.size * 1.1 : 1400); }
function fit(anim = true) {
  const b = st.box, { w, h } = size();
  if (w < 10 || h < 10) return;
  const s = Math.min(w / (b.x1 - b.x0 + 80), h / (b.z1 - b.z0 + 80));
  go({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, s }, anim);
}
let anim = null;
function go(to, animate = true) {
  if (!animate) { st.view = { ...to }; draw(); return; }
  const from = { ...st.view }, t0 = performance.now(), T = 450;
  cancelAnimationFrame(anim);
  const step = () => {
    const t = Math.min(1, (performance.now() - t0) / T), e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    // zoom interpolé en logarithme : le mouvement paraît régulier
    st.view = { x: from.x + (to.x - from.x) * e, z: from.z + (to.z - from.z) * e, s: Math.exp(Math.log(from.s) + (Math.log(to.s) - Math.log(from.s)) * e) };
    paint();
    if (t < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}
function zoomAt(sx, sy, f) {
  const { w, h } = size(), v = st.view;
  const wx = v.x + (sx - w / 2) / v.s, wz = v.z + (sy - h / 2) / v.s, s = clampS(v.s * f);
  st.view = { x: wx - (sx - w / 2) / s, z: wz - (sy - h / 2) / s, s };
  draw();
}
const toWorld = (e) => {
  const r = cv.getBoundingClientRect(), v = st.view;
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  return { sx, sy, x: v.x + (sx - r.width / 2) / v.s, z: v.z + (sy - r.height / 2) / v.s };
};
let drag = null;
cv.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, vx: st.view.x, vz: st.view.z, moved: false };
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', (e) => {
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; cv.classList.add('dragging'); $('#tip').hidden = true; }
    if (drag.moved) { st.view.x = drag.vx - dx / st.view.s; st.view.z = drag.vz - dy / st.view.s; draw(); return; }
  }
  hover(e);
});
cv.addEventListener('pointerup', (e) => {
  const click = drag && !drag.moved;
  drag = null; cv.classList.remove('dragging');
  if (click) select(e);
});
cv.addEventListener('pointerleave', () => { $('#tip').hidden = true; if (st.hover) { st.hover = null; draw(); } });
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = toWorld(e);
  zoomAt(p.sx, p.sy, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)));
}, { passive: false });
cv.addEventListener('dblclick', (e) => { const p = toWorld(e); zoomAt(p.sx, p.sy, 2.2); });
$('#zin').onclick = () => { const { w, h } = size(); zoomAt(w / 2, h / 2, 1.8); };
$('#zout').onclick = () => { const { w, h } = size(); zoomAt(w / 2, h / 2, 1 / 1.8); };
$('#zfit').onclick = () => fit();
// tant qu'on n'a pas touché à la vue, elle suit la taille du cadre (au premier affichage, il peut être encore vide)
let touched = false;
new ResizeObserver(() => { if (st.map && !touched) fit(false); else draw(); }).observe(cv);
for (const ev of ['pointerdown', 'wheel']) cv.addEventListener(ev, () => { touched = true; }, { passive: true });

// ------------------------------------------------------------------ survol et sélection
function hover(e) {
  if (!st.map) return;
  const p = toWorld(e), m = st.map, tip = $('#tip');
  if (p.x < 0 || p.z < 0 || p.x > m.size || p.z > m.size) { tip.hidden = true; return; }
  const b = buildingAt(m, p.x, p.z);
  if (b !== st.hover) { st.hover = b; draw(); }
  const poi = m.poiAt(p.x, p.z), g = GROUND[m.groundAt(p.x, p.z)];
  const alt = Math.max(0, Math.round(m.heightAt(p.x, p.z)));
  let html = `<b>${gridRef(m, p.x, p.z)}</b> · ${g} · ${alt} m`;
  if (poi) html += `\n<b>${poi.name}</b> · ${poi.label}`;
  if (b) html += `\n${b.label} · ${b.floors > 1 ? b.floors + ' niveaux' : 'plain-pied'} · ${b.chests.length} coffre${b.chests.length > 1 ? 's' : ''}`;
  tip.innerHTML = html;
  tip.hidden = false;
  const r = cv.getBoundingClientRect();
  tip.style.left = Math.min(p.sx + 16, r.width - tip.offsetWidth - 8) + 'px';
  tip.style.top = Math.min(p.sy + 16, r.height - tip.offsetHeight - 8) + 'px';
}
function select(e) {
  const p = toWorld(e), b = buildingAt(st.map, p.x, p.z);
  st.sel = b;
  showBuilding(b);
  if (b && st.view.s < 2.6) go({ x: (b.x0 + b.w / 2) * CELL, z: (b.z0 + b.d / 2) * CELL, s: Math.max(st.view.s, 5) });
  draw();
}
function showBuilding(b) {
  const card = $('#selCard');
  card.hidden = !b;
  if (!b) return;
  const poi = b.poi >= 0 ? st.map.pois[b.poi] : null;
  const ext = (k) => b.levels.reduce((n, l) => n + l.walls.filter((e) => e.ext && e.k === k).length, 0);
  $('#selTitle').textContent = b.label + (poi ? ' · ' + poi.name : ' isolée');
  const rows = [
    ['Emprise', `${b.w} × ${b.d} cases (${b.w * CELL} × ${b.d * CELL} m)`],
    ['Niveaux', b.floors > 1 ? `${b.floors} (${(b.floors * STOREY).toFixed(1).replace('.', ',')} m)` : 'plain-pied'],
    ['Matériau', MATS[b.mat] + (b.abandoned ? ' · murs cassés' : '')],
    ['Toit', b.roof === 'plat' ? (b.roofHatch ? 'plat, accessible' : 'plat') : b.roof === 'phare' ? 'lanterne du phare' : 'en pente'],
    ['Pièces', b.levels.map((l, i) => `${ORD[i] || i + 'e'} ${l.rooms.length}`).join(' · ')],
    ['Ouvertures', `${ext('porte') + ext('portail')} porte${ext('porte') + ext('portail') > 1 ? 's' : ''}, ${ext('fenetre')} fenêtres${ext('casse') ? ', ' + ext('casse') + ' trous' : ''}`],
    ['Escalier', b.stairs ? 'oui' + (b.roofHatch ? ', jusqu\'au toit' : '') : 'non'],
    ['Butin', `${b.chests.length} coffre${b.chests.length > 1 ? 's' : ''}, ${b.loot.length} au sol${b.ammo.length ? ', munitions' : ''}`],
  ];
  $('#selInfo').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

// ------------------------------------------------------------------ panneau
function renderSide() {
  const m = st.map, S = m.stats, P = S.props;
  const trees = (P.arbre || 0) + (P.sapin || 0), cars = (P.voiture || 0) + (P.camion || 0) + (P.tracteur || 0) + (P.engin || 0);
  const hidden = m.chests.filter((c) => c.k < 0).length;
  const items = [
    ['Île', `${S.islandKm2.toFixed(2).replace('.', ',')} km²`, `${fmt(S.spanM)} m d'un bout à l'autre`],
    ['À pied', `${Math.floor(S.spanM / 5.5 / 60)} min ${String(Math.round(S.spanM / 5.5) % 60).padStart(2, '0')}`, 'pour la traverser (5,5 m/s)'],
    ['Nature', pct(S.nature), `forêt ${pct(S.forest)} · montagne ${pct(S.mountain)}`],
    ['Lieux', `${S.towns} + ${S.lieuxDits}`, 'villes et villages + lieux-dits'],
    ['Bâtiments', fmt(S.buildings), `dont ${S.byType.abandonnee || 0} maisons abandonnées`],
    ['Coffres', fmt(S.chests), `dont ${hidden} cachés dans la nature`],
    ['Butin au sol', fmt(S.loot), `${S.ammo} caisses de munitions`],
    ['Arbres', fmt(trees), `${fmt(P.rocher || 0)} rochers à casser`],
    ['Véhicules', fmt(cars), `${P.conteneur || 0} conteneurs`],
    ['Routes', `${S.roadKm.toFixed(1).replace('.', ',')} km`, `${S.bridges} pont${S.bridges > 1 ? 's' : ''}`],
  ];
  $('#stats').innerHTML = items.map(([k, v, sub]) => `<div class="stat"><span>${k}</span><b>${v}</b><span>${sub}</span></div>`).join('')
    + `<div class="stat" style="grid-column:1/-1"><span>Généré en ${m.ms} ms · empreinte ${m.hash.toString(16)}</span></div>`;
  const parts = [['Nature', S.nature, '#5c9c44'], ['Villes et villages', S.urban, '#e8473a'], ['Lieux-dits et champs', S.lieux, '#f2c14e'], ['Routes', S.roads, '#b9ab8c']];
  $('#bar').innerHTML = parts.map(([, v, c]) => `<i style="width:${v * 100}%;background:${c}"></i>`).join('');
  $('#barlegend').innerHTML = parts.map(([k, v, c]) => `<span style="--c:${c}">${k} ${pct(v)}</span>`).join('');

  const order = { ville: 0, bourg: 1, village: 2, port: 3 };
  const pois = [...m.pois].sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9) || b.chests - a.chests);
  $('#pois').innerHTML = pois.map((p) => `<li><button data-id="${p.id}"><span class="dot" style="background:${POI_COLORS[p.kind]}"></span>
    <span>${p.name}<small>${p.label} · ${gridRef(m, p.x, p.z)}</small></span><em>${p.buildings.length} bât.<br>${p.chests} coffres</em></button></li>`).join('');
  for (const el of $('#pois').querySelectorAll('button')) el.onclick = () => {
    const p = m.pois[+el.dataset.id], r = p.rect, { w, h } = size();
    go({ x: p.x, z: p.z, s: Math.min(MAX_S, Math.min(w / (r.x1 - r.x0 + 60), h / (r.z1 - r.z0 + 60))) });
  };
  const maxF = Math.max(...m.buildings.map((b) => b.floors));
  st.level = Math.min(st.level, maxF - 1);
  $('#levels').innerHTML = Array.from({ length: maxF }, (_, i) => `<button data-l="${i}" aria-pressed="${i === st.level}">${ORD[i] || i + 'e'}</button>`).join('');
  for (const el of $('#levels').querySelectorAll('button')) el.onclick = () => {
    st.level = +el.dataset.l;
    for (const o of $('#levels').querySelectorAll('button')) o.setAttribute('aria-pressed', o === el);
    draw();
  };
  showBuilding(null);
}
function phaseText() {
  const i = st.phase, c = st.storm[i], next = st.storm[i + 1];
  const total = st.storm.slice(1).reduce((s, p) => s + p.wait + p.shrink, 0);
  $('#phaseTxt').innerHTML = i === 0
    ? `Début : toute l'île est sûre. Partie complète ≈ ${Math.round(total / 60)} min de tempête après le saut.`
    : `Phase ${i} / ${st.storm.length - 1} : zone sûre de <b>${Math.round(c.r)} m</b> de rayon.` + (next ? ` Attente ${next.wait} s puis fermeture en ${next.shrink} s vers le cercle en pointillés.` : '') + ` ${c.dps} PV/s dehors.`;
}

$('#layers').innerHTML = LAYERS.map(([k, label]) => `<button class="chip" data-k="${k}" aria-pressed="${st.layers[k]}">${label}</button>`).join('');
for (const el of $('#layers').querySelectorAll('button')) el.onclick = () => {
  const k = el.dataset.k;
  st.layers[k] = !st.layers[k];
  el.setAttribute('aria-pressed', st.layers[k]);
  if (k === 'courbes') st.terrain = terrainImage(st.map, { contours: st.layers.courbes });
  if (k === 'tempete' && st.layers.tempete && st.phase === 0) { st.phase = 2; $('#phase').value = 2; phaseText(); }
  draw();
};
$('#phase').oninput = (e) => {
  st.phase = +e.target.value;
  if (!st.layers.tempete) { st.layers.tempete = true; $('#layers [data-k=tempete]').setAttribute('aria-pressed', true); }
  phaseText(); draw();
};
$('#restorm').onclick = () => {
  st.stormSeed = (st.stormSeed * 7919 + 13) % 2147483647;
  plan();
  for (const k of ['tempete', 'vol']) { st.layers[k] = true; $(`#layers [data-k=${k}]`).setAttribute('aria-pressed', true); }
  if (st.phase === 0) { st.phase = 2; $('#phase').value = 2; phaseText(); }
  draw();
};
$('#reroll').onclick = () => build(1 + Math.floor(Math.random() * 99999));
$('#seed').onchange = (e) => { const v = Math.max(1, Math.floor(+e.target.value || 1)); build(v); };
addEventListener('hashchange', () => { const s = readSeed(); if (st.map && s !== st.map.seed) build(s); });
document.fonts && document.fonts.ready.then(draw);

function readSeed() { const m = location.hash.match(/graine=(\d+)/); return m ? +m[1] : ILE; }
build(readSeed());
if (new URLSearchParams(location.search).has('debug')) window.__ile = st;
