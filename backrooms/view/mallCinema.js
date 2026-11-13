// The Backrooms (Level 17, le Mall) - Le cinéma en marche : la cabine de projection de la salle 1 et le film.
//  - la cabine (engine/mall.js : booth) : la cloison percée du hublot et de la fenêtre de visée, le projecteur 35 mm
//    (lanterne, tête, objectif, les deux bobines qui tournent quand le film passe), la table de montage (enrouleuses,
//    colleuse, les boîtes rapportées qui s'y empilent), le journal du projectionniste épinglé au mur (où sont les
//    bobines qui manquent : il se raye à mesure qu'on les trouve), la plaque de la porte ;
//  - l'écran de la salle 1 : le carton de l'entracte tant que le film attend ses bobines, puis l'amorce (le décompte)
//    et le film publicitaire du centre, redessinés une douzaine de fois par seconde ;
//  - le faisceau dans la poussière de la salle, la lueur de l'écran et celle de la lanterne (des feux de couleur du
//    moteur de lumière : lights(out)).
// Les boîtes de film à ramasser dans le centre sont dessinées par la scène (scene.js), avec reelCan().
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { mergeGeometries } from '../../shared/vendor/three/BufferGeometryUtils.js';
import { REELS, FILM_LEAD_T } from '../engine/mall.js';

const PI = Math.PI;
const V2 = (r, y) => new THREE.Vector2(r, y);
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => V2(r, y)), seg);
const canvasOf = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
};
const texOf = (c) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

// une boîte aux arêtes adoucies (lx le long de x, ly vers le haut, lz le long de z), centrée
function rbox(lx, ly, lz, r = 0.02) {
  r = Math.min(r, lx / 2 - 0.001, ly / 2 - 0.001, lz / 2 - 0.001);
  const w = lx / 2 - r;
  const h = ly / 2 - r;
  const c = r * 0.6;
  const s = new THREE.Shape();
  s.moveTo(-w + c, -h);
  s.lineTo(w - c, -h);
  s.quadraticCurveTo(w, -h, w, -h + c);
  s.lineTo(w, h - c);
  s.quadraticCurveTo(w, h, w - c, h);
  s.lineTo(-w + c, h);
  s.quadraticCurveTo(-w, h, -w, h - c);
  s.lineTo(-w, -h + c);
  s.quadraticCurveTo(-w, -h, -w + c, -h);
  const g = new THREE.ExtrudeGeometry(s, { depth: lz - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 3 });
  return g.translate(0, 0, -(lz - 2 * r) / 2);
}

// --- La boîte de film (35 mm, 38 cm) : un couvercle emboîté, une étiquette ronde ---
const CAN = [[0, 0], [0.183, 0], [0.19, 0.006], [0.19, 0.03], [0.186, 0.033], [0.186, 0.04], [0.18, 0.045], [0.166, 0.045], [0.162, 0.041], [0, 0.041]];
let canGeo = null;
let labelGeo = null;
const labelTex = [];
function reelLabel(n) {
  if (labelTex[n]) return labelTex[n];
  const [c, g] = canvasOf(160, 160);
  g.fillStyle = '#d9cfb4';
  g.beginPath();
  g.arc(80, 80, 78, 0, 7);
  g.fill();
  g.strokeStyle = '#7a2a22';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(80, 80, 72, 0, 7);
  g.stroke();
  g.fillStyle = '#7a2a22';
  g.textAlign = 'center';
  g.font = 'bold 13px "Arial Narrow", Arial, sans-serif';
  g.fillText('HALCYON PARK MALL', 80, 42);
  g.font = 'bold 12px "Arial Narrow", Arial, sans-serif';
  g.fillText('GRAND OPENING FEATURE', 80, 58);
  g.fillStyle = '#1d1a16';
  g.font = 'bold 22px Georgia, serif';
  g.fillText('REEL', 80, 88);
  g.font = 'bold 44px Georgia, serif';
  g.fillText(String(n), 80, 130);
  g.font = '11px "Arial Narrow", Arial, sans-serif';
  g.fillText('35 MM · SAFETY', 80, 147);
  // l'usure : des griffures, une auréole
  g.strokeStyle = 'rgba(60,40,20,0.25)';
  g.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.moveTo((i * 53) % 160, (i * 31) % 160);
    g.lineTo(((i * 53) % 160) + 30 - i * 5, ((i * 31) % 160) + 14);
    g.stroke();
  }
  return (labelTex[n] = texOf(c));
}
// une boîte numérotée : { group, glintAt } ; mats : { can, label(tex) } fournis par l'appelant (cuits par la lumière)
export function reelCan(n, canMat, labelMat) {
  canGeo = canGeo || lathe(CAN, 28);
  labelGeo = labelGeo || new THREE.CircleGeometry(0.118, 28).rotateX(-PI / 2).translate(0, 0.0416, 0);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(canGeo, canMat));
  g.add(new THREE.Mesh(labelGeo, labelMat(reelLabel(n))));
  return g;
}

