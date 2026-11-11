// The Backrooms (Level 17, le Mall) - Les murs habillés. Chaque pan de mur de chaque salle (une suite de cases libres
// le long d'un mur, d'un seul tenant) reçoit ce qu'on y trouverait dans un centre commercial fermé depuis des années :
// dans les coulisses, des tuyaux sur colliers, des coffrets électriques, des gaines de câbles, des consignes de
// sécurité ; dans le mail et les cours, des caissons d'affiches, des panneaux d'orientation, des armoires à
// incendie ; dans les boutiques, des étagères murales garnies selon le commerce, des miroirs, des affiches de soldes ;
// dans les bureaux, des cadres, des tableaux de liège, un tableau blanc, un calendrier arrêté ; au cinéma, des
// panneaux de velours et des affiches encadrées de laiton ; aux toilettes, des sèche-mains. Partout, des salissures :
// auréoles d'infiltration, coulures, rouille, traces de chariots au pied des murs.
// Les textes (consignes, affiches, notes de service) sont dessinés ici, en anglais, et les noms sont inventés.
// Les objets réels passent par model() (view/kit.js) ; le reste par le constructeur de mall.js (G).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL_SIZE as C } from '../engine/map.js';

const WALL = 2;
const FLOOR = 1;

// un hasard fixe (les murs sont les mêmes chez tous les joueurs)
const hash = (a, b = 0, c = 0) => {
  const v = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return v - Math.floor(v);
};
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const toTex = (c) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
// un texte qui tient dans sa largeur (la police rétrécit au besoin)
function fitText(g, text, x, y, maxW, px, face = '"Arial Narrow", Arial, sans-serif', weight = 'bold') {
  let s = px;
  do {
    g.font = `${weight} ${s}px ${face}`;
    s -= 2;
  } while (g.measureText(text).width > maxW && s > 8);
  g.fillText(text, x, y);
}
// des lignes tapées à la machine, coupées à la largeur
function typed(g, text, x, y, maxW, px, lh) {
  g.font = `${px}px "Courier New", Courier, monospace`;
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) {
      g.fillText(line, x, y);
      y += lh;
      line = w;
    } else line = t;
  }
  if (line) g.fillText(line, x, y);
  return y + lh;
}
// le temps qui passe sur un papier ou une plaque : un jaunissement, des taches, des éraflures
function age(g, x, y, w, h, r, k = 1) {
  const gr = g.createRadialGradient(x + w / 2, y + h / 2, w * 0.2, x + w / 2, y + h / 2, w * 0.75);
  gr.addColorStop(0, 'rgba(120,90,30,0)');
  gr.addColorStop(1, `rgba(110,80,30,${0.28 * k})`);
  g.fillStyle = gr;
  g.fillRect(x, y, w, h);
  for (let i = 0; i < 40 * k; i++) {
    g.fillStyle = `rgba(70,50,20,${0.05 + r() * 0.12})`;
    g.beginPath();
    g.arc(x + r() * w, y + r() * h, 0.5 + r() * 3, 0, 7);
    g.fill();
  }
  g.strokeStyle = `rgba(255,255,255,${0.08 * k})`;
  for (let i = 0; i < 6 * k; i++) {
    g.beginPath();
    const sx = x + r() * w;
    const sy = y + r() * h;
    g.moveTo(sx, sy);
    g.lineTo(sx + (r() - 0.5) * 60, sy + (r() - 0.5) * 20);
    g.stroke();
  }
}

// --- L'atlas des plaques et papiers : 8 × 5 cases de 256 px (la dernière rangée : 8 enseignes de rayon, 512 × 128) ---
const SAFETY = [
  ['AUTHORIZED', 'PERSONNEL ONLY', '#b3241f'],
  ['NO SMOKING', 'ON THESE PREMISES', 'smoke'],
  ['FIRE EXIT', 'KEEP CLEAR', '#1f7a3a'],
  ['DANGER', 'HIGH VOLTAGE', 'volt'],
  ['EMPLOYEES', 'MUST WASH HANDS', '#1d4e9e'],
  ['FIRE HOSE', 'REEL', '#b3241f'],
  ['ELECTRICAL', 'ROOM', 'volt'],
  ['THIS DOOR', 'TO REMAIN CLOSED', '#1d4e9e'],
];
const ADS = [
  ['SUMMER', 'SALE', 'UP TO 70% OFF', 38, 30],
  ['BACK TO', 'SCHOOL', 'EVERYTHING FOR THE NEW YEAR', 210, 45],
  ['VISIT', 'SANTA', 'CENTER COURT • DEC 1–24', 0, 40],
  ['NOW', 'LEASING', 'CALL 555-0170', 200, 10],
  ['EVERYTHING', 'MUST GO', 'FINAL CLEARANCE', 52, 55],
  ['GRAND', 'OPENING', 'COMING SOON TO THIS SPACE', 280, 35],
  ['THANK YOU', 'FOR SHOPPING', 'HALCYON PARK MALL', 30, 25],
  ['SHOP • DINE', '• PLAY •', 'OPEN 7 DAYS A WEEK', 170, 30],
];
const DEPTS = ['HOMEWARES', 'MENSWEAR', 'LADIES', 'SHOES', 'LINENS', 'LIGHTING', 'BEAUTY', 'LUGGAGE'];

