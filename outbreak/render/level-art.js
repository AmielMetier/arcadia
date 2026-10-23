// Peinture d'une salle (sol, murs, obstacles) dans un canvas hors écran, une seule fois par salle.
import { makeRng } from '../engine/rng.js';
import { WALL_TOP, WALL_SIDE, WALL_BOTTOM } from '../engine/level.js';
import { INK, shade, rr, fs, circ, ell } from './sprites.js';

export const THEMES = {
  sas:     { floor: '#7d8794', tile: 64, grout: '#5f6874', wall: '#3b4350', cap: '#5a6474', accent: '#ffc531', dark: 0.78, lamp: '#bfe3ff' },
  lab:     { floor: '#c9d3d8', tile: 48, grout: '#a5b2ba', wall: '#4a5a66', cap: '#6f8492', accent: '#1fc7c1', dark: 0.74, lamp: '#d8fbff' },
  armory:  { floor: '#5d6470', tile: 56, grout: '#474d57', wall: '#30353d', cap: '#4b525d', accent: '#ffc531', dark: 0.82, lamp: '#ffe2a8', plate: true },
  medbay:  { floor: '#b9d6c8', tile: 40, grout: '#93b6a5', wall: '#3f5a52', cap: '#5f8076', accent: '#e3262f', dark: 0.74, lamp: '#e8fff4' },
  storage: { floor: '#8f8a80', tile: 0, grout: '#77726a', wall: '#45403a', cap: '#635d55', accent: '#ffc531', dark: 0.8, lamp: '#ffd9a0', concrete: true },
  core:    { floor: '#3b3446', tile: 60, grout: '#2a2433', wall: '#231d2b', cap: '#3a3046', accent: '#c77dff', dark: 0.84, lamp: '#e6b8ff' },
  arena:   { floor: '#7f8378', tile: 0, grout: '#676b62', wall: '#3a3d38', cap: '#5a5e57', accent: '#ffc531', dark: 0.76, lamp: '#fff0c8', concrete: true },
  shop:    { floor: '#8a6f55', tile: 0, grout: '#6e5641', wall: '#4a3a2c', cap: '#6b5440', accent: '#ffc531', dark: 0.55, lamp: '#ffd59a', wood: true },
  vault:   { floor: '#6b6f78', tile: 56, grout: '#555962', wall: '#2c3038', cap: '#4a4f59', accent: '#ffc531', dark: 0.8, lamp: '#ffe8b0', plate: true },
  dark:    { floor: '#4c5058', tile: 64, grout: '#3a3d44', wall: '#23262c', cap: '#34373f', accent: '#ff4b2b', dark: 0.95, lamp: '#ff9a7a' },
  sewers:  { floor: '#6a6458', tile: 0, grout: '#544f45', wall: '#5a3a2e', cap: '#7a4f3e', accent: '#c9a227', dark: 0.82, lamp: '#ffcf8a', brick: true, cobble: true },
  hospital:{ floor: '#d8e4e0', tile: 44, grout: '#b8c9c4', wall: '#6f9a8f', cap: '#8fb8ad', accent: '#e3262f', dark: 0.78, lamp: '#eafffa', hosp: true },
  metro:   { floor: '#a7a39a', tile: 52, grout: '#8a867c', wall: '#e8e2d4', cap: '#3a5a8c', accent: '#ffc531', dark: 0.74, lamp: '#fff4d6', metro: true },
  nice:    { floor: '#5d6068', tile: 0, grout: '#4b4e55', wall: '#f2c39a', cap: '#d98e5f', accent: '#fff8ea', dark: 0.7, lamp: '#ffd58a', street: true },
  gas:     { floor: '#8e9a80', tile: 48, grout: '#727e66', wall: '#3d4a38', cap: '#5a6a52', accent: '#9be15d', dark: 0.76, lamp: '#e6ffc2' },
};

