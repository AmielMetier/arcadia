// Figures des questions de géométrie : petits dessins SVG cotés, dans le style du jeu (encre épaisse, aplats).
import { esc } from './util.js';
import { payoffAt } from '../engine/charts.js';
import { describeCell } from '../engine/mind.js';

const INK = '#16181d', FILL = '#d8f3ea', ACC = '#0f8a6a';
// Empilement de cubes en perspective isométrique, mis à l'échelle de la vignette (peint : faces visibles en couleur)
function isoCubes(cubes, colors = ['#d8f3ea', '#8fd9c1', '#b5e9d8']) {
  cubes = [...cubes].sort((a, b) => a[2] - b[2] || (a[0] + a[1]) - (b[0] + b[1]));
  const P = (X, Y, Z) => [(X - Y) * 0.866, (X + Y) * 0.5 - Z];
  const all = cubes.flatMap(([x, y, z]) => [P(x, y + 1, z), P(x + 1, y, z), P(x + 1, y + 1, z), P(x, y, z + 1)]);
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const sc = Math.min(240 / (maxX - minX), 160 / (maxY - minY));
  const T = ([X, Y]) => `${(140 + (X - (minX + maxX) / 2) * sc).toFixed(1)},${(90 + (Y - (minY + maxY) / 2) * sc).toFixed(1)}`;
  const face = (pts, fill) => `<polygon points="${pts.map(T).join(' ')}" fill="${fill}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
  return cubes.map(([x, y, z]) =>
    face([P(x, y, z + 1), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], colors[0])
    + face([P(x + 1, y, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x + 1, y, z + 1)], colors[1])
    + face([P(x, y + 1, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], colors[2])).join('');
}
const box = (a, b, c) => { const l = []; for (let z = 0; z < c; z++) for (let x = 0; x < a; x++) for (let y = 0; y < b; y++) l.push([x, y, z]); return l; };
const label = (x, y, t, anchor = 'middle', unknown = false) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${unknown || t === '?' ? 'unk' : ''}">${esc(t)}</text>`;

// Raisonnement abstrait : une case de la grille (n formes identiques, vides, grises ou pleines) dans un carré de côté w
const CELL_FILL = ['none', '#8a94a6', INK];
const CELL_POS = [[[0, 0]], [[-0.22, 0], [0.22, 0]], [[0, -0.2], [-0.22, 0.19], [0.22, 0.19]], [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]];
function regular(cx, cy, R, k, rot) {
  return Array.from({ length: k }, (_, j) => { const a = rot + (j * 2 * Math.PI) / k; return `${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`; }).join(' ');
}
function cellShapes(c, x, y, w) {
  const R = w * [0.28, 0.17, 0.15, 0.14][c.n - 1], st = `fill="${CELL_FILL[c.f]}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"`;
  return CELL_POS[c.n - 1].map(([dx, dy]) => {
    const cx = x + w / 2 + dx * w, cy = y + w / 2 + dy * w;
    if (c.s === 0) return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${R.toFixed(1)}" ${st}/>`;
    if (c.s === 1) return `<rect x="${(cx - 0.85 * R).toFixed(1)}" y="${(cy - 0.85 * R).toFixed(1)}" width="${(1.7 * R).toFixed(1)}" height="${(1.7 * R).toFixed(1)}" ${st}/>`;
    if (c.s === 2) return `<polygon points="${regular(cx, cy + 0.15 * R, 1.15 * R, 3, -Math.PI / 2)}" ${st}/>`;
    if (c.s === 3) return `<polygon points="${regular(cx, cy, 1.15 * R, 4, -Math.PI / 2)}" ${st}/>`;
    return `<polygon points="${regular(cx, cy, 1.05 * R, 6, 0)}" ${st}/>`;
  }).join('');
}
// une case seule, pour les réponses à choisir
export const cellSvg = (c) => `<svg class="fig figc" viewBox="0 0 60 60" role="img" aria-label="${esc(describeCell(c))}">${cellShapes(c, 0, 0, 60)}</svg>`;

export function figureSvg(fig) {
  if (!fig) return '';
  let body = '';
  if (fig.t === 'rect') {
    body = `<rect x="40" y="30" width="200" height="110" rx="4" fill="${FILL}" stroke="${INK}" stroke-width="4"/>
      ${label(140, 166, fig.a)}${label(252, 90, fig.b, 'start')}`;
  } else if (fig.t === 'square') {
    body = `<rect x="80" y="20" width="120" height="120" rx="4" fill="${FILL}" stroke="${INK}" stroke-width="4"/>${label(140, 166, fig.a)}`;
  } else if (fig.t === 'tri') {
    body = `<path d="M40 140 L240 140 L120 22 Z" fill="${FILL}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      ${label(66, 132, fig.a, 'start')}${label(214, 132, fig.b, 'end')}${label(120, 64, fig.c)}`;
  } else if (fig.t === 'right') {
    body = `<path d="M60 140 L240 140 L60 24 Z" fill="${FILL}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M60 122 h18 v18" fill="none" stroke="${INK}" stroke-width="3"/>
      ${label(150, 166, fig.b)}${label(50, 88, fig.a, 'end')}${label(160, 72, fig.c, 'start')}`;
  } else if (fig.t === 'trih') {
    body = `<path d="M30 140 L250 140 L170 24 Z" fill="${FILL}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M170 24 V140" stroke="${ACC}" stroke-width="3" stroke-dasharray="7 5"/><path d="M170 126 h-14 v14" fill="none" stroke="${ACC}" stroke-width="2.5"/>
      ${label(110, 166, fig.a)}${label(180, 92, fig.b, 'start')}`;
  } else if (fig.t === 'cube') {
    body = `<path d="M70 60 L170 60 L170 150 L70 150 Z" fill="${FILL}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M70 60 L110 26 L210 26 L170 60 Z" fill="#b5e9d8" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M170 60 L210 26 L210 116 L170 150 Z" fill="#8fd9c1" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      ${label(120, 174, fig.a)}`;
  } else if (fig.t === 'poly') {
    const n = fig.n, pts = Array.from({ length: n }, (_, k) => {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / n + (n % 2 ? 0 : Math.PI / n);
      return `${(140 + 70 * Math.cos(a)).toFixed(1)},${(88 + 70 * Math.sin(a)).toFixed(1)}`;
    });
    body = `<polygon points="${pts.join(' ')}" fill="${FILL}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>${label(140, 96, '?', 'middle', true)}`;
  } else if (fig.t === 'grid') {
    // grille m × n de carrés unité
    const c = Math.min(220 / fig.m, 150 / fig.n), w = c * fig.m, h = c * fig.n, x0 = 140 - w / 2, y0 = 90 - h / 2;
    let lines = '';
    for (let k = 1; k < fig.m; k++) lines += `<path d="M${(x0 + k * c).toFixed(1)} ${y0.toFixed(1)} V${(y0 + h).toFixed(1)}"/>`;
    for (let k = 1; k < fig.n; k++) lines += `<path d="M${x0.toFixed(1)} ${(y0 + k * c).toFixed(1)} H${(x0 + w).toFixed(1)}"/>`;
    body = `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${FILL}" stroke="${INK}" stroke-width="4"/>
      <g stroke="${INK}" stroke-width="2.5">${lines}</g>`;
  } else if (fig.t === 'trigrid') {
    // triangle équilatéral découpé en n rangées de petits triangles
    const n = fig.n, side = 190, H = side * Math.sqrt(3) / 2, A = [140, 90 - H / 2], B = [140 - side / 2, 90 + H / 2], C = [140 + side / 2, 90 + H / 2];
    const at = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const seg = (p, q) => `<path d="M${p[0].toFixed(1)} ${p[1].toFixed(1)} L${q[0].toFixed(1)} ${q[1].toFixed(1)}"/>`;
    let lines = '';
    for (let k = 1; k < n; k++) {
      const t = k / n;
      lines += seg(at(A, B, t), at(A, C, t)) + seg(at(B, A, t), at(B, C, t)) + seg(at(C, A, t), at(C, B, t));
    }
    body = `<path d="M${A.join(' ')} L${B.join(' ')} L${C.join(' ')} Z" fill="${FILL}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <g stroke="${INK}" stroke-width="2.5">${lines}</g>`;
  } else if (fig.t === 'pyramid') {
    // étage k (depuis le bas) = carré de n − k cubes, centré
    const n = fig.n, cubes = [];
    for (let z = 0; z < n; z++) for (let x = 0; x < n - z; x++) for (let y = 0; y < n - z; y++) cubes.push([x + z / 2, y + z / 2, z]);
    body = isoCubes(cubes);
  } else if (fig.t === 'box') {
    // pavé plein a × b × c, ou cube peint puis découpé (faces en rouge)
    body = isoCubes(box(fig.a, fig.b, fig.c), fig.paint ? ['#ff8a73', '#e2553b', '#f06a50'] : undefined);
  } else if (fig.t === 'stair') {
    // escalier : la marche k (depuis l'avant) a k cubes de haut, sur w cubes de large
    const cubes = [];
    for (let k = 0; k < fig.n; k++) for (let z = 0; z <= k; z++) for (let y = 0; y < fig.w; y++) cubes.push([fig.n - 1 - k, y, z]);
    body = isoCubes(cubes);
  } else if (fig.t === 'paths') {
    // grille m × n : de A (en bas à gauche) à B (en haut à droite)
    const c = Math.min(200 / fig.m, 130 / fig.n), w = c * fig.m, h = c * fig.n, x0 = 140 - w / 2, y0 = 88 - h / 2;
    let lines = '';
    for (let k = 0; k <= fig.m; k++) lines += `<path d="M${(x0 + k * c).toFixed(1)} ${y0.toFixed(1)} V${(y0 + h).toFixed(1)}"/>`;
    for (let k = 0; k <= fig.n; k++) lines += `<path d="M${x0.toFixed(1)} ${(y0 + k * c).toFixed(1)} H${(x0 + w).toFixed(1)}"/>`;
    body = `<g stroke="${INK}" stroke-width="3" stroke-linecap="round">${lines}</g>
      <circle cx="${x0.toFixed(1)}" cy="${(y0 + h).toFixed(1)}" r="9" fill="${ACC}" stroke="${INK}" stroke-width="3"/>
      <circle cx="${(x0 + w).toFixed(1)}" cy="${y0.toFixed(1)}" r="9" fill="#ffc531" stroke="${INK}" stroke-width="3"/>
      ${label(x0 - 14, y0 + h + 6, 'A', 'end')}${label(x0 + w + 14, y0 + 6, 'B', 'start')}`;
  } else if (fig.t === 'chart') {
    body = chartSvg(fig) + (fig.label ? sm(152, 10, fig.label) : '');
  } else if (SCHEMA[fig.t]) {
    body = SCHEMA[fig.t](fig);
  } else if (fig.t === 'fan') {
    // triangle, et k traits du sommet vers la base (bases réparties au hasard mais fixes)
    const A = [140, 22], B = [40, 150], C = [240, 150];
    let lines = '';
    for (let j = 1; j <= fig.k; j++) { const x = 40 + (200 * j) / (fig.k + 1) + (j % 2 ? 6 : -6); lines += `<path d="M${A[0]} ${A[1]} L${x.toFixed(1)} 150"/>`; }
    body = `<path d="M${A.join(' ')} L${B.join(' ')} L${C.join(' ')} Z" fill="${FILL}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <g stroke="${INK}" stroke-width="2.5">${lines}</g>`;
  } else if (fig.t === 'polyd') {
    // polygon à n sommets, avec une diagonale en exemple
    const n = fig.n, pts = Array.from({ length: n }, (_, k) => {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / n;
      return [140 + 74 * Math.cos(a), 90 + 74 * Math.sin(a)];
    });
    const f = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    body = `<polygon points="${pts.map(f).join(' ')}" fill="${FILL}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M${f(pts[0])} L${f(pts[2])}" stroke="${ACC}" stroke-width="3" stroke-dasharray="7 5"/>
      ${pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5" fill="${INK}"/>`).join('')}`;
  } else if (fig.t === 'matrix') {
    // raisonnement abstrait : grille 3 × 3, la dernière case est à trouver
    const w = 56, x0 = 140 - (3 * w) / 2, y0 = 6;
    body = fig.cells.map((c, k) => { const x = x0 + (k % 3) * w, y = y0 + Math.floor(k / 3) * w;
      return `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${w - 4}" rx="6" fill="none" stroke="${INK}" stroke-width="${c ? 1.5 : 2.5}"${c ? '' : ' stroke-dasharray="6 4"'}/>`
        + (c ? cellShapes(c, x, y, w) : label(x + w / 2, y + w / 2 + 9, '?')); }).join('');
  } else if (fig.t === 'dots') {
    const n = fig.n;
    body = Array.from({ length: n }, (_, k) => {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / n;
      return `<circle cx="${(140 + 72 * Math.cos(a)).toFixed(1)}" cy="${(90 + 72 * Math.sin(a)).toFixed(1)}" r="8" fill="${ACC}" stroke="${INK}" stroke-width="3"/>`;
    }).join('');
  }
  return `<svg class="fig" viewBox="0 0 280 180" role="img" aria-label="Figure">${body}</svg>`;
}

