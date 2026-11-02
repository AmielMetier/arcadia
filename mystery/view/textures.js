// Mystère Mystère : les matières du manoir, peintes au canvas (rien à télécharger) dans un style cartoon propre :
// papiers peints (damas, rayures, fleurs), boiseries, parquets, damier, carreaux, tapis, pierre et brique.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

const S = 256;
const cache = new Map();
function canvas(w = S, h = S) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, rep = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.repeat.set(rep, rep);
  return t;
}
// léger grain : casse l'aplat sans salir
function grain(g, w, h, a = 0.05) {
  const id = g.getImageData(0, 0, w, h), d = id.data;
  let s = 1234567;
  for (let i = 0; i < d.length; i += 4) { s = (s * 16807) % 2147483647; const n = ((s / 2147483647) - 0.5) * 255 * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
}
// motif de damas : un médaillon symétrique répété en quinconce
function damask(bg, fg) {
  const c = canvas(), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  g.fillStyle = fg;
  const motif = (cx, cy, k) => {
    g.save(); g.translate(cx, cy); g.scale(k, k);
    for (const sx of [1, -1]) {
      g.save(); g.scale(sx, 1);
      g.beginPath(); g.moveTo(0, -46);
      g.bezierCurveTo(20, -30, 26, -10, 8, 0); g.bezierCurveTo(26, 10, 20, 30, 0, 46);
      g.bezierCurveTo(6, 24, 4, 10, 0, 6); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(18, -18, 7, 12, 0.6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(18, 18, 7, 12, -0.6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(30, 0, 4, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.beginPath(); g.arc(0, -54, 4, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(0, 54, 4, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  motif(64, 64, 0.95); motif(192, 192, 0.95); motif(192, -64, 0.95); motif(-64, 192, 0.95); motif(320, 64, 0.95); motif(64, 320, 0.95);
  g.fillStyle = fg; for (const [x, y] of [[192, 64], [64, 192], [0, 0], [256, 0], [0, 256], [256, 256]]) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
  grain(g, S, S, 0.035);
  return c;
}
function stripes(a, b, n = 8, thin) {
  const c = canvas(), g = c.getContext('2d');
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * S / n, 0, S / n, S); }
  if (thin) { g.fillStyle = thin; for (let i = 0; i < n; i += 2) g.fillRect(i * S / n + S / n - 3, 0, 3, S); }
  grain(g, S, S, 0.03);
  return c;
}
function flowers(bg, petal, leaf) {
  const c = canvas(), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  const fl = (x, y, r) => {
    g.fillStyle = leaf; g.beginPath(); g.ellipse(x - r, y + r * 0.9, r * 0.7, r * 0.3, -0.6, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(x + r, y + r * 0.9, r * 0.7, r * 0.3, 0.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = petal; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.5, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(x, y, r * 0.35, 0, Math.PI * 2); g.fill();
  };
  for (const [x, y] of [[48, 48], [176, 112], [80, 208], [224, 240], [224, -16], [-32, 112]]) fl(x, y, 16);
  grain(g, S, S, 0.03);
  return c;
}
function planks(base, dark, w = 6, herring = false) {
  const c = canvas(), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  if (herring) {
    const L = 64, Wd = 16;
    for (let y = -L; y < S + L; y += Wd * 2) for (let x = -L; x < S + L; x += L) {
      for (const [dx, dy, r] of [[0, 0, Math.PI / 4], [Wd * 1.4, 0, -Math.PI / 4]]) {
        g.save(); g.translate(x + dx + (y / (Wd * 2)) % 2 * 0, y + dy); g.rotate(r);
        const k = ((x * 7 + y * 13) % 5) / 5;
        g.fillStyle = shade(base, -0.06 + k * 0.12); g.fillRect(0, 0, L, Wd);
        g.strokeStyle = dark; g.lineWidth = 1.5; g.strokeRect(0, 0, L, Wd);
        g.restore();
      }
    }
  } else {
    const h = S / w;
    for (let i = 0; i < w; i++) {
      const off = (i * 97) % S;
      for (let k = 0; k < 2; k++) {
        g.fillStyle = shade(base, ((i * 31 + k * 17) % 7 - 3) * 0.025);
        g.fillRect(((off + k * S / 2) % S), i * h, S / 2, h); g.fillRect(((off + k * S / 2) % S) - S, i * h, S / 2, h);
      }
      g.fillStyle = dark; g.fillRect(0, i * h, S, 2);
      g.fillRect(off, i * h, 2, h); g.fillRect((off + S / 2) % S, i * h, 2, h);
      // veines
      g.strokeStyle = shade(base, -0.12); g.globalAlpha = 0.35; g.lineWidth = 1;
      for (let v = 0; v < 2; v++) { g.beginPath(); const y0 = i * h + 6 + v * (h / 2 - 3); g.moveTo(0, y0); for (let x = 0; x <= S; x += 32) g.lineTo(x, y0 + Math.sin(x * 0.05 + i) * 2); g.stroke(); }
      g.globalAlpha = 1;
    }
  }
  grain(g, S, S, 0.04);
  return c;
}
function checker(a, b, n = 4, border) {
  const c = canvas(), g = c.getContext('2d'), s = S / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = (x + y) % 2 ? b : a; g.fillRect(x * s, y * s, s, s); }
  if (border) { g.strokeStyle = border; g.lineWidth = 2; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, S); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(S, i * s); g.stroke(); } }
  // veines de marbre
  g.globalAlpha = 0.18; g.strokeStyle = '#8a8a96'; g.lineWidth = 1.2;
  for (let k = 0; k < 6; k++) { g.beginPath(); let x = (k * 53) % S, y = 0; g.moveTo(x, y); while (y < S) { x += Math.sin(y * 0.07 + k) * 6 + 2; y += 12; g.lineTo(x, y); } g.stroke(); }
  g.globalAlpha = 1;
  grain(g, S, S, 0.025);
  return c;
}
function tiles(base, joint, n = 8) {
  const c = canvas(), g = c.getContext('2d'), s = S / n;
  g.fillStyle = joint; g.fillRect(0, 0, S, S);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = shade(base, (((x * 7 + y * 11) % 5) - 2) * 0.02); g.fillRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3); }
  grain(g, S, S, 0.03);
  return c;
}
function carpet(bg, border, motif) {
  const c = canvas(), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  g.fillStyle = motif; g.globalAlpha = 0.55;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const cx = x * 64 + 32, cy = y * 64 + 32; g.beginPath(); g.moveTo(cx, cy - 14); g.lineTo(cx + 14, cy); g.lineTo(cx, cy + 14); g.lineTo(cx - 14, cy); g.closePath(); g.fill(); }
  g.globalAlpha = 1; g.strokeStyle = border; g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, S); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(S, i * 64); g.stroke(); }
  grain(g, S, S, 0.08);
  return c;
}
function stone(base, joint, brick) {
  const c = canvas(), g = c.getContext('2d');
  g.fillStyle = joint; g.fillRect(0, 0, S, S);
  const rows = brick ? 8 : 5, h = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -h * (brick ? 1 : 0.7) : 0;
    while (x < S) {
      const w = brick ? h * 2 : h * (1.1 + ((r * 13 + x) % 7) / 7);
      g.fillStyle = shade(base, (((r * 5 + Math.floor(x)) % 9) - 4) * 0.03);
      const rr = brick ? 1 : 5;
      roundRect(g, x + 2, r * h + 2, w - 4, h - 4, rr); g.fill();
      x += w;
    }
  }
  grain(g, S, S, 0.09);
  return c;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }
