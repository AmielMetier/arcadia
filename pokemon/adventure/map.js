// pokemon/adventure/map.js
// Carte du monde ouverte de Menton (Kalos-Sud), de la Plage des Sablettes,
// de la Route 1 Corniche et de l'Arène Pokémon de Menton.
// Grille 44 colonnes x 32 lignes (32x32 px par case).

export const MAP_WIDTH = 44;
export const MAP_HEIGHT = 32;
export const TILE_SIZE = 32;

export const TILE = {
  COBBLE: 0,      // Pavés clairs de Menton (walkable)
  DIRT_PATH: 1,   // Chemin de terre Route 1 (walkable)
  GRASS_TALL: 2,  // Hautes herbes sauvages (walkable + combat aléatoire)
  GRASS_LAWN: 3,  // Pelouse rase décorative (walkable)
  SAND: 4,        // Sable fin de la plage des Sablettes (walkable)
  WATER: 5,       // Mer Méditerranée (solide / surf)
  WALL_VILLA: 6,  // Murs pastel terre cuite des villas (solide)
  ROOF_TERRA: 7,  // Toitures tuiles romaines (solide)
  FENCE: 8,       // Barrière blanche / garde-corps corniche (solide)
  TREE_PALM: 9,   // Palmiers méditerranéens (solide)
  LEMON_TREE: 10, // Arbre à citrons de Menton (solide + interactif)
  FOUNTAIN: 11,   // Fontaine de la Place aux Citrons (solide)
  LAB_TABLE: 12,  // Table des Poké Balls au Laboratoire (solide + starter)
  NURSE_DESK: 13, // Comptoir de l'infirmière Joëlle (solide + soin)
  PC_BOX: 14,     // Terminal PC de stockage (solide + PC)
  DOOR: 15,       // Portes de bâtiments (walkable)
  MART_DESK: 16,  // Comptoir de la Boutique Pokémon (solide + achat)
  SIGN: 17,       // Panneau d'information (solide + lecture)
  GYM_WALL: 18,   // Mur doré de l'Arène de Menton (solide)
  GYM_ROOF: 19,   // Toiture azur et or de l'Arène de Menton (solide)
};

export const SOLID_TILES = new Set([
  TILE.WATER,
  TILE.WALL_VILLA,
  TILE.ROOF_TERRA,
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
]);

