// The Backrooms (Level 17, le Mall) - Les matières du centre commercial : des matières scannées (Poly Haven, CC0 :
// backrooms/tex, voir LICENSE.txt), posées à leur vraie taille et teintées au canvas ; leur relief et leur poli sont
// lus par le matériau cuit (bumpMap, specularMap : voir baked() dans scene.js) :
//  - le sol du mail : un dallage crème posé en diagonale ; le damier des cours du bas ; le grès brun de l'annexe, la terre
//    cuite du food court, le lino du grand magasin, le stratifié des boutiques, la faïence des toilettes ;
//  - l'enduit peint des murs et des piliers (crème, gris, anthracite), les parpaings des couloirs de service, le béton
//    des quais, le crépi des faux plafonds, les rideaux métalliques à lames ;
//  - les moquettes du cinéma (le grain d'une moquette rase, teinté ; les motifs du hall sont tracés à part, à la
//    taille de la salle) ; le rideau à mailles des boutiques fermées, le papier kraft collé derrière une vitrine, le
//    verre des verrières la nuit : dessinés.
// Une photo qui n'arrive pas laisse un aplat de la même couleur.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { paintMarigold } from './mallDoll.js';

const TEX = new URL('../tex/', import.meta.url).href;

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, color = true) {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function loadImage(name) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = TEX + name;
  });
}
// un générateur fixe : les dalles et les taches ne changent pas d'une partie à l'autre
let seed = 17;
const R = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
// du grain : des points clairs et sombres
function grain(g, w, h, n, a, size = 1) {
  for (let i = 0; i < n; i++) {
    const l = R() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${l},${l},${l},${a * R()})`;
    g.fillRect(R() * w, R() * h, size, size);
  }
}
// des taches douces (salissures, usure)
function blotches(g, w, h, n, rgb, aMax, rMin, rMax) {
  for (let i = 0; i < n; i++) {
    const x = R() * w;
    const y = R() * h;
    const r = rMin + R() * (rMax - rMin);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${aMax * R()})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
// une photo étalée sur le canvas, teintée (multiply) et éclaircie ou assombrie
function photo(g, img, w, h, tint, k = 1, alpha = 1) {
  if (!img) return;
  g.save();
  g.globalAlpha = alpha;
  g.drawImage(img, 0, 0, w, h);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = tint;
  g.fillRect(0, 0, w, h);
  g.restore();
  if (k !== 1) {
    g.save();
    g.globalCompositeOperation = k > 1 ? 'screen' : 'multiply';
    const v = k > 1 ? Math.round((k - 1) * 255) : Math.round(k * 255);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(0, 0, w, h);
    g.restore();
  }
}

// une photo étalée sur le canvas, ramenée d'une teinte moyenne (mean) à une autre (to), canal par canal : son grain
// reste, plus sombre (multiply) ou plus clair (color-dodge : dst / (1 - src))
function retint(g, img, w, h, mean, to) {
  if (!img) return;
  const gain = to.map((v, i) => v / mean[i]);
  g.save();
  g.drawImage(img, 0, 0, w, h);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = `rgb(${gain.map((k) => Math.round(Math.min(1, k) * 255)).join(',')})`;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'color-dodge';
  g.fillStyle = `rgb(${gain.map((k) => Math.round((1 - 1 / Math.max(1, k)) * 255)).join(',')})`;
  g.fillRect(0, 0, w, h);
  g.restore();
}

// 3. Une moquette (photo de moquette rase, teintée)
function drawCarpet(g, S, img, base, tint) {
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  if (img) photo(g, img, S, S, tint, 1, 1);
  seed = 303;
  grain(g, S, S, 14000, 0.1, 1);
  blotches(g, S, S, 8, '0,0,0', 0.12, S * 0.1, S * 0.3);
}

// 7. Le rideau à mailles (une répétition = 50 cm) : des maillons en quinconce, du vide entre eux (alpha)
function drawGrille(g, S) {
  // un rideau à mailles : des joncs d'aluminium horizontaux (tous les 8 cm sur un carreau d'un mètre), reliés par des
  // maillons verticaux en quinconce (tous les 25 cm). Des traits épais : de loin, la grille se fond en un voile au lieu
  // de scintiller
  g.clearRect(0, 0, S, S);
  const rows = 12;
  const h = S / rows;
  const t = Math.max(3, S / 96);
  for (let j = 0; j < rows; j++) {
    const y = j * h + h / 2;
    g.fillStyle = '#d2d0ca';
    g.fillRect(0, y - t / 2, S, t);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, y - t / 2, S, t * 0.3);
    g.fillStyle = '#b9b7b0';
    for (let i = 0; i < 4; i++) {
      const x = ((i + (j % 2 ? 0.5 : 0)) * S) / 4;
      g.fillRect(x - t * 0.45, y, t * 0.9, h);
      if (x < t) g.fillRect(x + S - t * 0.45, y, t * 0.9, h);
    }
  }
}

// 8. Le papier kraft collé derrière une vitrine (une répétition = 2,5 m) : des lés, du ruban adhésif, des déchirures
function drawPaper(g, S) {
  seed = 808;
  g.fillStyle = '#8a6f4e';
  g.fillRect(0, 0, S, S);
  const n = 3;
  for (let i = 0; i < n; i++) {
    const v = 0.9 + R() * 0.2;
    g.fillStyle = `rgb(${Math.round(150 * v)},${Math.round(118 * v)},${Math.round(80 * v)})`;
    g.fillRect((i * S) / n + 2, 0, S / n - 4, S);
  }
  grain(g, S, S, 12000, 0.12, 1);
  blotches(g, S, S, 12, '60,40,20', 0.2, S * 0.03, S * 0.12);
  // le ruban adhésif, jauni
  g.fillStyle = 'rgba(222,200,140,0.55)';
  for (let i = 0; i < 10; i++) {
    g.save();
    g.translate(R() * S, R() * S);
    g.rotate((R() - 0.5) * 0.6);
    g.fillRect(-S * 0.04, -S * 0.012, S * 0.08, S * 0.024);
    g.restore();
  }
  // des déchirures : on voit le noir de la boutique derrière
  g.fillStyle = '#0c0a08';
  for (let i = 0; i < 4; i++) {
    const x = R() * S;
    const y = R() * S;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 7; k++) g.lineTo(x + (R() - 0.3) * S * 0.08, y + (R() - 0.3) * S * 0.08);
    g.fill();
  }
}

// 9. Le verre d'une verrière la nuit : un ciel noir bleuté, la crasse et la mousse dans les coins
function drawSkyGlass(g, S) {
  seed = 909;
  const gr = g.createLinearGradient(0, 0, S, S);
  gr.addColorStop(0, '#0b1018');
  gr.addColorStop(1, '#141a24');
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  blotches(g, S, S, 18, '60,70,60', 0.35, S * 0.05, S * 0.2);
  grain(g, S, S, 4000, 0.15, 1.5);
  // les feuilles mortes et la crasse au bas des vitres
  g.fillStyle = 'rgba(40,34,24,0.7)';
  for (let i = 0; i < 40; i++) g.fillRect(R() * S, S - R() * S * 0.12, 3 + R() * 10, 2 + R() * 5);
}

// 10. Le motif de la moquette du hall du cinéma, à la taille de la salle (w × h mètres, 32 px par mètre) : un fond
// violet, des grandes formes bleu canard, des filets orange qui courent entre elles, un disque bordeaux cerclé d'orange
// autour de chaque pilier rond (holes : [x, z, r] en mètres depuis le coin de la salle)
export function cinemaCarpet(w, h, discs, img) {
  const PX = 32;
  const [c, g] = canvas(Math.ceil(w * PX), Math.ceil(h * PX));
  seed = 1010;
  // (comme au multiplexe de référence) un violet vif ; de grandes plages bleu canard ; autour d'un pilier sur deux, une
  // île bordeaux cerclée d'orange ; des chemins orange qui relient les îles ; des formes rouge orangé sur les bords
  g.fillStyle = '#8a3ec4';
  g.fillRect(0, 0, c.width, c.height);
  const poly = (pts, fill, round = 0.9) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * PX, y * PX) : g.moveTo(x * PX, y * PX)));
    g.closePath();
    g.fillStyle = fill;
    g.strokeStyle = fill;
    g.lineJoin = 'round';
    g.lineWidth = round * PX;
    g.fill();
    g.stroke();
  };
  const isles = discs.filter((d, i) => d[0] > 0 && d[0] < w && d[1] > 0 && d[1] < h && i % 2 === 0);
  const clear = (x, y, r) => isles.every((d) => Math.hypot(d[0] - x, d[1] - y) > d[2] + r);
  // les plages bleu canard : des quadrilatères en biais, hors des îles
  for (let i = 0, n = 0; i < 40 && n < 4; i++) {
    const cx = 4 + R() * (w - 8);
    const cy = 4 + R() * (h - 8);
    const rx = 3.5 + R() * 3.5;
    const ry = 2 + R() * 2;
    if (!clear(cx, cy, Math.max(rx, ry) + 0.6)) continue;
    const sk = (R() - 0.5) * 3;
    poly([[cx - rx + sk, cy - ry], [cx + rx + sk, cy - ry + (R() - 0.5)], [cx + rx - sk, cy + ry], [cx - rx - sk, cy + ry + (R() - 0.5)]], '#1f8a96', 0.5);
    n++;
  }
  // les formes rouge orangé, à cheval sur les bords de la salle
  for (const [cx, cy, rx, ry] of [[w * 0.22, h, 5.5, 2.6], [w * 0.8, 0, 4.5, 2.2], [0, h * 0.45, 2.4, 4.2]]) poly([[cx - rx, cy - ry], [cx + rx * 0.7, cy - ry], [cx + rx, cy + ry * 0.2], [cx + rx * 0.5, cy + ry], [cx - rx, cy + ry]], '#c8442a', 1.6);
  // les chemins orange : d'une île à la suivante, et de chaque île vers le mur le plus proche
  g.strokeStyle = '#e8762a';
  g.lineWidth = 0.34 * PX;
  g.lineCap = 'round';
  const path = (ax, ay, bx, by, bend) => {
    g.beginPath();
    g.moveTo(ax * PX, ay * PX);
    g.quadraticCurveTo(((ax + bx) / 2 - (by - ay) * bend) * PX, ((ay + by) / 2 + (bx - ax) * bend) * PX, bx * PX, by * PX);
    g.stroke();
  };
  for (let i = 0; i < isles.length; i++) {
    const a = isles[i];
    const b = isles[(i + 1) % isles.length];
    if (isles.length > 1 && i < isles.length - 1) path(a[0], a[1], b[0], b[1], (i % 2 ? 1 : -1) * 0.18);
    path(a[0], a[1], a[0] + (R() - 0.5) * 8, a[1] < h / 2 ? 0 : h, 0.08);
  }
  // les îles : un disque bordeaux, son large cerne orange
  for (const [x, y, r] of isles) {
    g.beginPath();
    g.arc(x * PX, y * PX, r * PX, 0, 7);
    g.fillStyle = '#7a1f2c';
    g.fill();
    g.strokeStyle = '#e8762a';
    g.lineWidth = 0.34 * PX;
    g.stroke();
  }
  // les poils : la photo de moquette en surimpression, et l'usure des passages
  if (img) {
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.5;
    const s = 1.2 * PX; // une répétition de la photo : 1,20 m
    for (let y = 0; y < c.height; y += s) for (let x = 0; x < c.width; x += s) g.drawImage(img, x, y, s, s);
    g.restore();
  }
  grain(g, c.width, c.height, Math.round(c.width * c.height * 0.02), 0.12, 1);
  blotches(g, c.width, c.height, 30, '20,0,30', 0.18, PX * 0.6, PX * 3);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// la moquette de la salle de jeux : des confettis fluo sur un fond bleu nuit (le motif se raccorde d'un carreau à l'autre)
function drawConfetti(g, S) {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const COLS = ['#ff3d8f', '#22d3c5', '#ffd23a', '#7c5cff', '#ff7a2a', '#39d86a'];
  for (let i = 0; i < 70; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const a = rnd() * 6.28;
    const kind = Math.floor(rnd() * 4);
    const col = COLS[Math.floor(rnd() * COLS.length)];
    const sz = 9 + rnd() * 13;
    for (const ox of [-S, 0, S])
      for (const oy of [-S, 0, S]) {
        g.save();
        g.translate(x + ox, y + oy);
        g.rotate(a);
        g.strokeStyle = col;
        g.fillStyle = col;
        g.lineWidth = 3.2;
        g.lineCap = 'round';
        g.globalAlpha = 0.82;
        g.beginPath();
        if (kind === 0) {
          // un zigzag
          g.moveTo(-sz, 0);
          for (let k = 1; k <= 4; k++) g.lineTo(-sz + (k * sz) / 2, k % 2 ? -sz * 0.35 : sz * 0.35);
          g.stroke();
        } else if (kind === 1) {
          // un triangle
          g.moveTo(0, -sz * 0.6);
          g.lineTo(sz * 0.6, sz * 0.5);
          g.lineTo(-sz * 0.6, sz * 0.5);
          g.closePath();
          g.stroke();
        } else if (kind === 2) {
          // une virgule
          g.arc(0, 0, sz * 0.6, 0.3, 3.6);
          g.stroke();
        } else {
          // un confetti
          g.fillRect(-sz * 0.45, -2.5, sz * 0.9, 5);
        }
        g.restore();
      }
  }
}

export function createMallTextures() {
  const S = 1024;
  const mk = (size = S) => canvas(size, size);
  const out = {};
  // un aplat, en attendant la photo
  const flat = (rgb, size = S) => {
    const [c, g] = mk(size);
    g.fillStyle = `rgb(${rgb})`;
    g.fillRect(0, 0, size, size);
    return [c, g];
  };
  // une carte en gris (le relief ou le poli d'une matière scannée), lue telle quelle
  const tl = new THREE.TextureLoader();
  const grey = (file) => {
    const t = tl.load(TEX + file);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  };
  const [tc, tg] = flat('222,212,192');
  out.terrazzo = tex(tc);
  out.terrazzoGloss = grey('l17_dallage_lisse.jpg');
  const [cc, cg] = flat('120,108,98');
  out.checker = tex(cc);
  out.checkerGloss = grey('l17_damier_lisse.jpg');
  const [vc, vg] = mk(512);
  drawCarpet(vg, 512, null, '#6a2f8e', '#8e48b8');
  out.carpetViolet = tex(vc);
  const [fc, fg] = mk(512);
  drawCarpet(fg, 512, null, '#1b1634', '#2a2350');
  drawConfetti(fg, 512);
  out.carpetArcade = tex(fc);
  const [dc, dg] = mk(512);
  drawCarpet(dg, 512, null, '#33343a', '#55565e');
  out.carpetDark = tex(dc);
  // l'enduit peint : une seule photo, quatre teintes (crème, gris clair, anthracite du cinéma, anthracite clair)
  const PLASTER = { plaster: '230,225,213', paintDark: '58,59,64', paintChar: '104,106,116', paintGrey: '196,192,180' };
  const plasterG = {};
  for (const k in PLASTER) {
    const [c, g] = flat(PLASTER[k]);
    plasterG[k] = g;
    out[k] = tex(c);
  }
  out.plasterRelief = grey('l17_enduit_relief.jpg');
  // les bannières de toile de la cour ouest : deux visuels côte à côte (256 × 1024 chacun)
  {
    const [bc, bg] = canvas(512, 1024);
    const ink = [['#a8322c', '#f2e6c8', '#e0a43a'], ['#1f5c6b', '#f2e6c8', '#d9652e']];
    for (let i = 0; i < 2; i++) {
      const x = i * 256;
      const [bgc, fg, ac] = ink[i];
      bg.fillStyle = bgc;
      bg.fillRect(x, 0, 256, 1024);
      // des aplats en éventail, façon affiche de fête
      for (let k = 0; k < 9; k++) {
        bg.fillStyle = k % 2 ? ac : fg;
        bg.globalAlpha = 0.9;
        bg.beginPath();
        bg.moveTo(x + 128, 300);
        bg.arc(x + 128, 300, 150, Math.PI * (1 + k / 9), Math.PI * (1 + (k + 0.62) / 9));
        bg.closePath();
        bg.fill();
      }
      bg.globalAlpha = 1;
      bg.fillStyle = bgc;
      bg.beginPath();
      bg.arc(x + 128, 300, 52, 0, 7);
      bg.fill();
      bg.fillStyle = fg;
      bg.textAlign = 'center';
      bg.font = 'bold 30px Georgia, serif';
      bg.fillText(i ? 'HALCYON PARK' : 'SPRING', x + 128, 96);
      bg.font = 'bold 44px Georgia, serif';
      bg.fillText(i ? 'ARTS' : 'FAIR', x + 128, 420);
      bg.fillText(i ? 'WALK' : '1994', x + 128, 470);
      // le reste du texte, à la verticale ; sur la bannière de la foire, la mascotte du centre : Miss Marigold
      if (i) {
        bg.save();
        bg.translate(x + 128, 740);
        bg.rotate(-Math.PI / 2);
        bg.font = 'bold 64px Georgia, serif';
        bg.fillStyle = ac;
        bg.fillText('GALLERY', 0, 22);
        bg.restore();
      } else {
        bg.fillStyle = 'rgba(242,230,200,0.16)';
        bg.beginPath();
        bg.ellipse(x + 128, 760, 104, 190, 0, 0, 7);
        bg.fill();
        paintMarigold(bg, x + 128, 946, 400);
      }
      bg.fillStyle = fg;
      bg.fillRect(x + 28, 520, 200, 5);
      bg.fillRect(x + 28, 960, 200, 5);
      bg.font = i ? '20px Georgia, serif' : 'bold 21px Georgia, serif';
      bg.fillText(i ? 'UPPER LEVEL · WEST COURT' : 'MEET MISS MARIGOLD', x + 128, 1000);
    }
    // la toile passée : des plis en long, des auréoles
    for (let k = 0; k < 40; k++) {
      bg.fillStyle = k % 2 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
      bg.fillRect(R() * 512, 0, 3 + R() * 10, 1024);
    }
    blotches(bg, 512, 1024, 26, '60,40,20', 0.16, 20, 110);
    out.banner = tex(bc);
    out.banner.wrapS = out.banner.wrapT = THREE.ClampToEdgeWrapping;
  }
  const [lc, lg] = flat('150,140,120');
  out.lino = tex(lc);
  out.linoGloss = grey('l17_lino_lisse.jpg');
  const [qc, qg] = flat('150,84,56');
  out.quarry = tex(qc);
  out.quarryRelief = grey('l17_carrelage_use_relief.jpg');
  out.quarryGloss = grey('l17_carrelage_use_lisse.jpg');
  // le carrelage de l'annexe : un grès brun
  const [anC, anG] = flat('138,106,72');
  out.annexTile = tex(anC);
  out.annexRelief = grey('l17_carrelage_brun_relief.jpg');
  out.annexGloss = grey('l17_carrelage_brun_lisse.jpg');
  // le stratifié des boutiques
  const [laC, laG] = flat('168,138,100');
  out.laminate = tex(laC);
  out.laminateGloss = grey('l17_stratifie_lisse.jpg');
  const [gc, gg] = mk(512);
  drawGrille(gg, 512);
  out.grille = tex(gc);
  // la couche technique des plafonds : à gauche une bouche de soufflage (quatre directions), à droite une grille de
  // reprise (un nid d'abeilles carré)
  {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#e9e7e0';
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#8f8d86';
    for (let k = 0; k < 5; k++) {
      const m = 6 + k * 11;
      g.lineWidth = 3;
      g.strokeRect(m, m, 128 - 2 * m, 128 - 2 * m);
    }
    g.strokeStyle = '#c9c7c0';
    g.lineWidth = 2;
    for (const [x0, y0, x1, y1] of [[0, 0, 64, 64], [128, 0, 64, 64], [0, 128, 64, 64], [128, 128, 64, 64]]) {
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    }
    g.fillStyle = '#bdbbb4';
    g.fillRect(56, 56, 16, 16);
    g.fillStyle = '#34322e';
    g.fillRect(134, 6, 116, 116);
    g.strokeStyle = '#d8d6cf';
    g.lineWidth = 2;
    for (let k = 0; k <= 9; k++) {
      const v = 134 + (116 * k) / 9;
      g.beginPath();
      g.moveTo(v, 6);
      g.lineTo(v, 122);
      g.moveTo(134, 6 + (116 * k) / 9);
      g.lineTo(250, 6 + (116 * k) / 9);
      g.stroke();
    }
    g.lineWidth = 5;
    g.strokeStyle = '#e9e7e0';
    g.strokeRect(131, 3, 122, 122);
    out.ceilKit = tex(c);
  }
  const [kc, kg] = mk(512);
  drawPaper(kg, 512);
  out.paper = tex(kc);
  const [sc, sg] = mk(512);
  drawSkyGlass(sg, 512);
  out.skyGlass = tex(sc);
  // les photos : dalles de plafond, parpaings, béton, faïence, noyer (recolorées une fois arrivées)
  const [ceC, ceG] = flat('206,200,186');
  out.ceilTiles = tex(ceC);
  const [blC, blG] = flat('178,172,160');
  out.block = tex(blC);
  out.blockRelief = grey('l17_parpaing_relief.jpg');
  const [coC, coG] = flat('128,124,118');
  out.concrete = tex(coC);
  const [faC, faG] = flat('214,210,196');
  out.faience = tex(faC);
  out.faienceRelief = grey('l17_faience_relief.jpg');
  const [woC, woG] = flat('90,58,36', 512);
  out.wood = tex(woC);
  const [slC, slG] = flat('70,70,72');
  out.slab = tex(slC);
  // les photos en 1024 px : le velours des fauteuils, le rideau métallique des kiosques, la tôle larmée des paliers
  const [veC, veG] = flat('110,24,30');
  out.velvet = tex(veC);
  // les rideaux métalliques à lames : gris clair (les kiosques, les stands), beige (les boutiques fermées)
  const [ruC, ruG] = flat('150,150,146');
  out.shutter = tex(ruC);
  out.shutterRelief = grey('l17_rideau_relief.jpg');
  const [rbC, rbG] = flat('160,140,110');
  out.shutterBeige = tex(rbC);
  out.shutterBeigeRelief = grey('l17_rideau_beige_relief.jpg');
  const [toC, toG] = flat('120,122,124');
  out.plate = tex(toC);
  // le contreplaqué des palissades de chantier (les escalators condamnés)
  const [cpC, cpG] = flat('176,142,98');
  out.plywood = tex(cpC);
  out.carpetImg = null;
  const files = ['moquette_rase.jpg', 'plafond.jpg', 'l17_parpaing.jpg', 'l17_beton.jpg', 'l17_faience.jpg', 'l5_noyer.jpg', 'l1_plafond.jpg', 'l17_lino.jpg', 'l5_velours.jpg', 'l17_rideau.jpg', 'l17_tole.jpg', 'l17_carrelage_brun.jpg', 'l17_carrelage_use.jpg', 'l17_dallage.jpg', 'l17_damier.jpg', 'l17_enduit.jpg', 'l17_stratifie.jpg', 'l17_rideau_beige.jpg', 'l17_contreplaque.jpg'];
  out.ready = Promise.all(files.map(loadImage)).then(([moq, pla, mur, sol, fai, noy, dal, lin, vel, rid, tol, cab, cau, mar, dam, end, str, rib, ply]) => {
    if (ply) {
      retint(cpG, ply, S, S, [126, 97, 65], [196, 164, 118]); // (un contreplaqué de chantier : clair, blond)
      out.plywood.needsUpdate = true;
    }
    // le dallage crème du mail, posé en diagonale (éclairci : un ivoire), le damier des cours du bas
    if (mar) {
      retint(tg, mar, S, S, [170, 152, 132], [206, 196, 178]);
      out.terrazzo.needsUpdate = true;
    }
    if (dam) {
      photo(cg, dam, S, S, 'rgb(255,248,236)', 1.06);
      out.checker.needsUpdate = true;
    }
    if (str) {
      photo(laG, str, S, S, 'rgb(236,214,190)');
      out.laminate.needsUpdate = true;
    }
    if (rib) {
      photo(rbG, rib, S, S, 'rgb(236,230,214)', 1.05);
      out.shutterBeige.needsUpdate = true;
    }
    // l'enduit peint : le grain de la photo, ramené à la teinte voulue (sa moyenne est un gris rosé : 171, 163, 160)
    if (end)
      for (const k in PLASTER) {
        retint(plasterG[k], end, S, S, [171, 163, 160], PLASTER[k].split(',').map(Number));
        out[k].needsUpdate = true;
      }
    // les carrelages photographiés : le grès brun de l'annexe, la terre cuite usée du food court et de la jardinerie
    if (cab) {
      photo(anG, cab, S, S, 'rgb(232,222,204)', 1.04);
      out.annexTile.needsUpdate = true;
    }
    if (cau) {
      photo(qg, cau, S, S, 'rgb(255,236,214)', 1.22);
      out.quarry.needsUpdate = true;
    }
    if (lin) {
      photo(lg, lin, S, S, 'rgb(236,228,206)');
      out.lino.needsUpdate = true;
    }
    if (vel) {
      photo(veG, vel, S, S, 'rgb(150,40,46)', 1.05);
      out.velvet.needsUpdate = true;
    }
    if (rid) {
      photo(ruG, rid, S, S, 'rgb(214,212,206)');
      out.shutter.needsUpdate = true;
    }
    if (tol) {
      photo(toG, tol, S, S, 'rgb(205,208,212)', 1.1);
      out.plate.needsUpdate = true;
    }
    drawCarpet(vg, 512, moq, '#7634aa', '#a055d0');
    out.carpetViolet.needsUpdate = true;
    drawCarpet(dg, 512, moq, '#2e2f35', '#5a5b63');
    out.carpetDark.needsUpdate = true;
    if (pla) {
      retint(ceG, pla, S, S, [124, 110, 101], [200, 195, 182]); // (des dalles de fibre minérale blanc cassé)
      // la trame du faux plafond : des profilés en T laqués blanc, toutes les 62,5 cm (décalés d'une demi-dalle : les
      // luminaires, posés sur la trame des salles, tombent au milieu d'une dalle), leur ombre portée d'un côté
      const T = S / 4;
      for (let i = 0; i < 4; i++) {
        const p = (i + 0.5) * T;
        ceG.fillStyle = 'rgba(40,36,30,0.3)';
        ceG.fillRect(p + 5, 0, 3, S);
        ceG.fillRect(0, p + 5, S, 3);
        ceG.fillStyle = '#d6d2c6';
        ceG.fillRect(p - 5, 0, 10, S);
        ceG.fillRect(0, p - 5, S, 10);
      }
      out.ceilTiles.needsUpdate = true;
    }
    if (mur) {
      photo(blG, mur, S, S, 'rgb(232,226,212)', 1.15);
      out.block.needsUpdate = true;
    }
    if (sol) {
      photo(coG, sol, S, S, 'rgb(196,192,184)');
      out.concrete.needsUpdate = true;
    }
    if (fai) {
      photo(faG, fai, S, S, 'rgb(240,236,222)');
      out.faience.needsUpdate = true;
    }
    if (noy) {
      photo(woG, noy, 512, 512, 'rgb(190,150,120)');
      out.wood.needsUpdate = true;
    }
    if (dal) {
      photo(slG, dal, S, S, 'rgb(120,118,116)');
      out.slab.needsUpdate = true;
    }
    out.carpetImg = moq;
  });
  return out;
}