// boiserie : panneaux moulurés (bas des murs)
function panel(base, dark, light) {
  const c = canvas(S, S / 2), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, S, S / 2);
  for (let i = 0; i < 2; i++) {
    const x = i * 128 + 12, y = 14, w = 104, h = 100;
    g.fillStyle = dark; g.fillRect(x, y, w, h); g.fillStyle = shade(base, 0.05); g.fillRect(x + 4, y + 4, w - 8, h - 8);
    g.fillStyle = light; g.fillRect(x, y, w, 2); g.fillRect(x, y, 2, h);
  }
  g.fillStyle = light; g.fillRect(0, 0, S, 4); g.fillStyle = dark; g.fillRect(0, S / 2 - 6, S, 6);
  grain(g, S, S / 2, 0.04);
  return c;
}
// plafond à caissons : un cadre mouluré par carreau de 2 m
function coffer(base, mid, dark) {
  const c = canvas(), g = c.getContext('2d');
  g.fillStyle = mid; g.fillRect(0, 0, S, S);
  g.fillStyle = dark; g.fillRect(18, 18, S - 36, S - 36);
  g.fillStyle = base; g.fillRect(26, 26, S - 52, S - 52);
  g.strokeStyle = shade(mid, 0.2); g.lineWidth = 3; g.strokeRect(36, 36, S - 72, S - 72);
  g.fillStyle = shade(base, 0.1); g.beginPath(); g.arc(S / 2, S / 2, 18, 0, Math.PI * 2); g.fill();
  grain(g, S, S, 0.025);
  return c;
}
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return '#' + ((1 << 24) | (f(r) << 16) | (f(gg) << 8) | f(b)).toString(16).slice(1);
}

