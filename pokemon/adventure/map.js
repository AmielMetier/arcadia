// pokemon/adventure/map.js
// Carte du Monde 5G Unys (64x64 tuiles de 32x32px = 2048x2048px) pour PhaserJS 3
// Combinant les 3 packs d'assets 5G officiels :
// 1. tileset_global.png (Dirtywiggles - Unys 5G : routes pavées, herbes, fontaines, lampadaires, clôtures, arbres)
// 2. tileset_buildings.png (WesleyFG - Bâtiments 5G : Centre Pokémon, Boutique, Labo, Arène, Maisons d'Unys)
// 3. tileset_nature.png (Relic Castle / Paradigmi - Nature 5G : forêts denses, fleurs, hautes herbes, ponts en bois)

export const TILE_SIZE = 32;
export const MAP_WIDTH = 64;
export const MAP_HEIGHT = 64;

export const TILE = {
  GRASS: 0,
  GRASS_TALL: 1,
  PATH_COBBLESTONE: 2,
  SAND: 3,
  WATER: 4,
  WALL_VILLA: 5,
  ROOF_TERRACOTTA: 6,
  DOOR: 7,
  TREE_PINE: 8,
  TREE_PALM: 9,
  LEMON_TREE: 10,
  FLOWER_RED: 11,
  LAB_TABLE: 12,
  NURSE_DESK: 13,
  PC_BOX: 14,
  SIGN: 15,
  BRIDGE: 16,
  FENCE: 17,
  FOUNTAIN: 18,
  ROOF_BLUE: 19,
  ROOF_RED: 20,
  MART_DESK: 21,
  FLOOR_WOOD: 22,
  GYM_WALL: 23,
  ROOF_GOLD: 24,
  EXIT_MAT: 25,
  WALL_INDOOR: 26,
  BOOKSHELF: 27,
  POTTED_PLANT: 28,
  FLOOR_CENTER: 29,
  FLOOR_MART: 30,
  FLOOR_GYM: 31
};

export const SOLID_TILES = new Set([
  TILE.WATER,
  TILE.WALL_VILLA,
  TILE.ROOF_TERRACOTTA,
  TILE.ROOF_BLUE,
  TILE.ROOF_RED,
  TILE.ROOF_GOLD,
  TILE.GYM_WALL,
  TILE.TREE_PINE,
  TILE.TREE_PALM,
  TILE.LEMON_TREE,
  TILE.LAB_TABLE,
  TILE.NURSE_DESK,
  TILE.PC_BOX,
  TILE.MART_DESK,
  TILE.SIGN,
  TILE.FENCE,
  TILE.FOUNTAIN,
  TILE.WALL_INDOOR,
  TILE.BOOKSHELF,
  TILE.POTTED_PLANT
]);

export const SIGNPOSTS = {
  '13,43': [
    "VILLAGE DE RENOUET-SUD (UNYS)",
    "À l'Ouest : Laboratoire du Professeur Platane.",
    "À l'Est : Grande Route 1 d'Unys vers la Cité d'Ogoesse."
  ],
  '25,42': [
    "ROUTE 1 D'UNYS — SENTIER DES HAUTES HERBES",
    "Attention : des Pokémon sauvages vivent dans les hautes herbes !",
    "Suivez la route vers le Nord et traversez le Pont en bois."
  ],
  '40,36': [
    "PONT DE LA RIVIÈRE D'UNYS",
    "Au Nord : Cité d'Ogoesse (Centre Pokémon, Boutique & Arène Officielle)."
  ],
  '19,12': [
    "CITÉ D'OGOESSE — QUARTIER DES DRESSEURS",
    "Centre Pokémon (Soin & PC) et Boutique Pokémon (Balls & Potions)."
  ],
  '39,10': [
    "ARÈNE POKÉMON D'UNYS",
    "Championne en titre : Solène.",
    "Franchissez la porte de l'Arène pour tenter de remporter le Badge Officiel !"
  ]
};

// ============================================================================
// DESCRIPTIONS STRUCTURÉES POUR LE RENDU MULTI-COUCHES PHASERJS (64x64)
// ============================================================================

