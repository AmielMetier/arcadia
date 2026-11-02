// odyssee/js/render/tenue.js — l'apparence du joueur, composée à partir d'un modèle de base (64 px, PixelLab) :
// le haut (vert sur le modèle) et le bas (bleu) se reconnaissent à leur teinte et se recolorent en gardant leurs ombres ;
// t-shirt, veste, chemise, short, sandales retouchent le dessin ; casquette, bonnet, sac à dos et sacoche se dessinent
// par-dessus, calés sur la tête et le buste de chaque image (12 images : 4 directions × 3 pas).
// Sans DOM ailleurs que dans composer() (canvas) ; les choix possibles sont dans TENUE.

export const TENUE = {
  genre: [['m', 'Garçon'], ['f', 'Fille']],
  peau: [['#f6d2b4', 'Claire'], ['#e8b48c', 'Dorée'], ['#c68a5c', 'Mate'], ['#8a5a3c', 'Foncée']],
  cheveux: [['#5a3a22', 'Châtains'], ['#1e1a1e', 'Noirs'], ['#e8c860', 'Blonds'], ['#c0502c', 'Roux'], ['#e8e8f0', 'Blancs'], ['#4a6ad0', 'Bleus'], ['#e070b0', 'Roses']],
  chapeau: [['aucun', 'Aucun'], ['casquette', 'Casquette'], ['bonnet', 'Bonnet']],
  haut: [['pull', 'Pull'], ['tshirt', 'T-shirt'], ['veste', 'Veste'], ['chemise', 'Chemise']],
  bas: [['pantalon', 'Pantalon'], ['short', 'Short']],
  chaussures: [['baskets', 'Baskets'], ['sandales', 'Sandales']],
  sac: [['aucun', 'Aucun'], ['dos', 'Sac à dos'], ['bandouliere', 'Sacoche']],
};
export const COULEURS = [['#d83a3a', 'Rouge'], ['#f08a2a', 'Orange'], ['#f0d040', 'Jaune'], ['#4cae4c', 'Vert'], ['#2f9a9a', 'Turquoise'], ['#3a6ad8', 'Bleu'], ['#283c78', 'Marine'],
  ['#8a4ad0', 'Violet'], ['#e070a8', 'Rose'], ['#f4f4f0', 'Blanc'], ['#8c8c94', 'Gris'], ['#2a2a30', 'Noir'], ['#8a5a32', 'Marron'], ['#c8b088', 'Beige']];
export const TENUE_DEFAUT = { genre: 'm', peau: '#f6d2b4', cheveux: '#5a3a22', chapeau: 'casquette', chapeauC: '#d83a3a', haut: 'veste', hautC: '#3a6ad8', bas: 'pantalon', basC: '#283c78', chaussures: 'baskets', chaussuresC: '#d83a3a', sac: 'dos', sacC: '#f0d040' };

/* ---------------- couleurs ---------------- */
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function rgbHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
  let h = 0; if (c) h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; h = ((h / 6) + 1) % 1;
  return [h, mx ? c / mx : 0, mx];
}
function hsvRgb(h, s, v) { const f = (n) => { const k = (n + h * 6) % 6; return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255); }; return [f(5), f(3), f(1)]; }
const shadeOf = (hex, k) => { const [r, g, b] = hexRgb(hex); return [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))))); };

/** classe d'un pixel du modèle : haut (vert), bas (bleu), peau, cheveux, blanc (chaussures), contour */
function classe(r, g, b) {
  const [h, s, v] = rgbHsv(r, g, b);
  if (v < 0.16) return 'contour';
  if (s > 0.28 && h > 0.2 && h < 0.47) return 'haut';
  if (s > 0.28 && h > 0.53 && h < 0.75) return 'bas';
  if ((h < 0.14 || h > 0.95) && s > 0.12) return v > 0.62 && s < 0.6 ? 'peau' : 'cheveux';
  if (s < 0.16 && v > 0.62) return 'blanc';
  return 'autre';
}

