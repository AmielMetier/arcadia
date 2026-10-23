// Dessins vectoriels « cartoon » (contour encre, couleurs franches) : survivants, zombies, armes, objets.
// Toutes les fonctions dessinent centré sur (0,0), l'avant vers +x ; l'appelant gère translate/rotate.
import { hash } from '../engine/rng.js';
import { drawIcon } from '../ui/icons.js';

export const INK = '#16181d';
const WHITE = { flash: true };

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1);
}

function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); }
function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); }
function fs(c, fill, lw = 2.6) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); }
// membre : trait épais encré
function limb(c, x0, y0, x1, y1, w, col) {
  c.lineCap = 'round';
  c.strokeStyle = INK; c.lineWidth = w + 4.5; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
}
const F = (flash, col) => (flash ? '#ffffff' : col);

// ------------------------------------------------------------------ armes (avant = +x, poignée en 0)
export function drawWeapon(c, id, flash = false, scale = 1) {
  c.save(); c.scale(scale, scale);
  const m = F(flash, '#3a3f4b'), d = F(flash, '#262932'), lw = 2.2;
  switch (id) {
    case 'pistol':
      rr(c, -2, -3.5, 17, 7, 2); fs(c, m, lw); rr(c, 0, 1, 5, 7, 1.5); fs(c, d, lw); break;
    case 'smg':
      rr(c, -4, -4, 24, 8, 2); fs(c, m, lw); rr(c, 20, -2, 7, 4, 1); fs(c, d, lw); rr(c, 6, 3, 5, 9, 1); fs(c, F(flash, '#c9a227'), lw); break;
    case 'shotgun':
      rr(c, -8, -3.5, 40, 7, 2); fs(c, F(flash, '#6b4a2e'), lw); rr(c, 8, -4.5, 12, 9, 2); fs(c, d, lw); rr(c, 26, -2.5, 10, 5, 1); fs(c, m, lw); break;
    case 'rifle':
      rr(c, -10, -3.5, 42, 7, 2); fs(c, m, lw); rr(c, 4, 3, 6, 10, 1.5); fs(c, d, lw); rr(c, -14, -4.5, 8, 9, 2); fs(c, d, lw); rr(c, 14, -6, 9, 3, 1); fs(c, F(flash, '#2b8cff'), 1.6); break;
    case 'flamer':
      rr(c, -8, -9, 13, 18, 5); fs(c, F(flash, '#d64545'), lw); rr(c, 2, -3, 30, 6, 2); fs(c, m, lw); rr(c, 30, -4, 6, 8, 2); fs(c, F(flash, '#ff8a2a'), lw); break;
    case 'launcher':
      rr(c, -8, -6, 38, 12, 5); fs(c, F(flash, '#5f7d3a'), lw); rr(c, 4, 5, 6, 7, 1.5); fs(c, d, lw); circ(c, 30, 0, 5); fs(c, d, lw); break;
    case 'rail':
      rr(c, -10, -4, 48, 8, 2); fs(c, d, lw); for (let k = 0; k < 3; k++) { rr(c, 6 + k * 9, -6, 5, 12, 2); fs(c, F(flash, '#7ff0ff'), 1.6); } rr(c, 38, -2, 8, 4, 1); fs(c, m, lw); break;
    case 'katana':
      rr(c, -6, -2.5, 12, 5, 2); fs(c, F(flash, '#2a2d36'), lw); rr(c, 5, -5, 3, 10, 1); fs(c, F(flash, '#c9a227'), 1.8);
      c.beginPath(); c.moveTo(8, -2); c.lineTo(50, -1.5); c.quadraticCurveTo(56, 0, 50, 2); c.lineTo(8, 2); c.closePath(); fs(c, F(flash, '#e8f4ff'), 1.8);
      c.strokeStyle = 'rgba(120,150,180,.8)'; c.lineWidth = 1; c.beginPath(); c.moveTo(10, 0.5); c.lineTo(48, 0.5); c.stroke();
      break;
    case 'crossbow':
      rr(c, -8, -3, 34, 6, 2); fs(c, F(flash, '#7a5230'), lw);
      c.beginPath(); c.moveTo(20, -16); c.quadraticCurveTo(30, 0, 20, 16); c.strokeStyle = INK; c.lineWidth = 5; c.stroke(); c.strokeStyle = F(flash, '#4a5d32'); c.lineWidth = 3; c.stroke();
      c.strokeStyle = '#d9d2c3'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(20, -16); c.lineTo(8, 0); c.lineTo(20, 16); c.stroke();
      rr(c, 6, -1.2, 26, 2.4, 1); c.fillStyle = '#d9c39a'; c.fill();
      break;
    case 'tesla':
      rr(c, -8, -7, 22, 14, 4); fs(c, F(flash, '#3a3f4b'), lw);
      for (let k = 0; k < 3; k++) { circ(c, 16 + k * 7, 0, 5 - k); fs(c, F(flash, '#b87333'), 1.8); }
      circ(c, 36, 0, 4.5); fs(c, F(flash, '#9fd8ff'), 2);
      break;
    case 'minigun':
      rr(c, -8, -9, 18, 18, 4); fs(c, F(flash, '#c9a227'), lw); for (const y of [-4, 0, 4]) { rr(c, 8, y - 1.6, 30, 3.2, 1); fs(c, m, 1.6); } rr(c, 32, -6, 5, 12, 1.5); fs(c, d, lw); break;
  }
  c.restore();
}
// longueur jusqu'au bout du canon (pour le flash de tir)
export const MUZZLE = { pistol: 16, smg: 27, shotgun: 36, rifle: 32, flamer: 36, launcher: 34, rail: 46, minigun: 38, katana: 0, crossbow: 30, tesla: 40 };