// Zones pavées / routes (rendues en 9-slice dans PhaserJS)
export const WORLD_REGIONS = {
  // Places pavées en pierre blanche d'Unys (tileset_global C3..C5, R103..R105)
  cobblePlazas: [
    { x: 5, y: 37, w: 19, h: 18 },   // Place du Village de départ (Sud-Ouest)
    { x: 10, y: 4, w: 40, h: 12 },   // Grande Cité du Nord (Centre, Boutique, Mairie, Arène)
  ],
  // Parvis en briques chaudes d'Unys (tileset_global C0..C2, R123..R125)
  brickPlazas: [
    { x: 10, y: 43, w: 9, h: 6 },    // Parvis de la Fontaine du Village
    { x: 39, y: 11, w: 10, h: 4 },   // Parvis d'honneur devant l'Arène
  ],
  // Sentiers en terre battue / sable de la Route 1 (tileset_nature C0..C2, R10..R12)
  dirtRoutes: [
    { x: 23, y: 43, w: 22, h: 4 },   // Route 1 Sud (sortie Est du Village)
    { x: 41, y: 35, w: 4, h: 11 },   // Approche Sud du Pont
    { x: 41, y: 23, w: 4, h: 9 },    // Sortie Nord du Pont
    { x: 29, y: 23, w: 15, h: 4 },   // Bifurcation vers le Relais de la Route 1
    { x: 29, y: 15, w: 4, h: 11 },   // Montée Nord vers la Cité d'Ogoesse
    { x: 44, y: 43, w: 11, h: 4 },   // Sentier Est vers la Villa Turquoise
  ],
  // Étangs et Rivière d'Unys (tileset_global C0..C2, R161..R163)
  waterBodies: [
    { x: 28, y: 31, w: 32, h: 4 },   // Grande Rivière d'Unys traversant la Route 1
    { x: 6, y: 56, w: 16, h: 5 },    // Lac cristallin au Sud du Village
  ],
  // Pont en bois 3x4 sur la Rivière (tileset_nature C3..C5, R38..R41)
  bridges: [
    { x: 41, y: 31, w: 3, h: 4 }
  ],
  // Zones de Hautes Herbes 5G (combinant tileset_global R172..R177 & tileset_nature R12..R15)
  tallGrassZones: [
    { x: 26, y: 37, w: 8, h: 5, style: 'unova_light' },
    { x: 35, y: 37, w: 5, h: 5, style: 'nature' },
    { x: 26, y: 48, w: 9, h: 6, style: 'nature' },
    { x: 36, y: 48, w: 8, h: 6, style: 'unova_dark' },
    { x: 46, y: 22, w: 9, h: 7, style: 'unova_light' },
    { x: 34, y: 17, w: 9, h: 5, style: 'unova_dark' },
    { x: 20, y: 18, w: 8, h: 6, style: 'nature' },
    { x: 46, y: 48, w: 8, h: 6, style: 'unova_light' },
  ]
};

// Bâtiments 5G issus de tileset_buildings.png (alignés en 32x32)
export const WORLD_BUILDINGS = [
  // --- VILLAGE DE DÉPART (SUD-OUEST) ---
  {
    id: 'lab',
    name: 'Laboratoire du Prof. Platane',
    x: 6, y: 37, w: 6, h: 7,
    bCol: 13, bRow: 0,
    doors: [{ dx: 2, dy: 5 }, { dx: 3, dy: 5 }]
  },
  {
    id: 'player_house',
    name: 'Maison du Joueur',
    x: 16, y: 37, w: 5, h: 6,
    bCol: 8, bRow: 8,
    doors: []
  },
  {
    id: 'blue_villa',
    name: 'Villa Bleue de Renouet',
    x: 6, y: 48, w: 6, h: 6,
    bCol: 13, bRow: 8,
    doors: []
  },
  {
    id: 'pink_cottage',
    name: 'Cottage Rose de Renouet',
    x: 16, y: 47, w: 5, h: 7,
    bCol: 0, bRow: 16,
    doors: []
  },

  // --- ROUTE 1 D'UNYS ---
  {
    id: 'route_cafe',
    name: 'Relais des Dresseurs',
    x: 22, y: 25, w: 6, h: 6,
    bCol: 11, bRow: 16,
    doors: []
  },
  {
    id: 'teal_house',
    name: 'Villa de la Côte Est',
    x: 48, y: 36, w: 6, h: 7,
    bCol: 5, bRow: 16,
    doors: []
  },

  // --- CITÉ D'OGOESSE (NORD) ---
  {
    id: 'pokecenter',
    name: 'Centre Pokémon d\'Unys',
    x: 11, y: 5, w: 8, h: 8,
    bCol: 0, bRow: 0,
    doors: [{ dx: 3, dy: 6 }, { dx: 4, dy: 6 }]
  },
  {
    id: 'pokemart',
    name: 'Boutique Pokémon d\'Unys',
    x: 21, y: 7, w: 5, h: 5,
    bCol: 8, bRow: 0,
    doors: [{ dx: 2, dy: 4 }]
  },
  {
    id: 'town_hall',
    name: 'Mairie d\'Ogoesse',
    x: 29, y: 6, w: 8, h: 6,
    bCol: 0, bRow: 23,
    doors: []
  },
  {
    id: 'gym',
    name: 'Arène Pokémon d\'Unys',
    x: 40, y: 4, w: 8, h: 8,
    bCol: 0, bRow: 8,
    doors: [{ dx: 3, dy: 6 }, { dx: 4, dy: 6 }]
  }
];