/** une image (64 × 64) : analyse des zones, puis retouches et recoloration */
function retoucher(px, W, dir, T) {
  const at = (x, y) => (y * W + x) * 4;
  const cls = new Array(W * W).fill(null), zones = {};
  let top = W, bot = -1;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const o = at(x, y); if (px[o + 3] < 128) continue;
    const c = classe(px[o], px[o + 1], px[o + 2]); cls[y * W + x] = c;
    (zones[c] = zones[c] || []).push([x, y]);
    top = Math.min(top, y); bot = Math.max(bot, y);
  }
  if (bot < 0) return { top: 0, cx: W / 2 };
  const box = (L) => { if (!L || !L.length) return null; let x0 = W, x1 = 0, y0 = W, y1 = 0, sx = 0; for (const [x, y] of L) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); sx += x; } return { x0, x1, y0, y1, cx: sx / L.length }; };
  const bH = box(zones.haut), bB = box(zones.bas);
  const meanV = (L) => { let s = 0; for (const [x, y] of L) { const o = at(x, y); s += rgbHsv(px[o], px[o + 1], px[o + 2])[2]; } return s / L.length || 1; };
  const peint = (x, y, rgb) => { const o = at(x, y); px[o] = rgb[0]; px[o + 1] = rgb[1]; px[o + 2] = rgb[2]; px[o + 3] = 255; };
  // recolore un pixel vers une teinte cible en gardant son ombre relative
  const vers = (x, y, hex, mv) => {
    const o = at(x, y), [, s, v] = rgbHsv(px[o], px[o + 1], px[o + 2]), [th, ts, tv] = rgbHsv(...hexRgb(hex));
    const nv = Math.max(0.06, Math.min(1, tv * (0.25 + 0.75 * v / mv) + (v > mv ? (v - mv) * 0.4 : 0)));
    peint(x, y, hsvRgb(th, Math.min(1, ts * (0.6 + 0.4 * Math.min(1.5, s / 0.6))), nv));
  };
  const cx = bH ? Math.round(bH.cx) : W >> 1;
  // peau et cheveux
  if (zones.peau) { const mv = meanV(zones.peau); for (const [x, y] of zones.peau) vers(x, y, T.peau, mv); }
  if (zones.cheveux) { const mv = meanV(zones.cheveux); for (const [x, y] of zones.cheveux) vers(x, y, T.cheveux, mv); }
  const peauMv = zones.peau ? meanV(zones.peau) : 0.8;
  // le bas : pantalon, ou short (sous le genou, la jambe est nue)
  if (zones.bas) {
    const mv = meanV(zones.bas), genou = bB.y0 + Math.round((bB.y1 - bB.y0) * 0.5);
    for (const [x, y] of zones.bas) { if (T.bas === 'short' && y > genou) vers(x, y, T.peau, mv * 0.95); else vers(x, y, T.basC, mv); }
    if (T.bas === 'short') for (let x = bB.x0; x <= bB.x1; x++) if (cls[genou * W + x] === 'bas') vers(x, genou, shadeHex(T.basC, -0.25), mv);
  }
  // le haut
  if (zones.haut) {
    const mv = meanV(zones.haut), H = bH.y1 - bH.y0 + 1;
    // largeur du buste à la taille (dernière rangée du haut) : au-delà, ce sont les bras
    let tl = W, tr = 0; for (const [x, y] of zones.haut) if (y >= bH.y1 - 1) { tl = Math.min(tl, x); tr = Math.max(tr, x); }
    const face = dir === 'down' || dir === 'up';
    for (const [x, y] of zones.haut) {
      const bras = face && (x < tl || x > tr), coude = bH.y0 + Math.round(H * 0.42);
      if (T.haut === 'tshirt' && bras && y > coude) { vers(x, y, T.peau, mv * 0.95); continue; }
      let c = T.hautC;
      if (dir === 'down' && T.haut === 'veste' && Math.abs(x - cx) <= 1 && y < bH.y1) c = '#f4f4ee';   // veste ouverte sur un t-shirt blanc
      vers(x, y, c, mv);
    }
    if (dir === 'down' && T.haut === 'veste') for (let y = bH.y0 + 1; y < bH.y1; y++) for (const x of [cx - 2, cx + 2]) if (cls[y * W + x] === 'haut') vers(x, y, shadeHex(T.hautC, -0.3), mv);
    if (dir === 'down' && T.haut === 'chemise') {
      for (const x of [cx - 2, cx - 1, cx + 1, cx + 2]) for (const y of [bH.y0, bH.y0 + 1]) if (cls[y * W + x] === 'haut') peint(x, y, [244, 244, 238]);   // col
      for (let y = bH.y0 + 3; y < bH.y1; y += 3) if (cls[y * W + cx] === 'haut') peint(x0b(cx), y, shadeOf(T.hautC, -0.45));   // boutons
    }
    if (T.haut === 'pull') for (let x = bH.x0; x <= bH.x1; x++) if (cls[bH.y1 * W + x] === 'haut') vers(x, bH.y1, shadeHex(T.hautC, -0.25), mv);   // bord côtelé
  }
  // chaussures : les pixels clairs des dernières rangées
  if (zones.blanc) {
    const pied = bot - 5, L = zones.blanc.filter(([, y]) => y >= pied);
    const mv = L.length ? meanV(L) : 1;
    for (const [x, y] of L) {
      if (T.chaussures === 'sandales') { if (y === bot - 1) vers(x, y, T.chaussuresC, mv); else vers(x, y, T.peau, peauMv); }
      else vers(x, y, T.chaussuresC, mv);
    }
  }
  return { top, bot, cx, bH };
}
const x0b = (x) => x;
const shadeHex = (hex, k) => '#' + shadeOf(hex, k).map((v) => v.toString(16).padStart(2, '0')).join('');

