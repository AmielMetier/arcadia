// Figures des questions de géométrie : petits dessins SVG cotés, dans le style du jeu (encre épaisse, aplats).
import { esc } from './util.js';

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
  } else if (fig.t === 'dots') {
    const n = fig.n;
    body = Array.from({ length: n }, (_, k) => {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / n;
      return `<circle cx="${(140 + 72 * Math.cos(a)).toFixed(1)}" cy="${(90 + 72 * Math.sin(a)).toFixed(1)}" r="8" fill="${ACC}" stroke="${INK}" stroke-width="3"/>`;
    }).join('');
  }
  return `<svg class="fig" viewBox="0 0 280 180" role="img" aria-label="Figure">${body}</svg>`;
}