// Décorations & Flore combinant tileset_global (1) et tileset_nature (3)
export const WORLD_PROPS = {
  // Fontaine 4x4 (tileset_global C4..C7, R358..R361)
  fountains: [
    { x: 12, y: 44 } // Centre du Village de départ
  ],
  // Parterres de fleurs 3x3 (tileset_global C0..C2, R355..R357)
  flowerBeds: [
    { x: 11, y: 14 },
    { x: 35, y: 13 }
  ],
  // Lampadaires d'Unys (tileset_global C0..C1, R362..R365)
  lamps: [
    { x: 10, y: 43 },
    { x: 17, y: 43 },
    { x: 24, y: 42 },
    { x: 40, y: 30 },
    { x: 40, y: 35 },
    { x: 19, y: 12 },
    { x: 27, y: 12 },
    { x: 38, y: 12 }
  ],
  // Arbres à Baies / Citronniers interactifs
  berryTrees: [
    { x: 9, y: 43 },
    { x: 33, y: 41 },
    { x: 28, y: 21 },
    { x: 52, y: 12 }
  ],
  // Clôtures en bois et barrières blanches le long de la Route 1
  fenceLines: [
    { x: 24, y: 42, len: 16, dir: 'h', style: 'wood' },
    { x: 24, y: 47, len: 16, dir: 'h', style: 'wood' },
    { x: 45, y: 36, len: 9, dir: 'h', style: 'white' },
    { x: 28, y: 17, len: 1, dir: 'v', style: 'white' },
    { x: 33, y: 16, len: 7, dir: 'v', style: 'wood' },
  ]
};