// ------------------------------------------------------------------ survivant
// p : { x, y, a (visée), color, walk (phase), move (angle de marche), speed (0..1), state, hurt, weapon, dash, reload }
export function drawSurvivor(c, p, t) {
  const flash = p.hurt;
  const col = F(flash, p.color), dark = F(flash, shade(p.color, -0.35));
  const skin = F(flash, ['#f2c79b', '#d9a066', '#a8714a', '#7a4a2c', '#ffd7b5'][hash(p.id + 7) % 5]);
  if (p.state === 1) return drawDowned(c, p, t, col, dark, skin);
  // pieds (dans le sens de la marche)
  c.save();
  c.rotate(p.move);
  const st = Math.sin(p.walk) * 7 * p.speed;
  ell(c, st, -6, 6, 4.2); fs(c, F(flash, '#2a2d36'), 2);
  ell(c, -st, 6, 6, 4.2); fs(c, F(flash, '#2a2d36'), 2);
  c.restore();
  c.save();
  c.rotate(p.a);
  // sac à dos
  rr(c, -17, -9, 10, 18, 4); fs(c, dark);
  if (p.clsColor) { circ(c, -12, 0, 3.6); fs(c, F(flash, p.clsColor), 1.6); }
  // corps
  ell(c, -2, 0, 11, 15.5); fs(c, col);
  c.beginPath(); c.moveTo(-6, -12); c.lineTo(4, -2); c.lineTo(4, 2); c.lineTo(-6, 12); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2; c.stroke();
  // bras + arme
  const rec = p.recoil || 0;
  const two = p.weapon !== 'pistol';
  c.save(); c.translate(10 - rec, two ? 3 : 0);
  limb(c, -12, 11, 0, 3, 5.5, col);
  limb(c, -12, -11, two ? 12 : 0, two ? -4 : -2, 5.5, col);
  drawWeapon(c, p.weapon, flash);
  circ(c, 0, 2, 3.6); fs(c, skin, 2);
  if (two) { circ(c, 12, -3, 3.6); fs(c, skin, 2); }
  c.restore();
  // tête : casque à la couleur du joueur
  circ(c, 0, 0, 9.5); fs(c, skin);
  c.beginPath(); c.arc(0, 0, 10.2, Math.PI * 0.55, Math.PI * 1.45); c.closePath(); fs(c, dark, 2.4);
  rr(c, 4, -6.5, 4, 13, 2); fs(c, F(flash, '#1d2a3a'), 1.8); // visière
  c.restore();
}

function drawDowned(c, p, t, col, dark, skin) {
  c.save();
  c.rotate(p.a + Math.PI / 2 * 0.3);
  ell(c, -4, 0, 16, 11); fs(c, col);
  limb(c, 4, -8, 16, -14, 5, col); limb(c, 4, 8, 18, 4, 5, col);
  c.save(); c.translate(18, 4); drawWeapon(c, 'pistol', p.hurt); c.restore();
  circ(c, 10, 0, 9); fs(c, skin);
  c.beginPath(); c.arc(10, 0, 9.6, Math.PI * 0.6, Math.PI * 1.4); c.closePath(); fs(c, dark, 2.2);
  c.restore();
}

// ------------------------------------------------------------------ zombies
const BASE_SHIRTS = ['#6b7a8f', '#8a6d4b', '#5b6e4a', '#7a4b5a', '#4f5d75', '#9b8a6a', '#a35c3d', '#3e6b6b'];
let SHIRTS = BASE_SHIRTS;
export function setZombiePalette(pal) { SHIRTS = pal && pal.length ? pal : BASE_SHIRTS; }
const SKINS = ['#9cb48a', '#8aa37a', '#a7b58f', '#b5b08a', '#8fa59a'];