export const SIGNPOSTS = {
  '8,9': {
    title: 'Laboratoire Pokémon du Prof. Platane',
    text: 'Centre d\'étude de la biodiversité de Kalos-Sud.\nLes nouveaux dresseurs peuvent y choisir leur premier Pokémon.'
  },
  '15,9': {
    title: 'Centre Pokémon de Menton',
    text: 'Soignez gratuitement votre équipe auprès de l\'Infirmière Joëlle\net gérez vos Pokémon grâce au PC de stockage.'
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
  { x: 19, y: 13, text: 'BOUTIQUE', bg: '#0369a1', border: '#38bdf8' },
  { x: 38, y: 3, text: 'ARÈNE DE MENTON', bg: '#854d0e', border: '#facc15' },
];

// Génère la matrice de la carte de Menton
export function createMentonMap() {
  const grid = Array.from({ length: MAP_HEIGHT }, () => new Uint8Array(MAP_WIDTH).fill(TILE.GRASS_LAWN));

  // 1. Bordures extérieures de sécurité (barrières / arbres)
  for (let x = 0; x < MAP_WIDTH; x++) {
    grid[0][x] = TILE.FENCE;
    grid[1][x] = TILE.TREE_PALM;
  }
  for (let y = 0; y < MAP_HEIGHT; y++) {
    grid[y][0] = TILE.TREE_PALM;
    grid[y][MAP_WIDTH - 1] = TILE.TREE_PALM;
  }

  // 2. Mer Méditerranée au Sud (lignes 28 à 31)
  for (let y = 28; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      grid[y][x] = TILE.WATER;
    }
  }

  // 3. Plage de sable fin (lignes 24 à 27)
  for (let y = 24; y < 28; y++) {
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      grid[y][x] = TILE.SAND;
    }
  }

  // 4. Promenade du Soleil pavée (lignes 21 à 23)
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

  // 5. Ville de Menton (Colonnes 2 à 22, Lignes 9 à 20)
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

  // Bâtiment 1 : Laboratoire Pokémon du Sud (Haut Gauche, x: 3 à 9, y: 3 à 8)
  for (let y = 3; y <= 5; y++) {
    for (let x = 3; x <= 9; x++) grid[y][x] = TILE.ROOF_TERRA;
  }
  for (let y = 6; y <= 8; y++) {
    for (let x = 3; x <= 9; x++) grid[y][x] = TILE.WALL_VILLA;
  }
  // Intérieur / Portique ouvert du Laboratoire
  grid[7][6] = TILE.COBBLE;
  grid[8][6] = TILE.DOOR;
  grid[6][6] = TILE.LAB_TABLE;

  // Bâtiment 2 : Centre Pokémon de Menton (Haut Droite de la ville, x: 14 à 20, y: 3 à 8)
  for (let y = 3; y <= 5; y++) {
    for (let x = 14; x <= 20; x++) grid[y][x] = TILE.ROOF_TERRA;
  }
  for (let y = 6; y <= 8; y++) {
    for (let x = 14; x <= 20; x++) grid[y][x] = TILE.WALL_VILLA;
  }
  grid[8][17] = TILE.DOOR;
  grid[7][17] = TILE.COBBLE;
  grid[6][17] = TILE.NURSE_DESK;
  grid[6][19] = TILE.PC_BOX;

  // Bâtiment 3 : Boutique Pokémon / Marché de Menton (x: 18 à 21, y: 13 à 15)
  for (let x = 18; x <= 21; x++) {
    grid[13][x] = TILE.ROOF_TERRA;
    grid[14][x] = TILE.WALL_VILLA;
  }
  grid[14][19] = TILE.MART_DESK; // Comptoir marchand accessible depuis (19,15)

  // Villas résidentielles pastel (x: 3 à 5, y: 13 à 16)
  for (let y = 13; y <= 14; y++) {
    for (let x = 3; x <= 5; x++) grid[y][x] = TILE.ROOF_TERRA;
  }
  for (let y = 15; y <= 16; y++) {
    for (let x = 3; x <= 5; x++) grid[y][x] = TILE.WALL_VILLA;
  }

  // 6. Route 1 Corniche & Arène de Menton (Colonnes 23 à 42, Lignes 2 à 20)
  for (let x = 22; x <= 38; x++) grid[11][x] = TILE.DIRT_PATH;
  for (let y = 6; y <= 11; y++) grid[y][28] = TILE.DIRT_PATH;
  for (let x = 28; x <= 38; x++) grid[6][x] = TILE.DIRT_PATH;
  for (let y = 6; y <= 20; y++) grid[y][38] = TILE.DIRT_PATH;

  // Bâtiment 4 : Arène Pokémon de Menton (Nord-Est, x: 36 à 40, y: 2 à 4)
  for (let x = 36; x <= 40; x++) {
    grid[2][x] = TILE.GYM_ROOF;
    grid[3][x] = TILE.GYM_ROOF;
    grid[4][x] = TILE.GYM_WALL;
  }
  grid[4][38] = TILE.DOOR;
  // Parvis pavé devant l'Arène (où se tient la Championne Solène en x:38, y:5)
  for (let y = 5; y <= 6; y++) {
    for (let x = 36; x <= 40; x++) {
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
  grid[12][22] = TILE.SIGN;
  grid[22][14] = TILE.SIGN;

  // Palmiers d'ornement le long de la Promenade et de la place
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

export function isSolid(grid, x, y) {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return true;
  const tile = grid[y][x];
  return SOLID_TILES.has(tile);
}

export function getTile(grid, x, y) {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return TILE.WATER;
  return grid[y][x];
}
