// The Backrooms (Level 17, le Mall) - Les marchandises : des emballages imprimés à la place des boîtes unies. Un atlas
// peint (boîtes de jouets, d'électronique, d'articles de cuisine et de sport, boîtes à chaussures, produits ménagers,
// cartons d'expédition, dos de livres, vêtements pliés) ; chaque case a sa face, sa tranche et son dessus. Les rayons
// se remplissent par « facings » : le même produit répété côte à côte, comme dans un vrai magasin. Les marques et les
// noms sont inventés. Tout part dans une seule géométrie (une matière) : peu de triangles, un seul appel de dessin.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

const CW = 128; // une case : 128 × 128 ; le dessus = la bande du haut (16 px), la tranche = la bande de gauche (16 px)
const COLS = 16;
const AW = 2048;
const AH = 1024;
export const ROW = { toys: 0, electro: 1, kitchen: 2, sport: 3, shoes: 4, stock: 5, carton: 6, misc: 7 };

const NAMES = {
  toys: ['ROBO-PAL', 'TURBO RACER', 'DOLLY DREAMS', 'MEGA BLOX', 'SPACE CADET', 'PUZZLE 500', 'DINO PARK', 'MAGIC SET', 'KITE PRO', 'YO-YO CHAMP', 'BUBBLE FUN', 'TEDDY & CO', 'PAINT KIT', 'RC BUGGY', 'STAR FORCE', 'FARM PALS'],
  electro: ['VIDEOMATE 400', 'SOUNDWAVE CD', 'TALKLINE', 'CLOCK RADIO', 'T-120 TAPES', 'AA CELLS x8', 'HEADSET HP-7', 'POCKET TV', 'CAMCORDER 8', 'ANSWER-IT', '16-BIT SYSTEM', 'FLOPPY x10', 'C90 TAPES', 'CALC FX', 'WALKABOUT', 'FAX-O-MATIC'],
  kitchen: ['TOAST 2-SLICE', 'BLEND-O', 'COFFEE 10 CUP', 'GLASS SET x6', 'KNIFE BLOCK', 'NON-STICK PAN', 'DINNER SET 16', 'KETTLE', 'MIXER 5-SPEED', 'FRESH BOXES', 'CAN OPENER', 'WAFFLE IRON', 'SLOW COOKER', 'CUTLERY 24', 'MUG SET', 'ICE TRAYS'],
  sport: ['PRO BALL', 'TENNIS x3', 'ROLLER SKATES', 'DUMBBELLS', 'JUMP ROPE', 'SWIM GOGGLES', 'BIKE HELMET', 'FLYING DISC', 'CAMP STOVE', 'THERMOS 1L', 'FISHING REEL', 'KNEE PADS', 'SPORT BOTTLE', 'BALL PUMP', 'GOLF x12', 'SHIN GUARDS'],
  stock: ['SUDS', 'BRITE', 'PAPER TOWELS', 'TRASH BAGS', 'BULBS 60W', 'TISSUE', 'SPONGES x4', 'DISH SOAP', 'AIR FRESH', 'FLOOR WAX', 'GLOVES', 'CANDLES', 'MATCHES', 'FILM 35mm', 'TAPE', 'LAUNDRY'],
};
const BRANDS = { toys: ['HAPPYTIME', 'KIDCO', 'PLAYWELL'], electro: ['ZENTRA', 'AUREL', 'KOBA', 'VISTA'], kitchen: ['HOMESTEAD', 'CUCINA', 'MAPLE & CO'], sport: ['STRIDE', 'APEX', 'NORTHPOINT'], stock: ['VALU-PAK', 'CLEANWAY', 'DAYBRIGHT'] };
const PALS = {
  toys: [['#e23b2e', '#ffd21f', '#ffffff'], ['#1f6fd1', '#ff7a1a', '#ffffff'], ['#8a2fc4', '#3fe0c5', '#ffffff'], ['#f08c1a', '#2440b0', '#ffffff'], ['#2fa84a', '#ffe14a', '#ffffff'], ['#e83f8c', '#fff06a', '#ffffff']],
  electro: [['#e9e7e1', '#1c3f8f', '#1b1b1f'], ['#1d1e24', '#d8262c', '#f1f1f1'], ['#d9dde2', '#0f7a6a', '#16181c'], ['#2a3142', '#f0b21a', '#f4f4f4'], ['#f0efe9', '#7a1f8a', '#1b1b1f']],
  kitchen: [['#f1e7cf', '#b5482a', '#3a2a1e'], ['#dfe9e2', '#2f7a5a', '#1f2f28'], ['#f4e3da', '#a8322f', '#3a1f1c'], ['#e4e8f1', '#2f4f8f', '#1c2436'], ['#f3efc9', '#8a6a1a', '#3a3010']],
  sport: [['#f3f3f0', '#d8261c', '#141414'], ['#101820', '#c8f02a', '#ffffff'], ['#f3f3f0', '#1f5fd0', '#141414'], ['#ef7a12', '#101010', '#ffffff'], ['#1c7a4a', '#ffffff', '#ffffff']],
  stock: [['#f6d21a', '#c41f1f', '#1a1a1a'], ['#1f8fd6', '#ffffff', '#ffffff'], ['#f2f2ee', '#2f9a4a', '#1a1a1a'], ['#e2531f', '#fff2c8', '#ffffff'], ['#6a3fb0', '#ffe04a', '#ffffff'], ['#f2f2ee', '#d81f6a', '#1a1a1a']],
};