/* ------------------------------------------------------------------ graphiques (questions « lecture de graphique ») */
const UP = '#2fbf71', DOWN = '#ff5a3c';
const n1 = (x) => (Math.round(x * 10) / 10).toString().replace('.', ',');
const n2 = (x) => (Math.round(x * 100) / 100).toFixed(2).replace('.', ',');
const sm = (x, y, t, anchor = 'middle', extra = '') => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" class="sm" ${extra}>${esc(t)}</text>`;
// zone de tracé : x de 36 à 268, y de 16 à 148
function frame(lo, hi) {
  const Y = (v) => 148 - ((v - lo) / (hi - lo || 1)) * 132;
  const axes = `<path d="M36 16 V148 H268" fill="none" stroke="${INK}" stroke-width="2"/>`;
  return { Y, axes };
}
function chartSvg(f) {
  if (f.c === 'yc' || f.c === 'line') {
    const lo = Math.min(...f.y), hi = Math.max(...f.y), pad = (hi - lo) * 0.25 || 0.5;
    const { Y, axes } = frame(lo - pad, hi + pad), n = f.y.length;
    const X = (k) => 50 + (k * 206) / (n - 1);
    const pts = f.y.map((v, k) => `${X(k).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    const yc = f.c === 'yc';
    const ticks = [lo, (lo + hi) / 2, hi].map((v) => sm(32, Y(v) + 4, yc ? `${n2(v)} %` : n1(v), 'end')).join('');
    const xl = (f.x || f.y.map((_, k) => `J${k + 1}`)).map((t, k) => sm(X(k), 164, t)).join('');
    const vals = (!yc || f.labels) ? f.y.map((v, k) => sm(X(k), Y(v) - 9, yc ? `${n2(v)}` : String(v))).join('') : '';
    return `${axes}<polyline points="${pts}" fill="none" stroke="${ACC}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${f.y.map((v, k) => `<circle cx="${X(k).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4" fill="${ACC}" stroke="${INK}" stroke-width="1.5"/>`).join('')}
      ${yc ? '' : ticks}${yc && !f.labels ? ticks : ''}${xl}${vals}`;
  }
  if (f.c === 'payoff') {
    const S = Array.from({ length: 41 }, (_, k) => 50 + k * 2.5), v = S.map((x) => payoffAt(f.legs, x));
    const lo = Math.min(0, ...v), hi = Math.max(0, ...v), pad = (hi - lo) * 0.12 || 5;
    const { Y } = frame(lo - pad, hi + pad), X = (x) => 36 + ((x - 50) / 100) * 232;
    const pts = S.map((x, k) => `${X(x).toFixed(1)},${Y(v[k]).toFixed(1)}`).join(' ');
    return `<path d="M36 16 V148" stroke="${INK}" stroke-width="2"/><path d="M36 ${Y(0).toFixed(1)} H268" stroke="${INK}" stroke-width="2"/>
      ${sm(270, Y(0) - 6, 'cours', 'end')}${sm(40, 26, 'gain', 'start')}${sm(40, 144, 'perte', 'start')}
      ${f.K.map((K) => `<path d="M${X(K).toFixed(1)} ${(Y(0) - 4).toFixed(1)} v8" stroke="${INK}" stroke-width="2"/>${sm(X(K), Y(0) + 18, String(K))}`).join('')}
      <polyline points="${pts}" fill="none" stroke="${ACC}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  if (f.c === 'book') {
    const mx = Math.max(...f.bq, ...f.aq), W = (q) => (q / mx) * 90;
    const row = (k, side) => {
      const y = side === 'a' ? 20 + (3 - k) * 17 : 96 + k * 17, px = side === 'a' ? f.ask[k] : f.bid[k], q = side === 'a' ? f.aq[k] : f.bq[k];
      const bar = side === 'a' ? `<rect x="166" y="${y}" width="${W(q).toFixed(1)}" height="13" rx="3" fill="${DOWN}"/>${sm(170 + W(q), y + 11, String(q), 'start')}`
        : `<rect x="${(114 - W(q)).toFixed(1)}" y="${y}" width="${W(q).toFixed(1)}" height="13" rx="3" fill="${UP}"/>${sm(110 - W(q), y + 11, String(q), 'end')}`;
      return `${bar}${sm(140, y + 11, n2(px))}`;
    };
    return `${[0, 1, 2, 3].map((k) => row(k, 'a')).join('')}${[0, 1, 2, 3].map((k) => row(k, 'b')).join('')}
      <path d="M40 91 H240" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 4"/>
      ${sm(268, 14, 'vendeurs (ask)', 'end')}${sm(12, 174, 'acheteurs (bid)', 'start')}`;
  }
  if (f.c === 'bars') {
    const hi = Math.max(...f.y) * 1.15, { Y, axes } = frame(0, hi), n = f.y.length, w = 200 / n;
    return `${axes}${f.y.map((v, k) => { const x = 46 + k * (222 / n); return `<rect x="${x.toFixed(1)}" y="${Y(v).toFixed(1)}" width="${(w - 8).toFixed(1)}" height="${(148 - Y(v)).toFixed(1)}" rx="3" fill="${ACC}" stroke="${INK}" stroke-width="1.5"/>
      ${sm(x + (w - 8) / 2, Y(v) - 6, String(v))}${sm(x + (w - 8) / 2, 164, f.x[k])}`; }).join('')}${sm(40, 12, 'CA (M€)', 'start')}`;
  }
  return '';
}

/* ------------------------------------------------------------------ mini-schémas des explications */
const poly = (pts, color = ACC, w = 3.5, extra = '') => `<polyline points="${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
const axes2 = (xl, yl) => `<path d="M36 16 V148 H268" fill="none" stroke="${INK}" stroke-width="2"/>${sm(268, 164, xl, 'end')}${sm(40, 12, yl, 'start')}`;
const curve = (f, a = 50, b = 150) => Array.from({ length: 61 }, (_, k) => { const x = a + ((b - a) * k) / 60; return [36 + ((x - a) / (b - a)) * 232, f(x)]; });
const N = (z) => 1 / (1 + Math.exp(-1.702 * z)); // approximation de la loi normale cumulée
const SCHEMA = {
  smile: () => `${axes2('strike', 'volatilité implicite')}${poly(curve((x) => 148 - 40 - 0.012 * (x - 112) ** 2 * (x < 112 ? 1.4 : 0.6)))}
    <path d="M152 148 v-6" stroke="${INK}" stroke-width="2"/>${sm(152, 162, 'à la monnaie')}${sm(70, 40, 'puts chers', 'middle')}`,
  greek: (f) => {
    const g = { delta: [(x) => 140 - 120 * N((x - 100) / 15), 'delta d\'un call : de 0 à 1'], gamma: [(x) => 145 - 120 * Math.exp(-(((x - 100) / 14) ** 2)), 'gamma : maximal à la monnaie'],
      vega: [(x) => 145 - 110 * Math.exp(-(((x - 100) / 24) ** 2)), 'vega : en cloche autour de la monnaie'] }[f.g];
    if (f.g === 'theta') {
      return `${axes2('temps qui passe →', 'valeur temps')}${poly(curve((x) => 148 - 125 * Math.sqrt(Math.max(0, (150 - x) / 100)), 50, 150))}${sm(150, 30, 'elle fond de plus en plus vite vers l\'échéance')}`;
    }
    return `${axes2('cours', f.g)}${poly(curve(g[0]))}<path d="M152 148 v-6" stroke="${INK}" stroke-width="2"/>${sm(152, 162, 'strike')}${sm(150, 30, g[1])}`;
  },
  timeline: () => {
    const pt = (x, top, bottom, color = ACC) => `<circle cx="${x}" cy="90" r="7" fill="${color}" stroke="${INK}" stroke-width="2"/>${sm(x, 66, top)}${sm(x, 118, bottom)}`;
    return `<path d="M20 90 H262" stroke="${INK}" stroke-width="3"/><path d="M262 90 l-10 -6 v12 z" fill="${INK}"/>
      <path d="M90 90 H230" stroke="${ACC}" stroke-width="8" stroke-opacity=".35"/>
      ${pt(50, 'constatation', 'on lit l\'Euribor', '#ffc531')}${pt(90, 'début', 'des intérêts')}${pt(230, 'paiement', 'du coupon')}
      ${sm(160, 82, 'période d\'intérêts')}${sm(70, 150, '≈ 2 jours ouvrés')}`;
  },
  convex: () => {
    const P = (y) => 100 / (1 + y / 100) ** 10, Y = (p) => 148 - ((p - 40) / 90) * 130, X = (y) => 36 + (y / 10) * 232;
    const pts = Array.from({ length: 51 }, (_, k) => { const y = (k / 50) * 10; return [X(y), Y(P(y))]; });
    const y0 = 4, d = (P(y0 + 0.01) - P(y0 - 0.01)) / 0.02, tan = [0, 10].map((y) => [X(y), Y(P(y0) + d * (y - y0))]);
    return `${axes2('taux', 'prix')}${poly(tan, INK, 2, 'stroke-dasharray="6 5"')}${poly(pts)}<circle cx="${X(y0)}" cy="${Y(P(y0))}" r="5" fill="#ffc531" stroke="${INK}" stroke-width="2"/>
      ${sm(200, 40, 'les taux montent : le prix baisse')}${sm(200, 140, 'pointillés : la duration seule')}`;
  },
  bell: () => {
    const X = (z) => 152 + z * 36, Y = (z) => 148 - 120 * Math.exp(-(z * z) / 2);
    const area = (a, b, op) => `<path d="M${X(a)} 148 ${Array.from({ length: 21 }, (_, k) => { const z = a + ((b - a) * k) / 20; return `L${X(z).toFixed(1)} ${Y(z).toFixed(1)}`; }).join(' ')} L${X(b)} 148 Z" fill="${ACC}" fill-opacity="${op}"/>`;
    return `${area(-2, 2, 0.25)}${area(-1, 1, 0.45)}${poly(Array.from({ length: 61 }, (_, k) => { const z = -3 + k / 10; return [X(z), Y(z)]; }))}
      <path d="M30 148 H274" stroke="${INK}" stroke-width="2"/>${sm(152, 110, '68 %')}${sm(X(-1.5), 140, '95 %')}${sm(X(1.5), 140, '95 %')}
      ${[-2, -1, 0, 1, 2].map((z) => sm(X(z), 164, z ? `${z > 0 ? '+' : '−'}${Math.abs(z)}σ` : 'moyenne')).join('')}`;
  },
  evbridge: () => {
    const bar = (x, y, h, label, value, color) => `<rect x="${x}" y="${y}" width="58" height="${h}" rx="4" fill="${color}" stroke="${INK}" stroke-width="2"/>${sm(x + 29, y + h / 2 + 4, value)}${sm(x + 29, 164, label)}`;
    return `${bar(30, 58, 90, 'capitalisation', '600', ACC)}${sm(108, 104, '+')}${bar(120, 88, 60, 'dette nette', '400', '#e2553b')}${sm(198, 104, '=')}${bar(212, 18, 130, 'valeur d\'entreprise', '1 000', '#ffc531')}`;
  },
  balance: () => `<rect x="40" y="20" width="96" height="128" rx="6" fill="${ACC}" stroke="${INK}" stroke-width="2"/>${sm(88, 88, 'actif')}${sm(88, 104, 'ce que l\'on possède')}
    <rect x="148" y="20" width="96" height="70" rx="6" fill="#ffc531" stroke="${INK}" stroke-width="2"/>${sm(196, 58, 'fonds propres')}
    <rect x="148" y="92" width="96" height="56" rx="6" fill="#e2553b" stroke="${INK}" stroke-width="2"/>${sm(196, 124, 'dettes')}${sm(142, 166, 'actif = passif')}`,
};