/* ---------------- accessoires dessinés par-dessus ---------------- */
function dessin(ctx) {
  return {
    p(x, y, rgb) { ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; ctx.fillRect(x, y, 1, 1); },
    rect(x, y, w, h, rgb) { ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; ctx.fillRect(x, y, w, h); },
  };
}
/** chapeau calé sur le haut de la tête : casquette (visière vers l'avant) ou bonnet (revers et pompon) */
function chapeau(D, info, dir, T, hw) {
  if (T.chapeau === 'aucun') return;
  const c = shadeOf(T.chapeauC, 0), dk = shadeOf(T.chapeauC, -0.35), lt = shadeOf(T.chapeauC, 0.35), ol = [26, 22, 30];
  const y0 = info.top - 1, cx = info.hx, half = Math.max(5, Math.round(hw / 2) + 1);
  const dome = (h) => { for (let j = 0; j < h; j++) { const w = Math.round(half * Math.sqrt(1 - ((h - 1 - j) / h) ** 2)) + (j > 1 ? 1 : 0); D.rect(cx - w, y0 + j, 2 * w + 1, 1, j === 0 ? lt : c); D.p(cx - w - 1, y0 + j, ol); D.p(cx + w + 1, y0 + j, ol); } D.rect(cx - Math.round(half * 0.6), y0 - 1, Math.round(half * 1.2) + 1, 1, ol); };
  if (T.chapeau === 'casquette') {
    dome(5);
    D.rect(cx - half, y0 + 4, 2 * half + 1, 1, dk);
    if (dir === 'down') { D.rect(cx - half + 1, y0 + 5, 2 * half - 1, 2, dk); D.rect(cx - half + 1, y0 + 7, 2 * half - 1, 1, ol); }
    else if (dir === 'left') { D.rect(cx - half - 4, y0 + 4, 6, 2, dk); D.rect(cx - half - 4, y0 + 6, 6, 1, ol); }
    else if (dir === 'right') { D.rect(cx + half - 1, y0 + 4, 6, 2, dk); D.rect(cx + half - 1, y0 + 6, 6, 1, ol); }
    else D.rect(cx - 2, y0 + 3, 5, 2, ol);   // l'arrière : la petite ouverture réglable
  } else {
    dome(6);
    D.rect(cx - half - 1, y0 + 5, 2 * half + 3, 2, lt); D.rect(cx - half - 1, y0 + 7, 2 * half + 3, 1, dk);
    D.rect(cx - 1, y0 - 3, 3, 3, lt); D.p(cx, y0 - 3, [255, 255, 255]);
  }
}
/** sac à dos (gros rectangle dans le dos, bretelles devant) ou sacoche en bandoulière */
function sac(D, info, dir, T) {
  if (T.sac === 'aucun' || !info.bH) return;
  const c = shadeOf(T.sacC, 0), dk = shadeOf(T.sacC, -0.35), lt = shadeOf(T.sacC, 0.3), ol = [26, 22, 30];
  const b = info.bH, sy = b.y0 + 1, cx = Math.round(b.cx);
  if (T.sac === 'dos') {
    if (dir === 'up') { D.rect(cx - 6, sy, 13, 12, ol); D.rect(cx - 5, sy + 1, 11, 10, c); D.rect(cx - 5, sy + 1, 11, 3, lt); D.rect(cx - 5, sy + 4, 11, 1, dk); D.rect(cx - 2, sy + 6, 5, 3, dk); }
    else if (dir === 'down') { for (const x of [cx - 4, cx + 3]) D.rect(x, sy, 2, b.y1 - sy - 1, dk); }
    else { const x = dir === 'left' ? b.x1 - 1 : b.x0 - 4; D.rect(x, sy, 6, 11, ol); D.rect(x + 1, sy + 1, 4, 9, c); D.rect(x + 1, sy + 1, 4, 2, lt); D.rect(dir === 'left' ? b.x1 - 3 : b.x0 + 1, sy, 2, 6, dk); }
  } else {
    // sacoche : la courroie en diagonale, le sac sur la hanche
    const hy = b.y1 - 2;
    if (dir === 'down' || dir === 'up') {
      const s = dir === 'down' ? 1 : -1;
      for (let k = 0; k < b.y1 - sy; k++) D.p(cx - s * 4 + s * Math.round(k * 0.9), sy + k, dk);
      const bx = dir === 'down' ? cx + 3 : cx - 9; D.rect(bx, hy, 7, 6, ol); D.rect(bx + 1, hy + 1, 5, 4, c); D.rect(bx + 1, hy + 1, 5, 1, lt);
    } else { const bx = dir === 'left' ? b.x1 - 3 : b.x0 - 2; D.rect(bx, hy, 6, 6, ol); D.rect(bx + 1, hy + 1, 4, 4, c); D.rect(bx + 1, hy + 1, 4, 1, lt); }
  }
}