// z : { id, ty, a (orientation), walk, flags, hp (0..1), t, inflate }
export function drawZombie(c, z, t) {
  const v = hash(z.id);
  const flash = (z.flags & 128) !== 0;
  const tele = (z.flags & 4) !== 0, atk = (z.flags & 1) !== 0;
  const shirt = F(flash, SHIRTS[v % SHIRTS.length]);
  const skin = F(flash, SKINS[(v >>> 4) % SKINS.length]);
  const sway = Math.sin(z.walk) * 1;
  const reach = atk ? 9 : 0;
  c.save();
  c.rotate(z.a);
  switch (z.ty) {
    case 'walker': {
      feet(c, z, 6, flash);
      ell(c, -2, 0, 10.5, 15.5); fs(c, shirt);
      tear(c, v, flash);
      const oneArm = v % 7 === 0;
      limb(c, -2, 11, 20 + sway * 4 + reach, 8 + sway * 2, 5.5, skin);
      if (!oneArm) limb(c, -2, -11, 20 - sway * 4 + reach, -8 - sway * 2, 5.5, skin);
      else limb(c, -2, -11, 4, -13, 5.5, skin);
      circ(c, 3, 0, 9); fs(c, skin);
      face(c, 3, flash);
      break;
    }
    case 'runner': {
      feet(c, z, 8, flash);
      ell(c, -2, 0, 9, 13); fs(c, F(flash, '#a35050'));
      limb(c, -2, 9, 14 + sway * 6 + reach, 12, 4.5, F(flash, '#c98b78'));
      limb(c, -2, -9, 14 - sway * 6 + reach, -12, 4.5, F(flash, '#c98b78'));
      circ(c, 4, 0, 8); fs(c, F(flash, '#c98b78'));
      face(c, 4, flash, true);
      break;
    }
    case 'crawler': {
      const pull = Math.sin(z.walk * 1.3) * 6;
      limb(c, 0, 9, 18 + pull, 13, 4.5, skin);
      limb(c, 0, -9, 18 - pull, -13, 4.5, skin);
      ell(c, -6, 0, 14, 9); fs(c, shirt);
      c.beginPath(); c.moveTo(-18, -5); c.lineTo(-24, -2); c.lineTo(-20, 1); c.lineTo(-25, 4); c.lineTo(-18, 6); fs(c, F(flash, '#7a2a2a'), 2);
      circ(c, 7, 0, 7.5); fs(c, skin);
      face(c, 7, flash);
      break;
    }
    case 'spitter': {
      feet(c, z, 6, flash);
      ell(c, -2, 0, 10.5, 15); fs(c, F(flash, '#55704a'));
      limb(c, -2, 11, 14 + sway * 3, 13, 5, skin); limb(c, -2, -11, 14 - sway * 3, -13, 5, skin);
      const sac = 9 + (tele ? 4 + Math.sin(t * 30) * 1.5 : Math.sin(t * 4 + v) * 1);
      ell(c, 8, 0, sac, sac * 0.9); fs(c, F(flash, '#9be15d'));
      ell(c, 9, -2, sac * 0.35, sac * 0.25); c.fillStyle = 'rgba(255,255,255,.5)'; c.fill();
      circ(c, 1, 0, 8); fs(c, skin);
      face(c, 1, flash);
      break;
    }
    case 'bloater': {
      const inf = tele ? 1.18 + Math.sin(t * 40) * 0.04 : 1 + Math.sin(t * 3 + v) * 0.03;
      feet(c, z, 9, flash);
      limb(c, 0, 20, 14, 22, 6, skin); limb(c, 0, -20, 14, -22, 6, skin);
      ell(c, -3, 0, 22 * inf, 24 * inf); fs(c, F(flash, tele ? '#c9d86a' : '#a9b86a'));
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + v; circ(c, -3 + Math.cos(a) * 13 * inf, Math.sin(a) * 14 * inf, 3.5 + (k % 2)); fs(c, F(flash, '#d7e36b'), 1.6); }
      circ(c, 14, 0, 8); fs(c, skin);
      face(c, 14, flash);
      break;
    }
    case 'brute': {
      feet(c, z, 10, flash);
      const fist = atk || (z.flags & 64) ? 12 : 0;
      limb(c, 0, 24, 22 + sway * 3 + fist, 20, 11, skin); limb(c, 0, -24, 22 - sway * 3 + fist, -20, 11, skin);
      circ(c, 24 + fist, 20, 8); fs(c, skin); circ(c, 24 + fist, -20, 8); fs(c, skin);
      ell(c, -4, 0, 18, 28); fs(c, F(flash, '#5a4f4a'));
      rr(c, -14, -22, 18, 12, 3); fs(c, F(flash, '#8d96a3')); rr(c, -14, 10, 18, 12, 3); fs(c, F(flash, '#8d96a3'));
      circ(c, 8, 0, 9); fs(c, skin);
      face(c, 8, flash, true);
      if (z.flags & 32) { for (let k = 0; k < 3; k++) { const a = t * 6 + (k * Math.PI * 2) / 3; circ(c, 8 + Math.cos(a) * 14, Math.sin(a) * 14, 2.6); c.fillStyle = '#ffe27a'; c.fill(); } }
      break;
    }
    case 'screamer': {
      feet(c, z, 6, flash);
      ell(c, -2, 0, 9, 13); fs(c, F(flash, '#d9d2c3'));
      limb(c, -2, 9, 10, 15, 4, F(flash, '#c9c3b4')); limb(c, -2, -9, 10, -15, 4, F(flash, '#c9c3b4'));
      // cheveux
      c.strokeStyle = F(flash, '#2a2420'); c.lineWidth = 3; c.lineCap = 'round';
      for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(-2, k * 2.4); c.quadraticCurveTo(-14, k * 4 + Math.sin(t * 5 + k) * 2, -20, k * 5); c.stroke(); }
      circ(c, 2, 0, 8); fs(c, F(flash, '#e8e2d4'));
      const open = tele ? 5 + Math.sin(t * 40) : 2;
      ell(c, 8, 0, 2.2, open); c.fillStyle = INK; c.fill();
      break;
    }
    case 'armored': {
      feet(c, z, 9, flash);
      limb(c, -2, 15, 16 + sway * 3 + reach, 13, 6.5, skin); limb(c, -2, -15, 16 - sway * 3 + reach, -13, 6.5, skin);
      ell(c, -4, 0, 14, 19); fs(c, F(flash, '#4f5560'));
      // gros bouclier anti-émeute devant
      c.save(); c.translate(17, 0);
      rr(c, -4, -21, 9, 42, 4); fs(c, F(flash, '#8d96a3'), 3);
      c.fillStyle = flash ? '#fff' : 'rgba(30,40,55,.55)'; rr(c, -1, -14, 4, 10, 1.5); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-1, -17); c.lineTo(-1, 17); c.stroke();
      c.restore();
      circ(c, 2, 0, 9); fs(c, F(flash, '#3b4250'));
      rr(c, 6, -5, 5, 10, 2); c.fillStyle = flash ? '#fff' : '#ff6a4a'; c.fill();
      break;
    }
    case 'stalker': {
      const crouch = (z.flags & 4096) !== 0, pin = (z.flags & 2048) !== 0;
      const ext = pin ? 10 : crouch ? -4 : Math.sin(z.walk) * 4;
      limb(c, 0, 10, 16 + ext, 14, 3.5, F(flash, '#4b3e5a')); limb(c, 0, -10, 16 - ext, -14, 3.5, F(flash, '#4b3e5a'));
      limb(c, -8, 8, -20, 14, 3.5, F(flash, '#4b3e5a')); limb(c, -8, -8, -20, -14, 3.5, F(flash, '#4b3e5a'));
      ell(c, -3, 0, 13, 8); fs(c, F(flash, '#2f2838'));
      circ(c, 8, 0, 7); fs(c, F(flash, '#5a4a6a'));
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(18 + ext, s * 14); c.lineTo(26 + ext, s * 12); c.lineTo(18 + ext, s * 10); fs(c, F(flash, '#e8e2d4'), 1.4); }
      break;
    }
    case 'larva': {
      const w2 = Math.sin(z.walk * 2) * 3;
      c.beginPath(); c.moveTo(-14, w2); c.quadraticCurveTo(-6, -w2 * 1.5, 0, 0); c.strokeStyle = INK; c.lineWidth = 9; c.lineCap = 'round'; c.stroke(); c.strokeStyle = F(flash, '#d6c38a'); c.lineWidth = 6; c.stroke();
      ell(c, 2, 0, 8, 6.5); fs(c, F(flash, '#e8d79c'), 2);
      c.fillStyle = flash ? '#fff' : '#7a1d1d'; ell(c, 8, 0, 2.5, 3.5); c.fill();
      break;
    }
    case 'boss': drawBoss(c, z, t, v, flash); break;
    case 'abomination': drawAbomination(c, z, t, v, flash); break;
    case 'mother': drawMother(c, z, t, v, flash); break;
    case 'colossus': drawColossus(c, z, t, v, flash); break;
    case 'queen': c.scale(1.45, 1.45); drawQueen(c, z, t, v, flash); break;
  }
  c.restore();
}

