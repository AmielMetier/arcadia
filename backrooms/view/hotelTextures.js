// The Backrooms (Level 5, le Terror Hotel) - Les matières de l'hôtel, dessinées sur toile par-dessus des photos CC0
// (voir backrooms/tex/LICENSE.txt) : le mur du couloir et des chambres (corniche, papier peint damassé, cimaise,
// lambris de noyer, plinthe) avec son relief et sa brillance, la moquette, le plafond de plâtre.
//
// Une face de mur fait 2,5 m de large et 3,1 m de haut ; la toile est carrée (S unités de côté) : on dessine en
// mètres dans un repère (u le long du mur, v la hauteur) que wallFrame() pose sur la toile.

export const HOTEL_WALL = {
  H: 3.1,
  BASE: 0.15, // haut de la plinthe
  RAIL0: 0.92, // bas de la cimaise (et haut du lambris)
  RAIL1: 1.0, // haut de la cimaise
  CORN: 2.9, // bas de la corniche
};
const HW = HOTEL_WALL;
const PANELS = 2; // panneaux de lambris par face
const STILE = 0.09; // largeur des montants et des traverses
const BEVEL = 0.05; // biseau des panneaux en relief
const ROLL = 2.5 / 6; // largeur d'un lé de papier peint (un motif)
const DROP = 0.52; // hauteur d'un motif ; une colonne sur deux décalée d'une demi-hauteur

// u, v (mètres) -> unités de toile
const X = (S, u) => (u * S) / 2.5;
const Y = (S, v) => S * (1 - v / HW.H);

// le repère du mur : on dessine en mètres, v vers le haut
function wallFrame(ctx, S, fn) {
  ctx.save();
  ctx.translate(0, S);
  ctx.scale(S / 2.5, -S / HW.H);
  fn();
  ctx.restore();
}

function noise(ctx, amount) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const d = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d.data[i] += n;
    d.data[i + 1] += n;
    d.data[i + 2] += n;
  }
  ctx.putImageData(d, 0, 0);
}