const hash = (a, b = 0, c = 0) => {
  const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return v - Math.floor(v);
};
const shade = (hex, k) => {
  const c = new THREE.Color(hex);
  return '#' + c.multiplyScalar(k).getHexString();
};
const FONT = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';
// un texte ajusté à la largeur donnée
function fit(g, text, x, y, maxW, px, weight = 'bold', stroke = false) {
  let s = px;
  g.font = `${weight} ${s}px ${FONT}`;
  while (s > 6 && g.measureText(text).width > maxW) g.font = `${weight} ${--s}px ${FONT}`;
  if (stroke) g.strokeText(text, x, y);
  g.fillText(text, x, y);
}
function barcode(g, x, y, w, h, seed) {
  g.fillStyle = '#fff';
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = '#111';
  for (let u = 0, k = 0; u < w; k++) {
    const bw = 1 + Math.floor(hash(seed, k) * 2);
    if (k % 2 === 0) g.fillRect(x + u, y, bw, h);
    u += bw;
  }
}
// les pictogrammes : de petits dessins au trait plein, dans un carré de côté s centré en (x, y)
function pic(g, kind, x, y, s, col, col2) {
  const u = s / 20;
  g.fillStyle = col;
  g.strokeStyle = col;
  g.lineWidth = Math.max(1.5, u * 1.6);
  const R = (ax, ay, w, h) => g.fillRect(x + ax * u, y + ay * u, w * u, h * u);
  const C = (ax, ay, r, fill = true) => {
    g.beginPath();
    g.arc(x + ax * u, y + ay * u, r * u, 0, 7);
    fill ? g.fill() : g.stroke();
  };
  const P = (pts) => {
    g.beginPath();
    pts.forEach(([ax, ay], i) => (i ? g.lineTo(x + ax * u, y + ay * u) : g.moveTo(x + ax * u, y + ay * u)));
    g.closePath();
    g.fill();
  };
  switch (kind % 16) {
    case 0: // un robot
      R(-5, -9, 10, 7);
      R(-7, -1, 14, 9);
      R(-10, 0, 2, 7);
      R(8, 0, 2, 7);
      g.fillStyle = col2;
      R(-3, -7, 2, 2);
      R(1, -7, 2, 2);
      break;
    case 1: // une voiture
      P([[-10, 2], [-8, -3], [-3, -3], [-1, -7], [6, -7], [8, -3], [10, -2], [10, 4], [-10, 4]]);
      g.fillStyle = col2;
      C(-5, 5, 3);
      C(5, 5, 3);
      break;
    case 2: // une poupée
      C(0, -6, 4);
      P([[0, -3], [7, 9], [-7, 9]]);
      break;
    case 3: // des cubes
      R(-9, 0, 8, 8);
      R(1, 0, 8, 8);
      R(-4, -9, 8, 8);
      break;
    case 4: // une fusée
      P([[0, -10], [4, -3], [4, 5], [8, 9], [-8, 9], [-4, 5], [-4, -3]]);
      g.fillStyle = col2;
      C(0, -1, 2);
      break;
    case 5: // un ballon
      C(0, 0, 9);
      g.strokeStyle = col2;
      C(0, 0, 4.5, false);
      break;
    case 6: // une tasse
      R(-7, -6, 11, 13);
      g.lineWidth = u * 2;
      C(6, 0, 4, false);
      break;
    case 7: // une poêle
      C(-2, 0, 8);
      R(5, -1.2, 9, 2.4);
      g.fillStyle = col2;
      C(-2, 0, 5.5);
      break;
    case 8: // une bouteille
      R(-4, -3, 8, 13);
      R(-1.5, -9, 3, 6);
      g.fillStyle = col2;
      R(-4, 1, 8, 5);
      break;
    case 9: // une ampoule
      C(0, -2, 7);
      R(-3, 4, 6, 5);
      break;
    case 10: // un téléviseur
      R(-10, -7, 20, 15);
      g.fillStyle = col2;
      R(-8, -5, 13, 11);
      break;
    case 11: // une cassette
      R(-10, -6, 20, 12);
      g.fillStyle = col2;
      C(-4.5, 0, 2.5);
      C(4.5, 0, 2.5);
      R(-6, 3, 12, 2);
      break;
    case 12: // un téléphone
      R(-6, -9, 12, 18);
      g.fillStyle = col2;
      R(-4, -7, 8, 5);
      for (let i = 0; i < 9; i++) R(-4 + (i % 3) * 3, 0 + Math.floor(i / 3) * 2.6, 2, 1.6);
      break;
    case 13: // une chaussure
      P([[-10, 5], [-10, -4], [-4, -5], [-1, 0], [8, 2], [10, 5]]);
      g.fillStyle = col2;
      R(-10, 5, 20, 2);
      break;
    case 14: // un casque
      g.lineWidth = u * 2.4;
      g.beginPath();
      g.arc(x, y + u, 8 * u, Math.PI, 0);
      g.stroke();
      R(-10, 0, 4, 8);
      R(6, 0, 4, 8);
      break;
    default: // une étoile
      g.beginPath();
      for (let p = 0; p < 10; p++) {
        const r = (p % 2 ? 4.5 : 10) * u;
        g.lineTo(x + Math.sin((p * Math.PI) / 5) * r, y - Math.cos((p * Math.PI) / 5) * r);
      }
      g.fill();
  }
}
const PICS = {
  toys: [0, 1, 2, 3, 4, 3, 15, 15, 15, 5, 5, 2, 8, 1, 4, 3],
  electro: [10, 5, 12, 10, 11, 8, 14, 10, 11, 12, 10, 11, 11, 12, 14, 12],
  kitchen: [3, 8, 6, 6, 3, 7, 5, 6, 8, 3, 8, 7, 7, 3, 6, 3],
  sport: [5, 5, 13, 3, 15, 14, 14, 5, 3, 8, 5, 13, 8, 8, 5, 13],
  stock: [8, 8, 3, 3, 9, 3, 3, 8, 8, 8, 13, 9, 3, 11, 5, 8],
};

