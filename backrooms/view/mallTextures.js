// The Backrooms (Level 17, le Mall) - Les matières du centre commercial, dessinées au canvas sur les photos CC0 déjà
// utilisées par les autres levels (backrooms/tex, voir LICENSE.txt) :
//  - le sol poli du mail : des dalles crème de 60 cm (le marbre blanc de l'hôtel, recoloré), joints fins, un cabochon
//    noir en losange à un croisement sur deux ; le damier noir et blanc des cours du bas ;
//  - les moquettes du cinéma : violette (le hall, ses motifs sont tracés à part, à la taille de la salle) et anthracite ;
//  - l'enduit crème des murs et des piliers, la peinture anthracite du cinéma, les parpaings des couloirs de service,
//    le béton des quais, les dalles de faux plafond, la faïence des toilettes, le lino du grand magasin, les tomettes du
//    food court ; le rideau à mailles des boutiques fermées (transparent entre les maillons), le papier kraft collé
//    derrière une vitrine, le verre des verrières la nuit.
// Une photo qui n'arrive pas laisse la version dessinée (même couleur, sans le grain).
import * as THREE from '../../shared/vendor/three/three.module.min.js';

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

// 1. Le sol poli du mail : 4 × 4 dalles de 60 cm (une répétition = 2,40 m)
function drawTerrazzo(g, S, marble, dark) {
  const T = S / 4;
  seed = 101;
  g.fillStyle = '#d6cab2';
  g.fillRect(0, 0, S, S);
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 4; i++) {
      g.save();
      g.beginPath();
      g.rect(i * T, j * T, T, T);
      g.clip();
      if (marble) {
        // chaque dalle prend un morceau différent de la photo, tourné : pas deux pareilles côte à côte
        g.translate(i * T + T / 2, j * T + T / 2);
        g.rotate((Math.floor(R() * 4) * Math.PI) / 2);
        const sx = R() * (marble.width - marble.width / 2);
        const sy = R() * (marble.height - marble.height / 2);
        g.globalAlpha = 0.55;
        g.drawImage(marble, sx, sy, marble.width / 2, marble.height / 2, -T / 2, -T / 2, T, T);
        g.setTransform(1, 0, 0, 1, 0, 0);
      }
      // la teinte crème, un peu différente d'une dalle à l'autre
      const t = 0.94 + R() * 0.08;
      g.globalAlpha = 0.5;
      g.fillStyle = `rgb(${Math.round(214 * t)},${Math.round(202 * t)},${Math.round(178 * t)})`;
      g.fillRect(i * T, j * T, T, T);
      g.restore();
    }
  seed = 7;
  grain(g, S, S, 9000, 0.12, 1.5);
  // le terrazzo : de petits éclats de pierre
  for (let i = 0; i < 2600; i++) {
    const v = 90 + R() * 120;
    g.fillStyle = `rgba(${v},${v * 0.95},${v * 0.86},${0.25 + R() * 0.3})`;
    g.beginPath();
    g.arc(R() * S, R() * S, 0.6 + R() * 1.6, 0, 7);
    g.fill();
  }
  // les joints (2 mm de ciment gris), un peu plus sombres là où passent les chariots
  g.strokeStyle = 'rgba(120,110,95,0.55)';
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo(i * T, 0);
    g.lineTo(i * T, S);
    g.moveTo(0, i * T);
    g.lineTo(S, i * T);
    g.stroke();
  }
  // un cabochon noir en losange (10 cm) à un croisement sur deux
  const cab = S * (0.1 / 2.4);
  for (let j = 0; j <= 4; j++)
    for (let i = 0; i <= 4; i++) {
      if ((i + j) % 2) continue;
      g.save();
      g.translate(i * T, j * T);
      g.rotate(Math.PI / 4);
      if (dark) {
        g.beginPath();
        g.rect(-cab / 2, -cab / 2, cab, cab);
        g.clip();
        g.drawImage(dark, R() * dark.width * 0.8, R() * dark.height * 0.8, dark.width * 0.1, dark.height * 0.1, -cab / 2, -cab / 2, cab, cab);
        g.fillStyle = 'rgba(20,18,16,0.55)';
        g.fillRect(-cab / 2, -cab / 2, cab, cab);
      } else {
        g.fillStyle = '#1d1a17';
        g.fillRect(-cab / 2, -cab / 2, cab, cab);
      }
      g.restore();
    }
  // l'usure : des voiles plus mats, quelques salissures
  blotches(g, S, S, 14, '90,80,62', 0.12, S * 0.05, S * 0.18);
}

