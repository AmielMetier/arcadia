// Cinématiques d'Outbreak (canvas) : intro avec l'escouade et les noms des joueurs, fin (extraction ou fin de transmission).
import { drawSurvivor, drawZombie, INK, shade, circ, ell, rr, fs } from './sprites.js';
import { CLASSES, SECTORS } from '../engine/data.js';

const ease = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function text(c, s, x, y, size, color, font = 'Bungee, Impact, sans-serif', stroke = 6, align = 'center') {
  c.font = `${size}px ${font}`; c.textAlign = align; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = stroke; c.strokeStyle = INK; c.strokeText(s, x, y);
  c.fillStyle = color; c.fillText(s, x, y);
}

// ---------------------------------------------------------------- décors
function sky(c, W, H, top, bottom) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

function stars(c, W, H, t, a = 1) {
  c.fillStyle = `rgba(255,248,234,${0.7 * a})`;
  for (let i = 0; i < 70; i++) {
    const x = (i * 137.5) % W, y = (i * 71.3) % (H * 0.55);
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
    c.globalAlpha = a * (0.3 + 0.7 * tw); c.fillRect(x, y, 2, 2);
  }
  c.globalAlpha = 1;
}

// silhouette de la ville / du secteur sur l'horizon
function skyline(c, W, H, sector, t, light = 0) {
  const base = H * 0.72;
  const col = shade('#141821', light * 0.5);
  c.fillStyle = col;
  if (sector === 'nice') {
    // collines du Château + Baie des Anges + palmiers de la Promenade
    c.beginPath(); c.moveTo(0, base); c.quadraticCurveTo(W * 0.15, base - 120, W * 0.32, base - 40);
    c.lineTo(W * 0.32, base); c.closePath(); c.fill();
    for (let x = W * 0.3; x < W; x += 46) { const h = 40 + ((x * 13) % 70); c.fillRect(x, base - h, 38, h); }
    c.fillStyle = shade('#1c3a5a', light * 0.6); c.fillRect(0, base, W, H - base);
    c.strokeStyle = `rgba(255,220,150,${0.25 + light * 0.3})`; c.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const y = base + 12 + i * 10; c.beginPath(); c.moveTo((i * 97 + t * 20) % W, y); c.lineTo(((i * 97 + t * 20) % W) + 60, y); c.stroke(); }
    for (let x = 40; x < W; x += 140) palmSil(c, x, base, col);
  } else if (sector === 'hospital') {
    for (let x = 0; x < W; x += 70) { const h = 60 + ((x * 7) % 90); c.fillRect(x, base - h, 64, h); }
    rr(c, W * 0.55, base - 230, 220, 230, 4); c.fill();
    c.fillStyle = '#e3262f'; c.fillRect(W * 0.55 + 98, base - 210, 24, 70); c.fillRect(W * 0.55 + 75, base - 187, 70, 24);
    windows(c, W * 0.55 + 14, base - 130, 190, 120, t);
  } else if (sector === 'metro') {
    for (let x = 0; x < W; x += 60) { const h = 80 + ((x * 11) % 140); c.fillRect(x, base - h, 54, h); windows(c, x + 6, base - h + 10, 42, h - 20, t + x); }
    c.fillStyle = '#3a5a8c'; rr(c, W * 0.2, base - 40, 60, 40, 6); c.fill(); text(c, 'M', W * 0.2 + 30, base - 20, 24, '#fff8ea', 'Bungee, Impact, sans-serif', 4);
  } else if (sector === 'sewers') {
    for (let x = 0; x < W; x += 80) { const h = 50 + ((x * 5) % 110); c.fillRect(x, base - h, 74, h); }
    c.fillStyle = shade('#2f4a3e', light * 0.4); c.fillRect(0, base, W, H - base);
    ell(c, W * 0.5, base + 40, 70, 18); c.fillStyle = '#59616d'; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
  } else {
    // labo : complexe industriel, cheminées, gyrophares
    for (let x = 0; x < W; x += 90) { const h = 50 + ((x * 3) % 60); c.fillRect(x, base - h, 86, h); }
    for (const fx of [0.2, 0.6, 0.8]) { c.fillRect(W * fx, base - 220, 26, 220); }
    rr(c, W * 0.38, base - 150, 240, 150, 6); c.fill();
    const on = Math.sin(t * 6) > 0;
    for (const fx of [0.2, 0.6, 0.8]) { c.fillStyle = on ? '#ff4b2b' : '#5a1a10'; circ(c, W * fx + 13, base - 226, 6); c.fill(); }
    c.fillStyle = '#ffc531'; for (let k = 0; k < 8; k++) c.fillRect(W * 0.38 + 10 + k * 30, base - 18, 16, 8);
  }
  c.fillStyle = shade('#0b0d12', light * 0.4); c.fillRect(0, H * 0.86, W, H);
}

