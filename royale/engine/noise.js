// Bruit simplexe 2D à graine (relief, forêts, rivages). Uniquement + − × ÷ et floor : le même résultat sur tous les
// navigateurs, ce qui permet à chacun de reconstruire la même île à partir de la seule graine.
import { makeRng } from './rng.js';

const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
const GX = [1, -1, 1, -1, 1, -1, 0, 0], GY = [1, 1, -1, -1, 0, 0, 1, -1];

export function makeNoise(seed) {
  const r = makeRng(seed);
  const p = r.shuffle([...Array(256).keys()]);
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  // simplexe : environ [-1, 1]
  function n2(x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s), j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = perm[ii + perm[jj]] & 7; t0 *= t0; n += t0 * t0 * (GX[g] * x0 + GY[g] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = perm[ii + i1 + perm[jj + j1]] & 7; t1 *= t1; n += t1 * t1 * (GX[g] * x1 + GY[g] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = perm[ii + 1 + perm[jj + 1]] & 7; t2 *= t2; n += t2 * t2 * (GX[g] * x2 + GY[g] * y2); }
    return 70 * n;
  }
  // somme d'octaves, ramenée dans [-1, 1]
  function fbm(x, y, oct = 4) {
    let s = 0, a = 1, f = 1, tot = 0;
    for (let o = 0; o < oct; o++) { s += a * n2(x * f, y * f); tot += a; a *= 0.5; f *= 2; }
    return s / tot;
  }
  // crêtes (montagnes) : environ [0, 1], arêtes vives
  function ridged(x, y, oct = 5) {
    let s = 0, a = 0.5, f = 1, w = 1;
    for (let o = 0; o < oct; o++) {
      let n = 1 - Math.abs(n2(x * f, y * f));
      n *= n; n *= w;
      w = n * 2 > 1 ? 1 : n * 2;
      s += n * a; a *= 0.5; f *= 2;
    }
    return s;
  }
  return { n2, fbm, ridged };
}
