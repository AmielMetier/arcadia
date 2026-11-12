// The Backrooms (Level 17, le Mall) - La salle de jeux (Funland) et les bornes du cinéma : des bornes d'arcade
// modelées (flancs découpés et peints, écran cathodique incliné, tableau de commande, monnayeur, fronton lumineux),
// des machines à pince vitrées pleines de lots, le comptoir des lots et ses étagères. Les jeux sont inventés ; leurs
// écrans, frontons, flancs et affiches sont peints dans un seul atlas. Les lots sont des modèles Poly Haven (model()).
import * as THREE from '../../shared/vendor/three/three.module.min.js';

const GAMES = [
  ['NEBULA STRIKE', '#ff3d6e', '#1a1440', '#3ad1ff'],
  ['IRON KNIGHTS', '#ffb02e', '#2a1208', '#ff5a1f'],
  ['GULP GALAXY', '#ffe23d', '#05051c', '#2f6bff'],
  ['DRAGON ALLEY', '#62ff7a', '#0c1d12', '#ff3b3b'],
  ['ROCKET ROLLER', '#ff7ad9', '#180a24', '#7affef'],
  ['HYPER HOOPS', '#ff8a1e', '#06142a', '#ffffff'],
  ['THUNDER LANE', '#42e0ff', '#0a0a0a', '#ffd400'],
  ['ZAP ZONE 2000', '#b6ff2e', '#140022', '#ff2ec4'],
];
export const CLAWS = ['LUCKY CLAW', 'PRIZE CATCHER', 'GRAB-A-PAL', 'CLAW CITY'];

