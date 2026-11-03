// Le monde vu par le moteur : la carte courante (vrai relief, navires, piste), l'île d'Island Rush posée en mer
// (relief et bâtiments), et les nuages (mêmes partout, tirés d'une graine).
// Moteur pur : sert au jeu, aux tests et au rendu. La carte doit être chargée avant (loadMap).
import { buildArchipel, heightAt } from './archipel.js';

export const CLOUD_BASE = 470;
const CELL_M = 40;      // grille des obstacles (toits, ponts, navires)
const CLOUD_CELL = 400; // grille des nuages

const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

// Petits cumulus et grands bancs sur toute la carte, et le banc bas que traverse le transport (sa base est plus basse)
export function generateClouds(small = 380, banks = 66) {
  const A = buildArchipel(), list = [], X0 = A.x0 - 500, Z0 = A.z0 - 500, S = A.size + 1000;
  for (let c = 0; c < small; c++) { const R = 35 + hash(c, 4) * 75; list.push({ i: c, x: X0 + hash(c, 1) * S, z: Z0 + hash(c, 2) * S, R, H: R * 0.8, bank: false }); }
  for (let c = 0; c < banks; c++) { const i = c + 500; list.push({ i, x: X0 + hash(i, 1) * S, z: Z0 + hash(i, 2) * S, R: 170 + hash(i, 4) * 230, H: 80 + hash(i, 5) * 90, bank: true }); }
  const N = A.bank;
  N.path.forEach((p, k) => { if (k % 9 === 0) { const i = 900 + k; list.push({ i, x: p.x + (hash(i, 1) - 0.5) * 120, z: p.z + (hash(i, 2) - 0.5) * 120, R: 230 + hash(i, 4) * 90, H: 150 + hash(i, 5) * 40, bank: true, base: N.base }); } });
  return list;
}

// Une boîte orientée, posée dans la grille des obstacles (un peu large : mieux vaut frôler que traverser)
function stamp(grid, n, s, A) {
  const c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0), top = s.y + s.h, hl = s.len / 2 + 6, hw = s.wid / 2 + 6;
  for (let a = -hl; a <= hl; a += CELL_M / 3) for (let b = -hw; b <= hw; b += CELL_M / 3) {
    const x = s.x + a * c - b * sn, z = s.z + a * sn + b * c, i = Math.floor((x - A.x0) / CELL_M), j = Math.floor((z - A.z0) / CELL_M);
    if (i >= 0 && j >= 0 && i < n && j < n && grid[j * n + i] < top) grid[j * n + i] = top;
  }
}

export function createWorld(map, { clouds } = {}) {
  const size = map.size, cell = map.cell || 4, A = buildArchipel();
  clouds = clouds || generateClouds();
  const n = Math.ceil(A.size / CELL_M), grid = new Float32Array(n * n);
  const CELL = 4; // cases de bâtiments d'Island Rush
  for (const b of map.buildings) {
    const x0 = b.x0 * CELL, z0 = b.z0 * CELL, x1 = (b.x0 + b.w) * CELL, z1 = (b.z0 + b.d) * CELL, top = b.y + b.floors * 3.2 + 2;
    for (let j = Math.floor((z0 - A.z0) / CELL_M); j <= Math.floor((z1 - A.z0) / CELL_M); j++) for (let i = Math.floor((x0 - A.x0) / CELL_M); i <= Math.floor((x1 - A.x0) / CELL_M); i++) {
      if (i >= 0 && j >= 0 && i < n && j < n && grid[j * n + i] < top) grid[j * n + i] = top;
    }
  }
  for (const s of A.structures) stamp(grid, n, s, A);
  const cloudGrid = new Map();
  const key = (i, j) => (i + 64) * 4096 + j + 64;
  let lowBase = CLOUD_BASE;
  for (const c of clouds) {
    lowBase = Math.min(lowBase, c.base ?? CLOUD_BASE);
    const r = c.R * 0.9, i0 = Math.floor((c.x - r) / CLOUD_CELL), i1 = Math.floor((c.x + r) / CLOUD_CELL), j0 = Math.floor((c.z - r) / CLOUD_CELL), j1 = Math.floor((c.z + r) / CLOUD_CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i, j); if (!cloudGrid.has(k)) cloudGrid.set(k, []); cloudGrid.get(k).push(c); }
  }
  // l'île d'Island Rush garde son relief à elle ; ailleurs, celui de la carte
  const islandAt = (x, z) => (x >= 0 && z >= 0 && x < size && z < size ? map.heightAt(x, z) : -Infinity);
  return {
    map, clouds, size, cell, archi: A,
    // fond sous la mer compris (négatif) : pour le rendu de la mer
    seabedAt(x, z) { return Math.max(heightAt(A, x, z), islandAt(x, z)); },
    // hauteur du relief (la mer est à 0)
    groundAt(x, z) { return Math.max(0, heightAt(A, x, z), islandAt(x, z)); },
    // relief + toits, navires et constructions
    obstacleAt(x, z) {
      const g = this.groundAt(x, z), i = Math.floor((x - A.x0) / CELL_M), j = Math.floor((z - A.z0) / CELL_M);
      if (i < 0 || j < 0 || i >= n || j >= n) return g;
      const t = grid[j * n + i];
      return t > g ? t : g;
    },
    // dans un nuage ? (on s'y cache des missiles et des bots)
    inCloud(x, y, z) {
      if (y < lowBase - 4 || y > CLOUD_BASE + 240) return false;
      const list = cloudGrid.get(key(Math.floor(x / CLOUD_CELL), Math.floor(z / CLOUD_CELL)));
      if (!list) return false;
      for (const c of list) {
        const dx = x - c.x, dz = z - c.z, d2 = (dx * dx + dz * dz) / (c.R * c.R * 0.81), b = c.base ?? CLOUD_BASE;
        if (d2 < 1 && y >= b - 4 && y < b + 12 + c.H * (1 - d2)) return true;
      }
      return false;
    },
  };
}
