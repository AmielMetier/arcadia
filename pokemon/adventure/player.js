// pokemon/adventure/player.js
// Gestion de la sauvegarde locale, de l'équipe de Pokémon et du sac du joueur.

import { createAdventurePokemon, STARTER_OPTIONS, ITEMS } from './data.js';

const STORAGE_KEY = 'dd_poke_adventure_menton';

export function getInitialPlayerData(name = 'Dresseur', color = '#ff4b2b') {
  return {
    version: 1,
    name,
    color,
    x: 6, // Devant le Laboratoire Pokémon de Menton
    y: 8,
    dir: 'down',
    moving: false,
    money: 1000,
    hasStarter: false,
    party: [], // Max 6 Pokémon
    box: [],   // Boîte PC pour le surplus
    inventory: {
      poke_ball: 5,
      potion: 3,
      citron_menton: 2
    },
    lemonCooldowns: {}, // { 'x,y': timestamp }
    stats: {
      battlesWon: 0,
      pokemonCaught: 0,
      lemonsPicked: 0
    }
  };
}

export function loadPlayerData(defaultName = 'Dresseur', defaultColor = '#ff4b2b') {
  try {
    if (typeof localStorage === 'undefined') return getInitialPlayerData(defaultName, defaultColor);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialPlayerData(defaultName, defaultColor);
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.party)) {
      return getInitialPlayerData(defaultName, defaultColor);
    }
    // Mise à jour éventuelle des valeurs par défaut
    parsed.name = defaultName || parsed.name || 'Dresseur';
    parsed.color = defaultColor || parsed.color || '#ff4b2b';
    if (!parsed.inventory) parsed.inventory = { poke_ball: 5, potion: 3, citron_menton: 2 };
    if (!parsed.box) parsed.box = [];
    if (!parsed.stats) parsed.stats = { battlesWon: 0, pokemonCaught: 0, lemonsPicked: 0 };
    return parsed;
  } catch (err) {
    console.warn('Erreur lecture sauvegarde aventure:', err);
    return getInitialPlayerData(defaultName, defaultColor);
  }
}

export function savePlayerData(data) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Erreur écriture sauvegarde aventure:', err);
  }
}

export function giveStarter(playerData, starterId) {
  const chosen = STARTER_OPTIONS.find(s => s.id === starterId) || STARTER_OPTIONS[0];
  const poke = createAdventurePokemon(chosen.id, 5);
  playerData.party = [poke];
  playerData.hasStarter = true;
  savePlayerData(playerData);
  return poke;
}

export function healParty(playerData) {
  let healedCount = 0;
  for (const p of playerData.party) {
    if (p.currentHp < p.maxHp || p.fainted || p.status) healedCount++;
    p.currentHp = p.maxHp;
    p.fainted = false;
    p.status = null;
  }
  savePlayerData(playerData);
  return healedCount;
}

export function addPokemonToPlayer(playerData, poke) {
  if (playerData.party.length < 6) {
    playerData.party.push(poke);
    playerData.stats.pokemonCaught = (playerData.stats.pokemonCaught || 0) + 1;
    savePlayerData(playerData);
    return { location: 'party', slot: playerData.party.length };
  } else {
    playerData.box.push(poke);
    playerData.stats.pokemonCaught = (playerData.stats.pokemonCaught || 0) + 1;
    savePlayerData(playerData);
    return { location: 'box', slot: playerData.box.length };
  }
}

export function addItem(playerData, itemId, amount = 1) {
  if (!playerData.inventory) playerData.inventory = {};
  playerData.inventory[itemId] = (playerData.inventory[itemId] || 0) + amount;
  savePlayerData(playerData);
}

export function removeItem(playerData, itemId, amount = 1) {
  if (!playerData.inventory || !playerData.inventory[itemId]) return false;
  if (playerData.inventory[itemId] < amount) return false;
  playerData.inventory[itemId] -= amount;
  if (playerData.inventory[itemId] <= 0) delete playerData.inventory[itemId];
  savePlayerData(playerData);
  return true;
}

export function getFirstAlivePokemon(party) {
  return party.find(p => !p.fainted && p.currentHp > 0) || null;
}