function feet(c, z, spread, flash) {
  const st = Math.sin(z.walk) * 6;
  ell(c, st - 2, -spread, 5.5, 4); fs(c, F(flash, '#3b3530'), 2);
  ell(c, -st - 2, spread, 5.5, 4); fs(c, F(flash, '#3b3530'), 2);
}
function tear(c, v, flash) {
  c.beginPath(); c.moveTo(-8, -6 + (v % 5)); c.lineTo(-2, -2); c.lineTo(-9, 2 + (v % 4)); c.closePath();
  c.fillStyle = flash ? '#fff' : '#3a1f1f'; c.fill();
  if (v % 3 === 0) { circ(c, -5, 7, 3); c.fillStyle = flash ? '#fff' : '#7a1d1d'; c.fill(); }
}
function face(c, x, flash, angry) {
  c.fillStyle = flash ? '#fff' : '#1b1414';
  circ(c, x + 4.5, -3.5, 2.1); c.fill(); circ(c, x + 4.5, 3.5, 2.1); c.fill();
  if (angry) { c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + 2, -6); c.lineTo(x + 6, -2.5); c.moveTo(x + 2, 6); c.lineTo(x + 6, 2.5); c.stroke(); }
}

// L'Abomination : un amas de chair recousue à trois bras
function drawAbomination(c, z, t, v, flash) {
  const atk = (z.flags & 1) || (z.flags & 64);
  const sw = Math.sin(z.walk) * 6, reach = atk ? 16 : 0;
  feet(c, z, 18, flash);
  limb(c, 0, 30, 34 + sw + reach, 28, 13, F(flash, '#d9a3a3'));
  limb(c, 0, -30, 34 - sw + reach, -28, 13, F(flash, '#d9a3a3'));
  limb(c, -6, 0, 30 + reach, 6, 11, F(flash, '#c98b8b'));
  for (const [x, y] of [[36 + sw + reach, 28], [36 - sw + reach, -28], [32 + reach, 6]]) { circ(c, x, y, 10); fs(c, F(flash, '#e8b8b8'), 2.4); }
  ell(c, -6, 0, 32, 38); fs(c, F(flash, '#b97a7a'), 3.2);
  c.strokeStyle = INK; c.lineWidth = 2;
  for (const [x0, y0, x1, y1] of [[-24, -20, 6, -6], [-20, 18, 8, 26], [-30, 0, -8, 4]]) {
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    for (let k = 0; k <= 4; k++) { const x = x0 + (x1 - x0) * k / 4, y = y0 + (y1 - y0) * k / 4; c.beginPath(); c.moveTo(x - 3, y - 4); c.lineTo(x + 3, y + 4); c.stroke(); }
  }
  circ(c, 16, -8, 11); fs(c, F(flash, '#d9a3a3')); circ(c, 18, 12, 8); fs(c, F(flash, '#c98b8b'));
  c.fillStyle = flash ? '#fff' : '#1b1414'; circ(c, 23, -11, 2.4); c.fill(); circ(c, 23, -4, 2.4); c.fill(); circ(c, 23, 12, 2); c.fill();
}

// La Mère des Cracheurs : un sac d'œufs sur pattes
function drawMother(c, z, t, v, flash) {
  const pulse = 1 + Math.sin(t * 3) * 0.04;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.5, st = Math.sin(z.walk + k) * 5;
    limb(c, Math.cos(a) * 20, Math.sin(a) * 20, Math.cos(a) * 46 + st, Math.sin(a) * 46, 5, F(flash, '#6f8f3a'));
  }
  ell(c, -10, 0, 34 * pulse, 30 * pulse); fs(c, F(flash, '#8fbf4a'), 3.2);
  for (let k = 0; k < 9; k++) { const a = k * 2.4, r = 8 + (k % 3) * 7; circ(c, -10 + Math.cos(a) * r, Math.sin(a) * r * 0.85, 5 + (k % 2)); fs(c, F(flash, '#e8d79c'), 1.8); }
  ell(c, 20, 0, 13, 14); fs(c, F(flash, '#55704a'), 2.6);
  ell(c, 30, 0, 7, 9); c.fillStyle = flash ? '#fff' : '#9be15d'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
}

