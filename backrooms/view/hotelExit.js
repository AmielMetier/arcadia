// The Backrooms (Level 5, le Terror Hotel) - La sortie de secours, au fond du hall :
//  - une porte coupe-feu en acier peint (rouge sang de bœuf, usée en bas), un hublot en verre armé par où l'on devine
//    l'ampoule de l'escalier, une barre anti-panique, une plaque de pied, l'étiquette « EMERGENCY EXIT ONLY » ;
//  - la ventouse magnétique sous l'huisserie, son voyant rouge (vert quand c'est ouvert), et le fourreau du câble qui
//    file le long du mur jusqu'au clavier ;
//  - le boîtier EXIT lumineux au-dessus, sur batterie : il reste allumé même quand tout s'éteint ;
//  - le clavier à code : une plaque d'inox brossé, douze touches gravées, un petit écran vert et deux voyants. Il
//    montre ce que tu tapes (des étoiles), « DENIED » sur un mauvais code, « OPEN » quand la porte se déverrouille.
// La porte s'ouvre en deux temps : le claquement de la ventouse, puis le battant qui pivote lentement vers la cage.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL_SIZE } from '../engine/map.js';

const C = CELL_SIZE;

// ce que le joueur tape au clavier (rempli par app.js depuis le HUD) : code (null si le clavier n'est pas ouvert),
// wrongAt (performance.now() du dernier mauvais code)
export const hotelUi = { code: null, wrongAt: 0 };

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function rr(x, X, Y, w, h, r) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + w, Y, X + w, Y + h, r);
  x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r);
  x.arcTo(X, Y, X + w, Y, r);
  x.closePath();
}
// un petit hasard fixe (le même rendu à chaque partie)
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// la peinture du battant : un rouge sang de bœuf passé au rouleau, des coulures, des éraflures en bas (les chariots,
// les chaussures), le métal gris qui apparaît aux coins, la crasse autour de la barre
function drawPaint(x, w, h) {
  const r = rng(51);
  x.fillStyle = '#6a2018';
  x.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(${r() < 0.5 ? '255,220,200' : '20,0,0'},${0.015 + r() * 0.03})`;
    x.fillRect(r() * w, r() * h, 1 + r() * 2, 20 + r() * 80);
  }
  // l'usure du bas : des éraflures horizontales, grises
  for (let i = 0; i < 70; i++) {
    const y = h - r() * h * 0.16;
    x.strokeStyle = `rgba(${150 + r() * 40},${140 + r() * 30},${130 + r() * 30},${0.15 + r() * 0.35})`;
    x.lineWidth = 0.6 + r() * 1.4;
    x.beginPath();
    const x0 = r() * w;
    x.moveTo(x0, y);
    x.lineTo(x0 + (r() - 0.5) * 60, y + (r() - 0.5) * 4);
    x.stroke();
  }
  // des éclats de peinture, le métal dessous
  for (let i = 0; i < 26; i++) {
    const px = r() < 0.5 ? r() * 18 : w - r() * 18;
    const py = r() * h;
    x.fillStyle = 'rgba(120,118,112,0.75)';
    x.beginPath();
    x.ellipse(px, py, 1 + r() * 3, 1 + r() * 5, r() * 3, 0, 6.3);
    x.fill();
  }
  // la crasse des mains, à hauteur de barre, côté serrure
  const g = x.createRadialGradient(w * 0.82, h * 0.52, 4, w * 0.82, h * 0.52, w * 0.3);
  g.addColorStop(0, 'rgba(15,5,2,0.35)');
  g.addColorStop(1, 'rgba(15,5,2,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  // une coulure de quelque chose de sombre, depuis le hublot
  x.fillStyle = 'rgba(25,6,4,0.4)';
  x.fillRect(w * 0.76, h * 0.16, 3, h * 0.22);
}

// le verre armé : un grillage soudé à mailles carrées, pris dans un verre verdâtre
function drawWire(x, w, h) {
  x.clearRect(0, 0, w, h);
  x.strokeStyle = 'rgba(205,205,195,0.9)';
  x.lineWidth = 1.4;
  const s = w / 8;
  for (let i = 0; i <= 8; i++) {
    x.beginPath();
    x.moveTo(i * s, 0);
    x.lineTo(i * s, h);
    x.stroke();
  }
  for (let j = 0; j <= Math.round(h / s); j++) {
    x.beginPath();
    x.moveTo(0, j * s);
    x.lineTo(w, j * s);
    x.stroke();
  }
}

function drawSign(x, w, h) {
  x.fillStyle = '#f2efe6';
  x.fillRect(0, 0, w, h);
  x.strokeStyle = '#b3241c';
  x.lineWidth = 6;
  x.strokeRect(6, 6, w - 12, h - 12);
  x.fillStyle = '#b3241c';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = 'bold 40px Arial, sans-serif';
  x.fillText('EMERGENCY', w / 2, h * 0.27);
  x.fillText('EXIT ONLY', w / 2, h * 0.5);
  x.font = 'bold 22px Arial, sans-serif';
  x.fillText('ALARM WILL SOUND', w / 2, h * 0.76);
}

// le pictogramme de l'homme qui court vers une porte (en blanc sur vert), le mot EXIT et la flèche
function drawExit(x, w, h) {
  // (rétroéclairé : plus vif au milieu, devant les diodes, un peu terne aux coins)
  x.fillStyle = '#0b7a35';
  x.fillRect(0, 0, w, h);
  const g = x.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.62);
  g.addColorStop(0, 'rgba(120,255,160,0.55)');
  g.addColorStop(0.6, 'rgba(40,200,100,0.25)');
  g.addColorStop(1, 'rgba(0,40,10,0.25)');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  x.fillStyle = '#f4fff6';
  x.strokeStyle = '#f4fff6';
  // la porte
  x.lineWidth = 6;
  x.strokeRect(19, 17, 48, h - 34);
  // l'homme qui court
  x.fillStyle = '#f4fff6';
  x.strokeStyle = '#f4fff6';
  x.lineCap = 'round';
  x.lineWidth = 9;
  const cx = 92;
  const cy = h / 2;
  x.beginPath();
  x.arc(cx + 10, cy - 30, 8, 0, 6.3);
  x.fill();
  x.beginPath();
  x.moveTo(cx + 6, cy - 18);
  x.lineTo(cx - 4, cy + 6);
  x.moveTo(cx - 4, cy + 6);
  x.lineTo(cx + 14, cy + 18);
  x.lineTo(cx + 10, cy + 34);
  x.moveTo(cx - 4, cy + 6);
  x.lineTo(cx - 14, cy + 22);
  x.lineTo(cx - 30, cy + 26);
  x.moveTo(cx + 4, cy - 12);
  x.lineTo(cx + 22, cy - 2);
  x.moveTo(cx + 2, cy - 14);
  x.lineTo(cx - 16, cy - 8);
  x.stroke();
  // EXIT et la flèche
  x.font = 'bold 54px Arial, sans-serif';
  x.textAlign = 'left';
  x.textBaseline = 'middle';
  x.fillText('EXIT', 134, cy + 3);
  x.beginPath();
  x.moveTo(w - 70, cy - 9);
  x.lineTo(w - 36, cy - 9);
  x.lineTo(w - 36, cy - 22);
  x.lineTo(w - 14, cy);
  x.lineTo(w - 36, cy + 22);
  x.lineTo(w - 36, cy + 9);
  x.lineTo(w - 70, cy + 9);
  x.closePath();
  x.fill();
}

// le clavier : la plaque d'inox brossé et ses touches gravées (KW × KH pixels pour 0,12 × 0,2 m) ; screen, leds : ce qui
// est allumé ; pressed : la touche qu'on vient d'enfoncer
const KW = 240;
const KH = 400;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
const keyRect = (i) => ({ x: 26 + (i % 3) * 66, y: 150 + Math.floor(i / 3) * 52, w: 56, h: 42 });
function drawPlate(x, pressed) {
  const r = rng(77);
  const g = x.createLinearGradient(0, 0, KW, KH);
  g.addColorStop(0, '#b9bcbd');
  g.addColorStop(0.5, '#9a9d9f');
  g.addColorStop(1, '#adb0b2');
  x.fillStyle = g;
  x.fillRect(0, 0, KW, KH);
  // le brossage : de fines rayures horizontales
  for (let i = 0; i < 700; i++) {
    x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,40,40'},${0.03 + r() * 0.05})`;
    x.fillRect(r() * KW - 40, r() * KH, 40 + r() * 120, 1);
  }
  // les traces de doigts autour des touches qui servent le plus
  for (let i = 0; i < 4; i++) {
    const k = keyRect(Math.floor(r() * 12));
    const f = x.createRadialGradient(k.x + 28, k.y + 21, 2, k.x + 28, k.y + 21, 40);
    f.addColorStop(0, 'rgba(60,50,40,0.12)');
    f.addColorStop(1, 'rgba(60,50,40,0)');
    x.fillStyle = f;
    x.fillRect(0, 0, KW, KH);
  }
  // la marque, gravée
  x.fillStyle = 'rgba(40,42,44,0.8)';
  x.font = 'bold 15px Arial, sans-serif';
  x.textAlign = 'left';
  x.fillText('SECURA', 26, 30);
  x.font = '11px Arial, sans-serif';
  x.fillText('ACCESS 4', 26, 44);
  // la fenêtre de l'écran, enfoncée
  x.fillStyle = '#1c1f1d';
  rr(x, 22, 62, KW - 44, 56, 6);
  x.fill();
  // les touches : des boutons bombés, chiffre gravé noirci
  KEYS.forEach((k, i) => {
    const b = keyRect(i);
    const down = pressed === k;
    x.fillStyle = 'rgba(0,0,0,0.35)';
    rr(x, b.x + 1, b.y + 3, b.w, b.h, 9);
    x.fill();
    const kg = x.createLinearGradient(0, b.y, 0, b.y + b.h);
    kg.addColorStop(0, down ? '#7d8083' : '#d9dcdd');
    kg.addColorStop(1, down ? '#9a9da0' : '#8f9295');
    x.fillStyle = kg;
    rr(x, b.x, b.y + (down ? 2 : 0), b.w, b.h, 9);
    x.fill();
    x.strokeStyle = 'rgba(30,30,30,0.5)';
    x.lineWidth = 1.5;
    x.stroke();
    x.fillStyle = '#1d1f21';
    x.font = 'bold 26px Arial, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(k, b.x + b.w / 2, b.y + b.h / 2 + 2 + (down ? 2 : 0));
  });
  // la grille du haut-parleur, les quatre vis
  x.fillStyle = 'rgba(20,20,20,0.75)';
  for (let j = 0; j < 3; j++) for (let i = 0; i < 9; i++) {
    x.beginPath();
    x.arc(KW / 2 - 40 + i * 10, 364 + j * 9, 2, 0, 6.3);
    x.fill();
  }
  for (const [sx, sy] of [[12, 12], [KW - 12, 12], [12, KH - 12], [KW - 12, KH - 12]]) {
    x.fillStyle = '#6f7275';
    x.beginPath();
    x.arc(sx, sy, 5, 0, 6.3);
    x.fill();
    x.strokeStyle = '#2b2c2d';
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(sx - 3.5, sy);
    x.lineTo(sx + 3.5, sy);
    x.stroke();
  }
}
// ce qui luit : l'écran (texte vert ou rouge sur fond rétroéclairé) et les deux voyants (red, green : 0 à 1)
function drawGlow(x, text, col, red, green) {
  x.fillStyle = '#000';
  x.fillRect(0, 0, KW, KH);
  x.fillStyle = col === 'red' ? '#3a0d08' : '#0f2c14';
  rr(x, 26, 66, KW - 52, 48, 4);
  x.fill();
  x.fillStyle = col === 'red' ? '#ff5a46' : '#8dff9a';
  x.font = '34px VT323, "Courier New", monospace';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, KW / 2, 91);
  const led = (cx, c, k) => {
    const g = x.createRadialGradient(cx, 30, 1, cx, 30, 12);
    g.addColorStop(0, `rgba(${c},${0.25 + 0.75 * k})`);
    g.addColorStop(0.45, `rgba(${c},${0.12 + 0.5 * k})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(cx - 14, 16, 28, 28);
  };
  led(KW - 58, '255,40,30', red);
  led(KW - 30, '40,255,90', green);
}

export function buildHotelExit({ map, group, baked, CEIL }) {
  const E = map.elevator;
  const kp = map.keypad;
  if (!E || !kp) return { update() {}, lights() {} };
  const DW = 1.2;
  const DH = 2.2;
  const box = (w, h, d, mat, x, y, z, parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const frame = (x, z, rot) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    group.add(g);
    return g;
  };
  const steel = baked(new THREE.MeshPhongMaterial({ color: '#a7aaab', specular: '#e8ecee', shininess: 70 }), { spec: 0.5, gloss: 60, mask: 0 });
  const darkMetal = baked(new THREE.MeshLambertMaterial({ color: '#3a3836' }));
  const rubber = new THREE.MeshLambertMaterial({ color: '#0d0d0d' });

  // --- La porte : l'huisserie d'acier (frame +z local : vers la cage), le battant sur ses gonds ---
  const eg = frame(E.x - E.dx * (C / 2), E.z - E.dz * (C / 2), Math.atan2(E.dx, E.dz));
  // la feuillure : l'arrêt de porte en acier, dans l'embrasure, contre lequel le battant se ferme
  for (const s of [-1, 1]) box(0.05, DH, 0.05, darkMetal, s * (DW / 2 - 0.025), DH / 2, 0.035, eg);
  box(DW, 0.05, 0.05, darkMetal, 0, DH - 0.025, 0.035, eg);
  const LW = DW - 0.1;
  const LH = DH - 0.07;
  const LT = 0.05;
  const hinge = new THREE.Group();
  hinge.position.set(-LW / 2, 0.02, 0.085); // l'axe des gonds, côté gauche vu du hall
  eg.add(hinge);
  // le battant : une plaque d'acier peint, percée du hublot (côté serrure, à hauteur d'yeux)
  const WX0 = LW - 0.36;
  const WX1 = LW - 0.14;
  const WY0 = 1.28;
  const WY1 = 1.86;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(LW, 0);
  shape.lineTo(LW, LH);
  shape.lineTo(0, LH);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(WX0, WY0);
  hole.lineTo(WX0, WY1);
  hole.lineTo(WX1, WY1);
  hole.lineTo(WX1, WY0);
  hole.closePath();
  shape.holes.push(hole);
  const leafGeo = new THREE.ExtrudeGeometry(shape, { depth: LT, bevelEnabled: false });
  leafGeo.translate(0, 0, -LT / 2);
  // (les faces : u, v en mètres ; la peinture couvre le battant une fois)
  const [pc, px] = canvas(256, 512);
  drawPaint(px, 256, 512);
  const paintTex = tex(pc);
  paintTex.repeat.set(1 / LW, 1 / LH);
  paintTex.wrapS = paintTex.wrapT = THREE.RepeatWrapping;
  const paint = baked(new THREE.MeshLambertMaterial({ map: paintTex }));
  const leaf = new THREE.Mesh(leafGeo, paint);
  hinge.add(leaf);
  // dans le repère du gond : x de 0 (les gonds) à LW (la serrure, du côté du clavier) ; la face côté hall en z = -LT/2
  const front = -LT / 2;
  // le hublot : le verre verdâtre, le grillage pris dedans, le joint noir autour
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(WX1 - WX0, WY1 - WY0),
    new THREE.MeshPhongMaterial({ color: '#1e2a26', specular: '#9fb0aa', shininess: 160, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }),
  );
  glass.position.set((WX0 + WX1) / 2, (WY0 + WY1) / 2, 0);
  hinge.add(glass);
  const [wc, wx] = canvas(128, 336);
  drawWire(wx, 128, 336);
  const wire = new THREE.Mesh(new THREE.PlaneGeometry(WX1 - WX0, WY1 - WY0), new THREE.MeshBasicMaterial({ map: tex(wc), transparent: true, alphaTest: 0.2, color: '#8d8d84', side: THREE.DoubleSide }));
  wire.position.copy(glass.position);
  wire.position.z = 0.002;
  hinge.add(wire);
  const gx = glass.position.x;
  const gw = WX1 - WX0;
  const gh = WY1 - WY0;
  for (const s of [-1, 1]) {
    box(0.025, gh + 0.05, LT + 0.012, rubber, gx + s * (gw / 2 + 0.0125), (WY0 + WY1) / 2, 0, hinge);
    box(gw, 0.025, LT + 0.012, rubber, gx, s < 0 ? WY0 - 0.0125 : WY1 + 0.0125, 0, hinge);
  }
  // la barre anti-panique : deux boîtiers d'inox, la barre entre les deux
  const latchU = LW - 0.08; // côté serrure (le bord opposé aux gonds)
  box(0.13, 0.09, 0.07, steel, latchU - 0.065, 1.02, front - 0.035, hinge);
  box(0.09, 0.08, 0.06, steel, 0.16, 1.02, front - 0.03, hinge);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, latchU - 0.13 - 0.2, 14), steel);
  bar.rotation.z = Math.PI / 2;
  bar.position.set((0.2 + latchU - 0.13) / 2, 1.02, front - 0.075);
  hinge.add(bar);
  // la bande de la barre : rouge, « PUSH »
  const [bc, bxc] = canvas(256, 32);
  bxc.fillStyle = '#b3241c';
  bxc.fillRect(0, 0, 256, 32);
  bxc.fillStyle = '#fff';
  bxc.font = 'bold 22px Arial, sans-serif';
  bxc.textAlign = 'center';
  bxc.textBaseline = 'middle';
  bxc.fillText('PUSH  TO  OPEN', 128, 17);
  const band = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.024), new THREE.MeshLambertMaterial({ map: tex(bc) }));
  band.position.set(bar.position.x, 1.02, front - 0.0952);
  band.rotation.y = Math.PI;
  hinge.add(band);
  // la plaque de pied, l'étiquette
  box(LW - 0.04, 0.26, 0.003, steel, LW / 2, 0.15, front - 0.0015, hinge);
  const [sc, sx] = canvas(256, 160);
  drawSign(sx, 256, 160);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.19), baked(new THREE.MeshLambertMaterial({ map: tex(sc) })));
  sign.position.set(0.36, 1.56, front - 0.002);
  sign.rotation.y = Math.PI;
  hinge.add(sign);
  // l'armature de la ventouse, en haut du battant côté serrure
  box(0.2, 0.045, 0.012, steel, latchU - 0.14, LH - 0.04, front - 0.006, hinge);
  // les trois gonds, côté cage
  for (const y of [0.25, 1.1, 1.9]) {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.11, 10), steel);
    k.position.set(-0.005, y, LT / 2 + 0.006);
    hinge.add(k);
  }

  // la ventouse sous l'huisserie (côté serrure, côté hall), son voyant ; le fourreau du câble jusqu'au clavier
  const lockX = DW / 2 - 0.05 - 0.14 - 0.04;
  box(0.26, 0.055, 0.045, darkMetal, lockX, DH - 0.055 / 2 - 0.05, 0.0225, eg);
  const lockLed = new THREE.MeshBasicMaterial({ color: '#ff2a1a' });
  box(0.012, 0.012, 0.004, lockLed, lockX + 0.1, DH - 0.075, -0.002, eg);
  // (le clavier, dans le repère de la porte : k.x, k.z)
  const kx = (kp.x - eg.position.x) * Math.cos(eg.rotation.y) - (kp.z - eg.position.z) * Math.sin(eg.rotation.y);
  // (deux fourreaux peints montent sous la corniche, du clavier et de l'huisserie côté serrure, et s'y rejoignent)
  const conduitY = CEIL - 0.2;
  const cd = 0.016;
  const cx0 = DW / 2 - 0.04;
  const pipe = baked(new THREE.MeshLambertMaterial({ color: '#8e8676' }));
  box(cd, conduitY - (kp.y + 0.11), cd, pipe, kx, (conduitY + kp.y + 0.11) / 2, -0.012, eg);
  box(Math.abs(kx - cx0) + cd, cd, cd, pipe, (kx + cx0) / 2, conduitY, -0.012, eg);
  box(cd, conduitY - (DH + 0.07), cd, pipe, cx0, (conduitY + DH + 0.07) / 2, -0.012, eg);

  // --- Le boîtier EXIT : un caisson blanc, la face verte qui luit. Sa lumière verte (sur le mur, l'huisserie, le
  // battant, le sol et le plafond, arrêtée par les murs) est un feu du moteur de lumière : voir lights() ---
  const ex = new THREE.Group();
  ex.position.set(0, DH + 0.36, -0.045);
  eg.add(ex);
  box(0.46, 0.2, 0.08, baked(new THREE.MeshLambertMaterial({ color: '#d8d6cf' })), 0, 0, 0, ex);
  // le diffuseur, sous le caisson : une fente laiteuse par où la lumière tombe sur la porte
  box(0.4, 0.004, 0.05, new THREE.MeshBasicMaterial({ color: '#9dffc0' }), 0, -0.101, -0.005, ex);
  const [xc, xx] = canvas(320, 128);
  drawExit(xx, 320, 128);
  const exitFace = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.168), new THREE.MeshBasicMaterial({ map: tex(xc), toneMapped: false }));
  exitFace.position.set(0, 0, -0.0405);
  exitFace.rotation.y = Math.PI;
  ex.add(exitFace);

  // --- Le clavier ---
  const kg = frame(kp.x, kp.z, kp.rot); // +z local : vers le hall
  box(0.135, 0.215, 0.03, darkMetal, 0, kp.y, 0.015, kg); // le boîtier en saillie
  const [plc, plx] = canvas(KW, KH);
  const [glc, glx] = canvas(KW, KH);
  const plateTex = tex(plc);
  const glowTex = tex(glc);
  const plateMat = baked(new THREE.MeshLambertMaterial({ map: plateTex, emissive: '#ffffff', emissiveMap: glowTex }));
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.006), [darkMetal, darkMetal, darkMetal, darkMetal, plateMat, darkMetal]);
  plate.position.set(0, kp.y, 0.033);
  kg.add(plate);
  let shown = '';
  const paintKeypad = (text, col, red, green, pressed) => {
    const key = [text, col, red.toFixed(2), green.toFixed(2), pressed].join('|');
    if (key === shown) return;
    shown = key;
    drawPlate(plx, pressed);
    drawGlow(glx, text, col, red, green);
    plateTex.needsUpdate = true;
    glowTex.needsUpdate = true;
  };
  paintKeypad('LOCKED', 'green', 1, 0, null);

  let doorOpen = 0;
  let openT = -1;
  let lastCode = '';
  let pressed = null;
  let pressT = 0;
  // les feux du moteur de lumière (repère de l'étage) : le boîtier EXIT, juste devant sa face et un peu plus bas ; la
  // ventouse ; l'écran du clavier ; l'ampoule de la cage, qui déborde dans le hall quand le battant s'ouvre
  const hx = -E.dx;
  const hz = -E.dz;
  const fx = eg.position.x;
  const fz = eg.position.z;
  const lockAt = { x: fx + lockX * Math.cos(eg.rotation.y) + hx * 0.06, z: fz - lockX * Math.sin(eg.rotation.y) + hz * 0.06 };
  const kr = kp.rot;
  const GLOW_IDLE = [0.05, 0.22, 0.09];
  const GLOW_ON = [0.08, 0.36, 0.14];
  const GLOW_OK = [0.1, 0.5, 0.18];
  const GLOW_BAD = [0.6, 0.06, 0.04];
  const GLOW_OFF = [0, 0, 0];
  let kpGlow = GLOW_IDLE;
  return {
    lights(out) {
      // (en tous sens : le caisson est collé au mur, rien n'éclaire derrière ; à 40 cm devant la face, pour que le mur
      // autour prenne la lumière sous un angle franc, pas seulement en rasant)
      out.push({ x: fx + hx * 0.4, y: DH + 0.3, z: fz + hz * 0.4, r: 0.27, g: 1.6, b: 0.7, rad: 4.2, nx: 0, ny: 0, nz: 0, w: 0 });
      const open = doorOpen > 0.02 || openT >= 0;
      out.push({ x: lockAt.x, y: DH - 0.08, z: lockAt.z, r: open ? 0.04 : 0.32, g: open ? 0.3 : 0.03, b: open ? 0.08 : 0.02, rad: 0.7, nx: hx, ny: 0, nz: hz, w: -0.6 });
      if (kpGlow !== GLOW_OFF) out.push({ x: kp.x + Math.sin(kr) * 0.12, y: kp.y + 0.02, z: kp.z + Math.cos(kr) * 0.12, r: kpGlow[0], g: kpGlow[1], b: kpGlow[2], rad: 1.1, nx: Math.sin(kr), ny: 0, nz: Math.cos(kr), w: -0.5 });
      const k = Math.min(1, doorOpen / 1.2);
      if (k > 0.02) out.push({ x: fx - hx * 1.0, y: 2.1, z: fz - hz * 1.0, r: 1.0 * k, g: 0.78 * k, b: 0.5 * k, rad: 5.5, nx: hx, ny: -0.3, nz: hz, w: 0.1 });
    },
    update(sim, dt) {
      const now = performance.now();
      const ui = hotelUi;
      // la touche qu'on vient d'enfoncer (le dernier chiffre ajouté)
      const code = ui.code;
      if (code !== null && code !== lastCode) {
        pressed = code.length > lastCode.length ? code.slice(-1) : '*';
        pressT = now;
      }
      lastCode = code || '';
      if (now - pressT > 140) pressed = null;
      const wrong = now - ui.wrongAt < 1400;
      const blink = Math.floor(now / 160) % 2;
      // (la lueur de l'écran sur le mur, pour le moteur de lumière : verte, rouge qui clignote sur un mauvais code)
      kpGlow = sim.open ? GLOW_OK : wrong ? (blink ? GLOW_BAD : GLOW_OFF) : code !== null ? GLOW_ON : GLOW_IDLE;
      if (sim.open) paintKeypad('OPEN', 'green', 0, 1, null);
      else if (wrong) paintKeypad('DENIED', 'red', blink, 0, null);
      else if (code !== null) paintKeypad(code.length ? '* '.repeat(code.length).trim() : 'CODE ?', 'green', 1, 0, pressed);
      else paintKeypad(sim.codeShown ? 'ENTER CODE' : 'LOCKED', 'green', Math.floor(now / 900) % 4 ? 1 : 0.4, 0, null);
      lockLed.color.set(sim.open ? '#2bff5a' : '#ff2a1a');
      // la porte : la ventouse lâche (le voyant passe au vert), puis le battant pivote lentement vers la cage, en
      // ralentissant, avec un petit rebond en bout de course
      if (sim.open && openT < 0) openT = 0;
      if (!sim.open) openT = -1;
      if (openT >= 0) openT += dt;
      const k = openT < 0.45 ? 0 : Math.min(1, (openT - 0.45) / 2.4);
      const ease = 1 - Math.pow(1 - k, 3);
      const want = openT < 0 ? 0 : ease * 1.42 + Math.sin(Math.min(1, k) * Math.PI) * 0.04;
      doorOpen += (want - doorOpen) * Math.min(1, dt * 12);
      hinge.rotation.y = -doorOpen;
    },
  };
}

// --- Le palier des ascenseurs (map.lifts) : deux cabines Art déco hors service, portes de laiton gravées, cadran
// d'étage en demi-lune au-dessus, la plaque des boutons d'appel entre les deux ; l'une a ses portes entrouvertes sur le
// noir de la gaine, l'autre porte un mot scotché « OUT OF ORDER » ---
function drawLiftDoor(x, w, h, left) {
  const g = x.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#8a6a2c');
  g.addColorStop(0.5, '#c9a457');
  g.addColorStop(1, '#93722f');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  const r = rng(left ? 3 : 4);
  for (let i = 0; i < 260; i++) {
    x.fillStyle = `rgba(${r() < 0.5 ? '255,240,200' : '40,25,5'},${0.04 + r() * 0.05})`;
    x.fillRect(r() * w, r() * h, 1, 30 + r() * 120);
  }
  // le motif : un soleil levant depuis le joint des deux portes, des filets verticaux
  x.strokeStyle = 'rgba(60,38,8,0.55)';
  x.lineWidth = 2;
  const ox = left ? w : 0;
  const oy = h * 0.42;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI / 2 + (left ? 1 : -1) * (i / 8) * (Math.PI / 2);
    x.beginPath();
    x.moveTo(ox, oy);
    x.lineTo(ox + Math.cos(a) * h * 0.3, oy - Math.sin(a) * h * 0.3);
    x.stroke();
  }
  for (const rr0 of [0.08, 0.12]) {
    x.beginPath();
    x.arc(ox, oy, h * rr0, Math.PI, 0);
    x.stroke();
  }
  x.lineWidth = 1.5;
  for (const u of [0.15, 0.85]) {
    x.beginPath();
    x.moveTo(w * u, h * 0.06);
    x.lineTo(w * u, h * 0.94);
    x.stroke();
  }
  // les traces de mains au milieu, les rayures du bas
  x.fillStyle = 'rgba(40,25,8,0.18)';
  x.fillRect(left ? w - 30 : 0, h * 0.45, 30, h * 0.12);
  x.fillStyle = 'rgba(30,20,6,0.35)';
  x.fillRect(0, h * 0.93, w, h * 0.07);
}
function drawDial(x, w, h, at) {
  x.clearRect(0, 0, w, h);
  x.fillStyle = '#b8924a';
  x.beginPath();
  x.arc(w / 2, h, h - 2, Math.PI, 0);
  x.fill();
  x.fillStyle = '#1b140a';
  x.beginPath();
  x.arc(w / 2, h, h - 14, Math.PI, 0);
  x.fill();
  const labels = ['L', '1', '2', '3', '4', '5', '6', '7', '8'];
  x.fillStyle = '#e8c97a';
  x.font = 'bold 18px Georgia, serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  labels.forEach((t, i) => {
    const a = Math.PI + ((i + 0.5) / labels.length) * Math.PI;
    x.fillText(t, w / 2 + Math.cos(a) * (h - 30), h + Math.sin(a) * (h - 30));
  });
  const a = Math.PI + ((at + 0.5) / labels.length) * Math.PI;
  x.strokeStyle = '#e04a2a';
  x.lineWidth = 4;
  x.beginPath();
  x.moveTo(w / 2, h);
  x.lineTo(w / 2 + Math.cos(a) * (h - 46), h + Math.sin(a) * (h - 46));
  x.stroke();
}
export function buildLifts({ map, group, baked }) {
  const lifts = map.lifts || [];
  if (!lifts.length) return null;
  const brass = baked(new THREE.MeshLambertMaterial({ color: '#9a7330', emissive: '#2a1a06', emissiveIntensity: 0.35 }));
  const voidMat = new THREE.MeshBasicMaterial({ color: '#030303' });
  const box = (w, h, d, mat, x, y, z, parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const DW = 1.1;
  const DH = 2.15;
  lifts.forEach((L, i) => {
    const g = new THREE.Group();
    g.position.set(L.x, 0, L.z);
    g.rotation.y = L.rot;
    group.add(g);
    // l'encadrement de laiton
    for (const s of [-1, 1]) box(0.12, DH + 0.12, 0.07, brass, s * (DW / 2 + 0.06), (DH + 0.12) / 2, 0.035, g);
    box(DW + 0.24, 0.18, 0.08, brass, 0, DH + 0.09, 0.04, g);
    // le noir de la gaine derrière
    box(DW, DH, 0.01, voidMat, 0, DH / 2, 0.004, g);
    // les deux portes coulissantes ; la seconde cabine est restée entrouverte
    const gap = i === 1 ? 0.07 : 0.004;
    for (const left of [true, false]) {
      const [c, x] = canvas(128, 512);
      drawLiftDoor(x, 128, 512, left);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(DW / 2 - 0.004, DH - 0.01, 0.03), [brass, brass, brass, brass, baked(new THREE.MeshLambertMaterial({ map: tex(c), color: '#c8b8a0' })), brass]);
      leaf.position.set((left ? -1 : 1) * (DW / 4 + gap / 2), DH / 2, 0.025);
      g.add(leaf);
    }
    // le cadran d'étage, l'aiguille arrêtée (au 5, ou entre deux étages)
    const [dc, dx] = canvas(256, 128);
    drawDial(dx, 256, 128, i === 0 ? 5 : 2.5);
    const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), baked(new THREE.MeshLambertMaterial({ map: tex(dc), transparent: true, alphaTest: 0.3 })));
    dial.position.set(0, DH + 0.36, 0.012);
    g.add(dial);
    // un mot scotché sur la première
    if (i === 0) {
      const [nc, nx] = canvas(192, 128);
      nx.fillStyle = '#ece4d0';
      nx.fillRect(0, 0, 192, 128);
      nx.fillStyle = 'rgba(220,210,170,0.7)';
      nx.fillRect(70, 0, 52, 14);
      nx.fillStyle = '#1d1a16';
      nx.font = 'bold 28px "Comic Sans MS", "Marker Felt", cursive';
      nx.textAlign = 'center';
      nx.fillText('OUT OF', 96, 56);
      nx.fillText('ORDER', 96, 92);
      const note = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.16), baked(new THREE.MeshLambertMaterial({ map: tex(nc) })));
      note.position.set(0.08, 1.5, 0.042);
      note.rotation.z = -0.06;
      g.add(note);
    }
  });
  // la plaque des boutons d'appel, entre les deux cabines : ▲ éteint, ▼ qui luit faiblement
  const a = lifts[0];
  const b = lifts[lifts.length - 1];
  const pg = new THREE.Group();
  pg.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
  pg.rotation.y = a.rot;
  group.add(pg);
  box(0.12, 0.26, 0.015, brass, 0, 1.22, 0.008, pg);
  const lit = new THREE.MeshBasicMaterial({ color: '#ffb347' });
  const dark = baked(new THREE.MeshLambertMaterial({ color: '#4a3a24' }));
  const cone = (up, mat, y) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.03, 0.012, 3), mat);
    m.rotation.x = Math.PI / 2;
    m.rotation.y = up ? Math.PI : 0; // (la pointe du triangle : en haut ou en bas)
    m.position.set(0, y, 0.02);
    pg.add(m);
  };
  cone(true, dark, 1.28);
  cone(false, lit, 1.16);
  // (la flèche allumée teinte d'ambre la plaque et le mur autour : un feu du moteur de lumière)
  const ax = pg.position.x + Math.sin(a.rot) * 0.1;
  const az = pg.position.z + Math.cos(a.rot) * 0.1;
  return {
    lights(out) {
      out.push({ x: ax, y: 1.16, z: az, r: 0.4, g: 0.22, b: 0.06, rad: 0.8, nx: Math.sin(a.rot), ny: 0, nz: Math.cos(a.rot), w: -0.6 });
    },
  };
}