function palmSil(c, x, base, col) {
  c.strokeStyle = col; c.lineWidth = 6; c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x + 8, base - 60, x + 4, base - 110); c.stroke();
  c.fillStyle = col;
  for (let k = 0; k < 6; k++) { const a = Math.PI + (k / 5) * Math.PI; c.beginPath(); c.moveTo(x + 4, base - 110); c.quadraticCurveTo(x + 4 + Math.cos(a) * 30, base - 125 + Math.sin(a) * 10, x + 4 + Math.cos(a) * 55, base - 100 + Math.abs(Math.sin(a)) * 10); c.lineTo(x + 4 + Math.cos(a) * 45, base - 104); c.closePath(); c.fill(); }
}

function windows(c, x, y, w, h, t) {
  for (let yy = y; yy < y + h - 12; yy += 18) for (let xx = x; xx < x + w - 10; xx += 16) {
    const on = Math.sin(xx * 3.1 + yy * 1.7 + Math.floor(t * 0.5)) > 0.6;
    c.fillStyle = on ? 'rgba(255,214,140,.8)' : 'rgba(20,24,33,1)'; c.fillRect(xx, yy, 9, 11);
  }
}

// hélicoptère cartoon (vu de profil)
export function heli(c, x, y, t, s = 1, light = true) {
  c.save(); c.translate(x, y); c.scale(s, s);
  if (light) {
    const g = c.createLinearGradient(0, 20, 0, 420);
    g.addColorStop(0, 'rgba(255,248,200,.35)'); g.addColorStop(1, 'rgba(255,248,200,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(-10, 20); c.lineTo(10, 20); c.lineTo(120, 420); c.lineTo(-90, 420); c.closePath(); c.fill();
  }
  // queue
  rr(c, -130, -14, 110, 16, 8); fs(c, '#3a4a3a', 3);
  rr(c, -150, -38, 26, 34, 6); fs(c, '#3a4a3a', 3);
  // cabine
  ell(c, 0, 0, 62, 34); fs(c, '#4f6a4f', 3.5);
  c.beginPath(); c.moveTo(20, -26); c.quadraticCurveTo(58, -18, 58, 6); c.lineTo(22, 6); c.closePath(); fs(c, '#9fd8ff', 2.5);
  rr(c, -36, -16, 40, 26, 4); fs(c, '#2a3a2a', 2.5);
  // patins
  c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(-40, 40); c.lineTo(46, 40); c.moveTo(-24, 32); c.lineTo(-24, 40); c.moveTo(30, 32); c.lineTo(30, 40); c.stroke();
  // rotor
  rr(c, -6, -46, 12, 14, 3); fs(c, '#2a2d36', 2.5);
  const k = Math.abs(Math.sin(t * 40));
  c.fillStyle = 'rgba(30,32,38,.75)'; rr(c, -110 * k - 10, -50, 220 * k + 20, 6, 3); c.fill();
  c.fillStyle = 'rgba(30,32,38,.35)'; rr(c, -110, -50, 220, 6, 3); c.fill();
  const r2 = Math.sin(t * 50) * 22; c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(-137, -21 - r2); c.lineTo(-137, -21 + r2); c.stroke();
  c.restore();
}

// ---------------------------------------------------------------- intro (≈ 12,5 s)
export const INTRO_LEN = 12.5;
// repères sonores : [instant, son]
export function introCues(n) {
  const cues = [[0.05, 'static'], [0.6, 'beep'], [1.2, 'beep'], [2.2, 'mapPing'], [3.3, 'mapPing'], [4.3, 'whoosh'], [4.5, 'heli'], [5.5, 'thunder'], [10.5, 'titleHit'], [11.4, 'beep'], [11.8, 'beep'], [12.2, 'beepHi']];
  for (let i = 0; i < n; i++) cues.push([SQUAD_T0 + i * SQUAD_DT + 0.35, 'slam']);
  return cues;
}
const SQUAD_T0 = 7.0, SQUAD_DT = 0.6;
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const SECTOR_POS = { lab: [0.40, 0.36, 'SOPHIA-ANTIPOLIS'], sewers: [0.66, 0.50, 'NICE · PAILLON'], hospital: [0.64, 0.42, 'NICE · PASTEUR'], metro: [0.63, 0.47, 'NICE · GARIBALDI'], nice: [0.61, 0.53, 'NICE · PROMENADE'] };

function grainAndBars(c, W, H, t, bars = 1) {
  // grain
  c.globalAlpha = 0.06;
  for (let i = 0; i < 220; i++) { c.fillStyle = rnd(i + Math.floor(t * 24) * 7) > 0.5 ? '#fff' : '#000'; c.fillRect(rnd(i * 3 + t) * W, rnd(i * 5 + t * 2) * H, 2, 2); }
  c.globalAlpha = 1;
  // vignette
  const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.65)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  // bandes cinéma
  const bh = H * 0.09 * bars;
  c.fillStyle = '#000'; c.fillRect(0, 0, W, bh); c.fillRect(0, H - bh, W, bh);
}

