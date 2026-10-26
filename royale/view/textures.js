// Battle royale (repris de Birdie Party) — textures peintes en canevas au chargement (aucun fichier) : herbe dense, grappes de feuilles,
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

// Grappe de feuilles (transparence) : centaines de feuilles ovales nervurées, chacune éclairée d'un côté,
// sombres au cœur de la grappe et plus claires en bordure (là où la lumière passe)
export function leafTexture(size = 512, seed = 5) {
  const c = canvas(size), g = c.getContext('2d'), r = rng(seed);
  const cx = size / 2, R = size * 0.47;
  // grappe en lobes : quelques sous-grappes autour du centre, pour un contour irrégulier
  const lobes = Array.from({ length: 7 }, (_, k) => { const a = k * 0.9 + r() * 0.6, d = R * (0.25 + 0.4 * r()); return { x: cx + Math.cos(a) * d, y: cx + Math.sin(a) * d, s: R * (0.32 + 0.2 * r()) }; });
  lobes.push({ x: cx, y: cx, s: R * 0.45 });
  for (let i = 0; i < 1500; i++) {
    const L = lobes[Math.floor(r() * lobes.length)], a = r() * Math.PI * 2, d = Math.sqrt(r()) * L.s;
    const x = L.x + Math.cos(a) * d, y = L.y + Math.sin(a) * d;
    if (Math.hypot(x - cx, y - cx) > R * 0.98) continue;
    const l = 9 + r() * 12, w = l * (0.38 + r() * 0.14), rot = a + (r() - 0.5) * 1.6;
    const k = Math.hypot(x - cx, y - cx) / R, v = 0.18 + 0.62 * k * (0.5 + 0.5 * r());
    const G = Math.round(70 + 105 * v), Rr = Math.round(28 + 52 * v * (0.7 + 0.6 * r())), B = Math.round(16 + 28 * v);
    g.save(); g.translate(x, y); g.rotate(rot);
    const gr = g.createLinearGradient(-l, -w, l, w);
    gr.addColorStop(0, `rgb(${Math.round(Rr * 0.7)},${Math.round(G * 0.72)},${Math.round(B * 0.7)})`);
    gr.addColorStop(1, `rgb(${Math.min(255, Rr + 18)},${Math.min(255, G + 24)},${Math.min(255, B + 8)})`);
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(-l, 0); g.quadraticCurveTo(0, -w * 1.25, l, 0); g.quadraticCurveTo(0, w * 1.25, -l, 0); g.fill();
    g.strokeStyle = 'rgba(20,45,12,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-l * 0.9, 0); g.lineTo(l * 0.9, 0); g.stroke();
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
    for (let j = 0; j < 75; j++) {
      const u = r(), px = x + (ex - x) * u, py = y0 + (ey - y0) * u, len = 11 + r() * 13, a = Math.atan2(ey - y0, ex - x) + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.5);
      const v = 0.5 + r() * 0.5;
      g.strokeStyle = `rgb(${Math.round(18 + 30 * v)},${Math.round(58 + 62 * v)},${Math.round(40 + 34 * v)})`; g.lineWidth = 3;
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); g.stroke();
    }
  }
  // aiguilles le long de la tige
  for (let j = 0; j < 520; j++) {
    const u = r(), px = u * size * 0.97, w = size * 0.26 * (1 - u * 0.75), len = 10 + r() * w * 0.6, a = (r() < 0.5 ? 1 : -1) * (0.5 + r() * 0.9) + 0.15;
    const v = 0.4 + r() * 0.6;
    g.strokeStyle = `rgb(${Math.round(16 + 30 * v)},${Math.round(55 + 66 * v)},${Math.round(38 + 36 * v)})`; g.lineWidth = 3.2;
    g.beginPath(); g.moveTo(px, y0); g.lineTo(px + Math.cos(a) * len, y0 + Math.sin(a) * len); g.stroke();
  }
  g.strokeStyle = 'rgb(80,62,40)'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, y0); g.lineTo(size * 0.95, y0); g.stroke();
  return finish(c, { repeat: false, aniso: 4 });
}

