// odyssee/js/render/tenue.js — les couleurs de la tenue du joueur, posées sur le dresseur par défaut (player_m / player_f) :
// le dessin ne change pas, seules la casquette (le serre-tête de la fille), le haut, le bas, les chaussures et le sac
// changent de couleur en gardant leurs ombres. Chaque zone se reconnaît à sa teinte sur le dessin d'origine et à sa place
// dans l'image (tête, buste, jambes, pieds). Sans DOM ailleurs que dans composer() (canvas) ; zonesTenue() est testable dans Node.

/** les couleurs proposées ; '' garde la couleur d'origine du dessin */
export const COULEURS = [['', 'D\'origine'], ['#d83a3a', 'Rouge'], ['#f08a2a', 'Orange'], ['#f0d040', 'Jaune'], ['#4cae4c', 'Vert'], ['#2f9a9a', 'Turquoise'], ['#3a6ad8', 'Bleu'], ['#283c78', 'Marine'],
  ['#8a4ad0', 'Violet'], ['#e070a8', 'Rose'], ['#f4f4f0', 'Blanc'], ['#8c8c94', 'Gris'], ['#2a2a30', 'Noir'], ['#8a5a32', 'Marron'], ['#c8b088', 'Beige']];
/** les pièces qu'on peut recolorer, dans l'ordre de l'écran d'apparence ; le nom de la première dépend du genre */
export const PIECES = [['chapeauC', (g) => g === 'f' ? 'Serre-tête' : 'Casquette'], ['hautC', () => 'Haut'], ['basC', () => 'Bas'], ['chaussuresC', () => 'Chaussures'], ['sacC', () => 'Sacoche']];
export const TENUE_DEFAUT = { genre: 'm', chapeauC: '', hautC: '', basC: '', chaussuresC: '', sacC: '' };
/** vrai si la tenue ne change rien au dessin d'origine */
export const tenueOrigine = (T) => !T || PIECES.every(([k]) => !T[k]);

/** tenue → code court (pour l'envoyer aux autres joueurs), et retour ; un code invalide (ou d'une ancienne version) donne null */
const CHAMPS = ['genre', ...PIECES.map(([k]) => k)];
const choix = (k) => k === 'genre' ? ['m', 'f'] : COULEURS.map(([v]) => v);
export function tenueCode(T) { if (!T) return ''; return 'c' + CHAMPS.map((k) => Math.max(0, choix(k).indexOf(T[k] || '')).toString(36)).join(''); }
export function tenueDecode(code) {
  if (typeof code !== 'string' || code.length !== CHAMPS.length + 1 || code[0] !== 'c') return null;
  const T = {};
  for (let i = 0; i < CHAMPS.length; i++) { const L = choix(CHAMPS[i]), n = parseInt(code[i + 1], 36); if (!(n >= 0 && n < L.length)) return null; T[CHAMPS[i]] = L[n]; }
  return T;
}
/** une tenue enregistrée (même d'une ancienne version, où l'on choisissait aussi les formes) → tenue valide */
const ANCIEN_DEFAUT = { chapeauC: '#d83a3a', hautC: '#3a6ad8', basC: '#283c78', chaussuresC: '#d83a3a', sacC: '#f0d040' };
export function tenueValide(T, genre) {
  const R = { ...TENUE_DEFAUT, genre: T?.genre === 'f' || (!T?.genre && genre === 'f') ? 'f' : 'm' };
  // une tenue de l'ancienne version (avec les formes) restée à ses couleurs de départ : le dresseur d'origine
  if (T && T.haut && PIECES.every(([k]) => T[k] === ANCIEN_DEFAUT[k])) return R;
  if (T) for (const [k] of PIECES) if (COULEURS.some(([v]) => v && v === T[k])) R[k] = T[k];
  return R;
}

/* ---------------- couleurs ---------------- */
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function rgbHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
  let h = 0; if (c) h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; h = ((h / 6) + 1) % 1;
  return [h, mx ? c / mx : 0, mx];
}
function hsvRgb(h, s, v) { const f = (n) => { const k = (n + h * 6) % 6; return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255); }; return [f(5), f(3), f(1)]; }

