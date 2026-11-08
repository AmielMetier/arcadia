// The Backrooms - Textures du Level 0 (moquette, papier peint) et du Level 1 (béton de l'entrepôt)
// Motifs dessinés au canvas, salis par des photos CC0 de Poly Haven dès qu'elles sont chargées :
// backrooms/tex/ pour les deux niveaux (l1_* : parpaings peints, béton usé et dalle brute de l'entrepôt).
import * as THREE from '../../shared/vendor/three/three.module.min.js';

const TEX = new URL('../tex/', import.meta.url).href;
const KART_TEX = new URL('../../kart/tex/', import.meta.url).href;

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

// une toile deux fois plus fine que son dessin (les petites textures : étiquettes, panneaux, cassettes…)
function hd(w, h = w) {
  const [c, ctx] = canvas(w * 2, h * 2);
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  return [c, ctx];
}

function tex(c, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8; // le sol et le plafond restent nets jusqu'au fond des couloirs
  return t;
}

function loadImage(name) {
  return new Promise((resolve) => {
    if (name === 'none') return resolve(null); // pas de photo pour cette surface
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = name.startsWith('kart:') ? KART_TEX + name.slice(5) : TEX + name;
  });
}

function noise(ctx, w, h, amount) {
  // sur toute la toile (elle peut être dessinée à l'échelle 2 : plus de pixels que d'unités de dessin)
  w = ctx.canvas.width;
  h = ctx.canvas.height;
  const d = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d.data[i] += n;
    d.data[i + 1] += n;
    d.data[i + 2] += n;
  }
  ctx.putImageData(d, 0, 0);
}

