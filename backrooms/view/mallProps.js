// The Backrooms (Level 17, le Mall) - Le mobilier et les enseignes, dessinés d'après la carte (engine/mall.js, furn) :
// bancs, poubelles, jardinières aux palmiers morts, kiosques fermés, plans du centre éclairés, fontaines à sec, une
// chaise seule ; dans les boutiques, rayonnages, comptoirs, portants, tables de présentation, gravats et échelles ; le
// food court (comptoirs et leurs menus lumineux, tables rondes, chaises renversées) ; le grand magasin (gondoles,
// portants, mannequins) ; le cinéma (confiserie, bornes d'arcade, cordons, fauteuils rouges, écrans) ; toilettes,
// bureaux, quais, locaux techniques. Tout passe par le constructeur de mall.js (G) : une géométrie par matière.
// Les noms (boutiques, stands, films) sont inventés.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL_SIZE as C } from '../engine/map.js';

// --- Les textures écrites : enseignes, menus, affiches, plan du centre ---
const SIGN_FONTS = ['bold 64px "Futura", "Century Gothic", sans-serif', 'italic bold 66px Georgia, serif', 'bold 60px "Arial Narrow", Arial, sans-serif', '700 62px "Brush Script MT", "Snell Roundhand", cursive'];
const SIGN_INK = ['#e8d8b0', '#d9a441', '#f0e6d0', '#c8463c', '#7fc4d8', '#e2c27a'];
const STALLS = ['GOLDEN WOK', 'PRETZEL JUNCTION', 'BURGER BARN', 'TACO FIESTA', 'SAKURA EXPRESS', 'CORN DOG CORNER', 'FROSTY SWIRL', 'PIZZA NAPOLI', 'SPUD STOP', 'LEMON GROVE'];
const FILMS = ['STARFALL', 'THE LAST SUMMER', 'NIGHT SHIFT', 'PARADE OF LIGHTS', 'THE QUIET FLOOR', 'CLOSING TIME', 'NEON RIVER', 'HOMECOMING'];

function atlas(cols, rows, cw, ch) {
  const c = document.createElement('canvas');
  c.width = cols * cw;
  c.height = rows * ch;
  return [c, c.getContext('2d')];
}
const toTex = (c) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
// une case de l'atlas : ses coordonnées de texture (u0, v0, u1, v1)
const slotUV = (i, cols, rows) => {
  const cx = i % cols;
  const cy = Math.floor(i / cols);
  return [cx / cols, 1 - (cy + 1) / rows, (cx + 1) / cols, 1 - cy / rows];
};

// les enseignes des boutiques : une case de 512 × 64 par boutique (lettres crème, laiton, rouges… sur le noir du
// bandeau) ; une lettre sur douze est tombée
function signAtlas(shops) {
  const cols = 2;
  const rows = Math.max(1, Math.ceil(shops.length / cols));
  const [c, g] = atlas(cols, rows, 512, 64);
  g.fillStyle = '#0d0c0b';
  g.fillRect(0, 0, c.width, c.height);
  shops.forEach((sh, i) => {
    const x = (i % cols) * 512;
    const y = Math.floor(i / cols) * 64;
    g.save();
    g.beginPath();
    g.rect(x, y, 512, 64);
    g.clip();
    g.font = SIGN_FONTS[sh.sign % SIGN_FONTS.length];
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const name = sh.sign % 4 === 3 ? sh.name : sh.name.toUpperCase();
    // la largeur : on serre si le nom est long
    const w = g.measureText(name).width;
    const k = Math.min(1, 470 / w);
    g.translate(x + 256, y + 34);
    g.scale(k, 1);
    let s = 0;
    for (const ch of name) s = (s * 31 + ch.charCodeAt(0)) % 9973;
    const chars = [...name];
    let px = -g.measureText(name).width / 2;
    g.textAlign = 'left';
    chars.forEach((ch, j) => {
      const cw = g.measureText(ch).width;
      const gone = ch !== ' ' && (s + j * 7) % 12 === 5;
      if (!gone) {
        g.fillStyle = SIGN_INK[(sh.sign + i) % SIGN_INK.length];
        g.globalAlpha = 0.75 + ((s + j) % 5) * 0.05;
        g.fillText(ch, px, 0);
      } else {
        // la trace plus claire de la lettre tombée
        g.globalAlpha = 0.12;
        g.fillStyle = '#d8ccb0';
        g.fillText(ch, px, 0);
      }
      px += cw;
    });
    g.restore();
  });
  return { tex: toTex(c), uv: (i) => slotUV(i, cols, rows) };
}