const MAKERS = {
  'damas-rouge': () => damask('#9c2f3a', '#b5444d'),
  'damas-vert': () => damask('#2f6b4f', '#3e8262'),
  'damas-bleu': () => damask('#2e4f86', '#3e64a3'),
  'damas-violet': () => damask('#5c3a7a', '#71508f'),
  'rayures-or': () => stripes('#e9c87a', '#dcb35e', 8, '#c99a3f'),
  'rayures-rose': () => stripes('#f2c3c8', '#e8aab2', 8),
  'rayures-bleu': () => stripes('#bcd7ee', '#a6c6e3', 10),
  fleurs: () => flowers('#f3e7cf', '#e88a9a', '#7fae7a'),
  creme: () => stripes('#efe1c6', '#e8d7b8', 16),
  faience: () => tiles('#dff0ee', '#a9c9c6', 8),
  serre: () => tiles('#e5efe0', '#c3d6bb', 4),
  pierre: () => stone('#8d8a86', '#4a4643'),
  brique: () => stone('#a4553f', '#5e3a30', true),
  parquet: () => planks('#a86a3a', '#6a3f1f', 6, true),
  'parquet-sombre': () => planks('#7a4526', '#43230f', 6, true),
  damier: () => checker('#f1ece2', '#2b2b33', 4),
  carreaux: () => checker('#e7e2d6', '#b8463c', 8, '#9a8f80'),
  tomettes: () => tiles('#c4683f', '#8d4528', 6),
  'tapis-rouge': () => carpet('#8f1f2b', '#d2a64a', '#c4404d'),
  'tapis-bleu': () => carpet('#2b4f8c', '#e3c36b', '#4c74b5'),
  'tapis-vert': () => carpet('#2f7a52', '#e9d38a', '#4f9b70'),
  acajou: () => panel('#6a2f1c', '#40190d', '#8c4a30'),
  chene: () => panel('#a8743f', '#6e4520', '#c79560'),
  blanc: () => panel('#ece6da', '#bfb6a6', '#ffffff'),
  plafond: () => coffer('#f1e6cf', '#d9c7a3', '#b99a68'),
  'plafond-cave': () => stone('#6f6b66', '#3d3936'),
};
export function surface(name, rep = 1) {
  const k = name + ':' + rep;
  if (cache.has(k)) return cache.get(k);
  const make = MAKERS[name] || MAKERS.creme;
  const t = tex(make(), rep);
  cache.set(k, t);
  return t;
}
// lueur ronde (halo des lampes, faisceau du revolver tombé)
export function glowSprite(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = canvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// étiquette de nom au-dessus d'un personnage
export function nameTag(name, color) {
  const c = canvas(256, 64), g = c.getContext('2d');
  g.font = '700 30px "Fredoka", "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.min(244, g.measureText(name).width + 28);
  g.fillStyle = 'rgba(18,14,30,0.62)'; roundRect(g, 128 - w / 2, 10, w, 44, 22); g.fill();
  g.fillStyle = color; g.beginPath(); g.arc(128 - w / 2 + 16, 32, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.fillText(name, 128 + 6, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// tableau accroché au mur : un petit paysage ou un portrait peint
export function painting(seed) {
  const c = canvas(128, 160), g = c.getContext('2d');
  const r = (n) => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * n; };
  const sky = ['#9ec5e8', '#f2b880', '#c7b3e6', '#8fb8a8'][Math.floor(r(4))];
  g.fillStyle = sky; g.fillRect(0, 0, 128, 160);
  if (r(1) < 0.5) {
    g.fillStyle = '#5d8a4f'; g.beginPath(); g.moveTo(0, 110); for (let x = 0; x <= 128; x += 16) g.lineTo(x, 100 + Math.sin(x * 0.05 + r(6)) * 14); g.lineTo(128, 160); g.lineTo(0, 160); g.fill();
    g.fillStyle = '#3f6a3a'; for (let k = 0; k < 3; k++) { const x = 20 + r(90); g.beginPath(); g.arc(x, 96, 12 + r(8), 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(30 + r(70), 36, 12, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = shade(sky, -0.3); g.fillRect(0, 0, 128, 160);
    g.fillStyle = ['#3b2a20', '#2a2a3a', '#6b2a2a'][Math.floor(r(3))]; g.beginPath(); g.ellipse(64, 150, 46, 50, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#efc7a8'; g.beginPath(); g.ellipse(64, 70, 24, 30, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = ['#2b1d14', '#7a4a20', '#d9c27a', '#9a9a9a'][Math.floor(r(4))]; g.beginPath(); g.ellipse(64, 50, 27, 18, 0, Math.PI, Math.PI * 2); g.fill();
    g.fillStyle = '#2b1d14'; g.fillRect(52, 68, 5, 4); g.fillRect(71, 68, 5, 4);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