/* ---------------- les zones du dessin ---------------- */
export const ZONES = ['', 'chapeauC', 'hautC', 'basC', 'chaussuresC', 'sacC'];
const CHAP = 1, HAUT = 2, BAS = 3, PIED = 4, SAC = 5;
const entre = (h, a, b) => h >= a && h <= b;
// les teintes de chaque dresseur par défaut
const REGLES = {
  // garçon : casquette turquoise, blouson orange, short gris (jean bleu de profil), baskets rouges, sacoche jaune
  m: {
    buste: (h, s, v) => (h < 0.075 || h > 0.97) && s >= 0.7 && v >= 0.7,
    tete: (h, s, v) => entre(h, 0.44, 0.58) && s >= 0.3 && v >= 0.3,   // la casquette : le cou est en dessous (de dos, son réglage est orange)
    zone(h, s, v, y, L) {
      if (y < L.cou) return entre(h, 0.44, 0.58) && s >= 0.12 ? CHAP : 0;
      if (y >= L.pied && (h < 0.045 || h > 0.95) && s >= 0.6 && v >= 0.25) return PIED;
      if (entre(h, 0.085, 0.18) && s >= 0.55 && v >= 0.3) return SAC;
      if (y < L.pied && (h < 0.075 || h > 0.95) && s >= 0.68 && v >= 0.2) return HAUT;
      if (entre(h, 0.53, 0.7) && s >= 0.08 && v >= 0.12 && v < 0.75) return BAS;
      return 0;
    },
  },
  // fille : serre-tête jaune, sweat violet, short turquoise, bottines marron, sacoche turquoise (sa courroie sur le sweat)
  f: {
    buste: (h, s, v) => entre(h, 0.7, 0.86) && s >= 0.35 && v >= 0.35,
    zone(h, s, v, y, L) {
      if (y < L.cou) return entre(h, 0.085, 0.18) && s >= 0.5 && v >= 0.4 ? CHAP : 0;
      if (entre(h, 0.68, 0.86) && v >= 0.1 && (s >= 0.25 || (s >= 0.1 && v >= 0.85))) return HAUT;
      if (entre(h, 0.44, 0.62) && s >= 0.5 && v >= 0.12) return y > L.taille ? BAS : SAC;
      if (y >= L.pied && entre(h, 0.02, 0.1) && s >= 0.4 && v >= 0.15 && v <= 0.72) return PIED;
      return 0;
    },
  },
};

// les teintes des dresseurs de Noir & Blanc (trchar000 / trchar001) quand le pack Noir & Blanc est actif
const REGLES_NB = {
  // garçon (Noir & Blanc 2) : visière rouge-orangé, veste bleue, pantalon/short bleu sombre, baskets rouges, sacoche brune
  m: {
    zone(h, s, v, y, L) {
      const m = L.top + (L.bot - L.top) * 0.48;
      if (y < m) return (h < 0.075 || h > 0.96) && s >= 0.6 && v >= 0.55 ? CHAP : 0;
      if (y >= L.pied && (h < 0.055 || h > 0.96) && s >= 0.6 && v >= 0.45) return PIED;
      if (y >= L.bot - 11 && y < L.bot - 3 && entre(h, 0.58, 0.76) && s >= 0.35 && v <= 0.88) return BAS;
      if (y < L.bot - 11 && entre(h, 0.58, 0.66) && s >= 0.45 && v >= 0.3) return HAUT;
      if (y >= m && y < L.bot - 6 && s <= 0.22 && v >= 0.72) return SAC;
      return 0;
    },
  },
  // fille (Noir & Blanc 2) : visière rose (sans toucher aux macarons bruns), haut rose, jupe jaune / short prune, sac rose, bottines roses
  f: {
    zone(h, s, v, y, L) {
      const m = L.top + (L.bot - L.top) * 0.44;
      if (y < m) return h >= 0.93 && s >= 0.25 && v >= 0.42 ? CHAP : 0;
      if (y >= L.bot - 8 && h >= 0.88 && s >= 0.32 && v >= 0.24) return PIED;
      if (y >= L.bot - 14 && y < L.bot - 5) {
        if (entre(h, 0.10, 0.16) && s >= 0.4 && v >= 0.65) return BAS;
        if (entre(h, 0.85, 0.94) && s >= 0.35 && v >= 0.22 && v <= 0.55) return BAS;
      }
      if (y >= L.bot - 15 && y < L.bot - 8 && h >= 0.94 && s >= 0.48 && v >= 0.6) return SAC;
      if (y >= m && y < L.bot - 15 && h >= 0.93 && s >= 0.35 && v >= 0.35) return HAUT;
      return 0;
    },
  },
};

