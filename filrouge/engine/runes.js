// Symboles du coffre : 24 glyphes dessinés à la main dans un carré 0..1 (y vers le bas).
// Chaque glyphe est une liste de traits : polyligne [x0, y0, x1, y1, …] ou cercle { c: [x, y, r] }.
// Ils n'ont pas de nom dans le manuel : le démineur doit les décrire avec ses mots.
const arc = (cx, cy, r, a0, a1, n = 14) => {
  const out = [];
  for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; out.push(+(cx + r * Math.cos(a)).toFixed(3), +(cy + r * Math.sin(a)).toFixed(3)); }
  return out;
};
const spiral = () => {
  const out = [];
  for (let k = 0; k <= 40; k++) { const a = k / 40 * Math.PI * 4.2, r = 0.04 + k / 40 * 0.34; out.push(+(0.5 + r * Math.cos(a)).toFixed(3), +(0.5 + r * Math.sin(a)).toFixed(3)); }
  return out;
};
const star = () => {
  const out = [];
  for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 4 / 5; out.push(+(0.5 + 0.38 * Math.cos(a)).toFixed(3), +(0.53 + 0.38 * Math.sin(a)).toFixed(3)); }
  return out;
};
const wave = (y) => {
  const out = [];
  for (let k = 0; k <= 20; k++) { const x = 0.1 + k * 0.04; out.push(+x.toFixed(3), +(y + 0.1 * Math.sin(k / 20 * Math.PI * 3)).toFixed(3)); }
  return out;
};

export const RUNES = [
  /* trident  */ [[0.5, 0.15, 0.5, 0.88], [0.2, 0.12, 0.2, 0.42, 0.8, 0.42, 0.8, 0.12], [0.34, 0.88, 0.66, 0.88]],
  /* ancre    */ [[0.5, 0.22, 0.5, 0.86], [0.3, 0.34, 0.7, 0.34], arc(0.5, 0.56, 0.3, 0.2, Math.PI - 0.2), { c: [0.5, 0.14, 0.07] }],
  /* œil      */ [[0.08, 0.5, 0.3, 0.3, 0.7, 0.3, 0.92, 0.5, 0.7, 0.7, 0.3, 0.7, 0.08, 0.5], { c: [0.5, 0.5, 0.11] }],
  /* éclair   */ [[0.62, 0.08, 0.3, 0.55, 0.56, 0.55, 0.38, 0.92]],
  /* sablier  */ [[0.25, 0.14, 0.75, 0.14, 0.25, 0.86, 0.75, 0.86, 0.25, 0.14]],
  /* croissant*/ [arc(0.5, 0.5, 0.36, Math.PI * 0.35, Math.PI * 1.65), arc(0.62, 0.5, 0.26, Math.PI * 0.62, Math.PI * 1.38)],
  /* spirale  */ [spiral()],
  /* fourche  */ [[0.5, 0.9, 0.5, 0.5, 0.18, 0.12], [0.5, 0.5, 0.82, 0.12], { c: [0.5, 0.5, 0.08] }],
  /* échelle  */ [[0.3, 0.1, 0.3, 0.9], [0.7, 0.1, 0.7, 0.9], [0.3, 0.3, 0.7, 0.3], [0.3, 0.5, 0.7, 0.5], [0.3, 0.7, 0.7, 0.7]],
  /* vagues   */ [wave(0.36), wave(0.64)],
  /* étoile   */ [star()],
  /* clé      */ [{ c: [0.27, 0.5, 0.15] }, [0.42, 0.5, 0.9, 0.5], [0.76, 0.5, 0.76, 0.68], [0.88, 0.5, 0.88, 0.63]],
  /* maison   */ [[0.15, 0.82, 0.5, 0.18, 0.85, 0.82, 0.15, 0.82], { c: [0.5, 0.6, 0.07] }],
  /* peigne   */ [[0.12, 0.22, 0.88, 0.22], [0.2, 0.22, 0.2, 0.82], [0.4, 0.22, 0.4, 0.62], [0.6, 0.22, 0.6, 0.82], [0.8, 0.22, 0.8, 0.62]],
  /* cible    */ [{ c: [0.5, 0.5, 0.36] }, { c: [0.5, 0.5, 0.15] }],
  /* zigzag   */ [[0.08, 0.7, 0.29, 0.3, 0.5, 0.7, 0.71, 0.3, 0.92, 0.7]],
  /* soleil   */ [{ c: [0.5, 0.5, 0.17] }, [0.5, 0.08, 0.5, 0.24], [0.5, 0.76, 0.5, 0.92], [0.08, 0.5, 0.24, 0.5], [0.76, 0.5, 0.92, 0.5],
                  [0.2, 0.2, 0.31, 0.31], [0.69, 0.69, 0.8, 0.8], [0.8, 0.2, 0.69, 0.31], [0.31, 0.69, 0.2, 0.8]],
  /* poisson  */ [[0.08, 0.5, 0.32, 0.28, 0.62, 0.38, 0.88, 0.22, 0.88, 0.78, 0.62, 0.62, 0.32, 0.72, 0.08, 0.5], { c: [0.27, 0.46, 0.04] }],
  /* carré    */ [[0.2, 0.2, 0.8, 0.2, 0.8, 0.8, 0.2, 0.8, 0.2, 0.2], [0.2, 0.8, 0.8, 0.2]],
  /* couronne */ [[0.12, 0.78, 0.12, 0.28, 0.32, 0.56, 0.5, 0.22, 0.68, 0.56, 0.88, 0.28, 0.88, 0.78, 0.12, 0.78]],
  /* goutte   */ [[0.5, 0.1, 0.27, 0.5], [0.5, 0.1, 0.73, 0.5], arc(0.5, 0.62, 0.25, -0.5, Math.PI + 0.5)],
  /* sigma    */ [[0.78, 0.15, 0.22, 0.15, 0.55, 0.5, 0.22, 0.85, 0.78, 0.85]],
  /* nœud     */ [{ c: [0.35, 0.5, 0.2] }, { c: [0.65, 0.5, 0.2] }],
  /* flèches  */ [[0.15, 0.5, 0.85, 0.5], [0.15, 0.5, 0.3, 0.35], [0.15, 0.5, 0.3, 0.65], [0.85, 0.5, 0.7, 0.35], [0.85, 0.5, 0.7, 0.65], [0.5, 0.2, 0.5, 0.8]],
];

// Glyphe en SVG (manuel) : traits noirs épais
export function runeSvg(i, size = 44, color = '#16181d') {
  const parts = RUNES[i].map((s) => (Array.isArray(s)
    ? `<polyline points="${s.map((v) => (v * 100).toFixed(1)).join(' ')}"/>`
    : `<circle cx="${s.c[0] * 100}" cy="${s.c[1] * 100}" r="${s.c[2] * 100}"/>`)).join('');
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${parts}</svg>`;
}

// Glyphe sur un canevas (écran du coffre en 3D)
export function drawRune(ctx, i, x, y, size, color, width) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of RUNES[i]) {
    ctx.beginPath();
    if (Array.isArray(s)) { ctx.moveTo(x + s[0] * size, y + s[1] * size); for (let k = 2; k < s.length; k += 2) ctx.lineTo(x + s[k] * size, y + s[k + 1] * size); }
    else ctx.arc(x + s.c[0] * size, y + s.c[1] * size, s.c[2] * size, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