// Le Colosse : un géant blindé, la plaque devant, un cœur lumineux dans le dos
function drawColossus(c, z, t, v, flash) {
  const atk = (z.flags & 1) || (z.flags & 64);
  const sw = Math.sin(z.walk) * 5;
  feet(c, z, 22, flash);
  // point faible dans le dos
  const g = 0.6 + 0.4 * Math.sin(t * 6);
  circ(c, -44, 0, 15); fs(c, F(flash, `rgba(255,${140 + 60 * g | 0},40,1)`), 3);
  limb(c, -6, 40, 26 + sw + (atk ? 12 : 0), 40, 16, F(flash, '#6b6f78'));
  limb(c, -6, -40, 26 - sw + (atk ? 12 : 0), -40, 16, F(flash, '#6b6f78'));
  ell(c, -10, 0, 34, 46); fs(c, F(flash, '#4f5560'), 3.4);
  for (const y of [-26, 0, 26]) { rr(c, -36, y - 9, 30, 18, 4); fs(c, F(flash, '#8d96a3'), 2.4); }
  // grande plaque frontale
  c.save(); c.translate(32, 0);
  c.beginPath(); c.moveTo(-6, -52); c.quadraticCurveTo(14, 0, -6, 52); c.lineTo(-16, 52); c.quadraticCurveTo(2, 0, -16, -52); c.closePath(); fs(c, F(flash, '#a7b0bd'), 3.4);
  for (const y of [-34, -12, 12, 34]) { circ(c, -6, y, 3); c.fillStyle = INK; c.fill(); }
  c.restore();
  circ(c, 14, 0, 13); fs(c, F(flash, '#3b4250'), 3);
  rr(c, 20, -7, 6, 14, 2); c.fillStyle = flash ? '#fff' : '#ff6a4a'; c.fill();
}

// La Reine : insecte élancé, couronne d'épines, longues pattes
function drawQueen(c, z, t, v, flash) {
  const leg = Math.sin(z.walk * 1.4);
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
    const x0 = 10 - k * 14, st = leg * (k % 2 ? 1 : -1) * 8 * s;
    c.lineCap = 'round';
    const mx = x0 + 6 + st, my = s * 30, ex = x0 + 18 + st, ey = s * 46;
    c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.moveTo(x0, s * 8); c.lineTo(mx, my); c.lineTo(ex, ey); c.stroke();
    c.strokeStyle = F(flash, '#3b2a4a'); c.lineWidth = 4; c.stroke();
  }
  ell(c, -30, 0, 22, 14); fs(c, F(flash, '#2b2033'), 3);
  for (let k = 0; k < 3; k++) { c.strokeStyle = F(flash, '#c77dff'); c.lineWidth = 2; c.beginPath(); c.moveTo(-44 + k * 9, -11); c.lineTo(-44 + k * 9, 11); c.stroke(); }
  ell(c, 0, 0, 16, 12); fs(c, F(flash, '#4b3560'), 3);
  ell(c, 22, 0, 12, 10); fs(c, F(flash, '#5e4378'), 3);
  for (let k = -2; k <= 2; k++) { c.save(); c.translate(18, 0); c.rotate(Math.PI + k * 0.35); c.beginPath(); c.moveTo(8, -3); c.lineTo(24, 0); c.lineTo(8, 3); fs(c, F(flash, '#e6b8ff'), 1.8); c.restore(); }
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(30, s * 4); c.quadraticCurveTo(42, s * 10, 40, s * 2); c.strokeStyle = INK; c.lineWidth = 3; c.stroke(); }
}

function drawBoss(c, z, t, v, flash) {
  const ph = z.phase || 1;
  const pulse = 1 + Math.sin(t * (ph === 3 ? 9 : 4)) * 0.05;
  const atk = (z.flags & 1) !== 0, charge = (z.flags & 64) !== 0, tele = (z.flags & 4) !== 0;
  // tentacules dorsaux
  c.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    const a = Math.PI + (k - 2) * 0.42, w = Math.sin(t * 3 + k) * 0.25;
    const x1 = Math.cos(a + w) * 70, y1 = Math.sin(a + w) * 70;
    c.strokeStyle = INK; c.lineWidth = 13; c.beginPath(); c.moveTo(-20, 0); c.quadraticCurveTo(Math.cos(a) * 45, Math.sin(a) * 45 + w * 30, x1, y1); c.stroke();
    c.strokeStyle = F(flash, '#6c3a7a'); c.lineWidth = 8; c.stroke();
  }
  // bras griffus
  const reach = atk || charge ? 18 : Math.sin(z.walk) * 5;
  for (const s of [-1, 1]) {
    limb(c, 6, s * 38, 42 + reach, s * 30, 15, F(flash, '#8a5a9a'));
    for (let k = -1; k <= 1; k++) { c.save(); c.translate(48 + reach, s * 30 + k * 6); c.rotate(k * 0.3); c.beginPath(); c.moveTo(0, -3); c.lineTo(16, 0); c.lineTo(0, 3); fs(c, F(flash, '#efe6d8'), 2); c.restore(); }
  }
  // carapace
  ell(c, -6, 0, 46 * pulse, 52 * pulse); fs(c, F(flash, '#4a2a5a'), 3.5);
  for (let k = 0; k < 7; k++) {
    const a = Math.PI * 0.6 + (k / 6) * Math.PI * 0.8;
    c.save(); c.translate(-6 + Math.cos(a) * 44, Math.sin(a) * 50); c.rotate(a);
    c.beginPath(); c.moveTo(0, -6); c.lineTo(16, 0); c.lineTo(0, 6); fs(c, F(flash, '#2d1838'), 2.2); c.restore();
  }
  ell(c, -10, 0, 30, 36); fs(c, F(flash, '#5e3570'), 2.4);
  // noyau lumineux
  const core = ph === 3 ? '#ff4b8a' : ph === 2 ? '#ff7ad9' : '#c77dff';
  circ(c, -12, 0, 13 + Math.sin(t * 6) * 2); fs(c, F(flash, core), 3);
  // tête
  ell(c, 30, 0, 20, 24); fs(c, F(flash, '#8a5a9a'), 3);
  c.fillStyle = flash ? '#fff' : '#ffef5a';
  for (const [ex, ey, er] of [[40, -9, 3.5], [43, 0, 4.5], [40, 9, 3.5], [34, -14, 2.5], [34, 14, 2.5]]) { circ(c, ex, ey, er); c.fill(); }
  if (tele) { ell(c, 49, 0, 4, 12); c.fillStyle = INK; c.fill(); }
}

