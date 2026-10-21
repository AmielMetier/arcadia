// Figures des questions de géométrie : petits dessins SVG cotés, dans le style du jeu (encre épaisse, aplats).
import { esc } from './util.js';

const INK = '#16181d', FILL = '#d8f3ea', ACC = '#0f8a6a';
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
  }
  return `<svg class="fig" viewBox="0 0 280 180" role="img" aria-label="Figure">${body}</svg>`;
}
