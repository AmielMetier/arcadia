// pokemon/adventure/map.js
// Cartes du Mode Aventure Kalos-Sud (Menton) :
// 1. Extérieur : Menton, Place aux Citrons, Route 1 Corniche, Plage des Sablettes (44x32)
// 2. Intérieur Laboratoire du Prof. Platane (12x10)
// 3. Intérieur Centre Pokémon de Menton (12x10)
// 4. Intérieur Boutique Pokémon de Menton (10x9)
// 5. Intérieur Arène Pokémon de Menton (14x12)

export const MAP_WIDTH = 44;
export const MAP_HEIGHT = 32;
export const TILE_SIZE = 32;

export const TILE = {
  COBBLE: 0,        // Pavés clairs de Menton (walkable)
  DIRT_PATH: 1,     // Chemin de terre Route 1 (walkable)
  GRASS_TALL: 2,    // Hautes herbes sauvages (walkable + combat aléatoire)
  GRASS_LAWN: 3,    // Pelouse rase (walkable)
  SAND: 4,          // Sable fin de la plage des Sablettes (walkable)
  WATER: 5,         // Mer Méditerranée (solide)
  WALL_VILLA: 6,    // Murs des bâtiments (solide)
  ROOF_TERRA: 7,    // Toiture tuiles terre cuite / Labo (solide)
  FENCE: 8,         // Barrière blanche (solide)
  TREE_PALM: 9,     // Arbre méditerranéen (solide)
  LEMON_TREE: 10,   // Citronnier de Menton (solide + interactif)
  FOUNTAIN: 11,     // Fontaine de la Place aux Citrons (solide)
  LAB_TABLE: 12,    // Table des Poké Balls au Laboratoire (solide + starter)
  NURSE_DESK: 13,   // Comptoir de l'Infirmière Joëlle (solide + soin)
  PC_BOX: 14,       // Terminal PC de stockage (solide + PC)
  DOOR: 15,         // Porte d'entrée de bâtiment (walkable + téléportation intérieur)
  MART_DESK: 16,    // Comptoir de la Boutique Pokémon (solide + achat)
  SIGN: 17,         // Panneau d'information (solide + lecture)
  GYM_WALL: 18,     // Mur doré de l'Arène de Menton (solide)
  GYM_ROOF: 19,     // Toiture azur et or de l'Arène (solide)
  ROOF_CENTER: 20,  // Toiture rouge du Centre Pokémon (solide)
  ROOF_MART: 21,    // Toiture bleue de la Boutique Pokémon (solide)
  FLOOR_WOOD: 22,   // Parquet intérieur Laboratoire (walkable)
  FLOOR_CENTER: 23, // Sol carrelé Centre Pokémon (walkable)
  FLOOR_MART: 24,   // Sol carrelé Boutique Pokémon (walkable)
  FLOOR_GYM: 25,    // Sol royal Arène de Menton (walkable)
  WALL_INDOOR: 26,  // Mur intérieur de pièce (solide)
  EXIT_MAT: 27,     // Tapis rouge de sortie intérieure (walkable + téléportation extérieur)
  BOOKSHELF: 28,    // Bibliothèque / Étagère d'objets (solide)
  POTTED_PLANT: 29, // Plante en pot décorative / Pilier (solide)
};

export const SOLID_TILES = new Set([
  TILE.WATER,
  TILE.WALL_VILLA,
  TILE.ROOF_TERRA,
  TILE.ROOF_CENTER,
  TILE.ROOF_MART,
  TILE.FENCE,
  TILE.TREE_PALM,
  TILE.LEMON_TREE,
  TILE.FOUNTAIN,
  TILE.LAB_TABLE,
  TILE.NURSE_DESK,
  TILE.PC_BOX,
  TILE.MART_DESK,
  TILE.SIGN,
  TILE.GYM_WALL,
  TILE.GYM_ROOF,
  TILE.WALL_INDOOR,
  TILE.BOOKSHELF,
  TILE.POTTED_PLANT,
]);

export const SIGNPOSTS = {
  '8,9': {
    title: 'Laboratoire Pokémon du Prof. Platane',
    text: 'Entrez par la porte pour rencontrer le Professeur Platane\net choisir votre premier partenaire Pokémon !'
  },
  '15,9': {
    title: 'Centre Pokémon de Menton',
    text: 'Entrez pour soigner gratuitement votre équipe auprès de l\'Infirmière Joëlle\net accéder au PC de stockage.'
  },
  '17,15': {
    title: 'Boutique Pokémon de Menton',
    text: 'Entrez pour acheter des Poké Balls, Potions, Rappels\net Citrons de Menton !'
  },
  '22,12': {
    title: 'Direction : Route 1 Corniche & Arène',
    text: 'Est : Route 1 Corniche (Hautes herbes & Dresseurs)\nNord-Est : Arène Pokémon de Menton (Championne Solène).'
  },
  '14,22': {
    title: 'Promenade du Soleil & Plage des Sablettes',
    text: 'Attention : Des Pokémon Eau sauvages apparaissent parfois\nau bord des vagues sur le sable humide !'
  }
};