// une photo répétée nx × ny fois sur un rectangle de la toile (en unités), tournée d'un quart de tour si rot
function photoRect(ctx, photo, x, y, w, h, nx, ny, rot = false) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  const tw = w / nx;
  const th = h / ny;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!rot) ctx.drawImage(photo, x + i * tw, y + j * th, tw + 0.5, th + 0.5);
      else {
        ctx.save();
        ctx.translate(x + i * tw + tw / 2, y + j * th + th / 2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(photo, -th / 2, -tw / 2, th + 0.5, tw + 0.5);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

// Le motif damassé, centré en (0, 0), en mètres (environ 0,42 × 0,56) : un médaillon en ogive ajouré, une fleur en
// son cœur, des rinceaux enroulés de part et d'autre, un fleuron au sommet, une pampille en bas. Dessiné sur une
// moitié puis en miroir : un vrai damas est symétrique.
function damaskHalf(ctx) {
  // le médaillon : une ogive pleine…
  ctx.beginPath();
  ctx.moveTo(0, 0.25);
  ctx.bezierCurveTo(0.03, 0.2, 0.1, 0.17, 0.12, 0.08);
  ctx.bezierCurveTo(0.135, 0.0, 0.08, -0.06, 0.1, -0.12);
  ctx.bezierCurveTo(0.11, -0.17, 0.05, -0.2, 0, -0.24);
  ctx.lineTo(0, 0.25);
  ctx.fill();
  // les rinceaux : une feuille d'acanthe qui part du flanc et s'enroule vers le haut
  ctx.beginPath();
  ctx.moveTo(0.1, -0.05);
  ctx.bezierCurveTo(0.17, -0.1, 0.22, -0.02, 0.19, 0.06);
  ctx.bezierCurveTo(0.175, 0.11, 0.14, 0.12, 0.13, 0.09);
  ctx.bezierCurveTo(0.16, 0.08, 0.175, 0.03, 0.16, -0.01);
  ctx.bezierCurveTo(0.15, -0.04, 0.12, -0.04, 0.1, -0.02);
  ctx.closePath();
  ctx.fill();
  // ses folioles, vers le bas
  ctx.beginPath();
  ctx.moveTo(0.1, -0.11);
  ctx.bezierCurveTo(0.16, -0.12, 0.2, -0.17, 0.17, -0.23);
  ctx.bezierCurveTo(0.15, -0.19, 0.13, -0.17, 0.09, -0.15);
  ctx.closePath();
  ctx.fill();
  // le fleuron du sommet : trois pétales effilés
  ctx.beginPath();
  ctx.moveTo(0, 0.24);
  ctx.bezierCurveTo(0.02, 0.27, 0.06, 0.28, 0.07, 0.32);
  ctx.bezierCurveTo(0.04, 0.31, 0.02, 0.3, 0, 0.33);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 0.31);
  ctx.bezierCurveTo(0.015, 0.33, 0.012, 0.36, 0, 0.38);
  ctx.closePath();
  ctx.fill();
  // la pampille du bas
  ctx.beginPath();
  ctx.moveTo(0, -0.23);
  ctx.bezierCurveTo(0.03, -0.26, 0.025, -0.29, 0, -0.31);
  ctx.closePath();
  ctx.fill();
}
// le dessin intérieur du médaillon : un filet qui suit l'ogive (couleur du fond) et une tige à feuilles au milieu
function damaskInner(ctx, ground, figure) {
  ctx.strokeStyle = ground;
  ctx.lineWidth = 0.008;
  for (const s of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0.2);
    ctx.bezierCurveTo(s * 0.025, 0.16, s * 0.085, 0.13, s * 0.095, 0.06);
    ctx.bezierCurveTo(s * 0.105, -0.01, s * 0.06, -0.06, s * 0.075, -0.11);
    ctx.bezierCurveTo(s * 0.08, -0.15, s * 0.04, -0.17, 0, -0.2);
    ctx.stroke();
  }
  // la tige et ses feuilles, en creux
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0, 0.13);
  ctx.lineTo(0, -0.14);
  ctx.stroke();
  ctx.fillStyle = ground;
  for (const s of [1, -1]) {
    for (const [y0, k] of [[0.07, 1], [-0.02, 0.85], [-0.1, 0.7]]) {
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.bezierCurveTo(s * 0.03 * k, y0 + 0.01, s * 0.05 * k, y0 + 0.035, s * 0.055 * k, y0 + 0.055);
      ctx.bezierCurveTo(s * 0.03 * k, y0 + 0.045, s * 0.012, y0 + 0.03, 0, y0 + 0.012);
      ctx.fill();
    }
  }
}
// la petite rosace entre deux motifs
function rosette(ctx) {
  for (let k = 0; k < 4; k++) {
    ctx.save();
    ctx.rotate((k * Math.PI) / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(0.02, 0.015, 0.025, 0.04, 0, 0.055);
    ctx.bezierCurveTo(-0.025, 0.04, -0.02, 0.015, 0, 0);
    ctx.fill();
    ctx.restore();
  }
}
function damask(ctx, cx, cy, ground, figure) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.8, 0.8);
  ctx.fillStyle = figure;
  damaskHalf(ctx);
  ctx.scale(-1, 1);
  damaskHalf(ctx);
  ctx.scale(-1, 1);
  damaskInner(ctx, ground, figure);
  ctx.restore();
}
// tout le papier : les motifs, en quinconce (un lé sur deux décalé d'une demi-hauteur), et les rosaces entre eux
function damaskField(ctx, ground, figure, rose) {
  for (let c = 0; c * ROLL < 2.5 + 0.01; c++) {
    const u = c * ROLL + ROLL / 2;
    const off = c % 2 ? DROP / 2 : 0;
    for (let v = HW.RAIL1 + 0.3 - off; v < HW.CORN + DROP; v += DROP) {
      damask(ctx, u, v, ground, figure);
      ctx.save();
      ctx.translate(u + ROLL / 2, v + DROP / 4);
      ctx.fillStyle = rose;
      rosette(ctx);
      ctx.restore();
    }
  }
  // le dernier lé déborde à droite : le même au bord gauche (la face se répète sans couture)
}

