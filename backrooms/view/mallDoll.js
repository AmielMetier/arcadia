// The Backrooms (Level 17, le Mall) - Miss Marigold, la grande poupée de parade du Halcyon Park Mall (engine/doll.js) :
// 3,75 m sur son socle à roulettes. Une jupe en cloche à rayures souci et crème, un tablier festonné, un corsage
// bordeaux barré d'une écharpe à son nom, des manches ballon, une tête de papier mâché peinte (grands yeux, pommettes
// roses, petit sourire), des anglaises rousses sous un canotier fleuri. Formes tournées, textures peintes ; la lumière
// est celle de l'étage (baked), plus les feux de couleur et la lampe.
// Elle ne s'anime pas : on ne la voit jamais bouger. Sa pose ne change que hors des regards (setPose) : au loin elle
// salue, de près elle tend les bras et penche la tête vers celui qui approche.
// paintMarigold : le même personnage dessiné à plat, pour les bannières de la cour ouest et les cartons du film.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { mergeGeometries } from '../../shared/vendor/three/BufferGeometryUtils.js';

const PI = Math.PI;
const COL = { gold: '#e8a020', cream: '#f3e6c4', wine: '#7a1f2a', skin: '#f1d9c0', rose: '#e0787a', hair: '#8a3b1c', straw: '#d9b76a', ink: '#2a1a12', brass: '#c9a24a' };

