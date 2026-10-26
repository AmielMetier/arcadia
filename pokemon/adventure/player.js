// pokemon/adventure/player.js
// Gestion de la sauvegarde locale, de l'équipe de Pokémon, du Pokédex, des Badges,
// du PC de stockage et du sac du joueur pour le Mode Aventure Menton.

import { createAdventurePokemon, STARTER_OPTIONS, ITEMS } from './data.js';

const STORAGE_KEY = 'dd_poke_adventure_menton';

export function getInitialPlayerData(name = 'Dresseur', color = '#ff4b2b') {
  return {
    version: 3,
    name,
    color,
    avatar: 'red', // 'red' ou 'green'
    mapId: 'outdoor',
    x: 9, // Devant le Laboratoire Pokémon du Village de départ (64x64 Unys)
    y: 44,
    dir: 'up',
    moving: false,
    money: 1500,
    hasStarter: false,
    party: [], // Max 6 Pokémon
    box: [],   // Boîte PC pour le surplus
    inventory: {
      poke_ball: 5,
      potion: 3,
      citron_menton: 2
    },
    badges: [], // ex: ['citron_dor']
    defeatedTrainers: [], // IDs des dresseurs PNJ vaincus
    pokedex: {
      seen: [],
      caught: []
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
    parsed.name = defaultName || parsed.name || 'Dresseur';
    parsed.color = defaultColor || parsed.color || '#ff4b2b';
    if (!parsed.avatar) parsed.avatar = 'red';
    if (parsed.version !== 3) {
      parsed.version = 3;
      parsed.mapId = 'outdoor';
      parsed.x = 9;
      parsed.y = 44;
      parsed.dir = 'up';
    }
    if (!parsed.mapId) parsed.mapId = 'outdoor';
    if (!parsed.inventory) parsed.inventory = { poke_ball: 5, potion: 3, citron_menton: 2 };
    if (!parsed.box) parsed.box = [];
    if (!Array.isArray(parsed.badges)) parsed.badges = [];
    if (!Array.isArray(parsed.defeatedTrainers)) parsed.defeatedTrainers = [];
    if (!parsed.pokedex || !Array.isArray(parsed.pokedex.seen)) {
      const initCaught = parsed.party.concat(parsed.box).map(p => p.id);
      parsed.pokedex = {
        seen: Array.from(new Set(initCaught)),
        caught: Array.from(new Set(initCaught))
      };
    }
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

export function registerSeen(playerData, pokeId) {
  if (!playerData.pokedex) playerData.pokedex = { seen: [], caught: [] };
  if (!playerData.pokedex.seen.includes(pokeId)) {
    playerData.pokedex.seen.push(pokeId);
    savePlayerData(playerData);
  }
}

export function registerCaught(playerData, pokeId) {
  registerSeen(playerData, pokeId);
  if (!playerData.pokedex.caught.includes(pokeId)) {
    playerData.pokedex.caught.push(pokeId);
    savePlayerData(playerData);
  }
}

export function giveStarter(playerData, starterId) {
  const chosen = STARTER_OPTIONS.find(s => s.id === starterId) || STARTER_OPTIONS[0];
  const poke = createAdventurePokemon(chosen.id, 5);
  playerData.party = [poke];
  playerData.hasStarter = true;
  registerCaught(playerData, poke.id);
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
  registerCaught(playerData, poke.id);
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

export function buyItem(playerData, itemKey, qty = 1) {
  const def = ITEMS[itemKey];
  if (!def || !def.price) return { ok: false, reason: 'Article indisponible.' };
  const totalCost = def.price * qty;
  if ((playerData.money || 0) < totalCost) {
    return { ok: false, reason: 'Pas assez de Pokédollars !' };
  }
  playerData.money -= totalCost;
  addItem(playerData, itemKey, qty);
  return { ok: true, item: def, totalCost };
}

export function useItemOutsideBattle(playerData, itemKey, partyIdx = 0) {
  const def = ITEMS[itemKey];
  if (!def) return { ok: false, msg: 'Objet inconnu.' };
  if (def.category !== 'heal') {
    return { ok: false, msg: 'Cet objet ne peut être utilisé qu\'en combat !' };
  }
  const target = playerData.party[partyIdx];
  if (!target) return { ok: false, msg: 'Aucun Pokémon sélectionné.' };

  if (def.revive) {
    if (!target.fainted && target.currentHp > 0) {
      return { ok: false, msg: `${target.name} n'est pas K.O. !` };
    }
    if (!removeItem(playerData, itemKey, 1)) return { ok: false, msg: 'Objet épuisé.' };
    target.fainted = false;
    target.currentHp = Math.max(1, Math.floor(target.maxHp / 2));
    target.status = null;
    savePlayerData(playerData);
    return { ok: true, msg: `${target.name} revient au combat avec ${target.currentHp} PV !` };
  } else {
    if (target.fainted || target.currentHp <= 0) {
      return { ok: false, msg: `${target.name} est K.O. ! Utilisez un Rappel.` };
    }
    const needHp = target.currentHp < target.maxHp;
    const needCure = def.cureStatus && !!target.status;
    if (!needHp && !needCure) {
      return { ok: false, msg: `${target.name} est déjà en pleine forme !` };
    }
    if (!removeItem(playerData, itemKey, 1)) return { ok: false, msg: 'Objet épuisé.' };
    const before = target.currentHp;
    target.currentHp = Math.min(target.maxHp, target.currentHp + (def.heal || 20));
    if (def.cureStatus) target.status = null;
    savePlayerData(playerData);
    return { ok: true, msg: `${target.name} récupère ${target.currentHp - before} PV !` };
  }
}

export function setLeadPokemon(playerData, partyIdx) {
  if (partyIdx <= 0 || partyIdx >= playerData.party.length) return false;
  const chosen = playerData.party[partyIdx];
  playerData.party.splice(partyIdx, 1);
  playerData.party.unshift(chosen);
  savePlayerData(playerData);
  return true;
}

export function depositToBox(playerData, partyIdx) {
  if (playerData.party.length <= 1) {
    return { ok: false, msg: 'Vous devez garder au moins 1 Pokémon dans votre équipe !' };
  }
  if (partyIdx < 0 || partyIdx >= playerData.party.length) return { ok: false, msg: 'Emplacement invalide.' };
  const [removed] = playerData.party.splice(partyIdx, 1);
  playerData.box.push(removed);
  savePlayerData(playerData);
  return { ok: true, msg: `${removed.name} a été déposé dans la Boîte PC.` };
}

export function withdrawFromBox(playerData, boxIdx) {
  if (playerData.party.length >= 6) {
    return { ok: false, msg: 'Votre équipe est déjà complète (6/6) ! Déposez d\'abord un Pokémon.' };
  }
  if (boxIdx < 0 || boxIdx >= playerData.box.length) return { ok: false, msg: 'Emplacement invalide.' };
  const [removed] = playerData.box.splice(boxIdx, 1);
  playerData.party.push(removed);
  savePlayerData(playerData);
  return { ok: true, msg: `${removed.name} a rejoint votre équipe !` };
}

export function getFirstAlivePokemon(party) {
  return party.find(p => !p.fainted && p.currentHp > 0) || null;
}
