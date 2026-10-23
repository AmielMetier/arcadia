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

// ---------------------------------------------------------------- intro
// p = progression en secondes (0 → 9) ; squad = [{ name, color, cls, me }]
export function drawIntro(c, W, H, p, d) {
  const t = p;
  const sec = SECTORS[d.sector] ? d.sector : 'lab';
  const S = SECTORS[sec];
  sky(c, W, H, '#0b1020', sec === 'nice' ? '#2a2440' : '#1a1a26');
  stars(c, W, H, t);
  // lune
  circ(c, W * 0.82, H * 0.18, 34); c.fillStyle = '#fff1c1'; c.fill(); circ(c, W * 0.82 + 10, H * 0.18 - 6, 30); c.fillStyle = '#0d1222'; c.fill();
  skyline(c, W, H, sec, t);
  // hélico qui traverse
  const hx = -200 + ease(t / 3.2) * (W * 0.62 + 200) + Math.max(0, t - 3.2) * 18;
  heli(c, hx, H * 0.3 + Math.sin(t * 2) * 6, t, Math.min(1.3, W / 1100));

  // titre
  if (t < 3.4) {
    const a = clamp01(t / 0.5) * clamp01((3.4 - t) / 0.4);
    c.globalAlpha = a;
    const s = Math.min(1, W / 900);
    text(c, 'OUTBREAK', W / 2, H * 0.52, Math.round(78 * s), '#ff4b2b', undefined, 10);
    text(c, `${S.icon} ${S.name.toUpperCase()}`, W / 2, H * 0.52 + 62 * s, Math.round(26 * s), '#fff8ea', undefined, 6);
    c.globalAlpha = 1;
  }

  // l'escouade : une carte par joueur, qui glisse depuis la droite
  if (t > 3.0) {
    const a = clamp01((t - 3.0) / 0.4) * clamp01((8.6 - t) / 0.5);
    c.globalAlpha = a;
    c.fillStyle = 'rgba(5,6,10,.72)'; c.fillRect(0, H * 0.18, W, H * 0.64);
    c.strokeStyle = '#ffc531'; c.lineWidth = 6; c.setLineDash([22, 14]); c.beginPath(); c.moveTo(0, H * 0.18); c.lineTo(W, H * 0.18); c.moveTo(0, H * 0.82); c.lineTo(W, H * 0.82); c.stroke(); c.setLineDash([]);
    const n = d.squad.length, cw = Math.min(210, (W - 60) / Math.max(1, n) - 14), gap = 14;
    const total = n * cw + (n - 1) * gap, x0 = (W - total) / 2;
    text(c, 'ESCOUADE DELTA', W / 2, H * 0.24, Math.round(Math.min(34, W / 30)), '#ffc531', undefined, 6);
    d.squad.forEach((m, i) => {
      const k = ease((t - 3.3 - i * 0.32) / 0.5);
      if (k <= 0) return;
      const x = x0 + i * (cw + gap) + (1 - k) * (W * 0.6), y = H * 0.3, h = H * 0.44;
      c.save(); c.translate(x, y);
      rr(c, 0, 0, cw, h, 14); fs(c, '#fff8ea', 4);
      rr(c, 0, 0, cw, 14, 7); c.fillStyle = m.color; c.fill();
      // le survivant en grand
      c.save(); c.beginPath(); c.roundRect(6, 18, cw - 12, h * 0.55, 10); c.clip();
      c.fillStyle = shade(m.color, -0.55); c.fillRect(6, 18, cw - 12, h * 0.55);
      c.translate(cw / 2, 18 + h * 0.3); const sc = Math.min(3.2, cw / 60); c.scale(sc, sc);
      drawSurvivor(c, { id: i + 3, color: m.color, clsColor: CLASSES[m.cls]?.color, a: -Math.PI / 2 + Math.sin(t * 1.5 + i) * 0.15, move: -Math.PI / 2, walk: t * 4, speed: 0.4, state: 0, weapon: m.weapon || 'pistol' }, t);
      c.restore();
      const C = CLASSES[m.cls] || CLASSES.soldier;
      const nameSize = Math.round(Math.min(22, cw / 7.5));
      text(c, m.name.toUpperCase(), cw / 2, h * 0.7, nameSize, m.color, undefined, 5);
      c.font = `700 ${Math.round(Math.min(15, cw / 12))}px "Chakra Petch", sans-serif`; c.fillStyle = INK; c.textAlign = 'center';
      c.fillText(`${C.icon} ${C.name}`, cw / 2, h * 0.8);
      if (m.bot) { c.fillStyle = '#6d675c'; c.font = `600 ${Math.round(Math.min(12, cw / 15))}px "Chakra Petch", sans-serif`; c.fillText('équipier IA', cw / 2, h * 0.9); }
      else if (m.me) { c.fillStyle = '#e3262f'; c.font = `700 ${Math.round(Math.min(12, cw / 15))}px "Chakra Petch", sans-serif`; c.fillText('▲ TOI', cw / 2, h * 0.9); }
      c.restore();
    });
    // mission
    if (t > 3.6 + n * 0.32 + 0.4) {
      const m = d.mission || '';
      const shown = m.slice(0, Math.floor((t - (3.6 + n * 0.32 + 0.4)) * 45));
      c.font = `700 ${Math.round(Math.min(18, W / 55))}px "Chakra Petch", sans-serif`; c.textAlign = 'center'; c.fillStyle = '#fff8ea';
      c.fillText('MISSION : ' + shown, W / 2, H * 0.78);
    }
    c.globalAlpha = 1;
  }
  // fondu de sortie
  if (t > 8.4) { c.fillStyle = `rgba(0,0,0,${clamp01((t - 8.4) / 0.6)})`; c.fillRect(0, 0, W, H); }
  // passer
  c.font = '700 14px "Chakra Petch", sans-serif'; c.textAlign = 'right'; c.fillStyle = 'rgba(255,248,234,.75)';
  c.fillText(`Espace ou clic pour passer${d.total > 1 ? ` (${d.votes}/${d.total})` : ''}`, W - 20, H - 20);
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