export function paintLevel(lv) {
  const th = THEMES[lv.theme] || THEMES.sas;
  const cv = document.createElement('canvas');
  cv.width = lv.w; cv.height = lv.h;
  const c = cv.getContext('2d');
  const rng = makeRng(lv.seed ^ 0xa11);
  const I = lv.inner;

  // ---------- sol
  c.fillStyle = th.floor; c.fillRect(0, 0, lv.w, lv.h);
  if (th.street) {
    // chaussée + trottoirs dallés de part et d'autre
    c.fillStyle = th.floor; c.fillRect(I.x0, I.y0, I.x1 - I.x0, I.y1 - I.y0);
    const sw = 120;
    for (const [x0, x1] of [[I.x0, I.x0 + sw], [I.x1 - sw, I.x1]]) {
      for (let y = I.y0; y < I.y1; y += 40) for (let x = x0; x < x1; x += 40) { c.fillStyle = shade('#c9b79c', rng.range(-0.06, 0.04)); c.fillRect(x, y, 40, 40); c.strokeStyle = '#a8977e'; c.lineWidth = 1.5; c.strokeRect(x, y, 40, 40); }
      c.fillStyle = '#8d96a3'; c.fillRect(x0 === I.x0 ? x1 - 8 : x0, I.y0, 8, I.y1 - I.y0);
    }
    for (let k = 0; k < 900; k++) { c.fillStyle = `rgba(${rng.chance(0.5) ? '0,0,0' : '255,255,255'},0.05)`; c.fillRect(rng.range(I.x0 + sw, I.x1 - sw), rng.range(I.y0, I.y1), 2, 2); }
    c.fillStyle = 'rgba(255,248,234,.75)';
    const cx2 = lv.w / 2;
    for (let y = I.y0 + 20; y < I.y1; y += 90) c.fillRect(cx2 - 5, y, 10, 50);
    // passage piéton
    for (let k = 0; k < 7; k++) c.fillRect(I.x0 + sw + 20 + k * 34, I.y1 - 150, 18, 110);
  } else if (th.brick && th.cobble) {
    for (let y = I.y0; y < I.y1; y += 34) {
      const off = ((y - I.y0) / 34) % 2 ? 0 : 30;
      for (let x = I.x0 - off; x < I.x1; x += 60) { c.fillStyle = shade(th.floor, rng.range(-0.08, 0.06)); c.beginPath(); c.roundRect(x + 2, y + 2, 56, 30, 6); c.fill(); }
    }
  } else if (th.wood) {
    for (let y = I.y0; y < I.y1; y += 30) {
      let x = I.x0 - rng.range(0, 120);
      while (x < I.x1) { const L = rng.range(90, 200); c.fillStyle = shade(th.floor, rng.range(-0.08, 0.06)); c.fillRect(x, y, L, 30); c.strokeStyle = th.grout; c.lineWidth = 2; c.strokeRect(x, y, L, 30); x += L; }
    }
  } else if (th.concrete) {
    for (let k = 0; k < (lv.w * lv.h) / 9000; k++) {
      c.fillStyle = `rgba(${rng.chance(0.5) ? '0,0,0' : '255,255,255'},${rng.range(0.02, 0.06)})`;
      circ(c, rng.range(0, lv.w), rng.range(0, lv.h), rng.range(10, 60)); c.fill();
    }
    // grandes dalles de béton
    c.strokeStyle = th.grout; c.lineWidth = 3;
    for (let x = I.x0; x < I.x1; x += 240) { c.beginPath(); c.moveTo(x, I.y0); c.lineTo(x, I.y1); c.stroke(); }
    for (let y = I.y0; y < I.y1; y += 240) { c.beginPath(); c.moveTo(I.x0, y); c.lineTo(I.x1, y); c.stroke(); }
  } else {
    const T = th.tile;
    for (let y = I.y0; y < I.y1; y += T) for (let x = I.x0; x < I.x1; x += T) {
      const v = rng.range(-0.05, 0.05);
      c.fillStyle = shade(th.floor, v); c.fillRect(x, y, T, T);
      if (th.plate) { // tôle striée
        c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 2;
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const px = x + 7 + i * 13, py = y + 7 + j * 13; c.beginPath(); c.moveTo(px, py); c.lineTo(px + 5, py + ((i + j) % 2 ? 5 : -5) * 0.6); c.stroke(); }
      }
    }
    c.strokeStyle = th.grout; c.lineWidth = 2;
    for (let x = I.x0; x <= I.x1; x += T) { c.beginPath(); c.moveTo(x, I.y0); c.lineTo(x, I.y1); c.stroke(); }
    for (let y = I.y0; y <= I.y1; y += T) { c.beginPath(); c.moveTo(I.x0, y); c.lineTo(I.x1, y); c.stroke(); }
  }
  // saleté et taches
  for (let k = 0; k < (lv.w * lv.h) / 26000; k++) {
    const x = rng.range(I.x0, I.x1), y = rng.range(I.y0, I.y1), r = rng.range(14, 70);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(30,25,20,${rng.range(0.08, 0.2)})`); g.addColorStop(1, 'rgba(30,25,20,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // fissures
  c.strokeStyle = 'rgba(20,20,25,.35)'; c.lineWidth = 1.6;
  for (let k = 0; k < (lv.w * lv.h) / 120000; k++) {
    let x = rng.range(I.x0, I.x1), y = rng.range(I.y0, I.y1);
    c.beginPath(); c.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += rng.range(-22, 22); y += rng.range(-22, 22); c.lineTo(x, y); }
    c.stroke();
  }
  // vieilles traînées de sang
  for (let k = 0; k < 4 + lv.index; k++) {
    const x = rng.range(I.x0 + 50, I.x1 - 50), y = rng.range(I.y0 + 50, I.y1 - 50);
    c.fillStyle = `rgba(90,15,15,${rng.range(0.25, 0.45)})`;
    const a = rng.range(0, Math.PI * 2);
    for (let s = 0; s < 8; s++) { ell(c, x + Math.cos(a) * s * 9, y + Math.sin(a) * s * 9, rng.range(4, 12), rng.range(3, 8), a); c.fill(); }
  }
  // zones : eau des égouts, voies du métro
  for (const z of lv.zones || []) {
    if (z.k === 'water') {
      c.fillStyle = '#2f4a3e'; c.fillRect(z.x, z.y, z.w, z.h);
      c.fillStyle = '#3d6150'; c.fillRect(z.x, z.y + 8, z.w, z.h - 16);
      c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(z.x, z.y, z.w, z.h);
      c.fillStyle = '#8a8478'; c.fillRect(z.x, z.y - 6, z.w, 6); c.fillRect(z.x, z.y + z.h, z.w, 6);
    } else if (z.k === 'track') {
      c.fillStyle = '#3a3630'; c.fillRect(z.x, z.y, z.w, z.h);
      for (let x = z.x; x < z.x + z.w; x += 28) { c.fillStyle = '#6b4f2e'; c.fillRect(x, z.y + 10, 16, z.h - 20); }
      c.fillStyle = '#a7b0bd'; c.fillRect(z.x, z.y + 24, z.w, 7); c.fillRect(z.x, z.y + z.h - 31, z.w, 7);
      c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(z.x, z.y + 24, z.w, 7); c.strokeRect(z.x, z.y + z.h - 31, z.w, 7);
      // bords de quai jaunes
      c.fillStyle = '#ffc531'; c.fillRect(z.x, z.y - 14, z.w, 10); c.fillRect(z.x, z.y + z.h + 4, z.w, 10);
      c.strokeStyle = INK; c.strokeRect(z.x, z.y - 14, z.w, 10); c.strokeRect(z.x, z.y + z.h + 4, z.w, 10);
    }
  }
  for (const pr of lv.props || []) if (pr.k === 'bridge') {
    for (let x = pr.x; x < pr.x + pr.w; x += 22) { c.fillStyle = shade('#8a5a33', (x % 44) ? -0.05 : 0.05); c.fillRect(x, pr.y - 8, 20, pr.h + 16); }
    c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(pr.x, pr.y - 8, pr.w, pr.h + 16);
  }
  // teinte des salles contaminées
  if (lv.tint === 'gas') { c.fillStyle = 'rgba(120,180,60,.12)'; c.fillRect(0, 0, lv.w, lv.h); }

  // marquages au sol
  paintMarkings(c, lv, th, rng);

  // ---------- ombres portées des murs et obstacles (vers le bas-droite)
  c.fillStyle = 'rgba(0,0,0,.28)';
  c.fillRect(I.x0, I.y0, I.x1 - I.x0, 26);
  c.fillRect(I.x0, I.y0, 16, I.y1 - I.y0);
  for (const s of lv.solids) {
    if (s.kind === 'wall') continue;
    rr(c, s.x + 8, s.y + 10, s.w, s.h, 6); c.fillStyle = 'rgba(0,0,0,.3)'; c.fill();
  }

  // ---------- bouches d'aération
  for (const v of lv.vents) paintVent(c, v, th);

  // ---------- obstacles
  for (const s of lv.solids) if (s.kind !== 'wall') paintObstacle(c, s, th, rng);

  // ---------- murs
  paintWalls(c, lv, th, rng);
  return cv;
}

function paintMarkings(c, lv, th, rng) {
  const I = lv.inner, cx = lv.w / 2;
  // bande de danger devant l'entrée et sous chaque porte
  const stripes = (x, y, w, h) => {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.fillStyle = th.accent; c.fillRect(x, y, w, h);
    c.fillStyle = INK; for (let k = -h; k < w + h; k += 22) { c.beginPath(); c.moveTo(x + k, y + h); c.lineTo(x + k + 11, y + h); c.lineTo(x + k + 11 + h, y); c.lineTo(x + k + h, y); c.fill(); }
    c.restore(); c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(x, y, w, h);
  };
  for (const d of lv.doors) {
    if (d.side === 'top') stripes(d.x - 10, I.y0 + 4, d.w + 20, 12);
    else stripes(d.x - 10, I.y1 - 16, d.w + 20, 12);
  }
  c.globalAlpha = 0.5;
  if (lv.theme === 'medbay') { c.fillStyle = '#e3262f'; const x = cx, y = (I.y0 + I.y1) / 2; c.fillRect(x - 18, y - 60, 36, 120); c.fillRect(x - 60, y - 18, 120, 36); }
  if (lv.theme === 'core' || lv.theme === 'arena') {
    c.strokeStyle = th.accent; c.lineWidth = 8; const y = (I.y0 + I.y1) / 2;
    c.setLineDash([30, 18]); circ(c, cx, y, Math.min(I.x1 - I.x0, I.y1 - I.y0) * 0.36); c.stroke(); c.setLineDash([]);
  }
  if (lv.theme === 'storage' || lv.theme === 'armory' || lv.theme === 'sas') {
    c.strokeStyle = th.accent; c.lineWidth = 6;
    c.beginPath(); c.moveTo(I.x0 + 90, I.y0 + 120); c.lineTo(I.x0 + 90, I.y1 - 90); c.moveTo(I.x1 - 90, I.y0 + 120); c.lineTo(I.x1 - 90, I.y1 - 90); c.stroke();
  }
  if (lv.theme === 'lab') {
    c.strokeStyle = th.accent; c.lineWidth = 5;
    for (let k = 0; k < 3; k++) { const y = I.y0 + (I.y1 - I.y0) * (0.25 + k * 0.25); c.beginPath(); c.moveTo(I.x0 + 30, y); c.lineTo(I.x0 + 160, y); c.moveTo(I.x1 - 30, y); c.lineTo(I.x1 - 160, y); c.stroke(); }
  }
  c.globalAlpha = 1;
  // flèches vers les sorties
  c.fillStyle = 'rgba(255,255,255,.18)';
  for (const d of lv.doors) if (d.kind === 'exit') {
    const x = d.x + d.w / 2;
    for (let k = 0; k < 2; k++) { const y = I.y0 + 70 + k * 46; c.beginPath(); c.moveTo(x, y - 16); c.lineTo(x + 22, y + 8); c.lineTo(x + 10, y + 8); c.lineTo(x, y - 2); c.lineTo(x - 10, y + 8); c.lineTo(x - 22, y + 8); c.closePath(); c.fill(); }
  }
}

function paintVent(c, v, th) {
  c.save(); c.translate(v.x, v.y);
  const horiz = v.side === 'top' || v.side === 'bottom';
  const w = horiz ? 64 : 22, h = horiz ? 22 : 64;
  const ox = v.side === 'left' ? -4 : v.side === 'right' ? -18 : -32, oy = v.side === 'top' ? -4 : v.side === 'bottom' ? -18 : -32;
  rr(c, ox, oy, w, h, 4); fs(c, '#22252b', 3);
  c.strokeStyle = '#4a4f59'; c.lineWidth = 3;
  for (let k = 1; k < 5; k++) { c.beginPath(); if (horiz) { c.moveTo(ox + (k * w) / 5, oy + 3); c.lineTo(ox + (k * w) / 5, oy + h - 3); } else { c.moveTo(ox + 3, oy + (k * h) / 5); c.lineTo(ox + w - 3, oy + (k * h) / 5); } c.stroke(); }
  c.restore();
}

function block3d(c, s, top, front, depth = 14) {
  // face avant visible en bas, dessus plus clair
  rr(c, s.x, s.y + depth, s.w, s.h - depth + 4, 5); fs(c, front, 3);
  rr(c, s.x, s.y, s.w, s.h - 2, 5); fs(c, top, 3);
}

function paintObstacle(c, s, th, rng) {
  const x = s.x, y = s.y, w = s.w, h = s.h;
  switch (s.kind) {
    case 'pillar':
      block3d(c, s, shade(th.cap, 0.15), th.wall, 18);
      c.strokeStyle = th.accent; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 6, y + h - 10); c.lineTo(x + w - 6, y + h - 10); c.stroke();
      break;
    case 'locker': case 'cabinet':
      block3d(c, s, '#7d8a99', '#55606d', 16);
      c.strokeStyle = INK; c.lineWidth = 2;
      for (let k = 1; k < 3; k++) { c.beginPath(); c.moveTo(x + (k * w) / 3, y + 4); c.lineTo(x + (k * w) / 3, y + h - 20); c.stroke(); }
      break;
    case 'bench':
      rr(c, x, y, w, h, 5); fs(c, '#e9eef0', 3);
      rr(c, x + 6, y + 6, w - 12, h - 12, 3); c.fillStyle = '#cdd6db'; c.fill();
      for (let k = 0; k < Math.floor(w / 50); k++) { // fioles et microscopes
        const px = x + 22 + k * 48;
        circ(c, px, y + h / 2, 7); fs(c, ['#1fc7c1', '#9be15d', '#ff5fa2', '#ffc531'][(k + (x | 0)) % 4], 2);
        rr(c, px + 14, y + 12, 12, 18, 3); fs(c, '#5a6474', 2);
      }
      break;
    case 'tank':
      circ(c, x + w / 2, y + h / 2, w / 2); fs(c, '#4a5a66', 3);
      circ(c, x + w / 2, y + h / 2, w / 2 - 7); fs(c, '#58e0c8', 2.5);
      c.fillStyle = 'rgba(255,255,255,.5)'; ell(c, x + w / 2 - 8, y + h / 2 - 8, 6, 4, -0.6); c.fill();
      circ(c, x + w / 2 + 4, y + h / 2 + 6, 6); c.fillStyle = '#2b3a33'; c.fill(); // un spécimen…
      break;
    case 'rack':
      block3d(c, s, '#4b525d', '#30353d', 12);
      for (let k = 0; k < Math.floor(h / 34); k++) { c.save(); c.translate(x + w / 2, y + 16 + k * 34); c.rotate(Math.PI / 2); rr(c, -14, -3, 28, 6, 2); fs(c, '#262932', 1.6); c.restore(); }
      break;
    case 'sandbags':
      for (let k = 0; k < Math.floor(w / 30); k++) for (let r = 0; r < Math.floor(h / 18); r++) { ell(c, x + 15 + k * 30 + (r % 2) * 8, y + 9 + r * 18, 16, 10); fs(c, '#b9a477', 2.4); }
      break;
    case 'ammo':
      block3d(c, s, '#5c6b3a', '#455229', 12);
      c.fillStyle = '#ffd65a'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillText('MUN.', x + w / 2, y + h / 2);
      break;
    case 'bed':
      rr(c, x, y, w, h, 6); fs(c, '#d7dde0', 3);
      rr(c, x + 6, y + 8, w - 12, 26, 6); fs(c, '#ffffff', 2);
      rr(c, x + 4, y + 40, w - 8, h - 46, 4); fs(c, ['#8fc1e3', '#b5d99c', '#e3a8a8'][(x | 0) % 3], 2);
      break;
    case 'stack':
      block3d(c, s, '#b0793f', '#7a4f24', 14);
      c.strokeStyle = '#7a4f24'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x + w / 2, y + 3); c.lineTo(x + w / 2, y + h - 16); c.moveTo(x + 3, y + (h - 14) / 2); c.lineTo(x + w - 3, y + (h - 14) / 2); c.stroke();
      break;
    case 'pallet':
      rr(c, x, y, w, h, 3); fs(c, '#9c7a4f', 2.6);
      c.strokeStyle = '#6b4f2e'; c.lineWidth = 3; for (let k = 1; k < 5; k++) { c.beginPath(); c.moveTo(x + (k * w) / 5, y + 3); c.lineTo(x + (k * w) / 5, y + h - 3); c.stroke(); }
      break;
    case 'barrier':
      rr(c, x, y, w, h, 6); fs(c, '#d9d2c3', 3);
      c.save(); c.beginPath(); c.roundRect(x + 4, y + 4, w - 8, h - 8, 4); c.clip();
      c.fillStyle = '#e3262f'; for (let k = 0; k < w; k += 28) { c.beginPath(); c.moveTo(x + k, y + h); c.lineTo(x + k + 14, y + h); c.lineTo(x + k + 14 + h, y); c.lineTo(x + k + h, y); c.fill(); }
      c.restore();
      break;
    case 'reactor': {
      const cx = x + w / 2, cy = y + h / 2;
      circ(c, cx, cy, w / 2); fs(c, '#2d2638', 3.5);
      circ(c, cx, cy, w / 2 - 16); fs(c, '#3e3350', 3);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; rr(c, cx + Math.cos(a) * (w / 2 - 8) - 5, cy + Math.sin(a) * (w / 2 - 8) - 5, 10, 10, 2); fs(c, '#c77dff', 2); }
      circ(c, cx, cy, 28); fs(c, '#c77dff', 3);
      circ(c, cx, cy, 14); c.fillStyle = '#f3d9ff'; c.fill();
      break;
    }
    case 'fortwall': {
      rr(c, x, y, w, h, 4); fs(c, '#8d96a3', 3);
      c.save(); c.beginPath(); c.rect(x + 3, y + 3, w - 6, h - 6); c.clip();
      c.fillStyle = '#ffc531'; for (let k = -40; k < w + h; k += 26) { c.beginPath(); c.moveTo(x + k, y + h); c.lineTo(x + k + 12, y + h); c.lineTo(x + k + 12 + h, y); c.lineTo(x + k + h, y); c.fill(); }
      c.restore(); c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(x + 3, y + 3, w - 6, h - 6);
      break;
    }
    case 'generator':
      rr(c, x - 6, y - 6, w + 12, h + 12, 10); fs(c, '#3a3f4b', 3);
      break;
    case 'car': {
      const cols = ['#e3262f', '#2b8cff', '#ffc531', '#fff8ea', '#2fbf71', '#59616d'];
      const body = cols[s.hue % cols.length];
      c.save(); c.translate(x + w / 2, y + h / 2); if (s.vert) c.rotate(Math.PI / 2);
      const L = s.vert ? h : w, Wd = s.vert ? w : h;
      rr(c, -L / 2, -Wd / 2, L, Wd, 12); fs(c, body, 3);
      rr(c, -L / 2 + 26, -Wd / 2 + 6, L * 0.42, Wd - 12, 8); fs(c, shade(body, -0.25), 2.5);
      rr(c, -L / 2 + 30, -Wd / 2 + 9, 12, Wd - 18, 3); c.fillStyle = '#9fd8ff'; c.fill();
      rr(c, -L / 2 + 26 + L * 0.42 - 16, -Wd / 2 + 9, 12, Wd - 18, 3); c.fill();
      c.fillStyle = '#fff3c4'; rr(c, L / 2 - 8, -Wd / 2 + 5, 6, 10, 2); c.fill(); rr(c, L / 2 - 8, Wd / 2 - 15, 6, 10, 2); c.fill();
      c.fillStyle = '#ff4b2b'; rr(c, -L / 2 + 2, -Wd / 2 + 5, 5, 10, 2); c.fill(); rr(c, -L / 2 + 2, Wd / 2 - 15, 5, 10, 2); c.fill();
      c.restore();
      break;
    }
    case 'palm': {
      const cx = x + w / 2, cy = y + h / 2;
      circ(c, cx, cy, 13); fs(c, '#8a5a33', 3);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + 0.3;
        c.save(); c.translate(cx, cy); c.rotate(a);
        c.beginPath(); c.moveTo(4, 0); c.quadraticCurveTo(28, -14, 52, 0); c.quadraticCurveTo(28, 10, 4, 0); fs(c, k % 2 ? '#2e7028' : '#3a8a32', 2.4);
        c.restore();
      }
      circ(c, cx, cy, 8); fs(c, '#6b4f2e', 2);
      break;
    }
    case 'terrace': {
      const cx = x + w / 2, cy = y + h / 2;
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; circ(c, cx + Math.cos(a) * 30, cy + Math.sin(a) * 30, 9); fs(c, '#c9b79c', 2); }
      circ(c, cx, cy, 22); fs(c, '#fff8ea', 2.6);
      c.save(); c.beginPath(); c.arc(cx, cy, 30, 0, Math.PI * 2); c.clip();
      for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#e3262f' : '#fff8ea'; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, 30, (k / 8) * Math.PI * 2, ((k + 1) / 8) * Math.PI * 2); c.fill(); }
      c.restore(); circ(c, cx, cy, 30); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
      break;
    }
    case 'pbench':
      rr(c, x, y, w, h, 4); fs(c, '#2a6fb5', 3);
      c.strokeStyle = '#1b4f86'; c.lineWidth = 2; for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x + 4, y + (k * h) / 4); c.lineTo(x + w - 4, y + (k * h) / 4); c.stroke(); }
      break;
    case 'kiosk':
      block3d(c, s, '#2e7028', '#245a20', 14);
      c.fillStyle = '#fff8ea'; c.font = '14px Bungee, Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SOCCA', x + w / 2, y + h / 2 - 6);
      break;
    case 'hbed':
      rr(c, x, y, w, h, 6); fs(c, '#d7dde0', 3);
      rr(c, x + 6, y + 8, w - 12, 24, 6); fs(c, '#ffffff', 2);
      rr(c, x + 4, y + 38, w - 8, h - 44, 4); fs(c, '#9cc3d8', 2);
      if (rng.chance(0.4)) { c.fillStyle = 'rgba(120,20,20,.55)'; ell(c, x + w / 2, y + h * 0.6, 14, 10); c.fill(); }
      break;
    case 'curtain':
      c.fillStyle = '#8fc1b5'; for (let k = 0; k < h; k += 14) { ell(c, x + w / 2, y + k + 7, w / 2 + 2, 8); c.fill(); }
      c.strokeStyle = INK; c.lineWidth = 2.5; c.strokeRect(x, y, w, h);
      break;
    case 'gurney':
      rr(c, x, y, w, h, 5); fs(c, '#c9ced6', 2.6);
      rr(c, x + 5, y + 5, w - 10, h - 10, 4); fs(c, '#ffffff', 2);
      break;
    case 'desk':
      rr(c, x, y, w, h, 5); fs(c, '#e8eef2', 3);
      rr(c, x + 12, y + 8, 40, 26, 3); fs(c, '#2a2d36', 2); rr(c, x + w - 50, y + 10, 34, 22, 3); fs(c, '#ffc531', 2);
      c.fillStyle = '#e3262f'; c.fillRect(x + w / 2 - 3, y + 12, 6, 20); c.fillRect(x + w / 2 - 10, y + 19, 20, 6);
      break;
    case 'mpillar':
      block3d(c, s, '#e8e2d4', '#c9c2b2', 14);
      c.fillStyle = '#3a5a8c'; c.fillRect(x + 4, y + 10, w - 8, 10);
      break;
    case 'ticket':
      block3d(c, s, '#3a5a8c', '#2a4570', 12);
      c.fillStyle = '#7ff0b0'; c.fillRect(x + 8, y + 8, w - 16, 8);
      break;
    case 'brick': {
      block3d(c, s, '#8a4b3a', '#6b3a2c', 14);
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5;
      for (let yy = y + 8; yy < y + h - 14; yy += 10) { c.beginPath(); c.moveTo(x + 3, yy); c.lineTo(x + w - 3, yy); c.stroke(); }
      break;
    }
    case 'stall': {
      // comptoir de Dédé : bâche rayée + étagères
      rr(c, x, y, w, h, 6); fs(c, '#7a5230', 3);
      c.save(); c.beginPath(); c.roundRect(x - 10, y - 46, w + 20, 34, 6); c.clip();
      for (let k = 0; k < w + 20; k += 34) { c.fillStyle = (k / 34) % 2 ? '#fff8ea' : '#e3262f'; c.fillRect(x - 10 + k, y - 46, 34, 34); }
      c.restore(); rr(c, x - 10, y - 46, w + 20, 34, 6); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
      c.fillStyle = INK; c.font = '22px Bungee, Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#fff8ea'; c.strokeStyle = INK; c.lineWidth = 5; c.strokeText('CHEZ DÉDÉ', x + w / 2, y - 29); c.fillText('CHEZ DÉDÉ', x + w / 2, y - 29);
      for (let k = 0; k < 6; k++) { rr(c, x + 20 + k * (w - 40) / 6, y + 10, 30, 22, 3); fs(c, ['#5c6b3a', '#d64545', '#2b8cff', '#ffc531', '#b0793f', '#8d96a3'][k], 2); }
      break;
    }
    case 'vault': {
      rr(c, x, y, w, h, 8); fs(c, '#3a3f4b', 3.5);
      c.strokeStyle = '#ffc531'; c.lineWidth = 6; c.setLineDash([16, 12]); c.strokeRect(x + 8, y + 8, w - 16, h - 16); c.setLineDash([]);
      break;
    }
    case 'pipe':
      rr(c, x, y, w, h, h / 2); fs(c, '#6f8492', 3);
      c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 2; for (let k = 20; k < w; k += 40) { c.beginPath(); c.moveTo(x + k, y + 3); c.lineTo(x + k, y + h - 3); c.stroke(); }
      circ(c, x + w / 2, y + h / 2, 10); fs(c, '#d64545', 2.5);
      break;
    default:
      block3d(c, s, th.cap, th.wall, 14);
  }
}

function paintWalls(c, lv, th, rng) {
  const W = lv.w, H = lv.h;
  // dessus des murs latéraux et du bas
  c.fillStyle = th.cap;
  c.fillRect(0, 0, WALL_SIDE, H); c.fillRect(W - WALL_SIDE, 0, WALL_SIDE, H); c.fillRect(0, H - WALL_BOTTOM, W, WALL_BOTTOM);
  // mur du haut : bandeau supérieur + face avant (relief)
  c.fillStyle = th.cap; c.fillRect(0, 0, W, 26);
  const g = c.createLinearGradient(0, 26, 0, WALL_TOP);
  g.addColorStop(0, shade(th.wall, 0.12)); g.addColorStop(1, shade(th.wall, -0.2));
  c.fillStyle = g; c.fillRect(WALL_SIDE, 26, W - WALL_SIDE * 2, WALL_TOP - 26);
  // décor de la face avant selon le secteur
  if (th.street) {
    // façades niçoises : volets et vitrines
    for (let x = WALL_SIDE + 20; x < W - WALL_SIDE - 40; x += 90) {
      rr(c, x, 30, 22, 30, 2); fs(c, '#3a8a7a', 2); rr(c, x + 28, 30, 22, 30, 2); fs(c, '#3a8a7a', 2);
      c.fillStyle = '#e3a06a'; c.fillRect(x + 56, 30, 24, 4);
    }
  } else if (th.metro) {
    for (let y = 28; y < WALL_TOP; y += 10) for (let x = WALL_SIDE + ((y / 10) % 2) * 10; x < W - WALL_SIDE; x += 20) { c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; c.strokeRect(x, y, 20, 10); }
    c.fillStyle = '#3a5a8c'; c.fillRect(WALL_SIDE, 46, W - WALL_SIDE * 2, 12);
    c.fillStyle = '#fff8ea'; c.font = '11px Bungee, Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let x = WALL_SIDE + 200; x < W - WALL_SIDE; x += 500) c.fillText('GARIBALDI', x, 52);
  } else if (th.brick) {
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1.5;
    for (let y = 28; y < WALL_TOP; y += 11) { c.beginPath(); c.moveTo(WALL_SIDE, y); c.lineTo(W - WALL_SIDE, y); c.stroke(); for (let x = WALL_SIDE + ((y / 11) % 2) * 15; x < W - WALL_SIDE; x += 30) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 11); c.stroke(); } }
  } else if (th.hosp) {
    c.fillStyle = '#e8eef2'; c.fillRect(WALL_SIDE, 28, W - WALL_SIDE * 2, 22);
    c.strokeStyle = '#c9ced6'; c.lineWidth = 5; c.beginPath(); c.moveTo(WALL_SIDE, 56); c.lineTo(W - WALL_SIDE, 56); c.stroke();
  } else {
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2;
    for (let x = WALL_SIDE + 60; x < W - WALL_SIDE; x += 120) { c.beginPath(); c.moveTo(x, 28); c.lineTo(x, WALL_TOP - 2); c.stroke(); }
    c.strokeStyle = shade(th.cap, 0.25); c.lineWidth = 5; c.beginPath(); c.moveTo(WALL_SIDE, 40); c.lineTo(W - WALL_SIDE, 40); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
  }
  // contours
  c.strokeStyle = INK; c.lineWidth = 3;
  c.strokeRect(WALL_SIDE, WALL_TOP, W - WALL_SIDE * 2, H - WALL_TOP - WALL_BOTTOM);
  c.beginPath(); c.moveTo(WALL_SIDE, 26); c.lineTo(W - WALL_SIDE, 26); c.stroke();
  c.strokeRect(1.5, 1.5, W - 3, H - 3);
  // découpe des portes dans le mur du haut
  for (const d of lv.doors) {
    if (d.side !== 'top') continue;
    c.fillStyle = '#0d0f13'; c.fillRect(d.x, 0, d.w, WALL_TOP);
    c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(d.x, 0, d.w, WALL_TOP);
  }
  // rivets
  c.fillStyle = 'rgba(0,0,0,.35)';
  for (let x = 20; x < W; x += 60) { circ(c, x, 13, 2.2); c.fill(); circ(c, x, H - 22, 2.2); c.fill(); }
  for (let y = 60; y < H; y += 60) { circ(c, 20, y, 2.2); c.fill(); circ(c, W - 20, y, 2.2); c.fill(); }
  // appliques lumineuses
  for (const l of lv.lamps) {
    rr(c, l.x - 16, l.y - 8, 32, 12, 4); fs(c, '#2a2d36', 2.4);
    rr(c, l.x - 12, l.y - 5, 24, 6, 3); c.fillStyle = th.lamp; c.fill();
  }
}