function typeLines(c, lines, t0, t, x, y, size, color) {
  c.font = `700 ${size}px "Chakra Petch", monospace`; c.textAlign = 'left'; c.textBaseline = 'top';
  let tt = t - t0;
  lines.forEach((L, i) => {
    const n = Math.max(0, Math.min(L.length, Math.floor(tt * 60)));
    tt -= L.length / 60 + 0.12;
    if (n <= 0) return;
    c.fillStyle = i === 0 ? '#f2b51d' : color;
    c.fillText(L.slice(0, n) + (n < L.length && Math.sin(t * 30) > 0 ? '█' : ''), x, y + i * size * 1.5);
  });
}

// --- A : transmission
function sceneTransmission(c, W, H, t, d) {
  c.fillStyle = '#05060a'; c.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 3) { c.fillStyle = 'rgba(40,255,140,.025)'; c.fillRect(0, y, W, 1); }
  // barres de parasites
  if (t < 0.5 || (t > 1.6 && t < 1.75)) for (let i = 0; i < 18; i++) { c.fillStyle = `rgba(255,255,255,${rnd(i + t * 50) * 0.25})`; c.fillRect(0, rnd(i * 7 + t * 9) * H, W, rnd(i) * 14); }
  const s = Math.min(W / 1280, H / 720);
  const S = SECTORS[d.sector] || SECTORS.lab;
  typeLines(c, [
    '>> TRANSMISSION ENTRANTE — CANAL SÉCURISÉ 7',
    '>> ÉMETTEUR : CDT MOREAU, CELLULE DE CRISE CÔTE D\'AZUR',
    '>> ALERTE NIVEAU 5 : SOUCHE VIREO HORS DE CONTRÔLE',
    `>> ZONE D'INTERVENTION : ${S.name.toUpperCase()}`,
    '>> ESCOUADE DELTA : DÉPLOIEMENT IMMÉDIAT',
  ], 0.25, t, W * 0.12, H * 0.3, Math.round(20 * s), '#7ff0b0');
  // onde radio
  c.strokeStyle = 'rgba(127,240,176,.6)'; c.lineWidth = 2; c.beginPath();
  for (let x = 0; x < W * 0.3; x += 4) { const y = H * 0.72 + Math.sin(x * 0.08 + t * 20) * 14 * rnd(Math.floor(x / 20) + Math.floor(t * 12)); x ? c.lineTo(W * 0.12 + x, y) : c.moveTo(W * 0.12, y); }
  c.stroke();
}

