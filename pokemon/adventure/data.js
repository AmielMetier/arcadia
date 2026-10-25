// pokemon/adventure/data.js
// Données spécifiques au Mode Aventure Kalos-Sud (Menton).
// Espèces de départ, faune sauvage de la Route 1 / Baie des Anges, objets et formules.

import { MOVES } from '../engine/moves.js';

export { MOVES };

export function spriteUrls(pokemonId) {
  return {
    front: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${pokemonId}.gif`,
    back: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/back/${pokemonId}.gif`,
    icon: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`,
    artwork: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`,
  };
}

export const STARTER_OPTIONS = [
  { id: 1, name: 'Bulbizarre', type: 'grass', types: ['grass', 'poison'], desc: 'Pokémon Graine. Équilibré et robuste avec son bulbe.' },
  { id: 4, name: 'Salamèche', type: 'fire', types: ['fire'], desc: 'Pokémon Lézard. Vif et offensif, la flamme au bout de sa queue ne s\'éteint jamais.' },
  { id: 7, name: 'Carapuce', type: 'water', types: ['water'], desc: 'Pokémon Minitortue. Excellente défense et attaques aquatiques percutantes.' },
  { id: 650, name: 'Marisson', type: 'grass', types: ['grass'], desc: 'Pokémon Bogue. Natif de Kalos, son armure de piquants est redoutable.' },
  { id: 653, name: 'Feunnec', type: 'fire', types: ['fire'], desc: 'Pokémon Renard. Natif de Kalos, il projette de l\'air brûlant par ses oreilles.' },
  { id: 656, name: 'Grenousse', type: 'water', types: ['water'], desc: 'Pokémon Crapaudmousse. Natif de Kalos, agile et bondissant sur l\'eau.' },
];

export const BASE_SPECIES = {
  // Starters
  1: {
    id: 1, name: 'Bulbizarre', types: ['grass', 'poison'],
    baseStats: { hp: 45, atk: 49, def: 49, spa: 65, spd: 65, spe: 45 },
    catchRate: 45, baseExp: 64,
    defaultMoves: ['tackle', 'growl', 'vine_whip']
  },
  4: {
    id: 4, name: 'Salamèche', types: ['fire'],
    baseStats: { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 },
    catchRate: 45, baseExp: 62,
    defaultMoves: ['scratch', 'growl', 'ember']
  },
  7: {
    id: 7, name: 'Carapuce', types: ['water'],
    baseStats: { hp: 44, atk: 48, def: 65, spa: 50, spd: 64, spe: 43 },
    catchRate: 45, baseExp: 63,
    defaultMoves: ['tackle', 'tail_whip', 'water_gun']
  },
  650: {
    id: 650, name: 'Marisson', types: ['grass'],
    baseStats: { hp: 56, atk: 61, def: 65, spa: 48, spd: 45, spe: 38 },
    catchRate: 45, baseExp: 63,
    defaultMoves: ['tackle', 'growl', 'vine_whip']
  },
  653: {
    id: 653, name: 'Feunnec', types: ['fire'],
    baseStats: { hp: 40, atk: 45, def: 40, spa: 62, spd: 60, spe: 60 },
    catchRate: 45, baseExp: 61,
    defaultMoves: ['scratch', 'tail_whip', 'ember']
  },
  656: {
    id: 656, name: 'Grenousse', types: ['water'],
    baseStats: { hp: 41, atk: 56, def: 40, spa: 62, spd: 44, spe: 71 },
    catchRate: 45, baseExp: 63,
    defaultMoves: ['scratch', 'growl', 'bubble']
  },

  // Faune sauvage - Route 1 & Hauts de Menton
  661: {
    id: 661, name: 'Passerouge', types: ['flying', 'normal'],
    baseStats: { hp: 45, atk: 50, def: 43, spa: 40, spd: 38, spe: 62 },
    catchRate: 255, baseExp: 49,
    defaultMoves: ['peck', 'quick_attack', 'growl']
  },
  16: {
    id: 16, name: 'Roucool', types: ['normal', 'flying'],
    baseStats: { hp: 40, atk: 45, def: 40, spa: 35, spd: 35, spe: 56 },
    catchRate: 255, baseExp: 50,
    defaultMoves: ['tackle', 'gust', 'quick_attack']
  },
  25: {
    id: 25, name: 'Pikachu', types: ['electric'],
    baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
    catchRate: 190, baseExp: 112,
    defaultMoves: ['thundershock', 'quick_attack', 'tail_whip']
  },
  133: {
    id: 133, name: 'Évoli', types: ['normal'],
    baseStats: { hp: 55, atk: 55, def: 50, spa: 45, spd: 65, spe: 55 },
    catchRate: 45, baseExp: 65,
    defaultMoves: ['tackle', 'tail_whip', 'bite', 'quick_attack']
  },
  10: {
    id: 10, name: 'Chenipan', types: ['bug'],
    baseStats: { hp: 45, atk: 30, def: 35, spa: 20, spd: 20, spe: 45 },
    catchRate: 255, baseExp: 39,
    defaultMoves: ['tackle', 'bug_bite']
  },
  669: {
    id: 669, name: 'Flabébé', types: ['fairy'],
    baseStats: { hp: 44, atk: 38, def: 39, spa: 61, spd: 79, spe: 42 },
    catchRate: 225, baseExp: 61,
    defaultMoves: ['tackle', 'fairy_wind']
  },
  672: {
    id: 672, name: 'Cabriolaine', types: ['grass'],
    baseStats: { hp: 66, atk: 65, def: 48, spa: 62, spd: 57, spe: 52 },
    catchRate: 200, baseExp: 70,
    defaultMoves: ['tackle', 'tail_whip', 'vine_whip']
  },
  52: {
    id: 52, name: 'Miaouss', types: ['normal'],
    baseStats: { hp: 40, atk: 45, def: 35, spa: 40, spd: 40, spe: 90 },
    catchRate: 255, baseExp: 58,
    defaultMoves: ['scratch', 'growl', 'bite']
  },

  // Plage & Eau
  54: {
    id: 54, name: 'Psykokwak', types: ['water'],
    baseStats: { hp: 50, atk: 52, def: 48, spa: 65, spd: 50, spe: 55 },
    catchRate: 190, baseExp: 64,
    defaultMoves: ['scratch', 'water_gun', 'hypnosis']
  },
  129: {
    id: 129, name: 'Magicarpe', types: ['water'],
    baseStats: { hp: 20, atk: 10, def: 55, spa: 15, spd: 20, spe: 80 },
    catchRate: 255, baseExp: 40,
    defaultMoves: ['splash', 'tackle']
  }
};