// 1. Génère la grille logique 64x64 de la carte du monde (collisions, portes, herbes, eau)
export function createMentonMap() {
  const grid = Array.from({ length: MAP_HEIGHT }, () => new Uint8Array(MAP_WIDTH).fill(TILE.GRASS));

  // Bordure de forêt dense tout autour de la carte 64x64 (3 tuiles d'épaisseur)
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (x < 3 || x >= MAP_WIDTH - 3 || y < 3 || y >= MAP_HEIGHT - 3) {
        grid[y][x] = TILE.TREE_PINE;
      }
    }
  }

  // Places pavées et parvis
  for (const r of WORLD_REGIONS.cobblePlazas) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        grid[y][x] = TILE.PATH_COBBLESTONE;
      }
    }
  }
  for (const r of WORLD_REGIONS.brickPlazas) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        grid[y][x] = TILE.PATH_COBBLESTONE;
      }
    }
  }

  // Routes en terre battue / sable
  for (const r of WORLD_REGIONS.dirtRoutes) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        grid[y][x] = TILE.SAND;
      }
    }
  }

  // Plage de sable autour du lac Sud (pour le test de marche sur sable)
  for (let y = 55; y <= 60; y++) {
    for (let x = 5; x <= 22; x++) {
      grid[y][x] = TILE.SAND;
    }
  }

  // Rivière et Lac (Eau solide)
  for (const w of WORLD_REGIONS.waterBodies) {
    for (let y = w.y; y < w.y + w.h; y++) {
      for (let x = w.x; x < w.x + w.w; x++) {
        grid[y][x] = TILE.WATER;
      }
    }
  }

  // Ponts en bois (marchables au-dessus de la rivière)
  for (const b of WORLD_REGIONS.bridges) {
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        grid[y][x] = TILE.BRIDGE;
      }
    }
  }

  // Zones de Hautes Herbes 5G
  for (const tg of WORLD_REGIONS.tallGrassZones) {
    for (let y = tg.y; y < tg.y + tg.h; y++) {
      for (let x = tg.x; x < tg.x + tg.w; x++) {
        if (grid[y][x] === TILE.GRASS) {
          grid[y][x] = TILE.GRASS_TALL;
        }
      }
    }
  }

  // Bosquets d'arbres denses entre le Village, la Route 1 et la Cité du Nord
  const treeClusters = [
    // Séparation Nord du Village de départ
    { x: 4, y: 20, w: 15, h: 15 },
    // Bosquet Ouest de la Route 1
    { x: 4, y: 4, w: 5, h: 15 },
    // Bosquet Est de la Cité du Nord
    { x: 52, y: 4, w: 8, h: 16 },
    // Bosquet Sud-Est de la Route 1
    { x: 56, y: 36, w: 5, h: 24 },
    // Bosquet central entre Route 1 et Village
    { x: 25, y: 55, w: 30, h: 6 }
  ];
  for (const tc of treeClusters) {
    for (let y = tc.y; y < tc.y + tc.h; y++) {
      for (let x = tc.x; x < tc.x + tc.w; x++) {
        if (grid[y][x] === TILE.GRASS) {
          grid[y][x] = TILE.TREE_PINE;
        }
      }
    }
  }

  // Bâtiments 5G (les 2 rangées du haut sont en toit surélevé marchable par-derrière, le bas est solide sauf les portes)
  for (const b of WORLD_BUILDINGS) {
    for (let dy = 2; dy < b.h; dy++) {
      for (let dx = 0; dx < b.w; dx++) {
        const tx = b.x + dx;
        const ty = b.y + dy;
        if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
          grid[ty][tx] = TILE.WALL_VILLA;
        }
      }
    }
    for (const d of b.doors) {
      const dx = b.x + d.dx;
      const dy = b.y + d.dy;
      grid[dy][dx] = TILE.DOOR;
      // Garantir que la case juste devant la porte est dégagée
      if (dy + 1 < MAP_HEIGHT) {
        grid[dy + 1][dx] = TILE.PATH_COBBLESTONE;
      }
    }
  }

  // Fontaine 4x4 au centre du Village
  for (const f of WORLD_PROPS.fountains) {
    for (let dy = 1; dy < 3; dy++) {
      for (let dx = 1; dx < 3; dx++) {
        grid[f.y + dy][f.x + dx] = TILE.FOUNTAIN;
      }
    }
  }

  // Clôtures le long des routes
  for (const fl of WORLD_PROPS.fenceLines) {
    for (let i = 0; i < fl.len; i++) {
      const fx = fl.dir === 'h' ? fl.x + i : fl.x;
      const fy = fl.dir === 'v' ? fl.y + i : fl.y;
      if (grid[fy] && grid[fy][fx] === TILE.GRASS) {
        grid[fy][fx] = TILE.FENCE;
      }
    }
  }

  // Arbres à Baies / Citronniers
  for (const bt of WORLD_PROPS.berryTrees) {
    grid[bt.y][bt.x] = TILE.LEMON_TREE;
  }

  // Panneaux d'information
  for (const coord of Object.keys(SIGNPOSTS)) {
    const [sx, sy] = coord.split(',').map(Number);
    if (grid[sy]) grid[sy][sx] = TILE.SIGN;
  }

  return grid;
}

// 2. Intérieur du Laboratoire du Professeur Platane (12x10)
export function createLabMap() {
  const w = 12, h = 10;
  const grid = Array.from({ length: h }, () => new Uint8Array(w).fill(TILE.FLOOR_WOOD));
  for (let x = 0; x < w; x++) {
    grid[0][x] = TILE.WALL_INDOOR;
    grid[1][x] = TILE.WALL_INDOOR;
    grid[h - 1][x] = TILE.WALL_INDOOR;
  }
  for (let y = 0; y < h; y++) {
    grid[y][0] = TILE.WALL_INDOOR;
    grid[y][w - 1] = TILE.WALL_INDOOR;
  }
  grid[2][1] = TILE.BOOKSHELF;
  grid[2][2] = TILE.BOOKSHELF;
  grid[2][3] = TILE.BOOKSHELF;
  grid[2][8] = TILE.BOOKSHELF;
  grid[2][9] = TILE.BOOKSHELF;
  grid[2][10] = TILE.PC_BOX;
  grid[8][1] = TILE.POTTED_PLANT;
  grid[8][10] = TILE.POTTED_PLANT;
  grid[4][6] = TILE.LAB_TABLE;
  grid[4][7] = TILE.LAB_TABLE;
  grid[8][5] = TILE.EXIT_MAT;
  grid[8][6] = TILE.EXIT_MAT;
  grid[9][5] = TILE.EXIT_MAT;
  grid[9][6] = TILE.EXIT_MAT;
  return grid;
}

