// The Backrooms (Level 0) - Génération de la carte du dédale
// Grille de cases, pièces interconnectées, 5 cassettes VHS et 1 porte de sortie.

export const CELL_SIZE = 2.5; // chaque case fait 2.5m x 2.5m
export const WALL_HEIGHT = 3.2; // hauteur sous plafond

export const T = {
  EMPTY: 0,
  FLOOR: 1,
  WALL: 2,
  EXIT: 3,
};

export function createBackroomsMap(seed = 42) {
  const W = 28;
  const H = 28;
  const grid = new Uint8Array(W * H);
  
  // Remplir de murs au départ
  grid.fill(T.WALL);

  // Générateur pseudo-aléatoire simple pour reproductibilité
  let s = (seed * 9301 + 49297) % 233280;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const get = (x, z) => (x < 0 || x >= W || z < 0 || z >= H ? T.WALL : grid[z * W + x]);
  const set = (x, z, val) => {
    if (x >= 0 && x < W && z >= 0 && z < H) grid[z * W + x] = val;
  };

  // Creuser un réseau de pièces typique des Backrooms Level 0
  const rooms = [];
  const roomCount = 18;

  for (let i = 0; i < roomCount; i++) {
    const rw = 3 + Math.floor(rnd() * 4); // 3 à 6 cases
    const rh = 3 + Math.floor(rnd() * 4);
    const rx = 2 + Math.floor(rnd() * (W - rw - 4));
    const rz = 2 + Math.floor(rnd() * (H - rh - 4));

    rooms.push({ x: rx, z: rz, w: rw, h: rh, cx: rx + Math.floor(rw / 2), cz: rz + Math.floor(rh / 2) });

    for (let z = rz; z < rz + rh; z++) {
      for (let x = rx; x < rx + rw; x++) {
        set(x, z, T.FLOOR);
      }
    }
    // Occasionnellement ajouter un pilier/colonne centrale typique
    if (rw >= 4 && rh >= 4 && rnd() < 0.6) {
      set(rx + Math.floor(rw / 2), rz + Math.floor(rh / 2), T.WALL);
    }
  }

  // Relier les pièces par des couloirs labyrinthiques
  for (let i = 0; i < rooms.length - 1; i++) {
    const r1 = rooms[i];
    const r2 = rooms[i + 1];

    let cx = r1.cx;
    let cz = r1.cz;

    while (cx !== r2.cx) {
      set(cx, cz, T.FLOOR);
      cx += cx < r2.cx ? 1 : -1;
    }
    while (cz !== r2.cz) {
      set(cx, cz, T.FLOOR);
      cz += cz < r2.cz ? 1 : -1;
    }
  }

  // Ajouter des boucles supplémentaires pour créer un vrai dédale
  for (let k = 0; k < 12; k++) {
    const rA = rooms[Math.floor(rnd() * rooms.length)];
    const rB = rooms[Math.floor(rnd() * rooms.length)];
    let cx = rA.cx;
    let cz = rA.cz;
    while (cx !== rB.cx) {
      set(cx, cz, T.FLOOR);
      cx += cx < rB.cx ? 1 : -1;
    }
    while (cz !== rB.cz) {
      set(cx, cz, T.FLOOR);
      cz += cz < rB.cz ? 1 : -1;
    }
  }

  // Lister toutes les cases praticables
  const walkable = [];
  for (let z = 1; z < H - 1; z++) {
    for (let x = 1; x < W - 1; x++) {
      if (grid[z * W + x] === T.FLOOR) {
        walkable.push({ x, z });
      }
    }
  }

  // Choisir le point de spawn du joueur (dans la première pièce garantie praticable)
  set(rooms[0].cx, rooms[0].cz, T.FLOOR);
  const spawn = {
    x: (rooms[0].cx + 0.5) * CELL_SIZE,
    z: (rooms[0].cz + 0.5) * CELL_SIZE,
    gx: rooms[0].cx,
    gz: rooms[0].cz,
  };

  // Choisir l'emplacement de la porte de Sortie (dans la dernière pièce garantie praticable)
  const farRoom = rooms[rooms.length - 1];
  set(farRoom.cx, farRoom.cz, T.FLOOR);
  const exit = {
    x: (farRoom.cx + 0.5) * CELL_SIZE,
    z: (farRoom.cz + 0.5) * CELL_SIZE,
    gx: farRoom.cx,
    gz: farRoom.cz,
  };

  // Placer 5 cassettes VHS réparties dans les différents recoins du dédale
  const cassettes = [];
  const quadrants = [
    { minX: 2, maxX: Math.floor(W / 2), minZ: 2, maxZ: Math.floor(H / 2) },
    { minX: Math.floor(W / 2), maxX: W - 2, minZ: 2, maxZ: Math.floor(H / 2) },
    { minX: 2, maxX: Math.floor(W / 2), minZ: Math.floor(H / 2), maxZ: H - 2 },
    { minX: Math.floor(W / 2), maxX: W - 2, minZ: Math.floor(H / 2), maxZ: H - 2 },
    { minX: Math.floor(W / 3), maxX: Math.floor((2 * W) / 3), minZ: Math.floor(H / 3), maxZ: Math.floor((2 * H) / 3) },
  ];

  for (let i = 0; i < 5; i++) {
    const q = quadrants[i];
    const candidates = walkable.filter(
      (c) =>
        c.x >= q.minX &&
        c.x <= q.maxX &&
        c.z >= q.minZ &&
        c.z <= q.maxZ &&
        Math.hypot(c.x - rooms[0].cx, c.z - rooms[0].cz) > 4
    );

    const chosen = candidates.length > 0 ? candidates[Math.floor(rnd() * candidates.length)] : walkable[Math.floor(rnd() * walkable.length)];
    cassettes.push({
      id: i,
      gx: chosen.x,
      gz: chosen.z,
      x: (chosen.x + 0.5) * CELL_SIZE,
      z: (chosen.z + 0.5) * CELL_SIZE,
      name: `Cassette VHS #${i + 1}`,
      collected: false,
    });
  }

  // Point de départ du monstre / entité (très éloigné du joueur au départ)
  let bestDist = 0;
  let monsterSpawn = walkable[0];
  for (const c of walkable) {
    const d = Math.hypot(c.x - rooms[0].cx, c.z - rooms[0].cz);
    if (d > bestDist) {
      bestDist = d;
      monsterSpawn = c;
    }
  }

  // Emplacement des néons / lumières au plafond
  const lights = [];
  for (let z = 2; z < H - 2; z += 3) {
    for (let x = 2; x < W - 2; x += 3) {
      if (grid[z * W + x] === T.FLOOR) {
        lights.push({
          x: (x + 0.5) * CELL_SIZE,
          y: WALL_HEIGHT - 0.2,
          z: (z + 0.5) * CELL_SIZE,
          flicker: rnd() < 0.2, // 20% des néons grésillent/scintillent
        });
      }
    }
  }

  return {
    W,
    H,
    grid,
    walkable,
    spawn,
    exit,
    cassettes,
    lights,
    monsterSpawn: {
      x: (monsterSpawn.x + 0.5) * CELL_SIZE,
      z: (monsterSpawn.z + 0.5) * CELL_SIZE,
      gx: monsterSpawn.x,
      gz: monsterSpawn.z,
    },
    isWall(gx, gz) {
      if (gx < 0 || gx >= W || gz < 0 || gz >= H) return true;
      return grid[gz * W + gx] === T.WALL;
    },
    isWalkableWorld(wx, wz) {
      const gx = Math.floor(wx / CELL_SIZE);
      const gz = Math.floor(wz / CELL_SIZE);
      return !this.isWall(gx, gz);
    },
  };
}
