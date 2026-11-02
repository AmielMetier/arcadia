/* Golf Party — textures dessinées dans des canevas (aucune image à télécharger) */
import * as THREE from 'three';

export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const cache = new Map();
function canvasTex(key, w, h, draw, o = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h, rng(hash(key)));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.colorSpace = o.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  cache.set(key, t); return t;
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
function noise(g, w, h, r, n, col, size = 1.5) { for (let i = 0; i < n; i++) { g.fillStyle = col(r); g.fillRect(r() * w, r() * h, size * (0.5 + r()), size * (0.5 + r())); } }
function blotches(g, w, h, r, n, col, rad) { for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, rr = rad * (0.4 + r()); const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, col(r)); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g.save(); g.translate(dx, dy); g.fillRect(x - rr, y - rr, rr * 2, rr * 2); g.restore(); } } }

/* -------- sols (1 motif = 2 m × 2 m) -------- */
export const T = {
  felt: () => canvasTex('felt', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#2f9a4c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.035)'; g.fillRect(i * w / 8, 0, w / 8, h); }
    noise(g, w, h, r, 26000, (r) => hsl(140 + r() * 10, 45, 30 + r() * 18, 0.5), 1.3);
  }),
  moss: () => canvasTex('moss', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#4c8a35'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, r, 70, (r) => hsl(85 + r() * 30, 45, 22 + r() * 22, 0.45), 60);
    noise(g, w, h, r, 22000, (r) => hsl(90 + r() * 25, 50, 25 + r() * 25, 0.55), 1.4);
  }),
  grass: () => canvasTex('grass', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#5daa3c'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, 0, w / 2, h);
    blotches(g, w, h, r, 40, (r) => hsl(95 + r() * 20, 45, 30 + r() * 15, 0.35), 70);
    noise(g, w, h, r, 30000, (r) => hsl(95 + r() * 20, 55, 28 + r() * 25, 0.6), 1.6);
  }),
  plank: (tint = 'oak') => canvasTex('plank' + tint, 512, 512, (g, w, h, r) => {
    const base = tint === 'red' ? [355, 62, 38] : tint === 'dark' ? [25, 35, 22] : [30, 45, 45];
    const n = 8;
    for (let i = 0; i < n; i++) {
      const l = base[2] + (r() - 0.5) * 10;
      g.fillStyle = hsl(base[0] + (r() - 0.5) * 6, base[1], l); g.fillRect(i * w / n, 0, w / n, h);
      for (let k = 0; k < 40; k++) { g.strokeStyle = hsl(base[0], base[1], l - 6 - r() * 6, 0.35); g.lineWidth = 1; g.beginPath(); const x = i * w / n + r() * w / n; g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 8, h / 3, x + (r() - 0.5) * 8, h * 2 / 3, x, h); g.stroke(); }
      const cut = r() * h; g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(i * w / n, cut, w / n, 2);
      g.fillStyle = 'rgba(30,20,10,.8)'; for (const y of [cut + 10, cut - 10]) { g.fillRect(i * w / n + 7, (y + h) % h, 3, 3); g.fillRect((i + 1) * w / n - 10, (y + h) % h, 3, 3); }
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(i * w / n, 0, 2, h);
    }
  }),
  stone: () => canvasTex('stone', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#8a8478'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      const px = x * w / 6 + (y % 2) * w / 12, py = y * h / 6;
      g.fillStyle = hsl(35 + r() * 15, 8 + r() * 8, 52 + r() * 14); roundRect(g, px + 3, py + 3, w / 6 - 6, h / 6 - 6, 10); g.fill();
      if (px + w / 6 > w) { roundRect(g, px - w + 3, py + 3, w / 6 - 6, h / 6 - 6, 10); g.fill(); }
    }
    noise(g, w, h, r, 16000, (r) => `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},.05)`, 2);
    blotches(g, w, h, r, 30, () => 'rgba(70,110,50,.18)', 40);
  }),
  metal: () => canvasTex('metal', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#5b5f68'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { g.strokeStyle = `rgba(255,255,255,${r() * 0.05})`; const y = r() * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (r() - 0.5) * 4); g.stroke(); }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const cx = x * w / 16 + 16, cy = y * h / 16 + 16; g.save(); g.translate(cx, cy); g.rotate(((x + y) % 2 ? 1 : -1) * 0.7);
      g.fillStyle = 'rgba(255,255,255,.22)'; roundRect(g, -9, -3, 18, 6, 3); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; roundRect(g, -9, 1, 18, 3, 2); g.fill(); g.restore();
    }
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4; g.strokeRect(0, 0, w, h);
  }),
  // grille de la station : 8 cases par motif (au lieu de 16) et des bords doux, pour qu'elle ne scintille plus au loin
  grate: () => canvasTex('grate', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#23252b'; g.fillRect(0, 0, w, h);
    const n = 8, c = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const gr = g.createRadialGradient(x * c + c / 2, y * c + c / 2, 2, x * c + c / 2, y * c + c / 2, c * 0.6);
      gr.addColorStop(0, '#8a3a18'); gr.addColorStop(1, '#22100c'); g.fillStyle = gr; roundRect(g, x * c + 9, y * c + 9, c - 18, c - 18, 8); g.fill();
    }
    noise(g, w, h, r, 9000, (r) => `rgba(255,255,255,${r() * 0.05})`, 1.2);
    g.strokeStyle = '#4d525c'; g.lineWidth = 10; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * c, 0); g.lineTo(i * c, h); g.stroke(); g.beginPath(); g.moveTo(0, i * c); g.lineTo(w, i * c); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * c - 4, 0); g.lineTo(i * c - 4, h); g.stroke(); }
  }),
  grateEm: () => canvasTex('grateEm', 256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const n = 8, c = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const gr = g.createRadialGradient(x * c + c / 2, y * c + c / 2, 1, x * c + c / 2, y * c + c / 2, c * 0.45); gr.addColorStop(0, '#ff7a28'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(x * c, y * c, c, c); }
  }),
  sand: () => canvasTex('sand', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#e6cf98'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, r, 40, (r) => hsl(40, 50, 60 + r() * 20, 0.3), 60);
    noise(g, w, h, r, 40000, (r) => hsl(38 + r() * 10, 40, 45 + r() * 45, 0.7), 1.2);
  }),
  beach: () => canvasTex('beach', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#f0dcab'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, r, 50, (r) => hsl(36, 45, 70 + r() * 15, 0.3), 70);
    noise(g, w, h, r, 26000, (r) => hsl(38 + r() * 10, 35, 55 + r() * 40, 0.5), 1.2);
    for (let i = 0; i < 14; i++) { g.fillStyle = hsl(r() * 40, 50, 80, 0.8); g.beginPath(); g.ellipse(r() * w, r() * h, 3, 2, r() * 3, 0, 7); g.fill(); }
  }),
  zen: () => canvasTex('zen', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#d9d4c7'; g.fillRect(0, 0, w, h);
    noise(g, w, h, r, 30000, (r) => hsl(40, 10, 60 + r() * 35, 0.6), 1.2);
    for (let i = 0; i < 12; i++) { const x = (i + 0.5) * w / 12; const gr = g.createLinearGradient(x - 18, 0, x + 18, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.45, 'rgba(90,80,60,.32)'); gr.addColorStop(0.55, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - 18, 0, 36, h); }
  }),
  ice: () => canvasTex('ice', 256, 256, (g, w, h, r) => { g.fillStyle = '#bfe8ff'; g.fillRect(0, 0, w, h); for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(r() * w, r() * h); g.lineTo(r() * w, r() * h); g.stroke(); } }),
  boost: () => canvasTex('boost', 256, 256, (g, w, h) => {
    g.fillStyle = '#2a1a10'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 2; k++) { const y0 = k * h / 2; g.fillStyle = '#ffb21c'; g.beginPath(); g.moveTo(w * 0.12, y0 + h * 0.08); g.lineTo(w / 2, y0 + h * 0.36); g.lineTo(w * 0.88, y0 + h * 0.08); g.lineTo(w * 0.88, y0 + h * 0.2); g.lineTo(w / 2, y0 + h * 0.48); g.lineTo(w * 0.12, y0 + h * 0.2); g.closePath(); g.fill(); }
  }),
  conveyor: () => canvasTex('conveyor', 256, 256, (g, w, h) => {
    g.fillStyle = '#26272b'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { g.fillStyle = '#3a3c42'; g.fillRect(0, i * h / 8, w, h / 16); g.fillStyle = 'rgba(255,200,40,.85)'; g.fillRect(4, i * h / 8 + 2, 10, h / 16 - 4); g.fillRect(w - 14, i * h / 8 + 2, 10, h / 16 - 4); }
  }),
  tramp: () => canvasTex('tramp', 256, 256, (g, w, h) => { g.fillStyle = '#e53935'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 18; g.strokeRect(0, 0, w, h); }),
  /* -------- murets (1 motif = 2 m × 1 m) -------- */
  brick: (dark) => canvasTex('brick' + (dark ? 'd' : ''), 512, 256, (g, w, h, r) => {
    g.fillStyle = dark ? '#5a3a30' : '#d9cfc2'; g.fillRect(0, 0, w, h);
    const rows = 12, bw = w / 8;
    for (let y = 0; y < rows; y++) for (let x = -1; x < 9; x++) {
      const px = x * bw + (y % 2) * bw / 2, py = y * h / rows;
      g.fillStyle = dark ? hsl(10 + r() * 8, 40, 22 + r() * 8) : hsl(8 + r() * 10, 55 + r() * 10, 38 + r() * 10);
      g.fillRect(px + 2, py + 2, bw - 4, h / rows - 4);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(px + 2, py + 2, bw - 4, 3);
    }
    noise(g, w, h, r, 6000, () => 'rgba(0,0,0,.12)', 1.5);
  }),
  stonecap: () => canvasTex('stonecap', 256, 128, (g, w, h, r) => { g.fillStyle = '#e8e2d6'; g.fillRect(0, 0, w, h); noise(g, w, h, r, 5000, (r) => hsl(40, 10, 70 + r() * 25, 0.6), 1.5); for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(i * w / 4, 0, 2, h); } }),
  whitew: () => canvasTex('whitew', 512, 256, (g, w, h, r) => {
    g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, i * h / 6, w, 2); }
    for (let i = 0; i < 200; i++) { g.strokeStyle = 'rgba(120,110,90,.08)'; const y = r() * h; g.beginPath(); g.moveTo(r() * w, y); g.lineTo(r() * w, y); g.stroke(); }
  }),
  wood: (dark) => canvasTex('wood' + (dark ? 'd' : ''), 512, 256, (g, w, h, r) => {
    const L = dark ? 20 : 34;
    g.fillStyle = hsl(28, 45, L); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { g.fillStyle = hsl(28 + r() * 6, 45, L + (r() - 0.5) * 8); g.fillRect(0, i * h / 4, w, h / 4 - 2); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, (i + 1) * h / 4 - 3, w, 3); }
    for (let k = 0; k < 140; k++) { g.strokeStyle = hsl(28, 40, L - 10, 0.35); const y = r() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w / 3, y + (r() - 0.5) * 10, w * 2 / 3, y + (r() - 0.5) * 10, w, y); g.stroke(); }
  }),
  stonew: () => canvasTex('stonew', 512, 256, (g, w, h, r) => {
    g.fillStyle = '#4a4a4c'; g.fillRect(0, 0, w, h);
    const rows = 5;
    for (let y = 0; y < rows; y++) { let x = -r() * 60; while (x < w) { const bw = 50 + r() * 70; g.fillStyle = hsl(30 + r() * 20, 6, 46 + r() * 16); roundRect(g, x + 3, y * h / rows + 3, bw - 6, h / rows - 6, 8); g.fill(); x += bw; } }
    noise(g, w, h, r, 9000, (r) => `rgba(0,0,0,${r() * 0.15})`, 2);
    blotches(g, w, h, r, 14, () => 'rgba(80,120,60,.25)', 30);
  }),
  rock: () => canvasTex('rock', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#5d5550'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, r, 90, (r) => hsl(20 + r() * 20, 10, 25 + r() * 30, 0.45), 50);
    for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1 + r() * 2; g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 50; y += (r() - 0.3) * 40; g.lineTo(x, y); } g.stroke(); }
  }),
  metalw: () => canvasTex('metalw', 512, 256, (g, w, h, r) => {
    g.fillStyle = '#3c4048'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { g.strokeStyle = `rgba(255,255,255,${r() * 0.05})`; const y = r() * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(i * w / 4, 0, 3, h); for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(i * w / 4 + 12, k * h / 4 + 16, 4, 0, 7); g.fill(); } }
  }),
  hazard: () => canvasTex('hazard', 256, 256, (g, w, h) => {
    g.fillStyle = '#ffc21a'; g.fillRect(0, 0, w, h); g.fillStyle = '#16161a';
    for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64 + 32, 0); g.lineTo(i * 64 + 32 + h, h); g.lineTo(i * 64 + h, h); g.fill(); }
  }),
  bamboo: () => canvasTex('bamboo', 256, 256, (g, w, h, r) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9ccf52'); gr.addColorStop(0.5, '#6ea83a'); gr.addColorStop(1, '#4f8a2a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(40,60,10,.7)'; g.fillRect(i * w / 4, 0, 4, h); g.fillStyle = 'rgba(255,255,220,.35)'; g.fillRect(i * w / 4 + 4, 0, 3, h); }
    noise(g, w, h, r, 2000, () => 'rgba(30,50,10,.15)', 2);
  }),
  bumper: () => canvasTex('bumper', 256, 128, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fafafa' : '#e8322c'; g.fillRect(i * w / 8, 0, w / 8, h); } }),
  redw: () => canvasTex('redw', 512, 256, (g, w, h, r) => { g.fillStyle = '#c4282a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { g.strokeStyle = 'rgba(80,0,0,.12)'; const y = r() * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (r() - 0.5) * 6); g.stroke(); } g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h - 10, w, 10); }),
  neonEm: () => canvasTex('neonEm', 256, 64, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#000'); gr.addColorStop(0.35, '#fff'); gr.addColorStop(0.65, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }),
  panel: () => canvasTex('panel', 512, 256, (g, w, h, r) => {
    g.fillStyle = '#25262c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 4; g.strokeRect(i * w / 4 + 2, 2, w / 4 - 4, h - 4); g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(i * w / 4 + 6, 6, w / 4 - 12, 20); }
    noise(g, w, h, r, 3000, () => 'rgba(120,60,30,.12)', 3);
  }),
  /* -------- environnement -------- */
  lava: () => canvasTex('lava', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#ff4a0a'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, r, 80, (r) => r() > 0.5 ? 'rgba(255,220,60,.55)' : 'rgba(180,20,0,.6)', 60);
    for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(30,8,4,.92)'; g.beginPath(); const x = r() * w, y = r() * h, rr = 14 + r() * 40; for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283, q = rr * (0.6 + r() * 0.5); g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.fill(); }
  }),
  waterN: () => canvasTex('waterN', 512, 512, (g, w, h, r) => {
    // carte de normales approchée : vagues superposées
    const img = g.createImageData(w, h), d = img.data;
    const waves = []; for (let i = 0; i < 18; i++) waves.push([Math.floor(1 + r() * 6) * (r() > 0.5 ? 1 : -1), Math.floor(1 + r() * 6) * (r() > 0.5 ? 1 : -1), r() * 6.28, 0.3 + r()]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let dx = 0, dy = 0;
      for (const [kx, ky, ph, a] of waves) { const c = Math.cos((kx * x / w + ky * y / h) * 6.283 + ph) * a; dx += c * kx; dy += c * ky; }
      const i = (y * w + x) * 4; d[i] = 128 + dx * 4; d[i + 1] = 128 + dy * 4; d[i + 2] = 255; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { data: true }),
  dimple: () => canvasTex('dimple', 256, 128, (g, w, h) => {
    g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
      const cx = x * w / 16 + (y % 2) * w / 32 + 8, cy = y * h / 8 + 8;
      const gr = g.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, 7); gr.addColorStop(0, 'rgb(100,100,255)'); gr.addColorStop(0.7, 'rgb(150,150,255)'); gr.addColorStop(1, 'rgb(128,128,255)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 7, 0, 7); g.fill();
    }
  }, { data: true }),
  cup: () => canvasTex('cup', 256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, '#000'); gr.addColorStop(0.72, '#0a0a0a'); gr.addColorStop(0.8, '#2b2b2b'); gr.addColorStop(0.86, '#f2f2f2'); gr.addColorStop(0.96, '#d8d8d8'); gr.addColorStop(1, 'rgba(0,0,0,0.0)');
    g.fillStyle = gr; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill();
  }),
  spark: () => canvasTex('spark', 64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }),
  petal: () => canvasTex('petal', 64, 64, (g) => { g.fillStyle = '#ffd1e3'; g.beginPath(); g.ellipse(32, 32, 26, 14, 0.6, 0, 7); g.fill(); g.fillStyle = '#ff9dc4'; g.beginPath(); g.ellipse(34, 30, 10, 6, 0.6, 0, 7); g.fill(); }),
  flag: (color) => canvasTex('flag' + color, 128, 96, (g, w, h) => { g.fillStyle = color; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.9)'; g.font = 'bold 60px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⛳', w / 2, h / 2 + 4); }),
  waterfall: () => canvasTex('waterfall', 128, 512, (g, w, h, r) => { g.fillStyle = 'rgba(200,235,255,.55)'; g.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 20 + r() * 80); } }),
};

