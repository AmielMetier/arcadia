// The Backrooms (Level 17, le Mall) - Les panneaux imprimés : un atlas peint des panneaux des rayons, des plaques
// (EXIT, salles, parking), des grandes enseignes en lettres découpées et des grands chiffres des salles. Les noms sont
// inventés. (Les emballages imprimés qui garnissaient les rayons ne sont plus posés : les rayonnages sont vides.)
import * as THREE from '../../shared/vendor/three/three.module.min.js';

const hash = (a, b = 0, c = 0) => {
  const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return v - Math.floor(v);
};
const FONT = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';
// les panneaux des rayons et du magasin : 2 colonnes × 8 rangées de 512 × 64
const SIGNS = ['BEAUTY', 'LADIES', 'SHOES', 'HOME', 'ELECTRONICS', 'TOYS', 'MENSWEAR', 'LUGGAGE', 'KITCHEN', 'STOCKROOM', 'FITTING ROOMS', 'PAY HERE', 'CUSTOMER SERVICE', 'CLEARANCE', 'LUMIÈRE', 'ORCHID & ASH'];
export const SIGN = Object.fromEntries(SIGNS.map((s, i) => [s, i]));
export const DEPT_SIGN = { beauty: 0, ladies: 1, shoes: 2, home: 3, electro: 4, toys: 5, mens: 6, luggage: 7, kitchen: 8, stock: 9 };
// (les petites cases : 2 colonnes × 18 rangées de 512 × 64 ; dessous, quatre grandes enseignes de 1024 × 128)
const SIGN_A0 = 1152;
const SIGN_H = SIGN_A0 + 512 + 256; // (les quatre enseignes, puis une rangée de six grands chiffres de 160 × 256)
export const digitUV = (n) => [((n - 1) * 160 + 2) / 1024, 1 - (SIGN_A0 + 512 + 254) / SIGN_H, (n * 160 - 2) / 1024, 1 - (SIGN_A0 + 512 + 2) / SIGN_H];
export const SIGN_MARKET = 22; // les grandes surfaces de l'annexe, puis le fléchage vers l'annexe
export const SIGN_FLEA = 23;
export const SIGN_GARDEN = 24;
export const SIGN_ANNEX = 25;
export const SIGN_BOXOFFICE = 26;
export const SIGN_SNACKS = 27; // 27 à 29 : les tarifs du comptoir des confiseries
export const SIGN_KIOSK = 30; // 30 à 33 : les bandeaux des kiosques
export const SIGN_BACK5 = 34; // « BACK IN 5 MINUTES »
export const SIGN_POPCORN = 35;
const FILMS = ['STARFALL', 'THE LAST SUMMER', 'NIGHT SHIFT', 'PARADE OF LIGHTS', 'THE QUIET FLOOR', 'CLOSING TIME'];
export const SIGN_EXIT = 16; // trois plaques dans la case : EXIT, ← EXIT, EXIT →
export const SIGN_SCREEN = 17; // 17 à 19 : deux plaques par case (salles 1 à 6)
export const SIGN_SCREENS78 = 20;
export const SIGN_PARKING = 21;
export const ANCHOR = { hartwell: 0, brandt: 1, pavilion: 2, stardust: 3 };
function signAtlas() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = SIGN_H;
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
  const cellXY = (i) => [(i % 2) * 512, Math.floor(i / 2) * 64];
  const arrow = (x, y, dir) => {
    g.beginPath();
    g.moveTo(x + dir * 16, y);
    g.lineTo(x, y - 13);
    g.lineTo(x, y - 5);
    g.lineTo(x - dir * 16, y - 5);
    g.lineTo(x - dir * 16, y + 5);
    g.lineTo(x, y + 5);
    g.lineTo(x, y + 13);
    g.fill();
  };
  // les issues : trois plaques vertes de 170 × 64
  {
    const [x, y] = cellXY(SIGN_EXIT);
    g.fillStyle = '#0a6b38';
    g.fillRect(x, y, 512, 64);
    g.fillStyle = '#eafff2';
    g.font = `900 40px ${FONT}`;
    g.fillText('EXIT', x + 85, y + 46);
    g.fillText('EXIT', x + 85 + 170 + 18, y + 46);
    arrow(x + 170 + 30, y + 32, -1);
    g.fillText('EXIT', x + 85 + 340 - 18, y + 46);
    arrow(x + 340 + 140, y + 32, 1);
    g.fillStyle = '#063f22';
    g.fillRect(x + 169, y, 2, 64);
    g.fillRect(x + 339, y, 2, 64);
  }
  // les salles : un grand chiffre de laiton, « SCREEN », le film à l'affiche
  for (let n = 0; n < 6; n++) {
    const [cx, y] = cellXY(SIGN_SCREEN + Math.floor(n / 2));
    const x = cx + (n % 2) * 256;
    g.fillStyle = '#0e0c12';
    g.fillRect(x, y, 256, 64);
    g.strokeStyle = '#b08a3a';
    g.lineWidth = 2;
    g.strokeRect(x + 3, y + 3, 250, 58);
    g.fillStyle = '#e2b657';
    g.font = `900 54px Georgia, serif`;
    g.fillText(String(n + 1), x + 34, y + 52);
    g.textAlign = 'left';
    g.font = `bold 15px ${FONT}`;
    g.fillText('S C R E E N', x + 70, y + 24);
    g.fillStyle = n > 1 ? '#6a6458' : '#f3ecd8';
    g.font = `bold 20px ${FONT}`;
    g.fillText(n > 1 ? '— — —' : FILMS[n], x + 70, y + 50, 176);
    g.textAlign = 'center';
  }
  {
    const [x, y] = cellXY(SIGN_SCREENS78);
    g.fillStyle = '#0e0c12';
    g.fillRect(x, y, 512, 64);
    g.fillStyle = '#e2b657';
    g.font = `bold 34px "Futura", "Century Gothic", ${FONT}`;
    g.fillText('S C R E E N S   7 – 8', x + 226, y + 44, 400);
    arrow(x + 470, y + 32, 1);
  }
  {
    const [x, y] = cellXY(SIGN_PARKING);
    g.fillStyle = '#14407a';
    g.fillRect(x, y, 512, 64);
    g.fillStyle = '#f2f4f8';
    g.fillRect(x + 14, y + 8, 48, 48);
    g.fillStyle = '#14407a';
    g.font = `900 44px ${FONT}`;
    g.fillText('P', x + 38, y + 48);
    g.fillStyle = '#f2f4f8';
    g.font = `bold 34px "Futura", "Century Gothic", ${FONT}`;
    g.fillText('P A R K I N G  ·  L E V E L  P 1', x + 286, y + 44, 420);
  }
  // l'annexe : le supermarché, la brocante, la jardinerie, le fléchage
  {
    const plate = (i, bg, ink, font, text, deco) => {
      const [x, y] = cellXY(i);
      g.fillStyle = bg;
      g.fillRect(x, y, 512, 64);
      g.fillStyle = ink;
      g.font = font;
      g.fillText(text, x + 256, y + 45, 440);
      if (deco) deco(x, y);
    };
    plate(SIGN_MARKET, '#f4f1e6', '#1f7a3a', `900 40px ${FONT}`, 'GREENFIELD MARKET', (x, y) => {
      g.fillStyle = '#d8262c';
      g.fillRect(x, y, 512, 7);
      g.fillRect(x, y + 57, 512, 7);
    });
    plate(SIGN_FLEA, '#2a1f16', '#e0c48a', 'italic 38px Georgia, "Times New Roman", serif', 'Second Chance Antiques', (x, y) => {
      g.strokeStyle = '#e0c48a';
      g.lineWidth = 1.5;
      g.strokeRect(x + 6, y + 6, 500, 52);
    });
    plate(SIGN_GARDEN, '#16331f', '#dfe9c8', `bold 34px "Futura", "Century Gothic", ${FONT}`, 'EVERGREEN · GARDEN CENTRE', null);
    plate(26, '#1a0f3a', '#ffd86a', `900 44px ${FONT}`, 'B O X   O F F I C E', (x, y) => {
      g.fillStyle = '#ff5fa8';
      g.fillRect(x + 10, y + 6, 492, 3);
      g.fillRect(x + 10, y + 55, 492, 3);
    });
    // le comptoir des confiseries : trois tableaux de tarifs
    [['POPCORN', ['SMALL 1.50', 'MEDIUM 2.25', 'LARGE 3.00', 'BUTTER +.25']], ['COLD DRINKS', ['COLA', 'ORANGE', 'LEMON-LIME', 'ROOT BEER']], ['CANDY · NACHOS', ['CANDY 1.25', 'NACHOS 2.50', 'HOT DOG 1.75', 'PRETZEL 1.50']]].forEach(([title, items], k) => {
      const [x, y] = cellXY(SIGN_SNACKS + k);
      g.fillStyle = '#16121c';
      g.fillRect(x, y, 512, 64);
      g.fillStyle = ['#ffd23a', '#5fd0ff', '#ff7ab0'][k];
      g.font = `900 26px ${FONT}`;
      g.textAlign = 'left';
      g.fillText(title, x + 14, y + 27);
      g.fillStyle = '#f3ecd8';
      g.font = `bold 15px ${FONT}`;
      items.forEach((t, i) => g.fillText(t, x + 14 + i * 124, y + 52, 116));
      g.textAlign = 'center';
      g.strokeStyle = '#b08a3a';
      g.lineWidth = 2;
      g.strokeRect(x + 3, y + 3, 506, 58);
    });
    // les kiosques
    [['KEYS CUT · ENGRAVING', '#f2c230', '#1a1a1a'], ['SUNGLASS SHACK', '#0f6f7a', '#f4f4f0'], ['PHONE CARDS · PAGERS', '#b3202a', '#ffffff'], ['LOTTO · NEWS · TOBACCO', '#1f3f8a', '#ffe14a']].forEach(([t, bg, ink], k) => plate(SIGN_KIOSK + k, bg, ink, `900 36px ${FONT}`, t, null));
    plate(SIGN_BACK5, '#efe9d8', '#b3202a', `900 40px ${FONT}`, 'BACK IN 5 MINUTES', (x, y) => {
      g.strokeStyle = '#b3202a';
      g.lineWidth = 3;
      g.strokeRect(x + 6, y + 6, 500, 52);
    });
    plate(SIGN_POPCORN, '#c41f1f', '#ffe14a', `900 46px ${FONT}`, 'P O P C O R N', (x, y) => {
      g.fillStyle = '#ffffff';
      for (let k = 0; k < 13; k++) g.fillRect(x + 6 + k * 40, y + 2, 20, 6);
    });
    plate(SIGN_ANNEX, '#3a2a1c', '#f1e2c4', `bold 30px "Futura", "Century Gothic", ${FONT}`, 'THE ANNEX · MARKET · ANTIQUES · GARDEN', (x, y) => {
      g.fillStyle = '#d9a441';
      g.fillRect(x, y + 58, 512, 6);
    });
  }
  // les grandes enseignes (1024 × 128)
  const A0 = SIGN_A0;
  {
    // Hartwell's : des lettres de bronze découpées, posées à même le mur (le fond reste transparent)
    const y = A0;
    g.clearRect(0, y, 1024, 128);
    g.fillStyle = '#2b241c';
    g.font = '300 96px "Helvetica Neue", "Futura", Arial, sans-serif';
    g.fillText("Hartwell's", 512, y + 100);
  }
  {
    // Brandt & Co. : des capitales d'acier ; le D est tombé (il reste sa trace plus claire)
    const y = A0 + 128;
    g.fillStyle = '#17181b';
    g.fillRect(0, y, 1024, 128);
    g.font = `300 78px "Futura", "Century Gothic", ${FONT}`;
    const txt = 'B R A N D T   &   C O .';
    const w = Math.min(900, g.measureText(txt).width);
    let x = 512 - w / 2;
    g.textAlign = 'left';
    for (const ch of txt) {
      const cw = (g.measureText(ch).width * w) / g.measureText(txt).width;
      g.fillStyle = ch === 'D' ? 'rgba(70,72,78,0.9)' : '#c9ccd2';
      g.fillText(ch, x, y + 90);
      x += cw;
    }
    g.textAlign = 'center';
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let k = 0; k < 40; k++) g.fillRect(hash(k, 1) * 1024, y + hash(k, 2) * 128, 2, 20 + hash(k, 3) * 60);
  }
  {
    // The Pavilion : terre cuite et crème
    const y = A0 + 256;
    g.fillStyle = '#8f3d24';
    g.fillRect(0, y, 1024, 128);
    g.fillStyle = '#f1e2c4';
    g.font = 'italic bold 80px Georgia, "Times New Roman", serif';
    g.fillText('the Pavilion', 430, y + 88);
    g.font = `bold 22px ${FONT}`;
    g.fillText('F O O D   C O U R T', 840, y + 62);
    g.fillRect(730, y + 76, 220, 3);
    g.fillText('L E V E L   2', 840, y + 104);
  }
  {
    // Stardust 8 Cinemas : un fronton, sa guirlande d'ampoules
    const y = A0 + 384;
    g.fillStyle = '#1a0f3a';
    g.fillRect(0, y, 1024, 128);
    for (let k = 0; k < 44; k++) {
      g.fillStyle = k % 7 === 3 ? '#4a3a1a' : '#ffd86a';
      for (const yy of [y + 10, y + 118]) {
        g.beginPath();
        g.arc(14 + k * 23.2, yy, 5, 0, 7);
        g.fill();
      }
    }
    g.fillStyle = '#ffd86a';
    g.font = `900 78px ${FONT}`;
    g.fillText('STARDUST 8', 400, y + 90);
    g.fillStyle = '#ff5fa8';
    g.font = `bold 30px ${FONT}`;
    g.fillText('C I N E M A S', 850, y + 78);
    g.fillStyle = '#ffd86a';
    for (const [sx, sy, r] of [[690, y + 44, 14], [985, y + 40, 9], [720, y + 98, 7]]) {
      g.beginPath();
      for (let p = 0; p < 10; p++) g.lineTo(sx + Math.sin((p * Math.PI) / 5) * (p % 2 ? r * 0.45 : r), sy - Math.cos((p * Math.PI) / 5) * (p % 2 ? r * 0.45 : r));
      g.fill();
    }
  }
  // les grands chiffres des salles : bordeaux, ourlés d'un halo bleuté (rétroéclairés), sur fond transparent
  for (let n = 1; n <= 6; n++) {
    const x = (n - 1) * 160;
    const y = A0 + 512;
    g.clearRect(x, y, 160, 256);
    g.font = '900 250px "Arial Black", "Helvetica Neue", Arial, sans-serif';
    g.shadowColor = n > 2 ? 'rgba(0,0,0,0)' : 'rgba(170,190,255,1)';
    g.shadowBlur = 16;
    g.fillStyle = n > 2 ? '#4a1620' : '#8f2433';
    g.fillText(String(n), x + 80, y + 222, 132);
    g.fillText(String(n), x + 80, y + 222, 132);
    g.shadowBlur = 0;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
// une petite case (c0 à c1 : la part de sa largeur) ; une grande enseigne
export const signUV = (i, c0 = 0, c1 = 1) => [((i % 2) * 512 + 2 + 508 * c0) / 1024, 1 - (Math.floor(i / 2) * 64 + 62) / SIGN_H, ((i % 2) * 512 + 2 + 508 * c1) / 1024, 1 - (Math.floor(i / 2) * 64 + 2) / SIGN_H];
export const anchorUV = (k) => [2 / 1024, 1 - (SIGN_A0 + k * 128 + 126) / SIGN_H, 1022 / 1024, 1 - (SIGN_A0 + k * 128 + 2) / SIGN_H];

let TEX = null;
export function createGoods({ G, MATS, baked }) {
  if (!TEX) TEX = signAtlas();
  if (!MATS.deptSign) {
    // (alphaTest : quelques enseignes sont des lettres découpées, sans fond)
    MATS.deptSign = { m: baked(new THREE.MeshLambertMaterial({ map: TEX, alphaTest: 0.4 })), S: 1 };
    MATS.deptLit = { m: new THREE.MeshBasicMaterial({ map: TEX, alphaTest: 0.4, color: new THREE.Color(1, 1, 1).multiplyScalar(1.15) }), S: 1 };
  }
  // un panneau (une case de l'atlas des panneaux), vertical, centré en (x, y, z), tourné vers (nx, nz) ; both : recto verso
  const sign = (i, x, y, z, w, h, nx, nz, lit = false, both = false, U = signUV(i)) => {
    for (const s of both ? [1, -1] : [1]) {
      const geo = new THREE.PlaneGeometry(w, h);
      const a = geo.attributes.uv;
      for (let k = 0; k < a.count; k++) a.setXY(k, a.getX(k) > 0.5 ? U[2] : U[0], a.getY(k) > 0.5 ? U[3] : U[1]);
      geo.rotateY(Math.atan2(nx * s, nz * s));
      G.add(lit ? 'deptLit' : 'deptSign', geo.translate(x + nx * s * 0.012, y, z + nz * s * 0.012));
    }
  };
  return { sign };
}