// 2. Le damier des cours du bas : 4 × 4 carreaux de 60 cm, marbre blanc et noir
function drawChecker(g, S, white, black) {
  const T = S / 4;
  seed = 202;
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 4; i++) {
      const dk = (i + j) % 2 === 1;
      g.fillStyle = dk ? '#2a2622' : '#d9cfbd';
      g.fillRect(i * T, j * T, T, T);
      const img = dk ? black : white;
      if (img) {
        g.save();
        g.globalAlpha = 0.7;
        g.drawImage(img, R() * img.width * 0.5, R() * img.height * 0.5, img.width / 2, img.height / 2, i * T, j * T, T, T);
        g.restore();
        g.fillStyle = dk ? 'rgba(40,34,28,0.35)' : 'rgba(220,206,180,0.35)';
        g.fillRect(i * T, j * T, T, T);
      }
    }
  grain(g, S, S, 6000, 0.1, 1.5);
  g.strokeStyle = 'rgba(110,100,88,0.6)';
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo(i * T, 0);
    g.lineTo(i * T, S);
    g.moveTo(0, i * T);
    g.lineTo(S, i * T);
    g.stroke();
  }
  blotches(g, S, S, 10, '70,60,50', 0.12, S * 0.05, S * 0.2);
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

// 4. L'enduit des murs (une répétition = 2,5 m)
function drawPlaster(g, S, rgb, img) {
  g.fillStyle = `rgb(${rgb})`;
  g.fillRect(0, 0, S, S);
  if (img) {
    g.save();
    g.globalAlpha = 0.18;
    g.drawImage(img, 0, 0, S, S);
    g.restore();
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = `rgb(${rgb})`;
    g.fillRect(0, 0, S, S);
    g.restore();
  }
  seed = 404;
  blotches(g, S, S, 30, '120,105,80', 0.07, S * 0.04, S * 0.16);
  blotches(g, S, S, 20, '255,250,235', 0.06, S * 0.04, S * 0.14);
  grain(g, S, S, 7000, 0.06, 1);
}

// 5. Le lino du grand magasin : 8 × 8 dalles de 30 cm, deux tons, mouchetées
function drawLino(g, S) {
  const T = S / 8;
  seed = 505;
  for (let j = 0; j < 8; j++)
    for (let i = 0; i < 8; i++) {
      const v = (i + j) % 2 ? 196 : 206;
      const d = (R() - 0.5) * 8;
      g.fillStyle = `rgb(${v + d},${v + d - 4},${v + d - 12})`;
      g.fillRect(i * T, j * T, T, T);
    }
  for (let i = 0; i < 9000; i++) {
    const v = R() < 0.5 ? 120 + R() * 40 : 230;
    g.fillStyle = `rgba(${v},${v - 6},${v - 14},0.5)`;
    g.fillRect(R() * S, R() * S, 1 + R() * 2, 1 + R() * 2);
  }
  g.strokeStyle = 'rgba(90,85,75,0.35)';
  g.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    g.beginPath();
    g.moveTo(i * T, 0);
    g.lineTo(i * T, S);
    g.moveTo(0, i * T);
    g.lineTo(S, i * T);
    g.stroke();
  }
  blotches(g, S, S, 16, '80,70,55', 0.12, S * 0.04, S * 0.16);
}

// 6. Les tomettes du food court : 8 × 8 carreaux de 30 cm, terre cuite, joints larges
function drawQuarry(g, S) {
  const T = S / 8;
  seed = 606;
  g.fillStyle = '#7d6a58';
  g.fillRect(0, 0, S, S);
  for (let j = 0; j < 8; j++)
    for (let i = 0; i < 8; i++) {
      const r = 150 + R() * 30;
      g.fillStyle = `rgb(${r},${r * 0.55},${r * 0.38})`;
      g.fillRect(i * T + 3, j * T + 3, T - 6, T - 6);
      blotchesIn(g, i * T + 3, j * T + 3, T - 6);
    }
  grain(g, S, S, 9000, 0.12, 1);
  function blotchesIn(gg, x, y, s) {
    for (let k = 0; k < 3; k++) {
      const cx = x + R() * s;
      const cy = y + R() * s;
      const r = s * (0.2 + R() * 0.4);
      const gr = gg.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, `rgba(60,30,15,${0.15 * R()})`);
      gr.addColorStop(1, 'rgba(60,30,15,0)');
      gg.fillStyle = gr;
      gg.fillRect(x, y, s, s);
    }
  }
}