/* -------- nouveaux parcours -------- */
Object.assign(T, {
  sandstone: () => canvasTex('sandstone', 512, 512, (g, w, h, r) => {
    for (let y = 0; y < h; y += 4) { const k = Math.sin(y * 0.05) * 6 + Math.sin(y * 0.013) * 8; g.fillStyle = hsl(22 + k * 0.4, 55, 52 + k); g.fillRect(0, y, w, 4); }
    noise(g, w, h, r, 20000, (r) => hsl(25, 40, 40 + r() * 35, 0.35), 1.6);
    blotches(g, w, h, r, 30, () => 'rgba(120,50,20,.15)', 60);
  }),
  mud: () => canvasTex('mud', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#4a3020'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, r, 70, (r) => r() > 0.5 ? 'rgba(30,18,10,.55)' : 'rgba(110,80,50,.35)', 60);
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,240,220,.18)'; g.beginPath(); g.ellipse(r() * w, r() * h, 4 + r() * 10, 2 + r() * 5, r() * 3, 0, 7); g.fill(); }
  }),
  snow: () => canvasTex('snow', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#f2f6fb'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, r, 40, () => 'rgba(170,195,230,.25)', 70);
    noise(g, w, h, r, 9000, () => 'rgba(255,255,255,.9)', 1.2); noise(g, w, h, r, 5000, () => 'rgba(150,180,220,.25)', 1.5);
  }),
  candy: () => canvasTex('candy', 512, 512, (g, w, h) => {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#f0509a' : '#ffd6ea'; g.fillRect(x * 64, y * 64, 64, 64); }
    g.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 8; i++) g.fillRect(0, i * 64 + 4, w, 6);
  }),
  candyw: () => canvasTex('candyw', 512, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8263c';
    for (let i = -6; i < 14; i++) { g.beginPath(); g.moveTo(i * 48, 0); g.lineTo(i * 48 + 24, 0); g.lineTo(i * 48 + 24 + h, h); g.lineTo(i * 48 + h, h); g.fill(); }
  }),
  magnet: () => canvasTex('magnet', 256, 256, (g, w, h) => {
    g.fillStyle = '#1a1530'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b36bff'; g.lineWidth = 6; for (let i = 0; i < 4; i++) { g.strokeRect(i * 64 + 8, 8, 48, h - 16); }
    g.fillStyle = '#e0c2ff'; for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) g.fillRect(i * 64 + 28, k * 64 + 26, 8, 12);
  }),
  icew: () => canvasTex('icew', 512, 256, (g, w, h, r) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e6f6ff'); gr.addColorStop(1, '#9fd3f2'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(r() * w, r() * h); g.lineTo(r() * w, r() * h); g.stroke(); }
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(60,120,170,.25)'; g.fillRect(i * w / 4, 0, 3, h); }
  }),
  desert: () => canvasTex('desert', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#e2b77c'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, r, 60, (r) => hsl(30 + r() * 10, 50, 55 + r() * 20, 0.35), 70);
    for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(160,110,60,.25)'; g.lineWidth = 3; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w / 3, y + 20, w * 2 / 3, y - 20, w, y); g.stroke(); }
    noise(g, w, h, r, 20000, (r) => hsl(32, 40, 45 + r() * 40, 0.5), 1.3);
  }),
  candyground: () => canvasTex('candyground', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#6fd8b8'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, r, 40, () => 'rgba(40,140,110,.25)', 70);
    const cols = ['#ff5a8a', '#ffd23f', '#5ab8ff', '#b06bff', '#ffffff'];
    for (let i = 0; i < 120; i++) { g.save(); g.translate(r() * w, r() * h); g.rotate(r() * 3); g.fillStyle = cols[(r() * cols.length) | 0]; g.fillRect(-5, -1.5, 10, 3); g.restore(); }
  }),
  swampwater: () => canvasTex('swampwater', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#2c3a22'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, r, 80, (r) => r() > 0.5 ? 'rgba(80,110,40,.45)' : 'rgba(20,30,15,.5)', 50);
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(90,140,50,.7)'; g.beginPath(); g.arc(r() * w, r() * h, 3 + r() * 9, 0, 7); g.fill(); }
  }),
});