// les menus lumineux des stands du food court
function menuAtlas() {
  const cols = 2;
  const rows = 5;
  const [c, g] = atlas(cols, rows, 512, 128);
  STALLS.forEach((name, i) => {
    const x = (i % cols) * 512;
    const y = Math.floor(i / cols) * 128;
    const hue = (i * 47) % 360;
    const gr = g.createLinearGradient(x, y, x, y + 128);
    gr.addColorStop(0, `hsl(${hue},55%,42%)`);
    gr.addColorStop(1, `hsl(${hue},60%,22%)`);
    g.fillStyle = gr;
    g.fillRect(x, y, 512, 128);
    g.fillStyle = '#f6efd8';
    g.font = 'bold 40px "Futura", "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.fillText(name, x + 256, y + 46);
    // les lignes du menu : des prix illisibles
    g.globalAlpha = 0.65;
    g.font = '15px Arial, sans-serif';
    for (let k = 0; k < 3; k++) {
      g.textAlign = 'left';
      g.fillText(['COMBO ' + (k + 1), 'REGULAR', 'LARGE'][k], x + 40 + k * 155, y + 84);
      g.fillText(`$${(2 + ((i + k) % 5) + 0.49).toFixed(2)}`, x + 40 + k * 155, y + 106);
    }
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 6;
    g.strokeRect(x + 3, y + 3, 506, 122);
  });
  return { tex: toTex(c), uv: (i) => slotUV(i % STALLS.length, cols, rows) };
}

// les affiches des films (des caissons lumineux) : un dégradé, une silhouette, un titre
function posterAtlas() {
  const cols = 4;
  const rows = 2;
  const [c, g] = atlas(cols, rows, 256, 384);
  FILMS.forEach((name, i) => {
    const x = (i % cols) * 256;
    const y = Math.floor(i / cols) * 384;
    const h1 = (i * 67 + 200) % 360;
    const gr = g.createLinearGradient(x, y, x, y + 384);
    gr.addColorStop(0, `hsl(${h1},50%,12%)`);
    gr.addColorStop(0.6, `hsl(${(h1 + 40) % 360},60%,30%)`);
    gr.addColorStop(1, `hsl(${(h1 + 80) % 360},50%,10%)`);
    g.fillStyle = gr;
    g.fillRect(x, y, 256, 384);
    // une silhouette (une figure, un horizon, une lune)
    g.fillStyle = 'rgba(0,0,0,0.75)';
    if (i % 3 === 0) {
      g.beginPath();
      g.arc(x + 128, y + 170, 26, 0, 7);
      g.fill();
      g.fillRect(x + 104, y + 196, 48, 110);
    } else if (i % 3 === 1) {
      g.beginPath();
      g.moveTo(x, y + 290);
      for (let k = 0; k <= 8; k++) g.lineTo(x + k * 32, y + 260 + ((k * 37) % 40));
      g.lineTo(x + 256, y + 384);
      g.lineTo(x, y + 384);
      g.fill();
    } else {
      g.fillStyle = 'rgba(255,240,210,0.8)';
      g.beginPath();
      g.arc(x + 160, y + 120, 40, 0, 7);
      g.fill();
    }
    g.fillStyle = '#f2ead6';
    g.font = 'bold 28px "Futura", "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.fillText(name, x + 128, y + 340, 236);
    g.font = '11px Arial, sans-serif';
    g.globalAlpha = 0.7;
    g.fillText('COMING SOON', x + 128, y + 362);
    g.globalAlpha = 1;
  });
  return { tex: toTex(c), uv: (i) => slotUV(i % FILMS.length, cols, rows) };
}

// le plan du centre (les deux étages schématisés), « YOU ARE HERE »
function directoryTex(name) {
  const [c, g] = atlas(1, 1, 256, 320);
  g.fillStyle = '#1b2a33';
  g.fillRect(0, 0, 256, 320);
  g.fillStyle = '#e9dcc0';
  g.font = 'bold 20px "Futura", Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(name, 128, 30);
  g.font = '11px Arial, sans-serif';
  g.fillText('DIRECTORY · LEVEL 1 & 2', 128, 48);
  const cols = ['#c9a45a', '#7da6b8', '#b86e5a', '#8fae7a', '#a58ac0'];
  for (let k = 0; k < 2; k++) {
    const y0 = 66 + k * 122;
    g.strokeStyle = '#e9dcc0';
    g.lineWidth = 1;
    g.strokeRect(14, y0, 228, 108);
    for (let i = 0; i < 18; i++) {
      g.fillStyle = cols[(i * 3 + k) % cols.length];
      g.globalAlpha = 0.75;
      g.fillRect(18 + (i % 9) * 25, y0 + (i < 9 ? 6 : 70), 21, 30);
    }
    g.globalAlpha = 1;
    g.fillStyle = '#e9dcc0';
    g.fillRect(18, y0 + 44, 220, 18);
  }
  g.fillStyle = '#e8402e';
  g.beginPath();
  g.arc(86, 66 + 53, 6, 0, 7);
  g.fill();
  g.font = 'bold 10px Arial, sans-serif';
  g.fillText('YOU ARE HERE', 86, 66 + 40);
  g.fillStyle = '#e9dcc0';
  g.font = '10px Arial, sans-serif';
  for (let i = 0; i < 4; i++) g.fillRect(20, 300 + i * 0, 216, 1);
  return toTex(c);
}