// --- Le dessin à plat : (cx, footY) le milieu de son socle, h sa hauteur en pixels ---
export function paintMarigold(g, cx, footY, h, o = {}) {
  const s = h / 100;
  const X = (x) => cx + x * s;
  const Y = (v) => footY - v * s;
  const ell = (x, v, rx, ry, fill, stroke = true) => {
    g.beginPath();
    g.ellipse(X(x), Y(v), rx * s, ry * s, 0, 0, PI * 2);
    g.fillStyle = fill;
    g.fill();
    if (stroke) g.stroke();
  };
  g.save();
  g.lineWidth = Math.max(1, 0.55 * s);
  g.strokeStyle = o.line || COL.ink;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // le socle et ses roulettes
  for (const x of [-15, 0, 15]) ell(x, 1.6, 2.1, 1.7, '#1c1a18');
  g.fillStyle = COL.wine;
  g.beginPath();
  g.rect(X(-21), Y(8), 42 * s, 5 * s);
  g.fill();
  g.stroke();
  g.fillStyle = COL.brass;
  g.fillRect(X(-21), Y(6.2), 42 * s, 0.9 * s);
  // la jupe en cloche, ses rayures, la bande du bas, le tablier festonné
  const skirt = () => {
    g.beginPath();
    g.moveTo(X(-7.2), Y(54));
    g.quadraticCurveTo(X(-19), Y(34), X(-20.5), Y(9));
    g.lineTo(X(20.5), Y(9));
    g.quadraticCurveTo(X(19), Y(34), X(7.2), Y(54));
    g.closePath();
  };
  skirt();
  g.fillStyle = COL.gold;
  g.fill();
  g.save();
  skirt();
  g.clip();
  g.fillStyle = COL.cream;
  for (let i = -4; i <= 4; i++) {
    g.beginPath();
    g.moveTo(X(i * 1.55 - 0.45), Y(54));
    g.lineTo(X(i * 1.55 + 0.45), Y(54));
    g.lineTo(X(i * 4.7 + 1.25), Y(8));
    g.lineTo(X(i * 4.7 - 1.25), Y(8));
    g.closePath();
    g.fill();
  }
  g.fillStyle = COL.wine;
  g.fillRect(X(-22), Y(12.2), 44 * s, 3.4 * s);
  g.restore();
  skirt();
  g.stroke();
  g.beginPath();
  g.moveTo(X(-5.4), Y(54));
  g.quadraticCurveTo(X(-9.4), Y(40), X(-9.6), Y(27));
  for (let i = 0; i < 4; i++) g.quadraticCurveTo(X(-9.6 + i * 4.8 + 2.4), Y(22.5), X(-9.6 + (i + 1) * 4.8), Y(27));
  g.quadraticCurveTo(X(9.4), Y(40), X(5.4), Y(54));
  g.closePath();
  g.fillStyle = COL.cream;
  g.fill();
  g.stroke();
  // les bras : l'un le long du corps, l'autre levé qui salue
  const arm = (x0, v0, x1, v1) => {
    g.lineWidth = 3.6 * s;
    g.strokeStyle = o.line || COL.ink;
    g.beginPath();
    g.moveTo(X(x0), Y(v0));
    g.lineTo(X(x1), Y(v1));
    g.stroke();
    g.lineWidth = 2.6 * s;
    g.strokeStyle = COL.gold;
    g.stroke();
    g.lineWidth = Math.max(1, 0.55 * s);
    g.strokeStyle = o.line || COL.ink;
    ell(x1 + (x1 - x0) * 0.12, v1 + (v1 - v0) * 0.12, 2.5, 2.5, COL.skin);
  };
  arm(-12, 68, -15.5, 50);
  arm(12, 69, 20, 84);
  // le corsage, ses boutons, l'écharpe, les manches ballon, le nœud du col
  g.beginPath();
  g.moveTo(X(-7.2), Y(54));
  g.lineTo(X(-9.6), Y(72.5));
  g.lineTo(X(9.6), Y(72.5));
  g.lineTo(X(7.2), Y(54));
  g.closePath();
  g.fillStyle = COL.wine;
  g.fill();
  g.stroke();
  g.save();
  g.beginPath();
  g.moveTo(X(-9.4), Y(71));
  g.lineTo(X(-6.6), Y(72.4));
  g.lineTo(X(7.4), Y(55.6));
  g.lineTo(X(5.6), Y(54.2));
  g.closePath();
  g.fillStyle = COL.cream;
  g.fill();
  g.restore();
  for (const v of [58, 62.5, 67]) ell(0.2, v, 0.85, 0.85, COL.brass, false);
  for (const sx of [-1, 1]) ell(sx * 11.6, 69.6, 5, 4.6, COL.gold);
  g.fillStyle = COL.skin;
  g.fillRect(X(-2.2), Y(76.4), 4.4 * s, 4 * s);
  g.beginPath();
  g.moveTo(X(0), Y(73.6));
  g.lineTo(X(-5.4), Y(76.2));
  g.lineTo(X(-5.4), Y(71));
  g.closePath();
  g.moveTo(X(0), Y(73.6));
  g.lineTo(X(5.4), Y(76.2));
  g.lineTo(X(5.4), Y(71));
  g.closePath();
  g.fillStyle = COL.cream;
  g.fill();
  g.stroke();
  // les cheveux (derrière la tête), les anglaises
  ell(0, 85.6, 10.8, 10.4, COL.hair);
  for (const sx of [-1, 1]) for (const [x, v] of [[9.9, 80.2], [10.4, 75.6]]) ell(sx * x, v, 2.9, 2.9, COL.hair);
  // la tête, les pommettes, les yeux, les cils, les sourcils, la bouche
  ell(0, 85, 9.4, 9.8, COL.skin);
  for (const sx of [-1, 1]) {
    ell(sx * 5.5, 81.8, 2.3, 2.1, COL.rose, false);
    ell(sx * 3.7, 86.2, 1.9, 2.5, '#ffffff', false);
    ell(sx * 3.7, 86, 1.45, 2.05, '#14100d', false);
    ell(sx * 3.7 + 0.5, 86.9, 0.45, 0.5, '#ffffff', false);
    g.beginPath();
    g.arc(X(sx * 3.7), Y(88.4), 3 * s, sx > 0 ? -PI * 0.78 : -PI * 0.72, sx > 0 ? -PI * 0.28 : -PI * 0.22);
    g.stroke();
    for (const k of [-1, 0, 1]) {
      g.beginPath();
      g.moveTo(X(sx * 3.7 + k * 1.2), Y(88.4));
      g.lineTo(X(sx * 3.7 + k * 1.75), Y(89.5));
      g.stroke();
    }
  }
  g.beginPath();
  g.arc(X(0), Y(81.6), 2.3 * s, PI * 0.18, PI * 0.82);
  g.strokeStyle = '#b3202a';
  g.lineWidth = 0.95 * s;
  g.stroke();
  g.strokeStyle = o.line || COL.ink;
  g.lineWidth = Math.max(1, 0.55 * s);
  // la frange, puis le canotier : son bord, sa calotte, son ruban, sa fleur
  g.save();
  g.beginPath();
  g.ellipse(X(0), Y(85), 9.4 * s, 9.8 * s, 0, 0, PI * 2);
  g.clip();
  g.beginPath();
  g.moveTo(X(-10), Y(96));
  g.lineTo(X(-10), Y(89.4));
  for (let i = 0; i < 5; i++) g.quadraticCurveTo(X(-10 + i * 4 + 2), Y(91.6), X(-10 + (i + 1) * 4), Y(89.6));
  g.lineTo(X(10), Y(96));
  g.closePath();
  g.fillStyle = COL.hair;
  g.fill();
  g.restore();
  ell(0, 94, 13.6, 2.3, COL.straw);
  g.beginPath();
  g.rect(X(-7.6), Y(99.4), 15.2 * s, 5.2 * s);
  g.fillStyle = COL.straw;
  g.fill();
  g.stroke();
  g.fillStyle = COL.wine;
  g.fillRect(X(-7.6), Y(96.8), 15.2 * s, 2 * s);
  ell(5.4, 96.2, 2.3, 2.3, '#f08a1c');
  ell(5.4, 96.2, 0.9, 0.9, '#8a4a10', false);
  g.restore();
}