// Le cadre du lambris : montants (verticaux), traverses (horizontales) et panneaux, en mètres
function panelRects() {
  const out = []; // { u0, v0, u1, v1, kind: 'stile'|'rail'|'panel' }
  const pw = 2.5 / PANELS;
  for (let k = 0; k <= PANELS; k++) {
    const u = k * pw;
    out.push({ u0: u - STILE / 2, v0: HW.BASE, u1: u + STILE / 2, v1: HW.RAIL0, kind: 'stile' });
  }
  for (let k = 0; k < PANELS; k++) {
    const u0 = k * pw + STILE / 2;
    const u1 = (k + 1) * pw - STILE / 2;
    out.push({ u0, v0: HW.BASE, u1, v1: HW.BASE + STILE * 1.2, kind: 'rail' });
    out.push({ u0, v0: HW.RAIL0 - STILE, u1, v1: HW.RAIL0, kind: 'rail' });
    out.push({ u0, v0: HW.BASE + STILE * 1.2, u1, v1: HW.RAIL0 - STILE, kind: 'panel' });
  }
  return out;
}

// Le mur, en couleur. paper : la photo du papier peint (son grain, ses taches) ; wood : le placage de noyer.
export function drawHotelWall(ctx, S, paper, wood) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // 1. le papier peint : un damas lie-de-vin ton sur ton (le motif en satin un peu plus clair que le fond mat)
  const ground = '#3e0f13';
  const figure = '#4d1619';
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, S, S);
  wallFrame(ctx, S, () => damaskField(ctx, ground, figure, '#471417'));
  // le grain du papier, ses salissures et ses rayures fanées : la photo, en lumière douce
  if (paper) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.85;
    photoRect(ctx, paper, 0, 0, S, Y(S, HW.RAIL1), 2, 2);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.25;
    photoRect(ctx, paper, 0, 0, S, Y(S, HW.RAIL1), 2, 2);
    ctx.restore();
  }
  // les joints des lés : un filet sombre, et sur un joint sur trois le bord qui se soulève (un liseré clair)
  for (let c = 0; c <= 6; c++) {
    const x = X(S, c * ROLL);
    ctx.fillStyle = 'rgba(12, 2, 2, 0.55)';
    ctx.fillRect(x - 0.6, 0, 1.2, Y(S, HW.RAIL1));
    if (c % 3 === 1) {
      ctx.fillStyle = 'rgba(150, 90, 70, 0.22)';
      ctx.fillRect(x + 0.6, Y(S, 2.4), 1.2, Y(S, HW.RAIL1) - Y(S, 2.4));
    }
  }
  // la fumée et les années : le haut du mur plus sombre, et une bande patinée au-dessus de la cimaise (les épaules,
  // les mains, les valises qu'on frotte)
  let g = ctx.createLinearGradient(0, Y(S, HW.CORN), 0, Y(S, 2.0));
  g.addColorStop(0, 'rgba(10, 4, 2, 0.45)');
  g.addColorStop(1, 'rgba(10, 4, 2, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, Y(S, HW.CORN), S, Y(S, 2.0) - Y(S, HW.CORN));
  g = ctx.createLinearGradient(0, Y(S, 1.45), 0, Y(S, HW.RAIL1));
  g.addColorStop(0, 'rgba(25, 12, 6, 0)');
  g.addColorStop(1, 'rgba(25, 12, 6, 0.3)');
  ctx.fillStyle = g;
  ctx.fillRect(0, Y(S, 1.45), S, Y(S, HW.RAIL1) - Y(S, 1.45));

  // 2. le lambris en noyer : les panneaux et les montants au fil vertical, les traverses au fil horizontal
  const woodRect = (r, dark) => {
    const x0 = X(S, r.u0);
    const y0 = Y(S, r.v1);
    const w = X(S, r.u1) - x0;
    const h = Y(S, r.v0) - y0;
    if (wood) photoRect(ctx, wood, x0, y0, w, h, r.kind === 'rail' ? 2 : 1, 1, r.kind !== 'rail');
    else {
      ctx.fillStyle = '#7d5a40';
      ctx.fillRect(x0, y0, w, h);
    }
    return [x0, y0, w, h, dark];
  };
  const rects = panelRects().map((r) => [r, woodRect(r)]);
  // la teinte : noyer sombre, verni, un peu rougeâtre
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#7c3f20';
  ctx.fillRect(0, Y(S, HW.RAIL0), S, S - Y(S, HW.RAIL0));
  ctx.restore();
  // le biseau des panneaux : sa pente du haut prend la lumière (qui vient d'en haut), celle du bas reste dans l'ombre
  for (const [r, [x0, y0, w, h]] of rects) {
    if (r.kind !== 'panel') continue;
    const b = X(S, BEVEL);
    const bv = (Y(S, 0) - Y(S, BEVEL));
    ctx.fillStyle = 'rgba(255, 220, 180, 0.16)';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + w, y0);
    ctx.lineTo(x0 + w - b, y0 + bv);
    ctx.lineTo(x0 + b, y0 + bv);
    ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.moveTo(x0, y0 + h);
    ctx.lineTo(x0 + w, y0 + h);
    ctx.lineTo(x0 + w - b, y0 + h - bv);
    ctx.lineTo(x0 + b, y0 + h - bv);
    ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (const [xa, xb] of [[x0, x0 + b], [x0 + w, x0 + w - b]]) {
      ctx.beginPath();
      ctx.moveTo(xa, y0);
      ctx.lineTo(xb, y0 + bv);
      ctx.lineTo(xb, y0 + h - bv);
      ctx.lineTo(xa, y0 + h);
      ctx.fill();
    }
    // la rainure au pied du cadre
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x0 + 0.6, y0 + 0.6, w - 1.2, h - 1.2);
  }
  // 3. la cimaise : une moulure arrondie, claire sur le dessus, sombre dessous
  const r0 = Y(S, HW.RAIL1);
  const r1 = Y(S, HW.RAIL0);
  if (wood) photoRect(ctx, wood, 0, r0, S, r1 - r0, 3, 1);
  g = ctx.createLinearGradient(0, r0, 0, r1);
  g.addColorStop(0, 'rgba(70, 36, 18, 0.55)');
  g.addColorStop(0.25, 'rgba(120, 70, 40, 0.35)');
  g.addColorStop(0.45, 'rgba(60, 30, 15, 0.55)');
  g.addColorStop(1, 'rgba(8, 3, 1, 0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, r0, S, r1 - r0);
  // 4. la plinthe : plus sombre, une arête biseautée en haut ; le pied noirci par les cireuses
  const b0 = Y(S, HW.BASE);
  if (wood) photoRect(ctx, wood, 0, b0, S, S - b0, 3, 1);
  g = ctx.createLinearGradient(0, b0, 0, S);
  g.addColorStop(0, 'rgba(110, 60, 30, 0.5)');
  g.addColorStop(0.12, 'rgba(30, 14, 6, 0.7)');
  g.addColorStop(0.85, 'rgba(25, 10, 4, 0.75)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(0, b0, S, S - b0);
  // 5. la corniche : plâtre peint crème, ses gradins de moulure, jaunis par la fumée
  const c0 = Y(S, HW.H);
  const c1 = Y(S, HW.CORN);
  ctx.fillStyle = '#a99876';
  ctx.fillRect(0, c0, S, c1 - c0);
  const steps = [[0, 0.06, 0.9], [0.06, 0.1, 0.6], [0.1, 0.15, 1.05], [0.15, 0.17, 0.5], [0.17, 0.2, 0.8]];
  for (const [a, b, k] of steps) {
    ctx.fillStyle = k > 0.8 ? `rgba(255, 245, 220, ${(k - 0.8) * 0.8})` : `rgba(20, 12, 4, ${(0.8 - k) * 0.9})`;
    ctx.fillRect(0, Y(S, HW.H - a), S, Y(S, HW.H - b) - Y(S, HW.H - a));
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, c1 - 1, S, 1.5);
  noise(ctx, 8);
}

// Le relief du mur (gris : 128 = la surface du papier) : le damas floqué en léger relief, les joints des lés,
// les gradins de la corniche, la cimaise bombée, le cadre du lambris en saillie et ses panneaux en biseau, la plinthe.
export function drawHotelWallBump(ctx, S) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgb(118, 118, 118)';
  ctx.fillRect(0, 0, S, S);
  ctx.save();
  ctx.filter = 'blur(0.6px)';
  wallFrame(ctx, S, () => damaskField(ctx, 'rgb(118, 118, 118)', 'rgb(127, 127, 127)', 'rgb(124, 124, 124)'));
  ctx.restore();
  for (let c = 0; c <= 6; c++) {
    ctx.fillStyle = 'rgb(96, 96, 96)';
    ctx.fillRect(X(S, c * ROLL) - 0.6, 0, 1.2, Y(S, HW.RAIL1));
  }
  // la corniche
  const steps = [[0, 0.06, 230], [0.06, 0.1, 190], [0.1, 0.15, 210], [0.15, 0.17, 170], [0.17, 0.2, 150]];
  for (const [a, b, k] of steps) {
    ctx.fillStyle = `rgb(${k}, ${k}, ${k})`;
    ctx.fillRect(0, Y(S, HW.H - a), S, Y(S, HW.H - b) - Y(S, HW.H - a) + 0.5);
  }
  // le lambris : le cadre en saillie, les panneaux en biseau (le fond de la rainure, puis la pente, puis le champ)
  ctx.fillStyle = 'rgb(176, 176, 176)';
  ctx.fillRect(0, Y(S, HW.RAIL0), S, Y(S, HW.BASE) - Y(S, HW.RAIL0));
  for (const r of panelRects()) {
    if (r.kind !== 'panel') continue;
    const x0 = X(S, r.u0);
    const y0 = Y(S, r.v1);
    const w = X(S, r.u1) - x0;
    const h = Y(S, r.v0) - y0;
    const bx = X(S, BEVEL);
    const by = Y(S, 0) - Y(S, BEVEL);
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const k = Math.round(120 + 70 * t);
      ctx.fillStyle = `rgb(${k}, ${k}, ${k})`;
      ctx.fillRect(x0 + bx * t, y0 + by * t, w - 2 * bx * t, h - 2 * by * t);
    }
  }
  // la cimaise : un profil arrondi
  const r0 = Y(S, HW.RAIL1);
  const r1 = Y(S, HW.RAIL0);
  for (let i = 0; i < 12; i++) {
    const t = (i + 0.5) / 12;
    const k = Math.round(170 + 70 * Math.sin(t * Math.PI));
    ctx.fillStyle = `rgb(${k}, ${k}, ${k})`;
    ctx.fillRect(0, r0 + (r1 - r0) * (i / 12), S, (r1 - r0) / 12 + 0.5);
  }
  // la plinthe : en saillie, l'arête du haut en biseau
  const b0 = Y(S, HW.BASE);
  const bb = Y(S, HW.BASE - 0.025);
  const g = ctx.createLinearGradient(0, b0, 0, bb);
  g.addColorStop(0, 'rgb(150, 150, 150)');
  g.addColorStop(1, 'rgb(205, 205, 205)');
  ctx.fillStyle = g;
  ctx.fillRect(0, b0, S, bb - b0);
  ctx.fillStyle = 'rgb(205, 205, 205)';
  ctx.fillRect(0, bb, S, S - bb);
}