// --- Le mobilier ---
export function drawMallProps({ map, fi, G, MATS, hAt, baked, rooms }) {
  const furn = map.furn || [];
  // les matières propres au mobilier
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  const phong = (o) => new THREE.MeshPhongMaterial(o);
  MATS.red = MATS.red || { m: baked(lam({ color: '#6e1418' })), S: 1 };
  MATS.plastic = MATS.plastic || { m: baked(phong({ color: '#d9d3c4', specular: '#333', shininess: 40 })), S: 1 };
  MATS.soil = MATS.soil || { m: baked(lam({ color: '#2a2018' })), S: 1 };
  MATS.frond = MATS.frond || { m: baked(lam({ color: '#4a3f26', side: THREE.DoubleSide })), S: 1 };
  MATS.cloth = MATS.cloth || { m: baked(lam({ color: '#5b5560' })), S: 1 };
  MATS.cloth2 = MATS.cloth2 || { m: baked(lam({ color: '#7d5a46' })), S: 1 };
  MATS.carton = MATS.carton || { m: baked(lam({ color: '#8f7350' })), S: 1 };
  MATS.screenWhite = MATS.screenWhite || { m: baked(lam({ color: '#b9b6ae' })), S: 1 };
  const lit = (map2, k = 1.25) => new THREE.MeshBasicMaterial({ map: map2, color: new THREE.Color(1, 1, 1).multiplyScalar(k) });

  // une boîte dans le repère du meuble : lx le long de w, lz en travers (vers l'avant : face), ly vers le haut
  const frame = (it) => {
    const f = it.face || 1;
    return (lx, lz) => (it.rot ? [it.x + lz * f, it.z + lx] : [it.x + lx, it.z + lz * f]);
  };
  const lbox = (k, it, lx0, lx1, y0, y1, lz0, lz1, skip = '') => {
    const P = frame(it);
    const a = P(lx0, lz0);
    const b = P(lx1, lz1);
    G.box(k, Math.min(a[0], b[0]), Math.max(a[0], b[0]), y0, y1, Math.min(a[1], b[1]), Math.max(a[1], b[1]), skip);
  };
  // une géométrie posée en (x, y, z), tournée de yaw
  const put = (k, geo, x, y, z, yaw = 0, roll = 0) => {
    if (roll) geo.rotateZ(roll);
    if (yaw) geo.rotateY(yaw);
    G.add(k, geo.translate(x, y, z));
  };
  const chairAt = (x, z, yaw, tipped = false) => {
    const parts = [
      ['plastic', new THREE.BoxGeometry(0.44, 0.04, 0.42).translate(0, 0.45, 0)],
      ['plastic', new THREE.BoxGeometry(0.44, 0.42, 0.04).translate(0, 0.68, -0.2)],
      ...[[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]].map(([a, b]) => ['steel', new THREE.CylinderGeometry(0.014, 0.014, 0.45, 6).translate(a, 0.225, b)]),
    ];
    for (const [k, g] of parts) {
      if (tipped) g.rotateX(-Math.PI / 2).translate(0, 0.22, 0.45);
      put(k, g, x, 0, z, yaw);
    }
  };
  let si = 0;
  const signs = map.shops && map.shops.length ? signAtlas(map.shops) : null;
  const menus = menuAtlas();
  const posters = posterAtlas();
  if (signs) MATS.signs = { m: baked(lam({ map: signs.tex })), S: 1 };
  MATS.menus = { m: lit(menus.tex, 1.1), S: 1 };
  MATS.menusOff = { m: baked(lam({ map: menus.tex, color: '#6a6a6a' })), S: 1 };
  MATS.posters = { m: lit(posters.tex, 1.15), S: 1 };
  MATS.postersOff = { m: baked(lam({ map: posters.tex, color: '#777' })), S: 1 };
  MATS.directory = { m: lit(directoryTex('HALCYON PARK MALL'), 1.1), S: 1 };
  MATS.arcadeGlow = { m: new THREE.MeshBasicMaterial({ color: new THREE.Color('#6f3cff').multiplyScalar(1.6) }), S: 1 };
  MATS.arcadeGlow2 = { m: new THREE.MeshBasicMaterial({ color: new THREE.Color('#14c8b4').multiplyScalar(1.5) }), S: 1 };
  // un panneau texturé (une case d'atlas) : une face de w × h, centrée en (x, y, z), tournée vers (nx, nz)
  const panel = (k, uv, x, y, z, w, h, nx, nz) => {
    const g = new THREE.PlaneGeometry(w, h);
    const a = g.attributes.uv;
    for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) ? uv[2] : uv[0], a.getY(i) ? uv[3] : uv[1]);
    g.rotateY(Math.atan2(nx, nz));
    G.add(k, g.translate(x, y, z));
  };
  const lights = []; // les feux de couleur du mobilier (bornes d'arcade allumées)

  for (const it of furn) {
    const hw = it.w / 2;
    const hd = it.d / 2;
    switch (it.kind) {
      case 'bench': {
        lbox('wood', it, -hw, hw, 0.42, 0.47, -hd, hd - 0.05);
        lbox('wood', it, -hw, hw, 0.55, 0.86, -hd, -hd + 0.05);
        for (const lx of [-hw + 0.15, hw - 0.15]) {
          lbox('black', it, lx - 0.03, lx + 0.03, 0, 0.42, -hd + 0.05, hd - 0.1);
          lbox('black', it, lx - 0.03, lx + 0.03, 0.42, 0.86, -hd, -hd + 0.06);
        }
        break;
      }
      case 'bin':
        put('steel', new THREE.CylinderGeometry(0.24, 0.22, 0.8, 18, 1, true), it.x, 0.4, it.z);
        put('black', new THREE.CylinderGeometry(0.255, 0.255, 0.07, 18), it.x, 0.8, it.z);
        break;
      case 'planter': {
        lbox('marbleDark', it, -hw, hw, 0, 0.62, -hd, hd, '-y+y');
        lbox('trim', it, -hw - 0.04, hw + 0.04, 0.62, 0.68, -hd - 0.04, hd + 0.04, '-y');
        lbox('soil', it, -hw + 0.06, hw - 0.06, 0.55, 0.6, -hd + 0.06, hd - 0.06, '-y');
        if (it.plant === 0) {
          // un palmier mort : le tronc, des palmes brunes qui pendent
          put('wood', new THREE.CylinderGeometry(0.09, 0.14, 2.6, 10), it.x, 0.6 + 1.3, it.z);
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            const g = new THREE.PlaneGeometry(0.28, 1.5).translate(0, -0.75, 0).rotateX(-0.9 - (i % 3) * 0.2);
            put('frond', g, it.x, 3.15, it.z, a);
          }
        } else if (it.plant === 1) {
          // des tiges sèches
          for (let i = 0; i < 9; i++) put('wood', new THREE.CylinderGeometry(0.012, 0.02, 0.9 + (i % 3) * 0.3, 5), it.x + Math.cos(i) * 0.3, 1.0, it.z + Math.sin(i * 1.7) * 0.3, i, 0.2 + (i % 4) * 0.1);
        }
        break;
      }
      case 'kiosk': {
        lbox('trim', it, -hw, hw, 0, 1.0, -hd, hd);
        lbox('marbleDark', it, -hw - 0.06, hw + 0.06, 1.0, 1.05, -hd - 0.06, hd + 0.06);
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lbox('brass', it, a * (hw - 0.05) - 0.04, a * (hw - 0.05) + 0.04, 1.05, 2.35, b * (hd - 0.05) - 0.04, b * (hd - 0.05) + 0.04, '+y-y');
        // les volets roulants baissés, le toit
        lbox('steel', it, -hw + 0.08, hw - 0.08, 1.05, 2.35, -hd + 0.08, hd - 0.08, '-y');
        lbox('trim', it, -hw - 0.2, hw + 0.2, 2.35, 2.62, -hd - 0.2, hd + 0.2);
        lbox('brass', it, -hw - 0.21, hw + 0.21, 2.44, 2.5, -hd - 0.21, hd + 0.21, '+y-y');
        break;
      }
      case 'directory': {
        for (const lx of [-hw + 0.08, hw - 0.08]) lbox('black', it, lx - 0.04, lx + 0.04, 0, 2.15, -0.04, 0.04, '-y');
        lbox('black', it, -hw, hw, 0.45, 2.1, -hd, hd);
        // les deux faces éclairées
        for (const s of [-1, 1]) {
          const P = frame(it);
          const [x, z] = P(0, s * (hd + 0.004));
          const n = P(0, s);
          panel('directory', [0, 0, 1, 1], x, 1.28, z, it.w - 0.14, 1.52, n[0] - it.x, n[1] - it.z);
        }
        break;
      }
      case 'fountain': {
        const R = it.w / 2;
        const oct = (r) => Array.from({ length: 8 }, (_, i) => [it.x + Math.cos(((i + 0.5) / 8) * Math.PI * 2) * r, it.z + Math.sin(((i + 0.5) / 8) * Math.PI * 2) * r]);
        const O = oct(R);
        const I = oct(R - 0.35);
        for (let i = 0; i < 8; i++) {
          const a = O[i];
          const b = O[(i + 1) % 8];
          const mx = (a[0] + b[0]) / 2 - it.x;
          const mz = (a[1] + b[1]) / 2 - it.z;
          G.vface('marbleDark', a[0], a[1], b[0], b[1], 0, 0.55, mx, mz);
          const c = I[i];
          const d = I[(i + 1) % 8];
          G.vface('marbleDark', c[0], c[1], d[0], d[1], 0.12, 0.55, -mx, -mz);
          G.quad('trim', [a[0], 0.55, a[1]], [b[0], 0.55, b[1]], [d[0], 0.55, d[1]], [c[0], 0.55, c[1]], [0, 1, 0]);
        }
        G.hpoly('slab', I, 0.12, 1);
        put('trim', new THREE.CylinderGeometry(0.32, 0.45, 1.3, 16), it.x, 0.12 + 0.65, it.z);
        put('trim', new THREE.CylinderGeometry(1.3, 0.5, 0.3, 24), it.x, 1.5, it.z);
        put('soil', new THREE.CylinderGeometry(1.15, 1.15, 0.02, 24), it.x, 1.65, it.z);
        break;
      }
      case 'chair':
        chairAt(it.x, it.z, it.yaw || 0);
        break;
      case 'shelf': {
        lbox('paintGrey', it, -hw, hw, 0, 2.0, -hd, -hd + 0.03);
        for (const lx of [-hw, hw - 0.03]) lbox('steel', it, lx, lx + 0.03, 0, 2.0, -hd, hd);
        for (let k = 0; k < 5; k++) lbox('steel', it, -hw, hw, 0.12 + k * 0.45, 0.15 + k * 0.45, -hd, hd);
        // ce qui reste sur les étagères
        for (let k = 0; k < 4; k++)
          for (let i = 0; i < 6; i++) {
            if ((it.id * 7 + k * 3 + i * 5) % 4) continue;
            const lx = -hw + 0.3 + (i / 6) * (it.w - 0.6);
            lbox('carton', it, lx - 0.12, lx + 0.12, 0.15 + k * 0.45, 0.15 + k * 0.45 + 0.22, -hd + 0.06, hd - 0.1);
          }
        break;
      }
      case 'counter':
        lbox('wood', it, -hw, hw, 0, 1.0, -hd, hd, '-y');
        lbox('marbleDark', it, -hw - 0.03, hw + 0.03, 1.0, 1.04, -hd - 0.03, hd + 0.03);
        lbox('black', it, -0.2, 0.2, 1.04, 1.2, -0.15, 0.15, '-y');
        break;
      case 'rack': {
        put('steel', new THREE.CylinderGeometry(0.3, 0.3, 0.03, 16), it.x, 0.015, it.z);
        put('steel', new THREE.CylinderGeometry(0.02, 0.02, 1.35, 6), it.x, 0.68, it.z);
        put('steel', new THREE.TorusGeometry(0.52, 0.015, 6, 28).rotateX(Math.PI / 2), it.x, 1.35, it.z);
        const n = (it.id * 5) % 9;
        for (let i = 0; i < n; i++) {
          const a = (i / 9) * Math.PI * 2 + it.id;
          put(i % 2 ? 'cloth' : 'cloth2', new THREE.BoxGeometry(0.4, 0.75, 0.04), it.x + Math.cos(a) * 0.52, 0.95, it.z + Math.sin(a) * 0.52, -a);
        }
        break;
      }
      case 'table':
        lbox('wood', it, -hw, hw, 0.78, 0.84, -hd, hd);
        lbox('wood', it, -hw + 0.05, hw - 0.05, 0, 0.78, -hd + 0.05, hd - 0.05, '+y-y');
        if (it.id % 3) lbox('carton', it, -0.3, 0.1, 0.84, 1.0, -0.2, 0.15, '-y');
        break;
      case 'debris':
        for (let i = 0; i < 6; i++) {
          const a = it.id * 3 + i;
          put(i % 3 === 0 ? 'ceilTiles' : i % 3 === 1 ? 'block' : 'plaster', new THREE.BoxGeometry(0.3 + (a % 4) * 0.12, 0.04 + (a % 3) * 0.05, 0.3 + (a % 5) * 0.1), it.x + ((a * 37) % 100) / 100 - 0.5, 0.04, it.z + ((a * 61) % 100) / 100 - 0.5, a, (a % 3) * 0.1);
        }
        break;
      case 'ladder': {
        for (const s of [-1, 1]) {
          G.beam('steel', [it.x - 0.25, 0, it.z + s * 0.6], [it.x - 0.25, 1.9, it.z], 0.05, 0.03);
          G.beam('steel', [it.x + 0.25, 0, it.z + s * 0.6], [it.x + 0.25, 1.9, it.z], 0.05, 0.03);
        }
        for (let k = 1; k < 6; k++) G.beam('steel', [it.x - 0.25, k * 0.3, it.z + 0.6 - k * 0.095], [it.x + 0.25, k * 0.3, it.z + 0.6 - k * 0.095], 0.03, 0.03);
        break;
      }
      case 'stall':
        if (it.toilet) {
          // une cabine : deux cloisons, une porte entrouverte, la cuvette
          for (const lx of [-hw, hw - 0.03]) lbox('paintGrey', it, lx, lx + 0.03, 0.15, 2.0, -hd, hd);
          lbox('paintGrey', it, -hw, -hw + 0.5, 0.15, 2.0, -hd, -hd + 0.03);
          const [tx, tz] = frame(it)(0, hd - 0.4);
          put('plastic', new THREE.CylinderGeometry(0.2, 0.16, 0.42, 14), tx, 0.21, tz);
        } else {
          // un stand du food court : le comptoir, l'auvent, le menu lumineux (un sur trois éteint)
          lbox('trim', it, -hw, hw, 0, 1.05, -hd, hd, '-y');
          lbox('steel', it, -hw - 0.03, hw + 0.03, 1.05, 1.09, -hd - 0.05, hd + 0.03);
          lbox('trim', it, -hw, hw, 3.3, 3.75, -hd - 0.1, -hd + 0.6);
          const P = frame(it);
          const [x, z] = P(0, -hd - 0.08);
          panel(it.sign % 3 === 2 ? 'menusOff' : 'menus', menus.uv(it.sign), x, 2.75, z, it.w - 0.6, 0.95, P(0, 1)[0] - it.x, P(0, 1)[1] - it.z);
          for (const lx of [-hw + 0.04, hw - 0.04]) lbox('trim', it, lx - 0.04, lx + 0.04, 1.05, 3.3, -hd - 0.1, -hd);
        }
        break;
      case 'diner': {
        put('plastic', new THREE.CylinderGeometry(0.62, 0.62, 0.035, 24), it.x, 0.74, it.z);
        put('black', new THREE.CylinderGeometry(0.05, 0.05, 0.72, 8), it.x, 0.37, it.z);
        put('black', new THREE.CylinderGeometry(0.28, 0.32, 0.03, 16), it.x, 0.015, it.z);
        for (let i = 0; i < 4; i++) {
          if (!((it.chairs >> i) & 1)) continue;
          const a = (i / 4) * Math.PI * 2 + it.id * 0.3;
          chairAt(it.x + Math.cos(a) * 0.95, it.z + Math.sin(a) * 0.95, Math.PI / 2 - a + Math.PI, it.tipped && i === 0);
        }
        if (it.tipped) put('plastic', new THREE.CylinderGeometry(0.62, 0.62, 0.035, 24).rotateX(1.35), it.x + 0.4, 0.62, it.z);
        break;
      }
      case 'gondola': {
        lbox('paintGrey', it, -hw, hw, 0, 1.6, -0.03, 0.03);
        lbox('paintGrey', it, -hw, hw, 0, 0.12, -hd, hd, '-y');
        for (const lx of [-hw, hw - 0.04]) lbox('steel', it, lx, lx + 0.04, 0, 1.65, -hd, hd, '-y');
        for (let k = 1; k < 4; k++) for (const s of [-1, 1]) lbox('steel', it, -hw, hw, 0.12 + k * 0.42, 0.15 + k * 0.42, s > 0 ? 0.03 : -hd, s > 0 ? hd : -0.03);
        if (!it.empty)
          for (let k = 0; k < 4; k++)
            for (let i = 0; i < 8; i++) {
              if ((it.id + k * 3 + i * 7) % 3 === 0) continue;
              const lx = -hw + 0.4 + (i / 8) * (it.w - 0.8);
              for (const s of [-1, 1]) lbox('carton', it, lx - 0.13, lx + 0.13, 0.15 + k * 0.42, 0.15 + k * 0.42 + 0.25, s > 0 ? 0.08 : -hd + 0.05, s > 0 ? hd - 0.05 : -0.08);
            }
        break;
      }
      case 'mannequin': {
        const y = it.yaw || 0;
        put('steel', new THREE.CylinderGeometry(0.22, 0.22, 0.03, 16), it.x, 0.015, it.z);
        put('steel', new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6), it.x, 0.14, it.z);
        put('plastic', new THREE.CylinderGeometry(0.055, 0.05, 0.85, 8).translate(-0.09, 0, 0), it.x, 0.68, it.z, y);
        put('plastic', new THREE.CylinderGeometry(0.055, 0.05, 0.85, 8).translate(0.09, 0, 0), it.x, 0.68, it.z, y);
        put('plastic', new THREE.CylinderGeometry(0.19, 0.15, 0.62, 12).scale(1, 1, 0.65), it.x, 1.42, it.z, y);
        put('plastic', new THREE.SphereGeometry(0.11, 12, 10).scale(0.85, 1.1, 0.95), it.x, 1.86, it.z, y);
        put('plastic', new THREE.CylinderGeometry(0.04, 0.035, 0.6, 6).translate(-0.24, 0, 0).rotateZ(0.12), it.x, 1.42, it.z, y);
        break;
      }
      case 'concession': {
        lbox('marbleDark', it, -hw, hw, 0, 1.05, -hd, hd, '-y');
        lbox('steel', it, -hw - 0.03, hw + 0.03, 1.05, 1.09, -hd - 0.03, hd + 0.03);
        lbox('glass', it, -hw + 0.2, hw - 0.2, 1.09, 1.5, hd - 0.12, hd - 0.1);
        // la machine à pop-corn, vide
        lbox('led', it, hw - 1.4, hw - 0.6, 1.09, 1.14, -0.3, 0.3, '-y');
        lbox('glass', it, hw - 1.4, hw - 0.6, 1.14, 1.9, -0.3, 0.3, '-y');
        lbox('red', it, hw - 1.45, hw - 0.55, 1.9, 2.05, -0.35, 0.35, '-y');
        // les menus au mur
        const P = frame(it);
        for (let i = 0; i < 3; i++) {
          const [x, z] = P(-hw + 1.5 + i * 3, -hd - 0.12 + 0.02);
          panel(i === 1 ? 'menusOff' : 'menus', menus.uv(7 + i), x, 3.0, z, 2.6, 0.7, P(0, 1)[0] - it.x, P(0, 1)[1] - it.z);
        }
        break;
      }
      case 'arcade': {
        lbox('black', it, -hw, hw, 0, 1.85, -hd, hd);
        const P = frame(it);
        const [x, z] = P(0, hd + 0.004);
        const n = P(0, 1);
        const glow = it.lit ? (it.id % 2 ? 'arcadeGlow' : 'arcadeGlow2') : 'black';
        panel(glow, [0, 0, 1, 1], x, 1.32, z, it.w - 0.2, 0.42, n[0] - it.x, n[1] - it.z);
        panel(it.lit ? 'menus' : 'menusOff', menus.uv(it.id), x, 1.74, z, it.w - 0.1, 0.16, n[0] - it.x, n[1] - it.z);
        lbox('steel', it, -hw, hw, 0.95, 1.0, hd, hd + 0.2, '-y');
        if (it.lit) {
          const [lx, lz] = P(0, hd + 0.5);
          const r = rooms[it.room];
          const box = r ? [r.x0 * C - 0.25, r.z0 * C - 0.25, (r.x1 + 1) * C + 0.25, (r.z1 + 1) * C + 0.25] : null;
          lights.push({ x: lx, y: 1.3, z: lz, c: it.id % 2 ? [0.45, 0.2, 1.0] : [0.1, 0.85, 0.75], rad: 3.2, nx: n[0] - it.x, nz: n[1] - it.z, box });
        }
        break;
      }
      case 'stanchion':
        put('brass', new THREE.CylinderGeometry(0.025, 0.025, 0.95, 8), it.x, 0.48, it.z);
        put('brass', new THREE.CylinderGeometry(0.16, 0.18, 0.03, 16), it.x, 0.015, it.z);
        put('brass', new THREE.SphereGeometry(0.045, 10, 8), it.x, 0.97, it.z);
        if (it.id < furn.length - 1 && furn[it.id + 1].kind === 'stanchion') {
          const o = furn[it.id + 1];
          G.beam('red', [it.x, 0.88, it.z], [(it.x + o.x) / 2, 0.72, (it.z + o.z) / 2], 0.035, 0.035);
          G.beam('red', [(it.x + o.x) / 2, 0.72, (it.z + o.z) / 2], [o.x, 0.88, o.z], 0.035, 0.035);
        }
        break;
      case 'seats': {
        // une rangée de fauteuils rouges (tournés vers +x : l'écran est à l'est)
        const n = Math.floor(it.w / 0.56);
        for (let i = 0; i < n; i++) {
          const lx = -hw + 0.28 + i * 0.56;
          lbox('red', it, lx - 0.25, lx + 0.25, 0.38, 0.5, -0.25, 0.22);
          lbox('red', it, lx - 0.25, lx + 0.25, 0.4, 1.05, -0.31, -0.18);
          lbox('black', it, lx + 0.25, lx + 0.31, 0, 0.66, -0.3, 0.22);
        }
        lbox('black', it, -hw - 0.03, -hw + 0.03, 0, 0.66, -0.3, 0.22);
        break;
      }
      case 'sinks': {
        lbox('marbleDark', it, -hw, hw, 0.82, 0.88, -hd, hd);
        lbox('paintGrey', it, -hw, hw, 0, 0.82, -hd + 0.05, -hd + 0.1);
        const P = frame(it);
        for (let i = 0; i < 3; i++) {
          const [x, z] = P(-hw + 0.9 + i * 1.6, 0.05);
          put('plastic', new THREE.CylinderGeometry(0.2, 0.14, 0.12, 14), x, 0.84, z);
          const [mx, mz] = P(-hw + 0.9 + i * 1.6, -hd + 0.02);
          lbox('glass', { ...it, x: mx, z: mz }, -0.45, 0.45, 1.15, 2.0, 0, 0.01);
        }
        break;
      }
      case 'desk': {
        const y = it.yaw || 0;
        put('wood', new THREE.BoxGeometry(1.6, 0.04, 0.8), it.x, 0.74, it.z, y);
        put('steel', new THREE.BoxGeometry(0.04, 0.72, 0.76).translate(-0.76, 0, 0), it.x, 0.36, it.z, y);
        put('steel', new THREE.BoxGeometry(0.4, 0.72, 0.76).translate(0.58, 0, 0), it.x, 0.36, it.z, y);
        put('plastic', new THREE.BoxGeometry(0.42, 0.36, 0.4).translate(-0.3, 0.2, -0.1), it.x, 0.76, it.z, y);
        put('black', new THREE.BoxGeometry(0.36, 0.28, 0.01).translate(-0.3, 0.2, 0.105), it.x, 0.76, it.z, y);
        put('black', new THREE.CylinderGeometry(0.24, 0.24, 0.06, 12).translate(0, 0, 0.75), it.x, 0.46, it.z, y);
        put('black', new THREE.BoxGeometry(0.44, 0.5, 0.06).translate(0, 0.25, 0.98), it.x, 0.5, it.z, y);
        break;
      }
      case 'pallet':
        lbox('wood', it, -hw, hw, 0, 0.14, -hd, hd);
        for (let k = 0; k < (it.stack || 1); k++) lbox('carton', it, -hw + 0.1, hw - 0.1, 0.14 + k * 0.5, 0.62 + k * 0.5, -hd + 0.1, hd - 0.1, '-y');
        break;
      case 'crate':
        for (let k = 0; k < Math.min(2, it.stack || 1); k++) lbox('wood', it, -hw + k * 0.05, hw - k * 0.05, k * 1.0, k * 1.0 + 0.98, -hd + k * 0.05, hd - k * 0.05);
        break;
      case 'machine':
        lbox('steel', it, -hw, hw, 0, 2.2, -hd, hd);
        lbox('paintGrey', it, -hw + 0.3, -hw + 1.0, 0.8, 1.7, hd, hd + 0.02, '-y');
        for (let k = 0; k < 3; k++) G.beam('black', [it.x - hw + 0.4 + k * 1.2, 2.2, it.z], [it.x - hw + 0.4 + k * 1.2, (hAt(Math.floor(it.x / C), Math.floor(it.z / C)) || 3) - 0.05, it.z], 0.18, 0.18);
        break;
      default:
        break;
    }
  }

  // les enseignes : sur la face avant du bandeau de chaque boutique
  if (signs)
    for (const sh of map.shops) {
      const xa = sh.x0 * C;
      const xb = (sh.x1 + 1) * C;
      const r = rooms[sh.room];
      const y = r.ceilH - 0.31;
      const z = sh.frontZ + sh.dir * 0.146;
      panel('signs', signs.uv(si++), (xa + xb) / 2, y, z, Math.min(xb - xa - 0.6, 6.5), 0.44, 0, sh.dir);
    }

  // les salles de projection : l'écran (une toile grise entre des caches noirs) contre le mur est
  for (const r of rooms) {
    if (r.kind !== 'screen') continue;
    const X1 = (r.x1 + 1) * C;
    const Z0 = r.z0 * C;
    const Z1 = (r.z1 + 1) * C;
    G.box('screenWhite', X1 - 0.08, X1 - 0.02, 1.4, r.ceilH - 1.2, Z0 + 1.6, Z1 - 1.6, '+x');
    G.box('black', X1 - 0.1, X1 - 0.02, 1.2, r.ceilH - 1.0, Z0 + 1.2, Z0 + 1.6, '+x');
    G.box('black', X1 - 0.1, X1 - 0.02, 1.2, r.ceilH - 1.0, Z1 - 1.6, Z1 - 1.2, '+x');
    G.box('red', X1 - 1.2, X1 - 0.1, 0, 1.2, Z0 + 0.5, Z1 - 0.5, '-y');
  }

  // le cinéma : des affiches dans des caissons lumineux le long des murs du hall et du couloir des salles
  let pi = 0;
  for (const r of rooms) {
    if (r.kind !== 'cine' && r.kind !== 'cineHall') continue;
    const X0 = r.x0 * C;
    const X1 = (r.x1 + 1) * C;
    const Z0 = r.z0 * C;
    const Z1 = (r.z1 + 1) * C;
    const wallsAt = r.kind === 'cine' ? [[X0, 'x', 1]] : [[X0, 'x', 1], [X1, 'x', -1]];
    for (const [w, , s] of wallsAt) {
      for (let z = Z0 + 3; z < Z1 - 2; z += 4.5) {
        const gx = Math.floor((w + s * 0.5) / C) - s;
        const gz = Math.floor(z / C);
        if (map.grid[gz * map.W + gx] !== 2) continue; // (un mur derrière, pas une porte)
        if (furn.some((o) => Math.abs(o.x - w) < 2 && Math.abs(o.z - z) < 1.6)) continue; // (ni derrière une borne)
        const x = w + s * 0.06;
        G.box('black', Math.min(w, w + s * 0.08), Math.max(w, w + s * 0.08), 0.9, 2.65, z - 0.62, z + 0.62);
        panel(pi % 4 === 3 ? 'postersOff' : 'posters', posters.uv(pi), x + s * 0.025, 1.78, z, 1.1, 1.65, s, 0);
        pi++;
      }
    }
  }

  // en haut des escalators croisés : des poteaux et une chaîne en travers, « OUT OF ORDER »
  if (fi === 0) {
    const [c, g] = atlas(1, 1, 256, 96);
    g.fillStyle = '#e9e1cf';
    g.fillRect(0, 0, 256, 96);
    g.fillStyle = '#b3241b';
    g.fillRect(6, 6, 244, 84);
    g.fillStyle = '#f4ecdc';
    g.font = 'bold 34px "Arial Narrow", Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('OUT OF ORDER', 128, 60);
    MATS.ooo = { m: baked(lam({ map: toTex(c) })), S: 1 };
    for (const e of map.allEscalators || []) {
      if (e.fi !== 1) continue;
      const x = e.top + e.dir * 0.35;
      for (const s of [-1, 1]) {
        put('steel', new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8), x, 0.5, e.z + s * (e.w / 2 + 0.15));
        put('steel', new THREE.CylinderGeometry(0.17, 0.19, 0.04, 14), x, 0.02, e.z + s * (e.w / 2 + 0.15));
      }
      G.beam('red', [x, 0.9, e.z - e.w / 2 - 0.15], [x, 0.78, e.z], 0.03, 0.03);
      G.beam('red', [x, 0.78, e.z], [x, 0.9, e.z + e.w / 2 + 0.15], 0.03, 0.03);
      panel('ooo', [0, 0, 1, 1], x - e.dir * 0.02, 0.62, e.z, 0.7, 0.26, -e.dir, 0);
      panel('ooo', [0, 0, 1, 1], x + e.dir * 0.02, 0.62, e.z, 0.7, 0.26, e.dir, 0);
    }
  }

  return { lights };
}