function goodsAtlas() {
  const c = document.createElement('canvas');
  c.width = AW;
  c.height = AH;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const base = (cx, cy, bg, side = shade(bg, 0.82), top = shade(bg, 0.92)) => {
    g.fillStyle = bg;
    g.fillRect(cx, cy, CW, CW);
    g.fillStyle = top;
    g.fillRect(cx + 16, cy, CW - 16, 16);
    g.fillStyle = side;
    g.fillRect(cx, cy, 16, CW);
  };
  // les boîtes imprimées (jouets, électronique, cuisine, sport, ménage)
  for (const cat of ['toys', 'electro', 'kitchen', 'sport', 'stock']) {
    const r = ROW[cat];
    for (let i = 0; i < COLS; i++) {
      const cx = i * CW;
      const cy = r * CW;
      const [bg, ac, ink] = PALS[cat][(i * 5 + r) % PALS[cat].length];
      const name = NAMES[cat][i];
      const brand = BRANDS[cat][i % BRANDS[cat].length];
      base(cx, cy, bg);
      const fx = cx + 16;
      const fy = cy + 16;
      g.save();
      g.beginPath();
      g.rect(fx, fy, 112, 112);
      g.clip();
      if (cat === 'toys') {
        // un éclat, une fenêtre, le titre, la pastille de l'âge
        g.fillStyle = ac;
        g.beginPath();
        for (let p = 0; p < 24; p++) {
          const rr = p % 2 ? 30 : 46;
          g.lineTo(fx + 84 + Math.cos((p * Math.PI) / 12) * rr, fy + 70 + Math.sin((p * Math.PI) / 12) * rr);
        }
        g.fill();
        g.fillStyle = shade(bg, 0.35);
        g.fillRect(fx + 8, fy + 34, 62, 58);
        g.fillStyle = '#f4f1e6';
        g.fillRect(fx + 11, fy + 37, 56, 52);
        pic(g, PICS.toys[i], fx + 39, fy + 63, 40, ac, bg);
        g.lineWidth = 4;
        g.strokeStyle = shade(bg, 0.3);
        g.fillStyle = ink;
        fit(g, name, fx + 56, fy + 25, 104, 20, '900', true);
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(fx + 90, fy + 90, 14, 0, 7);
        g.fill();
        g.fillStyle = shade(bg, 0.5);
        fit(g, `AGES ${3 + (i % 5)}+`, fx + 90, fy + 94, 24, 9);
        g.fillStyle = shade(bg, 0.45);
        g.fillRect(fx, fy + 100, 70, 12);
        g.fillStyle = '#fff';
        fit(g, brand, fx + 35, fy + 109, 64, 9);
      } else if (cat === 'electro') {
        // un bandeau de marque, le produit dessiné, le modèle, trois lignes d'arguments
        g.fillStyle = ac;
        g.fillRect(fx, fy, 112, 22);
        g.fillStyle = '#fff';
        fit(g, brand, fx + 30, fy + 16, 52, 15, '900');
        g.fillStyle = shade(bg, bg < '#8' ? 1.6 : 0.9);
        g.fillRect(fx + 8, fy + 30, 60, 48);
        pic(g, PICS.electro[i], fx + 38, fy + 54, 38, ink, bg);
        g.fillStyle = ink;
        fit(g, name, fx + 56, fy + 98, 104, 15, '900');
        g.font = `7px ${FONT}`;
        g.textAlign = 'left';
        ['HI-FI STEREO', 'AUTO REVERSE', '1 YEAR WARRANTY', 'REMOTE INCL.'].slice(i % 2, (i % 2) + 3).forEach((t, k) => g.fillText('• ' + t, fx + 72, fy + 40 + k * 10));
        g.textAlign = 'center';
        barcode(g, fx + 78, fy + 102, 28, 7, i + 40);
      } else if (cat === 'kitchen') {
        g.fillStyle = ac;
        g.fillRect(fx, fy + 92, 112, 20);
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(fx + 56, fy + 52, 30, 0, 7);
        g.fill();
        pic(g, PICS.kitchen[i], fx + 56, fy + 52, 36, ac, '#fff');
        g.fillStyle = ink;
        fit(g, name, fx + 56, fy + 17, 104, 15, '900');
        g.fillStyle = '#fff';
        fit(g, brand, fx + 56, fy + 107, 100, 12);
      } else if (cat === 'sport') {
        g.fillStyle = ac;
        g.beginPath();
        g.moveTo(fx, fy + 112);
        g.lineTo(fx + 70, fy);
        g.lineTo(fx + 112, fy);
        g.lineTo(fx + 42, fy + 112);
        g.fill();
        pic(g, PICS.sport[i], fx + 60, fy + 56, 40, ink, ac);
        g.fillStyle = ink;
        fit(g, brand, fx + 30, fy + 16, 54, 14, 'italic 900');
        fit(g, name, fx + 56, fy + 104, 104, 15, '900');
      } else {
        g.fillStyle = ac;
        g.beginPath();
        g.ellipse(fx + 56, fy + 46, 50, 26, -0.15, 0, 7);
        g.fill();
        g.fillStyle = bg;
        fit(g, name, fx + 56, fy + 53, 88, 22, '900');
        pic(g, PICS.stock[i], fx + 26, fy + 90, 26, ink, ac);
        g.fillStyle = ink;
        fit(g, brand, fx + 76, fy + 88, 60, 10);
        fit(g, ['NEW!', '25% MORE', 'VALUE SIZE', 'LEMON'][i % 4], fx + 76, fy + 102, 60, 10, '900');
      }
      g.restore();
    }
  }
  // les boîtes à chaussures : le bout de la boîte (le couvercle, l'étiquette, la pointure)
  {
    const LIDS = ['#1d1d22', '#c4302a', '#e9e4d6', '#1f3f7a', '#e07a1c', '#2f6a4a'];
    const SB = ['STRIDE', 'KESTREL', 'NORTHPOINT', 'LUNA', 'BRIO', 'HALCYON'];
    const STYLES = ['COURT LOW', 'TRAIL MID', 'CLASSIC', 'RUNNER 90', 'LOAFER', 'HI-TOP', 'SANDAL', 'OXFORD'];
    for (let i = 0; i < COLS; i++) {
      const cx = i * CW;
      const cy = ROW.shoes * CW;
      const lid = LIDS[i % LIDS.length];
      const light = lid > '#9';
      base(cx, cy, shade(lid, 0.92), shade(lid, 0.8), lid);
      const fx = cx + 16;
      const fy = cy + 16;
      g.fillStyle = lid;
      g.fillRect(fx, fy, 112, 34);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(fx, fy + 32, 112, 3);
      g.fillStyle = light ? '#1a1a1a' : '#f2f0ea';
      fit(g, SB[i % SB.length], fx + 56, fy + 25, 100, 22, 'italic 900');
      g.fillStyle = '#f4f1e8';
      g.fillRect(fx + 34, fy + 44, 72, 60);
      g.fillStyle = '#141414';
      fit(g, STYLES[i % STYLES.length], fx + 70, fy + 58, 64, 11, '900');
      g.font = `8px ${FONT}`;
      g.fillText(['BLK/WHT', 'NAVY', 'TAN', 'WHITE', 'RED/GRY'][i % 5], fx + 70, fy + 69);
      fit(g, `SIZE ${6 + (i % 7)}${i % 2 ? '½' : ''}`, fx + 70, fy + 84, 64, 13, '900');
      barcode(g, fx + 42, fy + 90, 56, 9, i + 90);
      pic(g, 13, fx + 17, fy + 76, 24, light ? '#1a1a1a' : '#f2f0ea', lid);
    }
  }
  // les cartons d'expédition : kraft, ruban adhésif, marques imprimées, étiquettes
  {
    const MARKS = ['FRAGILE', 'THIS SIDE UP', 'HANDLE WITH CARE', "HARTWELL'S", 'HALCYON PARK', 'KEEP DRY', 'QTY 24', 'DO NOT STACK'];
    for (let i = 0; i < COLS; i++) {
      const cx = i * CW;
      const cy = ROW.carton * CW;
      const k = 0.86 + hash(i, 3) * 0.2;
      const kraft = shade(['#a8855a', '#b08f63', '#9c7a50', '#b89a70'][i % 4], k);
      base(cx, cy, kraft, shade(kraft, 0.9), shade(kraft, 0.97));
      // le grain du carton : des fibres, les cannelures
      for (let n = 0; n < 420; n++) {
        g.fillStyle = hash(i, n) < 0.5 ? 'rgba(60,40,20,0.10)' : 'rgba(255,240,210,0.08)';
        g.fillRect(cx + hash(i, n, 1) * CW, cy + hash(i, n, 2) * CW, 1 + hash(i, n, 3) * 5, 1);
      }
      g.fillStyle = 'rgba(40,25,10,0.06)';
      for (let y = 18; y < CW; y += 3) g.fillRect(cx, cy + y, CW, 1);
      // le ruban : en travers du dessus, il redescend au milieu de la face
      g.fillStyle = i % 3 === 2 ? 'rgba(200,170,110,0.75)' : 'rgba(214,196,150,0.8)';
      g.fillRect(cx + 16, cy + 4, CW - 16, 8);
      g.fillRect(cx + 16 + 48, cy + 16, 16, 14 + (i % 3) * 5);
      const fx = cx + 16;
      const fy = cy + 16;
      const ink = i % 5 === 3 ? 'rgba(150,25,20,0.8)' : 'rgba(35,25,18,0.78)';
      g.fillStyle = ink;
      g.strokeStyle = ink;
      fit(g, MARKS[i % MARKS.length], fx + 56, fy + 58, 100, 17, '900');
      if (i % 4 === 1) {
        // deux flèches vers le haut
        for (const ax of [22, 90]) {
          g.beginPath();
          g.moveTo(fx + ax, fy + 70);
          g.lineTo(fx + ax + 9, fy + 84);
          g.lineTo(fx + ax + 3, fy + 84);
          g.lineTo(fx + ax + 3, fy + 100);
          g.lineTo(fx + ax - 3, fy + 100);
          g.lineTo(fx + ax - 3, fy + 84);
          g.lineTo(fx + ax - 9, fy + 84);
          g.fill();
        }
      } else if (i % 4 === 0) {
        // un verre (fragile)
        g.lineWidth = 2;
        g.strokeRect(fx + 44, fy + 68, 24, 34);
        pic(g, 6, fx + 56, fy + 85, 18, ink, ink);
      } else {
        // une étiquette d'expédition : blanche, des lignes, un code-barres
        g.fillStyle = '#ece8dc';
        g.fillRect(fx + 50, fy + 68, 54, 38);
        g.fillStyle = '#222';
        for (let l = 0; l < 3; l++) g.fillRect(fx + 54, fy + 73 + l * 5, 30 + hash(i, l) * 16, 1.5);
        barcode(g, fx + 54, fy + 92, 46, 10, i + 7);
      }
      if (i % 6 === 5) {
        // une auréole d'eau
        g.fillStyle = 'rgba(50,35,20,0.22)';
        g.beginPath();
        g.ellipse(fx + 30, fy + 96, 34, 18, 0.2, 0, 7);
        g.fill();
      }
    }
  }
  // divers : six rangées de dos de livres, six piles de vêtements pliés, quatre piles de linge
  {
    const cy = ROW.misc * CW;
    const SP = ['#5a1f1b', '#1f3a5a', '#2f4a2a', '#6a5a3a', '#3a2a4a', '#8a7a5a', '#7a2a2a', '#22404a', '#c9bfa4', '#1d1d22', '#8a4a1c'];
    for (let i = 0; i < 6; i++) {
      const cx = i * CW;
      base(cx, cy, '#17140f', '#3a2f24', '#d9d2bf');
      // (le dessus : la tranche des pages)
      g.fillStyle = 'rgba(90,80,60,0.35)';
      for (let x = 18; x < CW; x += 2) g.fillRect(cx + x, cy + 1, 1, 14);
      let x = 0;
      for (let k = 0; x < 112; k++) {
        const w = 8 + Math.floor(hash(i, k) * 9);
        const h = 78 + Math.floor(hash(i, k, 1) * 34);
        const col = SP[Math.floor(hash(i, k, 2) * SP.length)];
        const bx = cx + 16 + x;
        const by = cy + 16 + 112 - h;
        g.fillStyle = col;
        g.fillRect(bx, by, w - 1, h);
        g.fillStyle = 'rgba(255,255,255,0.10)';
        g.fillRect(bx, by, 1.5, h);
        g.fillStyle = col > '#9' ? '#2a2018' : hash(i, k, 3) < 0.5 ? '#d9b45a' : '#e8e2d0';
        g.fillRect(bx + 1, by + 8, w - 3, 2);
        g.fillRect(bx + 1, by + h - 12, w - 3, 2);
        if (w > 10) {
          g.save();
          g.translate(bx + w / 2 + 2, by + h / 2);
          g.rotate(-Math.PI / 2);
          g.font = `bold 7px ${FONT}`;
          g.fillText(['ATLAS', 'HISTORY', 'GARDENS', 'COOKERY', 'NOVEL', 'POEMS', 'TRAVEL', 'STARS'][Math.floor(hash(i, k, 4) * 8)], 0, 0, h - 26);
          g.restore();
        }
        x += w;
      }
    }
    const CL = [['#27405f', '#d8dce4', '#8a2f2c', '#3a3a40'], ['#c9bba4', '#6a5a46', '#e6e0d2', '#40362c'], ['#9c3a36', '#d8c8c0', '#2e4466', '#b08a3a'], ['#1e1e24', '#55555c', '#8a8a90', '#2a2a30'], ['#e6dfd0', '#c7d2dc', '#e2c9c4', '#d4dcc6'], ['#2f5a44', '#b08a3a', '#7a2a2a', '#22304a']];
    for (let i = 0; i < 10; i++) {
      const cx = (6 + i) * CW;
      const linen = i >= 6;
      const pal = linen ? ['#e8e2d4', '#c9d6e0', '#e3cfc9', '#d6dcc4', '#f0ead8'] : CL[i];
      const n = linen ? 5 : 8; // (une pile de 5 draps épais ou de 8 vêtements)
      base(cx, cy, pal[0], shade(pal[1], 0.8), pal[0]);
      const fx = cx + 16;
      const fy = cy + 16;
      for (let k = 0; k < n; k++) {
        const col = pal[Math.floor(hash(i, k, 5) * pal.length)];
        const y0 = fy + (k * 112) / n;
        const h = 112 / n;
        g.fillStyle = col;
        g.fillRect(fx, y0, 112, h);
        // le pli : une ombre en bas, un reflet en haut, le bord arrondi à gauche et à droite
        const gr = g.createLinearGradient(0, y0, 0, y0 + h);
        gr.addColorStop(0, 'rgba(255,255,255,0.16)');
        gr.addColorStop(0.55, 'rgba(0,0,0,0)');
        gr.addColorStop(1, 'rgba(0,0,0,0.42)');
        g.fillStyle = gr;
        g.fillRect(fx, y0, 112, h);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(fx, y0 + h * 0.48, 112, 1);
        if (!linen && hash(i, k, 6) < 0.4) {
          // un vichy, des rayures
          g.fillStyle = 'rgba(255,255,255,0.14)';
          for (let x = 0; x < 112; x += 6) g.fillRect(fx + x, y0, 2, h - 2);
        }
        if (k === 0) {
          g.fillStyle = col;
          g.fillRect(cx + 16, cy, 112, 16);
        }
      }
    }
  }
  // un voile de poussière, un peu de jaune : tout a passé des années sous les néons
  g.fillStyle = 'rgba(120,105,80,0.10)';
  g.fillRect(0, 0, AW, AH);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// les panneaux des rayons et du magasin : 2 colonnes × 8 rangées de 512 × 64
const SIGNS = ['BEAUTY', 'LADIES', 'SHOES', 'HOME', 'ELECTRONICS', 'TOYS', 'MENSWEAR', 'LUGGAGE', 'KITCHEN', 'STOCKROOM', 'FITTING ROOMS', 'PAY HERE', 'CUSTOMER SERVICE', 'CLEARANCE', 'LUMIÈRE', 'ORCHID & ASH'];
export const SIGN = Object.fromEntries(SIGNS.map((s, i) => [s, i]));
export const DEPT_SIGN = { beauty: 0, ladies: 1, shoes: 2, home: 3, electro: 4, toys: 5, mens: 6, luggage: 7, kitchen: 8, stock: 9 };
function signAtlas() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  SIGNS.forEach((s, i) => {
    const x = (i % 2) * 512;
    const y = Math.floor(i / 2) * 64;
    const brand = i >= 14;
    const red = s === 'CLEARANCE' || s === 'PAY HERE';
    g.fillStyle = brand ? '#f3eee2' : red ? '#a81c1c' : '#1b2a3a';
    g.fillRect(x, y, 512, 64);
    g.fillStyle = brand ? '#b08a3a' : '#c9a24a';
    g.fillRect(x + 6, y + 5, 500, 2);
    g.fillRect(x + 6, y + 57, 500, 2);
    g.fillStyle = brand ? '#1a1a1a' : '#f1ead8';
    g.font = brand ? 'italic 40px Georgia, "Times New Roman", serif' : `bold 40px "Futura", "Century Gothic", ${FONT}`;
    const sp = brand ? s : s.split('').join(' ');
    g.fillText(sp, x + 256, y + 46, 480);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
export const signUV = (i) => [(i % 2) / 2 + 0.002, 1 - (Math.floor(i / 2) + 1) / 8 + 0.004, (i % 2) / 2 + 0.498, 1 - Math.floor(i / 2) / 8 - 0.004];

let TEX = null;
export function createGoods({ G, MATS, baked }) {
  if (!TEX) TEX = { goods: goodsAtlas(), signs: signAtlas() };
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  if (!MATS.goods) {
    MATS.goods = { m: baked(lam({ map: TEX.goods, color: '#d6d2c8' })), S: 1 };
    MATS.deptSign = { m: baked(lam({ map: TEX.signs })), S: 1 };
    MATS.deptLit = { m: new THREE.MeshBasicMaterial({ map: TEX.signs, color: new THREE.Color(1, 1, 1).multiplyScalar(1.15) }), S: 1 };
  }
  const pos = [];
  const nor = [];
  const uvs = [];
  // un quadrilatère a b c d (a → b : de gauche à droite pour qui le regarde ; d au-dessus de a), tourné vers n
  const quad = (a, b, c, d, n, U) => {
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const ez = b[2] - a[2];
    const fx = d[0] - a[0];
    const fy = d[1] - a[1];
    const fz = d[2] - a[2];
    const ok = (ey * fz - ez * fy) * n[0] + (ez * fx - ex * fz) * n[1] + (ex * fy - ey * fx) * n[2] >= 0;
    const [u0, v0, u1, v1] = U;
    const V = ok ? [[a, u0, v0], [b, u1, v0], [c, u1, v1], [a, u0, v0], [c, u1, v1], [d, u0, v1]] : [[a, u0, v0], [c, u1, v1], [b, u1, v0], [a, u0, v0], [d, u0, v1], [c, u1, v1]];
    for (const [p, u, v] of V) {
      pos.push(p[0], p[1], p[2]);
      nor.push(n[0], n[1], n[2]);
      uvs.push(u, v);
    }
  };
  const cellOf = (row, i) => [((i % COLS) + COLS) % COLS, typeof row === 'number' ? row : ROW[row]];
  const FRONT = ([cx, cy], vf = 1) => [(cx * CW + 17) / AW, 1 - (cy * CW + CW - 1) / AH, (cx * CW + CW - 1) / AW, 1 - (cy * CW + CW - 1 - 110 * vf) / AH];
  const SIDE = ([cx, cy]) => [(cx * CW + 2) / AW, 1 - (cy * CW + CW - 1) / AH, (cx * CW + 14) / AW, 1 - (cy * CW + 18) / AH];
  const TOP = ([cx, cy]) => [(cx * CW + 18) / AW, 1 - (cy * CW + 14) / AH, (cx * CW + CW - 2) / AW, 1 - (cy * CW + 2) / AH];
  // un paquet (ou n paquets identiques côte à côte) dans le repère P(u, d) → [x, z] : de u0 à u1 en largeur, de y0 à y1,
  // de d0 (le fond) à d1 (la face, vers qui regarde) ; back : la face arrière aussi (une palette, vue de partout) ;
  // vf : la part de la face qu'on montre (le bas : une pile plus ou moins haute)
  const pack = (P, u0, u1, y0, y1, d0, d1, cell, n = 1, back = false, vf = 1) => {
    const o = P(u0, d1);
    const pu = P(u0 + 1, d1);
    const pd = P(u0, d1 + 1);
    const N = [pd[0] - o[0], 0, pd[1] - o[1]]; // vers le spectateur
    const Uv = [pu[0] - o[0], 0, pu[1] - o[1]]; // le sens des u
    // pour qui regarde la face : sa droite est (N.z, 0, -N.x) ; si les u vont vers sa gauche, on retourne l'image
    const flip = Uv[0] * N[2] - Uv[2] * N[0] < 0;
    const F = FRONT(cell, vf);
    const at = (u, d, y) => {
      const p = P(u, d);
      return [p[0], y, p[1]];
    };
    for (let k = 0; k < n; k++) {
      let ua = u0 + ((u1 - u0) * k) / n;
      let ub = u0 + ((u1 - u0) * (k + 1)) / n;
      if (flip) [ua, ub] = [ub, ua];
      quad(at(ua, d1, y0), at(ub, d1, y0), at(ub, d1, y1), at(ua, d1, y1), N, F);
      if (back) quad(at(ub, d0, y0), at(ua, d0, y0), at(ua, d0, y1), at(ub, d0, y1), [-N[0], 0, -N[2]], F);
    }
    quad(at(u0, d1, y1), at(u1, d1, y1), at(u1, d0, y1), at(u0, d0, y1), [0, 1, 0], TOP(cell));
    const S = SIDE(cell);
    quad(at(u0, d0, y0), at(u0, d1, y0), at(u0, d1, y1), at(u0, d0, y1), [-Uv[0], 0, -Uv[2]], S);
    quad(at(u1, d1, y0), at(u1, d0, y0), at(u1, d0, y1), at(u1, d1, y1), [Uv[0], 0, Uv[2]], S);
  };
  // une tablette garnie : des produits de la rangée row, par facings, de u0 à u1 ; hmax : la hauteur libre ; gaps : la
  // part des emplacements vides (on s'est servi, ou le rayon n'a jamais été rempli)
  const shelf = (P, u0, u1, y, d0, d1, row, seed, hmax = 0.34, gaps = 0.12) => {
    let u = u0;
    for (let k = 0; u < u1 - 0.1; k++) {
      const ci = Math.floor(hash(seed, k) * COLS);
      const big = row === 'carton';
      const w = big ? 0.3 + hash(ci, 1) * 0.16 : 0.13 + hash(ci, 1) * 0.15;
      const h = Math.min(hmax, big ? 0.2 + hash(ci, 2) * 0.14 : 0.15 + hash(ci, 2) * 0.2);
      const n = Math.min(big ? 2 : 2 + Math.floor(hash(seed, k, 3) * 3), Math.max(1, Math.floor((u1 - u) / w)));
      if (hash(seed, k, 4) >= gaps) {
        const dep = Math.min(d1 - d0, big ? w * 0.9 : 0.1 + hash(ci, 5) * 0.14);
        const pull = hash(seed, k, 6) * 0.05; // (pas tous au bord)
        const m = hash(seed, k, 7) < 0.25 ? Math.max(1, n - 1) : n; // (il en manque un)
        pack(P, u, u + w * m, y, y + h, d1 - pull - dep, d1 - pull, cellOf(row, ci), m);
      }
      u += w * n + 0.015 + hash(seed, k, 8) * 0.03;
    }
  };
  // une rangée de livres : des blocs de dos, de hauteurs inégales, un trou de temps en temps
  const books = (P, u0, u1, y, d0, d1, seed) => {
    let u = u0;
    for (let k = 0; u < u1 - 0.12; k++) {
      const w = Math.min(u1 - u, 0.26 + hash(seed, k) * 0.2);
      if (hash(seed, k, 1) < 0.14) {
        u += 0.1;
        continue;
      }
      const h = 0.2 + hash(seed, k, 2) * 0.08;
      pack(P, u, u + w, y, y + h, d0 + 0.02, Math.min(d1, d0 + 0.17 + hash(seed, k, 3) * 0.05), cellOf('misc', Math.floor(hash(seed, k, 4) * 6)));
      u += w + 0.004;
    }
  };
  // une pile de vêtements pliés (k pièces sur 8) ou de linge
  const folded = (P, u, w, y, d0, d1, seed, linen = false) => {
    const k = linen ? 2 + Math.floor(hash(seed, 1) * 4) : 2 + Math.floor(hash(seed, 1) * 6);
    const n = linen ? 5 : 8;
    const ci = linen ? 12 + Math.floor(hash(seed, 2) * 4) : 6 + Math.floor(hash(seed, 2) * 6);
    pack(P, u - w / 2, u + w / 2, y, y + k * (linen ? 0.07 : 0.045), d0, d1, [ci, ROW.misc], 1, false, k / n);
  };
  // un panneau (une case de l'atlas des panneaux), vertical, centré en (x, y, z), tourné vers (nx, nz) ; both : recto verso
  const sign = (i, x, y, z, w, h, nx, nz, lit = false, both = false) => {
    for (const s of both ? [1, -1] : [1]) {
      const geo = new THREE.PlaneGeometry(w, h);
      const U = signUV(i);
      const a = geo.attributes.uv;
      for (let k = 0; k < a.count; k++) a.setXY(k, a.getX(k) > 0.5 ? U[2] : U[0], a.getY(k) > 0.5 ? U[3] : U[1]);
      geo.rotateY(Math.atan2(nx * s, nz * s));
      G.add(lit ? 'deptLit' : 'deptSign', geo.translate(x + nx * s * 0.012, y, z + nz * s * 0.012));
    }
  };
  // tout ce qui a été posé : une seule géométrie
  const flush = () => {
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    G.add('goods', geo);
    pos.length = nor.length = uvs.length = 0;
  };
  return { pack, shelf, books, folded, sign, flush, cellOf, hash };
}
