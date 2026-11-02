// Le monde vu par le moteur : relief et bâtiments de l'île d'Island Rush, et nuages (mêmes partout, tirés d'une graine).
// Moteur pur : sert au jeu, aux tests et au rendu.

export const CLOUD_BASE = 470;
const CELL_M = 40;      // grille des bâtiments
const CLOUD_CELL = 400; // grille des nuages

const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

// Petits cumulus et grands bancs, en dehors de l'axe de l'île comme au-dessus
export function generateClouds(small = 150, banks = 26) {
  const list = [];
  for (let c = 0; c < small; c++) { const R = 35 + hash(c, 4) * 75; list.push({ i: c, x: hash(c, 1) * 7000 - 2700, z: hash(c, 2) * 7000 - 2700, R, H: R * 0.8, bank: false }); }
  for (let c = 0; c < banks; c++) { const i = c + 500; list.push({ i, x: hash(i, 1) * 7400 - 2900, z: hash(i, 2) * 7400 - 2900, R: 170 + hash(i, 4) * 230, H: 80 + hash(i, 5) * 90, bank: true }); }
  return list;
}

export function createWorld(map, { clouds = generateClouds() } = {}) {
  const size = map.size, cell = map.cell || 4;
  const n = Math.ceil(size / CELL_M), grid = new Float32Array(n * n);
  const CELL = 4; // cases de bâtiments d'Island Rush
  for (const b of map.buildings) {
    const x0 = b.x0 * CELL, z0 = b.z0 * CELL, x1 = (b.x0 + b.w) * CELL, z1 = (b.z0 + b.d) * CELL, top = b.y + b.floors * 3.2 + 2;
    for (let j = Math.floor(z0 / CELL_M); j <= Math.floor(z1 / CELL_M); j++) for (let i = Math.floor(x0 / CELL_M); i <= Math.floor(x1 / CELL_M); i++) {
      if (i >= 0 && j >= 0 && i < n && j < n && grid[j * n + i] < top) grid[j * n + i] = top;
    }
  }
  const cloudGrid = new Map();
  const key = (i, j) => i * 4096 + j;
  for (const c of clouds) {
    const r = c.R * 0.9, i0 = Math.floor((c.x - r) / CLOUD_CELL), i1 = Math.floor((c.x + r) / CLOUD_CELL), j0 = Math.floor((c.z - r) / CLOUD_CELL), j1 = Math.floor((c.z + r) / CLOUD_CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i, j); if (!cloudGrid.has(k)) cloudGrid.set(k, []); cloudGrid.get(k).push(c); }
  }
  return {
    map, clouds, size, cell,
    // hauteur du relief (la mer est à 0 ; au-delà de la carte, tout est plat)
    groundAt(x, z) { return x < 0 || z < 0 || x >= size || z >= size ? 0 : Math.max(0, map.heightAt(x, z)); },
    // relief + toits
    obstacleAt(x, z) {
      const g = this.groundAt(x, z);
      if (x < 0 || z < 0 || x >= size || z >= size) return g;
      const t = grid[Math.floor(z / CELL_M) * n + Math.floor(x / CELL_M)];
      return t > g ? t : g;
    },
    // dans un nuage ? (on s'y cache des missiles et des bots)
    inCloud(x, y, z) {
      if (y < CLOUD_BASE - 4 || y > CLOUD_BASE + 240) return false;
      const list = cloudGrid.get(key(Math.floor(x / CLOUD_CELL), Math.floor(z / CLOUD_CELL)));
      if (!list) return false;
      for (const c of list) {
        const dx = x - c.x, dz = z - c.z, d2 = (dx * dx + dz * dz) / (c.R * c.R * 0.81);
        if (d2 < 1 && y < CLOUD_BASE + 12 + c.H * (1 - d2)) return true;
      }
      return false;
    },
  };
}