// Yeux lumineux, dessinés après l'obscurité pour percer le noir
export function zombieEyes(c, z) {
  if (z.ty === 'stalker' && z.alpha != null && z.alpha < 0.5) return;
  if (z.flags & 8192) return;
  const off = { walker: 3, runner: 4, crawler: 7, spitter: 1, bloater: 14, brute: 8, screamer: 2, armored: 4, stalker: 8, larva: 4, boss: 40, abomination: 18, mother: 26, colossus: 14, queen: 24 }[z.ty] ?? 3;
  const bigE = z.ty === 'boss' || z.ty === 'colossus' || z.ty === 'queen' || z.ty === 'abomination' || z.ty === 'mother';
  const col = z.flags & 16 ? '#ff4b2b' : bigE ? (z.ty === 'queen' ? '#e6b8ff' : '#ffef5a') : z.flags & 8 ? '#ffb03a' : '#ff6a4a';
  const ca = Math.cos(z.a), sa = Math.sin(z.a);
  const pts = z.ty === 'boss' ? [[off, -9], [off + 3, 0], [off, 9]] : bigE ? [[off, -5], [off, 5]] : [[off + 4.5, -3.5], [off + 4.5, 3.5]];
  c.fillStyle = col;
  for (const [lx, ly] of pts) {
    const x = z.x + lx * ca - ly * sa, y = z.y + lx * sa + ly * ca;
    c.beginPath(); c.arc(x, y, bigE ? 3.4 : 1.9, 0, Math.PI * 2); c.fill();
  }
}

// ------------------------------------------------------------------ tourelle de l'ingénieur
export function drawTurret(c, t, time) {
  const [, , , a, f, color] = t;
  ell(c, 3, 5, 20, 16); c.fillStyle = 'rgba(0,0,0,.3)'; c.fill();
  for (let k = 0; k < 3; k++) { const aa = (k / 3) * Math.PI * 2 + Math.PI / 2; limb(c, 0, 0, Math.cos(aa) * 18, Math.sin(aa) * 18, 3, '#59616d'); }
  circ(c, 0, 0, 13); fs(c, '#3a3f4b', 2.6);
  c.save(); c.rotate(a);
  rr(c, -9, -8, 18, 16, 4); fs(c, color || '#ff8a1f', 2.6);
  rr(c, 6, -5, 22, 3.6, 1); fs(c, '#262932', 1.6); rr(c, 6, 1.4, 22, 3.6, 1); fs(c, '#262932', 1.6);
  circ(c, -2, 0, 3); c.fillStyle = f < 0.25 && Math.sin(time * 14) > 0 ? '#ff4b2b' : '#2fbf71'; c.fill();
  c.restore();
  // jauge de durée
  c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 22, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = color || '#ff8a1f'; c.beginPath(); c.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); c.stroke();
}

// ------------------------------------------------------------------ mode Défense
export function drawGenerator(c, f, t, hit) {
  rr(c, -34, -34, 68, 68, 8); fs(c, hit ? '#fff' : '#59616d', 3);
  for (let k = 0; k < 3; k++) { rr(c, -26, -24 + k * 16, 30, 10, 3); fs(c, '#2a2d36', 2); }
  const on = f > 0.25 || Math.sin(t * 12) > 0;
  circ(c, 18, -14, 9); fs(c, on ? (f > 0.5 ? '#2fbf71' : f > 0.25 ? '#ffc531' : '#ff4b2b') : '#3a1a10', 2.5);
  c.save(); c.translate(18, 14); c.rotate(t * 4); for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); rr(c, -2, 0, 4, 9, 2); c.fillStyle = '#ffc531'; c.fill(); } c.restore();
  circ(c, 18, 14, 3); c.fillStyle = INK; c.fill();
}

export function drawBarricade(c, b, hp, max, t) {
  const f = Math.max(0, hp / max), horiz = b.w > b.h;
  const n = Math.ceil(f * 4);
  c.save(); c.translate(b.x + b.w / 2, b.y + b.h / 2); if (!horiz) c.rotate(Math.PI / 2);
  const L = Math.max(b.w, b.h);
  if (hp <= 0) { c.globalAlpha = 0.5; c.setLineDash([8, 6]); rr(c, -L / 2, -8, L, 16, 4); c.strokeStyle = '#ff4b2b'; c.lineWidth = 2.5; c.stroke(); c.setLineDash([]); c.globalAlpha = 1; c.restore(); return; }
  for (let k = 0; k < n; k++) {
    c.save(); c.rotate((k % 2 ? -1 : 1) * 0.12); c.translate(0, (k - 1.5) * 7);
    rr(c, -L / 2 - 6, -5, L + 12, 10, 3); fs(c, ['#b0793f', '#9c6a35', '#c48a4a', '#a8713c'][k], 2.2);
    circ(c, -L / 2 + 2, 0, 1.8); c.fillStyle = INK; c.fill(); circ(c, L / 2 - 2, 0, 1.8); c.fill();
    c.restore();
  }
  c.restore();
}

