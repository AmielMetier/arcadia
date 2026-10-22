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
  if (th.concrete) {
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
  // panneaux et tuyaux sur la face avant
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2;
  for (let x = WALL_SIDE + 60; x < W - WALL_SIDE; x += 120) { c.beginPath(); c.moveTo(x, 28); c.lineTo(x, WALL_TOP - 2); c.stroke(); }
  c.strokeStyle = shade(th.cap, 0.25); c.lineWidth = 5; c.beginPath(); c.moveTo(WALL_SIDE, 40); c.lineTo(W - WALL_SIDE, 40); c.stroke();
  c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
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