/** zones d'une image W × W du dresseur par défaut (px : RGBA) → tableau d'indices dans ZONES (0 : rien à changer) */
export function zonesTenue(px, W, genre) {
  const R = REGLES[genre] || REGLES.m, at = (x, y) => (y * W + x) * 4, hsv = new Array(W * W);
  let top = W, bot = -1, totB = 0, totT = 0;
  const nb = new Array(W).fill(0), nt = new Array(W).fill(0);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const o = at(x, y); if (px[o + 3] < 128) continue;
    const c = hsv[y * W + x] = rgbHsv(px[o], px[o + 1], px[o + 2]);
    top = Math.min(top, y); bot = Math.max(bot, y);
    if (R.buste(...c)) { nb[y]++; totB++; }
    if (R.tete?.(...c)) { nt[y]++; totT++; }
  }
  const out = new Uint8Array(W * W); if (bot < 0) return out;
  // pack Noir & Blanc : le dresseur n'a ni la casquette turquoise ni le sweat violet du dresseur de base
  const regle = (genre === 'f' ? totB < 12 : totT < 12) ? (REGLES_NB[genre] || REGLES_NB.m) : R;
  // le cou : première rangée sous la coiffure où le haut fait au moins trois pixels ; la taille : la dernière
  let tete = -1; for (let y = top; y <= top + (bot - top) * 0.55; y++) if (nt[y] >= 3) tete = y;
  let cou = -1, taille = -1; for (let y = tete + 1; y <= bot; y++) if (nb[y] >= 3) { if (cou < 0) cou = y; taille = y; }
  if (cou < 0) cou = top + Math.round((bot - top) * 0.45), taille = top + Math.round((bot - top) * 0.75);
  const L = { top, bot, cou, taille, pied: bot - (genre === 'f' ? 7 : 6) };
  for (let y = top; y <= bot; y++) for (let x = 0; x < W; x++) { const c = hsv[y * W + x]; if (c) out[y * W + x] = regle.zone(c[0], c[1], c[2], y, L); }
  return out;
}

/** zones dessinées à la main par un pack de graphismes (Noir & Blanc) : { m, f } → Uint8Array de 768 × 64 (une valeur de
 *  ZONES par pixel, les 12 poses côte à côte) ; elles remplacent la détection automatique faite pour le dresseur de base */
let MASQUES = null;
export function setMasques(M) { MASQUES = M; }
/** les zones de la pose i (W × W), tirées des masques du pack, ou null */
function zonesPack(genre, i, W) {
  const M = MASQUES?.[genre]; if (!M || W !== 64) return null;
  const Z = new Uint8Array(W * W); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) Z[y * W + x] = M[y * 768 + i * W + x];
  return Z;
}

/** recolore une image (px : RGBA, W × W) selon la tenue ; renvoie le nombre de pixels changés (Z : zones déjà connues) */
export function recolorer(px, W, genre, T, Zp = null) {
  const Z = Zp || zonesTenue(px, W, genre); let n = 0;
  for (let z = 1; z < ZONES.length; z++) {
    const hex = T[ZONES[z]]; if (!hex) continue;
    // valeur moyenne de la zone : chaque pixel garde son ombre relative autour de la teinte voulue
    let sv = 0, ss = 0, k = 0;
    for (let i = 0; i < Z.length; i++) if (Z[i] === z) { const [, s, v] = rgbHsv(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); sv += v; ss += s; k++; }
    if (!k) continue;
    const mv = sv / k, ms = ss / k, [th, ts, tv] = rgbHsv(...hexRgb(hex));
    for (let i = 0; i < Z.length; i++) if (Z[i] === z) {
      const o = i * 4, [, s, v] = rgbHsv(px[o], px[o + 1], px[o + 2]);
      const r = v / mv;   // plus clair ou plus sombre que la moyenne de la zone
      const nv = Math.max(0.04, Math.min(1, r <= 1 ? tv * r : tv + (1 - tv) * Math.min(1, (r - 1) * 1.6)));
      const ns = Math.max(0, Math.min(1, ts * (r > 1.15 ? 0.75 : 1) * Math.min(1.3, 0.55 + 0.45 * s / Math.max(0.05, ms))));
      const [a, b, c] = hsvRgb(th, ns, nv); px[o] = a; px[o + 1] = b; px[o + 2] = c; n++;
    }
  }
  return n;
}

/**
 * compose la rangée du joueur (768 × 64 : 4 directions × 3 pas) à partir de la rangée du dresseur par défaut
 * src : image ou canvas, sx / sy : coin de la rangée dans src
 */
export function composer(src, sx, sy, T, doc = typeof document !== 'undefined' ? document : null) {
  const W = 64, out = doc.createElement('canvas'); out.width = W * 12; out.height = W;
  const ctx = out.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const c = doc.createElement('canvas'); c.width = W; c.height = W; const x = c.getContext('2d', { willReadFrequently: true });
  for (let i = 0; i < 12; i++) {
    x.clearRect(0, 0, W, W); x.drawImage(src, sx + i * W, sy, W, W, 0, 0, W, W);
    const im = x.getImageData(0, 0, W, W);
    const g = T.genre === 'f' ? 'f' : 'm';
    recolorer(im.data, W, g, T, zonesPack(g, i, W));
    x.putImageData(im, 0, 0);
    ctx.drawImage(c, i * W, 0);
  }
  return out;
}
