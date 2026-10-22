// Géométrie : cercles contre rectangles alignés, rayons, lignes de vue.

// Repousse le cercle c {x,y,r} hors du rectangle b {x,y,w,h}. Renvoie la normale si contact, sinon null.
export function pushOutRect(c, b) {
  const nx = Math.max(b.x, Math.min(c.x, b.x + b.w));
  const ny = Math.max(b.y, Math.min(c.y, b.y + b.h));
  let dx = c.x - nx, dy = c.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= c.r * c.r) return null;
  if (d2 > 1e-6) {
    const d = Math.sqrt(d2), push = c.r - d;
    dx /= d; dy /= d;
    c.x += dx * push; c.y += dy * push;
    return { nx: dx, ny: dy };
  }
  // centre à l'intérieur : sortir par le côté le plus proche
  const l = c.x - b.x, r = b.x + b.w - c.x, t = c.y - b.y, bo = b.y + b.h - c.y;
  const m = Math.min(l, r, t, bo);
  if (m === l) { c.x = b.x - c.r; return { nx: -1, ny: 0 }; }
  if (m === r) { c.x = b.x + b.w + c.r; return { nx: 1, ny: 0 }; }
  if (m === t) { c.y = b.y - c.r; return { nx: 0, ny: -1 }; }
  c.y = b.y + b.h + c.r; return { nx: 0, ny: 1 };
}

// Intersection segment (x0,y0)+t·(dx,dy), t∈[0,1], avec un rectangle élargi de pad. Renvoie {t, nx, ny} ou null.
export function segRect(x0, y0, dx, dy, b, pad = 0) {
  const minX = b.x - pad, maxX = b.x + b.w + pad, minY = b.y - pad, maxY = b.y + b.h + pad;
  let tmin = 0, tmax = 1, nx = 0, ny = 0;
  if (Math.abs(dx) < 1e-9) { if (x0 < minX || x0 > maxX) return null; }
  else {
    let t1 = (minX - x0) / dx, t2 = (maxX - x0) / dx, n = -1;
    if (t1 > t2) { [t1, t2] = [t2, t1]; n = 1; }
    if (t1 > tmin) { tmin = t1; nx = n; ny = 0; }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (Math.abs(dy) < 1e-9) { if (y0 < minY || y0 > maxY) return null; }
  else {
    let t1 = (minY - y0) / dy, t2 = (maxY - y0) / dy, n = -1;
    if (t1 > t2) { [t1, t2] = [t2, t1]; n = 1; }
    if (t1 > tmin) { tmin = t1; nx = 0; ny = n; }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (tmin === 0 && nx === 0 && ny === 0) return { t: 0, nx: -Math.sign(dx), ny: -Math.sign(dy), inside: true };
  return { t: tmin, nx, ny };
}

// Intersection segment / cercle : plus petit t∈[0,1] ou -1
export function segCircle(x0, y0, dx, dy, cx, cy, r) {
  const fx = x0 - cx, fy = y0 - cy;
  const a = dx * dx + dy * dy;
  if (a < 1e-9) return fx * fx + fy * fy <= r * r ? 0 : -1;
  const b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  const t = (-b - s) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}

// Premier obstacle solide touché par le segment : {t, nx, ny, solid} ou null
export function raycastSolids(solids, x0, y0, x1, y1, pad = 0) {
  const dx = x1 - x0, dy = y1 - y0;
  let best = null;
  for (const s of solids) {
    if (s.low) continue; // obstacles bas (tables, caisses) : on tire et on voit par-dessus
    const h = segRect(x0, y0, dx, dy, s, pad);
    if (h && (!best || h.t < best.t)) { best = h; best.solid = s; }
  }
  return best;
}

export function lineOfSight(solids, x0, y0, x1, y1) {
  return !raycastSolids(solids, x0, y0, x1, y1, 0);
}

export const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