/**
 * compose la rangée du joueur (768 × 64 : 4 directions × 3 pas) à partir de la rangée du modèle de base
 * src : image ou canvas, sx / sy : coin de la rangée du modèle dans src
 */
export function composer(src, sx, sy, T, doc = typeof document !== 'undefined' ? document : null) {
  const W = 64, out = doc.createElement('canvas'); out.width = W * 12; out.height = W;
  const ctx = out.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const DIRS = ['down', 'left', 'right', 'up'];
  for (let i = 0; i < 12; i++) {
    const dir = DIRS[Math.floor(i / 3)];
    const c = doc.createElement('canvas'); c.width = W; c.height = W; const x = c.getContext('2d');
    x.drawImage(src, sx + i * W, sy, W, W, 0, 0, W, W);
    const im = x.getImageData(0, 0, W, W);
    const info = retoucher(im.data, W, dir, T);
    x.putImageData(im, 0, 0);
    // tête : centre et largeur sur les premières rangées
    let sxx = 0, n = 0, l = W, r = 0;
    for (let y = info.top; y < info.top + 8; y++) for (let k = 0; k < W; k++) if (im.data[(y * W + k) * 4 + 3] > 128) { sxx += k; n++; l = Math.min(l, k); r = Math.max(r, k); }
    info.hx = n ? Math.round(sxx / n) : W >> 1;
    const D = dessin(x);
    if (dir === 'up') { chapeau(D, info, dir, T, r - l); sac(D, info, dir, T); } else { sac(D, info, dir, T); chapeau(D, info, dir, T, r - l); }
    ctx.drawImage(c, i * W, 0);
  }
  return out;
}
