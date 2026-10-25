// Birdie Party — textures peintes en canevas au chargement (aucun fichier) : herbe dense, grappes de feuilles,
// branches de sapin, écorce, sable. Toutes répétables sans couture et filtrées (mipmaps + anisotropie).
import * as THREE from '../../shared/vendor/three/three.module.min.js';

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function finish(c, { srgb = true, repeat = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
// dessine en répétant sur les bords pour que la texture se raccorde
function wrapDraw(g, W, x, y, r, fn) {
  for (const dx of [-W, 0, W]) for (const dy of [-W, 0, W]) {
    if (x + dx < -r || x + dx > W + r || y + dy < -r || y + dy > W + r) continue;
    fn(x + dx, y + dy);
  }
}

// Herbe : milliers de brins courts, clairs et sombres, légèrement orientés. Luminance seule (la couleur vient du sol).
export function grassTexture(size = 512) {
  const c = canvas(size), g = c.getContext('2d'), r = rng(11);
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, size, size);
  // taches douces
  for (let i = 0; i < 160; i++) {
    const x = r() * size, y = r() * size, rad = 10 + r() * 40, v = 100 + r() * 60;
    wrapDraw(g, size, x, y, rad, (px, py) => {
      const gr = g.createRadialGradient(px, py, 0, px, py, rad);
      gr.addColorStop(0, `rgba(${v},${v},${v},0.35)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
  }
  // brins
  g.lineCap = 'round';
  for (let i = 0; i < size * size / 9; i++) {
    const x = r() * size, y = r() * size, len = 3 + r() * 7, a = -Math.PI / 2 + (r() - 0.5) * 1.3;
    const v = r() < 0.5 ? 35 + r() * 60 : 170 + r() * 85;
    g.strokeStyle = `rgba(${v},${v},${v},${0.55 + r() * 0.45})`; g.lineWidth = 0.8 + r() * 1.4;
    wrapDraw(g, size, x, y, len, (px, py) => { g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); g.stroke(); });
  }
  return finish(c, { srgb: false, aniso: 16 });
}

// Sable : grain fin et quelques traces de râteau
export function sandTexture(size = 256) {
  const c = canvas(size), g = c.getContext('2d'), r = rng(23);
  g.fillStyle = 'rgb(140,140,140)'; g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = 120 + r() * 40 + (r() < 0.04 ? 50 : 0); d[i] = d[i + 1] = d[i + 2] = v; }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(100,100,100,0.25)'; g.lineWidth = 2;
  for (let y = 4; y < size; y += 9) { g.beginPath(); for (let x = 0; x <= size; x += 8) g.lineTo(x, y + Math.sin(x * 0.05) * 3); g.stroke(); }
  return finish(c, { srgb: false });
}

// Grappe de feuilles (transparence) : feuilles ovales de plusieurs verts, plus denses au centre
export function leafTexture(size = 256, seed = 5) {
  const c = canvas(size), g = c.getContext('2d'), r = rng(seed);
  const cx = size / 2, R = size * 0.47;
  for (let i = 0; i < 520; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * (0.75 + r() * 0.25);
    const x = cx + Math.cos(a) * d, y = cx + Math.sin(a) * d * 0.92;
    const l = 7 + r() * 9, w = l * (0.42 + r() * 0.15), rot = r() * Math.PI;
    // plus sombre au fond de la grappe, plus clair au bord
    // vert profond au cœur, quelques feuilles claires en bordure
    const k = d / R, v = 0.25 + 0.75 * k * r() * r();
    const gC = Math.round(95 + 110 * v), rC = Math.round(30 + 60 * v), bC = Math.round(18 + 35 * v);
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = `rgb(${rC},${gC},${bC})`;
    g.beginPath(); g.ellipse(0, 0, l, w, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(30,70,20,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-l, 0); g.lineTo(l, 0); g.stroke();
    g.restore();
  }
  return finish(c, { repeat: false, aniso: 4 });
}

// Branche de sapin vue de dessus : une tige et des aiguilles, plus courte vers la pointe
export function needleTexture(size = 256, seed = 9) {
  const c = canvas(size), g = c.getContext('2d'), r = rng(seed);
  const y0 = size / 2;
  g.lineCap = 'round';
  // sous-branches
  for (let k = 0; k < 9; k++) {
    const t = 0.08 + k * 0.1, x = t * size, side = k % 2 ? 1 : -1, span = size * 0.42 * (1 - t * 0.75);
    const ex = x + span * 0.55, ey = y0 + side * span * 0.8;
    g.strokeStyle = 'rgb(70,60,40)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y0); g.lineTo(ex, ey); g.stroke();
    for (let j = 0; j < 40; j++) {
      const u = r(), px = x + (ex - x) * u, py = y0 + (ey - y0) * u, len = 9 + r() * 10, a = Math.atan2(ey - y0, ex - x) + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.5);
      const v = 0.5 + r() * 0.5;
      g.strokeStyle = `rgb(${Math.round(30 + 40 * v)},${Math.round(95 + 80 * v)},${Math.round(60 + 40 * v)})`; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); g.stroke();
    }
  }
  // aiguilles le long de la tige
  for (let j = 0; j < 260; j++) {
    const u = r(), px = u * size * 0.97, w = size * 0.2 * (1 - u * 0.8), len = 8 + r() * w * 0.5, a = (r() < 0.5 ? 1 : -1) * (0.5 + r() * 0.9) + 0.15;
    const v = 0.4 + r() * 0.6;
    g.strokeStyle = `rgb(${Math.round(25 + 40 * v)},${Math.round(90 + 85 * v)},${Math.round(55 + 45 * v)})`; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(px, y0); g.lineTo(px + Math.cos(a) * len, y0 + Math.sin(a) * len); g.stroke();
  }
  g.strokeStyle = 'rgb(80,62,40)'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, y0); g.lineTo(size * 0.95, y0); g.stroke();
  return finish(c, { repeat: false, aniso: 4 });
}

// Écorce : stries verticales brunes
export function barkTexture(size = 128) {
  const c = canvas(size), g = c.getContext('2d'), r = rng(31);
  g.fillStyle = '#7a5a3c'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const x = r() * size, w = 1 + r() * 3, v = r() < 0.5 ? 'rgba(60,40,25,0.6)' : 'rgba(150,120,90,0.35)';
    g.fillStyle = v;
    wrapDraw(g, size, x, 0, 4, (px) => { g.fillRect(px, 0, w, size); });
  }
  for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(40,28,18,0.5)'; const x = r() * size, y = r() * size; g.fillRect(x, y, 2 + r() * 4, 1 + r() * 2); }
  return finish(c, {});
}

// Palme : une nervure centrale et des folioles en chevrons, plus courtes vers la pointe
export function frondTexture(size = 256, seed = 41) {
  const c = canvas(size, size / 2), g = c.getContext('2d'), r = rng(seed);
  const H = size / 2, y0 = H / 2;
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const u = i / 70, x = 6 + u * (size - 14), len = H * 0.46 * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.08)) * (0.85 + r() * 0.2);
    for (const side of [-1, 1]) {
      const v = 0.45 + r() * 0.55;
      g.strokeStyle = `rgb(${Math.round(40 + 50 * v)},${Math.round(120 + 90 * v)},${Math.round(30 + 30 * v)})`; g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(x, y0); g.lineTo(x + len * 0.55, y0 + side * len); g.stroke();
    }
  }
  g.strokeStyle = 'rgb(150,140,70)'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(0, y0); g.lineTo(size - 4, y0); g.stroke();
  return finish(c, { repeat: false, aniso: 4 });
}

// Tronc de palmier : anneaux clairs et sombres le long du tronc
export function palmBarkTexture(size = 128) {
  const c = canvas(size), g = c.getContext('2d'), r = rng(57);
  g.fillStyle = '#a07a52'; g.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 8) { g.fillStyle = `rgba(70,48,28,${0.35 + r() * 0.3})`; g.fillRect(x, 0, 3, size); g.fillStyle = 'rgba(210,180,130,0.35)'; g.fillRect(x + 4, 0, 2, size); }
  return finish(c, {});
}

// Ombre douce au pied des arbres (disque dégradé)
export function shadeTexture(size = 128) {
  const c = canvas(size), g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return finish(c, { srgb: false, repeat: false });
}