function plateAtlas() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 1280;
  const g = c.getContext('2d');
  const r = rng(1717);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // rangée 0 : les consignes de sécurité
  SAFETY.forEach(([a, b, st], i) => {
    const x = i * 256;
    g.fillStyle = '#efeee8';
    g.fillRect(x + 8, 40, 240, 176);
    if (st === 'volt') {
      g.fillStyle = '#f2c230';
      g.fillRect(x + 8, 40, 240, 176);
      g.fillStyle = '#111';
      g.beginPath();
      g.moveTo(x + 64, 60);
      g.lineTo(x + 96, 118);
      g.lineTo(x + 32, 118);
      g.closePath();
      g.lineWidth = 6;
      g.strokeStyle = '#111';
      g.stroke();
      g.beginPath();
      g.moveTo(x + 68, 72);
      g.lineTo(x + 56, 96);
      g.lineTo(x + 68, 96);
      g.lineTo(x + 58, 114);
      g.stroke();
      g.fillStyle = '#111';
      fitText(g, a, x + 172, 80, 140, 34);
      fitText(g, b, x + 128, 160, 220, 30);
    } else if (st === 'smoke') {
      g.strokeStyle = '#b3241f';
      g.lineWidth = 12;
      g.beginPath();
      g.arc(x + 128, 100, 44, 0, 7);
      g.stroke();
      g.fillStyle = '#222';
      g.fillRect(x + 92, 96, 64, 12);
      g.fillStyle = '#c9a060';
      g.fillRect(x + 156, 96, 12, 12);
      g.beginPath();
      g.moveTo(x + 97, 69);
      g.lineTo(x + 159, 131);
      g.stroke();
      g.fillStyle = '#1a1a1a';
      fitText(g, a + ' ' + b, x + 128, 180, 220, 24);
    } else {
      g.fillStyle = st;
      g.fillRect(x + 8, 40, 240, 70);
      g.fillStyle = '#fff';
      fitText(g, a, x + 128, 76, 220, 44);
      g.fillStyle = '#1a1a1a';
      fitText(g, b, x + 128, 162, 220, 30);
    }
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 3;
    g.strokeRect(x + 9.5, 41.5, 237, 173);
    for (const [sx, sy] of [[20, 52], [236, 52], [20, 204], [236, 204]]) {
      g.fillStyle = '#8a8a86';
      g.beginPath();
      g.arc(x + sx, sy, 4, 0, 7);
      g.fill();
    }
    age(g, x + 8, 40, 240, 176, r, 0.8);
  });
  // rangée 1 : les papiers de service (blocs de 256 × 256, la feuille au milieu)
  const y1 = 256;
  const sheet = (i, bg = '#ebe5d3') => {
    g.fillStyle = bg;
    g.fillRect(i * 256 + 36, y1 + 8, 184, 240);
    g.fillStyle = '#2a2622';
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  };
  sheet(0);
  g.font = 'bold 15px "Courier New", monospace';
  g.fillText('MEMO', 48, y1 + 36);
  g.fillText('TO: ALL TENANTS', 48, y1 + 56);
  typed(g, 'Effective immediately the mall will close at 9:00 PM until further notice. Please make sure all gates are fully lowered and locked. Do not use escalator 2. Report anything unusual to Security, ext. 114. — Management', 48, y1 + 84, 160, 12, 15);
  sheet(1);
  g.font = 'bold 14px "Courier New", monospace';
  g.fillText('STAFF ROTA  WK 33', 300, y1 + 32);
  ['DANA', 'LUIS', 'MARGO', 'TREVOR', 'KIM', 'ABE'].forEach((n, k) => {
    g.font = '12px "Courier New", monospace';
    g.fillText(n, 300, y1 + 64 + k * 28);
    for (let d = 0; d < 5; d++) {
      g.strokeStyle = '#6c665c';
      g.strokeRect(352 + d * 22, y1 + 50 + k * 28, 20, 20);
      if (hash(k, d) < 0.5) g.fillText(hash(d, k) < 0.5 ? 'AM' : 'PM', 354 + d * 22, y1 + 64 + k * 28);
    }
  });
  sheet(2, '#f1eee6');
  g.fillStyle = '#7a1c18';
  g.fillRect(2 * 256 + 36, y1 + 8, 184, 70);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.font = 'bold 26px Georgia, serif';
  g.fillText('AUGUST 1997', 2 * 256 + 128, y1 + 52);
  for (let d = 0; d < 31; d++) {
    const cx = 2 * 256 + 50 + ((d + 5) % 7) * 26;
    const cy = y1 + 100 + Math.floor((d + 5) / 7) * 28;
    g.fillStyle = '#2a2622';
    g.font = '13px Arial, sans-serif';
    g.fillText(String(d + 1), cx, cy);
    if (d < 23) {
      g.strokeStyle = '#b3241f';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx - 8, cy - 12);
      g.lineTo(cx + 8, cy + 4);
      g.moveTo(cx + 8, cy - 12);
      g.lineTo(cx - 8, cy + 4);
      g.stroke();
    }
  }
  sheet(3, '#f4f1e8');
  g.textAlign = 'center';
  g.font = 'bold 34px Arial, sans-serif';
  g.fillText('LOST CAT', 3 * 256 + 128, y1 + 46);
  g.fillStyle = '#6f6b66';
  g.fillRect(3 * 256 + 70, y1 + 60, 116, 96);
  g.fillStyle = '#3a3734';
  g.beginPath();
  g.ellipse(3 * 256 + 128, y1 + 116, 34, 26, 0, 0, 7);
  g.fill();
  g.beginPath();
  g.arc(3 * 256 + 128, y1 + 84, 18, 0, 7);
  g.fill();
  g.fillStyle = '#2a2622';
  g.font = 'bold 14px Arial, sans-serif';
  g.fillText('ANSWERS TO "PEPPER"', 3 * 256 + 128, y1 + 176);
  for (let k = 0; k < 7; k++) {
    g.save();
    g.translate(3 * 256 + 46 + k * 26, y1 + 236);
    g.rotate(-Math.PI / 2);
    g.font = '10px Arial, sans-serif';
    g.fillText('555-0148', 0, 4);
    g.restore();
    g.strokeStyle = '#9a958c';
    g.beginPath();
    g.moveTo(3 * 256 + 59 + k * 26, y1 + 196);
    g.lineTo(3 * 256 + 59 + k * 26, y1 + 248);
    g.stroke();
  }
  sheet(4, '#1e2a3a');
  g.fillStyle = '#e8d8b0';
  g.textAlign = 'center';
  g.font = 'bold 22px Georgia, serif';
  g.fillText('MALL HOURS', 4 * 256 + 128, y1 + 46);
  g.font = '15px Georgia, serif';
  [['MON – THU', '10 – 9'], ['FRI – SAT', '10 – 10'], ['SUNDAY', '12 – 6']].forEach(([a, b], k) => {
    g.fillText(a, 4 * 256 + 92, y1 + 96 + k * 34);
    g.fillText(b, 4 * 256 + 172, y1 + 96 + k * 34);
  });
  g.font = 'italic 12px Georgia, serif';
  g.fillText('Holiday hours may vary', 4 * 256 + 128, y1 + 216);
  // le tableau de liège : du liège, des feuilles punaisées de travers
  g.fillStyle = '#9a7449';
  g.fillRect(5 * 256 + 4, y1 + 40, 248, 176);
  for (let k = 0; k < 900; k++) {
    g.fillStyle = `rgba(${60 + r() * 80},${40 + r() * 50},20,0.35)`;
    g.fillRect(5 * 256 + 4 + r() * 248, y1 + 40 + r() * 176, 2, 2);
  }
  for (let k = 0; k < 6; k++) {
    g.save();
    g.translate(5 * 256 + 40 + (k % 3) * 80 + r() * 10, y1 + 60 + Math.floor(k / 3) * 80 + r() * 10);
    g.rotate((r() - 0.5) * 0.3);
    g.fillStyle = ['#f3eee0', '#f5e66a', '#f2c6c6', '#cfe3f2', '#f3eee0', '#e8f0c8'][k];
    g.fillRect(0, 0, 60, 70);
    g.fillStyle = 'rgba(40,40,40,0.55)';
    for (let l = 0; l < 6; l++) g.fillRect(6, 10 + l * 9, 30 + r() * 20, 2);
    g.fillStyle = ['#c8302a', '#2a5ac8', '#2a9a3a'][k % 3];
    g.beginPath();
    g.arc(30, 4, 4, 0, 7);
    g.fill();
    g.restore();
  }
  g.strokeStyle = '#6b4a2a';
  g.lineWidth = 10;
  g.strokeRect(5 * 256 + 9, y1 + 45, 238, 166);
  // le tableau blanc : traces d'effaçage, quelques mots au feutre
  g.fillStyle = '#e9ecec';
  g.fillRect(6 * 256 + 4, y1 + 40, 248, 176);
  for (let k = 0; k < 14; k++) {
    g.fillStyle = `rgba(90,110,130,${0.03 + r() * 0.05})`;
    g.fillRect(6 * 256 + 10 + r() * 200, y1 + 50 + r() * 140, 30 + r() * 60, 8 + r() * 14);
  }
  g.textAlign = 'left';
  g.fillStyle = '#1d3e8a';
  g.font = 'bold 18px "Marker Felt", "Comic Sans MS", cursive';
  g.fillText('INVENTORY — FRI', 6 * 256 + 20, y1 + 78);
  g.fillStyle = '#b3241f';
  g.fillText('CALL ALARM CO. !!', 6 * 256 + 20, y1 + 112);
  g.fillStyle = '#222';
  g.fillText('esc. 2 → DO NOT USE', 6 * 256 + 20, y1 + 146);
  g.fillText('who has the key ?', 6 * 256 + 20, y1 + 180);
  g.strokeStyle = '#a7aaa8';
  g.lineWidth = 8;
  g.strokeRect(6 * 256 + 8, y1 + 44, 240, 168);
  sheet(7);
  g.font = 'bold 13px "Courier New", monospace';
  g.textAlign = 'left';
  g.fillText('RESTROOM CLEANING LOG', 7 * 256 + 44, y1 + 30);
  for (let k = 0; k < 10; k++) {
    g.strokeStyle = '#8c867a';
    g.beginPath();
    g.moveTo(7 * 256 + 40, y1 + 46 + k * 19);
    g.lineTo(7 * 256 + 216, y1 + 46 + k * 19);
    g.stroke();
    if (k < 6) {
      g.font = '12px "Courier New", monospace';
      g.fillText(`${8 + k * 2}:00   ${['DK', 'LR', 'DK', 'MG', 'LR', '??'][k]}`, 7 * 256 + 46, y1 + 60 + k * 19);
    }
  }
  for (let i = 0; i < 8; i++) if (i !== 5 && i !== 6) age(g, i * 256 + 36, y1 + 8, 184, 240, r, 1.1);
  // rangée 2 : les affiches du centre (caissons du mail)
  const y2 = 512;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  ADS.forEach(([a, b, s, hue, light], i) => {
    const x = i * 256;
    const gr = g.createLinearGradient(x, y2, x + 256, y2 + 256);
    gr.addColorStop(0, `hsl(${hue},55%,${light}%)`);
    gr.addColorStop(1, `hsl(${(hue + 40) % 360},60%,${light * 0.5}%)`);
    g.fillStyle = gr;
    g.fillRect(x, y2, 256, 256);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      g.arc(x + r() * 256, y2 + r() * 256, 20 + r() * 70, 0, 7);
      g.fill();
    }
    g.fillStyle = '#f6efe0';
    fitText(g, a, x + 128, y2 + 70, 220, 46, 'Futura, "Century Gothic", sans-serif');
    g.fillStyle = i === 4 ? '#ffd23a' : '#ffffff';
    fitText(g, b, x + 128, y2 + 124, 230, 58, 'Futura, "Century Gothic", sans-serif');
    g.fillStyle = 'rgba(255,255,255,0.85)';
    fitText(g, s, x + 128, y2 + 196, 220, 18, 'Futura, "Century Gothic", sans-serif', '600');
    g.fillStyle = 'rgba(255,255,255,0.6)';
    fitText(g, 'HALCYON PARK', x + 128, y2 + 232, 160, 12, 'Georgia, serif', 'italic');
    age(g, x, y2, 256, 256, r, 0.6);
  });
  // rangée 3 : orientation et petites plaques
  const y3 = 768;
  const way = (i, bg, fg, a, b) => {
    const x = i * 256;
    g.fillStyle = bg;
    g.fillRect(x + 4, y3 + 72, 248, 112);
    g.fillStyle = fg;
    fitText(g, a, x + 128, y3 + (b ? 112 : 128), 230, 40);
    if (b) fitText(g, b, x + 128, y3 + 156, 230, 28);
    age(g, x + 4, y3 + 72, 248, 112, r, 0.5);
  };
  way(0, '#1d2a44', '#e8e2d0', 'RESTROOMS  →', 'TELEPHONES');
  way(1, '#1d2a44', '#e8e2d0', '←  CINEMAS', 'STARDUST 8');
  way(2, '#1d2a44', '#e8e2d0', 'FOOD COURT  ↑', 'THE PAVILION');
  way(3, '#1f7a3a', '#ffffff', 'EXIT', null);
  way(4, '#f1eee6', '#b3241f', 'FOR LEASE', '555-0170');
  // les bandes de danger
  g.save();
  g.beginPath();
  g.rect(5 * 256 + 4, y3 + 72, 248, 112);
  g.clip();
  g.fillStyle = '#f2c230';
  g.fillRect(5 * 256, y3 + 72, 256, 112);
  g.fillStyle = '#151515';
  for (let k = -4; k < 10; k++) {
    g.beginPath();
    g.moveTo(5 * 256 + k * 40, y3 + 184);
    g.lineTo(5 * 256 + k * 40 + 20, y3 + 184);
    g.lineTo(5 * 256 + k * 40 + 132, y3 + 72);
    g.lineTo(5 * 256 + k * 40 + 112, y3 + 72);
    g.fill();
  }
  g.restore();
  way(6, '#efeee8', '#1a1a1a', 'PLEASE BUS', 'YOUR TABLE');
  way(7, '#efeee8', '#b3241f', 'STAFF ONLY', 'NO ENTRY');
  // rangée 4 : les enseignes de rayon du grand magasin (lettres crème sur bois sombre)
  const y4 = 1024;
  DEPTS.forEach((d, i) => {
    const x = (i % 4) * 512;
    const y = y4 + Math.floor(i / 4) * 128;
    g.fillStyle = '#2a1d14';
    g.fillRect(x, y, 512, 128);
    g.fillStyle = '#e8d8b0';
    fitText(g, d, x + 256, y + 66, 470, 76, 'Futura, "Century Gothic", sans-serif');
    age(g, x, y, 512, 128, r, 0.5);
  });
  return toTex(c);
}
// la case i de l'atlas des plaques (8 × 5) ; les enseignes de rayon : 4 × 2 dans la dernière rangée
const plateUV = (i, x0 = 0, y0 = 0, x1 = 256, y1 = 256) => {
  const cx = (i % 8) * 256;
  const cy = Math.floor(i / 8) * 256;
  return [(cx + x0) / 2048, 1 - (cy + y1) / 1280, (cx + x1) / 2048, 1 - (cy + y0) / 1280];
};
// la partie utile de chaque case : la plaque (rangée 0), la feuille (rangée 1 ; liège et tableau blanc plus larges),
// toute l'affiche (rangée 2), le panneau (rangée 3)
const CROP = (i) => (i < 8 ? [8, 40, 248, 216] : i < 16 ? (i === 13 || i === 14 ? [4, 40, 252, 216] : [36, 8, 220, 248]) : i < 24 ? [0, 0, 256, 256] : [4, 72, 252, 184]);
const deptUV = (i) => {
  const x = (i % 4) * 512;
  const y = 1024 + Math.floor(i / 4) * 128;
  return [x / 2048, 1 - (y + 128) / 1280, (x + 512) / 2048, 1 - y / 1280];
};