export const BUILDING_SIGNS = [
  { x: 6, y: 5, text: 'LABO POKÉMON', bg: '#1e3a8a', border: '#60a5fa' },
  { x: 17, y: 5, text: 'CENTRE POKÉMON', bg: '#991b1b', border: '#f87171' },
  { x: 19, y: 12, text: 'BOUTIQUE POKÉMON', bg: '#0369a1', border: '#38bdf8' },
  { x: 38, y: 3, text: 'ARÈNE DE MENTON', bg: '#854d0e', border: '#facc15' },
];

// 1. Carte extérieure principale (44x32)
export function createMentonMap() {
  const grid = Array.from({ length: MAP_HEIGHT }, () => new Uint8Array(MAP_WIDTH).fill(TILE.GRASS_LAWN));

  // Bordures extérieures de sécurité (barrières / arbres)
  for (let x = 0; x < MAP_WIDTH; x++) {
    grid[0][x] = TILE.FENCE;
    grid[1][x] = TILE.TREE_PALM;
  }
  for (let y = 0; y < MAP_HEIGHT; y++) {
    grid[y][0] = TILE.TREE_PALM;
    grid[y][MAP_WIDTH - 1] = TILE.TREE_PALM;
  }

  // Mer Méditerranée au Sud (lignes 28 à 31)
  for (let y = 28; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      grid[y][x] = TILE.WATER;
    }
  }

  // Plage de sable fin (lignes 24 à 27)
  for (let y = 24; y < 28; y++) {
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      grid[y][x] = TILE.SAND;
    }
  }

  // Promenade du Soleil pavée (lignes 21 à 23)
  for (let y = 21; y < 24; y++) {
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      grid[y][x] = TILE.COBBLE;
    }
  }
  // Garde-corps entre la promenade et la plage (avec 2 ouvertures pour descendre)
  for (let x = 1; x < MAP_WIDTH - 1; x++) {
    if (x !== 12 && x !== 13 && x !== 30 && x !== 31) {
      grid[23][x] = TILE.FENCE;
    }
  }

  // Ville de Menton (Colonnes 2 à 22, Lignes 9 à 20)
  for (let y = 9; y <= 20; y++) {
    for (let x = 2; x <= 22; x++) {
      grid[y][x] = TILE.COBBLE;
    }
  }

  // Place aux Citrons (Colonnes 8 à 16, Lignes 13 à 18)
  grid[15][12] = TILE.FOUNTAIN;
  grid[13][9] = TILE.LEMON_TREE;
  grid[13][15] = TILE.LEMON_TREE;
  grid[17][9] = TILE.LEMON_TREE;
  grid[17][15] = TILE.LEMON_TREE;

  // Bâtiment 1 : Laboratoire Pokémon du Prof. Platane (x: 3..9, y: 3..8, porte en (6,8))
  for (let y = 3; y <= 5; y++) {
    for (let x = 3; x <= 9; x++) grid[y][x] = TILE.ROOF_TERRA;
  }
  for (let y = 6; y <= 8; y++) {
    for (let x = 3; x <= 9; x++) grid[y][x] = TILE.WALL_VILLA;
  }
  grid[8][6] = TILE.DOOR;

  // Bâtiment 2 : Centre Pokémon de Menton (x: 14..20, y: 3..8, porte en (17,8))
  for (let y = 3; y <= 5; y++) {
    for (let x = 14; x <= 20; x++) grid[y][x] = TILE.ROOF_CENTER;
  }
  for (let y = 6; y <= 8; y++) {
    for (let x = 14; x <= 20; x++) grid[y][x] = TILE.WALL_VILLA;
  }
  grid[8][17] = TILE.DOOR;

  // Bâtiment 3 : Boutique Pokémon de Menton (x: 17..21, y: 12..15, porte en (19,15))
  for (let y = 12; y <= 13; y++) {
    for (let x = 17; x <= 21; x++) grid[y][x] = TILE.ROOF_MART;
  }
  for (let y = 14; y <= 15; y++) {
    for (let x = 17; x <= 21; x++) grid[y][x] = TILE.WALL_VILLA;
  }
  grid[15][19] = TILE.DOOR;

  // Villa résidentielle de Menton (x: 3..6, y: 13..16)
  for (let y = 13; y <= 14; y++) {
    for (let x = 3; x <= 6; x++) grid[y][x] = TILE.ROOF_TERRA;
  }
  for (let y = 15; y <= 16; y++) {
    for (let x = 3; x <= 6; x++) grid[y][x] = TILE.WALL_VILLA;
  }

  // Route 1 Corniche & Arène de Menton (Colonnes 23 à 42, Lignes 2 à 20)
  for (let x = 22; x <= 38; x++) grid[11][x] = TILE.DIRT_PATH;
  for (let y = 6; y <= 11; y++) grid[y][28] = TILE.DIRT_PATH;
  for (let x = 28; x <= 38; x++) grid[6][x] = TILE.DIRT_PATH;
  for (let y = 6; y <= 20; y++) grid[y][38] = TILE.DIRT_PATH;

  // Bâtiment 4 : Arène Pokémon de Menton (Nord-Est, x: 35..41, y: 2..5, porte en (38,5))
  for (let y = 2; y <= 3; y++) {
    for (let x = 35; x <= 41; x++) grid[y][x] = TILE.GYM_ROOF;
  }
  for (let y = 4; y <= 5; y++) {
    for (let x = 35; x <= 41; x++) grid[y][x] = TILE.GYM_WALL;
  }
  grid[5][38] = TILE.DOOR;
  // Parvis pavé devant l'Arène
  for (let y = 6; y <= 7; y++) {
    for (let x = 35; x <= 41; x++) {
      grid[y][x] = TILE.COBBLE;
    }
  }

  // Hautes herbes (Zone 1 : Clairière des Passerouge)
  for (let y = 3; y <= 9; y++) {
    for (let x = 30; x <= 34; x++) {
      if (grid[y][x] === TILE.GRASS_LAWN) grid[y][x] = TILE.GRASS_TALL;
    }
  }

  // Hautes herbes (Zone 2 : Bosquet aux Évoli / Flabébé)
  for (let y = 7; y <= 10; y++) {
    for (let x = 23; x <= 27; x++) {
      if (grid[y][x] === TILE.GRASS_LAWN) grid[y][x] = TILE.GRASS_TALL;
    }
  }

  // Hautes herbes (Zone 3 : Plaine des Cabriolaine)
  for (let y = 13; y <= 19; y++) {
    for (let x = 26; x <= 34; x++) {
      if (grid[y][x] === TILE.GRASS_LAWN) grid[y][x] = TILE.GRASS_TALL;
    }
  }

  // Hautes herbes (Zone 4 : Versant Est)
  for (let y = 13; y <= 18; y++) {
    for (let x = 39; x <= 41; x++) {
      if (grid[y][x] === TILE.GRASS_LAWN) grid[y][x] = TILE.GRASS_TALL;
    }
  }

  // Panneaux indicateurs
  grid[9][8] = TILE.SIGN;
  grid[9][15] = TILE.SIGN;
  grid[15][17] = TILE.SIGN;
  grid[12][22] = TILE.SIGN;
  grid[22][14] = TILE.SIGN;

  // Arbres d'ornement le long de la Promenade
  grid[21][3] = TILE.TREE_PALM;
  grid[21][7] = TILE.TREE_PALM;
  grid[21][11] = TILE.TREE_PALM;
  grid[21][15] = TILE.TREE_PALM;
  grid[21][19] = TILE.TREE_PALM;
  grid[21][25] = TILE.TREE_PALM;
  grid[21][31] = TILE.TREE_PALM;
  grid[21][37] = TILE.TREE_PALM;

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
  // Bibliothèques et machines d'étude
  grid[2][1] = TILE.BOOKSHELF;
  grid[2][2] = TILE.BOOKSHELF;
  grid[2][3] = TILE.BOOKSHELF;
  grid[2][8] = TILE.BOOKSHELF;
  grid[2][9] = TILE.BOOKSHELF;
  grid[2][10] = TILE.PC_BOX;
  // Plantes en pot
  grid[8][1] = TILE.POTTED_PLANT;
  grid[8][10] = TILE.POTTED_PLANT;
  // Table des Starters Pokémon au centre
  grid[4][6] = TILE.LAB_TABLE;
  grid[4][7] = TILE.LAB_TABLE;
  // Tapis de sortie au Sud
  grid[8][5] = TILE.EXIT_MAT;
  grid[8][6] = TILE.EXIT_MAT;
  grid[9][5] = TILE.EXIT_MAT;
  grid[9][6] = TILE.EXIT_MAT;
  return grid;
}

