// Island Rush — les chemins des bots. Une grille de 1 m sur toute l'île (rez-de-chaussée des bâtiments compris) et
// une petite grille par étage et par toit accessible ; chaque nœud est libre ou bouché pour quelqu'un debout. Les
// escaliers relient les étages (du palier bas au palier haut). Recherche A* bornée, chemin lissé en lignes droites.
// Les portes fermées comptent comme libres : les bots les ouvrent en passant. Un mur cassé, un arbre abattu ou une
// construction met la grille à jour (world.watch). Moteur PUR, utilisé seulement là où la partie tourne.
import { CELL } from './buildings.js';
import { floorY, levelH } from './world.js';
import { WATER } from './map.js';

const MARGIN = 0.4;           // marge autour des obstacles (un peu plus que le rayon d'un joueur ; les portes passent)
const LOW = 0.5, HIGH = 1.7;  // tranche de hauteur qui gêne (au-dessus des pieds) : la marche franchie, la tête
const SOLID = 1, FIXED = 2, SWIM = 4, TEMP = 8, BLOCK = SOLID | FIXED | TEMP;
const BUDGET = 24000;         // nœuds visités au plus par recherche
const SQ2 = Math.SQRT2;
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [-1, -1, SQ2]];

export function createNav(map, world, { r: R = MARGIN } = {}) {
  const S = map.size, W = S + 1;
  const ground = new Uint8Array(W * W);
  const layers = [{ off: 0, x0: 0, z0: 0, w: W, h: W, a: ground, b: null, k: 0, y: null }];
  let total = W * W;
  // bâtiments par case de 4 m (pour savoir sur quel étage on est)
  const GN = Math.ceil(S / CELL), bAt = new Int16Array(GN * GN).fill(-1);
  const byBK = new Map();
  for (const b of map.buildings) {
    for (let j = b.z0; j < b.z0 + b.d; j++) for (let i = b.x0; i < b.x0 + b.w; i++) bAt[j * GN + i] = b.id;
    const K = b.roofHatch ? b.floors : b.floors - 1;
    for (let k = 1; k <= K; k++) {
      const w = b.w * CELL + 1, h = b.d * CELL + 1;
      const L = { off: total, x0: b.x0 * CELL, z0: b.z0 * CELL, w, h, a: new Uint8Array(w * h), b, k, y: floorY(b, k) };
      total += w * h; layers.push(L); byBK.set(b.id * 64 + k, L);
    }
  }
  const bIn = (x, z) => {
    const i = Math.floor(x / CELL), j = Math.floor(z / CELL);
    if (i < 0 || j < 0 || i >= GN || j >= GN) return null;
    const id = bAt[j * GN + i];
    return id >= 0 ? map.buildings[id] : null;
  };
  // bâtiment dont le rectangle (bords compris) contient le point
  const bOn = (x, z) => bIn(x - 0.01, z - 0.01) || bIn(x + 0.01, z + 0.01) || bIn(x - 0.01, z + 0.01) || bIn(x + 0.01, z - 0.01);
  const stand0 = (x, z) => { const b = bOn(x, z); return b ? floorY(b, 0) : map.heightAt(x, z); };

  // ------------------------------------------------------------------ fixe : bords, mer profonde, eau à la nage
  const HR = map.hres, N = map.n;
  for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
    const k = z * W + x;
    if (x < 5 || z < 5 || x > S - 5 || z > S - 5) { ground[k] = FIXED; continue; }
    const v = Math.round(z / HR) * N + Math.round(x / HR), wk = map.water[v];
    if (!wk) continue;
    const depth = map.waterLevel[v] - map.heights[v];
    if (wk === WATER.MER && depth > 2.2) ground[k] = FIXED;
    else if (depth > 1.25) ground[k] = SWIM;
  }
  // falaises : là où le terrain tombe de plus de 2,5 m par mètre, on ne passe pas (on tomberait de haut)
  const Hh = map.heights;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const h = Hh[j * N + i];
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      const ii = i + di, jj = j + dj;
      if (ii >= N || jj >= N || Math.abs(Hh[jj * N + ii] - h) < 2.5 * HR) continue;
      for (let t = 0; t <= HR; t++) {
        const x = i * HR + di * t, z = j * HR + dj * t;
        if (x < W && z < W) ground[z * W + x] |= FIXED;
      }
    }
  }
  // escaliers : la case de la rampe et la trémie au-dessus sont bouchées ; on passe par les liens
  const links = new Map();
  const layerOf = (b, k) => (k === 0 ? layers[0] : byBK.get(b.id * 64 + k) || null);
  const fillRect = (L, X0, Z0, X1, Z1, bit) => {
    for (let z = Math.max(Z0, L.z0); z <= Math.min(Z1, L.z0 + L.h - 1); z++) for (let x = Math.max(X0, L.x0); x <= Math.min(X1, L.x0 + L.w - 1); x++) L.a[(z - L.z0) * L.w + (x - L.x0)] |= bit;
  };
  const stairs = [];
  for (const b of map.buildings) {
    const st = b.stairs;
    if (!st) continue;
    const X0 = st.x * CELL, Z0 = st.z * CELL;
    const K = b.roofHatch ? b.floors : b.floors - 1;
    for (let k = 0; k <= K; k++) {
      const L = layerOf(b, k);
      if (L) fillRect(L, X0, Z0, X0 + CELL, Z0 + CELL, FIXED);
    }
    for (let k = 0; k < K; k++) {
      const lo = layerOf(b, k), hi = layerOf(b, k + 1);
      if (!lo || !hi || !b.levels[k] || !b.levels[k].stairs) continue;
      const cx = X0 + CELL / 2, cz = Z0 + CELL / 2;
      stairs.push({ b, k, lo, hi, bx: cx - st.dx * 3, bz: cz - st.dz * 3, tx: cx + st.dx * 3, tz: cz + st.dz * 3 });
    }
  }

  // ------------------------------------------------------------------ obstacles
  const skip = (s) => s.dead || (s.key && s.key.charCodeAt(0) === 100 && s.key.charCodeAt(1) === 58); // 'd:' : portes
  // pose une forme dans une couche, limitée au rectangle [X0, X1] × [Z0, Z1] (nœuds)
  function raster(s, L, X0, Z0, X1, Z1) {
    for (let z = Math.max(Z0, L.z0); z <= Math.min(Z1, L.z0 + L.h - 1); z++) {
      for (let x = Math.max(X0, L.x0); x <= Math.min(X1, L.x0 + L.w - 1); x++) {
        const i = (z - L.z0) * L.w + (x - L.x0);
        if (L.a[i] & SOLID) continue;
        const y = L.y == null ? stand0(x, z) : L.y;
        if (s.y1 <= y + LOW || s.y0 >= y + HIGH) continue;
        if (world.over(s, x, z, R)) L.a[i] |= SOLID;
      }
    }
  }
  function layersUnder(x0, z0, x1, z1, fn) {
    fn(layers[0]);
    const seen = new Set();
    for (let j = Math.max(0, Math.floor(z0 / CELL)); j <= Math.min(GN - 1, Math.floor(z1 / CELL)); j++) {
      for (let i = Math.max(0, Math.floor(x0 / CELL)); i <= Math.min(GN - 1, Math.floor(x1 / CELL)); i++) {
        const id = bAt[j * GN + i];
        if (id < 0 || seen.has(id)) continue;
        seen.add(id);
        const b = map.buildings[id], K = b.roofHatch ? b.floors : b.floors - 1;
        for (let k = 1; k <= K; k++) fn(byBK.get(id * 64 + k));
      }
    }
  }
  function place(s, X0, Z0, X1, Z1) {
    const [a, b, c, d] = world.bounds(s);
    const x0 = Math.max(X0, Math.ceil(a - R)), z0 = Math.max(Z0, Math.ceil(b - R)), x1 = Math.min(X1, Math.floor(c + R)), z1 = Math.min(Z1, Math.floor(d + R));
    if (x0 > x1 || z0 > z1) return;
    layersUnder(x0 - 1, z0 - 1, x1 + 1, z1 + 1, (L) => {
      // une couche d'étage ne regarde que ce qui est à sa hauteur
      if (L.y != null && (s.y1 <= L.y + LOW || s.y0 >= L.y + HIGH)) return;
      raster(s, L, x0, z0, x1, z1);
    });
  }
  for (const s of world.solids) if (!skip(s)) place(s, 0, 0, S, S);
  // une forme apparaît ou disparaît : on refait la zone
  const dirty = [];
  world.watch((s) => { if (!(s.key && s.key.startsWith('d:'))) dirty.push(world.bounds(s)); });
  function clean() {
    while (dirty.length) {
      const [a, b, c, d] = dirty.pop();
      const X0 = Math.max(0, Math.ceil(a - R)), Z0 = Math.max(0, Math.ceil(b - R)), X1 = Math.min(S, Math.floor(c + R)), Z1 = Math.min(S, Math.floor(d + R));
      layersUnder(X0, Z0, X1, Z1, (L) => {
        for (let z = Math.max(Z0, L.z0); z <= Math.min(Z1, L.z0 + L.h - 1); z++) for (let x = Math.max(X0, L.x0); x <= Math.min(X1, L.x0 + L.w - 1); x++) L.a[(z - L.z0) * L.w + (x - L.x0)] &= ~SOLID;
      });
      world.near((a + c) / 2, (b + d) / 2, Math.max(c - a, d - b) / 2 + R + 1, (s) => { if (!skip(s)) place(s, X0, Z0, X1, Z1); });
    }
  }

  // ------------------------------------------------------------------ nœuds
  const offs = layers.map((L) => L.off);
  function layerAt(id) {
    if (id < W * W) return layers[0];
    let lo = 1, hi = layers.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (offs[m] <= id) lo = m; else hi = m - 1; }
    return layers[lo];
  }
  const nodeOf = (L, x, z) => L.off + (z - L.z0) * L.w + (x - L.x0);
  const flags = (L, x, z) => (x < L.x0 || z < L.z0 || x >= L.x0 + L.w || z >= L.z0 + L.h ? FIXED : L.a[(z - L.z0) * L.w + (x - L.x0)]);
  const free = (L, x, z) => !(flags(L, x, z) & BLOCK);
  // sur quelle couche est ce point (pieds à y) ?
  function layerFor(x, y, z) {
    const b = bIn(x, z);
    if (!b) return layers[0];
    const k = Math.round((y - floorY(b, 0)) / levelH(b));
    return k <= 0 ? layers[0] : byBK.get(b.id * 64 + k) || layers[0];
  }
  // le nœud libre le plus proche (dans un rayon de r mètres)
  function snap(L, x, z, r = 3) {
    const cx = Math.round(x), cz = Math.round(z);
    let best = -1, bd = Infinity;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const nx = cx + dx, nz = cz + dz;
      if (!free(L, nx, nz)) continue;
      const d = (nx - x) ** 2 + (nz - z) ** 2;
      if (d < bd) { bd = d; best = nodeOf(L, nx, nz); }
    }
    return best;
  }
  for (const st of stairs) {
    const a = snap(st.lo, st.bx, st.bz, 1), b = snap(st.hi, st.tx, st.tz, 1);
    if (a < 0 || b < 0) continue;
    if (!links.has(a)) links.set(a, []);
    if (!links.has(b)) links.set(b, []);
    links.get(a).push(b); links.get(b).push(a);
  }
  const posOf = (id) => {
    const L = layerAt(id), i = id - L.off, x = L.x0 + (i % L.w), z = L.z0 + Math.floor(i / L.w);
    return { x, z, L };
  };

  // ------------------------------------------------------------------ A*
  let heapId = new Int32Array(4096), heapF = new Float32Array(4096), heapN = 0;
  function push(id, f) {
    if (heapN >= heapId.length) { const a = new Int32Array(heapId.length * 2); a.set(heapId); heapId = a; const b = new Float32Array(heapF.length * 2); b.set(heapF); heapF = b; }
    let i = heapN++;
    while (i > 0) { const p = (i - 1) >> 1; if (heapF[p] <= f) break; heapId[i] = heapId[p]; heapF[i] = heapF[p]; i = p; }
    heapId[i] = id; heapF[i] = f;
  }
  function pop() {
    const top = heapId[0], lastId = heapId[--heapN], lastF = heapF[heapN];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= heapN) break;
      if (c + 1 < heapN && heapF[c + 1] < heapF[c]) c++;
      if (heapF[c] >= lastF) break;
      heapId[i] = heapId[c]; heapF[i] = heapF[c]; i = c;
    }
    heapId[i] = lastId; heapF[i] = lastF;
    return top;
  }
  // un bot bloqué là où la grille se croyait libre : on bouche ces nœuds un moment
  const temp = [];
  function block(x, y, z, sec, now) {
    const L = layerFor(x, y, z), ix = Math.round(x), iz = Math.round(z);
    if (ix < L.x0 || iz < L.z0 || ix >= L.x0 + L.w || iz >= L.z0 + L.h) return;
    const i = (iz - L.z0) * L.w + (ix - L.x0);
    if (L.a[i] & TEMP) return;
    L.a[i] |= TEMP; temp.push({ L, i, until: now + sec });
  }
  function expire(now) {
    for (let k = temp.length - 1; k >= 0; k--) if (temp[k].until <= now) { temp[k].L.a[temp[k].i] &= ~TEMP; temp.splice(k, 1); }
  }
  // from, to : { x, y, z } ; renvoie { pts: [{ x, z, y, k }], reached, fail? }
  function path(from, to, budget = BUDGET) {
    clean();
    const L0 = layerFor(from.x, from.y, from.z), L1 = layerFor(to.x, to.y, to.z);
    const a = snap(L0, from.x, from.z), goal = snap(L1, to.x, to.z);
    if (a < 0 || goal < 0) return { pts: [], reached: false, n: 0, fail: a < 0 ? 'depart' : 'but' };
    const gp = posOf(goal);
    const hx = gp.x, hz = gp.z, hk = gp.L.k;
    // distance à plat, plus un forfait par étage à monter ou descendre (escalier et tour du palier)
    const h = (x, z, k) => { const dx = Math.abs(x - hx), dz = Math.abs(z - hz); return 1.25 * (dx + dz + (SQ2 - 2) * Math.min(dx, dz) + Math.abs(k - hk) * 12); };
    const g = new Map(), par = new Map();
    heapN = 0;
    g.set(a, 0); par.set(a, -1);
    const ap = posOf(a);
    push(a, h(ap.x, ap.z, ap.L.k));
    let best = a, bh = Infinity, n = 0, found = false;
    while (heapN && n < budget) {
      const id = pop();
      if (id === goal) { found = true; best = id; break; }
      n++;
      const { x, z, L } = posOf(id), gi = g.get(id);
      const hi = h(x, z, L.k);
      if (hi < bh) { bh = hi; best = id; }
      for (const [dx, dz, c] of DIRS) {
        const nx = x + dx, nz = z + dz;
        const f = flags(L, nx, nz);
        if (f & BLOCK) continue;
        // pas de coin coupé en diagonale
        if (dx && dz && (!free(L, x + dx, z) || !free(L, x, z + dz))) continue;
        const nid = nodeOf(L, nx, nz), ng = gi + c * (f & SWIM ? 3 : 1);
        const old = g.get(nid);
        if (old !== undefined && old <= ng) continue;
        g.set(nid, ng); par.set(nid, id);
        push(nid, ng + h(nx, nz, L.k));
      }
      const ln = links.get(id);
      if (ln) for (const nid of ln) {
        const ng = gi + 7, old = g.get(nid);
        if (old !== undefined && old <= ng) continue;
        g.set(nid, ng); par.set(nid, id);
        const q = posOf(nid);
        push(nid, ng + h(q.x, q.z, q.L.k));
      }
    }
    // chemin (jusqu'au but, ou jusqu'au nœud le plus proche du but)
    const ids = [];
    for (let id = best; id !== -1; id = par.get(id)) ids.push(id);
    ids.reverse();
    return { pts: smooth(ids), reached: found, n };
  }
  // ligne droite libre entre deux nœuds d'une même couche ?
  function clear(L, ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.35);
    for (let i = 1; i < n; i++) {
      const t = i / n, x = Math.round(ax + (bx - ax) * t), z = Math.round(az + (bz - az) * t);
      if (flags(L, x, z) & (BLOCK | SWIM)) return false;
    }
    return true;
  }
  function smooth(ids) {
    const P = ids.map(posOf), out = [];
    let i = 0;
    while (i < P.length) {
      const p = P[i];
      out.push({ x: p.x, z: p.z, y: p.L.y, k: p.L.k, b: p.L.b ? p.L.b.id : -1 });
      if (i === P.length - 1) break;
      let j = i + 1;
      // on va le plus loin possible en ligne droite sur la même couche (au plus 40 m)
      for (let t = i + 2; t < P.length && t - i < 60; t++) {
        if (P[t].L !== p.L) break;
        if (Math.hypot(P[t].x - p.x, P[t].z - p.z) > 40) break;
        if (clear(p.L, p.x, p.z, P[t].x, P[t].z)) j = t;
      }
      if (P[j].L !== p.L) { j = i + 1; }
      i = j;
    }
    return out;
  }

  return { path, block, expire, free: (x, y, z) => { const L = layerFor(x, y, z); return free(L, Math.round(x), Math.round(z)); }, layerFor, layers, links, stairs, stand0, total, clean };
}