export function drawPad(c, k, n, t, active) {
  if (!k) {
    c.globalAlpha = active ? 0.9 : 0.55;
    circ(c, 0, 0, 30); c.strokeStyle = '#ffc531'; c.lineWidth = 3; c.setLineDash([8, 6]); c.lineDashOffset = -t * 15; c.stroke(); c.setLineDash([]);
    c.font = '700 20px "Chakra Petch", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffc531'; c.fillText('+', 0, 1);
    c.globalAlpha = 1; return;
  }
  if (k === 'wire') {
    c.strokeStyle = '#8d96a3'; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) { c.beginPath(); for (let a = 0; a <= 24; a++) { const x = -60 + a * 5, y = -24 + i * 16 + Math.sin(a * 1.7 + i) * 4; a ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
    c.fillStyle = '#5a5e57'; for (const x of [-60, 0, 60]) { rr(c, x - 4, -32, 8, 64, 2); c.fill(); }
  } else if (k === 'mine') {
    for (let i = 0; i < n; i++) { const a = (i / 3) * Math.PI * 2; circ(c, Math.cos(a) * 16, Math.sin(a) * 16, 8); fs(c, '#4a5d32', 2); circ(c, Math.cos(a) * 16, Math.sin(a) * 16, 2.5); c.fillStyle = Math.sin(t * 6 + i) > 0 ? '#ff4b2b' : '#5a1a10'; c.fill(); }
  } else if (k === 'flame') {
    rr(c, -42, -42, 84, 84, 6); fs(c, '#3a3f4b', 2.5);
    c.strokeStyle = '#59616d'; c.lineWidth = 3; for (let i = -30; i <= 30; i += 15) { c.beginPath(); c.moveTo(i, -38); c.lineTo(i, 38); c.stroke(); }
    c.fillStyle = `rgba(255,${120 + 60 * Math.sin(t * 9) | 0},40,.55)`; rr(c, -38, -38, 76, 76, 4); c.fill();
  } else if (k === 'turret') {
    circ(c, 0, 0, 30); c.strokeStyle = 'rgba(255,138,31,.6)'; c.lineWidth = 2; c.stroke();
  }
}

// ------------------------------------------------------------------ marchand, coffre, largage
export function drawShopItem(c, it, t, icon, label, afford) {
  const [, k, , , w, price, sold] = it;
  rr(c, -24, -8, 48, 30, 5); fs(c, sold ? '#59616d' : '#d9cdb3', 2.6);
  if (!sold) {
    c.save(); c.translate(0, -16 + Math.sin(t * 3 + price) * 2);
    if (k === 'weapon') { c.rotate(-0.3); c.translate(-16, 0); drawWeapon(c, w, false, 0.9); }
    else drawIcon(c, icon, 0, 0, 28, '#fff8ea');
    c.restore();
  }
  rr(c, -20, 24, 40, 18, 5); fs(c, sold ? '#59616d' : afford ? '#ffc531' : '#ff8a7a', 2.2);
  c.fillStyle = INK; c.font = '700 12px "Chakra Petch", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  if (sold) c.fillText('VENDU', 0, 33);
  else { c.fillText(String(price), 6, 33); hexNut(c, -10, 33, 5); }
}

export function drawVaultDoor(c, st, prog, t) {
  const open = st === 'open', alarm = st === 'alarm';
  const R0 = 52;
  c.save();
  if (open) c.translate(-40, 0);
  circ(c, 0, 0, R0); fs(c, '#a7b0bd', 4);
  circ(c, 0, 0, R0 - 10); fs(c, '#8d96a3', 2.5);
  c.save(); c.rotate(open ? 2 : prog * Math.PI * 2 + (alarm ? t * 3 : 0));
  for (let k = 0; k < 3; k++) { c.rotate((Math.PI * 2) / 3); rr(c, -4, 0, 8, R0 - 14, 3); fs(c, '#59616d', 2); }
  circ(c, 0, 0, 12); fs(c, '#ffc531', 2.5);
  c.restore();
  c.restore();
  if (alarm) { c.fillStyle = `rgba(255,60,40,${0.5 + 0.5 * Math.sin(t * 10)})`; circ(c, -R0 - 14, -R0 + 10, 7); c.fill(); circ(c, R0 + 14, -R0 + 10, 7); c.fill(); }
}

export function drawDropCrate(c, st, f, t) {
  if (st === 'fall') {
    const h = 60 + f * 500;
    c.save(); c.translate(0, -h);
    c.beginPath(); c.arc(0, -46, 40, Math.PI, 0); fs(c, '#fff8ea', 2.6);
    for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(k * 28, -46); c.lineTo(k * 10, -14); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(); }
    c.restore();
    c.save(); c.translate(0, -h); rr(c, -20, -16, 40, 32, 4); fs(c, '#5c6b3a', 2.6); c.restore();
    return;
  }
  rr(c, -26, -20, 52, 40, 5); fs(c, '#5c6b3a', 3);
  rr(c, -26, -4, 52, 8, 2); fs(c, '#ffc531', 2);
  // balise
  c.fillStyle = Math.sin(t * 8) > 0 ? '#2fbf71' : '#1a6b40'; circ(c, 20, -26, 6); c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
}