// --- B : carte tactique de la Côte d'Azur
function sceneMap(c, W, H, t, d) {
  const k = clamp01((t - 2.0) / 2.6);
  const [px, py, label] = SECTOR_POS[d.sector] || SECTOR_POS.lab;
  const zoom = 1 + ease(clamp01((t - 3.6) / 1.0)) * 2.4;
  c.save();
  c.fillStyle = '#081420'; c.fillRect(0, 0, W, H);
  c.translate(W * px, H * py); c.scale(zoom, zoom); c.translate(-W * px, -H * py);
  // mer
  c.fillStyle = '#0c2238'; c.fillRect(0, 0, W, H);
  // terre (côte stylisée : Cannes → Menton)
  c.fillStyle = '#16241c'; c.strokeStyle = '#3fa36b'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, H * 0.48);
  const coast = [[1, 0.48], [0.9, 0.5], [0.82, 0.47], [0.76, 0.52], [0.68, 0.5], [0.62, 0.57], [0.56, 0.6], [0.5, 0.58], [0.44, 0.64], [0.36, 0.6], [0.28, 0.66], [0.2, 0.63], [0.1, 0.68], [0, 0.66]];
  for (const [x, y] of coast) c.lineTo(W * x, H * y);
  c.closePath(); c.fill(); c.stroke();
  // quadrillage
  c.strokeStyle = 'rgba(63,163,107,.18)'; c.lineWidth = 1;
  for (let x = 0; x < W; x += W / 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y < H; y += H / 9) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  // contamination qui s'étend depuis Sophia-Antipolis
  for (let i = 0; i < 16; i++) {
    const sx = 0.4 + (rnd(i) - 0.5) * 0.5 * k, sy = 0.38 + (rnd(i + 9) - 0.3) * 0.25 * k, r = (14 + rnd(i + 3) * 60) * k * (0.6 + 0.4 * Math.sin(t * 3 + i));
    const g = c.createRadialGradient(W * sx, H * sy, 0, W * sx, H * sy, r);
    g.addColorStop(0, 'rgba(255,60,40,.55)'); g.addColorStop(1, 'rgba(255,60,40,0)'); c.fillStyle = g; c.fillRect(W * sx - r, H * sy - r, r * 2, r * 2);
  }
  // villes
  c.font = '700 12px "Chakra Petch", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
  for (const [n, x, y] of [['CANNES', 0.2, 0.6], ['ANTIBES', 0.36, 0.56], ['SOPHIA', 0.4, 0.36], ['NICE', 0.62, 0.5], ['MONACO', 0.82, 0.44], ['MENTON', 0.92, 0.46]]) {
    c.fillStyle = '#eef0f2'; c.beginPath(); c.arc(W * x, H * y, 3.5, 0, Math.PI * 2); c.fill(); c.fillText(n, W * x + 8, H * y);
  }
  c.restore();
  // réticule de visée qui verrouille le secteur (repère écran)
  const cx = W * px + (W / 2 - W * px) * ease(clamp01((t - 3.6) / 1.0)), cy = H * py + (H / 2 - H * py) * ease(clamp01((t - 3.6) / 1.0));
  const lock = clamp01((t - 2.6) / 0.9), R = 120 - 70 * ease(lock);
  c.strokeStyle = '#ff4b2b'; c.lineWidth = 2.5;
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + t * (1 - lock) * 2; c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12)); c.lineTo(cx + Math.cos(a) * (R + 16), cy + Math.sin(a) * (R + 16)); c.stroke(); }
  if (lock >= 1) {
    c.font = '700 16px "Chakra Petch", sans-serif'; c.textAlign = 'left'; c.fillStyle = '#ff4b2b';
    if (Math.sin(t * 16) > -0.3) c.fillText('CIBLE VERROUILLÉE · ' + label, cx + R + 22, cy - 8);
    c.fillStyle = '#eef0f2'; c.fillText(`INFECTION ${Math.min(97, Math.round(40 + (t - 2) * 22))} %`, cx + R + 22, cy + 14);
  }
  // HUD carte
  c.font = '700 13px "Chakra Petch", monospace'; c.textAlign = 'left'; c.fillStyle = '#3fa36b';
  c.fillText(`SAT-04 · 43°42'N 7°15'E · ${new Date(0, 0, 1, 3, Math.floor(t * 7)).toTimeString().slice(0, 5)}`, 24, H * 0.13);
}