// 3. Intérieur du Centre Pokémon (12x10)
export function createPokeCenterMap() {
  const w = 12, h = 10;
  const grid = Array.from({ length: h }, () => new Uint8Array(w).fill(TILE.FLOOR_CENTER));
  for (let x = 0; x < w; x++) {
    grid[0][x] = TILE.WALL_INDOOR;
    grid[1][x] = TILE.WALL_INDOOR;
    grid[h - 1][x] = TILE.WALL_INDOOR;
  }
  for (let y = 0; y < h; y++) {
    grid[y][0] = TILE.WALL_INDOOR;
    grid[y][w - 1] = TILE.WALL_INDOOR;
  }
  grid[3][5] = TILE.NURSE_DESK;
  grid[3][6] = TILE.NURSE_DESK;
  grid[3][9] = TILE.PC_BOX;
  grid[2][2] = TILE.BOOKSHELF;
  grid[2][3] = TILE.BOOKSHELF;
  grid[8][1] = TILE.POTTED_PLANT;
  grid[8][10] = TILE.POTTED_PLANT;
  grid[8][5] = TILE.EXIT_MAT;
  grid[8][6] = TILE.EXIT_MAT;
  grid[9][5] = TILE.EXIT_MAT;
  grid[9][6] = TILE.EXIT_MAT;
  return grid;
}

// 4. Intérieur de la Boutique Pokémon (10x9)
export function createPokeMartMap() {
  const w = 10, h = 9;
  const grid = Array.from({ length: h }, () => new Uint8Array(w).fill(TILE.FLOOR_MART));
  for (let x = 0; x < w; x++) {
    grid[0][x] = TILE.WALL_INDOOR;
    grid[1][x] = TILE.WALL_INDOOR;
    grid[h - 1][x] = TILE.WALL_INDOOR;
  }
  for (let y = 0; y < h; y++) {
    grid[y][0] = TILE.WALL_INDOOR;
    grid[y][w - 1] = TILE.WALL_INDOOR;
  }
  grid[3][4] = TILE.MART_DESK;
  grid[3][5] = TILE.MART_DESK;
  grid[2][7] = TILE.BOOKSHELF;
  grid[2][8] = TILE.BOOKSHELF;
  grid[5][2] = TILE.BOOKSHELF;
  grid[5][7] = TILE.BOOKSHELF;
  grid[7][1] = TILE.POTTED_PLANT;
  grid[7][8] = TILE.POTTED_PLANT;
  grid[7][4] = TILE.EXIT_MAT;
  grid[7][5] = TILE.EXIT_MAT;
  grid[8][4] = TILE.EXIT_MAT;
  grid[8][5] = TILE.EXIT_MAT;
  return grid;
}

// 5. Intérieur de l'Arène Pokémon d'Unys (14x12)
export function createGymMap() {
  const w = 14, h = 12;
  const grid = Array.from({ length: h }, () => new Uint8Array(w).fill(TILE.FLOOR_GYM));
  for (let x = 0; x < w; x++) {
    grid[0][x] = TILE.WALL_INDOOR;
    grid[1][x] = TILE.WALL_INDOOR;
    grid[h - 1][x] = TILE.WALL_INDOOR;
  }
  for (let y = 0; y < h; y++) {
    grid[y][0] = TILE.WALL_INDOOR;
    grid[y][w - 1] = TILE.WALL_INDOOR;
  }
  grid[3][3] = TILE.LEMON_TREE;
  grid[3][10] = TILE.LEMON_TREE;
  grid[5][3] = TILE.POTTED_PLANT;
  grid[5][10] = TILE.POTTED_PLANT;
  grid[8][3] = TILE.POTTED_PLANT;
  grid[8][10] = TILE.POTTED_PLANT;
  grid[10][6] = TILE.EXIT_MAT;
  grid[10][7] = TILE.EXIT_MAT;
  grid[11][6] = TILE.EXIT_MAT;
  grid[11][7] = TILE.EXIT_MAT;
  return grid;
}