// 3. Intérieur du Centre Pokémon de Menton (12x10)
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
  // Comptoir de soin de l'Infirmière Joëlle + PC de stockage
  grid[3][5] = TILE.NURSE_DESK;
  grid[3][6] = TILE.NURSE_DESK;
  grid[3][9] = TILE.PC_BOX;
  grid[2][2] = TILE.BOOKSHELF;
  grid[2][3] = TILE.BOOKSHELF;
  grid[8][1] = TILE.POTTED_PLANT;
  grid[8][10] = TILE.POTTED_PLANT;
  // Tapis de sortie
  grid[8][5] = TILE.EXIT_MAT;
  grid[8][6] = TILE.EXIT_MAT;
  grid[9][5] = TILE.EXIT_MAT;
  grid[9][6] = TILE.EXIT_MAT;
  return grid;
}

// 4. Intérieur de la Boutique Pokémon de Menton (10x9)
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
  // Comptoir marchand + rayons d'articles
  grid[3][4] = TILE.MART_DESK;
  grid[3][5] = TILE.MART_DESK;
  grid[2][7] = TILE.BOOKSHELF;
  grid[2][8] = TILE.BOOKSHELF;
  grid[5][2] = TILE.BOOKSHELF;
  grid[5][7] = TILE.BOOKSHELF;
  grid[7][1] = TILE.POTTED_PLANT;
  grid[7][8] = TILE.POTTED_PLANT;
  // Tapis de sortie
  grid[7][4] = TILE.EXIT_MAT;
  grid[7][5] = TILE.EXIT_MAT;
  grid[8][4] = TILE.EXIT_MAT;
  grid[8][5] = TILE.EXIT_MAT;
  return grid;
}

