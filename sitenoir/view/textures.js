// Site Noir : matériaux dessinés au canvas, sans image à charger. Chaque surface peint trois couches en même temps : couleur, relief (d'où sort la carte de normales)
// et brillance (une flaque ou un carrelage verni renvoient la lampe, un plafond non). Rien ne se répète trop visiblement.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { makeRng } from '../engine/rng.js';

let SIZE = 1024;
const NMAP = 512;
export function setTextureSize(s) { SIZE = s; }
const mk = (s = SIZE) => { const c = document.createElement('canvas'); c.width = c.height = s; return c; };

// bruit qui se raccorde : une petite image aléatoire étirée et répétée, à plusieurs échelles
let noiseC = null;
function noiseTile() {
  if (noiseC) return noiseC;
  noiseC = mk(128);
  const g = noiseC.getContext('2d'), im = g.createImageData(128, 128), r = makeRng(4242);
  for (let i = 0; i < im.data.length; i += 4) { const v = r.next() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0);
  return noiseC;
}
function noise(g, scale, alpha, mode = 'overlay') {
  const p = g.createPattern(noiseTile(), 'repeat');
  p.setTransform(new DOMMatrix().scale(scale * SIZE / 1024, scale * SIZE / 1024));
  g.save(); g.imageSmoothingEnabled = true; g.globalCompositeOperation = mode; g.globalAlpha = alpha; g.fillStyle = p; g.fillRect(0, 0, SIZE, SIZE); g.restore();
}
const fbm = (g, scales, a, mode) => scales.forEach((s, i) => noise(g, s, a / (1 + i * 0.5), mode));

