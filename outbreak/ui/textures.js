// Textures d'interface générées au chargement (aucun fichier à télécharger) : acier brossé, tôle striée,
// papier vieilli, bande de danger usée, grain. Elles sont exposées en variables CSS (--tex-*).
import { makeRng } from '../engine/rng.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

function noise(ctx, w, h, rng, amount, mono = true) {
  const im = ctx.getImageData(0, 0, w, h), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng.next() - 0.5) * amount;
    d[i] += n; d[i + 1] += mono ? n : (rng.next() - 0.5) * amount; d[i + 2] += mono ? n : (rng.next() - 0.5) * amount;
  }
  ctx.putImageData(im, 0, 0);
}

// Acier sombre brossé avec rayures (tuilable horizontalement)
function metal(seed, base = [38, 42, 50]) {
  const W = 256, H = 256, rng = makeRng(seed);
  const [c, x] = canvas(W, H);
  x.fillStyle = `rgb(${base})`; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    const y = rng.range(0, H), a = rng.range(0.02, 0.07), l = rng.range(30, 256);
    x.strokeStyle = rng.chance(0.5) ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.5})`;
    x.lineWidth = rng.range(0.5, 1.4);
    const x0 = rng.range(-40, W);
    x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + l, y + rng.range(-0.6, 0.6)); x.stroke();
  }
  // rayures et chocs
  for (let i = 0; i < 14; i++) {
    x.strokeStyle = `rgba(255,255,255,${rng.range(0.05, 0.12)})`; x.lineWidth = rng.range(0.6, 1.2);
    const sx = rng.range(0, W), sy = rng.range(0, H), a = rng.range(0, Math.PI), l = rng.range(8, 40);
    x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); x.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const g = x.createRadialGradient(rng.range(0, W), rng.range(0, H), 0, rng.range(0, W), rng.range(0, H), rng.range(30, 90));
    g.addColorStop(0, `rgba(0,0,0,${rng.range(0.05, 0.12)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  noise(x, W, H, rng, 14);
  return c.toDataURL('image/png');
}

// Tôle striée (motif en losanges) pour les boutons secondaires
function plate(seed) {
  const W = 64, H = 64, rng = makeRng(seed);
  const [c, x] = canvas(W, H);
  x.fillStyle = '#3a3f49'; x.fillRect(0, 0, W, H);
  const bump = (cx, cy, a) => {
    x.save(); x.translate(cx, cy); x.rotate(a);
    const g = x.createLinearGradient(-9, 0, 9, 0);
    g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(0.5, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
    x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, 10, 2.6, 0, 0, Math.PI * 2); x.fill(); x.restore();
  };
  for (const [cx, cy, a] of [[16, 16, 0.785], [48, 16, -0.785], [16, 48, -0.785], [48, 48, 0.785], [0, 0, -0.785], [64, 0, 0.785], [0, 64, 0.785], [64, 64, -0.785], [32, 32, 0.785], [32, 0, -0.785], [32, 64, -0.785], [0, 32, 0.785], [64, 32, 0.785]]) bump(cx, cy, a);
  noise(x, W, H, rng, 12);
  return c.toDataURL('image/png');
}

// Papier vieilli (dossiers, cartes d'amélioration)
function paper(seed) {
  const W = 320, H = 320, rng = makeRng(seed);
  const [c, x] = canvas(W, H);
  x.fillStyle = '#efe4c8'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 7; i++) {
    const cx = rng.range(0, W), cy = rng.range(0, H), r = rng.range(40, 140);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(150,110,60,${rng.range(0.04, 0.1)})`); g.addColorStop(1, 'rgba(150,110,60,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  // tache de café
  const cx = rng.range(60, W - 60), cy = rng.range(60, H - 60), r = rng.range(26, 40);
  x.strokeStyle = 'rgba(120,80,40,.18)'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, r, 0.2, Math.PI * 1.85); x.stroke();
  for (let i = 0; i < 500; i++) { x.strokeStyle = `rgba(120,90,50,${rng.range(0.03, 0.08)})`; x.lineWidth = 0.6; const sx = rng.range(0, W), sy = rng.range(0, H), a = rng.range(0, 6.28); x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * 6, sy + Math.sin(a) * 6); x.stroke(); }
  noise(x, W, H, rng, 18);
  return c.toDataURL('image/png');
}

// Bande de danger jaune et noire, usée
function hazard(seed) {
  const W = 128, H = 24, rng = makeRng(seed);
  const [c, x] = canvas(W, H);
  x.fillStyle = '#f2b51d'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#17181c';
  for (let k = -H; k < W + H; k += 32) { x.beginPath(); x.moveTo(k, H); x.lineTo(k + 16, H); x.lineTo(k + 16 + H, 0); x.lineTo(k + H, 0); x.fill(); }
  // usure : éclats de peinture
  for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(70,64,52,${rng.range(0.25, 0.6)})`; x.beginPath(); x.ellipse(rng.range(0, W), rng.range(0, H), rng.range(0.6, 2.6), rng.range(0.4, 1.6), rng.range(0, 3), 0, Math.PI * 2); x.fill(); }
  noise(x, W, H, rng, 26);
  return c.toDataURL('image/png');
}

// Grain fin (superposé aux écrans)
function grain(seed) {
  const W = 160, H = 160, rng = makeRng(seed);
  const [c, x] = canvas(W, H);
  const im = x.createImageData(W, H), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const v = rng.next() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = rng.next() * 26; }
  x.putImageData(im, 0, 0);
  return c.toDataURL('image/png');
}

export function installTextures() {
  const r = document.documentElement.style;
  const set = (k, url) => r.setProperty(k, `url("${url}")`);
  try {
    set('--tex-metal', metal(11));
    set('--tex-metal-hi', metal(23, [58, 64, 76]));
    set('--tex-plate', plate(5));
    set('--tex-paper', paper(7));
    set('--tex-hazard', hazard(3));
    set('--tex-grain', grain(9));
  } catch (e) { /* pas de canvas : l'interface garde ses couleurs unies */ }
}