// 5. Intérieur de l'Arène Pokémon de Menton (14x12)
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
  // Colonnes / Statues d'Arène et Citronniers d'Or
  grid[3][3] = TILE.LEMON_TREE;
  grid[3][10] = TILE.LEMON_TREE;
  grid[5][3] = TILE.POTTED_PLANT;
  grid[5][10] = TILE.POTTED_PLANT;
  grid[8][3] = TILE.POTTED_PLANT;
  grid[8][10] = TILE.POTTED_PLANT;
  // Tapis de sortie
  grid[10][6] = TILE.EXIT_MAT;
  grid[10][7] = TILE.EXIT_MAT;
  grid[11][6] = TILE.EXIT_MAT;
  grid[11][7] = TILE.EXIT_MAT;
  return grid;
}

export const MAPS = {
  outdoor: {
    id: 'outdoor',
    name: 'Menton - La Cité des Citrons',
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    createGrid: createMentonMap,
    staticNpcs: [],
    warps: {
      '6,8': { targetMap: 'lab', targetX: 6, targetY: 8, dir: 'up', label: 'Entrer au Laboratoire' },
      '17,8': { targetMap: 'pokecenter', targetX: 6, targetY: 8, dir: 'up', label: 'Entrer au Centre Pokémon' },
      '19,15': { targetMap: 'pokemart', targetX: 5, targetY: 7, dir: 'up', label: 'Entrer à la Boutique' },
      '38,5': { targetMap: 'gym', targetX: 7, targetY: 10, dir: 'up', label: 'Entrer dans l\'Arène' },
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
      '5,9': { targetMap: 'outdoor', targetX: 6, targetY: 9, dir: 'down', label: 'Sortir vers Menton' },
      '6,9': { targetMap: 'outdoor', targetX: 6, targetY: 9, dir: 'down', label: 'Sortir vers Menton' },
    }
  },
  pokecenter: {
    id: 'pokecenter',
    name: 'Centre Pokémon de Menton',
    width: 12,
    height: 10,
    createGrid: createPokeCenterMap,
    staticNpcs: [],
    warps: {
      '5,9': { targetMap: 'outdoor', targetX: 17, targetY: 9, dir: 'down', label: 'Sortir vers Menton' },
      '6,9': { targetMap: 'outdoor', targetX: 17, targetY: 9, dir: 'down', label: 'Sortir vers Menton' },
    }
  },
  pokemart: {
    id: 'pokemart',
    name: 'Boutique Pokémon de Menton',
    width: 10,
    height: 9,
    createGrid: createPokeMartMap,
    staticNpcs: [],
    warps: {
      '4,8': { targetMap: 'outdoor', targetX: 19, targetY: 16, dir: 'down', label: 'Sortir vers Menton' },
      '5,8': { targetMap: 'outdoor', targetX: 19, targetY: 16, dir: 'down', label: 'Sortir vers Menton' },
    }
  },
  gym: {
    id: 'gym',
    name: 'Arène Pokémon de Menton',
    width: 14,
    height: 12,
    createGrid: createGymMap,
    staticNpcs: [],
    warps: {
      '6,11': { targetMap: 'outdoor', targetX: 38, targetY: 6, dir: 'down', label: 'Sortir vers Menton' },
      '7,11': { targetMap: 'outdoor', targetX: 38, targetY: 6, dir: 'down', label: 'Sortir vers Menton' },
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