// La brillance du mur (rouge : 0 mat, 255 brillant) : le vernis du noyer, le satin du damas, le papier mat
export function drawHotelWallSpec(ctx, S) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgb(18, 18, 18)';
  ctx.fillRect(0, 0, S, S);
  wallFrame(ctx, S, () => damaskField(ctx, 'rgb(18, 18, 18)', 'rgb(42, 42, 42)', 'rgb(34, 34, 34)'));
  ctx.fillStyle = 'rgb(40, 40, 40)';
  ctx.fillRect(0, 0, S, Y(S, HW.CORN));
  ctx.fillStyle = 'rgb(200, 200, 200)';
  ctx.fillRect(0, Y(S, HW.RAIL1), S, S - Y(S, HW.RAIL1));
  // le vernis usé en bas (les chaussures, les aspirateurs) : la plinthe moins brillante
  ctx.fillStyle = 'rgb(120, 120, 120)';
  ctx.fillRect(0, Y(S, HW.BASE), S, S - Y(S, HW.BASE));
  noise(ctx, 30);
}

// La moquette : un velours rouge sang à motif Art déco (éventails, losanges et filets or, pastilles vert sombre), une
// répétition par case de 2,5 m. photo : le grain d'une moquette rase (Carpet011, en gris), qui donne les poils.
export function drawHotelCarpet(ctx, S, photo) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#6a1716';
  ctx.fillRect(0, 0, S, S);
  const n = 4;
  const c = S / n;
  ctx.lineCap = 'round';
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * c;
      const y = j * c;
      // le losange, en double filet or
      for (const [inset, wdt, col] of [[4, 3.2, 'rgba(176, 124, 52, 0.75)'], [9, 1.4, 'rgba(176, 124, 52, 0.6)']]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = wdt;
        ctx.beginPath();
        ctx.moveTo(x + c / 2, y + inset);
        ctx.lineTo(x + c - inset, y + c / 2);
        ctx.lineTo(x + c / 2, y + c - inset);
        ctx.lineTo(x + inset, y + c / 2);
        ctx.closePath();
        ctx.stroke();
      }
      // le champ du losange un peu plus sombre
      ctx.fillStyle = 'rgba(40, 6, 6, 0.28)';
      ctx.beginPath();
      ctx.moveTo(x + c / 2, y + 12);
      ctx.lineTo(x + c - 12, y + c / 2);
      ctx.lineTo(x + c / 2, y + c - 12);
      ctx.lineTo(x + 12, y + c / 2);
      ctx.closePath();
      ctx.fill();
      // l'éventail Art déco : des rayons or sous un arc vert sombre
      const fx = x + c / 2;
      const fy = y + c / 2 + c * 0.13;
      ctx.strokeStyle = 'rgba(176, 124, 52, 0.65)';
      ctx.lineWidth = 1.6;
      for (let k = 0; k <= 6; k++) {
        const a = Math.PI * (1.15 + (0.7 * k) / 6);
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + Math.cos(a) * c * 0.3, fy + Math.sin(a) * c * 0.3);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(22, 52, 42, 0.85)';
      ctx.lineWidth = 3;
      for (const r of [c * 0.31, c * 0.24]) {
        ctx.beginPath();
        ctx.arc(fx, fy, r, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      // aux pointes du losange, une pastille verte cerclée d'or
      for (const [px, py] of [[x, y], [x + c, y], [x, y + c], [x + c, y + c]]) {
        ctx.fillStyle = 'rgba(22, 52, 42, 0.9)';
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(176, 124, 52, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }
  // les poils : le grain de la photo, multiplié (les motifs en prennent aussi la texture), puis un peu de lumière
  // douce pour les reflets du velours
  if (photo) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.9;
    photoRect(ctx, photo, 0, 0, S, S, 2, 2);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.5;
    photoRect(ctx, photo, 0, 0, S, S, 2, 2);
    ctx.restore();
  }
  noise(ctx, 14);
}

// Le plafond : plâtre peint crème, jauni par la fumée (photo : un plafond de plâtre)
export function drawHotelCeiling(ctx, S, photo) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#b4a27e';
  ctx.fillRect(0, 0, S, S);
  if (photo) {
    ctx.save();
    ctx.globalCompositeOperation = 'luminosity';
    ctx.globalAlpha = 0.55;
    photoRect(ctx, photo, 0, 0, S, S, 1, 1);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d6c4a0';
    ctx.fillRect(0, 0, S, S);
    ctx.restore();
  }
  noise(ctx, 6);
}