// --- C : plongée en hélico au-dessus de la ville en flammes
function sceneDive(c, W, H, t, d) {
  const tt = t - 4.3, sec = SECTORS[d.sector] ? d.sector : 'lab';
  const s = Math.min(W / 1280, H / 720);
  sky(c, W, H, '#0a0d18', '#3a1410');
  // éclair
  const bolt = t > 5.45 && t < 5.75;
  if (bolt) { c.fillStyle = `rgba(220,230,255,${0.6 * (1 - (t - 5.45) / 0.3)})`; c.fillRect(0, 0, W, H); }
  stars(c, W, H, t, 0.5);
  // lueur des incendies
  const glow = c.createRadialGradient(W * 0.5, H * 0.95, 20, W * 0.5, H * 0.95, W * 0.8);
  glow.addColorStop(0, 'rgba(255,120,40,.55)'); glow.addColorStop(1, 'rgba(255,60,20,0)'); c.fillStyle = glow; c.fillRect(0, 0, W, H);
  // ville qui monte (on descend)
  const rise = (1 - ease(clamp01(tt / 1.6))) * H * 0.5;
  c.save(); c.translate(0, rise);
  skyline(c, W, H, sec, t, 0.05);
  // colonnes de fumée et flammes
  for (let i = 0; i < 6; i++) {
    const x = W * (0.1 + i * 0.16 + rnd(i) * 0.05), base = H * 0.72;
    for (let k = 0; k < 9; k++) {
      const yy = base - ((t * 70 + k * 40 + i * 13) % 360), rr2 = 20 + k * 6;
      c.fillStyle = `rgba(30,26,26,${0.35 * (1 - k / 9)})`; c.beginPath(); c.arc(x + Math.sin(t + k + i) * 14, yy, rr2, 0, Math.PI * 2); c.fill();
    }
    const f = c.createRadialGradient(x, base, 0, x, base, 50); f.addColorStop(0, 'rgba(255,200,80,.9)'); f.addColorStop(1, 'rgba(255,80,20,0)'); c.fillStyle = f; c.fillRect(x - 50, base - 50, 100, 100);
  }
  // projecteurs qui balaient
  for (let i = 0; i < 3; i++) {
    const x = W * (0.2 + i * 0.3), a = -Math.PI / 2 + Math.sin(t * 0.9 + i * 2) * 0.5;
    const g = c.createLinearGradient(x, H * 0.72, x + Math.cos(a) * H, H * 0.72 + Math.sin(a) * H);
    g.addColorStop(0, 'rgba(255,248,210,.22)'); g.addColorStop(1, 'rgba(255,248,210,0)'); c.fillStyle = g;
    c.beginPath(); c.moveTo(x, H * 0.72); c.lineTo(x + Math.cos(a - 0.06) * H * 1.2, H * 0.72 + Math.sin(a - 0.06) * H * 1.2); c.lineTo(x + Math.cos(a + 0.06) * H * 1.2, H * 0.72 + Math.sin(a + 0.06) * H * 1.2); c.closePath(); c.fill();
  }
  // la horde dans les rues
  for (let i = 0; i < 70; i++) {
    const x = ((rnd(i) * W * 1.2 + t * (20 + rnd(i + 1) * 25)) % (W * 1.2)) - W * 0.1, y = H * (0.86 + rnd(i + 2) * 0.12), sz = 4 + rnd(i + 4) * 4;
    c.fillStyle = '#060608'; c.beginPath(); c.arc(x, y - sz * 2.2, sz * 0.7, 0, Math.PI * 2); c.fill(); c.fillRect(x - sz * 0.5, y - sz * 1.6, sz, sz * 1.8);
    c.fillStyle = 'rgba(255,90,60,.8)'; c.fillRect(x - 1, y - sz * 2.3, 1.5, 1.5);
  }
  c.restore();
  // braises
  for (let i = 0; i < 60; i++) { const x = (rnd(i) * W + Math.sin(t + i) * 20) % W, y = H - ((t * (60 + rnd(i + 7) * 80) + rnd(i + 3) * H) % H); c.fillStyle = `rgba(255,${150 + rnd(i) * 80 | 0},60,${0.4 + rnd(i + 2) * 0.5})`; c.fillRect(x, y, 2, 2); }
  // nuages qui défilent vers le haut (on les traverse)
  const cl = clamp01(1 - tt / 1.0);
  if (cl > 0) for (let i = 0; i < 14; i++) {
    const y = H * (1.2 - ((tt * 1.6 + rnd(i)) % 1.4)), x = rnd(i + 5) * W, r = (120 + rnd(i + 2) * 200) * s;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(120,110,120,${0.45 * cl})`); g.addColorStop(0.6, `rgba(110,90,95,${0.2 * cl})`); g.addColorStop(1, 'rgba(110,90,95,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // l'hélico au premier plan, qui s'incline en traversant
  const hx = -260 * s + ease(clamp01(tt / 2.4)) * (W * 0.62 + 260 * s), hy = H * 0.34 + Math.sin(t * 2) * 8;
  c.save(); c.translate(hx, hy); c.rotate(-0.12 + 0.12 * ease(clamp01(tt / 2.4))); heli(c, 0, 0, t, 1.9 * s); c.restore();
  if (bolt) {
    c.strokeStyle = '#f0f4ff'; c.lineWidth = 3; c.beginPath(); let x = W * 0.78, y = 0; c.moveTo(x, y);
    for (let k = 0; k < 9; k++) { x += (rnd(k + 40) - 0.5) * 80; y += H * 0.08; c.lineTo(x, y); }
    c.stroke();
  }
}

// --- D : l'escouade descend en rappel ; chaque nom s'écrase à l'écran
function sceneSquad(c, W, H, t, d) {
  const s = Math.min(W / 1280, H / 720);
  const sec = SECTORS[d.sector] ? d.sector : 'lab';
  // décor : rue sombre vue de face + hélico stationnaire
  sky(c, W, H, '#0b0e1a', '#2a1212');
  skyline(c, W, H, sec, t, 0);
  c.fillStyle = '#0c0d10'; c.fillRect(0, H * 0.8, W, H);
  const hx = W / 2, hy = H * 0.2 + Math.sin(t * 2.2) * 5;
  // vent du rotor : poussière
  for (let i = 0; i < 40; i++) { const a = rnd(i) * Math.PI, r = ((t * 220 + rnd(i + 1) * 400) % 420); c.fillStyle = `rgba(160,150,130,${0.25 * (1 - r / 420)})`; c.beginPath(); c.arc(hx + Math.cos(a) * r * (rnd(i) > 0.5 ? 1 : -1), H * 0.8 - Math.sin(a) * r * 0.15, 6 + r * 0.04, 0, Math.PI * 2); c.fill(); }
  const n = d.squad.length;
  const cw = Math.min(230 * s, (W - 60) / Math.max(1, n) - 14), gap = 14, total = n * cw + (n - 1) * gap, x0 = (W - total) / 2;
  // cordes et survivants
  d.squad.forEach((m, i) => {
    const t0 = SQUAD_T0 + i * SQUAD_DT, k = clamp01((t - t0) / 0.4);
    const rx = hx + (i - (n - 1) / 2) * 34 * s;
    c.strokeStyle = 'rgba(200,190,170,.75)'; c.lineWidth = 2; c.beginPath(); c.moveTo(rx, hy + 30 * s); c.lineTo(rx, H * 0.8); c.stroke();
    if (t < t0) return;
    const y = hy + 40 * s + (H * 0.8 - 20 - hy - 40 * s) * ease(k);
    c.save(); c.translate(rx, y); c.scale(1.7 * s, 1.7 * s);
    drawSurvivor(c, { id: i + 3, color: m.color, clsColor: CLASSES[m.cls]?.color, a: -Math.PI / 2, move: Math.PI / 2, walk: 0, speed: 0, state: 0, weapon: m.weapon || 'pistol' }, t);
    c.restore();
    if (k >= 1 && t - t0 < 0.9) { c.fillStyle = `rgba(180,170,150,${0.5 * (1 - (t - t0 - 0.4) / 0.5)})`; ell(c, rx, H * 0.8, 40 * s * (1 + (t - t0)), 10 * s); c.fill(); }
  });
  heli(c, hx, hy, t, 1.5 * s, false);
  // bandeau des cartes de l'escouade
  const top = H * 0.46;
  d.squad.forEach((m, i) => {
    const t0 = SQUAD_T0 + i * SQUAD_DT + 0.3, k = clamp01((t - t0) / 0.28);
    if (k <= 0) return;
    const C = CLASSES[m.cls] || CLASSES.soldier;
    const x = x0 + i * (cw + gap), h = 150 * s;
    const sc = 1 + (1 - ease(k)) * 1.2;
    c.save(); c.globalAlpha = k; c.translate(x + cw / 2, top + h / 2); c.scale(sc, sc); c.rotate((1 - k) * (i % 2 ? 0.2 : -0.2)); c.translate(-cw / 2, -h / 2);
    // carte métal
    rr(c, 0, 0, cw, h, 6); c.fillStyle = 'rgba(20,23,29,.92)'; c.fill(); c.strokeStyle = '#000'; c.lineWidth = 2; c.stroke();
    c.fillStyle = m.color; c.fillRect(0, 0, cw, 7);
    c.fillStyle = C.color; c.fillRect(0, h - 5, cw, 5);
    // numéro de matricule
    c.font = `700 ${Math.round(11 * s)}px "Chakra Petch", monospace`; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = '#6b7380';
    c.fillText(`DELTA-0${i + 1}`, 10, 14);
    if (m.me) { c.textAlign = 'right'; c.fillStyle = '#f2b51d'; c.fillText('TOI', cw - 10, 14); }
    else if (m.bot) { c.textAlign = 'right'; c.fillText('IA', cw - 10, 14); }
    // nom en très grand
    let fsz = Math.round(Math.min(34 * s, (cw - 16) / Math.max(4, m.name.length) * 1.55));
    text(c, m.name.toUpperCase(), cw / 2, h * 0.44, fsz, m.color, undefined, Math.max(4, fsz / 6));
    c.font = `700 ${Math.round(14 * s)}px "Chakra Petch", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = C.color;
    c.fillText(C.name.toUpperCase(), cw / 2, h * 0.68);
    c.fillStyle = '#9aa3b0'; c.font = `600 ${Math.round(12 * s)}px "Chakra Petch", sans-serif`; c.fillText(C.active, cw / 2, h * 0.84);
    c.restore();
    // éclair blanc à l'impact
    if (t - t0 > 0.26 && t - t0 < 0.4) { c.fillStyle = `rgba(255,255,255,${0.35 * (1 - (t - t0 - 0.26) / 0.14)})`; c.fillRect(0, 0, W, H); }
  });
  c.font = `${Math.round(18 * s)}px Bungee, Impact, sans-serif`; c.textAlign = 'center'; c.fillStyle = '#f2b51d';
  if (t > SQUAD_T0 - 0.2) c.fillText('ESCOUADE DELTA · DÉPLOIEMENT', W / 2, top - 26 * s);
}