// le crochet des cartons du film (view/mallCinema.js) : la mascotte à gauche du titre, sur les cartons qui parlent
// d'elle. Renvoie de combien pousser le texte
export function marigoldFilmArt(g, i, W, H) {
  if (i < 1 || i > 3) return 0;
  g.save();
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.beginPath();
  g.arc(170, H / 2, 132, 0, 7);
  g.fill();
  paintMarigold(g, 170, H - 16, H - 30);
  if (i === 3) {
    // « elle ne danse que quand personne ne regarde » : des traits de mouvement
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 4;
    for (const [x, y, a] of [[70, 110, -0.5], [58, 160, 0], [72, 212, 0.5], [270, 110, 3.6], [282, 160, PI], [268, 212, 2.6]]) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - Math.cos(a) * 26, y - Math.sin(a) * 26);
      g.stroke();
    }
  }
  g.restore();
  return 110;
}

// --- Le modèle ---
const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const texOf = (c, repeat = false) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = THREE.RepeatWrapping;
  return t;
};
const canvasOf = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
};
// une forme tournée dont la couture est dans le dos (u = 0,5 devant), la texture étalée selon la hauteur
const turned = (pts, seg, sz = 1) => {
  const g = lathe(pts, seg).rotateY(PI);
  const p = g.attributes.position;
  const u = g.attributes.uv;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < p.count; i++) {
    y0 = Math.min(y0, p.getY(i));
    y1 = Math.max(y1, p.getY(i));
  }
  for (let i = 0; i < p.count; i++) u.setY(i, (p.getY(i) - y0) / (y1 - y0));
  if (sz !== 1) g.scale(1, 1, sz);
  g.computeVertexNormals();
  return g;
};
const grime = (g, w, h, n, a) => {
  for (let i = 0; i < n; i++) {
    const x = ((i * 2654435761) >>> 0) % w;
    const y = ((i * 40503 + 977) * 31) % h;
    const r = 6 + ((i * 97) % 40);
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, `rgba(40,26,14,${a})`);
    gr.addColorStop(1, 'rgba(40,26,14,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
};

function skirtTex() {
  const [c, g] = canvasOf(1024, 512);
  g.fillStyle = COL.gold;
  g.fillRect(0, 0, 1024, 512);
  g.fillStyle = COL.cream;
  for (let i = 0; i < 24; i++) g.fillRect(i * (1024 / 24) + 12, 0, 1024 / 24 - 25, 512);
  // les plis : une ombre dans chaque creux
  for (let i = 0; i < 24; i++) {
    const x = i * (1024 / 24);
    const gr = g.createLinearGradient(x - 9, 0, x + 9, 0);
    gr.addColorStop(0, 'rgba(60,30,6,0)');
    gr.addColorStop(0.5, 'rgba(60,30,6,0.34)');
    gr.addColorStop(1, 'rgba(60,30,6,0)');
    g.fillStyle = gr;
    g.fillRect(x - 9, 0, 18, 512);
  }
  // le tablier (devant : u = 0,5), festonné, sa poche
  g.fillStyle = '#efe2c2';
  g.beginPath();
  g.moveTo(400, 0);
  g.lineTo(372, 330);
  for (let i = 0; i < 7; i++) g.quadraticCurveTo(372 + i * 40 + 20, 372, 372 + (i + 1) * 40, 330);
  g.lineTo(624, 0);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(122,31,42,0.75)';
  g.lineWidth = 4;
  g.stroke();
  g.strokeRect(540, 190, 52, 58);
  // la bande du bas, son galon en zigzag
  g.fillStyle = COL.wine;
  g.fillRect(0, 474, 1024, 38);
  g.strokeStyle = COL.cream;
  g.lineWidth = 3;
  g.beginPath();
  for (let x = 0; x <= 1024; x += 16) g.lineTo(x, 462 + ((x / 16) % 2) * 9);
  g.stroke();
  // la poussière du bas, des auréoles
  const d = g.createLinearGradient(0, 300, 0, 512);
  d.addColorStop(0, 'rgba(30,20,10,0)');
  d.addColorStop(1, 'rgba(30,20,10,0.42)');
  g.fillStyle = d;
  g.fillRect(0, 300, 1024, 212);
  grime(g, 1024, 512, 60, 0.16);
  return texOf(c, true);
}
function bodiceTex() {
  const [c, g] = canvasOf(512, 256);
  g.fillStyle = COL.wine;
  g.fillRect(0, 0, 512, 256);
  // la dentelle du col (en haut), la ceinture (en bas)
  g.fillStyle = COL.cream;
  g.fillRect(0, 0, 512, 44);
  for (let x = 0; x < 512; x += 22) {
    g.beginPath();
    g.arc(x + 11, 44, 11, 0, PI);
    g.fill();
  }
  g.fillRect(0, 236, 512, 20);
  // la patte de boutonnage (devant), quatre boutons de laiton
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fillRect(250, 50, 12, 190);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = COL.brass;
    g.beginPath();
    g.arc(256, 84 + i * 42, 8, 0, 7);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath();
    g.arc(253, 81 + i * 42, 2.5, 0, 7);
    g.fill();
  }
  // l'écharpe à son nom, en travers
  g.save();
  g.translate(256, 150);
  g.rotate(0.62);
  g.fillStyle = '#f6ecd0';
  g.fillRect(-170, -19, 340, 38);
  g.strokeStyle = COL.brass;
  g.lineWidth = 3;
  g.strokeRect(-170, -15, 340, 30);
  g.fillStyle = COL.wine;
  g.font = 'bold 22px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.fillText('MISS MARIGOLD', 0, 8);
  g.restore();
  grime(g, 512, 256, 26, 0.18);
  return texOf(c, true);
}
// le visage : peint dans le repère de la tête (x en mètres le long de sa joue, y depuis le menton)
function headTex() {
  const [c, g] = canvasOf(512, 512);
  const R = 0.335;
  const Hh = 0.7;
  const X = (x) => 256 + (x / R / (2 * PI)) * 512;
  const Y = (y) => 512 - (y / Hh) * 512;
  const kx = 512 / (2 * PI * R);
  const ky = 512 / Hh;
  const ell = (x, y, rx, ry, fill) => {
    g.beginPath();
    g.ellipse(X(x), Y(y), rx * kx, ry * ky, 0, 0, 7);
    g.fillStyle = fill;
    g.fill();
  };
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#f4dfc8');
  gr.addColorStop(1, '#e6c6a8');
  g.fillStyle = gr;
  g.fillRect(0, 0, 512, 512);
  // les cheveux peints : tout l'arrière et le dessus, une raie de frange ondulée sur le front
  g.fillStyle = COL.hair;
  g.fillRect(0, 0, 512, Y(0.565));
  g.fillRect(0, 0, X(-0.36), 512);
  g.fillRect(X(0.36), 0, 512 - X(0.36), 512);
  for (let i = -3; i <= 3; i++) ell(i * 0.105, 0.565, 0.062, 0.03, COL.hair);
  g.strokeStyle = 'rgba(40,14,4,0.5)';
  g.lineWidth = 2;
  for (let i = 0; i < 90; i++) {
    const x = (i * 131) % 512;
    if (x > X(-0.34) && x < X(0.34)) continue;
    g.beginPath();
    g.moveTo(x, (i * 53) % 200);
    g.lineTo(x + ((i % 5) - 2) * 3, ((i * 53) % 200) + 240);
    g.stroke();
  }
  // les pommettes, l'ombre du nez et du menton
  for (const sx of [-1, 1]) {
    const cg = g.createRadialGradient(X(sx * 0.175), Y(0.25), 2, X(sx * 0.175), Y(0.25), 0.075 * ky);
    cg.addColorStop(0, 'rgba(224,104,112,0.95)');
    cg.addColorStop(0.75, 'rgba(224,104,112,0.8)');
    cg.addColorStop(1, 'rgba(224,104,112,0)');
    g.save();
    g.translate(X(sx * 0.175), Y(0.25));
    g.scale(kx / ky * 1.25, 1);
    g.translate(-X(sx * 0.175), -Y(0.25));
    g.fillStyle = cg;
    g.fillRect(X(sx * 0.175) - 80, Y(0.25) - 80, 160, 160);
    g.restore();
  }
  // les yeux : grands, ronds, trop écartés ; l'iris noir, un reflet ; la paupière, trois cils ; le sourcil haut
  for (const sx of [-1, 1]) {
    ell(sx * 0.13, 0.4, 0.078, 0.08, '#fbf6ea');
    ell(sx * 0.13, 0.392, 0.06, 0.066, '#100c0a');
    ell(sx * 0.13 + 0.02, 0.424, 0.015, 0.015, '#ffffff');
    g.strokeStyle = '#1c120c';
    g.lineWidth = 6;
    g.beginPath();
    g.ellipse(X(sx * 0.13), Y(0.4), 0.08 * kx, 0.082 * ky, 0, PI * 1.05, PI * 1.95);
    g.stroke();
    g.lineWidth = 3.5;
    for (const k of [-1, 0, 1]) {
      g.beginPath();
      g.moveTo(X(sx * 0.13 + k * 0.045), Y(0.474));
      g.lineTo(X(sx * 0.13 + k * 0.066), Y(0.512));
      g.stroke();
    }
    g.lineWidth = 4;
    g.strokeStyle = '#5a2812';
    g.beginPath();
    g.ellipse(X(sx * 0.13), Y(0.5), 0.082 * kx, 0.045 * ky, 0, PI * 1.15, PI * 1.85);
    g.stroke();
  }
  // la bouche : un petit arc rouge, les commissures relevées
  g.strokeStyle = '#a81822';
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.beginPath();
  g.ellipse(X(0), Y(0.215), 0.062 * kx, 0.04 * ky, 0, PI * 0.12, PI * 0.88);
  g.stroke();
  ell(0, 0.185, 0.022, 0.014, '#a81822');
  for (const sx of [-1, 1]) ell(sx * 0.066, 0.212, 0.008, 0.008, '#7a1f2a');
  // le papier mâché a vieilli : un réseau de craquelures, des écailles
  g.strokeStyle = 'rgba(70,40,20,0.3)';
  g.lineWidth = 1;
  let s = 99;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 70; i++) {
    let x = X(-0.33) + rnd() * (X(0.33) - X(-0.33));
    let y = Y(0.56) + rnd() * (512 - Y(0.56));
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (rnd() - 0.5) * 22;
      y += (rnd() - 0.3) * 26;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  grime(g, 512, 512, 30, 0.12);
  return texOf(c, true);
}
function drumTex() {
  const [c, g] = canvasOf(1024, 64);
  g.fillStyle = COL.wine;
  g.fillRect(0, 0, 1024, 64);
  g.fillStyle = COL.brass;
  g.fillRect(0, 4, 1024, 4);
  g.fillRect(0, 56, 1024, 4);
  g.font = 'bold 30px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  [['MISS MARIGOLD', 170], ['✿', 341], ['HALCYON PARK MALL', 512], ['✿', 683], ['MISS MARIGOLD', 854], ['✿', 1022], ['✿', 2]].forEach(([t, x]) => g.fillText(t, x, 43));
  grime(g, 1024, 64, 20, 0.2);
  return texOf(c, true);
}
function strawTex() {
  const [c, g] = canvasOf(128, 128);
  g.fillStyle = COL.straw;
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 6) {
    g.fillStyle = y % 12 ? 'rgba(90,60,20,0.22)' : 'rgba(255,240,200,0.2)';
    g.fillRect(0, y, 128, 2);
    for (let x = (y / 6) % 2 ? 0 : 5; x < 128; x += 10) {
      g.fillStyle = 'rgba(70,45,15,0.25)';
      g.fillRect(x, y, 1, 6);
    }
  }
  const t = texOf(c, true);
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 2);
  return t;
}