// ------------------------------------------------------------------ objets au sol
export function drawPickup(c, k, t) {
  const bob = Math.sin(t * 3 + k.id) * 2.5;
  c.save(); c.translate(0, bob);
  switch (k.k) {
    case 'ammo':
      rr(c, -13, -9, 26, 18, 3); fs(c, '#5c6b3a'); rr(c, -13, -9, 26, 6, 3); fs(c, '#77894c', 2);
      c.fillStyle = '#ffd65a'; for (let i = -1; i <= 1; i++) { rr(c, i * 6 - 2, 0, 4, 7, 1.5); c.fill(); }
      break;
    case 'med':
      rr(c, -12, -11, 24, 22, 4); fs(c, '#fff8ea');
      c.fillStyle = '#e3262f'; rr(c, -3, -7, 6, 14, 1); c.fill(); rr(c, -7, -3, 14, 6, 1); c.fill();
      break;
    case 'armor':
      c.beginPath(); c.moveTo(0, -13); c.lineTo(11, -8); c.lineTo(9, 6); c.lineTo(0, 13); c.lineTo(-9, 6); c.lineTo(-11, -8); c.closePath(); fs(c, '#2b8cff');
      c.beginPath(); c.moveTo(0, -7); c.lineTo(5, -4); c.lineTo(4, 3); c.lineTo(0, 7); c.closePath(); c.fillStyle = 'rgba(255,255,255,.55)'; c.fill();
      break;
    case 'nade':
      circ(c, 0, 2, 9); fs(c, '#4a5d32'); rr(c, -4, -11, 8, 6, 1.5); fs(c, '#8d96a3', 2);
      c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.arc(6, -9, 4, Math.PI, Math.PI * 2.2); c.stroke();
      break;
    case 'note': {
      const glow = 0.5 + 0.5 * Math.sin(t * 4);
      c.globalAlpha = 0.3 + 0.3 * glow; circ(c, 0, 0, 22); c.fillStyle = '#fff1c1'; c.fill(); c.globalAlpha = 1;
      c.rotate(-0.2);
      rr(c, -11, -14, 22, 28, 2); fs(c, '#fff8ea', 2.2);
      c.strokeStyle = '#8a8478'; c.lineWidth = 1.5; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-7, -7 + i * 5); c.lineTo(7, -7 + i * 5); c.stroke(); }
      c.fillStyle = '#e3262f'; c.fillRect(-11, -14, 22, 5); c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(-11, -14, 22, 5);
      break;
    }
    case 'scrap': {
      // écrou hexagonal en acier, avec un reflet et un trou taraudé
      c.rotate(k.id * 0.7 + t * 0.6);
      const hex = (r) => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); };
      hex(10.5); fs(c, '#8d96a3', 2.4);
      hex(7.6); c.fillStyle = '#b7bfca'; c.fill();
      c.beginPath(); c.moveTo(-9, -5.2); c.lineTo(0, -10.5); c.lineTo(9, -5.2); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.6; c.stroke();
      circ(c, 0, 0, 4); fs(c, '#2a2d36', 1.8);
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 2.6, 0.5, 2.4); c.stroke();
      break;
    }
    case 'weapon': {
      const glow = 0.5 + 0.5 * Math.sin(t * 4);
      c.globalAlpha = 0.35 + 0.25 * glow; ell(c, 0, 4, 30, 12); c.fillStyle = '#ffc531'; c.fill(); c.globalAlpha = 1;
      c.rotate(-0.35); c.translate(-14, 0);
      drawWeapon(c, k.w, false, 1.15);
      break;
    }
  }
  c.restore();
}

// ------------------------------------------------------------------ décor dynamique
export function drawBarrel(c, b, t) {
  const toxic = b.kind === 'toxic';
  circ(c, 0, 0, b.r); fs(c, toxic ? '#4f9d3a' : '#d64545', 3);
  circ(c, 0, 0, b.r - 6); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = toxic ? '#c6f36a' : '#ffc531';
  if (toxic) drawIcon(c, 'bio', 0, 0, 20, '#c6f36a', 2.6, null);
  else { c.beginPath(); c.moveTo(0, -8); c.lineTo(7, 6); c.lineTo(-7, 6); c.closePath(); c.fill(); c.fillStyle = INK; c.fillRect(-1, -3, 2, 5); c.fillRect(-1, 3, 2, 2); }
}

export function drawCrate(c, w, h) {
  rr(c, 0, 0, w, h, 3); fs(c, '#b0793f', 3);
  c.strokeStyle = '#7a4f24'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(5, 5); c.lineTo(w - 5, h - 5); c.moveTo(w - 5, 5); c.lineTo(5, h - 5); c.stroke();
  rr(c, 3, 3, w - 6, h - 6, 2); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = '#fff8ea'; rr(c, w / 2 - 6, h / 2 - 6, 12, 12, 2); c.fill(); c.fillStyle = '#e3262f'; c.fillRect(w / 2 - 1.5, h / 2 - 4, 3, 8); c.fillRect(w / 2 - 4, h / 2 - 1.5, 8, 3);
}

// petit écrou (prix, compteurs dessinés)
export function hexNut(c, x, y, r) {
  c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath();
  c.fillStyle = '#8d96a3'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
  c.beginPath(); c.arc(x, y, r * 0.38, 0, Math.PI * 2); c.fillStyle = INK; c.fill();
}

// Icône d'arme sur un petit canvas (HUD)
const iconCache = new Map();
export function weaponIcon(id, w = 96, h = 40) {
  const key = id + w + 'x' + h;
  if (iconCache.has(key)) return iconCache.get(key);
  const cv = (typeof OffscreenCanvas !== 'undefined' && false) ? new OffscreenCanvas(w * 2, h * 2) : document.createElement('canvas');
  cv.width = w * 2; cv.height = h * 2;
  const c = cv.getContext('2d');
  c.scale(2, 2);
  c.translate(w / 2 - 16, h / 2);
  const s = Math.min(1.6, (w - 12) / 56);
  c.scale(s, s);
  drawWeapon(c, id);
  const url = cv.toDataURL();
  iconCache.set(key, url);
  return url;
}

export { ell, circ, rr, fs, limb, WHITE };
