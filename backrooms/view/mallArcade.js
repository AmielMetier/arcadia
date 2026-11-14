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

export function createArcade({ MATS, baked }) {
  const A = arcadeAtlas();
  // (les bornes et les machines à pince ne sont plus posées : il n'en existe pas de modèle scanné. La salle garde son
  // enseigne et ses affiches de jeux, éteintes)
  MATS.arcLit = { m: new THREE.MeshBasicMaterial({ map: A.tex, color: new THREE.Color(1, 1, 1).multiplyScalar(1.3) }), S: 1 };
  MATS.arcDim = { m: baked(new THREE.MeshLambertMaterial({ map: A.tex, color: '#8a8580' })), S: 1 };

  // une affiche de jeu (pour les murs de la salle) : sa case
  const poster = (i) => A.uv('poster', i % GAMES.length);
  const sign = (k) => A.uv('misc', A.misc[k]);
  return { poster, sign };
}
