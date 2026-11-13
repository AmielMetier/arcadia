// The Backrooms (Level 17, le Mall) - Le mobilier et les enseignes, dessinés d'après la carte (engine/mall.js, furn) :
// bancs, poubelles, jardinières aux palmiers morts, kiosques fermés, plans du centre éclairés, fontaines à sec, une
// chaise seule ; dans les boutiques, rayonnages, comptoirs, portants, tables de présentation, gravats et échelles ; le
// food court (comptoirs et leurs menus lumineux, tables rondes, chaises renversées) ; le grand magasin (gondoles,
// portants, mannequins) ; le cinéma (confiserie, bornes d'arcade, cordons, fauteuils rouges, écrans) ; toilettes,
// bureaux, quais, locaux techniques. Tout passe par le constructeur de mall.js (G) : une géométrie par matière.
// Les noms (boutiques, stands, films) sont inventés. Les objets réels (bancs, poubelles, chaises, caisses, plantes,
// téléviseurs, cabines téléphoniques, climatiseurs…) sont des modèles Poly Haven (CC0, backrooms/models), posés par
// model() (view/kit.js : les exemplaires proches seulement).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL_SIZE as C } from '../engine/map.js';
import { createArcade } from './mallArcade.js';
import { createGoods } from './mallGoods.js';
import { createDept } from './mallDept.js';
import { createFixtures } from './mallFixtures.js';

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
// la facture de l'enseigne d'une boutique : 0 des lettres découpées posées sur le bandeau (laiton, crème ou bronze
// selon le bandeau), 1 un caisson lumineux éteint (un plexi ivoire, des lettres de couleur), 2 un panneau peint
export const signStyle = (sh) => (sh.id * 7 + sh.sign * 3) % 3;
const SIGN_BOX = ['#b3241b', '#1d4f91', '#1c6b45', '#6a2a7a', '#b8560f', '#23211e'];
const SIGN_BOARD = ['#1f3d2c', '#5a1f24', '#1d2f55', '#3a2a1a', '#0f4a4a', '#2b2b2f'];
function signAtlas(shops) {
  const cols = 2;
  const rows = Math.max(1, Math.ceil(shops.length / cols));
  const [c, g] = atlas(cols, rows, 512, 64);
  shops.forEach((sh, i) => {
    const x = (i % cols) * 512;
    const y = Math.floor(i / cols) * 64;
    const st = signStyle(sh);
    g.save();
    g.beginPath();
    g.rect(x, y, 512, 64);
    g.clip();
    let ink;
    if (st === 1) {
      // le caisson : un plexi ivoire dans un cadre d'aluminium
      g.fillStyle = '#8d8b85';
      g.fillRect(x, y, 512, 64);
      g.fillStyle = '#e4dfd0';
      g.fillRect(x + 4, y + 4, 504, 56);
      ink = SIGN_BOX[(sh.sign + i) % SIGN_BOX.length];
    } else if (st === 2) {
      // le panneau peint : un fond sombre, un filet doré
      g.fillStyle = SIGN_BOARD[(sh.sign + i) % SIGN_BOARD.length];
      g.fillRect(x, y, 512, 64);
      g.strokeStyle = '#c9a85a';
      g.lineWidth = 2;
      g.strokeRect(x + 5, y + 5, 502, 54);
      ink = '#efe6cc';
    } else {
      // des lettres découpées : rien derrière elles (la matière est ajourée), une ombre portée sur le bandeau
      const band = sh.id % 4;
      ink = band === 2 ? '#3a2a1a' : band === 1 ? '#ece4cf' : '#d6b566';
    }
    g.font = SIGN_FONTS[sh.sign % SIGN_FONTS.length].replace(/(\d+)px/, (m, n) => `${Math.round(n * (st ? 0.72 : 0.86))}px`);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const name = sh.sign % 4 === 3 ? sh.name : sh.name.toUpperCase();
    // la largeur : on serre si le nom est long
    const k = Math.min(1, 460 / g.measureText(name).width);
    g.translate(x + 256, y + 34);
    g.scale(k, 1);
    if (!st) {
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillText(name, 2.5 / k, 3);
    }
    g.fillStyle = ink;
    g.fillText(name, 0, 0);
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
// le plan du centre : le vrai plan de l'étage (les lieux ouverts au public ; les coulisses n'y figurent pas), le nord
// en haut. DIR : la place du plan dans l'image, pour y poser le « vous êtes ici » de chaque borne
const DIR = { W: 512, H: 672, x0: 16, y0: 86, w: 480 };
function directoryTex(name, map) {
  const [c, g] = atlas(1, 1, DIR.W, DIR.H);
  g.fillStyle = '#1b2a33';
  g.fillRect(0, 0, DIR.W, DIR.H);
  g.fillStyle = '#e9dcc0';
  g.textAlign = 'center';
  g.font = 'bold 34px "Futura", "Century Gothic", Arial, sans-serif';
  g.fillText(name, DIR.W / 2, 44);
  g.font = 'bold 15px Arial, sans-serif';
  g.fillText(`D I R E C T O R Y   ·   ${map.floor ? 'L O W E R' : 'U P P E R'}   L E V E L`, DIR.W / 2, 70);
  const k = DIR.w / map.W;
  const hh = map.H * k;
  g.fillStyle = '#23353f';
  g.fillRect(DIR.x0, DIR.y0, DIR.w, hh);
  const COL = { mail: '#e9e2cf', court: '#e9e2cf', plaza: '#e9e2cf', portal: '#e9e2cf', annex: '#e2d8be', food: '#d98a4a', cine: '#8a6ab0', cineHall: '#8a6ab0', screen: '#6f558f', store: '#c9a45a', closed: '#7a7468', market: '#8fae7a', flea: '#b89a6a', garden: '#6f9a62', fun: '#c95a6a', lobby: '#d6cfbc', parking: '#9aa3a8', wc: '#6a9ac0' };
  const TRADE = ['#7da6b8', '#b86e5a', '#8fae7a', '#a58ac0', '#c9a45a', '#6fa69a'];
  const big = [];
  for (const r of map.rooms || []) {
    const sh = r.shop !== undefined ? map.shops[r.shop] : null;
    const col = sh ? (sh.state === 'shut' || sh.state === 'grille' || sh.state === 'glass' ? TRADE[sh.id % TRADE.length] : '#f0c85a') : COL[r.kind];
    if (!col) continue;
    const x = DIR.x0 + r.x0 * k;
    const y = DIR.y0 + r.z0 * k;
    const w = (r.x1 - r.x0 + 1) * k;
    const h = (r.z1 - r.z0 + 1) * k;
    g.fillStyle = col;
    g.fillRect(x + (sh ? 0.6 : 0), y + (sh ? 0.6 : 0), w - (sh ? 1.2 : 0), h - (sh ? 1.2 : 0));
    if (!sh && r.name && w * h > 900 && !['mail', 'court', 'portal', 'plaza', 'screen', 'cineHall'].includes(r.kind)) big.push([r.name, x + w / 2, y + h / 2, w]);
  }
  // (en haut : les vides des cours, d'où l'on voit l'étage du bas)
  g.fillStyle = '#23353f';
  for (const v of map.floor ? [] : map.voids || []) {
    g.beginPath();
    v.pts.forEach(([px, pz], i) => (i ? g.lineTo(DIR.x0 + (px / 2.5) * k, DIR.y0 + (pz / 2.5) * k) : g.moveTo(DIR.x0 + (px / 2.5) * k, DIR.y0 + (pz / 2.5) * k)));
    g.fill();
  }
  g.fillStyle = '#1b2a33';
  g.textBaseline = 'middle';
  for (const [nm, x, y, w] of big) {
    g.font = `bold ${w > 70 ? 13 : 10}px "Arial Narrow", Arial, sans-serif`;
    const words = nm.toUpperCase().split(' ');
    const lines = words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : words.length === 2 && w < 80 ? words : [words.join(' ')];
    lines.forEach((t, i) => g.fillText(t, x, y + (i - (lines.length - 1) / 2) * 13));
  }
  g.textBaseline = 'alphabetic';
  // la légende
  const ly = DIR.y0 + hh + 26;
  g.textAlign = 'left';
  g.font = 'bold 14px Arial, sans-serif';
  [['#f0c85a', 'OPEN LATE'], ['#7da6b8', 'SHOPS'], ['#6a9ac0', 'RESTROOMS'], ['#d98a4a', 'FOOD'], ['#8a6ab0', 'CINEMA']].forEach(([col, t], i) => {
    const x = 20 + (i % 3) * 165;
    const y = ly + Math.floor(i / 3) * 26;
    g.fillStyle = col;
    g.fillRect(x, y - 12, 16, 14);
    g.fillStyle = '#e9dcc0';
    g.fillText(t, x + 24, y);
  });
  g.fillStyle = '#e8402e';
  g.beginPath();
  g.arc(20 + 2 * 165 + 8, ly + 26 - 5, 7, 0, 7);
  g.fill();
  g.fillStyle = '#e9dcc0';
  g.fillText('YOU ARE HERE', 20 + 2 * 165 + 24, ly + 26);
  return toTex(c);
}

// --- Le mobilier ---
export function drawMallProps({ map, fi, G, MATS, hAt, baked, rooms, model, placed = [] }) {
  const furn = map.furn || [];
  // les matières propres au mobilier
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  const phong = (o) => new THREE.MeshPhongMaterial(o);
  MATS.red = MATS.red || { m: baked(lam({ color: '#6e1418' })), S: 1 };
  MATS.plastic = MATS.plastic || { m: baked(phong({ color: '#d9d3c4', specular: '#333', shininess: 40 })), S: 1 };
  MATS.soil = MATS.soil || { m: baked(lam({ color: '#2a2018' })), S: 1 };
  // une valise seule (le modèle en range deux côte à côte)
  const SUITCASE = ['01', '02'].map((k) => ['bottom', 'clasp', 'handle', 'top'].map((p) => `vintage_suitcase_${k}_${p}`).join('+'));
  MATS.mirror = MATS.mirror || { m: baked(phong({ color: '#1e272b', specular: '#b4c4cc', shininess: 150 }), { spec: 0.9, gloss: 160, mask: 0 }), S: 1 };
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
  let si = 0;
  const signs = map.shops && map.shops.length ? signAtlas(map.shops) : null;
  const menus = menuAtlas();
  const posters = posterAtlas();
  if (signs) MATS.signs = { m: baked(lam({ map: signs.tex, alphaTest: 0.4 })), S: 1 };
  MATS.menus = { m: lit(menus.tex, 1.1), S: 1 };
  MATS.menusOff = { m: baked(lam({ map: menus.tex, color: '#6a6a6a' })), S: 1 };
  MATS.posters = { m: lit(posters.tex, 1.15), S: 1 };
  MATS.postersOff = { m: baked(lam({ map: posters.tex, color: '#777' })), S: 1 };
  MATS.directory = { m: lit(directoryTex('HALCYON PARK MALL', map), 1.1), S: 1 };
  MATS.hereDot = MATS.hereDot || { m: new THREE.MeshBasicMaterial({ color: '#e8402e' }), S: 1 };
  // un panneau texturé (une case d'atlas) : une face de w × h, centrée en (x, y, z), tournée vers (nx, nz)
  const panel = (k, uv, x, y, z, w, h, nx, nz) => {
    placed.push([x, z, w / 2 + 0.2]); // (les murs habillés, view/mallWalls.js, laissent la place)
    const g = new THREE.PlaneGeometry(w, h);
    const a = g.attributes.uv;
    for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) ? uv[2] : uv[0], a.getY(i) ? uv[3] : uv[1]);
    g.rotateY(Math.atan2(nx, nz));
    G.add(k, g.translate(x, y, z));
  };
  const lights = []; // les feux de couleur du mobilier (les caissons d'affiches allumés, les écrans)
  const arcade = createArcade({ MATS, baked });

  // --- les modèles (Poly Haven, CC0) : leur avant est +z, sauf mention ---
  const PI = Math.PI;
  const front = (it) => {
    const f = it.face || 1;
    return it.rot ? [f, 0] : [0, f];
  };
  const yawZ = (F) => Math.atan2(F[0], F[1]); // un modèle dont l'avant est +z, tourné vers F
  // pose un modèle dont le centre de l'emprise est (ox, oz) dans son propre repère, centré en (cx, cz)
  const placeAt = (name, cx, y, cz, yaw, ox = 0, oz = 0, s = 1, rx = 0, rz = 0, piece = '*') => {
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    const k = Array.isArray(s) ? s : [s, s, s];
    model(name, cx - (ox * k[0] * c + oz * k[2] * sn), y, cz - (-ox * k[0] * sn + oz * k[2] * c), yaw, s, rx, rz, piece);
  };
  const rand = (i, k = 0) => {
    const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  // ce qu'on pose sur une table de présentation, selon le commerce
  // ce qu'on pose sur une table de présentation, selon le commerce : [modèle, échelle, morceaux, roulis x, hauteur]
  const SHOW = {
    toys: [['rubber_duck_toy', 1.6], ['baseball_01', 1.4], ['football', 1, 'football_inflated'], ['rubber_duck_toy', 1.6], ['concrete_cat_statue', 1]],
    kids: [['rubber_duck_toy', 1.6], ['football', 1, 'football_inflated'], ['american_football', 1]],
    music: [['boombox', 0.9], ['Ukulele_01', 1, '*', -PI / 2, 0.03], ['cassette_player', 1.4], ['portable_cassette_player', 1.3]],
    electronics: [['television_02', 1], ['boombox', 0.9], ['Television_01', 0.85], ['vintage_video_camera', 1.5], ['portable_cassette_player', 1.3]],
    video: [['Television_01', 0.85], ['television_02', 1], ['boombox', 1], ['vintage_video_camera', 1.5]],
    gifts: [['ceramic_vase_01', 1], ['antique_ceramic_vase_01', 1], ['marble_bust_01', 0.8], ['garden_gnome', 0.8], ['concrete_cat_statue', 1], ['ceramic_vase_02', 1]],
    jewelry: [['ceramic_vase_03', 0.8], ['vintage_pocket_watch', 2], ['brass_vase_03', 1]],
    watches: [['alarm_clock_01', 1], ['vintage_pocket_watch', 2], ['digital_wrist_watch', 1.5, '*', -PI / 2, 0.02]],
    optician: [['round_spectacles', 1.3], ['office_notepads', 1, 'office_notepads_note_stack'], ['brass_vase_03', 0.8], ['medical_box', 0.8]],
    florist: [['potted_plant_04', 2.2], ['ceramic_vase_02', 1], ['potted_plant_04', 2.2], ['ceramic_vase_04', 1]],
    kitchen: [['jug_01', 1], ['pot_enamel_01', 1], ['brass_pan_01', 1], ['wooden_cutting_board', 1], ['ceramic_vase_04', 1]],
    luggage: [['vintage_suitcase', 0.55, SUITCASE[0]], ['vintage_suitcase', 0.55, SUITCASE[1]]],
    perfume: [['ceramic_vase_03', 0.6], ['brass_vase_03', 1], ['ceramic_vase_04', 0.6]],
    pharmacy: [['medical_box', 1], ['all_purpose_cleaner', 1], ['bleach_bottle', 1], ['multi_cleaner_bottle', 1], ['plastic_bottle_gallon', 1]],
    sports: [['football', 1, 'football_inflated'], ['american_football', 1], ['baseball_bat', 1, '*', 0, 0, PI / 2], ['baseball_01', 1.5]],
    outdoor: [['fishermans_hat', 1], ['binoculars', 1], ['old_gas_mask', 0.9, '*', 0, 0, PI / 2], ['metal_jerrycan', 0.7]],
    cards: [['postcard_set_01', 1, '*', -PI / 2, -0.215], ['office_notepads', 1, 'office_notepads_note_stack']],
    books: [['book_encyclopedia_set_01', 1, 'book_encyclopedia_set_01_book01+book_encyclopedia_set_01_book02+book_encyclopedia_set_01_book03'], ['office_notepads', 1, 'office_notepads_note_stack'], ['binder_notebook', 1, 'binder_notebook_closed']],
    candy: [['carrot_cake', 1], ['croissant', 1.2], ['food_apple_01', 1.4], ['jug_01', 1]],
  };
  const shopOf = (it) => (it.shop !== undefined && map.shops ? map.shops.find((s) => s.id === it.shop) : null);
  // les panneaux imprimés (enseignes, plaques), ce qui reste des grandes surfaces et des locaux techniques
  const goods = createGoods({ G, MATS, baked });
  const dept = createDept({ G, model, lbox, frame, front, yawZ, rand, goods, rooms, C, hAt });

  // le gros mobilier fixe (jardinières, pots, tables du food court, stands fermés)
  const fixtures = createFixtures({ G, MATS, model, lbox, frame, front, rand, panel, menus });
  for (const it of furn) {
    const hw = it.w / 2;
    const hd = it.d / 2;
    const F = front(it);
    const P = frame(it);
    switch (it.kind) {
      case 'bench': {
        // un banc à lattes de bois sur pieds de fonte (le banc à dossier de « modular_street_seating »)
        // (jamais tout à fait d'équerre : quelques degrés, quelques centimètres)
        placeAt('modular_street_seating', it.x + (rand(it.id, 7) - 0.5) * 0.1, 0, it.z + (rand(it.id, 8) - 0.5) * 0.08, yawZ(F) + (rand(it.id, 9) - 0.5) * 0.14, -1.135, 0.03, 1, 0, 0, 'legs_single+seat+seat_back+back_support_r+back_support_l+crossbar+legs_double');
        if (it.id % 13 === 4) model('old_gas_mask', it.x + 0.4, 0.46, it.z + F[1] * 0.05, rand(it.id) * 6, 1, 0, PI / 2);
        else if (it.id % 11 === 6) model('vintage_suitcase', it.x - 0.5, 0.45, it.z, yawZ(F), 0.5, 0, 0, SUITCASE[it.id % 2]);
        break;
      }
      case 'bin':
        model('metal_trash_can', it.x + (rand(it.id, 7) - 0.5) * 0.12, 0, it.z + (rand(it.id, 8) - 0.5) * 0.12, rand(it.id) * 6.28, 1, 0, 0, it.rust ? 'metal_trash_can_rust' : 'metal_trash_can');
        break;
      case 'planter': {
        lbox('marbleDark', it, -hw, hw, 0, 0.62, -hd, hd, '-y+y');
        // la margelle : un cadre de pierre ; au milieu, la terre
        const cw = 0.17;
        lbox('trim', it, -hw - 0.04, hw + 0.04, 0.62, 0.68, -hd - 0.04, -hd + cw, '-y');
        lbox('trim', it, -hw - 0.04, hw + 0.04, 0.62, 0.68, hd - cw, hd + 0.04, '-y');
        lbox('trim', it, -hw - 0.04, -hw + cw, 0.62, 0.68, -hd + cw, hd - cw, '-y');
        lbox('trim', it, hw - cw, hw + 0.04, 0.62, 0.68, -hd + cw, hd - cw, '-y');
        lbox('soil', it, -hw + cw, hw - cw, 0.5, 0.635, -hd + cw, hd - cw, '-y');
        const a = rand(it.id) * 6.28;
        if (it.plant === 0) {
          // un arbre mort, debout, et un autre plus petit
          model('dead_quiver_trunk', it.x + 0.2, 0.5, it.z - 0.1, a, 1.55);
          model('dead_quiver_trunk', it.x - 0.45, 0.5, it.z + 0.35, a + 2, 0.8, 0.12, 0.08);
        } else if (it.plant === 1) {
          // des plantes en plastique, toujours vertes (le pot est caché dans la jardinière)
          if (it.id % 3 === 0) model('potted_plant_02', it.x, 0.6 - 0.34 * 2.3, it.z, a, 2.3);
          else if (it.id % 3 === 1) {
            model('fern_02', it.x - 0.2, 0.58, it.z, a, 2.3, 0, 0, 'fern_02_b');
            model('fern_02', it.x + 0.45, 0.58, it.z + 0.4, a + 1, 1.8, 0, 0, 'fern_02_c');
          } else {
            model('anthurium_botany_01', it.x, 0.58, it.z - 0.15, a, 1.9, 0, 0, 'anthurium_botany_01_b');
            model('calathea_orbifolia_01', it.x + 0.2, 0.58, it.z + 0.5, a + 2, 1.1, 0, 0, 'calathea_orbifolia_01_a');
          }
        } else {
          // un tronc mort, couché dans la terre, quelques plantes grasses
          model('dead_quiver_trunk', it.x - 0.15, 0.66, it.z + 0.85, a, 0.85, 0, 1.45);
          for (let i = 0; i < 3; i++) model('potted_plant_04', it.x + 0.5 - i * 0.45, 0.6 - 0.15 * 2.4, it.z - 0.4 + (i % 2) * 0.5, a + i, 2.4, 0, 0, 'potted_plant_04_plant+potted_plant_04_dirt');
        }
        break;
      }
      case 'cart':
        // un chariot à café, ses machines encore dessus
        model('CoffeeCart_01', it.x + 0.3, 0, it.z, (it.yaw || 0) + PI / 2, 1.05);
        break;
      case 'terrace':
      case 'claypot':
      case 'diner':
        fixtures[it.kind](it);
        break;
      case 'directory': {
        for (const lx of [-hw + 0.08, hw - 0.08]) lbox('black', it, lx - 0.04, lx + 0.04, 0, 2.15, -0.04, 0.04, '-y');
        lbox('black', it, -hw, hw, 0.45, 2.1, -hd, hd);
        for (const s of [-1, 1]) {
          const [x, z] = P(0, s * (hd + 0.004));
          const n = P(0, s);
          const pw = it.w - 0.14;
          const ph = pw * (DIR.H / DIR.W);
          panel('directory', [0, 0, 1, 1], x, 1.28, z, pw, ph, n[0] - it.x, n[1] - it.z);
          // « vous êtes ici » : une pastille rouge, là où est la borne sur le plan
          const u = (DIR.x0 + (it.x / C) * (DIR.w / map.W)) / DIR.W - 0.5;
          const v = 0.5 - (DIR.y0 + (it.z / C) * (DIR.w / map.W)) / DIR.H;
          const [dx2, dz2] = P(s * u * pw, s * (hd + 0.006));
          put('hereDot', new THREE.CircleGeometry(0.016, 12).rotateY(Math.atan2(n[0] - it.x, n[1] - it.z)), dx2, 1.28 + v * ph, dz2);
        }
        break;
      }
      case 'chair':
        model('plastic_monobloc_chair_01', it.x, 0, it.z, it.yaw || 0);
        break;
      case 'wheelchair':
        model('wheelchair_01', it.x, 0, it.z, it.yaw || 0);
        break;
      case 'sofa':
        placeAt('sofa_02', it.x, 0, it.z, yawZ(F) + (rand(it.id, 9) - 0.5) * 0.1, 0, -0.07, 1.02);
        break;
      case 'lounge':
        model('mid_century_lounge_chair', it.x, 0, it.z, it.yaw || 0);
        model('side_table_01', it.x, 0, it.z + 1.0, it.yaw || 0);
        break;
      case 'ctable':
        model('modern_coffee_table_01', it.x, 0, it.z, PI / 2);
        if (!it.bare) model('television_02', it.x + 0.1, 0.39, it.z, PI * 0.8, 0.7);
        break;
      case 'shelf': {
        // des étagères contre les murs : trois éléments côte à côte
        const yaw = yawZ(F);
        const sh = shopOf(it);
        const wood = sh && ['books', 'gifts', 'florist', 'kitchen', 'candy', 'cards', 'toys', 'kids'].includes(sh.trade);
        if ((sh && sh.trade === 'books') || it.trade === 'books') {
          for (const lx of [-0.95, 0.95]) {
            const [x, z] = P(lx, -hd + 0.29);
            placeAt('wooden_bookshelf_worn', x, 0, z, yaw);
          }
          break;
        }
        if (sh && ['pharmacy', 'sports', 'outdoor', 'electronics', 'video'].includes(sh.trade)) {
          for (let i = 0; i < 5; i++) {
            const [x, z] = P(-1.2 + i * 0.6, 0);
            model('steel_frame_shelves_02', x, 0, z, yaw);
          }
          if (sh.trade === 'pharmacy') {
            const [x, z] = P(1.75, 0.15);
            model('vintage_crutches_01', x, 0, z, yaw + 0.3, 1, 0, -0.18);
          }
          break;
        }
        if (sh && sh.trade === 'cards') {
          // des présentoirs peints, comme chez un papetier
          for (let i = 0; i < 4; i++) {
            const [x, z] = P(-0.9 + i * 0.6, -hd + 0.02);
            model('painted_wooden_shelves', x, 0, z, yaw);
          }
          break;
        }
        for (const lx of [-1.15, 0, 1.15]) {
          const [x, z] = P(lx, -hd + 0.13);
          if (wood) placeAt('wooden_display_shelves_01', x, 0, z, yaw - PI / 2, 0, 0, [1, 1.15, 1.04]);
          else placeAt('Shelf_01', x, 0, z, yaw, 0, 0.13, [1.1, 1, 1]);
        }
        break;
      }
      case 'table': {
        // une vraie table (trois modèles, mis aux dimensions de l'emprise : le plateau à 84 cm) : une table de bois
        // brut, une table peinte, une table nappée
        const sh = shopOf(it);
        const trade = it.trade || (sh && sh.trade);
        if (trade !== 'salon') {
          const TABLES = [['WoodenTable_01', 1.8, 0.66, 0.55], ['painted_wooden_table', 2.4, 1.14, 0.96], ['dining_table', 2.25, 1.39, 0.87]];
          const [tn, tw, td, th] = TABLES[['candy', 'florist', 'gifts', 'fold'].includes(trade) ? 2 : it.id % 2];
          model(tn, it.x, 0, it.z, it.rot ? PI / 2 : 0, [it.w / tw, 0.84 / th, it.d / td]);
        }
        if (trade === 'fold') break; // (une table restée vide)
        if (sh && sh.trade === 'salon') {
          // le salon de coiffure : des fauteuils de barbier à la place des tables
          model('BarberShopChair_01', it.x, 0, it.z, yawZ([0, -sh.dir]) + (rand(it.id) - 0.5) * 0.6);
          break;
        }
        const list = SHOW[trade] || [['cardboard_box_01', 0.6]];
        // 2 rangées de 2 ou 3 objets, un peu de travers ; une case vide de temps en temps (on s'est servi)
        const cols = it.w > 1.4 ? 3 : 2;
        const P2 = frame(it);
        for (let j = 0; j < 2; j++)
          for (let i = 0; i < cols; i++) {
            const q = it.id * 7 + j * 3 + i;
            if (rand(q) < 0.22) continue;
            const [name, sc, piece = '*', rx = 0, dy = 0, rz = 0] = list[q % list.length];
            const [x, z] = P2(-hw + (it.w * (i + 0.5)) / cols + (rand(q, 1) - 0.5) * 0.12, (j - 0.5) * it.d * 0.45);
            model(name, x, 0.84 + dy, z, rand(q, 2) * 6.28, sc, rx, rz, piece);
          }
        break;
      }
      case 'debris':
        for (let i = 0; i < 6; i++) {
          const a = it.id * 3 + i;
          put(i % 3 === 0 ? 'ceilTiles' : i % 3 === 1 ? 'block' : 'plaster', new THREE.BoxGeometry(0.3 + (a % 4) * 0.12, 0.04 + (a % 3) * 0.05, 0.3 + (a % 5) * 0.1), it.x + ((a * 37) % 100) / 100 - 0.5, 0.04, it.z + ((a * 61) % 100) / 100 - 0.5, a, (a % 3) * 0.1);
        }
        model('cardboard_box_01', it.x + 0.6, 0, it.z - 0.3, rand(it.id) * 6, 1.1, 0, it.id % 2 ? 1.57 : 0);
        if (it.id % 2) model('trashbag', it.x - 0.5, 0, it.z + 0.4, rand(it.id, 1) * 6);
        for (let k = 0; k < 1 + (it.id % 3); k++) model('cement_bag', it.x - 0.2 + (k % 2) * 0.1, k * 0.17, it.z - 0.6, PI / 2 + rand(it.id, k + 4) * 0.4, 1);
        model('spray_paint_bottles_02', it.x + 0.2, 0, it.z + 0.6, rand(it.id, 5) * 6, 1, 0, 0, it.id % 2 ? 'spray_paint_bottles_02_dented' : 'spray_paint_bottles_02');
        if (it.id % 3 === 0) model('old_gas_mask', it.x - 0.9, 0, it.z - 0.1, rand(it.id, 6) * 6, 1, 0, PI / 2);
        break;
      case 'ladder':
        model('wooden_ladder', it.x, 0, it.z, rand(it.id) * 6.28, 1.4);
        model('metal_tool_chest', it.x + 1.2, 0, it.z + 0.3, rand(it.id, 1) * 6);
        model('mousetrap', it.x - 0.8, 0, it.z + 0.9, rand(it.id, 2) * 6, 1.4);
        break;
      case 'stall':
        if (it.toilet) {
          // une cabine : deux cloisons, sa façade, la porte tirée (on ne voit pas dedans)
          for (const lx of [-hw, hw - 0.03]) lbox('paintGrey', it, lx, lx + 0.03, 0.15, 2.0, -hd, hd);
          lbox('paintGrey', it, -hw, -hw + 0.5, 0.15, 2.0, -hd, -hd + 0.03);
          lbox('paintGrey', it, -hw + 0.5, -hw + 0.62, 0.15, 2.0, -hd, -hd + 0.03);
          lbox('paintGrey', it, hw - 0.14, hw, 0.15, 2.0, -hd, -hd + 0.03);
          lbox('paintGrey', it, -hw + 0.62, hw - 0.14, 0.17, 1.97, -hd + 0.002, -hd + 0.027);
          lbox('steel', it, hw - 0.24, hw - 0.2, 1.0, 1.1, -hd - 0.02, -hd + 0.002);
        } else if (it.shut) fixtures.stallShut(it);
        break;
      case 'gondola':
        dept.gondola(it);
        break;
      case 'wcwall':
        lbox('faience', it, -hw, hw, 0, 2.1, -hd, hd, '-y');
        lbox('steel', it, -hw - 0.01, hw + 0.01, 2.1, 2.13, -hd - 0.01, hd + 0.01);
        break;
      case 'pot':
      case 'tanks':
      case 'panelbox':
      case 'genset':
        dept[it.kind](it);
        break;
      case 'ottoman':
        model('Ottoman_01', it.x, 0, it.z, rand(it.id) * 6.28);
        break;
      // le parking : une voiture sous sa bâche, des blocs de béton, des pneus en tas
      case 'car':
        model('covered_car', it.x, 0, it.z, it.askew ? PI / 2 + 0.14 : (it.face || 1) > 0 ? 0 : PI);
        break;
      case 'barrier': {
        model('concrete_road_barrier_02', it.x, 0, it.z, it.yaw || 0);
        // derrière le premier bloc : la sortie des voitures, son rideau baissé (tagué)
        const r = rooms[it.room];
        if (!it.yaw && r) model('rollershutter_door', it.x + 1.2, 0, r.z0 * C, 0, [3.6, 1.15, 1], 0, 0, 'rollershutter_door_graffiti');
        break;
      }
      case 'tyres':
        for (let k = 0; k < (it.n || 3); k++) model('old_tyre', it.x + (rand(it.id, k) - 0.5) * 0.12, 0.08 + k * 0.155, it.z + (rand(it.id, k + 5) - 0.5) * 0.12, 0, 1, PI / 2);
        break;
      case 'sinks': {
        // un plan de pierre sombre, creusé d'une auge d'inox sur toute sa longueur ; les miroirs au mur
        lbox('marbleDark', it, -hw, hw, 0.8, 0.88, -hd, -hd + 0.1);
        lbox('marbleDark', it, -hw, hw, 0.8, 0.88, hd - 0.07, hd);
        for (const s of [-1, 1]) lbox('marbleDark', it, s > 0 ? hw - 0.12 : -hw, s > 0 ? hw : -hw + 0.12, 0.8, 0.88, -hd + 0.1, hd - 0.07);
        lbox('steel', it, -hw + 0.12, hw - 0.12, 0.7, 0.72, -hd + 0.1, hd - 0.07, '-y');
        lbox('steel', it, -hw + 0.12, hw - 0.12, 0.72, 0.87, -hd + 0.1, -hd + 0.11);
        lbox('steel', it, -hw + 0.12, hw - 0.12, 0.72, 0.87, hd - 0.08, hd - 0.07);
        lbox('paintGrey', it, -hw, hw, 0, 0.8, hd - 0.12, hd - 0.07);
        for (let i = 0; i < 3; i++) {
          const [mx, mz] = P(-hw + 0.9 + i * 1.6, -hd + 0.02);
          lbox('steel', { ...it, x: mx, z: mz }, -0.48, 0.48, 1.12, 2.03, 0, 0.008);
          lbox('mirror', { ...it, x: mx, z: mz }, -0.45, 0.45, 1.15, 2.0, 0.008, 0.016);
        }
        break;
      }
      case 'desk': {
        // un bureau métallique, sa chaise, un écran ; au poste de sécurité, des moniteurs empilés
        const y = it.yaw || 0;
        model('metal_office_desk', it.x, 0, it.z, y);
        const c = Math.cos(y);
        const s = Math.sin(y);
        const at = (lx, lz) => [it.x + lx * c + lz * s, it.z - lx * s + lz * c];
        const [chx, chz] = at(0.1, 0.8);
        if (it.id % 4 !== 1) model(it.id % 3 ? 'SchoolChair_01' : 'modern_arm_chair_01', chx, 0, chz, y + PI + (rand(it.id) - 0.5) * 0.8);
        const [tx, tz] = at(-0.35, -0.1);
        model('Television_01', tx, 0.79, tz, y, 0.75);
        if (it.security) {
          const [ux, uz] = at(0.35, -0.12);
          model('television_02', ux, 0.79, uz, y - 0.15);
          model('television_02', ux, 0.79 + 0.41, uz, y - 0.1);
        } else if (it.id % 5 === 0) model('cardboard_box_01', ...at(0.55, 0.05).flatMap((v, i) => (i ? [0.79, v] : [v])), y + 0.3, 0.8);
        const PAPER = [['office_notepads', 'office_notepads_a4_stack'], ['clipboard', '*'], ['office_notepads', 'office_notepads_yellow_pad+office_notepads_note_stack'], ['binder_notebook', 'binder_notebook_closed']];
        const [pn, pp] = PAPER[it.id % PAPER.length];
        const [px, pz] = at(0.3, 0.12);
        model(pn, px, 0.795, pz, y + (rand(it.id, 2) - 0.5) * 0.8, 1, pn === 'clipboard' ? -PI / 2 : 0, 0, pp);
        const [sx, sz] = at(0.05, -0.2);
        if (it.id % 2) model('vintage_stapler', sx, 0.79, sz, y + rand(it.id, 3) * 2, 1.2);
        else model('stationery_supplies', sx, 0.79, sz, y + rand(it.id, 3) * 2);
        if (it.id % 5 === 2) {
          const [lx, lz] = at(0.78, -0.3);
          model('desk_lamp_arm_01', lx, 0.88, lz, y + PI);
        }
        break;
      }
      case 'pallet':
        dept.pallet(it);
        break;
      case 'crate': {
        const st = Math.min(3, it.stack || 1);
        if (it.id % 5 === 0) model('industrial_storage_cart', it.x, 0, it.z, rand(it.id) * 0.4, 0.75);
        else if (it.id % 5 === 1) for (let k = 0; k < st; k++) model('plastic_crate_03', it.x, k * 0.27, it.z, rand(it.id, k) * 0.3, 1.8);
        else if (it.id % 5 === 2) model('hand_truck', it.x, 0, it.z, rand(it.id) * 6);
        else for (let k = 0; k < st; k++) model('wooden_crate_02', it.x, k * 0.45, it.z, PI / 2 + rand(it.id, k) * 0.2, 1);
        break;
      }
      case 'machine': {
        // des groupes de climatisation, une armoire électrique, des gaines jusqu'au plafond
        const yaw = it.z < (map.H * C) / 2 ? 0 : PI;
        for (const s of [-1, 1]) model('exterior_aircon_unit', it.x + s * 1.0, 0.64, it.z, yaw, 2.0, 0, 0, (it.id + s) % 3 ? 'exterior_aircon_unit_rusted' : 'exterior_aircon_unit');
        model('utility_box_01', it.x + 2.3, 0, it.z, yaw);
        for (let k = 0; k < 2; k++) G.beam('steel', [it.x - 1.0 + k * 2.0, 1.86, it.z], [it.x - 1.0 + k * 2.0, (hAt(Math.floor(it.x / C), Math.floor(it.z / C)) || 3) - 0.05, it.z], 0.42, 0.3);
        break;
      }
      default:
        break;
    }
  }

  dept.signs();

  // --- Les détails posés sur les murs et sous les plafonds (modèles) ---
  const cell = (gx, gz) => (gx < 0 || gz < 0 || gx >= map.W || gz >= map.H ? 2 : map.grid[gz * map.W + gx]);
  // les rideaux métalliques des boutiques fermées (une sur deux ; les autres gardent leur rideau à mailles)
  for (const sh of map.shops || []) {
    if (sh.state !== 'grille' || sh.id % 2 !== 1) continue;
    const xa = sh.x0 * C;
    const xb = (sh.x1 + 1) * C;
    const head = rooms[sh.room].ceilH - 0.62;
    const n = Math.max(1, Math.round((xb - xa) / 3));
    const w = (xb - xa - 0.08) / n;
    for (let i = 0; i < n; i++) model('rollershutter_window_01', xa + 0.04 + w * (i + 0.5), 0, sh.frontZ - sh.dir * 0.15, sh.dir > 0 ? 0 : PI, [w / 2.1, head / 1.85, 1], 0, 0, 'rollershutter_window_01');
  }
  // (plus de cabines téléphoniques : le seul téléphone public scanné disponible est coréen, un centre américain de
  // 1996 n'en a pas ; rien ne le remplace)
  // des caméras de surveillance sur un pilier sur quatre du mail et des cours, tournées vers les vitrines
  let ci = 0;
  for (const k in map.pillars) {
    const p = map.pillars[k];
    if (p.kind !== 'mail' && p.kind !== 'court') continue;
    if (ci++ % 4 !== 0) continue;
    const s = p.z < (map.mailZ || 0) ? -1 : 1;
    model('security_camera_02', p.x, fi === 0 ? 4.7 : 3.75, p.z + s * ((p.h || 0.45) + 0.01), s > 0 ? 0 : PI, 1.3, 0.25 * 0, 0);
  }
  // « sol glissant » : des panneaux oubliés près d'un banc sur cinq
  let bi = 0;
  for (const it of furn) if (it.kind === 'bench' && bi++ % 5 === 2) model('WetFloorSign_01', it.x + 1.7, 0, it.z + (it.face || 1) * 0.9, rand(it.id) * 6.28, 1.2);
  for (const r of rooms) {
    const X0 = r.x0 * C;
    const X1 = (r.x1 + 1) * C;
    const Z0 = r.z0 * C;
    const Z1 = (r.z1 + 1) * C;
    if (r.kind === 'service' && r.z0 === r.z1 && r.x1 - r.x0 > 6) {
      // les couloirs de service : une alarme tous les 14 m, des sacs, un balai, un bidon
      for (let x = X0 + 4; x < X1 - 2; x += 14) {
        const gx = Math.floor(x / C);
        if (cell(gx, r.z0 - 1) !== 2) continue;
        model('fire_alarm', x + 0.6, 1.45, Z0, 0);
      }
      for (let x = X0 + 9; x < X1 - 4; x += 23) {
        const gx = Math.floor(x / C);
        if (cell(gx, r.z0 + 1) !== 2) continue;
        model('trashbag', x, 0, Z1 - 0.35, rand(gx) * 6);
        model('trashbag', x + 0.55, 0, Z1 - 0.3, rand(gx, 1) * 6, 0.85);
        if (gx % 4 === 1) model('plastic_broom', x + 1.3, 0.03, Z1 - 0.12, PI, 1, -1.25);
        else model('multi_cleaner_5_litre', x + 1.2, 0, Z1 - 0.25, rand(gx, 2) * 6);
        model('dustpan', x - 0.7, 0, Z1 - 0.4, rand(gx, 3) * 6);
        if (gx % 3 === 0) model('wooden_broom', x + 1.9, 0.12, Z1 - 0.08, 0, 1, -1.3);
      }
      // une gaine de ventilation sous le plafond, le long du mur nord, tenue par des colliers, avec une grille tous les 9 m
      const hy = (hAt(r.x0 + 1, r.z0) || 3) - 0.24;
      for (let x = X0 + 0.3, n = 0; x + 3.6 < X1 - 0.3; x += 3.6, n++) {
        model('modular_airduct_rectangular_01', x, hy, Z0 + 0.42, PI / 2, [0.8, 0.7, 2], 0, 0, 'modular_airduct_rectangular_01_tripple_01');
        {
          // un collier : une barre sous la gaine, deux tiges jusqu'au plafond
          model('modular_airduct_rectangular_01', x + 0.9, hy - 0.2, Z0 + 0.42, PI / 2, [0.8, 1, 1], 0, 0, 'modular_airduct_rectangular_01_brace_01');
          model('modular_airduct_rectangular_01', x + 0.9, hy + 0.185, Z0 + 0.42, PI / 2, [0.8, 0.7, 1], 0, 0, 'modular_airduct_rectangular_01_brace_wire_01');
        }
        if (n % 3 === 1) model('modular_airduct_rectangular_01', x + 2.4, hy - 0.19, Z0 + 0.42, PI / 2, 0.8, -PI / 2, 0, 'modular_airduct_rectangular_01_vent_02');
      }
    } else if (r.kind === 'dock') {
      // les quais : des rideaux de quai sur le mur nord
      for (let x = X0 + 4; x < X1 - 3; x += 6.5) {
        if (cell(Math.floor(x / C), r.z0 - 1) !== 2) continue;
        model('rollershutter_door', x, 0, Z0, 0, [2.8, 1.45, 1], 0, 0, Math.floor(x) % 3 === 0 ? 'rollershutter_door_graffiti' : 'rollershutter_door');
        model('security_light', x, 3.55, Z0 + 0.03, 0, 1.2, 0.35);
        const k = Math.floor(x);
        if (k % 2) {
          model('Barrel_01', x + 2.0, 0, Z0 + 0.5, rand(k) * 6);
          model(k % 4 === 1 ? 'Barrel_02' : 'Barrel_01', x + 2.0, 0, Z0 + 1.15, rand(k, 1) * 6);
        } else {
          model('propane_tank', x - 2.1, 0, Z0 + 0.35, rand(k) * 6);
          model('small_lpg_tank', x - 1.7, 0, Z0 + 0.4, rand(k, 1) * 6);
          model('metal_jerrycan', x - 2.0, 0, Z0 + 0.85, rand(k, 2) * 6, 0.9);
        }
      }
      model('ladder_sectioned_01', X1 - 0.25, 0, Z0 + 2.5, -PI / 2 + 0.05, 1, 0, -0.32);
    } else if (r.kind === 'office') {
      // les bureaux : une armoire à tiroirs dans un coin, une horloge au mur
      if (cell(r.x0, r.z0 - 1) === 2) model('drawer_cabinet', X0 + 0.75, 0, Z0 + 0.27, 0);
      if (cell(Math.floor((X0 + X1) / 2 / C), r.z0 - 1) === 2) model('wall_clock', (X0 + X1) / 2, 2.15, Z0 + 0.005, 0);
      if (r.z1 > r.z0 && cell(r.x0 - 1, r.z0 + 1) === 2) model(r.id % 2 ? 'hanging_picture_frame_01' : 'hanging_picture_frame_02', X0 + 0.005, 1.65, Z0 + C * 1.5, PI / 2);
      if (r.name === 'Security') model('vintage_telephone_wall_clock', X1 - 0.005, 1.4, Z0 + 1.2, -PI / 2);
      else if (r.id % 3 === 1 && cell(r.x1 + 1, r.z0) === 2) model('dartboard', X1 - 0.005, 1.73, Z0 + 1.4, -PI / 2);
      if (r.name === 'Lost & found') for (let i = 0; i < 4; i++) model('vintage_suitcase', X1 - 1.2 - i * 0.5, 0, Z1 - 0.5, PI + (rand(i) - 0.5) * 0.4, 0.6, 0, 0, SUITCASE[i % 2]);
    } else if (r.kind === 'wc') {
      model('WetFloorSign_01', (X0 + X1) / 2, 0, (Z0 + Z1) / 2, rand(r.id) * 6.28, 1.2);
      model('plastic_broom', X1 - 0.3, 0.03, Z0 + 0.15, PI / 2, 1, -1.25);
      model('mousetrap', X0 + 0.25, 0, Z1 - 0.3, rand(r.id, 1) * 6, 1.4);
    } else if (r.kind === 'lobby') {
      for (const [x, z] of [[X0 + 0.6, Z0 + 0.6], [X1 - 0.6, Z0 + 0.6]]) model('potted_plant_02', x, 0, z, rand(x) * 6, 1.6);
      // un coin d'attente contre le mur est : un guéridon, deux fauteuils, un pouf
      const ex = X1 - 2.2;
      const ez = (Z0 + Z1) / 2;
      model('coffee_table_round_01', ex, 0, ez, 0, 0.8);
      model('GreenChair_01', ex + 0.1, 0, ez - 0.95, 0.2);
      model('GreenChair_01', ex - 0.1, 0, ez + 0.95, PI - 0.3);
      model('Ottoman_01', ex + 1.15, 0, ez + 0.2, PI / 2 + 0.15, 0.9);
    } else if (r.kind === 'food') {
      for (let x = X0 + 6; x < X1 - 4; x += 12) model('metal_trash_can', x, 0, Z1 - 0.5, rand(x) * 6, 1, 0, 0, 'metal_trash_can');
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
      // (à sa vraie proportion, 8:1 : des lettres découpées plus grandes qu'un caisson ou qu'un panneau peint)
      const sw = Math.min(xb - xa - 0.6, signStyle(sh) ? 3.3 : 4.2);
      panel('signs', signs.uv(si++), (xa + xb) / 2, y, z + (signStyle(sh) ? sh.dir * 0.03 : 0), sw, sw / 8, 0, sh.dir);
      if (signStyle(sh)) G.box(signStyle(sh) === 1 ? 'steel' : 'black', (xa + xb) / 2 - sw / 2, (xa + xb) / 2 + sw / 2, y - sw / 16, y + sw / 16, Math.min(z, z + sh.dir * 0.028), Math.max(z, z + sh.dir * 0.028));
    }

  // les salles de projection : contre le mur est, un écran large (2,39:1) dans son cache noir, entre deux tentures de
  // velours à plis (des lés de 12 cm, un sur deux en retrait), une frise au-dessus, une scène basse au pied
  for (const r of rooms) {
    if (r.kind !== 'screen') continue;
    const X1 = (r.x1 + 1) * C;
    const Z0 = r.z0 * C;
    const Z1 = (r.z1 + 1) * C;
    const zc = (Z0 + Z1) / 2;
    const sw = 9.6;
    const y0 = 1.45;
    const y1 = y0 + sw / 2.39;
    const top = r.ceilH - 0.25;
    G.box('screenWhite', X1 - 0.08, X1 - 0.02, y0, y1, zc - sw / 2, zc + sw / 2, '+x');
    // le cache : un cadre de feutre noir autour de la toile, jusqu'aux tentures et à la frise
    G.box('black', X1 - 0.1, X1 - 0.02, y0 - 0.5, y1 + 0.3, zc - sw / 2 - 0.3, zc - sw / 2, '+x');
    G.box('black', X1 - 0.1, X1 - 0.02, y0 - 0.5, y1 + 0.3, zc + sw / 2, zc + sw / 2 + 0.3, '+x');
    G.box('black', X1 - 0.1, X1 - 0.02, y0 - 0.5, y0, zc - sw / 2, zc + sw / 2, '+x');
    G.box('black', X1 - 0.1, X1 - 0.02, y1, y1 + 0.3, zc - sw / 2, zc + sw / 2, '+x');
    for (const [za, zb] of [[Z0 + 0.05, zc - sw / 2 - 0.3], [zc + sw / 2 + 0.3, Z1 - 0.05]]) {
      const n = Math.max(1, Math.round((zb - za) / 0.12));
      const w = (zb - za) / n;
      for (let i = 0; i < n; i++) G.box('velvet', X1 - (i % 2 ? 0.2 : 0.26), X1 - 0.02, 0.92, top, za + i * w, za + (i + 1) * w, '+x-y');
    }
    {
      const n = Math.round((Z1 - Z0 - 0.1) / 0.24);
      const w = (Z1 - Z0 - 0.1) / n;
      for (let i = 0; i < n; i++) G.box('velvet', X1 - (i % 2 ? 0.3 : 0.36), X1 - 0.02, y1 + 0.3, top + 0.1, Z0 + 0.05 + i * w, Z0 + 0.05 + (i + 1) * w, '+x');
    }
    G.box('paintDark', X1 - 1.3, X1 - 0.02, 0, 0.9, Z0, Z1, '-y+x');
    G.box('black', X1 - 1.32, X1 - 1.3, 0, 0.92, Z0, Z1, '-y');
    // (la salle 1 : ce qui passe à l'écran, carton de l'entracte puis film, est dessiné par view/mallCinema.js)
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
        if (s < 0 && [...(map.fakeScreens || []), ...(map.doors || []).filter((d) => d.kind === 'screen')].some((d) => Math.abs((d.z + 0.5) * C - z) < 3.2)) continue; // (ni une porte de salle, son portique)
        if (furn.some((o) => Math.abs(o.x - w) < 2 && Math.abs(o.z - z) < 1.6)) continue; // (ni derrière une borne)
        const x = w + s * 0.06;
        const box = [X0 - 0.25, Z0 - 0.25, X1 + 0.25, Z1 + 0.25];
        G.box('black', Math.min(w, w + s * 0.08), Math.max(w, w + s * 0.08), 0.9, 2.65, z - 0.62, z + 0.62);
        panel(pi % 4 === 3 ? 'postersOff' : 'posters', posters.uv(pi), x + s * 0.025, 1.78, z, 1.1, 1.65, s, 0);
        // un caisson allumé éclaire la moquette devant lui (un feu de couleur)
        if (pi % 4 !== 3) lights.push({ x: w + s * 0.6, y: 1.8, z, c: [0.42, 0.44, 0.5], rad: 3.4, nx: s, nz: 0, box });
        pi++;
      }
    }
  }

  // les escalators, condamnés : à chaque bout, une palissade de contreplaqué sur deux chevrons (on ne voit plus les
  // marches de près), un écriteau « OUT OF ORDER » ; en haut (fi 0) devant le palier d'arrivée, en bas devant le pied
  {
    if (!MATS.ooo) {
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
    }
    for (const e of map.allEscalators || []) {
      const h = e.hoard;
      if (!h) continue;
      // (le bout de l'escalator qui est à cet étage : son pied, ou son palier d'arrivée ; out : de quel côté on arrive)
      const ends = [];
      if (e.fi === fi) ends.push([e.x, -e.dir]);
      if (fi === 0 && e.fi === 1 && !e.nowhere) ends.push([e.top, e.dir]);
      for (const [x0, out] of ends) {
        const xf = x0 + out * h.d;
        const xr = x0 - out * 0.2;
        const HH = 2.44;
        const xa = Math.min(xf, xr);
        const xb = Math.max(xf, xr);
        // de front : deux feuilles debout, un joint entre elles ; les retours ; un chevron de rive en tête
        for (const s of [-1, 1]) G.box('plywood', xf - 0.009, xf + 0.009, 0.015, HH, s > 0 ? e.z + 0.004 : e.z - h.hw, s > 0 ? e.z + h.hw : e.z - 0.004);
        for (const s of [-1, 1]) G.box('plywood', xa, xb, 0.015, HH, e.z + s * h.hw - 0.009, e.z + s * h.hw + 0.009);
        G.box('plywood', xa - 0.02, xb + 0.02, HH, HH + 0.045, e.z - h.hw - 0.02, e.z + h.hw + 0.02);
        // (les têtes de vis : une file en haut, une en bas, sur chaque feuille)
        for (const s of [-1, 1]) for (const y of [0.22, 1.22, 2.22]) for (const dz of [0.12, 0.61, 1.1]) G.box('steel', xf + out * 0.009, xf + out * 0.011, y - 0.006, y + 0.006, e.z + s * dz - 0.006, e.z + s * dz + 0.006);
        panel('ooo', [0, 0, 1, 1], xf + out * 0.012, 1.5, e.z - out * 0.61, 0.7, 0.26, out, 0);
      }
    }
  }

  return { lights, show: SHOW, arcade, goods };
}