// 7. Le rideau à mailles (une répétition = 50 cm) : des maillons en quinconce, du vide entre eux (alpha)
function drawGrille(g, S) {
  g.clearRect(0, 0, S, S);
  const nx = 10;
  const ny = 6;
  const w = S / nx;
  const h = S / ny;
  g.strokeStyle = '#d6d4cf';
  g.lineWidth = S / 90;
  g.lineCap = 'round';
  for (let j = 0; j < ny; j++)
    for (let i = 0; i <= nx; i++) {
      const x = i * w + (j % 2 ? w / 2 : 0);
      const y = j * h;
      // un maillon : une barre courte, deux crochets
      g.beginPath();
      g.moveTo(x - w * 0.42, y + h * 0.5);
      g.lineTo(x + w * 0.42, y + h * 0.5);
      g.stroke();
      g.beginPath();
      g.moveTo(x - w * 0.42, y + h * 0.5);
      g.lineTo(x - w * 0.5, y);
      g.moveTo(x + w * 0.42, y + h * 0.5);
      g.lineTo(x + w * 0.5, y + h);
      g.stroke();
    }
  // les tiges verticales
  g.lineWidth = S / 70;
  for (let i = 0; i <= nx; i += 2) {
    g.beginPath();
    g.moveTo(i * w, 0);
    g.lineTo(i * w, S);
    g.stroke();
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
  g.fillStyle = '#6a2f8e';
  g.fillRect(0, 0, c.width, c.height);
  // les grandes formes bleu canard (des polygones aux coins arrondis)
  const shape = (pts, fill, stroke) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * PX, y * PX) : g.moveTo(x * PX, y * PX)));
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = 0.12 * PX;
      g.lineJoin = 'round';
      g.stroke();
    }
  };
  for (let i = 0; i < Math.max(3, Math.round((w * h) / 260)); i++) {
    const cx = R() * w;
    const cy = R() * h;
    const n = 4 + Math.floor(R() * 3);
    const r = 3 + R() * 5;
    const pts = Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2 + R() * 0.6;
      return [cx + Math.cos(a) * r * (0.6 + R() * 0.6), cy + Math.sin(a) * r * (0.6 + R() * 0.6)];
    });
    shape(pts, R() < 0.7 ? '#24808c' : '#b8451e', null);
  }
  // les filets orange : de longues lignes brisées qui traversent la salle
  g.strokeStyle = '#e0641e';
  g.lineWidth = 0.1 * PX;
  for (let i = 0; i < Math.max(4, Math.round(w / 6)); i++) {
    g.beginPath();
    let x = R() * w;
    let y = R() < 0.5 ? 0 : h;
    g.moveTo(x * PX, y * PX);
    for (let k = 0; k < 6; k++) {
      x += (R() - 0.5) * 14;
      y += (y > h / 2 ? -1 : 1) * (2 + R() * 6);
      g.lineTo(x * PX, y * PX);
    }
    g.stroke();
  }
  // un disque bordeaux cerclé d'orange autour des piliers
  for (const [x, y, r] of discs) {
    g.beginPath();
    g.arc(x * PX, y * PX, r * PX, 0, 7);
    g.fillStyle = '#6e1a24';
    g.fill();
    g.strokeStyle = '#e0641e';
    g.lineWidth = 0.14 * PX;
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
  const [tc, tg] = mk();
  drawTerrazzo(tg, S, null, null);
  out.terrazzo = tex(tc);
  const [cc, cg] = mk();
  drawChecker(cg, S, null, null);
  out.checker = tex(cc);
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
  const [pc, pg] = mk(512);
  drawPlaster(pg, 512, '214,203,180', null);
  out.plaster = tex(pc);
  const [ac, ag] = mk(512);
  drawPlaster(ag, 512, '58,59,64', null);
  out.paintDark = tex(ac);
  const [wc, wg] = mk(512);
  drawPlaster(wg, 512, '196,192,180', null);
  out.paintGrey = tex(wc);
  const [lc, lg] = mk();
  drawLino(lg, S);
  out.lino = tex(lc);
  const [qc, qg] = mk();
  drawQuarry(qg, S);
  out.quarry = tex(qc);
  const [gc, gg] = mk(256);
  drawGrille(gg, 256);
  out.grille = tex(gc);
  const [kc, kg] = mk(512);
  drawPaper(kg, 512);
  out.paper = tex(kc);
  const [sc, sg] = mk(512);
  drawSkyGlass(sg, 512);
  out.skyGlass = tex(sc);
  // les photos : dalles de plafond, parpaings, béton, faïence, noyer (recolorées une fois arrivées)
  const blank = (rgb) => {
    const [c, g] = mk(512);
    g.fillStyle = `rgb(${rgb})`;
    g.fillRect(0, 0, 512, 512);
    return [c, g];
  };
  const [ceC, ceG] = blank('206,200,186');
  out.ceilTiles = tex(ceC);
  const [blC, blG] = blank('178,172,160');
  out.block = tex(blC);
  const [coC, coG] = blank('128,124,118');
  out.concrete = tex(coC);
  const [faC, faG] = blank('214,210,196');
  out.faience = tex(faC);
  const [woC, woG] = blank('90,58,36');
  out.wood = tex(woC);
  const [slC, slG] = blank('70,70,72');
  out.slab = tex(slC);
  // les photos en 1024 px : le velours des fauteuils, le rideau métallique des kiosques, la tôle larmée des paliers
  const big = (rgb) => {
    const [c, g] = mk(S);
    g.fillStyle = `rgb(${rgb})`;
    g.fillRect(0, 0, S, S);
    return [c, g];
  };
  const [veC, veG] = big('110,24,30');
  out.velvet = tex(veC);
  const [ruC, ruG] = big('150,150,146');
  out.shutter = tex(ruC);
  const [toC, toG] = big('120,122,124');
  out.plate = tex(toC);
  // les tissus des vêtements (photos Poly Haven, 512 px) : denim, jersey, vichy, jacquard
  const tl = new THREE.TextureLoader();
  out.fabrics = ['l17_denim.jpg', 'l17_jersey.jpg', 'l17_vichy.jpg', 'l17_jacquard.jpg'].map((f) => {
    const t = tl.load(TEX + f);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  });
  out.carpetImg = null;
  const files = ['l5_marbre_blanc.jpg', 'l5_marbre_noir.jpg', 'moquette_rase.jpg', 'plafond.jpg', 'l17_parpaing.jpg', 'l17_beton.jpg', 'l17_faience.jpg', 'l5_noyer.jpg', 'l1_plafond.jpg', 'papier.jpg', 'l17_lino.jpg', 'l5_velours.jpg', 'l17_rideau.jpg', 'l17_tole.jpg'];
  out.ready = Promise.all(files.map(loadImage)).then(([mw, mb, moq, pla, mur, sol, fai, noy, dal, pap, lin, vel, rid, tol]) => {
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
    drawTerrazzo(tg, S, mw, mb);
    out.terrazzo.needsUpdate = true;
    drawChecker(cg, S, mw, mb);
    out.checker.needsUpdate = true;
    drawCarpet(vg, 512, moq, '#6a2f8e', '#9b4fc4');
    out.carpetViolet.needsUpdate = true;
    drawCarpet(dg, 512, moq, '#2e2f35', '#5a5b63');
    out.carpetDark.needsUpdate = true;
    drawPlaster(pg, 512, '214,203,180', pap);
    out.plaster.needsUpdate = true;
    drawPlaster(ag, 512, '58,59,64', pap);
    out.paintDark.needsUpdate = true;
    drawPlaster(wg, 512, '196,192,180', pap);
    out.paintGrey.needsUpdate = true;
    if (pla) {
      photo(ceG, pla, 512, 512, 'rgb(236,232,222)', 1.06);
      out.ceilTiles.needsUpdate = true;
    }
    if (mur) {
      photo(blG, mur, 512, 512, 'rgb(232,226,212)', 1.15);
      out.block.needsUpdate = true;
    }
    if (sol) {
      photo(coG, sol, 512, 512, 'rgb(196,192,184)');
      out.concrete.needsUpdate = true;
    }
    if (fai) {
      photo(faG, fai, 512, 512, 'rgb(240,236,222)');
      out.faience.needsUpdate = true;
    }
    if (noy) {
      photo(woG, noy, 512, 512, 'rgb(190,150,120)');
      out.wood.needsUpdate = true;
    }
    if (dal) {
      photo(slG, dal, 512, 512, 'rgb(120,118,116)');
      out.slab.needsUpdate = true;
    }
    out.carpetImg = moq;
  });
  return out;
}