// l'atlas : 2048 × 1024, des cases de 256 de large ; rangées : écrans (192), frontons (64), flancs (256),
// tableaux de commande (96), monnayeurs et enseignes (128), affiches (288)
const ROWS = { screen: [0, 192], marquee: [192, 64], side: [256, 256], panel: [512, 96], misc: [608, 128], poster: [736, 288] };
function arcadeAtlas() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 1024;
  const g = c.getContext('2d');
  const rnd = (() => {
    let s = 7;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  const font = (px, w = 'bold') => `${w} ${px}px "Arial Black", "Futura", Impact, sans-serif`;
  GAMES.forEach(([name, a, bg, b], i) => {
    const x0 = i * 256;
    // l'écran : un écran d'attente de jeu (des sprites en pixels, le titre, INSERT COIN), lignes de balayage
    let [y0, h] = ROWS.screen;
    g.fillStyle = bg;
    g.fillRect(x0, y0, 256, h);
    for (let k = 0; k < 40; k++) {
      g.fillStyle = k % 3 ? '#ffffff' : b;
      g.fillRect(x0 + rnd() * 256, y0 + rnd() * h, 2, 2);
    }
    const px = (sx, sy, rows, col, s = 4) =>
      rows.forEach((r, ry) => [...r].forEach((ch, rx) => {
        if (ch === '#') {
          g.fillStyle = col;
          g.fillRect(x0 + sx + rx * s, y0 + sy + ry * s, s, s);
        }
      }));
    const ship = ['...#...', '..###..', '.#####.', '##.#.##', '#.....#'];
    const bug = ['.#...#.', '..###..', '.#####.', '##.#.##', '#######', '.#.#.#.'];
    if (i % 4 === 0) {
      for (let k = 0; k < 6; k++) px(28 + k * 34, 52, bug, k % 2 ? a : b, 3);
      px(112, 150, ship, '#ffffff', 4);
    } else if (i % 4 === 1) {
      g.fillStyle = b;
      for (let k = 0; k < 5; k++) g.fillRect(x0 + 10 + k * 50, y0 + 140 + (k % 2) * 14, 40, 10);
      px(60, 112, ['.##.', '####', '.##.', '#..#'], a, 6);
    } else if (i % 4 === 2) {
      g.strokeStyle = b;
      g.lineWidth = 6;
      g.strokeRect(x0 + 16, y0 + 40, 224, 136);
      g.strokeRect(x0 + 60, y0 + 80, 136, 56);
      g.fillStyle = a;
      for (let k = 0; k < 9; k++) g.fillRect(x0 + 34 + k * 24, y0 + 60, 5, 5);
      g.beginPath();
      g.arc(x0 + 40, y0 + 158, 9, 0.6, Math.PI * 2 - 0.6);
      g.lineTo(x0 + 40, y0 + 158);
      g.fill();
    } else {
      g.fillStyle = '#333';
      g.beginPath();
      g.moveTo(x0 + 100, y0 + 40);
      g.lineTo(x0 + 156, y0 + 40);
      g.lineTo(x0 + 250, y0 + h);
      g.lineTo(x0 + 6, y0 + h);
      g.fill();
      g.fillStyle = b;
      for (let k = 0; k < 6; k++) g.fillRect(x0 + 126, y0 + 50 + k * 24, 4, 12);
      px(108, 140, ['.####.', '######', '#.##.#'], a, 6);
    }
    g.fillStyle = a;
    g.font = font(22);
    g.textAlign = 'center';
    g.fillText(name, x0 + 128, y0 + 30);
    g.fillStyle = '#ffffff';
    g.font = font(14, 'bold');
    g.fillText(i % 2 ? 'INSERT COIN' : 'GAME OVER', x0 + 128, y0 + 98);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (let y = 0; y < h; y += 3) g.fillRect(x0, y0 + y, 256, 1);
    // le fronton : le titre sur un dégradé, derrière un plexiglas
    [y0, h] = ROWS.marquee;
    const gr = g.createLinearGradient(0, y0, 0, y0 + h);
    gr.addColorStop(0, bg);
    gr.addColorStop(0.5, b);
    gr.addColorStop(1, bg);
    g.fillStyle = gr;
    g.fillRect(x0, y0, 256, h);
    g.fillStyle = a;
    g.strokeStyle = '#000';
    g.lineWidth = 5;
    g.font = font(30);
    g.strokeText(name, x0 + 128, y0 + 43);
    g.fillText(name, x0 + 128, y0 + 43);
    // le flanc : un décor peint (bandes, éclairs, étoiles) sur fond noir, éraflé
    [y0, h] = ROWS.side;
    g.fillStyle = '#0d0c10';
    g.fillRect(x0, y0, 256, h);
    g.save();
    g.beginPath();
    g.rect(x0, y0, 256, h);
    g.clip();
    for (let k = 0; k < 4; k++) {
      g.fillStyle = [a, b, a, '#ffffff'][k];
      g.beginPath();
      const o = 30 + k * 26 + i * 7;
      g.moveTo(x0, y0 + h - o);
      g.lineTo(x0 + 256, y0 + h - o - 140);
      g.lineTo(x0 + 256, y0 + h - o - 126);
      g.lineTo(x0, y0 + h - o + 14);
      g.fill();
    }
    for (let k = 0; k < 7; k++) {
      g.fillStyle = k % 2 ? a : b;
      const sx = x0 + 20 + rnd() * 216;
      const sy = y0 + 10 + rnd() * 120;
      g.beginPath();
      for (let p = 0; p < 10; p++) {
        const r = p % 2 ? 4 : 11;
        g.lineTo(sx + Math.cos((p * Math.PI) / 5) * r, sy + Math.sin((p * Math.PI) / 5) * r);
      }
      g.fill();
    }
    g.translate(x0 + 128, y0 + 200);
    g.rotate(-0.5);
    g.fillStyle = a;
    g.font = font(28);
    g.fillText(name.split(' ')[0], 0, 0);
    g.restore();
    g.strokeStyle = 'rgba(200,200,190,0.35)';
    g.lineWidth = 1;
    for (let k = 0; k < 18; k++) {
      const sx = x0 + rnd() * 256;
      const sy = y0 + rnd() * h;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + (rnd() - 0.5) * 40, sy + (rnd() - 0.5) * 10);
      g.stroke();
    }
    // le tableau de commande : le décor, les cercles des boutons, 1P / 2P
    [y0, h] = ROWS.panel;
    g.fillStyle = '#16151a';
    g.fillRect(x0, y0, 256, h);
    g.fillStyle = b;
    g.fillRect(x0, y0 + h - 14, 256, 6);
    g.fillStyle = a;
    g.fillRect(x0, y0 + 6, 256, 4);
    g.strokeStyle = '#88857d';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x0 + 64, y0 + 48, 20, 0, 7);
    g.stroke();
    g.fillStyle = '#d8d2c0';
    g.font = font(11, 'bold');
    g.fillText('1 PLAYER', x0 + 64, y0 + 84);
    g.fillText('FIRE', x0 + 168, y0 + 84);
  });
  // le monnayeur (porte à deux fentes, boutons orange), les enseignes des pinces, PRIZES, TOKENS
  const [m0] = ROWS.misc;
  {
    const x0 = 0;
    g.fillStyle = '#2b2a2c';
    g.fillRect(x0, m0, 256, 128);
    g.fillStyle = '#6d6a66';
    g.fillRect(x0 + 40, m0 + 10, 176, 108);
    g.fillStyle = '#3a3836';
    g.fillRect(x0 + 46, m0 + 16, 164, 96);
    for (const sx of [80, 176]) {
      g.fillStyle = '#e07018';
      g.fillRect(x0 + sx - 18, m0 + 30, 36, 30);
      g.fillStyle = '#1a1a1a';
      g.fillRect(x0 + sx - 3, m0 + 34, 6, 22);
      g.fillStyle = '#ffd9a0';
      g.font = font(12);
      g.fillText('25¢', x0 + sx, m0 + 80);
      g.fillStyle = '#111';
      g.fillRect(x0 + sx - 14, m0 + 90, 28, 12);
    }
  }
  CLAWS.forEach((t, k) => {
    const x0 = (k + 1) * 256;
    const gr = g.createLinearGradient(x0, 0, x0 + 256, 0);
    gr.addColorStop(0, ['#ff2e7a', '#2ea8ff', '#ffb52e', '#7a2eff'][k]);
    gr.addColorStop(1, ['#ffcf2e', '#2effc0', '#ff4e2e', '#ff2ec8'][k]);
    g.fillStyle = gr;
    g.fillRect(x0, m0, 256, 128);
    g.fillStyle = '#fff';
    g.strokeStyle = '#111';
    g.lineWidth = 6;
    g.font = font(34);
    g.strokeText(t, x0 + 128, m0 + 78);
    g.fillText(t, x0 + 128, m0 + 78);
  });
  [['PRIZES', '#ffd400', '#c4122f'], ['TOKENS', '#ffffff', '#0b6b3a'], ['FUNLAND', '#ff3df2', '#120a24']].forEach(([t, ink, bg], k) => {
    const x0 = (k + 5) * 256;
    g.fillStyle = bg;
    g.fillRect(x0, m0, 256, 128);
    g.strokeStyle = ink;
    g.lineWidth = 4;
    g.strokeRect(x0 + 8, m0 + 8, 240, 112);
    g.fillStyle = ink;
    g.font = font(48);
    g.fillText(t, x0 + 128, m0 + 82);
  });
  // les affiches de la salle (une par jeu : le titre, une grande figure, HIGH SCORE)
  const [p0, ph] = ROWS.poster;
  GAMES.forEach(([name, a, bg, b], i) => {
    const x0 = i * 256;
    const gr = g.createLinearGradient(0, p0, 0, p0 + ph);
    gr.addColorStop(0, bg);
    gr.addColorStop(1, '#000');
    g.fillStyle = gr;
    g.fillRect(x0, p0, 256, ph);
    g.fillStyle = b;
    g.beginPath();
    g.arc(x0 + 128, p0 + 150, 70, 0, 7);
    g.fill();
    g.fillStyle = a;
    g.beginPath();
    g.moveTo(x0 + 128, p0 + 70);
    g.lineTo(x0 + 190, p0 + 220);
    g.lineTo(x0 + 128, p0 + 190);
    g.lineTo(x0 + 66, p0 + 220);
    g.fill();
    g.font = font(24);
    g.fillText(name, x0 + 128, p0 + 44);
    g.fillStyle = '#fff';
    g.font = font(13, 'bold');
    g.fillText('NOW PLAYING · 2 PLAYERS', x0 + 128, p0 + 260);
    // l'usure : un coin déchiré, des taches
    g.fillStyle = 'rgba(40,30,20,0.35)';
    for (let k = 0; k < 6; k++) g.fillRect(x0 + rnd() * 240, p0 + rnd() * 270, 6 + rnd() * 30, 3 + rnd() * 12);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const uv = (row, i, u0 = 0, u1 = 1, v0 = 0, v1 = 1) => {
    const [y, h] = ROWS[row];
    const a = (i * 256 + 2 + u0 * 252) / 2048;
    const b = (i * 256 + 2 + u1 * 252) / 2048;
    return [a, 1 - (y + h - 2 - v0 * (h - 4)) / 1024, b, 1 - (y + 2 + (1 - v1) * (h - 4)) / 1024];
  };
  return { tex: t, uv, misc: { coin: 0, claw: (k) => 1 + (k % 4), prizes: 5, tokens: 6, funland: 7 } };
}

export function createArcade({ G, MATS, baked, model, placed, lights, rooms, C }) {
  const A = arcadeAtlas();
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  const basic = (k) => new THREE.MeshBasicMaterial({ map: A.tex, color: new THREE.Color(1, 1, 1).multiplyScalar(k) });
  MATS.arcLit = { m: basic(1.3), S: 1 };
  MATS.arcDim = { m: baked(lam({ map: A.tex, color: '#8a8580' })), S: 1 };
  MATS.arcDead = { m: baked(new THREE.MeshPhongMaterial({ map: A.tex, color: '#141614', specular: '#556', shininess: 70 })), S: 1 };
  MATS.cabBlack = MATS.cabBlack || { m: baked(new THREE.MeshPhongMaterial({ color: '#141317', specular: '#2a2a2a', shininess: 25 })), S: 1 };
  MATS.tmold = MATS.tmold || { m: baked(new THREE.MeshPhongMaterial({ color: '#9a9aa2', specular: '#888', shininess: 60 })), S: 1 };
  MATS.clawRed = MATS.clawRed || { m: baked(new THREE.MeshPhongMaterial({ color: '#9c1f2a', specular: '#555', shininess: 50 })), S: 1 };
  MATS.clawBlue = MATS.clawBlue || { m: baked(new THREE.MeshPhongMaterial({ color: '#1d3f8a', specular: '#555', shininess: 50 })), S: 1 };
  MATS.knob = MATS.knob || { m: baked(lam({ color: '#c41a1a' })), S: 1 };
  MATS.knob2 = MATS.knob2 || { m: baked(lam({ color: '#e8c21a' })), S: 1 };
  const PI = Math.PI;

  // le repère d'un meuble : +x sa largeur, +z son avant, posé en (it.x, it.z) et tourné vers son avant
  const yawOf = (it) => {
    const f = it.face || 1;
    return Math.atan2(it.rot ? f : 0, it.rot ? 0 : f);
  };
  const add = (k, geo, it) => G.add(k, geo.rotateY(yawOf(it)).translate(it.x, 0, it.z));
  const box = (k, it, x0, x1, y0, y1, z0, z1) => add(k, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), it);
  // un quadrilatère texturé : a b c d (bas gauche, bas droite, haut droite, haut gauche), une case [u0, v0, u1, v1]
  const quad = (k, it, uv, a, b, c, d) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
    const [u0, v0, u1, v1] = uv || [0, 0, 1, 1];
    g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
    g.computeVertexNormals();
    add(k, g, it);
  };
  const toWorld = (it, x, z) => {
    const y = yawOf(it);
    return [it.x + x * Math.cos(y) + z * Math.sin(y), it.z - x * Math.sin(y) + z * Math.cos(y)];
  };

  // --- une borne d'arcade (0,8 × 0,9 m, 1,86 m de haut) ---
  // le profil des flancs (z vers l'avant, y vers le haut) : dos, socle, avancée du tableau de commande, écran incliné,
  // fronton en surplomb
  const PROF = [[-0.45, 0], [0.32, 0], [0.32, 0.84], [0.47, 0.9], [0.47, 0.97], [0.2, 1.04], [0.1, 1.58], [0.3, 1.62], [0.32, 1.86], [-0.4, 1.86], [-0.45, 1.8]];
  const shapeOf = (sx) => new THREE.Shape(PROF.map(([z, y]) => new THREE.Vector2(sx * z, y)));
  const sideFace = (left) => {
    const g = new THREE.ShapeGeometry(shapeOf(left ? 1 : -1));
    const p = g.attributes.position;
    const u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) u.setXY(i, (p.getX(i) + 0.47) / 0.94, p.getY(i) / 1.86); // (le décor, à l'endroit des deux côtés)
    g.rotateY(left ? -PI / 2 : PI / 2);
    return g;
  };
  const SIDE_L = sideFace(true);
  const SIDE_R = sideFace(false);
  const EDGE = new THREE.ExtrudeGeometry(shapeOf(1), { depth: 0.02, bevelEnabled: false, curveSegments: 1 }).rotateY(-PI / 2);
  // remet une géométrie modèle dans une case de l'atlas
  const inCell = (geo, uv) => {
    const g = geo.clone();
    const a = g.attributes.uv;
    for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1]));
    return g;
  };

  const cabinet = (it) => {
    const gi = (it.game ?? it.id) % GAMES.length;
    const hw = 0.4;
    const on = !!it.lit;
    // les flancs : la tranche (T-molding) et le décor peint
    for (const s of [-1, 1]) {
      add('tmold', EDGE.clone().translate(s < 0 ? -hw + 0.02 : hw, 0, 0), it);
      add('arcDim', inCell(s < 0 ? SIDE_L : SIDE_R, A.uv('side', gi)).translate(s * (hw + 0.002), 0, 0), it);
    }
    const w = hw - 0.02;
    // le socle et la porte du monnayeur, le dessous et l'avant du tableau de commande
    quad('cabBlack', it, null, [-w, 0, 0.32], [w, 0, 0.32], [w, 0.84, 0.32], [-w, 0.84, 0.32]);
    quad(on ? 'arcLit' : 'arcDim', it, A.uv('misc', A.misc.coin), [-0.16, 0.36, 0.323], [0.16, 0.36, 0.323], [0.16, 0.62, 0.323], [-0.16, 0.62, 0.323]);
    quad('cabBlack', it, null, [-w, 0.84, 0.32], [w, 0.84, 0.32], [w, 0.9, 0.47], [-w, 0.9, 0.47]);
    quad('tmold', it, null, [-w, 0.9, 0.47], [w, 0.9, 0.47], [w, 0.97, 0.47], [-w, 0.97, 0.47]);
    quad('arcDim', it, A.uv('panel', gi), [-w, 0.97, 0.47], [w, 0.97, 0.47], [w, 1.04, 0.2], [-w, 1.04, 0.2]);
    // la manette (une boule rouge sur sa tige) et trois boutons, sur le plan incliné du tableau
    const onPanel = (x, t) => [x, 0.97 + 0.07 * t, 0.47 - 0.27 * t];
    const [jx, jy, jz] = onPanel(-0.18, 0.45);
    const [wx, wz] = toWorld(it, jx, jz);
    G.add('steel', new THREE.CylinderGeometry(0.007, 0.007, 0.07, 4, 1, true).translate(wx, jy + 0.035, wz));
    G.add('knob', new THREE.SphereGeometry(0.022, 7, 5).translate(wx, jy + 0.075, wz));
    for (let b = 0; b < 3; b++) {
      const [bx, by, bz] = onPanel(0.02 + b * 0.075, 0.4 + (b % 2) * 0.12);
      const [ux, uz] = toWorld(it, bx, bz);
      G.add(b === 1 ? 'knob2' : 'knob', new THREE.CylinderGeometry(0.016, 0.016, 0.018, 7).translate(ux, by + 0.008, uz));
    }
    // l'écran : le cadre noir, le tube (allumé : le jeu en démonstration ; éteint : un verre sombre qui reflète)
    quad('cabBlack', it, null, [-w, 1.04, 0.2], [w, 1.04, 0.2], [w, 1.58, 0.1], [-w, 1.58, 0.1]);
    const n = [0, 0.182 * 0.004, 0.983 * 0.004];
    const lerp = (t) => [1.04 + 0.54 * t, 0.2 - 0.1 * t];
    const [y0, z0] = lerp(0.1);
    const [y1, z1] = lerp(0.9);
    quad(on ? 'arcLit' : 'arcDead', it, A.uv('screen', gi), [-0.29, y0 + n[1], z0 + n[2]], [0.29, y0 + n[1], z0 + n[2]], [0.29, y1 + n[1], z1 + n[2]], [-0.29, y1 + n[1], z1 + n[2]]);
    // le fronton, son dessous, le dessus, le dos
    quad('cabBlack', it, null, [w, 1.62, 0.3], [-w, 1.62, 0.3], [-w, 1.58, 0.1], [w, 1.58, 0.1]);
    quad(on ? 'arcLit' : 'arcDim', it, A.uv('marquee', gi), [-w, 1.62, 0.3], [w, 1.62, 0.3], [w, 1.86, 0.32], [-w, 1.86, 0.32]);
    quad('cabBlack', it, null, [-w, 1.86, 0.32], [w, 1.86, 0.32], [w, 1.86, -0.4], [-w, 1.86, -0.4]);
    quad('cabBlack', it, null, [w, 0, -0.45], [-w, 0, -0.45], [-w, 1.8, -0.45], [w, 1.8, -0.45]);
    quad('cabBlack', it, null, [w, 1.8, -0.45], [-w, 1.8, -0.45], [-w, 1.86, -0.4], [w, 1.86, -0.4]);
    // un tabouret devant une borne sur trois
    if (it.id % 3 === 0) {
      const [sx, sz] = toWorld(it, 0.05, 0.95);
      model('metal_stool_02', sx, 0, sz, it.id * 1.7, 1.05);
    }
    if (on) {
      const [lx, lz] = toWorld(it, 0, 0.6);
      const F = toWorld(it, 0, 1);
      const r = rooms[it.room];
      const bx = r ? [r.x0 * C - 0.25, r.z0 * C - 0.25, (r.x1 + 1) * C + 0.25, (r.z1 + 1) * C + 0.25] : null;
      const col = new THREE.Color(GAMES[gi][3]).lerp(new THREE.Color(GAMES[gi][1]), 0.4);
      lights.push({ x: lx, y: 1.3, z: lz, c: [col.r, col.g, col.b], rad: 3.0, nx: F[0] - it.x, nz: F[1] - it.z, box: bx });
    }
  };

  // --- une machine à pince (1 × 1 m) : le meuble laqué, la vitrine, le portique et sa pince, les lots ---
  const LOTS = [['rubber_duck_toy', 1.5, '*'], ['football', 0.8, 'football_inflated'], ['american_football', 0.7, '*'], ['rubber_duck_toy', 1.2, '*']];
  const claw = (it) => {
    const k = it.claw || 0;
    const body = k % 2 ? 'clawBlue' : 'clawRed';
    box(body, it, -0.5, 0.5, 0, 0.86, -0.5, 0.5);
    quad('arcDim', it, A.uv('misc', A.misc.coin), [-0.2, 0.36, 0.502], [0.12, 0.36, 0.502], [0.12, 0.62, 0.502], [-0.2, 0.62, 0.502]);
    box('black', it, 0.18, 0.44, 0.3, 0.62, 0.48, 0.505);
    box('tmold', it, -0.5, 0.5, 0.86, 0.9, -0.5, 0.56);
    // la commande, devant la vitrine
    const [jx, jz] = toWorld(it, -0.25, 0.53);
    G.add('steel', new THREE.CylinderGeometry(0.008, 0.008, 0.08, 4, 1, true).translate(jx, 0.94, jz));
    G.add('knob', new THREE.SphereGeometry(0.024, 7, 5).translate(jx, 0.99, jz));
    // les quatre montants et les vitres
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box('steel', it, sx * 0.5 - 0.025, sx * 0.5 + 0.025, 0.9, 1.98, sz * 0.5 - 0.025, sz * 0.5 + 0.025);
    box('glass', it, -0.475, 0.475, 0.9, 1.98, 0.47, 0.48);
    box('glass', it, -0.475, 0.475, 0.9, 1.98, -0.48, -0.47);
    box('glass', it, -0.48, -0.47, 0.9, 1.98, -0.475, 0.475);
    box('glass', it, 0.47, 0.48, 0.9, 1.98, -0.475, 0.475);
    // le chapiteau et son enseigne
    box(body, it, -0.52, 0.52, 1.98, 2.3, -0.52, 0.52);
    quad(it.id % 3 ? 'arcLit' : 'arcDim', it, A.uv('misc', A.misc.claw(k)), [-0.5, 2.0, 0.523], [0.5, 2.0, 0.523], [0.5, 2.28, 0.523], [-0.5, 2.28, 0.523]);
    // le portique et la pince : un chariot sur deux rails, le câble, trois griffes
    box('steel', it, -0.45, 0.45, 1.9, 1.93, -0.06 + 0.1 * Math.sin(k), 0.06 + 0.1 * Math.sin(k));
    const cx = 0.25 * Math.cos(k * 2.1);
    const cz = 0.1 * Math.sin(k);
    const [wx, wz] = toWorld(it, cx, cz);
    G.add('steel', new THREE.CylinderGeometry(0.004, 0.004, 0.3, 4).translate(wx, 1.75, wz));
    G.add('steel', new THREE.CylinderGeometry(0.035, 0.03, 0.06, 8).translate(wx, 1.58, wz));
    for (let p = 0; p < 3; p++) {
      const a = (p * 2 * PI) / 3;
      G.beam('steel', [wx + Math.cos(a) * 0.02, 1.56, wz + Math.sin(a) * 0.02], [wx + Math.cos(a) * 0.07, 1.46, wz + Math.sin(a) * 0.07], 0.008, 0.008);
    }
    // les lots, en tas sur le fond
    for (let i = 0; i < 3; i++) {
      const [name, s, piece] = LOTS[(k + i) % LOTS.length];
      const [lx, lz] = toWorld(it, -0.25 + i * 0.22, -0.15 + ((i * 7 + k) % 3) * 0.15);
      model(name, lx, 0.9, lz, k * 1.3 + i * 2.1, s, 0, 0, piece);
    }
  };

  // --- le comptoir des lots : une vitrine basse, derrière elle trois étagères chargées contre le mur, l'enseigne ---
  const SHELF = [['rubber_duck_toy', 1.4, '*'], ['football', 0.8, 'football_inflated'], ['american_football', 0.8, '*'], ['rubber_duck_toy', 1.1, '*'], ['gamepad', 1, '*'], ['football', 0.65, 'football_inflated']];
  const prizes = (it) => {
    const hw = it.w / 2;
    box('cabBlack', it, -hw, hw, 0, 0.78, -0.3, 0.4);
    box('tmold', it, -hw, hw, 0.78, 0.8, -0.32, 0.42);
    box('glass', it, -hw + 0.05, hw - 0.05, 0.8, 1.1, 0.36, 0.38);
    box('glass', it, -hw + 0.05, hw - 0.05, 1.1, 1.11, -0.25, 0.38);
    for (let i = 0; i < 5; i++) {
      const [name, s, piece] = SHELF[i % SHELF.length];
      const [lx, lz] = toWorld(it, -hw + 0.7 + i * ((it.w - 1.4) / 4), 0.08);
      if (name !== 'gamepad') model(name, lx, 0.8, lz, i * 1.9, s * 0.8, 0, 0, piece);
    }
    // les étagères au mur (le mur est 2,2 m derrière le centre du comptoir)
    const zw = -2.2 + 0.2;
    for (const [y, d] of [[0.9, 0.4], [1.45, 0.35], [2.0, 0.3]]) {
      box('wood', it, -hw + 0.3, hw - 0.3, y - 0.03, y, zw - 0.2, zw - 0.2 + d);
      for (let i = 0; i < 7; i++) {
        const [name, s, piece] = SHELF[(i * 3 + Math.round(y * 10)) % SHELF.length];
        if (name === 'gamepad' && i % 3) continue;
        const [lx, lz] = toWorld(it, -hw + 0.6 + i * ((it.w - 1.2) / 6), zw - 0.2 + d / 2);
        model(name, lx, y, lz, i * 2.3 + y, s, 0, 0, piece);
      }
    }
    for (const sx of [-1, 1]) box('steel', it, sx * (hw - 0.3) - 0.02, sx * (hw - 0.3) + 0.02, 0, 2.2, zw - 0.2, zw - 0.17);
    quad('arcLit', it, A.uv('misc', A.misc.prizes), [-1.2, 2.4, zw - 0.18], [1.2, 2.4, zw - 0.18], [1.2, 3.6, zw - 0.18], [-1.2, 3.6, zw - 0.18]);
    const [px, pz] = toWorld(it, 0, zw);
    placed.push([px, pz, hw + 0.3]);
    // la caisse des tickets, au bout du comptoir
    const [rx, rz] = toWorld(it, hw - 0.6, 0.0);
    model('CashRegister_01', rx, 0.8, rz, yawOf(it) + PI);
  };

  // une affiche de jeu (pour les murs de la salle) : sa case
  const poster = (i) => A.uv('poster', i % GAMES.length);
  const sign = (k) => A.uv('misc', A.misc[k]);
  return { cabinet, claw, prizes, poster, sign };
}