// --- L'atlas des salissures (avec transparence) : 8 × 2 cases de 256 × 512 ---
function grimeAtlas() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 1024;
  const g = c.getContext('2d');
  const r = rng(4242);
  const blot = (x, y, rad, col, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${col},${a})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, rad, 0, 7);
    g.fill();
  };
  const cells = [
    // 0 : une auréole d'infiltration (des cernes successifs)
    (x, y) => {
      for (let k = 0; k < 5; k++) {
        g.strokeStyle = `rgba(105,78,40,${0.18 + r() * 0.15})`;
        g.lineWidth = 2 + r() * 5;
        g.beginPath();
        g.ellipse(x + 128 + (r() - 0.5) * 20, y + 150, 100 - k * 16, 120 - k * 18, 0, 0, 7);
        g.stroke();
      }
      blot(x + 128, y + 150, 110, '120,95,55', 0.28);
    },
    // 1 : des coulures depuis le plafond
    (x, y) => {
      blot(x + 128, y, 120, '90,70,45', 0.4);
      for (let k = 0; k < 16; k++) {
        const sx = x + 30 + r() * 196;
        const len = 120 + r() * 360;
        const gr = g.createLinearGradient(0, y, 0, y + len);
        gr.addColorStop(0, 'rgba(80,62,40,0.45)');
        gr.addColorStop(1, 'rgba(80,62,40,0)');
        g.fillStyle = gr;
        g.fillRect(sx, y, 2 + r() * 6, len);
      }
    },
    // 2 : une coulure de rouille (sous un collier, une grille)
    (x, y) => {
      blot(x + 128, y + 30, 40, '130,60,20', 0.6);
      for (let k = 0; k < 10; k++) {
        const sx = x + 110 + r() * 36;
        const len = 150 + r() * 330;
        const gr = g.createLinearGradient(0, y + 30, 0, y + 30 + len);
        gr.addColorStop(0, 'rgba(140,62,18,0.55)');
        gr.addColorStop(1, 'rgba(140,62,18,0)');
        g.fillStyle = gr;
        g.fillRect(sx, y + 30, 2 + r() * 5, len);
      }
    },
    // 3 : les traces au pied du mur (chariots, serpillières, chaussures)
    (x, y) => {
      const gr = g.createLinearGradient(0, y + 512, 0, y + 330);
      gr.addColorStop(0, 'rgba(40,32,24,0.55)');
      gr.addColorStop(1, 'rgba(40,32,24,0)');
      g.fillStyle = gr;
      g.fillRect(x, y + 330, 256, 182);
      for (let k = 0; k < 26; k++) {
        g.strokeStyle = `rgba(25,20,15,${0.2 + r() * 0.3})`;
        g.lineWidth = 1 + r() * 4;
        g.beginPath();
        const sx = x + r() * 256;
        const sy = y + 400 + r() * 100;
        g.moveTo(sx, sy);
        g.lineTo(sx + 20 + r() * 80, sy + (r() - 0.5) * 12);
        g.stroke();
      }
    },
    // 4 : une moisissure (des colonies de points noirs)
    (x, y) => {
      for (let k = 0; k < 9; k++) blot(x + 40 + r() * 176, y + 60 + r() * 300, 30 + r() * 60, '30,38,28', 0.35);
      for (let k = 0; k < 700; k++) {
        const a = r() * 7;
        const d = Math.pow(r(), 0.6) * 120;
        g.fillStyle = `rgba(20,24,18,${0.2 + r() * 0.5})`;
        g.fillRect(x + 128 + Math.cos(a) * d, y + 210 + Math.sin(a) * d * 1.5, 1 + r() * 3, 1 + r() * 3);
      }
    },
    // 5 : de la peinture qui s'écaille (le plâtre dessous)
    (x, y) => {
      for (let k = 0; k < 12; k++) {
        g.fillStyle = `rgba(${170 + r() * 30},${160 + r() * 30},${140 + r() * 20},0.9)`;
        g.beginPath();
        const cx = x + 40 + r() * 176;
        const cy = y + 60 + r() * 380;
        g.moveTo(cx, cy);
        for (let p = 0; p < 7; p++) g.lineTo(cx + (r() - 0.5) * 70, cy + (r() - 0.5) * 50);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(60,50,40,0.5)';
        g.lineWidth = 1.5;
        g.stroke();
      }
    },
    // 6 : un tag à la bombe
    (x, y) => {
      g.save();
      g.translate(x + 128, y + 260);
      g.rotate(-0.12);
      g.font = 'bold italic 92px "Marker Felt", Impact, sans-serif';
      g.textAlign = 'center';
      g.lineWidth = 10;
      g.strokeStyle = 'rgba(20,20,20,0.85)';
      g.strokeText('KR8', 0, 0);
      g.fillStyle = 'rgba(190,40,120,0.85)';
      g.fillText('KR8', 0, 0);
      g.fillRect(-90, 30, 30, 50);
      g.restore();
    },
    // 7 : un autre tag, des coulures de peinture
    (x, y) => {
      g.save();
      g.translate(x + 128, y + 240);
      g.rotate(0.08);
      g.font = 'bold 70px "Marker Felt", Impact, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = 'rgba(40,120,200,0.8)';
      g.fillText('NO ONE', 0, -20);
      g.fillText('LEFT', 0, 50);
      for (let k = 0; k < 8; k++) g.fillRect(-90 + k * 24, 56, 3, 30 + r() * 90);
      g.restore();
    },
    // 8 : une trace de main traînée
    (x, y) => {
      for (let k = 0; k < 4; k++) {
        const gr = g.createLinearGradient(0, y + 160, 0, y + 420);
        gr.addColorStop(0, 'rgba(30,24,20,0.5)');
        gr.addColorStop(1, 'rgba(30,24,20,0)');
        g.fillStyle = gr;
        g.fillRect(x + 90 + k * 22, y + 160 + k * 6, 14, 240 - k * 30);
      }
      blot(x + 128, y + 160, 50, '30,24,20', 0.4);
    },
    // 9 : la crasse d'un angle, un voile gris
    (x, y) => {
      for (let k = 0; k < 6; k++) blot(x + 128 + (r() - 0.5) * 120, y + 100 + r() * 300, 80 + r() * 60, '45,40,32', 0.22);
    },
    // 10 : une fissure
    (x, y) => {
      g.strokeStyle = 'rgba(25,20,16,0.75)';
      g.lineWidth = 2;
      g.beginPath();
      let cx = x + 128;
      let cy = y + 10;
      g.moveTo(cx, cy);
      while (cy < y + 500) {
        cx += (r() - 0.5) * 30;
        cy += 10 + r() * 22;
        g.lineTo(cx, cy);
        if (r() < 0.12) {
          g.moveTo(cx, cy);
          g.lineTo(cx + (r() - 0.5) * 60, cy + 30);
          g.moveTo(cx, cy);
        }
      }
      g.stroke();
    },
    // 11 : les restes d'une affiche arrachée
    (x, y) => {
      for (let k = 0; k < 9; k++) {
        g.fillStyle = ['rgba(236,228,206,0.95)', 'rgba(200,60,50,0.9)', 'rgba(40,70,120,0.9)'][k % 3];
        g.beginPath();
        const cx = x + 30 + r() * 196;
        const cy = y + 120 + r() * 260;
        g.moveTo(cx, cy);
        for (let p = 0; p < 5; p++) g.lineTo(cx + (r() - 0.5) * 60, cy + (r() - 0.5) * 60);
        g.fill();
      }
      g.fillStyle = 'rgba(200,190,160,0.8)';
      for (const [sx, sy] of [[40, 110], [210, 110], [40, 400], [210, 400]]) g.fillRect(x + sx, y + sy, 26, 12);
    },
    // 12 : la marque claire d'un panneau décroché (et ses trous de vis)
    (x, y) => {
      g.fillStyle = 'rgba(255,250,235,0.16)';
      g.fillRect(x + 28, y + 150, 200, 140);
      g.fillStyle = 'rgba(20,20,20,0.7)';
      for (const [sx, sy] of [[40, 162], [216, 162], [40, 278], [216, 278]]) {
        g.beginPath();
        g.arc(x + sx, y + sy, 4, 0, 7);
        g.fill();
      }
    },
    // 13 : la suie au-dessus d'une lampe
    (x, y) => {
      for (let k = 0; k < 5; k++) blot(x + 128, y + 360 - k * 50, 60 + k * 18, '25,22,20', 0.18);
    },
    // 14 : des éclaboussures (sol mouillé, seau renversé)
    (x, y) => {
      for (let k = 0; k < 40; k++) blot(x + r() * 256, y + 380 + r() * 130, 3 + r() * 14, '60,50,35', 0.35);
    },
    // 15 : des coulures noires (eau sale le long d'un mur)
    (x, y) => {
      for (let k = 0; k < 7; k++) {
        const sx = x + 40 + r() * 176;
        const gr = g.createLinearGradient(0, y + 60, 0, y + 512);
        gr.addColorStop(0, 'rgba(20,18,16,0.0)');
        gr.addColorStop(0.3, 'rgba(20,18,16,0.35)');
        gr.addColorStop(1, 'rgba(20,18,16,0.05)');
        g.fillStyle = gr;
        g.fillRect(sx, y + 60, 10 + r() * 24, 452);
      }
    },
  ];
  cells.forEach((f, i) => f((i % 8) * 256, Math.floor(i / 8) * 512));
  return toTex(c);
}
// les numéros des places au pochoir (jaune usé, sur fond transparent) : 32 cases de 128 × 64
function stencilAtlas() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.font = 'bold 52px "DIN Condensed", "Arial Narrow", Impact, sans-serif';
  for (let i = 0; i < 32; i++) {
    const x = (i % 8) * 128;
    const y = Math.floor(i / 8) * 64;
    g.fillStyle = 'rgba(214, 178, 62, 0.85)';
    g.fillText('A' + String(i + 1).padStart(2, '0'), x + 64, y + 52);
    // l'usure : la peinture partie par endroits
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 26; k++) {
      g.fillStyle = `rgba(0,0,0,${0.3 + hash(i, k) * 0.6})`;
      g.fillRect(x + hash(i, k, 1) * 128, y + hash(i, k, 2) * 64, 2 + hash(i, k, 3) * 14, 1 + hash(i, k, 4) * 5);
    }
    g.globalCompositeOperation = 'source-over';
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const stencilUV = (i) => [(i % 8) / 8, 1 - (Math.floor(i / 8) + 1) / 4, ((i % 8) + 1) / 8, 1 - Math.floor(i / 8) / 4];