// bakedOf(fi) : la fonction « baked » de l'étage fi (la poupée change de matières en changeant d'étage)
export function createMallDoll({ bakedOf, floors = 2 }) {
  const group = new THREE.Group();
  const tex = { skirt: skirtTex(), bodice: bodiceTex(), head: headTex(), drum: drumTex(), straw: strawTex() };
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  const phong = (o) => new THREE.MeshPhongMaterial(o);
  const make = (baked) => ({
    skirt: baked(lam({ map: tex.skirt })),
    bodice: baked(lam({ map: tex.bodice })),
    head: baked(phong({ map: tex.head, specular: '#3a3028', shininess: 34 }), { spec: 0.3, gloss: 50, mask: 0 }),
    drum: baked(phong({ map: tex.drum, specular: '#40302a', shininess: 30 }), { spec: 0.3, gloss: 50, mask: 0 }),
    straw: baked(lam({ map: tex.straw })),
    wine: baked(phong({ color: COL.wine, specular: '#40302a', shininess: 30 }), { spec: 0.3, gloss: 50, mask: 0 }),
    gold: baked(lam({ color: '#d9941c' })),
    cream: baked(lam({ color: '#e9dcba' })),
    skin: baked(phong({ color: '#ecd2b6', specular: '#3a3028', shininess: 34 }), { spec: 0.3, gloss: 50, mask: 0 }),
    hair: baked(lam({ color: '#7c3418' })),
    flower: baked(lam({ color: '#ee8418' })),
    brass: baked(phong({ color: '#9c7a34', specular: '#ffe9b0', shininess: 90 }), { spec: 0.9, gloss: 140, mask: 0 }),
    black: baked(phong({ color: '#171615', specular: '#3a3a3a', shininess: 40 })),
  });
  const sets = Array.from({ length: floors }, (_, fi) => make(bakedOf(fi)));
  const meshes = [];
  const bins = new Map();
  const add = (k, geo, parent = null) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    const key = parent ? parent.uuid + k : k;
    if (!bins.has(key)) bins.set(key, { k, parent: parent || group, list: [] });
    bins.get(key).list.push(g);
  };

  // le socle : un tambour mouluré, sa frise à son nom, quatre roulettes pivotantes, la barre de poussée dans le dos
  add('wine', lathe([[0, 0.14], [0.74, 0.14], [0.78, 0.17], [0.78, 0.225], [0.75, 0.24], [0.75, 0.33], [0.78, 0.345], [0.78, 0.395], [0.74, 0.415], [0, 0.415]], 44));
  add('drum', new THREE.CylinderGeometry(0.753, 0.753, 0.088, 44, 1, true).rotateY(PI).translate(0, 0.285, 0));
  add('brass', new THREE.TorusGeometry(0.782, 0.012, 6, 44).rotateX(PI / 2).translate(0, 0.2, 0));
  add('brass', new THREE.TorusGeometry(0.782, 0.012, 6, 44).rotateX(PI / 2).translate(0, 0.37, 0));
  for (let i = 0; i < 4; i++) {
    const a = PI / 4 + (i * PI) / 2;
    const x = Math.sin(a) * 0.56;
    const z = Math.cos(a) * 0.56;
    const yaw = a + 0.9 + i * 0.7; // (chacune tournée comme elle s'est arrêtée)
    add('black', new THREE.CylinderGeometry(0.055, 0.055, 0.018, 14).translate(x, 0.132, z));
    add('black', lathe([[0, -0.024], [0.05, -0.024], [0.068, -0.014], [0.068, 0.014], [0.05, 0.024], [0, 0.024]], 16).rotateZ(PI / 2).rotateY(yaw).translate(x, 0.068, z));
    for (const sd of [-1, 1]) add('brass', new THREE.BoxGeometry(0.006, 0.09, 0.05).translate(sd * 0.03, 0.09, 0).rotateY(yaw).translate(x, 0, z));
  }
  {
    const pts = [[-0.3, 0.41, -0.66], [-0.3, 1.16, -0.76], [-0.27, 1.25, -0.775], [-0.2, 1.27, -0.78], [0.2, 1.27, -0.78], [0.27, 1.25, -0.775], [0.3, 1.16, -0.76], [0.3, 0.41, -0.66]].map((p) => new THREE.Vector3(...p));
    add('brass', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.12), 40, 0.019, 8));
  }
  // la jupe en cloche (le bas festonné), la ceinture
  {
    const g = turned([[0.71, 0.43], [0.742, 0.5], [0.745, 0.62], [0.715, 0.86], [0.655, 1.14], [0.57, 1.42], [0.46, 1.68], [0.36, 1.88], [0.29, 1.99], [0.265, 2.04]], 48);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > 0.9) continue;
      const k = 1 + 0.035 * Math.cos(Math.atan2(p.getX(i), p.getZ(i)) * 12) * (1 - (y - 0.43) / 0.47);
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    add('skirt', g);
  }
  add('cream', new THREE.TorusGeometry(0.27, 0.03, 8, 32).rotateX(PI / 2).scale(1, 1, 0.86).translate(0, 2.04, 0));
  // le corsage (plus plat qu'un tour), le cou
  add('bodice', turned([[0.262, 2.03], [0.285, 2.12], [0.312, 2.3], [0.335, 2.48], [0.332, 2.6], [0.285, 2.69], [0.17, 2.745], [0.1, 2.77]], 30, 0.82));
  add('skin', lathe([[0.1, 2.76], [0.088, 2.8], [0.09, 2.87]], 16));
  // le nœud du col : deux coques, un nœud
  for (const sx of [-1, 1]) add('cream', lathe([[0, -0.07], [0.05, -0.05], [0.07, 0], [0.05, 0.05], [0, 0.07]], 12).scale(1, 1, 0.45).rotateZ(PI / 2 + sx * 0.25).translate(sx * 0.085, 2.775, 0.2));
  add('cream', new THREE.SphereGeometry(0.036, 10, 8).translate(0, 2.775, 0.215));

  // un bras : la manche ballon, le bras raide, le poignet, la moufle (pivot à l'épaule)
  const arm = (sx) => {
    const a = new THREE.Group();
    a.position.set(sx * 0.37, 2.6, 0);
    add('gold', lathe([[0, -0.2], [0.11, -0.17], [0.175, -0.07], [0.185, 0.03], [0.14, 0.13], [0, 0.17]], 18).scale(1, 1, 0.95), a);
    add('gold', lathe([[0.068, -0.86], [0.078, -0.5], [0.092, -0.15]], 14), a);
    add('cream', new THREE.TorusGeometry(0.074, 0.02, 6, 16).rotateX(PI / 2).translate(0, -0.86, 0), a);
    add('skin', lathe([[0, -1.07], [0.05, -1.05], [0.078, -0.98], [0.07, -0.9], [0.052, -0.86]], 14).scale(1, 1, 0.7), a);
    add('skin', lathe([[0, -0.08], [0.022, -0.07], [0.028, 0], [0.02, 0.02]], 8).translate(sx * -0.07, -0.93, 0.01), a);
    group.add(a);
    return a;
  };
  const armR = arm(-1); // son bras droit (à gauche quand on lui fait face) : celui qui salue
  const armL = arm(1);

  // la tête (pivot à la base du cou) : le visage peint, le nez, la frange en rouleau, les anglaises, le canotier
  const head = new THREE.Group();
  head.position.set(0, 2.84, 0);
  group.add(head);
  add('head', turned([[0.0, 0.0], [0.1, 0.0], [0.19, 0.04], [0.275, 0.14], [0.325, 0.27], [0.337, 0.38], [0.32, 0.49], [0.26, 0.6], [0.15, 0.675], [0.0, 0.7]], 34, 0.95), head);
  add('skin', lathe([[0, 0], [0.03, 0.006], [0.04, 0.03], [0.03, 0.055], [0, 0.065]], 10).rotateX(PI / 2).translate(0, 0.31, 0.305), head);
  add('hair', new THREE.TorusGeometry(0.265, 0.062, 8, 18, 2.5).rotateX(PI / 2).rotateY(-(PI - 2.5) / 2).translate(0, 0.56, 0), head);
  for (const sx of [-1, 1])
    [[1.25, 0.02], [1.72, 0.0], [2.25, 0.03]].forEach(([a, dy], i) => {
      const x = Math.sin(a) * 0.335 * sx;
      const z = Math.cos(a) * 0.32;
      add('hair', lathe([[0, 0], [0.045, 0.012], [0.06, 0.07], [0.048, 0.13], [0.06, 0.19], [0.048, 0.25], [0.058, 0.31], [0.04, 0.37], [0, 0.39]], 10).translate(x, 0.04 + dy - i * 0.015, z), head);
    });
  // (le chignon bas, dans le dos)
  add('hair', new THREE.SphereGeometry(0.15, 14, 10).scale(1.25, 0.9, 0.8).translate(0, 0.22, -0.27), head);
  const faceAnchor = new THREE.Object3D();
  faceAnchor.position.set(0, 0.36, 0.95);
  head.add(faceAnchor);
  const hat = new THREE.Group();
  hat.position.set(0, 0.615, 0);
  hat.rotation.set(-0.07, 0, 0.09);
  head.add(hat);
  add('straw', lathe([[0, -0.005], [0.5, -0.03], [0.52, -0.02], [0.5, -0.005], [0.3, 0.012], [0.3, 0.15], [0.285, 0.17], [0, 0.175]], 36), hat);
  add('wine', new THREE.CylinderGeometry(0.304, 0.304, 0.055, 36, 1, true).translate(0, 0.045, 0), hat);
  // la fleur du ruban : un pompon de souci, son cœur, deux feuilles
  add('flower', lathe([[0, 0], [0.05, 0.004], [0.075, 0.025], [0.07, 0.05], [0.04, 0.066], [0, 0.07]], 14).rotateX(PI / 2).translate(0.16, 0.06, 0.262), hat);
  add('flower', lathe([[0, 0], [0.035, 0.004], [0.05, 0.02], [0.03, 0.042], [0, 0.046]], 12).rotateX(PI / 2).translate(0.06, 0.05, 0.3), hat);
  add('hair', new THREE.SphereGeometry(0.02, 8, 6).translate(0.16, 0.06, 0.335), hat);

  for (const b of bins.values()) {
    const m = new THREE.Mesh(b.list.length > 1 ? mergeGeometries(b.list) : b.list[0], sets[0][b.k]);
    m.userData.k = b.k;
    b.parent.add(m);
    meshes.push(m);
  }
  let floorNow = 0;
  const pose = { near: -1, look: 0 };
  const setPose = (near, look) => {
    near = Math.max(0, Math.min(1, near));
    look = Math.max(-1, Math.min(1, look));
    if (Math.abs(near - pose.near) < 1e-3 && Math.abs(look - pose.look) < 1e-3) return;
    pose.near = near;
    pose.look = look;
    const e = near * near * (3 - 2 * near);
    // le bras qui salue descend et se tend ; l'autre se lève à son tour ; la tête se tourne et se penche
    armR.rotation.set(-2.55 + 1.05 * e, 0, -0.42 + 0.3 * e);
    armL.rotation.set(-0.06 - 1.3 * Math.max(0, e * 1.6 - 0.6), 0, 0.2 - 0.08 * e);
    head.rotation.set(0.04 + 0.1 * e, look * 0.85, -look * 0.16 * (0.3 + 0.7 * e));
  };
  setPose(0, 0);
  let tris = 0;
  for (const m of meshes) tris += m.geometry.attributes.position.count / 3;
  return {
    group,
    triangles: tris,
    setPose,
    // l'étage où elle se tient : ses matières prennent la lumière de cet étage
    setFloor(fi) {
      fi = Math.max(0, Math.min(sets.length - 1, fi || 0));
      if (fi === floorNow) return;
      floorNow = fi;
      for (const m of meshes) m.material = sets[fi][m.userData.k];
    },
    update() {
      return null; // (pas de pas : elle roule, et jamais sous les yeux de personne)
    },
    // le screamer : son visage entier dans l'objectif (le repère est à 60 cm devant son nez), bras tendus
    scareFace() {
      setPose(1, 0);
      head.rotation.set(0, 0, 0);
      pose.near = -1;
      return faceAnchor;
    },
  };
}