// Écorce : stries verticales brunes
export function barkTexture(size = 128) {
  const c = canvas(size), g = c.getContext('2d'), r = rng(31);
  g.fillStyle = '#5e4632'; g.fillRect(0, 0, size, size);
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

// Cactus : côtes verticales claires et sombres, piquées d'épines
export function cactusTexture(size = 128) {
  const c = canvas(size), g = c.getContext('2d'), r = rng(73);
  g.fillStyle = '#4e7a3a'; g.fillRect(0, 0, size, size);
  const ribs = 8, w = size / ribs;
  for (let i = 0; i < ribs; i++) {
    const x = i * w, grd = g.createLinearGradient(x, 0, x + w, 0);
    grd.addColorStop(0, 'rgba(30,60,28,0.55)'); grd.addColorStop(0.5, 'rgba(150,190,110,0.35)'); grd.addColorStop(1, 'rgba(30,60,28,0.55)');
    g.fillStyle = grd; g.fillRect(x, 0, w, size);
    for (let y = 2; y < size; y += 6) { g.fillStyle = `rgba(235,230,200,${0.35 + r() * 0.4})`; g.fillRect(x + w / 2 - 0.5, y + r() * 2, 1.2, 1.2); }
  }
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

// Touffes d'herbe (transparence) : quatre variantes dans un atlas 2 × 2 ; brins courbes, sombres au pied
// (qui se fond dans le sol), clairs à la pointe
export function tuftTexture(size = 512, seed = 61) {
  const c = canvas(size), g = c.getContext('2d'), r = rng(seed), S = size / 2;
  for (let q = 0; q < 4; q++) {
    const ox = (q % 2) * S, oy = Math.floor(q / 2) * S;
    const n = 26 + q * 9, spread = 0.45 + q * 0.12;
    for (let i = 0; i < n; i++) {
      const x0 = ox + S * (0.5 + (r() - 0.5) * spread), h = S * (0.4 + 0.55 * r()), lean = (r() - 0.5) * S * (0.4 + q * 0.12), w = 2.5 + r() * 4;
      const x1 = x0 + lean, y1 = oy + S - h, cxp = x0 + lean * 0.25, cyp = oy + S - h * 0.55;
      const gr = g.createLinearGradient(0, oy + S, 0, y1);
      const v = 0.8 + r() * 0.35;
      // tons neutres : la teinte vient de la surface (couleur des sommets), la texture ne donne que le modelé
      const t = (k) => Math.min(255, Math.round(k * v));
      gr.addColorStop(0, `rgba(${t(150)},${t(158)},${t(140)},0)`);
      gr.addColorStop(0.14, `rgba(${t(165)},${t(175)},${t(152)},1)`);
      gr.addColorStop(0.6, `rgb(${t(210)},${t(220)},${t(196)})`);
      gr.addColorStop(1, `rgb(${t(238)},${t(245)},${t(222)})`);
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(x0 - w, oy + S); g.quadraticCurveTo(cxp - w * 0.6, cyp, x1, y1); g.quadraticCurveTo(cxp + w * 0.6, cyp, x0 + w, oy + S); g.closePath(); g.fill();
    }
  }
  return finish(c, { repeat: false, aniso: 4 });
}

// bruit de valeur répétable (4 canaux d'octaves différents), pour le ciel, l'eau et le sol
export function noiseTexture() {
  const N = 256, data = new Uint8Array(N * N * 4);
  const oct = (cells, seed) => {
    const g = new Float32Array(cells * cells);
    let s = seed; for (let i = 0; i < g.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; g[i] = s / 4294967296; }
    return (x, y) => {
      const fx = x * cells / N, fy = y * cells / N, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[(iy % cells) * cells + (ix % cells)], b = g[(iy % cells) * cells + ((ix + 1) % cells)];
      const c = g[((iy + 1) % cells) * cells + (ix % cells)], d = g[((iy + 1) % cells) * cells + ((ix + 1) % cells)];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  };
  const o = [oct(64, 7), oct(32, 11), oct(16, 13), oct(8, 17), oct(4, 19)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    data[i] = 255 * (0.6 * o[0](x, y) + 0.4 * o[1](x, y));
    data[i + 1] = 255 * (0.55 * o[2](x, y) + 0.45 * o[1](x, y));
    data[i + 2] = 255 * (0.6 * o[4](x, y) + 0.4 * o[3](x, y));
    data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