// --- Ce qui passe à l'écran (un format très large, celui de l'écran : 19 m × 5,6 m) ---
const SW = 1024;
const SH = 428; // (2,39:1)
const OY = (SH - 302) / 2; // les cartons ont été composés pour une image de 302 px de haut : on les recentre
// le carton de l'entracte : il reste à l'écran tant que le film attend ses bobines
function paintIntermission(g) {
  const gr = g.createRadialGradient(SW / 2, SH / 2, 40, SW / 2, SH / 2, 600);
  gr.addColorStop(0, '#26344a');
  gr.addColorStop(1, '#0a0e16');
  g.fillStyle = gr;
  g.fillRect(0, 0, SW, SH);
  g.strokeStyle = '#c8b68a';
  g.lineWidth = 3;
  g.strokeRect(150, 22, SW - 300, SH - 44);
  g.lineWidth = 1;
  g.strokeRect(160, 31, SW - 320, SH - 62);
  g.textAlign = 'center';
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.font = 'italic 92px Georgia, "Times New Roman", serif';
  g.fillText('Intermission', SW / 2 + 5, 152 + OY);
  g.fillStyle = '#e9dcc0';
  g.fillText('Intermission', SW / 2, 147 + OY);
  g.font = 'bold 17px "Arial Narrow", Arial, sans-serif';
  g.fillText('T H E   F E A T U R E   W I L L   R E S U M E   S H O R T L Y', SW / 2, 204 + OY);
  g.font = '13px "Arial Narrow", Arial, sans-serif';
  g.fillText('S T A R D U S T   8   C I N E M A S', SW / 2, 246 + OY);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(255,255,255,${0.04 + ((i * 37) % 10) / 120})`;
    g.fillRect(((i * 197) % SW) + 0.5, 0, 1, SH);
  }
}
// l'amorce : le carton de la bobine, puis le décompte (une aiguille fait le tour du cadran à chaque chiffre)
function paintLeader(g, t) {
  if (t >= FILM_LEAD_T - 1) {
    g.fillStyle = '#060606';
    g.fillRect(0, 0, SW, SH);
    return;
  }
  g.fillStyle = '#8f8a7c';
  g.fillRect(0, 0, SW, SH);
  g.strokeStyle = '#1a1814';
  g.fillStyle = '#1a1814';
  g.textAlign = 'center';
  if (t < 1) {
    g.font = 'bold 30px "Arial Narrow", Arial, sans-serif';
    g.fillText('HALCYON PARK MALL · GRAND OPENING FEATURE', SW / 2, 110 + OY);
    g.font = 'bold 64px "Arial Narrow", Arial, sans-serif';
    g.fillText('PICTURE START', SW / 2, 196 + OY);
    g.font = '20px "Arial Narrow", Arial, sans-serif';
    g.fillText('REEL 1 OF 5 · 35 MM · SOUND', SW / 2, 240 + OY);
    return;
  }
  const n = Math.max(2, 8 - Math.floor(t));
  const f = t % 1;
  const cx = SW / 2;
  const cy = SH / 2;
  // le quart qui s'assombrit derrière l'aiguille
  g.fillStyle = 'rgba(40,36,30,0.28)';
  g.beginPath();
  g.moveTo(cx, cy);
  g.arc(cx, cy, 700, -PI / 2, -PI / 2 + f * 2 * PI);
  g.closePath();
  g.fill();
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, cy);
  g.lineTo(SW, cy);
  g.moveTo(cx, 0);
  g.lineTo(cx, SH);
  g.stroke();
  for (const r of [128, 108]) {
    g.beginPath();
    g.arc(cx, cy, r, 0, 7);
    g.stroke();
  }
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(-PI / 2 + f * 2 * PI) * 700, cy + Math.sin(-PI / 2 + f * 2 * PI) * 700);
  g.stroke();
  g.fillStyle = '#12100d';
  g.font = 'bold 190px Georgia, "Times New Roman", serif';
  g.fillText(String(n), cx, cy + 66);
}
// les cartons du film : la réclame d'ouverture du centre. art(g, i) : un dessin ajouté par-dessus (la mascotte)
export const FILM_CARDS = [
  { t: ['HALCYON PARK MALL', 'WHERE EVERY DAY IS A PARADE'], bg: ['#e9a13a', '#b3471f'], ink: '#fff3d6', glow: [1.0, 0.62, 0.3] },
  { t: ['MEET MISS MARIGOLD', 'OUR HOSTESS · TWELVE FEET OF SMILES'], bg: ['#2f9aa0', '#12494f'], ink: '#fff0c4', glow: [0.35, 0.8, 0.85] },
  { t: ['SHE GREETS EVERY GUEST', 'AT THE WEST COURT · EVERY HOUR ON THE HOUR'], bg: ['#d9783a', '#7a2f1c'], ink: '#fff3d6', glow: [0.95, 0.5, 0.28] },
  { t: ['SHE ONLY DANCES', 'WHEN NO ONE IS LOOKING'], bg: ['#3a3f7a', '#141631'], ink: '#f4e3ff', glow: [0.45, 0.45, 0.95] },
  { t: ['THIS WAY OUT', 'BEHIND THE SCREEN · THANK YOU FOR SHOPPING WITH US'], bg: ['#2c8f4e', '#0f3a20'], ink: '#f2ffe0', glow: [0.35, 0.9, 0.45], arrow: true },
];
const CARD_T = 5; // secondes par carton
function paintCard(g, i, art) {
  const K = FILM_CARDS[i];
  const gr = g.createLinearGradient(0, 0, 0, SH);
  gr.addColorStop(0, K.bg[0]);
  gr.addColorStop(1, K.bg[1]);
  g.fillStyle = gr;
  g.fillRect(0, 0, SW, SH);
  // des rayons de soleil derrière le titre
  g.save();
  g.translate(SW / 2, SH + 40);
  g.fillStyle = 'rgba(255,255,255,0.07)';
  for (let k = 0; k < 18; k++) {
    g.rotate(PI / 18);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-900, -26);
    g.lineTo(-900, 26);
    g.closePath();
    g.fill();
  }
  g.restore();
  const shift = art ? art(g, i, SW, SH) || 0 : 0; // (la mascotte prend la gauche : le texte se pousse)
  const cx = SW / 2 + shift;
  g.textAlign = 'center';
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.font = `italic bold ${K.t[0].length > 17 ? 62 : 76}px Georgia, "Times New Roman", serif`;
  g.fillText(K.t[0], cx + 4, 146 + OY);
  g.fillStyle = K.ink;
  g.fillText(K.t[0], cx, 142 + OY);
  g.font = 'bold 22px "Arial Narrow", Arial, sans-serif';
  g.fillText(K.t[1].split('').join(' ').replace(/ {3}/g, '    '), cx, 200 + OY);
  if (K.arrow) {
    g.lineWidth = 12;
    g.strokeStyle = K.ink;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(SW - 190, 60 + OY);
    g.lineTo(SW - 90, 60 + OY);
    g.moveTo(SW - 126, 30 + OY);
    g.lineTo(SW - 90, 60 + OY);
    g.lineTo(SW - 126, 90 + OY);
    g.stroke();
  }
  // le cadre arrondi du projecteur, un vignettage
  const vg = g.createRadialGradient(SW / 2, SH / 2, SH * 0.6, SW / 2, SH / 2, SW * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = vg;
  g.fillRect(0, 0, SW, SH);
}

// --- La cabine, le projecteur, la table de montage ---
export function drawMallCinema({ map, fi, floors, G, MATS, baked, model, group, placed, art = null }) {
  const B = fi === 0 ? map.booth : null;
  if (!B) return null;
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  const phong = (o) => new THREE.MeshPhongMaterial(o);
  const mat = (k, m) => (MATS[k] = MATS[k] || { m, S: 1 });
  mat('cineEnamel', baked(phong({ color: '#3d4b45', specular: '#6f7a74', shininess: 50 }), { spec: 0.45, gloss: 80, mask: 0 }));
  mat('cineWrinkle', baked(phong({ color: '#1c1d1e', specular: '#2e2e2e', shininess: 18 })));
  mat('cineAlu', baked(phong({ color: '#a4a8ab', specular: '#eef0f2', shininess: 90 }), { spec: 0.8, gloss: 150, mask: 0 }));
  mat('cineFilm', baked(phong({ color: '#1d1611', specular: '#5a4a3a', shininess: 60 }), { spec: 0.5, gloss: 90, mask: 0 }));
  mat('cineLens', baked(phong({ color: '#0c1220', specular: '#9fb4ff', shininess: 140 }), { spec: 1.2, gloss: 260, mask: 0 }));
  const canMat = baked(phong({ color: '#8b8f92', specular: '#d8dadc', shininess: 70, emissive: '#3a3c3e', emissiveIntensity: 0.25 }), { spec: 0.6, gloss: 110, mask: 0 });
  const labelMats = new Map();
  const labelMat = (tex) => labelMats.get(tex) || labelMats.set(tex, baked(lam({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.12 }))).get(tex);

  const put = (k, geo, x, y, z) => G.add(k, geo.translate(x, y, z));
  const H = B.ceil;

  // 1. La cloison côté salle (au ras de la retombée du plafond de la salle) : grise dedans, sombre côté fauteuils ; le
  // hublot de projection dans l'axe de l'écran, la fenêtre de visée à côté
  const port = { z0: B.port.z - 0.2, z1: B.port.z + 0.2, y0: B.port.y - 0.15, y1: B.port.y + 0.15 };
  const sight = { z0: B.port.z - 1.25, z1: B.port.z - 0.6, y0: 1.42, y1: 1.8 };
  const holes = [sight, port];
  const wallX = B.x1;
  for (const [k, xa, xb, skip] of [['paintGrey', wallX - 0.12, wallX - 0.06, '+x-y'], ['paintDark', wallX - 0.06, wallX, '-x-y']]) {
    let z = B.z0;
    for (const h of holes) {
      G.box(k, xa, xb, 0, H, z, h.z0, skip + '-z');
      G.box(k, xa, xb, 0, h.y0, h.z0, h.z1, skip + '-z+z');
      G.box(k, xa, xb, h.y1, H, h.z0, h.z1, skip + '-z+z');
      z = h.z1;
    }
    G.box(k, xa, xb, 0, H, z, B.z1, skip + '+z');
  }
  for (const h of holes) {
    // un cadre d'acier, une vitre
    const t = 0.025;
    G.box('steel', wallX - 0.135, wallX + 0.012, h.y0 - t, h.y0, h.z0 - t, h.z1 + t);
    G.box('steel', wallX - 0.135, wallX + 0.012, h.y1, h.y1 + t, h.z0 - t, h.z1 + t);
    G.box('steel', wallX - 0.135, wallX + 0.012, h.y0, h.y1, h.z0 - t, h.z0);
    G.box('steel', wallX - 0.135, wallX + 0.012, h.y0, h.y1, h.z1, h.z1 + t);
    G.box('glass', wallX - 0.064, wallX - 0.056, h.y0, h.y1, h.z0, h.z1, '-y+y-z+z');
  }
  // une plinthe noire au pied de la cloison, des deux côtés
  G.box('black', wallX - 0.132, wallX - 0.12, 0, 0.1, B.z0, B.z1, '-y+x');
  G.box('black', wallX, wallX + 0.012, 0, 0.1, B.z0, B.z1, '-y-x');

  // 2. Le projecteur : enfermé dans son armoire de tôle, contre la cloison (on n'en voit que le hublot, là-haut). Une
  // porte à deux battants, des ouïes en haut et en bas, un voyant qui s'allume quand la lampe brûle
  const px = B.proj.x;
  const pz = B.proj.z;
  const oy = B.proj.y;
  const K = B.closet;
  G.box('paintGrey', K.x0, K.x1, 0, H, K.z0, K.z1, '-y+y+x');
  G.box('black', K.x0 - 0.004, K.x0, 0, 0.1, K.z0, K.z1, '-y+x');
  // (le joint des battants, les paumelles, la poignée, les ouïes)
  G.box('black', K.x0 - 0.003, K.x0, 0.1, H - 0.05, pz - 0.004, pz + 0.004, '+x');
  for (const sz of [-1, 1]) {
    for (const y of [0.35, 1.3, 2.3]) G.box('steel', K.x0 - 0.012, K.x0, y, y + 0.09, pz + sz * 0.5 - 0.012, pz + sz * 0.5 + 0.012, '+x');
    for (const [ya, yb] of [[0.22, 0.5], [2.2, 2.48]]) for (let y = ya; y < yb; y += 0.045) G.box('black', K.x0 - 0.004, K.x0, y, y + 0.02, pz + sz * 0.27 - 0.17, pz + sz * 0.27 + 0.17, '+x');
  }
  G.box('steel', K.x0 - 0.04, K.x0, 1.02, 1.16, pz + 0.03, pz + 0.055, '+x');
  const spin = [];
  const filmParts = [];
  // le voyant de la lampe, sur la porte
  const lampGlass = new THREE.Mesh(new THREE.CircleGeometry(0.022, 14).rotateY(-PI / 2), new THREE.MeshBasicMaterial({ color: '#0d0a08' }));
  lampGlass.position.set(K.x0 - 0.006, 1.62, pz - 0.2);
  group.add(lampGlass);

  // 3. La table de montage, contre le mur du sud : plateau de bois, pieds d'acier, tablette ; deux enrouleuses (la
  // manivelle vers soi), la colleuse au milieu
  const bx = B.bench.x;
  const bz = B.bench.z;
  const top = 0.9;
  G.box('wood', bx - 1.1, bx + 1.1, top - 0.045, top, bz - 0.41, B.z1 - 0.01);
  G.box('wood', bx - 1.1, bx + 1.1, top, top + 0.14, B.z1 - 0.045, B.z1 - 0.01, '-y');
  G.box('wood', bx - 1.04, bx + 1.04, 0.24, 0.265, bz - 0.33, B.z1 - 0.06);
  for (const sx of [-1, 1]) for (const z of [bz - 0.36, B.z1 - 0.09]) G.box('steel', bx + sx * 1.04 - 0.022, bx + sx * 1.04 + 0.022, 0, top - 0.045, z - 0.022, z + 0.022, '-y+y');
  const Bn = (k, geo, x, y, z) => put(k, geo, bx + x, top + y, bz + z);
  for (const sx of [-1, 1]) {
    Bn('cineWrinkle', rbox(0.12, 0.03, 0.14, 0.008), sx * 0.74, 0.015, 0.02);
    Bn('cineEnamel', rbox(0.05, 0.3, 0.06, 0.012), sx * 0.74, 0.18, 0.04);
    Bn('cineEnamel', new THREE.CylinderGeometry(0.05, 0.05, 0.1, 16).rotateX(PI / 2), sx * 0.74, 0.34, 0.03);
    Bn('cineAlu', new THREE.CylinderGeometry(0.008, 0.008, 0.2, 8).rotateX(PI / 2), sx * 0.74, 0.34, -0.1);
    // la manivelle : un bras, une poignée de bois
    Bn('cineAlu', rbox(0.022, 0.13, 0.008, 0.003), sx * 0.74, 0.34 - 0.055, 0.086);
    Bn('wood', new THREE.CylinderGeometry(0.013, 0.015, 0.07, 10).rotateX(PI / 2), sx * 0.74, 0.34 - 0.11, 0.125);
  }
  // la colleuse : un socle, deux volets relevés, le couteau
  Bn('cineWrinkle', rbox(0.24, 0.028, 0.12, 0.008), 0, 0.014, -0.16);
  for (const sx of [-1, 1]) Bn('cineAlu', rbox(0.1, 0.006, 0.09, 0.002).rotateZ(sx * 0.9), sx * 0.085, 0.07, -0.16);
  Bn('cineAlu', rbox(0.012, 0.012, 0.13, 0.003), 0, 0.034, -0.16);
  // des boîtes vides sur la tablette, un carton, la lampe d'architecte, un tabouret, un classeur à tiroirs contre le
  // mur du nord
  for (const [x, n, r] of [[-0.6, 3, 0.2], [-0.12, 2, 1.1]]) for (let i = 0; i < n; i++) G.add('cineAlu', lathe(CAN, 22).rotateY(r + i).translate(bx + x + (i % 2) * 0.02, 0.265 + i * 0.046, bz + 0.05));
  model('cardboard_box_01', bx + 0.62, 0.265, bz + 0.03, 0.3, 0.9);
  model('desk_lamp_arm_01', bx + 0.98, top, bz + 0.24, -2.3);
  model('metal_stool_02', bx + 0.75, 0, bz - 0.9, 0.4, 1.05);
  model('drawer_cabinet', B.x0 + 1.5, 0, B.z0 + 0.27, 0);
  model('metal_trash_can', B.x0 + 0.35, 0, B.z1 - 1.25, 1, 1, 0, 0, 'metal_trash_can');
  if (placed) placed.push([bx, B.z1, 1.6]);

  // les boîtes rapportées s'empilent sur la table (une par bobine montée)
  const cans = [];
  for (let i = 0; i < REELS; i++) {
    const c = reelCan(i + 1, canMat, labelMat);
    c.position.set(bx + 0.28 + (i % 2 ? 0.025 : -0.015), top + i * 0.0455, bz + 0.14 + (i % 3) * 0.012);
    c.rotation.y = i * 2.1 + 0.4;
    c.visible = false;
    group.add(c);
    cans.push(c);
  }

  // 4. Le journal du projectionniste, sur une planchette au mur au-dessus de la table : où sont parties les bobines
  // (rayées à mesure que l'équipe les trouve)
  const reels = floors.flatMap((f) => f.cassettes || []).filter((c) => c.reel).sort((a, b) => a.id - b.id);
  const [logC, logG] = canvasOf(384, 540);
  const logTex = texOf(logC);
  let logKey = '';
  const paintLog = () => {
    const g = logG;
    g.fillStyle = '#e4dcc4';
    g.fillRect(0, 0, 384, 540);
    g.fillStyle = 'rgba(120,90,40,0.08)';
    for (let i = 0; i < 40; i++) g.fillRect((i * 97) % 384, (i * 61) % 540, 30 + (i % 5) * 14, 2);
    g.fillStyle = '#5a5a5a';
    g.fillRect(132, 0, 120, 26);
    g.fillStyle = '#1f2a44';
    g.textAlign = 'left';
    g.font = 'bold 27px "Arial Narrow", Arial, sans-serif';
    g.fillText('PROJECTION LOG · SCREEN 1', 26, 66);
    g.fillRect(26, 78, 332, 3);
    g.font = 'bold 20px "Arial Narrow", Arial, sans-serif';
    g.fillText('5 REELS LENT OUT, NOT RETURNED:', 26, 112);
    reels.forEach((c, i) => {
      const y = 158 + i * 70;
      g.fillStyle = '#131a2e';
      g.font = 'bold 25px "Arial Narrow", Arial, sans-serif';
      const txt = c.where.length > 27 ? c.where.slice(0, 26) + '…' : c.where;
      g.fillText(`${c.id + 1} · ${txt}`, 26, y);
      g.fillStyle = '#7a2a22';
      g.font = 'bold 20px "Arial Narrow", Arial, sans-serif';
      g.fillText(c.fi ? 'LOWER LEVEL' : 'UPPER LEVEL', 52, y + 25);
      if (c.collected) {
        g.strokeStyle = '#9a1c14';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(22, y - 4);
        g.lineTo(356, y + 8);
        g.stroke();
      }
    });
    g.fillStyle = '#1f2a44';
    g.font = 'italic 19px Georgia, serif';
    g.fillText('No show until all five are back.', 26, 518);
    logTex.needsUpdate = true;
  };
  paintLog();
  {
    const lx = bx + 0.25;
    G.box('wood', lx - 0.25, lx + 0.25, 1.22, 1.9, B.z1 - 0.022, B.z1 - 0.004, '+z');
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.59).rotateY(PI), baked(lam({ map: logTex })));
    m.position.set(lx, 1.55, B.z1 - 0.026);
    group.add(m);
  }
  // la plaque de la porte, côté couloir des salles
  {
    const [c, g] = canvasOf(256, 96);
    g.fillStyle = '#16171a';
    g.fillRect(0, 0, 256, 96);
    g.strokeStyle = '#c9b88a';
    g.lineWidth = 3;
    g.strokeRect(6, 6, 244, 84);
    g.fillStyle = '#e9dcc0';
    g.textAlign = 'center';
    g.font = 'bold 34px "Arial Narrow", Arial, sans-serif';
    g.fillText('PROJECTION', 128, 46);
    g.font = 'bold 17px "Arial Narrow", Arial, sans-serif';
    g.fillText('S T A F F   O N L Y', 128, 74);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.26).rotateY(-PI / 2), baked(lam({ map: texOf(c), emissive: '#ffffff', emissiveMap: texOf(c), emissiveIntensity: 0.1 })));
    m.position.set(B.x0 - 2.5 - 0.012, 2.52, B.z0 + 1.25);
    group.add(m);
  }

  // 5. L'écran : une image redessinée (carton de l'entracte, amorce, film)
  const S = B.screen;
  const [scrC, scrG] = canvasOf(SW, SH);
  const scrTex = texOf(scrC);
  const scrMat = new THREE.MeshBasicMaterial({ map: scrTex, color: new THREE.Color(0.8, 0.8, 0.8) });
  const scrMesh = new THREE.Mesh(new THREE.PlaneGeometry(S.z1 - S.z0, S.y1 - S.y0).rotateY(-PI / 2), scrMat);
  scrMesh.position.set(S.x, (S.y0 + S.y1) / 2, (S.z0 + S.z1) / 2);
  group.add(scrMesh);
  paintIntermission(scrG);
  scrTex.needsUpdate = true;
  let cards = null; // les cartons du film, dessinés une fois
  const cardOf = (i) => {
    if (!cards) cards = [];
    if (!cards[i]) {
      const [c, g] = canvasOf(SW, SH);
      paintCard(g, i, art);
      cards[i] = c;
    }
    return cards[i];
  };
  let frameT = 0;
  let shown = 'idle';
  let glow = [0.4, 0.46, 0.6];
  let glowK = 1;
  let rs = 12345;
  const rnd = () => {
    rs = (rs * 1664525 + 1013904223) >>> 0;
    return rs / 4294967296;
  };
  const paintFilm = (t) => {
    const g = scrG;
    const lead = t < FILM_LEAD_T;
    let flick = 0.9 + rnd() * 0.1;
    if (lead) {
      paintLeader(g, t);
      glow = t >= FILM_LEAD_T - 1 ? [0.05, 0.05, 0.05] : [0.75, 0.72, 0.62];
    } else {
      const ft = t - FILM_LEAD_T;
      const i = Math.floor(ft / CARD_T) % FILM_CARDS.length;
      const into = ft % CARD_T;
      // la fenêtre du projecteur flotte un peu ; à chaque changement de carton, deux images brûlées
      g.fillStyle = '#000';
      g.fillRect(0, 0, SW, SH);
      g.drawImage(cardOf(i), (rnd() - 0.5) * 2.4, (rnd() - 0.5) * 3);
      glow = FILM_CARDS[i].glow;
      if (into < 0.17) {
        g.fillStyle = `rgba(255,244,214,${0.85 - into * 4})`;
        g.fillRect(0, 0, SW, SH);
        flick = 1.3;
      }
    }
    // les rayures, les poussières, le battement de la lampe
    for (let k = 0; k < 3; k++) {
      if (rnd() < 0.6) continue;
      g.fillStyle = `rgba(255,255,255,${0.12 + rnd() * 0.25})`;
      g.fillRect(Math.floor(rnd() * SW), 0, 1 + (rnd() < 0.2 ? 1 : 0), SH);
    }
    for (let k = 0; k < 7; k++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.5)';
      g.fillRect(rnd() * SW, rnd() * SH, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    if (flick < 0.95) {
      g.fillStyle = `rgba(0,0,0,${(0.95 - flick) * 1.6})`;
      g.fillRect(0, 0, SW, SH);
    }
    glowK = flick;
    scrTex.needsUpdate = true;
  };

  // 6. Le faisceau : la poussière de la salle prise dans la lumière du projecteur, du hublot à l'écran (trois nappes
  // emboîtées : plus dense au cœur). Sa lumière sur la salle vient des feux de couleur (lights)
  const beamU = { uCol: { value: new THREE.Color(0.5, 0.56, 0.7) }, uK: { value: 0.25 }, uTime: { value: 0 } };
  {
    const pos = [];
    const tt = [];
    const A = [B.port.x + 0.02, B.port.y, B.port.z];
    const cy = (S.y0 + S.y1) / 2;
    const cz = (S.z0 + S.z1) / 2;
    for (const s of [1, 0.55]) {
      const hy = ((S.y1 - S.y0) / 2) * s;
      const hz = ((S.z1 - S.z0) / 2) * s;
      const near = [[-0.03, -0.1], [-0.03, 0.1], [0.03, 0.1], [0.03, -0.1]].map(([dy, dz]) => [A[0], A[1] + dy * s, A[2] + dz * s]);
      const far = [[-hy, -hz], [-hy, hz], [hy, hz], [hy, -hz]].map(([dy, dz]) => [S.x - 0.05, cy + dy, cz + dz]);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        for (const [p, t] of [[near[i], 0], [far[i], 1], [far[j], 1], [near[i], 0], [far[j], 1], [near[j], 0]]) {
          pos.push(...p);
          tt.push(t);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
    const m = new THREE.Mesh(
      g,
      new THREE.ShaderMaterial({
        uniforms: beamU,
        vertexShader: 'attribute float aT; varying float vT; varying vec3 vP; void main(){ vT = aT; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader:
          'uniform vec3 uCol; uniform float uK; uniform float uTime; varying float vT; varying vec3 vP;' +
          // (plus vive près du hublot ; elle s'efface avant l'écran : pas de rectangle sur l'image)
          'void main(){ float fall = (0.04 + 0.5 / (1.0 + vT * 16.0)) * smoothstep(1.0, 0.72, vT) * smoothstep(0.0, 0.015, vT);' +
          ' float n = 0.78 + 0.22 * sin(vP.y * 5.0 + uTime * 0.7 + vP.x * 0.8) * sin(vP.z * 3.1 - uTime * 0.45 + vP.x * 1.3);' +
          ' gl_FragColor = vec4(uCol * uK * fall * n, 1.0); }',
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    m.frustumCulled = false;
    m.renderOrder = 3;
    group.add(m);
  }

  const roomBox = (() => {
    const r = (map.rooms || [])[S.room];
    return r ? [r.x0 * 2.5 - 0.25, r.z0 * 2.5 - 0.25, (r.x1 + 1) * 2.5 + 0.25, (r.z1 + 1) * 2.5 + 0.25] : null;
  })();
  const boothBox = [B.x0 - 0.2, B.z0 - 0.2, B.x1 + 0.6, B.z1 + 0.2];
  let running = false;
  let delivered = -1;
  return {
    update(sim, time, dt, camera) {
      const film = sim.film || 0;
      const n = Math.min(REELS, sim.delivered || 0);
      if (n !== delivered) {
        delivered = n;
        cans.forEach((c, i) => (c.visible = i < n));
        for (const f of filmParts) f.visible = n >= REELS;
      }
      const key = reels.map((c) => (c.collected ? 1 : 0)).join('');
      if (key !== logKey) {
        logKey = key;
        paintLog();
      }
      const on = film > 0;
      if (on !== running) {
        running = on;
        lampGlass.material.color.set(on ? '#ffd9a0' : '#0d0a08');
        if (!on) {
          paintIntermission(scrG);
          scrTex.needsUpdate = true;
          glow = [0.4, 0.46, 0.6];
          shown = 'idle';
        }
      }
      beamU.uTime.value = time;
      if (!on) {
        beamU.uK.value = 0.13 + 0.02 * Math.sin(time * 7.3);
        beamU.uCol.value.setRGB(0.42, 0.48, 0.62);
        glowK = 0.75 + 0.25 * Math.sin(time * 2.1 + 1.7);
        return;
      }
      for (const g of spin) g.rotation.z -= dt * 4.2;
      // l'image : douze fois par seconde, et seulement si l'on est assez près pour la voir
      const far = Math.hypot(camera.position.x - S.x, camera.position.z - (S.z0 + S.z1) / 2) > 70;
      frameT -= dt;
      if (frameT <= 0 && !far) {
        frameT = 1 / 12;
        paintFilm(film);
        shown = 'film';
      }
      beamU.uK.value = 0.55 * glowK * (0.35 + 0.65 * Math.max(glow[0], glow[1], glow[2]));
      beamU.uCol.value.setRGB(0.35 + glow[0] * 0.65, 0.35 + glow[1] * 0.65, 0.35 + glow[2] * 0.65);
    },
    get shown() {
      return shown;
    },
    lights(out, time) {
      // la lueur de l'écran sur la salle (elle prend la teinte de l'image) ; la lanterne qui fuit dans la cabine
      const k = (running ? 1.35 : 1) * glowK;
      out.push({ x: S.x - 3, y: 2.8, z: (S.z0 + S.z1) / 2, r: glow[0] * k, g: glow[1] * k, b: glow[2] * k, rad: running ? 15 : 12, nx: -1, ny: 0, nz: 0, w: -0.2, box: roomBox });
      if (running) {
        const f = 0.85 + 0.15 * Math.sin(time * 23) * Math.sin(time * 7.1);
        out.push({ x: K.x0 - 0.25, y: 2.3, z: pz, r: 1.0 * f, g: 0.78 * f, b: 0.5 * f, rad: 2.6, nx: -1, ny: 0, nz: 0, w: -0.3, box: boothBox });
      }
    },
  };
}