// Dessins laissés sur les murs par ceux qui sont passés avant toi : 8 cases de 256 px sur 2 rangées.
// Trait tremblé (craie grasse ou feutre), certains à la peinture qui coule.
function drawWallArt(ctx) {
  const shaky = (pts, color, w, close = false) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass ? 0.45 : 0.85;
      ctx.beginPath();
      pts.forEach(([x, y], i) => {
        const jx = x + (Math.random() - 0.5) * 3;
        const jy = y + (Math.random() - 0.5) * 3;
        if (i) ctx.lineTo(jx, jy);
        else ctx.moveTo(jx, jy);
      });
      if (close) ctx.closePath();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  const circle = (cx, cy, r, n = 28) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]);
  const drips = (x0, x1, y, color, n) => {
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const x = x0 + Math.random() * (x1 - x0);
      const len = 10 + Math.random() * 50;
      ctx.fillRect(x, y, 2 + Math.random() * 2, len);
      ctx.beginPath();
      ctx.arc(x + 1.5, y + len, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  const text = (s, x, y, size, color, rot = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.font = `bold ${size}px "Comic Sans MS", "Marker Felt", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fillText(s, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  };
  const cell = (i, fn) => {
    ctx.save();
    ctx.translate((i % 4) * 256, Math.floor(i / 4) * 256);
    fn();
    ctx.restore();
  };
  // 0. un grand sourire à la craie noire
  cell(0, () => {
    shaky(circle(128, 128, 92), '#1b1a17', 7, true);
    shaky([[92, 92], [94, 116]], '#1b1a17', 9);
    shaky([[164, 92], [162, 116]], '#1b1a17', 9);
    shaky(Array.from({ length: 12 }, (_, i) => [70 + i * 10.5, 158 + Math.sin((i / 11) * Math.PI) * 28]), '#1b1a17', 7);
  });
  // 1. une famille de bonshommes bâtons qui se tiennent la main (craie rouge)
  cell(1, () => {
    for (const [x, h] of [[60, 1], [128, 0.8], [196, 0.6]]) {
      const top = 230 - 170 * h;
      shaky(circle(x, top + 16, 16, 16), '#9b1d1a', 5, true);
      shaky([[x, top + 32], [x, 200 - 20 * (1 - h)]], '#9b1d1a', 5);
      shaky([[x - 22, 236], [x, 200 - 20 * (1 - h)], [x + 22, 236]], '#9b1d1a', 5);
      shaky([[x - 34, top + 70], [x, top + 50], [x + 34, top + 70]], '#9b1d1a', 5);
    }
  });
  // 2. une flèche et « EXIT ? »
  cell(2, () => {
    text('EXIT ?', 128, 90, 50, '#1d2a6b', -0.05);
    shaky([[30, 160], [210, 150]], '#1d2a6b', 9);
    shaky([[180, 120], [220, 150], [182, 182]], '#1d2a6b', 9);
  });
  // 3. des bâtons pour compter les jours (feutre noir)
  cell(3, () => {
    for (let g = 0; g < 6; g++) {
      const x0 = 26 + (g % 3) * 74;
      const y0 = 40 + Math.floor(g / 3) * 100;
      for (let i = 0; i < 4; i++) shaky([[x0 + i * 13, y0], [x0 + i * 13 + 2, y0 + 70]], '#16150f', 4);
      if (g < 5) shaky([[x0 - 8, y0 + 50], [x0 + 52, y0 + 18]], '#16150f', 4);
    }
  });
  // 4. « DON'T RUN » à la peinture rouge qui coule
  cell(4, () => {
    text("DON'T", 128, 92, 62, '#7a0f0c', -0.04);
    text('RUN', 128, 170, 76, '#7a0f0c', 0.03);
    drips(60, 196, 180, 'rgba(122, 15, 12, 0.8)', 9);
  });
  // 5. une spirale griffonnée
  cell(5, () => {
    shaky(Array.from({ length: 120 }, (_, i) => {
      const a = i * 0.24;
      return [128 + Math.cos(a) * (4 + i * 0.95), 128 + Math.sin(a) * (4 + i * 0.95)];
    }), '#24221c', 5);
  });
  // 6. une maison d'enfant, sa porte et un soleil (craies de couleur)
  cell(6, () => {
    shaky([[60, 220], [60, 130], [196, 130], [196, 220]], '#2f5f8f', 6);
    shaky([[48, 136], [128, 66], [208, 136]], '#8f2f2f', 6);
    shaky([[112, 220], [112, 170], [144, 170], [144, 220]], '#5a3a1a', 6);
    shaky(circle(210, 42, 22, 16), '#d08a12', 6, true);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      shaky([[210 + Math.cos(a) * 30, 42 + Math.sin(a) * 30], [210 + Math.cos(a) * 44, 42 + Math.sin(a) * 44]], '#d08a12', 5);
    }
  });
  // 7. des mains sales plaquées contre le mur
  cell(7, () => {
    ctx.fillStyle = 'rgba(45, 32, 20, 0.7)';
    for (const [hx, hy, r] of [[86, 150, -0.25], [176, 110, 0.2]]) {
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(r);
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 36, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const [fx, len] of [[-24, 34], [-10, 50], [4, 54], [18, 46]]) ctx.fillRect(fx, -30 - len, 11, len + 6);
      ctx.save();
      ctx.rotate(-0.9);
      ctx.fillRect(-4, 4, 11, 46);
      ctx.restore();
      ctx.restore();
    }
    drips(60, 200, 170, 'rgba(45, 32, 20, 0.55)', 6);
  });
}

// Papier peint jaune pâle des films : fines rayures verticales et motif en chevrons à peine visible, un peu jauni,
// cloqué par l'humidité, avec sa plinthe (une face de mur = 2,5 m × 3 m)
// worn : l'étage du bas du Level 0, qui garde l'ancien jaune doré (grisé ensuite par greyWall) et son usure
function drawWallpaper(ctx, S, grime, worn = false) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = worn ? '#d4c37a' : '#d6cb98'; // en haut, jaune pâle tirant sur l'olive
  ctx.fillRect(0, 0, S, S);
  const band = S / 16; // 16 lés de rayures par face
  for (let i = 0; i < 16; i++) {
    const x = i * band;
    ctx.fillStyle = worn ? 'rgba(150, 128, 52, 0.16)' : 'rgba(140, 134, 66, 0.16)';
    ctx.fillRect(x, 0, band * 0.5, S);
    ctx.fillStyle = worn ? 'rgba(110, 92, 36, 0.22)' : 'rgba(100, 96, 44, 0.22)';
    ctx.fillRect(x, 0, 1.2, S);
    ctx.fillRect(x + band * 0.5, 0, 1, S);
    // chevrons pointés vers le haut, au milieu de la rayure claire
    ctx.strokeStyle = worn ? 'rgba(140, 118, 46, 0.32)' : 'rgba(128, 122, 56, 0.32)';
    ctx.lineWidth = 1.4;
    const cx = x + band * 0.75;
    for (let y = (i % 2) * 9; y < S; y += 18) {
      ctx.beginPath();
      ctx.moveTo(cx - 6, y + 5);
      ctx.lineTo(cx, y);
      ctx.lineTo(cx + 6, y + 5);
      ctx.stroke();
    }
  }
  // le papier jauni, plus clair au milieu des lés
  if (grime) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = worn ? 0.55 : 0.3;
    ctx.drawImage(grime, 0, 0, S, S);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // coulures depuis le plafond (seulement à l'étage du bas : en haut, les murs restent propres)
  for (let i = 0; i < (worn ? 3 : 0); i++) {
    const x = Math.random() * S;
    const len = S * (0.1 + Math.random() * 0.3);
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, 'rgba(105, 82, 30, 0.28)');
    g.addColorStop(1, 'rgba(105, 82, 30, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 3 + Math.random() * 10, len);
  }
  // salissures au ras de la plinthe
  const dirt = ctx.createLinearGradient(0, S * 0.82, 0, S * 0.955);
  dirt.addColorStop(0, 'rgba(90, 70, 30, 0)');
  dirt.addColorStop(1, `rgba(90, 70, 30, ${worn ? 0.3 : 0.12})`);
  ctx.fillStyle = dirt;
  ctx.fillRect(0, S * 0.82, S, S * 0.14);
  // plinthe en vinyle brun, éraflée
  ctx.fillStyle = '#6b5a35';
  ctx.fillRect(0, S * 0.955, S, S * 0.045);
  ctx.fillStyle = 'rgba(255,240,200,0.12)';
  ctx.fillRect(0, S * 0.955, S, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, S * 0.951, S, 2);
  noise(ctx, S, S, 10);
  // en haut : un peu moins de vert (le jaune tirait sur l'olive)
  if (!worn) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(255, 244, 247)';
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'source-over';
  }
}

// Le même papier peint, à l'étage du bas du Level 0 : simplement délavé vers le gris, sans aucune tache. On le passe
// par-dessus drawWallpaper (même toile, même échelle S)
function greyWall(ctx, S) {
  ctx.save();
  // la couleur s'en va aux deux tiers, et le papier tire vers un gris un peu terne
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = 'rgba(128, 128, 128, 0.7)';
  ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#cbc8c0';
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
}

// Moquette humide, rase (photo ambientCG Carpet011, ses poils creusés par l'ombre) : on ne garde que son grain, la
// luminance de chaque poil aux trois quarts de son contraste, posée sur la couleur moyenne voulue. Beige à peine plus
// foncé que les murs en haut, brun doré en bas (low). Sans photo, une trame de bruit
const CARPET_RGB = { up: [132, 119, 81], low: [133, 116, 38] };
const CARPET_GRAIN = 0.75;
function drawCarpet(ctx, S, photo, low = false) {
  const [cr, cg, cb] = low ? CARPET_RGB.low : CARPET_RGB.up;
  ctx.globalCompositeOperation = 'source-over';
  if (photo) {
    ctx.drawImage(photo, 0, 0, S, S);
    const { width: w, height: h } = ctx.canvas;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const mean = sum / (d.length / 4) || 1;
    for (let i = 0; i < d.length; i += 4) {
      const k = 1 + CARPET_GRAIN * ((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / mean - 1);
      d[i] = cr * k;
      d[i + 1] = cg * k;
      d[i + 2] = cb * k;
    }
    ctx.putImageData(img, 0, 0);
  } else {
    ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;
    ctx.fillRect(0, 0, S, S);
    noise(ctx, S, S, 36);
  }
}

// Dalles de faux plafond (4 × 4 par case), salies par la photo
function drawCeiling(ctx, S, grime, low = false) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = low ? '#ddd6bd' : '#ddccb7'; // blanc cassé, un peu plus chaud en haut
  ctx.fillRect(0, 0, S, S);
  if (grime) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.45;
    ctx.drawImage(grime, 0, 0, S, S);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // trous des dalles acoustiques
  ctx.fillStyle = 'rgba(90, 80, 60, 0.18)';
  for (let i = 0; i < 1400; i++) ctx.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5);
  // rails de la grille métallique
  const n = 4;
  ctx.fillStyle = '#9c957e';
  for (let i = 0; i <= n; i++) {
    const p = (i / n) * S;
    ctx.fillRect(p - 2, 0, 4, S);
    ctx.fillRect(0, p - 2, S, 4);
  }
}

// Level 1 : béton brut humide, coulures sombres au pied, bande jaune et noire de sécurité
function drawConcreteWall(ctx, S, photo) {
  // parpaings peints (Poly Haven, concrete_wall_004) : la photo est répétée 3 × 5 fois pour que les blocs fassent
  // leur vraie taille (40 × 20 cm) sur un mur de 2,5 m de large et 4,2 m de haut
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#80837c';
  ctx.fillRect(0, 0, S, S);
  if (photo) {
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) ctx.drawImage(photo, (i * S) / 3, (j * S) / 5, S / 3 + 1, S / 5 + 1);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#b9bdb8';
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'source-over';
  } else noise(ctx, S, S, 40);
  // soubassement peint en gris foncé jusqu'à 1,2 m, souligné d'un filet jaune
  const yb = S * (1 - 1.2 / 4.2);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#8a9295';
  ctx.fillRect(0, yb, S, S - yb);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(214, 170, 40, 0.85)';
  ctx.fillRect(0, yb - 5, S, 5);
  // coulures sombres depuis le plafond, et l'humidité qui remonte
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * S;
    const w = 3 + Math.random() * 12;
    const gg = ctx.createLinearGradient(0, 0, 0, S * (0.3 + Math.random() * 0.5));
    gg.addColorStop(0, 'rgba(38, 34, 26, 0.45)');
    gg.addColorStop(1, 'rgba(38, 34, 26, 0)');
    ctx.fillStyle = gg;
    ctx.fillRect(x, 0, w, S);
  }
  const g = ctx.createLinearGradient(0, S * 0.8, 0, S);
  g.addColorStop(0, 'rgba(20, 22, 18, 0)');
  g.addColorStop(1, 'rgba(20, 22, 18, 0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // plinthe de sécurité jaune et noire
  const y0 = S * 0.965;
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(0, y0, S, S - y0);
  ctx.fillStyle = '#16181a';
  for (let x = -S; x < S * 2; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, S);
    ctx.lineTo(x + 16, S);
    ctx.lineTo(x + 16 + (S - y0), y0);
    ctx.lineTo(x + (S - y0), y0);
    ctx.fill();
  }
}

// Dalle de béton usé (Poly Haven, concrete_floor_worn_001), taches d'huile et traces de pneus de chariot
function drawConcreteFloor(ctx, S, photo) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#5b5d5c';
  ctx.fillRect(0, 0, S, S);
  if (photo) {
    ctx.drawImage(photo, 0, 0, S, S);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#a7aaa6';
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'source-over';
  } else noise(ctx, S, S, 30);
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 15 + Math.random() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(14, 12, 10, 0.45)');
    g.addColorStop(0.6, 'rgba(14, 12, 10, 0.2)');
    g.addColorStop(1, 'rgba(14, 12, 10, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  // traces de roues : deux bandes sombres qui traversent la case
  ctx.fillStyle = 'rgba(10, 10, 10, 0.12)';
  const tx = S * (0.25 + Math.random() * 0.2);
  ctx.fillRect(tx, 0, 18, S);
  ctx.fillRect(tx + 120, 0, 18, S);
  // joint de dalle sciée
  ctx.fillStyle = 'rgba(15, 16, 16, 0.6)';
  ctx.fillRect(0, 0, S, 3);
  ctx.fillRect(0, 0, 3, S);
}

// Dalle de béton brut au plafond (Poly Haven, concrete_wall_006), avec les marques des coffrages
function drawConcreteCeiling(ctx, S, photo) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#4a4c4a';
  ctx.fillRect(0, 0, S, S);
  if (photo) {
    ctx.drawImage(photo, 0, 0, S, S);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#8a8c88';
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = 'rgba(20, 22, 22, 0.5)';
  ctx.fillRect(0, S / 2 - 2, S, 4);
}

// Level 37 (Poolrooms) : petits carreaux blancs (ambientCG Tiles133A), à leur vraie taille (environ 15 cm) sur un mur de
// 2,5 m de large et 5,3 m de haut (il descend sous l'eau), avec une frise de carreaux bleu pastel à hauteur de main
function drawPoolWall(ctx, S, photo) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#e9efee';
  ctx.fillRect(0, 0, S, S);
  if (photo) {
    // mosaïque fine : des carreaux d'environ 7 cm
    const tw = S / 3;
    const th = S / 6.3;
    for (let y = 0; y < S; y += th) for (let x = 0; x < S; x += tw) ctx.drawImage(photo, x, y, tw + 1, th + 1);
  } else noise(ctx, S, S, 10);
  // frise bleu pastel de deux rangs, à 1,1 m au-dessus de l'eau (le mur va de -1,3 m à 4 m)
  const row = S / 6.3 / 12;
  const yf = S * (1 - (1.1 + 1.3) / 5.3);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#9fd3e3';
  ctx.fillRect(0, yf - row * 2, S, row * 2);
  // la ligne d'eau : un léger dépôt de calcaire, plus mat, juste au-dessus de la surface
  ctx.fillStyle = '#f2efe6';
  ctx.globalCompositeOperation = 'source-over';
  const yw = S * (1 - 1.3 / 5.3);
  const g = ctx.createLinearGradient(0, yw - row * 1.5, 0, yw);
  g.addColorStop(0, 'rgba(235, 230, 214, 0)');
  g.addColorStop(1, 'rgba(225, 220, 200, 0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, yw - row * 1.5, S, row * 1.5);
}

// sols et plages : grands carreaux blancs brillants (ambientCG Tiles107)
function drawPoolFloor(ctx, S, photo) {
  ctx.fillStyle = '#f1f4f3';
  ctx.fillRect(0, 0, S, S);
  if (photo) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) ctx.drawImage(photo, (x * S) / 2, (y * S) / 2, S / 2 + 1, S / 2 + 1);
  else noise(ctx, S, S, 8);
}

// plafond, voûtes : la même mosaïque fine, 3 × 3 photos par case de 2,5 m (carreaux d'environ 7 cm)
function drawPoolCeiling(ctx, S, photo) {
  ctx.fillStyle = '#e8eeee';
  ctx.fillRect(0, 0, S, S);
  if (photo) for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) ctx.drawImage(photo, (x * S) / 3, (y * S) / 3, S / 3 + 1, S / 3 + 1);
  else noise(ctx, S, S, 6);
}

export function createBackroomsTextures(level = 0) {
  // Toutes les surfaces en 1024 px (photos Poly Haven en 1024 px) : les motifs du Level 0 et du Level 1 sont dessinés
  // en 512 unités, à l'échelle 2 (même dessin qu'avant, deux fois plus fin) ; la mosaïque des Poolrooms en 1024
  const S = level === 2 ? 1024 : 512;
  const PX = 1024;
  const L1 = level === 1;
  const L2 = level === 2; // Level 37, les Poolrooms
  const [wallCanvas, wctx] = canvas(PX);
  const [carpetCanvas, cctx] = canvas(PX);
  const [ceilCanvas, clctx] = canvas(PX);
  for (const c of [wctx, cctx, clctx]) c.setTransform(PX / S, 0, 0, PX / S, 0, 0);
  const drawW = L2 ? drawPoolWall : L1 ? drawConcreteWall : drawWallpaper;
  const drawF = L2 ? drawPoolFloor : L1 ? drawConcreteFloor : drawCarpet;
  const drawC = L2 ? drawPoolCeiling : L1 ? drawConcreteCeiling : drawCeiling;
  drawW(wctx, S, null);
  drawF(cctx, S, null);
  drawC(clctx, S, null);
  // Level 0, étage du bas : l'ancien papier peint doré, délavé vers le gris, sa moquette brun doré, son plafond clair
  const [lowCanvas, lowCtx] = level === 0 ? canvas(PX) : [null, null];
  const [carpetLowCanvas, cLowCtx] = level === 0 ? canvas(PX) : [null, null];
  const [ceilLowCanvas, clLowCtx] = level === 0 ? canvas(PX) : [null, null];
  const drawLow = (pap, moq, pla) => {
    if (!lowCtx) return;
    for (const c of [lowCtx, cLowCtx, clLowCtx]) c.setTransform(PX / S, 0, 0, PX / S, 0, 0);
    if (pap !== undefined) {
      drawW(lowCtx, S, pap, true);
      greyWall(lowCtx, S);
    }
    if (moq !== undefined) drawCarpet(cLowCtx, S, moq, true);
    if (pla !== undefined) drawCeiling(clLowCtx, S, pla, true);
  };
  drawLow(null, null, null);

  const wall = tex(wallCanvas);
  const wallLow = lowCanvas ? tex(lowCanvas) : wall;
  const carpet = tex(carpetCanvas);
  const ceiling = tex(ceilCanvas);
  const carpetLow = carpetLowCanvas ? tex(carpetLowCanvas) : carpet;
  const ceilingLow = ceilLowCanvas ? tex(ceilLowCanvas) : ceiling;

  // les photos arrivent un peu plus tard : on redessine par-dessus
  const files = L2 ? ['l37_mur.jpg', 'l37_sol.jpg', 'l37_mur.jpg'] : L1 ? ['l1_mur.jpg', 'l1_sol.jpg', 'l1_plafond.jpg'] : ['papier.jpg', 'moquette_rase.jpg', 'plafond.jpg'];
  // Level 37 : le carrelage des bassins (cyan) et des fosses (bleu profond), ambientCG Tiles132A et Tiles135A
  const [poolCanvas, pctx2] = canvas(S);
  const [deepCanvas, dctx2] = canvas(S);
  pctx2.fillStyle = '#3fb8d4';
  pctx2.fillRect(0, 0, S, S);
  dctx2.fillStyle = '#16446a';
  dctx2.fillRect(0, 0, S, S);
  const pool = tex(poolCanvas);
  const deep = tex(deepCanvas);
  // la mosaïque des voûtes : le même dessin que le plafond (2,5 m par répétition)
  const mosaic = tex(ceilCanvas);
  const ready = Promise.all([...files.map(loadImage), ...(L2 ? ['l37_bassin.jpg', 'l37_fosse.jpg'].map(loadImage) : [])]).then(([pap, moq, pla, bas, fos]) => {
    if (pap) { drawW(wctx, S, pap); wall.needsUpdate = true; }
    if (pap && lowCtx) { drawLow(pap, undefined, undefined); wallLow.needsUpdate = true; }
    if (moq && lowCtx) { drawLow(undefined, moq, undefined); carpetLow.needsUpdate = true; }
    if (pla && lowCtx) { drawLow(undefined, undefined, pla); ceilingLow.needsUpdate = true; }
    if (moq) { drawF(cctx, S, moq); carpet.needsUpdate = true; }
    if (pla) { drawC(clctx, S, pla); ceiling.needsUpdate = true; }
    // carreaux des bassins deux fois plus petits (10 cm)
    if (bas) { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) pctx2.drawImage(bas, (x * S) / 2, (y * S) / 2, S / 2 + 1, S / 2 + 1); pool.needsUpdate = true; }
    if (fos) { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) dctx2.drawImage(fos, (x * S) / 2, (y * S) / 2, S / 2 + 1, S / 2 + 1); deep.needsUpdate = true; }
    if (pla) mosaic.needsUpdate = true;
  });

  // Portes d'ascenseur en inox brossé (512 × 1024) : brossage vertical, reflets en bandes, joint central, rayures,
  // traces de doigts à hauteur de main et salissure au pied
  const [doorCanvas, dctx] = canvas(512, 1024);
  {
    const g = dctx.createLinearGradient(0, 0, 512, 0);
    g.addColorStop(0, '#7f858b');
    g.addColorStop(0.35, '#a4aab0');
    g.addColorStop(0.55, '#8b9197');
    g.addColorStop(0.8, '#a0a6ab');
    g.addColorStop(1, '#7a8086');
    dctx.fillStyle = g;
    dctx.fillRect(0, 0, 512, 1024);
    for (let x = 0; x < 512; x++) {
      dctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'}, ${Math.random() * 0.07})`;
      dctx.fillRect(x, 0, 1, 1024);
    }
    for (let i = 0; i < 900; i++) {
      dctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '20,20,20'}, ${0.04 + Math.random() * 0.06})`;
      dctx.fillRect(Math.random() * 512, Math.random() * 1024, 1, 8 + Math.random() * 60);
    }
    // rayures fines en biais
    dctx.lineWidth = 1;
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * 512;
      const y = 200 + Math.random() * 800;
      const a = (Math.random() - 0.5) * 1.2;
      const l = 10 + Math.random() * 70;
      dctx.strokeStyle = `rgba(${Math.random() < 0.6 ? '230,232,235' : '40,40,40'}, ${0.12 + Math.random() * 0.2})`;
      dctx.beginPath();
      dctx.moveTo(x, y);
      dctx.lineTo(x + Math.sin(a) * l, y + Math.cos(a) * l);
      dctx.stroke();
    }
    // traces de doigts à hauteur de main (vers le milieu, là où on pousse)
    for (let i = 0; i < 22; i++) {
      const x = 330 + Math.random() * 160;
      const y = 470 + Math.random() * 180;
      const r = 8 + Math.random() * 10;
      const fg = dctx.createRadialGradient(x, y, 0, x, y, r);
      fg.addColorStop(0, 'rgba(60, 55, 45, 0.16)');
      fg.addColorStop(1, 'rgba(60, 55, 45, 0)');
      dctx.fillStyle = fg;
      dctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // la crasse au pied, et les bords des vantaux
    const dg = dctx.createLinearGradient(0, 860, 0, 1024);
    dg.addColorStop(0, 'rgba(50, 42, 25, 0)');
    dg.addColorStop(1, 'rgba(50, 42, 25, 0.45)');
    dctx.fillStyle = dg;
    dctx.fillRect(0, 860, 512, 164);
    dctx.fillStyle = 'rgba(0,0,0,0.35)';
    dctx.fillRect(0, 0, 8, 1024);
    dctx.fillRect(504, 0, 8, 1024);
    dctx.fillStyle = 'rgba(255,255,255,0.18)';
    dctx.fillRect(8, 0, 2, 1024);
  }
  const steel = tex(doorCanvas);
  steel.wrapS = steel.wrapT = THREE.ClampToEdgeWrapping;

  // Porte coupe-feu en acier peint (photo Poly Haven blue_metal_plate, repeinte en gris-vert d'usine) et tôle larmée
  // du plancher de la cabine (Poly Haven metal_plate) : dessinées quand les photos arrivent
  const [fireCanvas, fdctx] = canvas(512, 1024);
  fdctx.fillStyle = '#6e7366';
  fdctx.fillRect(0, 0, 512, 1024);
  const fireDoor = tex(fireCanvas);
  fireDoor.wrapS = fireDoor.wrapT = THREE.ClampToEdgeWrapping;
  const [plateCanvas, plctx] = canvas(512);
  plctx.fillStyle = '#55585a';
  plctx.fillRect(0, 0, 512, 512);
  const treadPlate = tex(plateCanvas);
  const metalReady = Promise.all(['porte_metal.jpg', 'tole_larmee.jpg'].map(loadImage)).then(([pm, tl]) => {
    if (pm) {
      fdctx.drawImage(pm, 0, 0, 512, 512);
      fdctx.drawImage(pm, 0, 512, 512, 512);
      fdctx.globalCompositeOperation = 'color';
      fdctx.fillStyle = '#7d8570';
      fdctx.fillRect(0, 0, 512, 1024);
      fdctx.globalCompositeOperation = 'soft-light';
      fdctx.fillStyle = '#b8baa8';
      fdctx.fillRect(0, 0, 512, 1024);
      fdctx.globalCompositeOperation = 'source-over';
      // la crasse au pied et autour de la poignée
      const g2 = fdctx.createLinearGradient(0, 880, 0, 1024);
      g2.addColorStop(0, 'rgba(40, 34, 20, 0)');
      g2.addColorStop(1, 'rgba(40, 34, 20, 0.5)');
      fdctx.fillStyle = g2;
      fdctx.fillRect(0, 880, 512, 144);
      fireDoor.needsUpdate = true;
    }
    if (tl) {
      plctx.drawImage(tl, 0, 0, 512, 512);
      plctx.globalCompositeOperation = 'color';
      plctx.fillStyle = '#6b6f72';
      plctx.fillRect(0, 0, 512, 512);
      plctx.globalCompositeOperation = 'source-over';
      treadPlate.needsUpdate = true;
    }
  });

  // Caisse en bois des étagères
  const [crateCanvas, kctx] = hd(128);
  kctx.fillStyle = '#8a6a3f';
  kctx.fillRect(0, 0, 128, 128);
  noise(kctx, 128, 128, 30);
  kctx.fillStyle = '#5e4526';
  for (let y = 0; y < 128; y += 32) kctx.fillRect(0, y, 128, 3);
  kctx.lineWidth = 10;
  kctx.strokeStyle = '#6d5030';
  kctx.strokeRect(5, 5, 118, 118);
  kctx.beginPath();
  kctx.moveTo(8, 8);
  kctx.lineTo(120, 120);
  kctx.stroke();
  const crate = tex(crateCanvas);

  // Nappe de brouillard au ras du sol (taches douces, transparentes)
  const [fogCanvas, fctx] = canvas(256);
  fctx.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 20 + Math.random() * 60;
    for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      const g = fctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.18)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      fctx.fillStyle = g;
      fctx.fillRect(0, 0, 256, 256);
    }
  }
  const fog = new THREE.CanvasTexture(fogCanvas);
  fog.wrapS = fog.wrapT = THREE.RepeatWrapping;

  // Cassette VHS
  const [vhsCanvas, vctx] = hd(256, 160);
  vctx.fillStyle = '#1c1b18';
  vctx.fillRect(0, 0, 256, 160);
  vctx.fillStyle = '#e5dfcc';
  vctx.fillRect(20, 20, 216, 65);
  vctx.fillStyle = '#0a0a09';
  vctx.fillRect(40, 100, 176, 40);
  vctx.fillStyle = '#555';
  vctx.beginPath();
  vctx.arc(80, 120, 14, 0, Math.PI * 2);
  vctx.arc(176, 120, 14, 0, Math.PI * 2);
  vctx.fill();
  vctx.fillStyle = '#9b1c1c';
  vctx.font = 'bold 20px monospace';
  vctx.fillText('BACKROOMS // TAPE', 30, 48);
  vctx.fillStyle = '#333';
  vctx.font = '16px monospace';
  vctx.fillText('DO NOT ERASE', 30, 72);
  const vhs = tex(vhsCanvas);
  vhs.wrapS = vhs.wrapT = THREE.ClampToEdgeWrapping;

  // Porte de sortie métallique (sans le panneau, posé à part)
  const [exitCanvas, ectx] = hd(256, 512);
  ectx.fillStyle = '#3b3f45';
  ectx.fillRect(0, 0, 256, 512);
  ectx.strokeStyle = '#25282c';
  ectx.lineWidth = 6;
  ectx.strokeRect(24, 24, 208, 200);
  ectx.strokeRect(24, 260, 208, 220);
  ectx.fillStyle = '#9aa0a8';
  ectx.fillRect(196, 250, 40, 14); // barre anti-panique
  ectx.fillStyle = '#d97706';
  ectx.fillRect(0, 488, 256, 24);
  ectx.fillStyle = '#000';
  for (let x = -24; x < 256; x += 32) {
    ectx.beginPath();
    ectx.moveTo(x, 512);
    ectx.lineTo(x + 16, 512);
    ectx.lineTo(x + 40, 488);
    ectx.lineTo(x + 24, 488);
    ectx.fill();
  }
  noise(ectx, 256, 512, 18);
  const exit = tex(exitCanvas);
  exit.wrapS = exit.wrapT = THREE.ClampToEdgeWrapping;

  // Panneau EXIT lumineux
  const [signCanvas, sctx] = hd(256, 96);
  sctx.fillStyle = '#0b0b0b';
  sctx.fillRect(0, 0, 256, 96);
  sctx.fillStyle = '#fff';
  sctx.font = 'bold 64px sans-serif';
  sctx.textAlign = 'center';
  sctx.textBaseline = 'middle';
  sctx.fillText('EXIT', 128, 50);
  const sign = tex(signCanvas);
  sign.wrapS = sign.wrapT = THREE.ClampToEdgeWrapping;

  // Étiquette de l'eau d'amande : la vraie (photo de la bouteille), deux fois autour (devant et derrière). Le canvas a
  // d'emblée la taille de la photo : une texture déjà envoyée à la carte graphique ne change plus de taille (sinon,
  // à un niveau où la bouteille s'affiche avant la fin du chargement, elle restait sans étiquette).
  const [labelCanvas, lctx] = hd(256, 176);
  lctx.fillStyle = '#f1e7c9';
  lctx.fillRect(0, 0, 256, 176);
  lctx.fillStyle = '#c0306a';
  lctx.font = 'bold 40px sans-serif';
  lctx.textAlign = 'center';
  lctx.fillText('ALMOND', 128, 80);
  lctx.fillText('WATER', 128, 124);
  const label = tex(labelCanvas);
  label.repeat.set(2, 1);
  label.offset.set(0.5, 0); // le logo bien au milieu de chaque face
  loadImage('eau_amande.jpg').then((img) => {
    if (!img) return;
    lctx.drawImage(img, 0, 0, 256, 176);
    label.needsUpdate = true;
  });

  // Pavé lumineux encastré (diffuseur prismatique dans son cadre) ; au Level 1, un tube nu sous sa réglette
  const [lampCanvas, pctx] = hd(128, 64);
  pctx.fillStyle = '#3a3a36';
  pctx.fillRect(0, 0, 128, 64);
  pctx.fillStyle = '#ffffff';
  pctx.fillRect(5, 5, 118, 54);
  pctx.fillStyle = 'rgba(160, 150, 120, 0.35)';
  for (let x = 5; x < 123; x += 3) pctx.fillRect(x, 5, 1, 54);
  for (let y = 5; y < 59; y += 3) pctx.fillRect(5, y, 118, 1);
  pctx.fillStyle = 'rgba(60, 58, 50, 0.6)';
  pctx.fillRect(5, 30, 118, 3); // la barre du milieu
  const lamp = tex(lampCanvas);
  lamp.wrapS = lamp.wrapT = THREE.ClampToEdgeWrapping;

  // Prise électrique : plaque jaunie, deux trous ronds
  const [outCanvas, octx] = hd(64, 96);
  octx.fillStyle = '#e4dcc4';
  octx.fillRect(0, 0, 64, 96);
  octx.strokeStyle = 'rgba(80, 70, 50, 0.5)';
  octx.lineWidth = 3;
  octx.strokeRect(2, 2, 60, 92);
  octx.fillStyle = '#d6ccb0';
  octx.beginPath();
  octx.arc(32, 48, 17, 0, Math.PI * 2);
  octx.fill();
  octx.fillStyle = '#1c1a16';
  for (const x of [25, 39]) {
    octx.beginPath();
    octx.arc(x, 48, 3.2, 0, Math.PI * 2);
    octx.fill();
  }
  octx.fillStyle = '#8a8270';
  octx.fillRect(30, 12, 4, 4);
  octx.fillRect(30, 80, 4, 4);
  noise(octx, 64, 96, 10);
  const outlet = tex(outCanvas);
  outlet.wrapS = outlet.wrapT = THREE.ClampToEdgeWrapping;

  // Grille d'aération du faux plafond : lames grises et poussière noire entre elles
  const [ventCanvas, vtctx] = hd(128);
  vtctx.fillStyle = '#c9c4b2';
  vtctx.fillRect(0, 0, 128, 128);
  vtctx.fillStyle = '#9b9584';
  vtctx.fillRect(6, 6, 116, 116);
  for (let y = 12; y < 118; y += 9) {
    vtctx.fillStyle = '#26241e';
    vtctx.fillRect(12, y, 104, 4);
    vtctx.fillStyle = '#d5d0bf';
    vtctx.fillRect(12, y + 4, 104, 2);
  }
  noise(vtctx, 128, 128, 16);
  const vent = tex(ventCanvas);
  vent.wrapS = vent.wrapT = THREE.ClampToEdgeWrapping;

  // Rubalise de chantier : bandes jaunes et noires en biais, plastique un peu froissé
  const [tapeCanvas, tpctx] = hd(256, 32);
  tpctx.fillStyle = '#e8c21a';
  tpctx.fillRect(0, 0, 256, 32);
  tpctx.fillStyle = '#16140f';
  for (let x = -32; x < 256 + 32; x += 32) {
    tpctx.beginPath();
    tpctx.moveTo(x, 32);
    tpctx.lineTo(x + 16, 32);
    tpctx.lineTo(x + 32, 0);
    tpctx.lineTo(x + 16, 0);
    tpctx.fill();
  }
  for (let i = 0; i < 6; i++) {
    tpctx.fillStyle = `rgba(255, 255, 255, ${0.05 + Math.random() * 0.08})`;
    tpctx.fillRect(Math.random() * 256, 0, 2 + Math.random() * 6, 32);
  }
  noise(tpctx, 256, 32, 14);
  const tape = tex(tapeCanvas);
  tape.wrapT = THREE.ClampToEdgeWrapping;

  // Dessins sur les murs : 8 cases de 256 px (craie grasse, feutre, peinture qui coule), fond transparent
  const [drawCanvas, artCtx] = canvas(1024, 512);
  drawWallArt(artCtx);
  const drawings = tex(drawCanvas);
  drawings.wrapS = drawings.wrapT = THREE.ClampToEdgeWrapping;

  return { wall, wallLow, carpet, carpetLow, ceiling, ceilingLow, pool, deep, mosaic, vhs, exit, sign, label, steel, fireDoor, treadPlate, crate, fog, lamp, outlet, vent, tape, drawings, ready, metalReady };
}