// --- E : titre fissuré + compte à rebours
function sceneTitle(c, W, H, t, d) {
  const s = Math.min(W / 1280, H / 720), tt = t - 10.4;
  c.fillStyle = '#07060a'; c.fillRect(0, 0, W, H);
  const pulse = 0.5 + 0.5 * Math.sin(t * 8);
  const g = c.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.45, W * 0.6);
  g.addColorStop(0, `rgba(160,20,20,${0.45 + 0.15 * pulse})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const k = ease(clamp01(tt / 0.25)), sc = 1 + (1 - k) * 2.5;
  c.save(); c.translate(W / 2 + (tt < 0.5 ? (rnd(Math.floor(t * 60)) - 0.5) * 16 : 0), H * 0.42); c.scale(sc, sc); c.globalAlpha = k;
  text(c, 'OUTBREAK', 0, 0, Math.round(120 * s), '#ff4b2b', undefined, 14 * s);
  // fissures
  if (tt > 0.2) {
    c.strokeStyle = '#07060a'; c.lineWidth = 3 * s;
    for (let i = 0; i < 6; i++) { let x = (rnd(i + 60) - 0.5) * 520 * s, y = -50 * s; c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (rnd(i * 9 + j) - 0.5) * 50 * s; y += 22 * s; c.lineTo(x, y); } c.stroke(); }
  }
  c.restore();
  const S = SECTORS[d.sector] || SECTORS.lab;
  c.globalAlpha = clamp01((tt - 0.3) / 0.3);
  c.font = `${Math.round(24 * s)}px Bungee, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#eef0f2';
  c.fillText(S.name.toUpperCase(), W / 2, H * 0.42 + 90 * s);
  c.font = `600 ${Math.round(17 * s)}px "Chakra Petch", sans-serif`; c.fillStyle = '#c9ced6';
  const m = d.mission || ''; c.fillText(m.slice(0, Math.floor((tt - 0.4) * 70)), W / 2, H * 0.42 + 130 * s);
  c.globalAlpha = 1;
  // compte à rebours
  const cd = 3 - Math.floor((tt - 1.0) / 0.4);
  if (tt > 1.0 && cd >= 1) {
    const f = ((tt - 1.0) % 0.4) / 0.4;
    c.globalAlpha = 1 - f; text(c, String(cd), W / 2, H * 0.78, Math.round((70 + f * 40) * s), '#f2b51d', undefined, 8 * s); c.globalAlpha = 1;
  }
}

