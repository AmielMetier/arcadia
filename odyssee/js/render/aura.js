// odyssee/js/render/aura.js — l'aura des boss de raid, en pixels pleins (la carte n'affiche que des pixels opaques).
// Un liseré clair colle à la silhouette, une frange plus sombre l'entoure et des flammes montent par-dessus ;
// plusieurs images à faire défiler pour qu'elle ondule. Couleur selon le rang : bleu, rouge ou or.

export const AURA_PAD = 7;   // marge autour du sprite (à gauche, à droite et en haut)
const COULEURS = {
  bleu: [[205, 240, 255], [70, 165, 255], [25, 75, 210]],
  rouge: [[255, 190, 170], [255, 55, 50], [165, 0, 25]],
  or: [[255, 248, 185], [255, 200, 35], [225, 120, 0]],
};
const bruit = (a, b) => { let h = Math.imul(a * 374761393 + b * 668265263, 1274126177) >>> 0; h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** images de l'aura (sans le sprite), de taille (largeur + 2 × pad) × (hauteur + 2 × pad), à poser à (-pad, -pad)
 *  du sprite ; k épaissit l'aura (sur la carte, le sprite est réduit : k = 2) */
export function auraFrames(img, teinte = 'or', k = 1, n = 6) {
  const P = AURA_PAD * k, w = img.width, h = img.height, W = w + 2 * P, H = h + 2 * P;
  const src = document.createElement('canvas'); src.width = w; src.height = h;
  const sx = src.getContext('2d'); sx.drawImage(img, 0, 0);
  const a = sx.getImageData(0, 0, w, h).data;
  // silhouette, puis distance (en cases, 8 voisins) jusqu'à elle
  const D = new Int16Array(W * H).fill(99), file = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] > 100) { const i = (y + P) * W + x + P; D[i] = 0; file.push(i); }
  for (let q = 0; q < file.length; q++) {
    const i = file[q], x = i % W, y = (i / W) | 0, d = D[i] + 1;
    if (d > P) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const j = Y * W + X; if (D[j] > d) { D[j] = d; file.push(j); }
    }
  }
  // pour les flammes : la plus haute case de la silhouette dans chaque colonne
  const haut = new Int16Array(W).fill(-1);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (D[y * W + x] === 0) { haut[x] = y; break; }
  const [c1, c2, c3] = COULEURS[teinte] || COULEURS.or;
  const frames = [];
  for (let f = 0; f < n; f++) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x2 = c.getContext('2d'), im = x2.createImageData(W, H), o = im.data;
    const souffle = f % 3 === 2 ? k : 0;   // l'aura gonfle une image sur trois
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, d = D[i];
      let col = null;
      if (d >= 1 && d <= k) col = c1;
      else if (d > k && d <= 2 * k + souffle) col = c2;
      else if (d > 2 * k + souffle && d <= 3 * k + souffle && bruit(x >> k, (y >> k) + f * 7) < 0.45) col = c3;
      // flammes : au-dessus de la silhouette, des langues qui montent et changent à chaque image
      if (!col && haut[x] >= 0 && y < haut[x] && d > k) {
        const lg = Math.floor(bruit(x >> k, f) * (P + 1));
        const dh = haut[x] - y;
        if (dh <= lg) col = dh >= lg - 1 ? c3 : dh > lg / 2 ? c2 : c1;
      }
      if (!col) continue;
      const q = i * 4; o[q] = col[0]; o[q + 1] = col[1]; o[q + 2] = col[2]; o[q + 3] = 255;
    }
    x2.putImageData(im, 0, 0);
    frames.push(c);
  }
  return { frames, pad: P };
}