// trois calques peints ensemble ; les coordonnées sont en 0..1 de la texture
class Layers {
  constructor(seed) { this.a = mk(); this.h = mk(); this.r = mk(); this.A = this.a.getContext('2d'); this.H = this.h.getContext('2d', { willReadFrequently: true }); this.R = this.r.getContext('2d'); this.rng = makeRng(seed); }
  base(color, height, rough) { this.A.fillStyle = color; this.A.fillRect(0, 0, SIZE, SIZE); this.H.fillStyle = gray(height); this.H.fillRect(0, 0, SIZE, SIZE); this.R.fillStyle = gray(rough); this.R.fillRect(0, 0, SIZE, SIZE); }
  rect(x, y, w, h, color, height, rough) {
    const X = x * SIZE, Y = y * SIZE, W = w * SIZE, Hh = h * SIZE;
    if (color) { this.A.fillStyle = color; this.A.fillRect(X, Y, W, Hh); }
    if (height != null) { this.H.fillStyle = gray(height); this.H.fillRect(X, Y, W, Hh); }
    if (rough != null) { this.R.fillStyle = gray(rough); this.R.fillRect(X, Y, W, Hh); }
  }
  // tache douce, répétée de l'autre côté si elle déborde : la texture reste raccordable
  stain(x, y, rad, rgb, alpha, rough, roughA = 0.8) {
    for (const ox of x * SIZE < rad * SIZE ? [0, 1] : x + rad > 1 ? [0, -1] : [0]) for (const oy of y < rad ? [0, 1] : y + rad > 1 ? [0, -1] : [0]) {
      const X = (x + ox) * SIZE, Y = (y + oy) * SIZE, R = rad * SIZE;
      const gr = this.A.createRadialGradient(X, Y, R * 0.1, X, Y, R); gr.addColorStop(0, `rgba(${rgb},${alpha})`); gr.addColorStop(0.7, `rgba(${rgb},${alpha * 0.45})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      this.A.fillStyle = gr; this.A.fillRect(X - R, Y - R, R * 2, R * 2);
      if (rough != null) { const v = Math.round(rough * 255), g2 = this.R.createRadialGradient(X, Y, R * 0.1, X, Y, R); g2.addColorStop(0, `rgba(${v},${v},${v},${roughA})`); g2.addColorStop(0.75, `rgba(${v},${v},${v},${roughA * 0.6})`); g2.addColorStop(1, `rgba(${v},${v},${v},0)`); this.R.fillStyle = g2; this.R.fillRect(X - R, Y - R, R * 2, R * 2); }
    }
  }
  stains(n, rmin, rmax, rgb, alpha, rough, roughA) { const r = this.rng; for (let i = 0; i < n; i++) this.stain(r.next(), r.next(), rmin + r.next() * (rmax - rmin), rgb, alpha * (0.4 + r.next() * 0.6), rough, roughA); }
  // coulures depuis une hauteur donnée
  drips(n, rgb, from = 0, len = 0.5) {
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      const x = r.next() * SIZE, y = from * SIZE, l = (0.08 + r.next() * len) * SIZE, w = 1 + r.next() * r.next() * 7 * SIZE / 1024, a = 0.15 + r.next() * 0.45;
      const gr = this.A.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      this.A.fillStyle = gr; this.A.fillRect(x, y, w, l);
    }
  }
  // fissure : une ligne brisée, sombre et creuse
  crack(x, y, len, ang) {
    const r = this.rng; let X = x * SIZE, Y = y * SIZE;
    const pts = [[X, Y]], n = 6 + Math.floor(r.next() * 8);
    for (let i = 0; i < n; i++) { ang += (r.next() - 0.5) * 1.1; const d = len * SIZE / n; X += Math.cos(ang) * d; Y += Math.sin(ang) * d; pts.push([X, Y]); }
    for (const [g, col, w] of [[this.A, 'rgba(12,10,8,.75)', 1.6], [this.H, gray(0.05), 2.4], [this.R, gray(0.95), 2.4]]) { g.strokeStyle = col; g.lineWidth = w * SIZE / 1024; g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.stroke(); }
  }
  // peinture écaillée : un éclat irrégulier qui montre le dessous, avec un bord en relief
  peel(x, y, rad, color, under, height) {
    const r = this.rng, n = 12, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, d = rad * (0.45 + r.next() * 0.75) * SIZE; pts.push([x * SIZE + Math.cos(a) * d, y * SIZE + Math.sin(a) * d * 0.8]); }
    const path = (g) => { g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); };
    path(this.A); this.A.fillStyle = under; this.A.fill(); this.A.strokeStyle = 'rgba(20,18,14,.5)'; this.A.lineWidth = 1.5; this.A.stroke();
    path(this.H); this.H.fillStyle = gray(height); this.H.fill();
    path(this.R); this.R.fillStyle = gray(0.95); this.R.fill();
    void color;
  }
  specks(n, color, smax = 2, A = this.A) { const r = this.rng; A.fillStyle = color; for (let i = 0; i < n; i++) { const s = (0.5 + r.next() * smax) * SIZE / 1024; A.fillRect(r.next() * SIZE, r.next() * SIZE, s, s * (0.5 + r.next())); } }
  vgrad(y0, y1, rgb, a0, a1) { const g = this.A, gr = g.createLinearGradient(0, y0 * SIZE, 0, y1 * SIZE); gr.addColorStop(0, `rgba(${rgb},${a0})`); gr.addColorStop(1, `rgba(${rgb},${a1})`); g.fillStyle = gr; g.fillRect(0, y0 * SIZE, SIZE, (y1 - y0) * SIZE); }
}
const gray = (v) => { const n = Math.max(0, Math.min(255, Math.round(v * 255))); return `rgb(${n},${n},${n})`; };

const PAINT = {
  // aile A : plâtre peint jauni au-dessus d'un soubassement vert laqué (v = 0 en bas)
  wallA(L) {
    L.base('#a59a80', 0.55, 0.78);
    L.rect(0, 0.68, 1, 0.32, '#39453d', 0.6, 0.42);
    L.rect(0, 0.66, 1, 0.022, '#27261f', 0.8, 0.5);
    fbm(L.A, [28, 9, 3], 0.32); fbm(L.H, [14, 4, 1.5], 0.16); fbm(L.R, [10, 3], 0.28);
    const r = L.rng;
    for (let i = 0; i < 26; i++) { const y = 0.7 + r.next() * 0.28, x = r.next(), w = 0.02 + r.next() * 0.16; L.rect(x, y, w, 0.002 + r.next() * 0.004, `rgba(170,175,160,${0.1 + r.next() * 0.25})`, 0.45, 0.7); }
    for (let i = 0; i < 7; i++) L.peel(r.next(), r.next() * 0.62, 0.012 + r.next() * 0.045, '', '#7f7b6a', 0.3);
    for (let i = 0; i < 4; i++) L.peel(r.next(), 0.72 + r.next() * 0.25, 0.008 + r.next() * 0.03, '', '#6f6a5b', 0.32);
    L.stains(9, 0.05, 0.16, '60,44,20', 0.34, 0.9);
    L.vgrad(0, 0.3, '35,26,12', 0.5, 0);
    L.drips(26, '40,28,12', 0, 0.55);
    L.vgrad(0.88, 1, '12,15,10', 0, 0.7);
    for (let i = 0; i < 3; i++) L.crack(r.next(), r.next() * 0.6, 0.16 + r.next() * 0.2, 1.2 + r.next());
  },
  // vinyle usé, verni : la lampe y glisse
  floorA(L) {
    L.base('#6c6a60', 0.6, 0.3);
    const n = 4, r = L.rng;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = 88 + r.next() * 24; L.rect(x / n + 0.002, y / n + 0.002, 1 / n - 0.004, 1 / n - 0.004, `rgb(${v},${v * 0.97},${v * 0.86})`, 0.6, 0.24 + r.next() * 0.2); }
    for (let i = 0; i <= n; i++) { L.rect(i / n - 0.0015, 0, 0.003, 1, 'rgba(16,14,10,.8)', 0.25, 0.9); L.rect(0, i / n - 0.0015, 1, 0.003, 'rgba(16,14,10,.8)', 0.25, 0.9); }
    fbm(L.A, [22, 7], 0.28); fbm(L.R, [18, 5, 2], 0.42); fbm(L.H, [6], 0.05);
    L.stains(16, 0.04, 0.17, '26,20,14', 0.6, 0.85);
    for (let i = 0; i < 24; i++) { const g = L.A, x = r.next() * SIZE, y = r.next() * SIZE; g.strokeStyle = `rgba(10,8,8,${0.2 + r.next() * 0.4})`; g.lineWidth = (1 + r.next() * 3) * SIZE / 1024; g.beginPath(); g.arc(x, y, (20 + r.next() * 80) * SIZE / 1024, r.next() * 6, r.next() * 6); g.stroke(); }
    L.specks(500, 'rgba(10,8,6,.5)', 2);
    for (let i = 0; i < 2; i++) L.crack(r.next(), r.next(), 0.18, r.next() * 6);
  },
  // dalles de faux plafond percées de petits trous, grille métallique, auréoles d'humidité
  ceilA(L) {
    L.base('#938f80', 0.6, 0.96);
    const n = 3, r = L.rng;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = 128 + r.next() * 26; L.rect(x / n, y / n, 1 / n, 1 / n, `rgb(${v},${v * 0.97},${v * 0.86})`); }
    fbm(L.A, [12, 4], 0.2); fbm(L.H, [3], 0.1);
    L.specks(2800, 'rgba(25,22,16,.5)', 1.5); L.specks(1400, gray(0.25), 1.5, L.H);
    for (let i = 0; i <= n; i++) { L.rect(i / n - 0.004, 0, 0.008, 1, '#3a3a36', 0.95, 0.5); L.rect(0, i / n - 0.004, 1, 0.008, '#3a3a36', 0.95, 0.5); }
    for (let i = 0; i < 6; i++) { const x = r.next(), y = r.next(), R = 0.04 + r.next() * 0.13; L.stain(x, y, R, '74,50,18', 0.5); L.stain(x, y, R * 0.75, '150,140,115', 0.35); }
    L.rect(1 / n, 1 / n, 1 / n, 1 / n, '#100f0c', 0.15, 1);
  },
  // aile B : carrelage de labo, verni, joints noircis, quelques carreaux tombés
  wallB(L) {
    L.base('#35352c', 0.35, 0.95);
    const n = 20, r = L.rng, s = 1 / n, j = 0.0028;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (r.chance(0.012)) continue;
      const v = 170 + r.next() * 34, cold = r.next() * 6;
      L.rect(x * s + j, y * s + j, s - j * 2, s - j * 2, `rgb(${v - cold},${v + 4},${v - 2})`, 0.75, 0.13 + r.next() * 0.1);
    }
    fbm(L.A, [16, 5], 0.22); fbm(L.R, [14, 4], 0.22);
    L.stains(14, 0.05, 0.2, '60,62,38', 0.42, 0.7, 0.5);
    L.vgrad(0.72, 1, '28,28,18', 0, 0.75);
    L.drips(44, '70,42,16', 0, 0.6);
    for (let i = 0; i < 6; i++) L.crack(r.next(), r.next(), 0.1 + r.next() * 0.2, r.next() * 6);
  },
  // damier de labo effacé, flaques
  floorB(L) {
    L.base('#4f524e', 0.55, 0.36);
    const n = 6, r = L.rng;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = (x + y) % 2 ? 82 + r.next() * 10 : 128 + r.next() * 16; L.rect(x / n + 0.002, y / n + 0.002, 1 / n - 0.004, 1 / n - 0.004, `rgb(${v},${v + 3},${v - 2})`, 0.6, 0.22 + r.next() * 0.2); }
    fbm(L.A, [18, 6, 2], 0.3); fbm(L.R, [12, 4], 0.4);
    L.stains(16, 0.05, 0.2, '22,24,16', 0.65, 0.85);
    L.stains(5, 0.05, 0.16, '10,12,10', 0.55, 0.04, 0.95);
    for (let i = 0; i < 3; i++) L.crack(r.next(), r.next(), 0.22, r.next() * 6);
  },
  ceilB(L) {
    L.base('#74766e', 0.55, 0.9);
    fbm(L.A, [20, 7, 2.5], 0.34); fbm(L.H, [8, 2.5], 0.2);
    const r = L.rng;
    for (let i = 0; i < 12; i++) L.peel(r.next(), r.next(), 0.008 + r.next() * 0.04, '', '#4c4c44', 0.3);
    L.stains(11, 0.05, 0.2, '42,46,28', 0.6, 0.95);
  },
  // sous-sol : béton de banche, trous de coffrage, rouille, bande de danger
  wallS(L) {
    L.base('#6f6e68', 0.55, 0.86);
    const r = L.rng, boards = 12;
    for (let i = 0; i < boards; i++) { const v = 96 + r.next() * 22; L.rect(0, i / boards, 1, 1 / boards, `rgb(${v},${v},${v - 5})`, 0.46 + r.next() * 0.16); L.rect(0, i / boards, 1, 0.0025, 'rgba(14,14,12,.6)', 0.2, 0.95); }
    fbm(L.A, [30, 10, 3], 0.36); fbm(L.H, [16, 5, 1.8], 0.22); fbm(L.R, [8], 0.14);
    for (let y = 1; y < 4; y++) for (let x = 0; x < 4; x++) { const X = (x + 0.5) / 4, Y = y / 4 - 0.01; L.stain(X, Y, 0.012, '14,13,11', 0.95); L.rect(X - 0.003, Y - 0.003, 0.006, 0.006, '#0c0b0a', 0.05, 1); L.A.fillStyle = 'rgba(70,38,14,.3)'; L.A.fillRect((X - 0.002) * SIZE, Y * SIZE, 0.004 * SIZE, (0.04 + r.next() * 0.14) * SIZE); }
    L.rect(0, 0.84, 1, 0.05, '#a9851f', 0.62, 0.55);
    L.A.fillStyle = '#141412';
    for (let x = -60; x < SIZE; x += 112 * SIZE / 1024) { L.A.beginPath(); L.A.moveTo(x, 0.84 * SIZE); L.A.lineTo(x + 52 * SIZE / 1024, 0.84 * SIZE); L.A.lineTo(x + 104 * SIZE / 1024, 0.89 * SIZE); L.A.lineTo(x + 52 * SIZE / 1024, 0.89 * SIZE); L.A.fill(); }
    fbm(L.A, [26, 6], 0.18);
    for (let i = 0; i < 18; i++) L.peel(r.next(), 0.84 + r.next() * 0.05, 0.004 + r.next() * 0.012, '', '#5e5c55', 0.4);
    L.stains(18, 0.04, 0.2, '20,18,14', 0.55, 0.9);
    L.vgrad(0.85, 1, '8,8,6', 0, 0.75);
    L.drips(40, '62,34,12', 0, 0.75);
    for (let i = 0; i < 5; i++) L.crack(r.next(), r.next(), 0.2 + r.next() * 0.25, r.next() * 6);
  },
  floorS(L) {
    L.base('#5c5b56', 0.55, 0.72);
    fbm(L.A, [26, 8, 2.5], 0.38); fbm(L.H, [18, 6], 0.16); fbm(L.R, [12, 4], 0.34);
    L.rect(0, 0.498, 1, 0.004, 'rgba(10,10,8,.85)', 0.1, 0.95); L.rect(0.498, 0, 0.004, 1, 'rgba(10,10,8,.85)', 0.1, 0.95);
    L.stains(16, 0.04, 0.2, '12,11,9', 0.72, 0.28, 0.8);
    L.stains(6, 0.05, 0.17, '8,9,10', 0.55, 0.03, 0.95);
    L.specks(700, 'rgba(160,155,140,.25)', 2);
    const r = L.rng;
    for (let i = 0; i < 6; i++) L.crack(r.next(), r.next(), 0.2 + r.next() * 0.3, r.next() * 6);
  },
  ceilS(L) {
    L.base('#4f4e4a', 0.55, 0.92);
    fbm(L.A, [24, 8, 3], 0.34); fbm(L.H, [12, 4], 0.2);
    for (let i = 0; i < 3; i++) L.rect(0, i / 3, 1, 0.012, 'rgba(0,0,0,.55)', 0.15);
    L.stains(13, 0.04, 0.2, '14,14,11', 0.6);
    L.drips(10, '60,34,14', 0, 0.3);
  },
  // dehors : bitume craquelé et mousse
  ground(L) {
    L.base('#34352f', 0.55, 0.8);
    fbm(L.A, [40, 12, 3], 0.5); fbm(L.H, [34, 10], 0.34); fbm(L.R, [14, 4], 0.3);
    L.specks(3500, 'rgba(165,160,145,.3)', 2.4); L.specks(2800, gray(0.8), 2.2, L.H);
    L.stains(8, 0.03, 0.12, '14,14,12', 0.6, 0.3, 0.55);
    L.stains(9, 0.05, 0.2, '48,60,28', 0.42);
    const r = L.rng;
    for (let i = 0; i < 8; i++) L.crack(r.next(), r.next(), 0.3, r.next() * 6);
  },
  outer(L) {
    L.base('#5a5c56', 0.55, 0.88);
    fbm(L.A, [24, 8, 3], 0.36); fbm(L.H, [14, 4], 0.2);
    for (let i = 0; i < 4; i++) L.rect(0, i / 4, 1, 0.004, 'rgba(0,0,0,.55)', 0.15);
    L.rect(0.499, 0, 0.003, 1, 'rgba(0,0,0,.45)', 0.15);
    L.drips(46, '22,20,14', 0, 0.75);
    L.stains(10, 0.06, 0.2, '32,34,22', 0.5);
  },
};
function normalFrom(hCanvas, strength) {
  const c = mk(NMAP), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(hCanvas, 0, 0, NMAP, NMAP);
  const src = g.getImageData(0, 0, NMAP, NMAP).data, out = g.createImageData(NMAP, NMAP), d = out.data, N = NMAP;
  const at = (x, y) => src[(((y + N) % N) * N + ((x + N) % N)) * 4] / 255;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = 1 / Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    d[i] = (-dx * l * 0.5 + 0.5) * 255; d[i + 1] = (dy * l * 0.5 + 0.5) * 255; d[i + 2] = (l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  return c;
}
const tex = (canvas, srgb, aniso, repeat) => { const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (repeat) t.repeat.set(repeat, repeat); return t; };
// les trois cartes d'un matériau
export function makeSurface(name, { aniso = 8, repeat = 0 } = {}) {
  const L = new Layers(name.length * 97 + name.charCodeAt(0) * 13 + name.charCodeAt(name.length - 1));
  PAINT[name](L);
  const rc = mk(NMAP); rc.getContext('2d').drawImage(L.r, 0, 0, NMAP, NMAP);
  return { map: tex(L.a, true, aniso, repeat), normalMap: tex(normalFrom(L.h, 3.2), false, aniso, repeat), roughnessMap: tex(rc, false, aniso, repeat) };
}
export function softSprite(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = mk(128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
// l'empreinte d'une vraie lampe : point chaud, anneaux du réflecteur, halo faible, traces sur la vitre
export function torchCookie() {
  const S = 256, c = mk(S), g = c.getContext('2d'), r = makeRng(9);
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  [[0, 1], [0.1, 0.96], [0.24, 0.72], [0.31, 0.5], [0.36, 0.56], [0.41, 0.36], [0.56, 0.26], [0.62, 0.3], [0.7, 0.16], [0.9, 0.06], [1, 0]].forEach(([p, v]) => gr.addColorStop(p, gray(v)));
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 18; i++) { const a = r.next() * 6.28, d = r.next() * S * 0.42, x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, R = 6 + r.next() * 26, sp = g.createRadialGradient(x, y, 0, x, y, R); sp.addColorStop(0, 'rgba(0,0,0,.2)'); sp.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = 'rgba(255,255,255,1)'; g.fillStyle = sp; g.globalCompositeOperation = 'source-over'; g.fillRect(x - R, y - R, R * 2, R * 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
// plaque de porte : acier peint griffé, nom, bande de couleur selon la clé
export function doorTexture(name, key) {
  const S = 512, c = mk(S), g = c.getContext('2d'), r = makeRng(name.length * 31 + 7), prev = SIZE;
  SIZE = S;
  g.fillStyle = '#4c5258'; g.fillRect(0, 0, S, S);
  fbm(g, [18, 6], 0.3);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(190,190,180,${r.next() * 0.16})`; g.fillRect(r.next() * S, r.next() * S, 1 + r.next() * 2, 6 + r.next() * 60); }
  for (let i = 0; i < 9; i++) { const x = r.next() * S, y = r.next() * S, R = 10 + r.next() * 60, gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(66,34,14,${0.3 + r.next() * 0.4})`); gr.addColorStop(1, 'rgba(66,34,14,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2); }
  const down = g.createLinearGradient(0, S * 0.7, 0, S); down.addColorStop(0, 'rgba(10,9,7,0)'); down.addColorStop(1, 'rgba(10,9,7,.7)'); g.fillStyle = down; g.fillRect(0, S * 0.7, S, S * 0.3);
  for (const y of [90, 420]) { g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(0, y, S, 5); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, y + 5, S, 2); }
  const col = key === 'bleu' ? '#25609f' : key === 'orange' ? '#b8691a' : '#a8a292';
  g.fillStyle = col; g.fillRect(0, 196, S, 54);
  fbm(g, [14], 0.14);
  g.fillStyle = key ? '#e9e6dc' : '#17181a'; g.font = '700 38px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name.toUpperCase(), S / 2, 224, S - 22);
  SIZE = prev;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// bruit doux qui salit les modèles (tuile répétée sur les coordonnées du monde)
export function grimeTexture() {
  const prev = SIZE; SIZE = 256;
  const c = mk(256), g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  fbm(g, [12, 5, 2], 0.8);
  SIZE = prev;
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// planche d'autocollants pour le sol et les murs : papiers, sang, huile, traces de bottes, gravats, câble, affiches, main. Quatre colonnes, trois lignes.
export const DECAL = { paper: 0, sheet: 1, splat: 2, drag: 3, oil: 4, boots: 5, debris: 6, cable: 7, notice: 8, warn: 9, hand: 10, soot: 11 };
export function decalAtlas() {
  const C = 256, c = mk(C * 4), g = c.getContext('2d'), r = makeRng(61);
  c.height = C * 3;
  const cell = (i, fn) => { g.save(); g.translate((i % 4) * C, Math.floor(i / 4) * C); g.beginPath(); g.rect(0, 0, C, C); g.clip(); fn(g); g.restore(); };
  const blot = (x, y, R, col) => { g.fillStyle = col; g.beginPath(); for (let i = 0; i <= 16; i++) { const a = i / 16 * 6.283, d = R * (0.72 + r.next() * 0.45); g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * d, y + Math.sin(a) * d); } g.closePath(); g.fill(); };
  const paper = (ang, lines, tint) => { g.translate(C / 2, C / 2); g.rotate(ang); g.fillStyle = tint; g.fillRect(-52, -72, 104, 144); g.fillStyle = 'rgba(40,32,16,.16)'; g.fillRect(-52, -72, 104, 144 * r.next()); g.fillStyle = 'rgba(30,30,34,.62)'; for (let i = 0; i < lines; i++) g.fillRect(-42, -60 + i * 9, 40 + r.next() * 44, 2.4); };
  cell(DECAL.paper, () => paper(0.3, 13, '#c8c4b0'));
  cell(DECAL.sheet, () => { paper(-0.5, 8, '#b7b199'); g.fillStyle = 'rgba(40,20,6,.3)'; g.beginPath(); g.arc(20, 30, 26, 0, 7); g.fill(); });
  cell(DECAL.splat, () => { const col = '#3f0704'; blot(C / 2, C / 2, 52, col); for (let i = 0; i < 26; i++) { const a = r.next() * 6.28, d = 50 + r.next() * 68; blot(C / 2 + Math.cos(a) * d, C / 2 + Math.sin(a) * d, 1.5 + r.next() * 8, col); } });
  cell(DECAL.drag, () => { const gr = g.createLinearGradient(0, 16, 0, C - 16); gr.addColorStop(0, 'rgba(58,7,4,.9)'); gr.addColorStop(0.6, 'rgba(58,7,4,.55)'); gr.addColorStop(1, 'rgba(58,7,4,0)'); g.fillStyle = gr; for (let i = 0; i < 12; i++) { const x = 92 + r.next() * 66; g.fillRect(x, 14 + r.next() * 18, 2 + r.next() * 12, 150 + r.next() * 80); } blot(C / 2, 34, 34, '#3f0704'); });
  cell(DECAL.oil, () => { const gr = g.createRadialGradient(C / 2, C / 2, 10, C / 2, C / 2, 118); gr.addColorStop(0, 'rgba(6,6,6,.92)'); gr.addColorStop(0.7, 'rgba(8,8,8,.7)'); gr.addColorStop(1, 'rgba(8,8,8,0)'); g.fillStyle = gr; g.fillRect(0, 0, C, C); });
  cell(DECAL.boots, () => { g.fillStyle = 'rgba(16,12,8,.72)'; for (let i = 0; i < 5; i++) { const y = 216 - i * 46, x = i % 2 ? 158 : 98; g.fillRect(x - 11, y - 18, 22, 25); g.fillRect(x - 9, y + 10, 18, 13); } });
  cell(DECAL.debris, () => { for (let i = 0; i < 120; i++) { const d = r.next() * r.next() * 110, a = r.next() * 6.28, v = 40 + r.next() * 90, s = 1.5 + r.next() * r.next() * 13; g.fillStyle = `rgb(${v},${v},${v * 0.92})`; g.fillRect(C / 2 + Math.cos(a) * d, C / 2 + Math.sin(a) * d, s, s * (0.5 + r.next() * 0.7)); } });
  cell(DECAL.cable, () => { for (const [col, w] of [['#0a0a0a', 8], ['#25262a', 5]]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(0, 150); g.bezierCurveTo(70, 40, 120, 240, 170, 130); g.bezierCurveTo(200, 70, 225, 120, C, 96); g.stroke(); } });
  cell(DECAL.notice, () => { g.fillStyle = '#b5ad93'; g.fillRect(44, 22, 168, 212); g.fillStyle = '#7c1812'; g.fillRect(44, 22, 168, 34); g.fillStyle = '#e8e2d0'; g.font = '700 21px sans-serif'; g.textAlign = 'center'; g.fillText('CONSIGNES', 128, 47); g.fillStyle = 'rgba(30,30,34,.7)'; for (let i = 0; i < 13; i++) g.fillRect(58, 72 + i * 12, 76 + r.next() * 62, 3); g.fillStyle = 'rgba(40,28,10,.28)'; g.fillRect(44, 150, 168, 84); });
  cell(DECAL.warn, () => { g.fillStyle = '#b28c1e'; g.beginPath(); g.moveTo(128, 30); g.lineTo(232, 206); g.lineTo(24, 206); g.closePath(); g.fill(); g.strokeStyle = '#141412'; g.lineWidth = 10; g.stroke(); g.fillStyle = '#141412'; g.fillRect(120, 94, 16, 62); g.fillRect(120, 168, 16, 16); g.font = '700 22px sans-serif'; g.textAlign = 'center'; g.fillText('ZONE RESTREINTE', 128, 240, 230); });
  cell(DECAL.hand, () => { g.fillStyle = 'rgba(64,8,5,.92)'; g.translate(C / 2, C / 2 + 26); g.rotate(0.2); g.beginPath(); g.ellipse(0, 12, 38, 44, 0, 0, 7); g.fill(); for (const [x, l, a] of [[-30, 58, -0.34], [-12, 74, -0.1], [8, 78, 0.04], [26, 66, 0.2], [42, 36, 0.8]]) { g.save(); g.translate(x, -14); g.rotate(a); g.fillRect(-6.5, -l, 13, l); g.restore(); } g.setTransform(1, 0, 0, 1, 0, 0); const col = (DECAL.hand % 4) * C, row = Math.floor(DECAL.hand / 4) * C; for (let i = 0; i < 9; i++) { const x = col + 100 + r.next() * 60; const gr = g.createLinearGradient(0, row + 170, 0, row + 256); gr.addColorStop(0, 'rgba(64,8,5,.7)'); gr.addColorStop(1, 'rgba(64,8,5,0)'); g.fillStyle = gr; g.fillRect(x, row + 170, 2.5, 86); } });
  cell(DECAL.soot, () => { const gr = g.createRadialGradient(C / 2, C / 2 + 34, 6, C / 2, C / 2 + 34, 112); gr.addColorStop(0, 'rgba(8,8,6,.85)'); gr.addColorStop(1, 'rgba(8,8,6,0)'); g.fillStyle = gr; g.fillRect(0, 0, C, C); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// panneau lumineux de sortie
export function exitSign() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#0f8a3d'; g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#eafff0'; g.font = '700 50px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SORTIE', 128, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