// p = progression en secondes ; d = { sector, squad:[{ name, color, cls, me, bot, weapon }], mission, votes, total }
export function drawIntro(c, W, H, p, d) {
  const t = p;
  if (t < 2.2) sceneTransmission(c, W, H, t, d);
  else if (t < 4.4) sceneMap(c, W, H, t, d);
  else if (t < SQUAD_T0 - 0.1) sceneDive(c, W, H, t, d);
  else if (t < 10.4) sceneSquad(c, W, H, t, d);
  else sceneTitle(c, W, H, t, d);
  // fondus et flash entre les scènes
  for (const [at, col] of [[2.2, '0,0,0'], [4.4, '255,255,255'], [SQUAD_T0 - 0.1, '0,0,0'], [10.4, '255,255,255']]) {
    const dd = Math.abs(t - at);
    if (dd < 0.25) { c.fillStyle = `rgba(${col},${1 - dd / 0.25})`; c.fillRect(0, 0, W, H); }
  }
  // tremblement aux impacts
  grainAndBars(c, W, H, t, t > 10.4 ? 0.6 : 1);
  if (t > INTRO_LEN - 0.4) { c.fillStyle = `rgba(0,0,0,${clamp01((t - (INTRO_LEN - 0.4)) / 0.4)})`; c.fillRect(0, 0, W, H); }
  // passer
  c.font = '700 13px "Chakra Petch", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'alphabetic'; c.fillStyle = 'rgba(238,240,242,.7)';
  c.fillText(`ESPACE / CLIC : PASSER${d.total > 1 ? `  (${d.votes}/${d.total})` : ''}`, W - 20, H - 18);
}

// secousse de caméra pour l'intro (appliquée par l'appelant)
export function introShake(t, n) {
  let k = 0;
  for (let i = 0; i < n; i++) { const dt = t - (SQUAD_T0 + i * SQUAD_DT + 0.3); if (dt > 0 && dt < 0.25) k = Math.max(k, 1 - dt / 0.25); }
  if (t > 10.4 && t < 10.75) k = Math.max(k, 1.4 * (1 - (t - 10.4) / 0.35));
  if (t > 5.45 && t < 5.7) k = Math.max(k, 0.6);
  return k * 10;
}