export const ENCOUNTER_TABLES = {
  // Hautes herbes de la Route 1
  grass: [
    { id: 661, minLv: 2, maxLv: 4, weight: 30 }, // Passerouge (30%)
    { id: 16, minLv: 2, maxLv: 4, weight: 25 },  // Roucool (25%)
    { id: 10, minLv: 2, maxLv: 3, weight: 20 },  // Chenipan (20%)
    { id: 669, minLv: 3, maxLv: 5, weight: 12 }, // Flabébé (12%)
    { id: 672, minLv: 3, maxLv: 5, weight: 8 },  // Cabriolaine (8%)
    { id: 25, minLv: 4, maxLv: 6, weight: 3 },   // Pikachu rare (3%)
    { id: 133, minLv: 4, maxLv: 6, weight: 2 },  // Évoli ultra rare (2%)
  ],
  // Plage & Rivage de Menton
  water: [
    { id: 129, minLv: 3, maxLv: 6, weight: 55 }, // Magicarpe (55%)
    { id: 54, minLv: 3, maxLv: 6, weight: 35 },  // Psykokwak (35%)
    { id: 52, minLv: 3, maxLv: 5, weight: 10 },  // Miaouss sur le sable (10%)
  ]
};

export const ITEMS = {
  poke_ball: {
    id: 'poke_ball',
    name: 'Poké Ball',
    desc: 'Capsule standard pour capturer un Pokémon sauvage.',
    rate: 1.0,
    price: 200,
    category: 'ball'
  },
  super_ball: {
    id: 'super_ball',
    name: 'Super Ball',
    desc: 'Capsule haute performance. Taux de capture amélioré (x1.5).',
    rate: 1.5,
    price: 600,
    category: 'ball'
  },
  potion: {
    id: 'potion',
    name: 'Potion',
    desc: 'Restaure jusqu\'à 20 PV à un Pokémon blessé.',
    heal: 20,
    price: 300,
    category: 'heal'
  },
  super_potion: {
    id: 'super_potion',
    name: 'Super Potion',
    desc: 'Restaure jusqu\'à 50 PV à un Pokémon blessé.',
    heal: 50,
    price: 700,
    category: 'heal'
  },
  citron_menton: {
    id: 'citron_menton',
    name: 'Citron de Menton',
    desc: 'Célèbre agrume de la Fête du Citron. Restaure 30 PV et guérit toutes les altérations de statut.',
    heal: 30,
    cureStatus: true,
    price: 150,
    category: 'heal'
  }
};