const grimeUV = (i) => {
  const cx = (i % 8) * 256;
  const cy = Math.floor(i / 8) * 512;
  return [cx / 2048, 1 - (cy + 512) / 1024, (cx + 256) / 2048, 1 - cy / 1024];
};

let ATLAS = null; // les deux atlas, dessinés une fois (les deux étages s'en servent)

export function drawMallWalls({ map, fi, G, MATS, hAt, baked, rooms, model, placed = [], show = {}, arcade = null }) {
  const W = map.W;
  const H = map.H;
  const PI = Math.PI;
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  const phong = (o) => new THREE.MeshPhongMaterial(o);
  if (!ATLAS) ATLAS = { plates: plateAtlas(), grime: grimeAtlas(), stencil: stencilAtlas() };
  if (!MATS.plates) {
    MATS.plates = { m: baked(lam({ map: ATLAS.plates })), S: 1 };
    MATS.platesLit = { m: new THREE.MeshBasicMaterial({ map: ATLAS.plates, color: new THREE.Color(1, 1, 1).multiplyScalar(0.95) }), S: 1 };
    const gm = lam({ map: ATLAS.grime, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    MATS.grime = { m: baked(gm), S: 1, order: 1 };
    MATS.mirror = { m: baked(phong({ color: '#1e272b', specular: '#b4c4cc', shininess: 150 }), { spec: 0.9, gloss: 160, mask: 0 }), S: 1 };
    MATS.cream = { m: baked(lam({ color: '#cfc8b6' })), S: 1 };
    MATS.fireRed = { m: baked(phong({ color: '#8c1a16', specular: '#5a3a3a', shininess: 40 })), S: 1 };
    // la peinture au sol du parking : les lignes blanches, les numéros au pochoir (posés sur le béton, sans scintiller)
    const off = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 };
    MATS.lineW = { m: baked(lam({ color: '#b9b3a2', ...off })), S: 1 };
    MATS.lineY = { m: baked(lam({ color: '#b8932a', ...off })), S: 1 };
    MATS.stencil = { m: baked(lam({ map: ATLAS.stencil, transparent: true, depthWrite: false, ...off })), S: 1, order: 1 };
    ['#5a1f1b', '#1f3a5a', '#2f4a2a', '#6a5a3a', '#3a2a4a', '#8a7a5a'].forEach((c, i) => (MATS['bk' + i] = { m: baked(lam({ map: MATS.__tx && MATS.__tx.fabrics ? MATS.__tx.fabrics[1] : null, color: c })), S: 4 }));
  }
  const cell = (x, z) => (x < 0 || z < 0 || x >= W || z >= H ? WALL : map.grid[z * W + x]);
  const zoneAt = (x, z) => map.zone[z * W + x];

  // ce qui occupe déjà les abords des murs : les meubles (leurs emprises), les modèles posés (un rayon chacun)
  const near = new Map();
  const key = (x, z) => Math.floor(x / 2) * 4096 + Math.floor(z / 2);
  const mark = (x, z, rad) => {
    for (let a = Math.floor((x - rad) / 2); a <= Math.floor((x + rad) / 2); a++)
      for (let b = Math.floor((z - rad) / 2); b <= Math.floor((z + rad) / 2); b++) {
        const k = a * 4096 + b;
        if (!near.has(k)) near.set(k, []);
        near.get(k).push([x, z, rad]);
      }
  };
  for (const p of placed) mark(p[0], p[1], p[2]);
  const boxes = [];
  for (const it of map.furn || []) {
    const hx = ((it.rot ? it.d : it.w) || 1) / 2;
    const hz = ((it.rot ? it.w : it.d) || 1) / 2;
    boxes.push([it.x - hx, it.x + hx, it.z - hz, it.z + hz]);
  }
  for (const p of Object.values(map.pillars || {})) boxes.push([p.x - (p.h || 0.5), p.x + (p.h || 0.5), p.z - (p.h || 0.5), p.z + (p.h || 0.5)]);
  const free = (x, z, rad) => {
    for (const b of boxes) if (x > b[0] - rad && x < b[1] + rad && z > b[2] - rad && z < b[3] + rad) return false;
    const l = near.get(key(x, z));
    if (l) for (const [px, pz, pr] of l) if ((px - x) ** 2 + (pz - z) ** 2 < (pr + rad) ** 2) return false;
    return true;
  };

  // --- les pans de mur : les cases libres d'une même salle le long d'un même mur ---
  const runs = [];
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const alongX = dz !== 0;
    const rows = alongX ? H : W;
    const N = alongX ? W : H;
    for (let a = 0; a < rows; a++) {
      let start = -1;
      let rid = -1;
      for (let b = 0; b <= N; b++) {
        const x = alongX ? b : a;
        const z = alongX ? a : b;
        let id = -1;
        if (b < N && cell(x, z) === FLOOR && cell(x + dx, z + dz) === WALL) id = zoneAt(x, z);
        if (id >= 0 && id === rid) continue;
        if (start >= 0) {
          const room = rooms[rid];
          if (room) {
            const face = (a + 0.5 + (alongX ? dz : dx) * 0.5) * C;
            runs.push({ room, alongX, nx: -dx, nz: -dz, face, s0: start * C, s1: b * C, row: a, ceil: hAt(alongX ? start : a, alongX ? a : start) || room.ceilH || 3.2 });
          }
        }
        start = id >= 0 ? b : -1;
        rid = id;
      }
    }
  }

  // un point du pan : à s le long du mur, à d du mur (vers la salle)
  const at = (R, s, d = 0) => (R.alongX ? [s, R.face + R.nz * d] : [R.face + R.nx * d, s]);
  const yawOf = (R) => Math.atan2(R.nx, R.nz);
  // une boîte collée au mur : de s - w/2 à s + w/2, de y0 à y1, de d0 à d1 du mur
  const wbox = (k, R, s, w, y0, y1, d0, d1, skip = '') => {
    const [ax, az] = at(R, s - w / 2, d0);
    const [bx, bz] = at(R, s + w / 2, d1);
    G.box(k, Math.min(ax, bx), Math.max(ax, bx), y0, y1, Math.min(az, bz), Math.max(az, bz), skip);
  };
  // une face texturée (une case d'atlas), à d du mur, tournée vers la salle
  const face = (k, uv, R, s, y, w, h, d = 0.012) => {
    const g = new THREE.PlaneGeometry(w, h);
    const a = g.attributes.uv;
    for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) > 0 ? uv[2] : uv[0], a.getY(i) > 0 ? uv[3] : uv[1]);
    g.rotateY(yawOf(R));
    const [x, z] = at(R, s, d);
    G.add(k, g.translate(x, y, z));
  };
  const wmodel = (name, R, s, y, d = 0, sc = 1, piece = '*', rz = 0, rx = 0) => {
    const [x, z] = at(R, s, d);
    model(name, x, y, z, yawOf(R), sc, rx, rz, piece);
  };

  // --- les objets muraux ---
  // une plaque (consigne, papier) : un fond mince et sa face
  const plate = (R, s, y, i, w = 0.4, h = 0.4, back = 'cream', lit = false) => {
    if (back) wbox(back, R, s, w + 0.02, y - h / 2 - 0.01, y + h / 2 + 0.01, 0, 0.008, '');
    face(lit ? 'platesLit' : 'plates', plateUV(i, ...CROP(i)), R, s, y, w, h, 0.011);
  };
  const SAFE = (i) => i; // rangée 0
  const NOTE = (i) => 8 + i; // rangée 1
  // un caisson d'affiche : un cadre d'acier, l'affiche derrière une vitre (une sur trois éclairée, les autres éteintes)
  const adBox = (R, s, y, i, lit) => {
    const w = 1.2;
    const h = 1.2;
    wbox('steel', R, s, w + 0.1, y - h / 2 - 0.05, y + h / 2 + 0.05, 0, 0.09, '');
    wbox('black', R, s, w, y - h / 2, y + h / 2, 0.09, 0.092);
    face(lit ? 'platesLit' : 'plates', plateUV(16 + (i % 8)), R, s, y, w, h, 0.094);
    face('glass', [0, 0, 1, 1], R, s, y, w, h, 0.1);
  };
  // un panneau d'orientation suspendu au mur (rangée 3)
  const sign = (R, s, y, i, w = 1.0) => {
    wbox('black', R, s, w + 0.04, y - w * 0.23, y + w * 0.23, 0, 0.04);
    face('plates', plateUV(24 + i, ...CROP(24 + i)), R, s, y, w, w * 0.44, 0.042);
  };
  // une armoire à incendie : un caisson rouge, une vitre, la plaque, un dévidoir derrière
  const fireCabinet = (R, s) => {
    wbox('fireRed', R, s, 0.75, 0.9, 1.85, 0, 0.24);
    wbox('steel', R, s, 0.62, 1.0, 1.75, 0.24, 0.25);
    face('glass', [0, 0, 1, 1], R, s, 1.375, 0.58, 0.7, 0.256);
    wmodel('garden_hose_wall_mounted_01', R, s, 1.35, 0.01, 0.9);
    plate(R, s, 2.08, SAFE(5), 0.42, 0.31, 'cream');
  };
  // un sèche-mains, un distributeur d'essuie-mains
  const dryer = (R, s) => {
    wbox('plastic', R, s, 0.28, 1.05, 1.32, 0, 0.2);
    wbox('steel', R, s, 0.1, 1.0, 1.05, 0.08, 0.16);
  };
  const towels = (R, s) => {
    wbox('plastic', R, s, 0.3, 1.2, 1.6, 0, 0.12);
    wbox('black', R, s, 0.22, 1.21, 1.23, 0.02, 0.122);
  };
  // un miroir encadré
  const mirror = (R, s, y, w, h, frame = 'wood') => {
    wbox(frame, R, s, w + 0.08, y - h / 2 - 0.04, y + h / 2 + 0.04, 0, 0.03);
    wbox('mirror', R, s, w, y - h / 2, y + h / 2, 0.03, 0.034, '');
  };
  // ce qu'on range sur une étagère quand les modèles seraient trop lourds : des vêtements pliés en piles (boutiques de
  // mode), des livres, des boîtes de produits
  const FOLD = ['clothes', 'shoes', 'lingerie', 'kids', 'salon', 'luggage', 'outdoor', 'sports'];
  const goods = (R, s, y, w, trade, seed) => {
    if (trade === 'books' || trade === 'cards') return books(R, s, y, w, seed);
    const n = Math.floor(w / 0.34);
    for (let i = 0; i < n; i++) {
      if (hash(seed, i, 5) < 0.2) continue;
      const u = s - w / 2 + 0.17 + i * 0.34;
      if (FOLD.includes(trade)) {
        const m = MATS.fab0 ? 'fab' + Math.floor(hash(seed, i, 6) * 6) : 'cloth';
        const k = 2 + Math.floor(hash(seed, i, 7) * 4);
        for (let j = 0; j < k; j++) wbox(m, R, u + (hash(seed, i, j) - 0.5) * 0.03, 0.28, y + j * 0.055, y + j * 0.055 + 0.05, 0.04, 0.27);
      } else {
        const bw = 0.1 + hash(seed, i, 6) * 0.12;
        const bh = 0.12 + hash(seed, i, 7) * 0.14;
        for (let j = 0; j < 2; j++) wbox(hash(seed, i, 8) < 0.5 ? 'carton' : 'bk' + Math.floor(hash(seed, i, 9) * 6), R, u - 0.07 + j * (bw + 0.02), bw, y, y + bh, 0.05, 0.05 + bw * 1.2);
      }
    }
  };
  // les objets assez légers pour être posés par dizaines sur des étagères (moins de 9 000 triangles)
  const LIGHT = new Set(['office_notepads', 'Television_01', 'croissant', 'television_02', 'brass_vase_03', 'baseball_bat', 'postcard_set_01', 'wooden_cutting_board', 'medical_box', 'bleach_bottle', 'rubber_duck_toy', 'football', 'brass_pan_01', 'american_football', 'all_purpose_cleaner', 'cassette_player', 'jug_01', 'multi_cleaner_bottle', 'food_apple_01', 'Ukulele_01', 'potted_plant_04', 'alarm_clock_01']);
  // une étagère murale et ce qu'on y range
  const wallShelf = (R, s, y, w, all, seed, trade) => {
    wbox('wood', R, s, w, y - 0.03, y, 0, 0.3);
    for (const k of [-1, 1]) wbox('black', R, s + (k * w) / 2.6, 0.03, y - 0.2, y - 0.03, 0, 0.26);
    const items = all && all.filter((e) => LIGHT.has(e[0]));
    if (trade && (!items || !items.length || FOLD.includes(trade) || hash(seed, 1, 1) < 0.35)) return goods(R, s, y, w, trade, seed);
    if (!items || !items.length) return;
    const n = Math.max(1, Math.floor(w / 0.42));
    for (let i = 0; i < n; i++) {
      if (hash(seed, i, 3) < 0.25) continue;
      const [name, sc, piece = '*', rx = 0, dy = 0, rz = 0] = items[(seed + i) % items.length];
      const [x, z] = at(R, s - w / 2 + (i + 0.5) * (w / n), 0.16);
      model(name, x, y + dy, z, yawOf(R) + (hash(seed, i) - 0.5) * 0.8, sc * 0.85, rx, rz, piece);
    }
  };
  // une rangée de livres et de classeurs (dos de couleur, hauteurs inégales, un livre penché de temps en temps)
  const books = (R, s, y, w, seed) => {
    let u = s - w / 2 + 0.06;
    let k = 0;
    while (u < s + w / 2 - 0.08) {
      const t = 0.025 + hash(seed, k) * 0.035;
      const h = 0.17 + hash(seed, k, 1) * 0.12;
      const dp = 0.15 + hash(seed, k, 2) * 0.07;
      if (hash(seed, k, 3) < 0.07) {
        u += 0.12; // un trou
      } else {
        wbox('bk' + Math.floor(hash(seed, k, 4) * 6), R, u + t / 2, t, y, y + h, 0.03, 0.03 + dp);
        u += t + 0.003;
      }
      k++;
    }
  };
  // des cartons rangés sur une étagère (réserves, coulisses)
  const cartons = (R, s, y, w, seed) => {
    for (let i = 0; i < Math.floor(w / 0.45); i++) {
      if (hash(seed, i) < 0.3) continue;
      const bw = 0.32 + hash(seed, i, 1) * 0.1;
      const bh = 0.22 + hash(seed, i, 2) * 0.16;
      wbox('carton', R, s - w / 2 + 0.25 + i * 0.45, bw, y, y + bh, 0.02, 0.02 + bw * 0.9);
    }
  };
  // un cadre (modèle) ou un tableau
  const frames = ['hanging_picture_frame_01', 'hanging_picture_frame_02', 'fancy_picture_frame_01'];
  // une prise, un interrupteur : de petites plaques blanches
  const outlet = (R, s, y) => wbox('plastic', R, s, 0.08, y - 0.06, y + 0.06, 0, 0.012);
  // une grille de ventilation sous le plafond
  const vent = (R, s, y) => {
    wbox('black', R, s, 0.6, y - 0.18, y + 0.18, 0, 0.005);
    wbox('steel', R, s, 0.66, y - 0.21, y + 0.21, 0.005, 0.02, '-y+y');
    face('grille', [0, 0, 1, 0.6], R, s, y, 0.6, 0.36, 0.022);
  };
  // les tuyaux d'un pan (un gros, un fin) sur colliers, sous le plafond
  const pipes = (R) => {
    const yaw = yawOf(R);
    const dirA = R.alongX ? Math.cos(yaw) : -Math.sin(yaw); // le sens du long du mur que prend le +x du modèle
    const yb = R.ceil - 0.55;
    const yt = R.ceil - 0.3;
    for (let s = R.s0 + 0.15; s + 2 <= R.s1 - 0.15; s += 2) {
      const o = dirA > 0 ? s : s + 2;
      wmodel('modular_pipes', R, o, yb, 0.1, 1, 'pipe_200cm_metal', -PI / 2);
      wmodel('modular_pipes', R, o, yt, 0.1, 1, 'pipe_thin_200cm_metal');
      wmodel('modular_pipes', R, s + 1, yb, 0.1, 1, 'pipe_support_metal', -PI / 2);
      wmodel('modular_pipes', R, s + 1.5, yt, 0.1, 1, 'pipe_thin_support_metal', -PI / 2);
    }
  };
  // une gaine de câbles qui descend du plafond jusqu'à une boîte de dérivation
  const conduit = (R, s, yBox) => {
    wmodel('modular_electric_cables', R, s, yBox, 0, 1.4, 'cable_box_4way');
    for (let y = yBox + 0.28; y < R.ceil - 0.1; y += 0.61 * 1.4) wmodel('modular_electric_cables', R, s - 0.02, y, 0, 1.4, 'cable_straight_long');
  };
  // une salissure (une case de l'atlas des salissures) : w de large, de y0 à y1
  const grime = (R, s, y0, y1, w, i) => face('grime', grimeUV(i), R, s, (y0 + y1) / 2, w, y1 - y0, 0.006);
  const grimeRun = (R, per, pick, seed) => {
    const len = R.s1 - R.s0;
    const n = Math.floor(len / per + hash(seed, 9));
    for (let k = 0; k < n; k++) {
      const s = R.s0 + 0.4 + hash(seed, k) * (len - 0.8);
      const i = pick[Math.floor(hash(seed, k, 1) * pick.length)];
      const w = 0.8 + hash(seed, k, 2) * 1.4;
      if (i === 3 || i === 14) grime(R, s, 0, 0.45 + hash(seed, k, 3) * 0.4, w * 1.4, i);
      else if (i === 1 || i === 15) grime(R, s, R.ceil * (0.25 + hash(seed, k, 3) * 0.3), R.ceil, w, i);
      else {
        const y = 0.8 + hash(seed, k, 3) * (R.ceil - 1.8);
        grime(R, s, y, y + w * 1.7, w, i);
      }
    }
  };

  // --- le choix, pièce par pièce ---
  const shopOfRoom = new Map();
  for (const sh of map.shops || []) shopOfRoom.set(sh.room, sh);
  // les créneaux d'un pan : tous les step mètres, à distance des bouts, là où rien n'encombre le mur
  const slots = (R, step, margin, rad, fn, seed) => {
    const len = R.s1 - R.s0;
    if (len < 2 * margin + 0.2) return;
    const n = Math.max(1, Math.floor((len - 2 * margin) / step));
    const pad = (len - 2 * margin - (n - 1) * step) / 2;
    for (let i = 0; i < n; i++) {
      const s = R.s0 + margin + pad + i * step + (hash(seed, i, 7) - 0.5) * step * 0.25;
      const [x, z] = at(R, s, 0.35);
      if (!free(x, z, rad)) continue;
      mark(...at(R, s, 0.1), rad * 0.8);
      fn(s, i, hash(seed, i));
    }
  };

  for (const R of runs) {
    const kind = R.room.kind;
    const len = R.s1 - R.s0;
    const seed = R.row * 131 + Math.floor(R.s0) * 7 + (R.nx + 2) * 3 + R.nz + fi * 977;
    const sh = shopOfRoom.get(R.room.id);
    // une prise de courant tous les 4 m environ, presque partout
    if (kind !== 'screen' && kind !== 'court' && kind !== 'plaza')
      for (let s = R.s0 + 1.2; s < R.s1 - 0.8; s += 3.5 + hash(seed, s) * 2) if (free(...at(R, s, 0.3), 0.2)) outlet(R, s, 0.32);

    if (kind === 'service' || kind === 'dock') {
      const corridor = R.room.x0 === R.room.x1 || R.room.z0 === R.room.z1;
      // les tuyaux : sur le mur sud des couloirs est-ouest (le nord porte la gaine de ventilation), sur tous les grands murs ailleurs
      if (len > 5 && (!corridor || (R.alongX ? R.nz < 0 : R.nx < 0))) pipes(R);
      slots(R, 2.3, 0.8, 0.4, (s, i, h) => {
        if (h < 0.18) plate(R, s, 1.6, SAFE([0, 3, 6, 7, 2][i % 5]), 0.42, 0.31);
        else if (h < 0.34) wmodel('industrial_wall_lamp', R, s, 2.35, 0);
        else if (h < 0.4) wmodel('power_box_01', R, s, 1.5, 0.05);
        else if (h < 0.6) conduit(R, s, 1.3);
        else if (h < 0.72) {
          plate(R, s, 1.55, NOTE([0, 7, 1][i % 3]), 0.3, 0.4, null);
          grime(R, s, 0.9, 2.1, 0.7, 13);
        } else if (h < 0.8) vent(R, s, R.ceil - 0.5);
        else if (h < 0.9 && kind === 'dock') wmodel('garden_hose_wall_mounted_01', R, s, 1.4, 0.01, 1.2);
        else if (h < 0.9 && !corridor) wmodel(i % 2 ? 'utility_box_01' : 'utility_box_02', R, s, 0, 0.22);
        else wmodel('fire_alarm', R, s, 1.45, 0, 1.2);
      }, seed);
      grimeRun(R, 4, [1, 2, 3, 3, 9, 15, 10, 13], seed);
    } else if (kind === 'office') {
      slots(R, 1.7, 0.7, 0.45, (s, i, h) => {
        if (h < 0.22) wmodel(frames[i % 3], R, s, 1.65, 0, i % 3 === 2 ? 1.6 : 1);
        else if (h < 0.36) {
          wbox('wood', R, s, 1.28, 1.0, 1.92, 0, 0.02);
          face('plates', plateUV(NOTE(5), ...CROP(NOTE(5))), R, s, 1.46, 1.2, 0.86, 0.022);
        } else if (h < 0.5) {
          face('plates', plateUV(NOTE(6), ...CROP(NOTE(6))), R, s, 1.5, 1.6, 1.1, 0.02);
          wbox('steel', R, s, 1.4, 0.92, 0.95, 0, 0.07);
        } else if (h < 0.62) plate(R, s, 1.55, NOTE(i % 2 ? 2 : 0), 0.3, 0.4, null);
        else if (h < 0.74) {
          wallShelf(R, s, 1.45, 1.2, null, seed + i);
          books(R, s, 1.45, 1.2, seed + i);
          wallShelf(R, s, 1.9, 1.2, null, seed + i + 1);
          books(R, s, 1.9, 0.8, seed + i + 2);
          wmodel('office_notepads', R, s + 0.42, 1.9, 0.15, 1, 'office_notepads_a4_stack');
        }
        else if (h < 0.84) {
          wallShelf(R, s, 1.95, 1.2, null, seed + i);
          cartons(R, s, 1.95, 1.2, seed + i);
        } else plate(R, s, 1.6, NOTE(4), 0.32, 0.42, null);
      }, seed);
      if (len > 4 && hash(seed, 5) < 0.5) wmodel('wall_clock', R, R.s0 + len * 0.5, 2.25, 0);
      grimeRun(R, 6, [9, 12, 12, 3, 0, 10], seed);
    } else if (kind === 'wc') {
      slots(R, 1.2, 0.5, 0.3, (s, i, h) => {
        if (h < 0.3) dryer(R, s);
        else if (h < 0.55) towels(R, s);
        else if (h < 0.7) plate(R, s, 1.55, SAFE(4), 0.36, 0.26);
        else if (h < 0.8) plate(R, s, 1.5, NOTE(7), 0.26, 0.36, null);
      }, seed);
      grimeRun(R, 2.5, [4, 4, 1, 15, 3, 14, 10], seed);
    } else if (kind === 'shop' || kind === 'closed') {
      const trade = sh ? sh.trade : 'vacant';
      const gutted = kind === 'closed' || trade === 'vacant' || (sh && sh.state === 'gutted');
      slots(R, 1.65, 0.6, 0.45, (s, i, h) => {
        if (gutted) {
          if (h < 0.25) plate(R, s, 1.4, 28, 1.0, 0.44, null);
          else if (h < 0.5) grime(R, s, 0.9, 2.4, 1.2, 11);
          else if (h < 0.7) conduit(R, s, 1.1);
          else grime(R, s, 0.6, 2.3, 1.4, 6 + (i % 2));
          return;
        }
        const items = show[trade];
        if (h < 0.5) {
          wallShelf(R, s, 1.05, 1.4, items, seed + i * 3, trade);
          wallShelf(R, s, 1.5, 1.4, items, seed + i * 3 + 1, trade);
          wallShelf(R, s, 1.95, 1.4, items, seed + i * 3 + 2, trade);
          if (R.ceil > 3.6) adBox(R, s, 2.95, i + seed + 3, false);
        } else if (h < 0.52 && ['clothes', 'shoes', 'lingerie', 'salon', 'optician', 'jewelry', 'perfume'].includes(trade)) mirror(R, s, 1.35, 0.6, 1.6, 'brass');
        else if (h < 0.7) adBox(R, s, 1.75, i + seed, false);
        else if (h < 0.8) plate(R, s, 2.0, 31, 0.8, 0.35, null);
        else if (h < 0.9) wmodel('wall_clock', R, s, 2.3, 0);
        else wmodel(frames[i % 3], R, s, 1.7, 0, 1.4);
      }, seed);
      grimeRun(R, gutted ? 2.5 : 5, gutted ? [5, 6, 7, 11, 12, 3, 1, 10, 4] : [12, 3, 9, 0], seed);
    } else if (kind === 'store') {
      slots(R, 2.6, 0.9, 0.55, (s, i, h) => {
        if (h < 0.3) {
          wbox('black', R, s, 2.5, 2.85, 3.4, 0, 0.06);
          face('plates', deptUV((seed + i) % 8), R, s, 3.125, 2.4, 0.6, 0.062);
        } else if (h < 0.5) mirror(R, s, 1.3, 0.7, 1.9, 'wood');
        else if (h < 0.75) adBox(R, s, 1.8, i * 3 + seed, i % 3 === 0);
        else {
          wallShelf(R, s, 1.4, 2.0, null, seed + i);
          cartons(R, s, 1.4, 2.0, seed + i);
        }
      }, seed);
      grimeRun(R, 5, [12, 3, 9, 0, 1], seed);
    } else if (kind === 'screen') {
      // les salles : des panneaux de velours capitonnés sur les murs latéraux, des appliques de laiton
      if (!R.alongX) continue;
      for (let s = R.s0 + 1.4; s + 1.2 < R.s1 - 0.6; s += 2.6) {
        wbox('velvet', R, s, 2.3, 0.6, R.ceil - 1.2, 0, 0.07);
        wbox('brass', R, s + 1.3, 0.06, 0.6, R.ceil - 1.2, 0, 0.08);
        if (Math.round(s) % 2) {
          wbox('brass', R, s + 1.3, 0.16, 3.2, 3.5, 0.08, 0.18);
          wbox('plastic', R, s + 1.3, 0.22, 3.5, 3.75, 0.1, 0.24);
        }
      }
      grimeRun(R, 6, [0, 1, 4], seed);
    } else if (kind === 'cine' || kind === 'cineHall' || (kind === 'portal' && /Cinema|Ticket/.test(R.room.name || ''))) {
      slots(R, 2.0, 0.7, 0.45, (s, i, h) => {
        if (h < 0.55) {
          // une affiche de film dans un cadre de laiton
          wbox('brass', R, s, 1.08, 0.9, 2.5, 0, 0.05);
          face('postersOff', [(i % 4) / 4, (Math.floor(i / 4) % 2 ? 0 : 0.5), ((i % 4) + 1) / 4, (Math.floor(i / 4) % 2 ? 0.5 : 1)], R, s, 1.7, 0.98, 1.47, 0.052);
          face('glass', [0, 0, 1, 1], R, s, 1.7, 1.0, 1.5, 0.06);
        } else if (h < 0.75) {
          wbox('velvet', R, s, 1.6, 0.4, 2.6, 0, 0.05);
          wbox('brass', R, s, 1.7, 2.6, 2.66, 0, 0.07);
        } else if (h < 0.85) sign(R, s, 2.5, 3, 0.8);
        else wmodel('fire_alarm', R, s, 1.45, 0, 1.2);
      }, seed);
      grimeRun(R, 6, [0, 9, 12, 3], seed);
    } else if (kind === 'food') {
      slots(R, 2.4, 0.8, 0.5, (s, i, h) => {
        if (h < 0.3) {
          wbox('black', R, s, 0.12, 2.35, 2.55, 0, 0.3);
          wmodel('television_02', R, s, 2.55, 0.26, 1.1);
        } else if (h < 0.5) sign(R, s, 1.8, 6, 0.9);
        else if (h < 0.75) adBox(R, s, 1.8, i + seed, i % 2 === 0);
        else if (h < 0.85) wmodel('wall_clock', R, s, 2.4, 0, 1.4);
        else fireCabinet(R, s);
      }, seed);
      grimeRun(R, 5, [3, 14, 9, 12, 1], seed);
    } else if (kind === 'lobby' || kind === 'portal') {
      slots(R, 2.2, 0.7, 0.45, (s, i, h) => {
        if (h < 0.4) adBox(R, s, 1.75, i + seed, i % 2 === 0);
        else if (h < 0.6) sign(R, s, 2.3, i % 3, 1.0);
        else if (h < 0.75) fireCabinet(R, s);
        else if (h < 0.85) plate(R, s, 1.6, NOTE(4), 0.4, 0.52, null);
        else wmodel('industrial_wall_lamp', R, s, 2.6, 0);
      }, seed);
      grimeRun(R, 4, [3, 9, 0, 1, 12, 15], seed);
    } else if (kind === 'parking') {
      // le parking : des tuyaux sous le plafond, les sorties, des consignes, des bandes de danger, l'eau qui a coulé
      if (len > 5) pipes(R);
      slots(R, 2.5, 0.8, 0.45, (s, i, h) => {
        if (h < 0.18) sign(R, s, 2.25, 3, 0.9);
        else if (h < 0.34) wmodel('industrial_wall_lamp', R, s, 2.35, 0);
        else if (h < 0.48) conduit(R, s, 1.3);
        else if (h < 0.58) fireCabinet(R, s);
        else if (h < 0.72) plate(R, s, 1.6, SAFE([0, 3, 6, 7][i % 4]), 0.42, 0.31);
        else if (h < 0.86) plate(R, s, 0.55, 29, 1.6, 0.5, null);
        else wmodel('fire_alarm', R, s, 1.45, 0, 1.2);
      }, seed);
      grimeRun(R, 3, [1, 2, 3, 9, 15, 10, 13, 5], seed);
    } else if (kind === 'fun') {
      // la salle de jeux : des affiches de jeux sous cadre, les enseignes TOKENS et FUNLAND, l'horloge
      slots(R, 2.0, 0.6, 0.45, (s, i, h) => {
        if (h < 0.5 && arcade) {
          wbox('black', R, s, 1.0, 1.16, 2.64, 0, 0.03);
          face(i % 3 ? 'arcDim' : 'arcLit', arcade.poster(i + seed), R, s, 1.9, 0.92, 1.42, 0.032);
        } else if (h < 0.64 && arcade) {
          wbox('black', R, s, 1.3, 2.62, 3.28, 0, 0.05);
          face('arcLit', arcade.sign(i % 2 ? 'tokens' : 'funland'), R, s, 2.95, 1.2, 0.6, 0.052);
        } else if (h < 0.76) wmodel('wall_clock', R, s, 2.5, 0, 1.2);
        else if (h < 0.88) fireCabinet(R, s);
        else plate(R, s, 1.6, NOTE(4), 0.4, 0.52, null);
      }, seed);
      grimeRun(R, 5, [3, 9, 0, 12], seed);
    } else if (kind === 'court' || kind === 'plaza' || kind === 'mail') {
      slots(R, 2.5, 0.9, 0.5, (s, i, h) => {
        if (h < 0.4) adBox(R, s, 1.8, i + seed, i % 3 === 0);
        else if (h < 0.6) sign(R, s, 2.6, i % 3, 1.1);
        else if (h < 0.78) fireCabinet(R, s);
        else if (h < 0.88) plate(R, s, 1.6, NOTE(4), 0.45, 0.58, null);
        else vent(R, s, Math.min(R.ceil - 0.6, 3.6));
      }, seed);
      grimeRun(R, 5, [3, 9, 0, 1, 12], seed);
    }
  }

  // --- le sol du parking : les places (lignes, butées de béton, numéros au pochoir), les taches d'huile, les flèches ---
  for (const r of rooms) {
    if (r.kind !== 'parking' || !r.bays) continue;
    const seen = new Set();
    const flat = (k, uv, x, z, w, d, yaw = 0) => {
      const g = new THREE.PlaneGeometry(w, d).rotateX(-PI / 2);
      if (uv) {
        const a = g.attributes.uv;
        for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) > 0 ? uv[2] : uv[0], a.getY(i) > 0 ? uv[3] : uv[1]);
      }
      G.add(k, g.rotateY(yaw).translate(x, 0.004, z));
    };
    r.bays.forEach((b, i) => {
      for (const sx of [-1.25, 1.25]) {
        const k = Math.round((b.x + sx) * 4) + ':' + Math.round(b.z * 4);
        if (seen.has(k)) continue;
        seen.add(k);
        flat('lineW', null, b.x + sx, b.z, 0.1, 4.9);
      }
      // la butée, à la tête de la place ; le numéro, peint côté allée
      if (hash(i, fi, 7) < 0.85) G.box('lineY', b.x - 0.85, b.x + 0.85, 0, 0.11, b.z + b.head * 2.05 - 0.08, b.z + b.head * 2.05 + 0.08, '-y');
      flat('stencil', stencilUV(i % 32), b.x, b.z - b.head * 1.7, 0.9, 0.45, b.head > 0 ? PI : 0);
      if (hash(i, fi, 41) < 0.45) flat('grime', grimeUV([3, 9, 13, 5][i % 4]), b.x + (hash(i, 2) - 0.5) * 0.6, b.z + (hash(i, 3) - 0.5) * 1.2, 1.1 + hash(i, 4), 1.4 + hash(i, 5), hash(i, 6) * 6);
    });
    // les flèches de circulation dans les deux allées (un sens unique : vers l'est au nord, vers l'ouest au sud)
    const X0 = r.x0 * C;
    const X1 = (r.x1 + 1) * C;
    const arrow = new THREE.Shape([[-0.9, -0.12], [0.3, -0.12], [0.3, -0.4], [0.9, 0], [0.3, 0.4], [0.3, 0.12], [-0.9, 0.12]].map(([a, b]) => new THREE.Vector2(a, b)));
    for (const [z, dir] of [[r.z0 * C + 7.6, 1], [(r.z1 + 1) * C - 7.6, -1]])
      for (let x = X0 + 9; x < X1 - 8; x += 14) {
        const g = new THREE.ShapeGeometry(arrow).rotateX(-PI / 2);
        G.add('lineW', g.rotateY(dir > 0 ? 0 : PI).translate(x, 0.005, z));
      }
  }
}