// ---------------------------------------------------------------- fin
export function drawOutro(c, W, H, t, d) {
  const sec = SECTORS[d.sector] ? d.sector : 'lab';
  if (d.won) {
    // aube, l'hélico décolle avec l'escouade
    const dawn = clamp01(t / 4);
    sky(c, W, H, shade('#1a2440', dawn * 0.3), shade('#ff9a6a', -0.3 + dawn * 0.3));
    stars(c, W, H, t, 1 - dawn);
    const sunY = H * 0.75 - dawn * H * 0.15;
    circ(c, W * 0.5, sunY, 70); c.fillStyle = `rgba(255,200,120,${0.5 + dawn * 0.5})`; c.fill();
    skyline(c, W, H, sec, t, dawn);
    // les survivants montent
    const alive = d.squad.filter((m) => m.state !== 2);
    const hx = W * 0.5 + Math.max(0, t - 3.6) * 160, hy = H * 0.62 - Math.max(0, t - 3.0) * 80;
    heli(c, hx, hy, t, Math.min(1.4, W / 1000), false);
    alive.forEach((m, i) => {
      const k = clamp01((t - 0.3 - i * 0.35) / 2.0);
      if (k >= 1) return;
      const x = W * 0.12 + i * 40 + (hx - W * 0.12 - i * 40) * ease(k), y = H * 0.8 - (H * 0.8 - hy) * ease(k);
      c.save(); c.translate(x, y); c.scale(1.6, 1.6);
      drawSurvivor(c, { id: i + 3, color: m.color, a: 0, move: 0, walk: t * 10, speed: 1, state: 0, weapon: 'pistol' }, t);
      c.restore();
    });
    // zombies qui arrivent trop tard
    for (let i = 0; i < 5; i++) {
      const x = -60 + Math.max(0, t - 1) * 60 + i * 50, y = H * 0.84 + (i % 2) * 18;
      c.save(); c.translate(x, y); c.scale(1.5, 1.5); drawZombie(c, { id: i * 7 + 1, ty: i % 3 ? 'walker' : 'runner', a: 0, walk: t * 5 + i, flags: 0 }, t); c.restore();
    }
    const a = clamp01((t - 1.5) / 0.6);
    c.globalAlpha = a;
    text(c, 'EXTRACTION RÉUSSIE', W / 2, H * 0.16, Math.round(Math.min(56, W / 16)), '#7ff0b0', undefined, 9);
    c.font = `700 ${Math.round(Math.min(18, W / 50))}px "Chakra Petch", sans-serif`; c.textAlign = 'center'; c.fillStyle = '#fff8ea';
    c.fillText('Survivants : ' + (alive.map((m) => m.name).join(', ') || '—'), W / 2, H * 0.16 + 44);
    c.globalAlpha = 1;
  } else {
    // fin de transmission : les cartes de l'escouade se brouillent une à une
    sky(c, W, H, '#14070a', '#050307');
    const n = d.squad.length, cw = Math.min(170, (W - 60) / Math.max(1, n) - 12), gap = 12;
    const total = n * cw + (n - 1) * gap, x0 = (W - total) / 2;
    d.squad.forEach((m, i) => {
      const x = x0 + i * (cw + gap), y = H * 0.32, h = cw * 1.25;
      c.save(); c.translate(x, y);
      rr(c, 0, 0, cw, h, 12); fs(c, '#2a2d36', 3);
      c.save(); c.beginPath(); c.roundRect(5, 5, cw - 10, h * 0.7, 8); c.clip();
      c.fillStyle = '#16181d'; c.fillRect(5, 5, cw - 10, h * 0.7);
      c.translate(cw / 2, h * 0.38); c.scale(cw / 70, cw / 70);
      drawSurvivor(c, { id: i + 3, color: m.color, a: -Math.PI / 2, move: 0, walk: 0, speed: 0, state: 0, weapon: 'pistol', hurt: false }, t);
      c.restore();
      // neige
      const k = clamp01((t - 0.8 - i * 0.45) / 0.6);
      c.globalAlpha = k * 0.85;
      for (let j = 0; j < 140; j++) { c.fillStyle = Math.random() < 0.5 ? '#fff' : '#555'; c.fillRect(5 + Math.random() * (cw - 10), 5 + Math.random() * h * 0.7, 3, 2); }
      c.globalAlpha = 1;
      if (k > 0.5) { c.save(); c.translate(cw / 2, h * 0.38); c.rotate(-0.2); text(c, 'K.O.', 0, 0, Math.round(cw / 4), '#ff4b2b', undefined, 6); c.restore(); }
      c.font = `700 ${Math.round(Math.min(15, cw / 9))}px "Chakra Petch", sans-serif`; c.textAlign = 'center'; c.fillStyle = m.color; c.fillText(m.name, cw / 2, h * 0.85);
      c.restore();
    });
    const a = clamp01((t - 0.4) / 0.6);
    c.globalAlpha = a;
    text(c, 'FIN DE TRANSMISSION', W / 2, H * 0.18, Math.round(Math.min(52, W / 18)), '#ff4b2b', undefined, 9);
    c.globalAlpha = 1;
    // parasites plein écran
    c.globalAlpha = 0.06 + 0.06 * Math.sin(t * 30);
    for (let j = 0; j < 300; j++) { c.fillStyle = Math.random() < 0.5 ? '#fff' : '#000'; c.fillRect(Math.random() * W, Math.random() * H, 4, 2); }
    c.globalAlpha = 1;
  }
  if (t > (d.won ? 6.6 : 5.0)) { c.fillStyle = `rgba(0,0,0,${clamp01((t - (d.won ? 6.6 : 5.0)) / 0.6) * 0.6})`; c.fillRect(0, 0, W, H); }
}
