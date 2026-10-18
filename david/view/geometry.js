// Géométrie du plateau, dans un repère fixe de 880 × 880 px (le plateau est ensuite mis à l'échelle).
export const SIZE = 880, CORNER = 116, CELL = 72;

export function side(i) {
  if (i % 10 === 0) return 'corner';
  if (i < 10) return 'bottom';
  if (i < 20) return 'left';
  if (i < 30) return 'top';
  return 'right';
}

// Rectangle de la case i (Départ en bas à droite, sens des aiguilles d'une montre vu du dessus).
export function rect(i) {
  const E = SIZE - CORNER;
  if (i === 0) return { x: E, y: E, w: CORNER, h: CORNER };
  if (i < 10) return { x: E - i * CELL, y: E, w: CELL, h: CORNER };
  if (i === 10) return { x: 0, y: E, w: CORNER, h: CORNER };
  if (i < 20) return { x: 0, y: E - (i - 10) * CELL, w: CORNER, h: CELL };
  if (i === 20) return { x: 0, y: 0, w: CORNER, h: CORNER };
  if (i < 30) return { x: CORNER + (i - 21) * CELL, y: 0, w: CELL, h: CORNER };
  if (i === 30) return { x: E, y: 0, w: CORNER, h: CORNER };
  return { x: E, y: CORNER + (i - 31) * CELL, w: CORNER, h: CELL };
}

export function center(i) {
  const r = rect(i);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

// Place d'un pion sur sa case quand plusieurs joueurs la partagent.
// En prison, les pions vont dans la cellule ; en simple visite, sur le bord extérieur.
export function pawnSpot(i, k, n, inJail) {
  const r = rect(i);
  if (i === 10) {
    if (inJail) return { x: r.x + 64 + (k % 2) * 26, y: r.y + 26 + Math.floor(k / 2) * 22 };
    const pts = [[16, 30], [16, 62], [16, 94], [44, 102], [76, 102], [104, 102]];
    const [px, py] = pts[k % pts.length];
    return { x: r.x + px, y: r.y + py };
  }
  // partie extérieure de la case (loin de la bande de couleur)
  const c = center(i), s = side(i);
  let ox = 0, oy = 0;
  if (s === 'bottom') oy = 22; else if (s === 'top') oy = -22; else if (s === 'left') ox = -22; else if (s === 'right') ox = 22;
  const cols = n <= 2 ? n : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols);
  const gx = (k % cols) - (cols - 1) / 2, gy = Math.floor(k / cols) - (rows - 1) / 2;
  const sp = s === 'corner' ? 30 : 24;
  return { x: c.x + ox + gx * sp, y: c.y + oy + gy * sp };
}

// Emplacements des bâtiments sur la bande de couleur (côté intérieur du plateau)
export function buildSpots(i, count, hotel) {
  const r = rect(i), s = side(i);
  const along = s === 'bottom' || s === 'top';
  const band = 24;
  const bx = s === 'left' ? r.x + r.w - band / 2 : s === 'right' ? r.x + band / 2 : r.x + r.w / 2;
  const by = s === 'bottom' ? r.y + band / 2 : s === 'top' ? r.y + r.h - band / 2 : r.y + r.h / 2;
  if (hotel) return [{ x: bx, y: by }];
  const pts = [];
  const gap = along ? 15 : 16;
  for (let k = 0; k < count; k++) {
    const off = (k - (count - 1) / 2) * gap;
    pts.push(along ? { x: bx + off, y: by } : { x: bx, y: by + off });
  }
  return pts;
}

// Case qui contient le point (x, y) du plateau, ou -1
export function cellAt(x, y) {
  for (let i = 0; i < 40; i++) { const r = rect(i); if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i; }
  return -1;
}

// Homographie : transforme les 4 points src en dst (résolution du système 8 × 8 par Gauss)
export function homography(src, dst) {
  const A = [], b = [];
  for (let k = 0; k < 4; k++) {
    const [x, y] = src[k], [u, v] = dst[k];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  for (let c = 0; c < 8; c++) {
    let piv = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const h = b.map((v, k) => v / A[k][k]);
  return (x, y) => { const w = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };
}