export function rollWildEncounter(zone = 'grass') {
  const table = ENCOUNTER_TABLES[zone] || ENCOUNTER_TABLES.grass;
  const totalWeight = table.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosen = table[0];
  for (const entry of table) {
    if (roll < entry.weight) {
      chosen = entry;
      break;
    }
    roll -= entry.weight;
  }
  const level = Math.floor(Math.random() * (chosen.maxLv - chosen.minLv + 1)) + chosen.minLv;
  return createAdventurePokemon(chosen.id, level);
}

export function createAdventurePokemon(speciesId, level = 5) {
  const base = BASE_SPECIES[speciesId];
  if (!base) throw new Error(`Unknown adventure species: ${speciesId}`);

  // Formule authentique des stats Gen 3/4/6
  const iv = 15; // IVs moyens équilibrés
  const maxHp = Math.max(10, Math.floor(((2 * base.baseStats.hp + iv) * level) / 100) + level + 10);
  const atk = Math.max(5, Math.floor(((2 * base.baseStats.atk + iv) * level) / 100) + 5);
  const def = Math.max(5, Math.floor(((2 * base.baseStats.def + iv) * level) / 100) + 5);
  const spa = Math.max(5, Math.floor(((2 * base.baseStats.spa + iv) * level) / 100) + 5);
  const spd = Math.max(5, Math.floor(((2 * base.baseStats.spd + iv) * level) / 100) + 5);
  const spe = Math.max(5, Math.floor(((2 * base.baseStats.spe + iv) * level) / 100) + 5);

  const moves = (base.defaultMoves || ['tackle']).slice(0, 4);

  // Exp requis pour le niveau suivant (courbe moyenne)
  const expCur = Math.floor(Math.pow(level, 3));
  const expNext = Math.floor(Math.pow(level + 1, 3));

  return {
    uid: 'pk_' + Math.random().toString(36).slice(2, 9),
    id: base.id,
    name: base.name,
    types: [...base.types],
    level,
    exp: expCur,
    expNext,
    currentHp: maxHp,
    maxHp,
    stats: { hp: maxHp, atk, def, spa, spd, spe },
    moves: [...moves],
    fainted: false,
    status: null, // 'paralysis', 'burn', 'sleep', 'poison'
    baseExp: base.baseExp,
    catchRate: base.catchRate
  };
}

export function checkLevelUp(poke) {
  if (poke.exp >= poke.expNext) {
    const oldMaxHp = poke.maxHp;
    poke.level += 1;
    poke.expNext = Math.floor(Math.pow(poke.level + 1, 3));
    
    // Recalcule les stats avec le nouveau niveau
    const base = BASE_SPECIES[poke.id];
    const iv = 15;
    poke.maxHp = Math.floor(((2 * base.baseStats.hp + iv) * poke.level) / 100) + poke.level + 10;
    poke.stats.atk = Math.floor(((2 * base.baseStats.atk + iv) * poke.level) / 100) + 5;
    poke.stats.def = Math.floor(((2 * base.baseStats.def + iv) * poke.level) / 100) + 5;
    poke.stats.spa = Math.floor(((2 * base.baseStats.spa + iv) * poke.level) / 100) + 5;
    poke.stats.spd = Math.floor(((2 * base.baseStats.spd + iv) * poke.level) / 100) + 5;
    poke.stats.spe = Math.floor(((2 * base.baseStats.spe + iv) * poke.level) / 100) + 5;
    
    // Gain de PV proportionnel au gain de PV max
    poke.currentHp = Math.min(poke.maxHp, poke.currentHp + (poke.maxHp - oldMaxHp));
    return true;
  }
  return false;
}

export function calculateCatchSuccess(wildPoke, ballRate = 1.0) {
  // Formule officielle Pokémon Gen 3/4/6 :
  // a = ((3 * MaxHP - 2 * CurHP) * CatchRate * BallRate) / (3 * MaxHP) * StatusMultiplier
  let statusMul = 1.0;
  if (wildPoke.status === 'sleep' || wildPoke.status === 'freeze') statusMul = 2.0;
  else if (wildPoke.status === 'paralysis' || wildPoke.status === 'burn' || wildPoke.status === 'poison') statusMul = 1.5;

  const a = Math.max(1, Math.floor(
    (((3 * wildPoke.maxHp - 2 * wildPoke.currentHp) * wildPoke.catchRate * ballRate) / (3 * wildPoke.maxHp)) * statusMul
  ));

  if (a >= 255) return { success: true, shakes: 3 };

  // b = 65536 / (255 / a)^0.25 = 1048560 / sqrt(sqrt(16711680 / a))
  const b = Math.floor(65536 / Math.pow(255 / a, 0.25));

  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    const rand = Math.floor(Math.random() * 65536);
    if (rand < b) {
      shakes++;
    } else {
      break;
    }
  }

  return {
    success: shakes >= 4,
    shakes: Math.min(3, shakes)
  };
}
