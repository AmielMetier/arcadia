// pokemon/engine/items.js
// Objets tenus du tournoi Poké Duel, comme en compétition : chaque Pokémon en tient un, deux Pokémon d'une même
// équipe ne tiennent jamais le même (clause objet). Les effets sont appliqués par le moteur de combat (battle.js).

import { MOVES } from './moves.js';
import { getPokemonById } from './data.js';

// icônes PokeAPI, rangées dans assets/items (chemin depuis la page du jeu)
const ICON = (slug) => `assets/items/${slug}.png`;

export const ITEMS = {
  leftovers:   { name: 'Restes',        icon: ICON('leftovers'),    desc: 'Rend 1/16 des PV à la fin de chaque tour.' },
  sitrus:      { name: 'Baie Sitrus',   icon: ICON('sitrus-berry'), desc: 'Une fois : rend 1/4 des PV quand ils passent sous la moitié.' },
  lum:         { name: 'Baie Prine',    icon: ICON('lum-berry'),    desc: 'Une fois : soigne aussitôt un statut (brûlure, paralysie, sommeil…).' },
  lifeorb:     { name: 'Orbe Vie',      icon: ICON('life-orb'),     desc: 'Attaques ×1,3, mais coûte 1/10 des PV à chaque coup porté.' },
  choiceband:  { name: 'Bandeau Choix', icon: ICON('choice-band'),  desc: 'Attaque ×1,5, mais bloqué sur la première attaque utilisée.' },
  choicespecs: { name: 'Lunettes Choix', icon: ICON('choice-specs'), desc: 'Att. Spé. ×1,5, mais bloqué sur la première attaque utilisée.' },
  choicescarf: { name: 'Mouchoir Choix', icon: ICON('choice-scarf'), desc: 'Vitesse ×1,5, mais bloqué sur la première attaque utilisée.' },
  focussash:   { name: 'Ceinture Force', icon: ICON('focus-sash'),  desc: 'Une fois : à PV pleins, survit à un coup fatal avec 1 PV.' },
  expertbelt:  { name: 'Ceinture Pro',  icon: ICON('expert-belt'),  desc: 'Attaques super efficaces ×1,2.' },
};
export const ITEM_KEYS = Object.keys(ITEMS);
export const CHOICE = new Set(['choiceband', 'choicespecs', 'choicescarf']);

/** Intérêt de chaque objet pour un Pokémon (plus c'est haut, mieux c'est). */
function itemScores(base) {
  const s = base.stats, moves = (base.cleanMoves || []).map((id) => MOVES[id]).filter(Boolean);
  const phys = moves.filter((m) => m.cat === 'physical' && m.power).length, spec = moves.filter((m) => m.cat === 'special' && m.power).length;
  const status = moves.filter((m) => m.cat === 'status').length;
  const bulk = s.hp + s.def + s.spd, offense = Math.max(s.atk, s.spa), fast = s.spe >= 95, frail = bulk < 230;
  const physMain = s.atk >= s.spa && phys >= 2, specMain = s.spa > s.atk && spec >= 2;
  return {
    choiceband: physMain && status === 0 ? 60 + s.atk * 0.3 : physMain ? 35 : 0,
    choicespecs: specMain && status === 0 ? 60 + s.spa * 0.3 : specMain ? 35 : 0,
    choicescarf: (physMain || specMain) && s.spe >= 70 && s.spe < 105 && status <= 1 ? 58 + offense * 0.2 : 10,
    lifeorb: offense >= 100 ? 50 + offense * 0.2 - (frail ? 0 : 5) : 25,
    focussash: frail && fast ? 62 : frail ? 45 : 10,
    leftovers: bulk >= 270 ? 55 + bulk * 0.05 : bulk >= 230 ? 40 : 20,
    sitrus: bulk >= 240 ? 48 : 32,
    lum: status >= 1 ? 42 : 28,
    expertbelt: 30 + Math.min(20, moves.filter((m) => m.power).length * 4),
  };
}

/**
 * Objets conseillés pour une équipe (tableau de numéros du Pokédex), sans doublon : on donne d'abord à chaque
 * Pokémon l'objet qui lui va le mieux, en réglant les conflits au profit de celui qui en tire le plus.
 * Retourne { [dex]: clé d'objet }.
 */
export function suggestItems(ids, fixed = {}) {
  const out = {}, used = new Set();
  for (const id of ids) if (fixed[id] && ITEMS[fixed[id]] && !used.has(fixed[id])) { out[id] = fixed[id]; used.add(fixed[id]); }
  const wants = ids.filter((id) => !out[id]).map((id) => {
    const b = getPokemonById(id);
    const sc = b ? itemScores(b) : {};
    return { id, list: ITEM_KEYS.map((k) => [k, sc[k] || 0]).sort((a, c) => c[1] - a[1]) };
  });
  while (wants.length) {
    // le Pokémon dont le meilleur objet encore libre vaut le plus choisit en premier
    let bi = 0, bk = null, bv = -1;
    wants.forEach((w, i) => { const top = w.list.find(([k]) => !used.has(k)); if (top && top[1] > bv) { bv = top[1]; bk = top[0]; bi = i; } });
    const w = wants.splice(bi, 1)[0];
    if (!bk) break;
    out[w.id] = bk; used.add(bk);
  }
  return out;
}

/** Garde des objets valides et sans doublon pour une équipe ; complète avec les conseils. */
export function cleanItems(ids, items) {
  const fixed = {};
  const used = new Set();
  if (items && typeof items === 'object') for (const id of ids) {
    const k = items[id];
    if (typeof k === 'string' && ITEMS[k] && !used.has(k)) { fixed[id] = k; used.add(k); }
  }
  return suggestItems(ids, fixed);
}
