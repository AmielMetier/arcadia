// backrooms/view/entity.js — l'entité « classique » des Backrooms, dessinée dans le code (mode normal).
// Une silhouette noire, filiforme, aux membres trop longs et aux deux yeux blancs, qui ondule.
// Elle remplace les monstres du mode VIP pour tout le monde : même format que leurs fichiers
// (une image fixe pour le Level 0, une planche d'images pour le Level 1), et un grognement synthétisé à la place de la voix.

const FW = 246, FH = 400;                 // une image de la planche (même proportion que celle du mode VIP)
const COLS = 8, ROWS = 4, FRAMES = 32;    // 32 images, 12 par seconde : un peu moins de 3 s de boucle

/** dessine l'entité dans un rectangle w × h ; t de 0 à 1 : la phase de son ondulation */
function drawEntity(g, w, h, t) {
  const s = Math.sin(t * Math.PI * 2), c = Math.cos(t * Math.PI * 2);
  const cx = w / 2 + s * w * 0.03;
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.fillStyle = '#050505'; g.strokeStyle = '#050505';
  // fumée noire autour du corps : la silhouette n'a pas de bord net
  g.shadowColor = 'rgba(0,0,0,0.95)'; g.shadowBlur = w * 0.05;
  // jambes, trop longues, légèrement fléchies
  const hip = { x: cx, y: h * 0.55 };
  g.lineWidth = w * 0.055;
  for (const k of [-1, 1]) {
    g.beginPath(); g.moveTo(hip.x + k * w * 0.04, hip.y);
    g.quadraticCurveTo(hip.x + k * w * (0.1 + 0.02 * s * k), h * 0.78, hip.x + k * w * 0.07, h * 0.985);
    g.stroke();
  }
  // corps : un tronc étiré qui se courbe en avant
  g.beginPath();
  g.moveTo(cx - w * 0.07, hip.y);
  g.bezierCurveTo(cx - w * 0.1, h * 0.38, cx - w * 0.06 + s * 3, h * 0.24, cx - w * 0.035, h * 0.17);
  g.lineTo(cx + w * 0.035, h * 0.17);
  g.bezierCurveTo(cx + w * 0.06 + s * 3, h * 0.24, cx + w * 0.1, h * 0.38, cx + w * 0.07, hip.y);
  g.closePath(); g.fill();
  // bras interminables qui pendent jusqu'aux genoux, doigts en griffes
  g.lineWidth = w * 0.04;
  for (const k of [-1, 1]) {
    const sw = (k > 0 ? s : -c) * w * 0.05;
    const sh = { x: cx + k * w * 0.075, y: h * 0.2 };
    const el = { x: cx + k * w * 0.2 + sw * 0.5, y: h * 0.42 };
    const ha = { x: cx + k * w * 0.23 + sw, y: h * 0.7 };
    g.beginPath(); g.moveTo(sh.x, sh.y); g.quadraticCurveTo(el.x, el.y, ha.x, ha.y); g.stroke();
    g.lineWidth = w * 0.014;
    for (let f = -1; f <= 1; f++) {
      g.beginPath(); g.moveTo(ha.x, ha.y);
      g.quadraticCurveTo(ha.x + k * w * 0.02 + f * w * 0.015, ha.y + h * 0.04, ha.x + f * w * 0.03, ha.y + h * 0.075);
      g.stroke();
    }
    g.lineWidth = w * 0.04;
  }
  // cou fin et tête allongée, penchée
  g.lineWidth = w * 0.03;
  g.beginPath(); g.moveTo(cx, h * 0.18); g.lineTo(cx + s * w * 0.01, h * 0.12); g.stroke();
  const hx = cx + s * w * 0.015, hy = h * 0.08;
  g.save(); g.translate(hx, hy); g.rotate(s * 0.08);
  g.beginPath(); g.ellipse(0, 0, w * 0.075, h * 0.06, 0, 0, Math.PI * 2); g.fill();
  // deux yeux blancs qui brillent, sans pupille
  g.shadowColor = 'rgba(255,255,255,0.9)'; g.shadowBlur = w * 0.03;
  g.fillStyle = '#f4f4f0';
  for (const k of [-1, 1]) { g.beginPath(); g.ellipse(k * w * 0.028, -h * 0.004, w * 0.016, h * 0.008 * (0.8 + 0.2 * c), 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
  g.restore();
}

function canvas(w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  return cv;
}

let cached = null;
/** { img, anim } : image fixe (Level 0) et planche animée (Level 1), en adresses data: utilisables partout */
export function classicEntity() {
  if (cached) return cached;
  if (typeof document === 'undefined') return (cached = { img: '', anim: { url: '', frames: 1, cols: 1, rows: 1, fps: 12, aspect: FW / FH, tint: '#ffffff' } });
  const one = canvas(FW * 2, FH * 2);
  drawEntity(one.getContext('2d'), one.width, one.height, 0.1);
  const sheet = canvas(FW * COLS, FH * ROWS), g = sheet.getContext('2d');
  for (let f = 0; f < FRAMES; f++) {
    g.save(); g.translate((f % COLS) * FW, Math.floor(f / COLS) * FH);
    g.beginPath(); g.rect(0, 0, FW, FH); g.clip();
    drawEntity(g, FW, FH, f / FRAMES);
    g.restore();
  }
  cached = {
    img: one.toDataURL('image/png'),
    anim: { url: sheet.toDataURL('image/png'), frames: FRAMES, cols: COLS, rows: ROWS, fps: 12, aspect: FW / FH, tint: '#ffffff' },
  };
  return cached;
}

/** grognement grave en boucle (≈ 3 s) : deux souffles bruités sous un râle basse fréquence */
export function growlBuffer(ctx) {
  const sr = ctx.sampleRate, n = Math.floor(sr * 3.2), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  let lp = 0, ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // deux expirations par boucle, qui montent puis retombent
    const env = Math.pow(Math.max(0, Math.sin((t / 3.2) * Math.PI * 2 - 0.4)), 1.6) * 0.9 + 0.08;
    const f = 52 + 14 * Math.sin(t * 2.3) + 6 * Math.sin(t * 17);
    ph += (2 * Math.PI * f) / sr;
    const rasp = Math.sign(Math.sin(ph)) * 0.35 + Math.sin(ph * 0.5) * 0.4;   // râle : onde carrée sourde
    lp += ((Math.random() * 2 - 1) - lp) * 0.06;                             // souffle : bruit filtré
    d[i] = (rasp * (0.6 + 0.4 * Math.sin(t * 31)) * 0.55 + lp * 1.6) * env * 0.6;
  }
  // fondu aux bords : la boucle ne claque pas
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < fade; i++) { d[i] *= i / fade; d[n - 1 - i] *= i / fade; }
  return buf;
}
