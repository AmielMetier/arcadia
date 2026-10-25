// pokemon/engine/types.js
// Table des 18 types Pokémon, noms français, couleurs officielles, IDs officiels et multiplicateurs d'efficacité.

export const TYPE_IDS = {
  normal: 1,
  fighting: 2,
  flying: 3,
  poison: 4,
  ground: 5,
  rock: 6,
  bug: 7,
  ghost: 8,
  steel: 9,
  fire: 10,
  water: 11,
  grass: 12,
  electric: 13,
  psychic: 14,
  ice: 15,
  dragon: 16,
  dark: 17,
  fairy: 18,
};

export function getTypeBadgeUrl(typeKey) {
  const id = TYPE_IDS[typeKey] || 1;
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/generation-viii/sword-shield/${id}.png`;
}

export const TYPES = {
  normal:   { name: 'Normal',   color: '#9FA19F', bg: '#6D6D4E' },
  fire:     { name: 'Feu',      color: '#E62829', bg: '#9C531F' },
  water:    { name: 'Eau',      color: '#2980EF', bg: '#445E9C' },
  grass:    { name: 'Plante',   color: '#3FA129', bg: '#4E8234' },
  electric: { name: 'Électrik', color: '#FAC000', bg: '#A1871F' },
  ice:      { name: 'Glace',    color: '#3DCEF3', bg: '#638D9F' },
  fighting: { name: 'Combat',   color: '#FF8000', bg: '#7D1F1A' },
  poison:   { name: 'Poison',   color: '#9141CB', bg: '#5E2D88' },
  ground:   { name: 'Sol',      color: '#915121', bg: '#927D44' },
  flying:   { name: 'Vol',      color: '#81B9EF', bg: '#5673C6' },
  psychic:  { name: 'Psy',      color: '#EF4179', bg: '#A13959' },
  bug:      { name: 'Insecte',  color: '#91A119', bg: '#6D7815' },
  rock:     { name: 'Roche',    color: '#AFA981', bg: '#786824' },
  ghost:    { name: 'Spectre',  color: '#704170', bg: '#493963' },
  dragon:   { name: 'Dragon',   color: '#5060E1', bg: '#4924A1' },
  steel:    { name: 'Acier',    color: '#60A1B8', bg: '#787887' },
  dark:     { name: 'Ténèbres', color: '#50413F', bg: '#49392F' },
  fairy:    { name: 'Fée',      color: '#EF70EF', bg: '#9B6470' },
};

// Matrice d'efficacité : attaquant -> { défenseur: multiplicateur }
// Valeurs par défaut : 1.0 (neutre)
const CHART = {
  normal: {
    rock: 0.5, ghost: 0, steel: 0.5
  },
  fire: {
    fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2
  },
  water: {
    fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5
  },
  grass: {
    fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5
  },
  electric: {
    water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5
  },
  ice: {
    fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5
  },
  fighting: {
    normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5
  },
  poison: {
    grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2
  },
  ground: {
    fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2
  },
  flying: {
    electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5
  },
  psychic: {
    fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5
  },
  bug: {
    fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5
  },
  rock: {
    fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5
  },
  ghost: {
    normal: 0, psychic: 2, ghost: 2, dark: 0.5
  },
  dragon: {
    dragon: 2, steel: 0.5, fairy: 0
  },
  steel: {
    fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2
  },
  dark: {
    fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5
  },
  fairy: {
    fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5
  }
};

/**
 * Calcule l'efficacité d'un type d'attaque contre un ou deux types de défenseur.
 * @param {string} moveType Type de l'attaque
 * @param {string[]} targetTypes Types du défenseur (ex: ['fire', 'flying'])
 * @returns {number} Multiplicateur (0, 0.25, 0.5, 1, 2, ou 4)
 */
export function getEffectiveness(moveType, targetTypes = []) {
  if (!moveType || !CHART[moveType]) return 1.0;
  let mult = 1.0;
  for (const t of targetTypes) {
    if (!t) continue;
    const factor = CHART[moveType][t] !== undefined ? CHART[moveType][t] : 1.0;
    mult *= factor;
  }
  return mult;
}

export function typeBadge(typeKey) {
  const t = TYPES[typeKey] || { name: typeKey, color: '#888' };
  return `<span class="type-badge" style="background:${t.color}">${t.name}</span>`;
}