export const MAPS = {
  outdoor: {
    id: 'outdoor',
    name: 'Région d\'Unys — Renouet, Route 1 & Ogoesse',
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    createGrid: createMentonMap,
    staticNpcs: [],
    warps: {
      '8,42': { targetMap: 'lab', targetX: 6, targetY: 8, dir: 'up', label: 'Entrer au Laboratoire' },
      '9,42': { targetMap: 'lab', targetX: 6, targetY: 8, dir: 'up', label: 'Entrer au Laboratoire' },
      '14,11': { targetMap: 'pokecenter', targetX: 6, targetY: 8, dir: 'up', label: 'Entrer au Centre Pokémon' },
      '15,11': { targetMap: 'pokecenter', targetX: 6, targetY: 8, dir: 'up', label: 'Entrer au Centre Pokémon' },
      '23,11': { targetMap: 'pokemart', targetX: 5, targetY: 7, dir: 'up', label: 'Entrer à la Boutique' },
      '43,10': { targetMap: 'gym', targetX: 7, targetY: 10, dir: 'up', label: 'Entrer dans l\'Arène' },
      '44,10': { targetMap: 'gym', targetX: 7, targetY: 10, dir: 'up', label: 'Entrer dans l\'Arène' },
    }
  },
  lab: {
    id: 'lab',
    name: 'Laboratoire du Professeur Platane',
    width: 12,
    height: 10,
    createGrid: createLabMap,
    staticNpcs: [
      { id: 'prof_platane', spriteKey: 'prof', name: 'Prof. Platane', x: 5, y: 4, dir: 'down' }
    ],
    warps: {
      '5,9': { targetMap: 'outdoor', targetX: 8, targetY: 43, dir: 'down', label: 'Sortir vers Renouet' },
      '6,9': { targetMap: 'outdoor', targetX: 9, targetY: 43, dir: 'down', label: 'Sortir vers Renouet' },
    }
  },
  pokecenter: {
    id: 'pokecenter',
    name: 'Centre Pokémon d\'Unys',
    width: 12,
    height: 10,
    createGrid: createPokeCenterMap,
    staticNpcs: [],
    warps: {
      '5,9': { targetMap: 'outdoor', targetX: 14, targetY: 12, dir: 'down', label: 'Sortir vers la Cité' },
      '6,9': { targetMap: 'outdoor', targetX: 15, targetY: 12, dir: 'down', label: 'Sortir vers la Cité' },
    }
  },
  pokemart: {
    id: 'pokemart',
    name: 'Boutique Pokémon d\'Unys',
    width: 10,
    height: 9,
    createGrid: createPokeMartMap,
    staticNpcs: [],
    warps: {
      '4,8': { targetMap: 'outdoor', targetX: 23, targetY: 12, dir: 'down', label: 'Sortir vers la Cité' },
      '5,8': { targetMap: 'outdoor', targetX: 23, targetY: 12, dir: 'down', label: 'Sortir vers la Cité' },
    }
  },
  gym: {
    id: 'gym',
    name: 'Arène Pokémon d\'Unys',
    width: 14,
    height: 12,
    createGrid: createGymMap,
    staticNpcs: [],
    warps: {
      '6,11': { targetMap: 'outdoor', targetX: 43, targetY: 11, dir: 'down', label: 'Sortir vers la Cité' },
      '7,11': { targetMap: 'outdoor', targetX: 44, targetY: 11, dir: 'down', label: 'Sortir vers la Cité' },
    }
  }
};

export function isSolid(grid, x, y) {
  const h = grid.length;
  const w = h > 0 ? grid[0].length : 0;
  if (x < 0 || x >= w || y < 0 || y >= h) return true;
  const tile = grid[y][x];
  return SOLID_TILES.has(tile);
}

export function getTile(grid, x, y) {
  const h = grid.length;
  const w = h > 0 ? grid[0].length : 0;
  if (x < 0 || x >= w || y < 0 || y >= h) return TILE.WALL_INDOOR;
  return grid[y][x];
}
