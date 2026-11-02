// Mystère Mystère : chemins des bots. Un nœud par case praticable et par niveau ; les cases d'escalier existent dans
// deux niveaux, on les range dans celui dont la marche est la plus proche (comme le moteur). Les passages secrets
// fermés comptent comme praticables mais coûtent un peu plus : le bot devra appuyer sur E pour les ouvrir.
import { W, H, LEVELS, LV_Y, T, li, idx, stairY, levelFor, STEP } from './map.js';

const N = W * H;
const key = (lv, i) => li(lv) * N + i;
export const nodeLv = (k) => Math.floor(k / N) - 1;
export const nodeCell = (k) => k % N;

export function buildNav(M) {
  const heightOf = (lv, i) => { const L = li(lv), s = M.stairAt[L][i]; return s >= 0 ? stairY(M.stairs[s], (i % W) + 0.5, Math.floor(i / W) + 0.5) : LV_Y[L]; };
  const walkable = (lv, i) => { const t = M.t[li(lv)][i]; return t === T.FLOOR || t === T.STAIR || t === T.PASS; };
  // nœud canonique d'une case vue depuis le niveau lv
  const canon = (lv, i) => { const h = heightOf(lv, i); return key(levelFor(M, lv, (i % W) + 0.5, Math.floor(i / W) + 0.5, h), i); };
  const adj = new Map();
  const add = (a, b, c) => { let l = adj.get(a); if (!l) adj.set(a, l = []); if (!l.some((e) => e[0] === b)) l.push([b, c]); };
  const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  for (const lv of LEVELS) {
    const L = li(lv);
    for (let i = 0; i < N; i++) {
      if (!walkable(lv, i)) continue;
      const a = canon(lv, i);
      if (nodeLv(a) !== lv) continue; // une case d'escalier n'est traitée qu'une fois, depuis son niveau canonique
      const x = i % W, z = Math.floor(i / W), ha = heightOf(lv, i);
      // depuis une rampe, on peut sortir sur les deux niveaux de l'escalier
      const st = M.stairAt[L][i] >= 0 ? M.stairs[M.stairAt[L][i]] : null;
      const lvs = st ? [st.lo, st.hi] : [lv];
      for (const lvb of lvs) {
        for (const [dx, dz, c] of D) {
          const bx = x + dx, bz = z + dz;
          if (bx < 0 || bz < 0 || bx >= W || bz >= H) continue;
          const j = idx(bx, bz);
          if (!walkable(lvb, j)) continue;
          if (dx && dz && (!walkable(lvb, idx(x + dx, z)) || !walkable(lvb, idx(x, z + dz)) || M.t[li(lvb)][idx(x + dx, z)] === T.PASS || M.t[li(lvb)][idx(x, z + dz)] === T.PASS)) continue;
          const hb = heightOf(lvb, j);
          if (Math.abs(hb - ha) > 0.55) continue;
          if (dx && dz && (M.t[li(lvb)][j] === T.STAIR || M.t[L][i] === T.STAIR)) continue;
          const b = canon(lvb, j);
          const extra = M.t[li(lvb)][j] === T.PASS ? 4 : 0;
          add(a, b, c + extra);
        }
      }
    }
  }
  // les liens sont symétriques
  for (const [a, l] of [...adj]) for (const [b, c] of l) add(b, a, c);
  return { adj, key, canon, heightOf };
}

// A* : liste de nœuds du départ à l'arrivée (ou null)
export function findPath(nav, from, to, maxIter = 9000) {
  if (from === to) return [to];
  const pos = (k) => { const i = nodeCell(k); return [(i % W) + 0.5, Math.floor(i / W) + 0.5, LV_Y[li(nodeLv(k))]]; };
  const [tx, tz, ty] = pos(to);
  const h = (k) => { const [x, z, y] = pos(k); return Math.hypot(x - tx, z - tz) + Math.abs(y - ty) * 1.5; };
  const g = new Map([[from, 0]]), came = new Map();
  const heap = [[h(from), from]];
  const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const closed = new Set();
  let it = 0;
  while (heap.length && it++ < maxIter) {
    const [, cur] = pop();
    if (cur === to) { const out = [cur]; let c = cur; while (came.has(c)) { c = came.get(c); out.push(c); } return out.reverse(); }
    if (closed.has(cur)) continue;
    closed.add(cur);
    const l = nav.adj.get(cur); if (!l) continue;
    const gc = g.get(cur);
    for (const [nb, c] of l) {
      const ng = gc + c;
      if (ng < (g.get(nb) ?? Infinity)) { g.set(nb, ng); came.set(nb, cur); push([ng + h(nb), nb]); }
    }
  }
  return null;
}
// le nœud où se trouve quelqu'un
export function nodeOf(nav, M, lv, x, z, y) {
  const i = idx(Math.max(0, Math.min(W - 1, Math.floor(x))), Math.max(0, Math.min(H - 1, Math.floor(z))));
  const k = nav.canon(lv, i);
  if (nav.adj.has(k)) return k;
  // tout contre un meuble : la case libre la plus proche
  let best = null, bd = 9;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const cx = Math.floor(x) + dx, cz = Math.floor(z) + dz;
    if (cx < 0 || cz < 0 || cx >= W || cz >= H) continue;
    const kk = nav.canon(lv, idx(cx, cz));
    if (!nav.adj.has(kk)) continue;
    const d = Math.hypot(cx + 0.5 - x, cz + 0.5 - z);
    if (d < bd) { bd = d; best = kk; }
  }
  return best;
}
export function nodePos(k) { const i = nodeCell(k); return { lv: nodeLv(k), x: (i % W) + 0.5, z: Math.floor(i / W) + 0.5 }; }
