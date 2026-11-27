// Formes communes au canvas (Path2D) et aux icônes SVG : tracés dans un carré de -1 à 1.
import { COLORS } from '../engine/trials.js';

export const PATHS = {
  rond: 'M -1 0 A 1 1 0 1 0 1 0 A 1 1 0 1 0 -1 0 Z',
  carré: 'M -0.82 -0.82 H 0.82 V 0.82 H -0.82 Z',
  triangle: 'M 0 -1 L 0.95 0.75 L -0.95 0.75 Z',
  losange: 'M 0 -1 L 1 0 L 0 1 L -1 0 Z',
};
const cache = {};
export const path2d = (shape) => cache[shape] || (cache[shape] = new Path2D(PATHS[shape]));

// Les deux couleurs d'Aiguillage : bleu plein, ambre rayé (jamais la couleur seule).
export const SORT_COLORS = [{ name: 'bleu', hex: '#38BDF8', striped: false }, { name: 'ambre', hex: '#FBBF24', striped: true }];

let uid = 0;
export function shapeSvg(shape, hex, { size = 40, striped = false, label = '' } = {}) {
  const id = 'r' + (++uid);
  const fill = striped ? `url(#${id})` : hex;
  const defs = striped ? `<defs><pattern id="${id}" width="0.36" height="0.36" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="0.36" height="0.36" fill="${hex}"/><rect width="0.1" height="0.36" fill="#0F172A" opacity="0.45"/></pattern></defs>` : '';
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="shape" width="${size}" height="${size}" viewBox="-1.15 -1.15 2.3 2.3" ${a11y}>${defs}<path d="${PATHS[shape]}" fill="${fill}" stroke="#F8FAFC" stroke-opacity="0.35" stroke-width="0.06"/></svg>`;
}
// '#38BDF8' → 'rgba(56,189,248,a)' pour le canvas.
export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
export const colorHex = (i) => COLORS[i].hex;
export const colorName = (i) => COLORS[i].id;