function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/** Étiquette de numéro de trou pour les panneaux */
export function signTex(n, name, par, colors) {
  return canvasTex('sign' + n + name, 512, 320, (g, w, h) => {
    g.fillStyle = colors.bg; roundRect(g, 8, 8, w - 16, h - 16, 26); g.fill();
    g.lineWidth = 10; g.strokeStyle = colors.ink; g.stroke();
    g.fillStyle = colors.ink; g.textAlign = 'center';
    g.font = '900 150px "Bowlby One", Impact, sans-serif'; g.fillText(String(n), w / 2, 175);
    g.font = '700 44px "Kalam", sans-serif'; g.fillText(name, w / 2, 240);
    g.font = '700 36px "Kalam", sans-serif'; g.fillText('par ' + par, w / 2, 288);
  });
}

/* -------- textures photo (Poly Haven, CC0) --------
   Les mêmes fichiers que Cyber Kart GP (kart/tex, voir kart/tex/LISEZMOI.md). On commence avec la texture dessinée,
   et on la remplace dès que la photo est chargée : si un fichier manque, rien ne change à l'écran. */
const PHOTO_DIR = new URL('../../kart/tex/', import.meta.url).href;
const photoCache = new Map();
function loadPhoto(file, data) {
  if (photoCache.has(file)) return photoCache.get(file);
  const p = new Promise((res) => {
    new THREE.TextureLoader().load(PHOTO_DIR + file, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
      t.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      res(t);
    }, undefined, () => res(null));
  });
  photoCache.set(file, p); return p;
}
/**
 * Habille un matériau avec une photo : name = fichier de kart/tex sans extension.
 * o.repeat : nombre de motifs par unité de texture ; o.normal : relief (0 = sans) ; o.clone : copie à part (répétition propre)
 */
export function dressPhoto(mat, name, o = {}) {
  const rep = o.repeat ?? 1, wantN = o.normal ?? 0.7;
  loadPhoto(name + '.jpg').then((t) => {
    if (!t) return;
    const tex = rep !== 1 || o.clone ? t.clone() : t; if (tex !== t) { tex.repeat.set(rep, rep); tex.needsUpdate = true; }
    mat.map = tex; if (o.color) mat.color.set(o.color); mat.needsUpdate = true;
  });
  if (wantN > 0) loadPhoto(name + '_n.jpg', true).then((t) => {
    if (!t) return;
    const tex = rep !== 1 || o.clone ? t.clone() : t; if (tex !== t) { tex.repeat.set(rep, rep); tex.needsUpdate = true; }
    mat.normalMap = tex; mat.normalScale = new THREE.Vector2(wantN, wantN); mat.needsUpdate = true;
  });
  return mat;
}
