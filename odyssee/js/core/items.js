// odyssee/js/core/items.js — objets : prix, poche du sac, effets (sans DOM)
import { ITEM_NAMES } from '../data/types.js';
import { MOVES } from '../data/moves.js';
import { monName, healFull, gainExp, itemEvolution, expFor } from './mon.js';
import { SPECIES } from '../data/species.js';

// poche : 'soin' | 'balls' | 'objets'
export const ITEMS = {
  'poke-ball': { pocket: 'balls', price: 200, ball: 1, desc: 'Un objet semblable à une capsule, qui capture les Pokémon sauvages.' },
  'great-ball': { pocket: 'balls', price: 600, ball: 1.5, desc: 'Une Ball de bonne qualité, plus efficace que la Poké Ball.' },
  'master-ball': { pocket: 'balls', price: 0, ball: 255, desc: 'La Ball la plus performante : elle capture à coup sûr n\'importe quel Pokémon sauvage.' },
  'ultra-ball': { pocket: 'balls', price: 1200, ball: 2, desc: 'Une Ball très performante, plus efficace que la Super Ball.' },
  potion: { pocket: 'soin', price: 300, heal: 20, desc: 'Restaure 20 PV d\'un Pokémon.' },
  'super-potion': { pocket: 'soin', price: 700, heal: 50, desc: 'Restaure 50 PV d\'un Pokémon.' },
  'hyper-potion': { pocket: 'soin', price: 1200, heal: 200, desc: 'Restaure 200 PV d\'un Pokémon.' },
  'max-potion': { pocket: 'soin', price: 2500, heal: 9999, desc: 'Restaure tous les PV d\'un Pokémon.' },
  'full-restore': { pocket: 'soin', price: 3000, heal: 9999, cure: 'all', desc: 'Restaure tous les PV et soigne les problèmes de statut.' },
  revive: { pocket: 'soin', price: 1500, revive: 0.5, desc: 'Ranime un Pokémon K.O. avec la moitié de ses PV.' },
  antidote: { pocket: 'soin', price: 100, cure: ['psn', 'tox'], desc: 'Soigne l\'empoisonnement.' },
  'paralyze-heal': { pocket: 'soin', price: 200, cure: ['par'], desc: 'Soigne la paralysie.' },
  awakening: { pocket: 'soin', price: 250, cure: ['slp'], desc: 'Réveille un Pokémon endormi.' },
  'burn-heal': { pocket: 'soin', price: 250, cure: ['brn'], desc: 'Soigne une brûlure.' },
  'ice-heal': { pocket: 'soin', price: 250, cure: ['frz'], desc: 'Dégèle un Pokémon gelé.' },
  'full-heal': { pocket: 'soin', price: 600, cure: 'all', desc: 'Soigne tous les problèmes de statut.' },
  'oran-berry': { pocket: 'soin', price: 80, heal: 10, desc: 'Une Baie qui restaure 10 PV.' },
  ether: { pocket: 'soin', price: 1200, pp: 10, desc: 'Restaure 10 PP d\'une attaque.' },
  elixir: { pocket: 'soin', price: 3000, ppAll: 10, desc: 'Restaure 10 PP de toutes les attaques.' },
  'escape-rope': { pocket: 'objets', price: 550, desc: 'Une longue corde pour sortir d\'une grotte en un instant.' },
  repel: { pocket: 'objets', price: 350, repel: 100, desc: 'Éloigne les Pokémon sauvages faibles pendant 100 pas.' },
  'super-repel': { pocket: 'objets', price: 500, repel: 200, desc: 'Éloigne les Pokémon sauvages faibles pendant 200 pas.' },
  'max-repel': { pocket: 'objets', price: 700, repel: 250, desc: 'Éloigne les Pokémon sauvages faibles pendant 250 pas.' },
  'rare-candy': { pocket: 'objets', price: 4800, candy: 1, desc: 'Fait monter un Pokémon d\'un niveau.' },
  'fire-stone': { pocket: 'objets', price: 2100, stone: 1, desc: 'Une pierre qui fait évoluer certains Pokémon. Elle est orange.' },
  'water-stone': { pocket: 'objets', price: 2100, stone: 1, desc: 'Une pierre qui fait évoluer certains Pokémon. Elle est bleue.' },
  'thunder-stone': { pocket: 'objets', price: 2100, stone: 1, desc: 'Une pierre qui fait évoluer certains Pokémon. Elle porte un éclair.' },
  'leaf-stone': { pocket: 'objets', price: 2100, stone: 1, desc: 'Une pierre qui fait évoluer certains Pokémon. Elle porte une feuille.' },
  'moon-stone': { pocket: 'objets', price: 2100, stone: 1, desc: 'Une pierre qui fait évoluer certains Pokémon. Elle est noire comme la nuit.' },
  'sun-stone': { pocket: 'objets', price: 2100, stone: 1, desc: 'Une pierre qui fait évoluer certains Pokémon. Elle est rouge comme le soleil.' },
  // objets rares : CS (utilisables sur le terrain, face à l'obstacle) et objets de quête
  hm01: { pocket: 'cles', key: 1, cs: 'cut', name: 'CS01 Coupe', desc: 'Coupe les petits arbres qui barrent le passage. Place-toi devant et appuie sur Espace.' },
  hm05: { pocket: 'cles', key: 1, cs: 'flash', name: 'CS05 Flash', desc: 'Éclaire les grottes plongées dans le noir. Elle agit toute seule dès que tu entres dans une grotte sombre.' },
  hm03: { pocket: 'cles', key: 1, cs: 'surf', name: 'CS03 Surf', desc: 'Permet de naviguer sur l\'eau calme sur le dos d\'un Pokémon. Place-toi face à l\'eau et appuie sur Espace.' },
  hm04: { pocket: 'cles', key: 1, cs: 'strength', name: 'CS04 Force', desc: 'Permet de pousser les gros rochers. Marche contre le rocher pour le déplacer.' },
  'silver-wing': { pocket: 'cles', key: 1, name: 'Plume Argent', desc: 'Une plume argentée qui scintille comme la lune sur la mer. Elle ouvre le Sanctuaire des Marées.' },
  medaillon: { pocket: 'cles', key: 1, name: 'Médaillon', icon: 'soothe-bell', desc: 'Un médaillon gravé d\'une petite fleur. Quelqu\'un de Sylvebourg doit le chercher partout.' },
  'prism-shard': { pocket: 'cles', key: 1, name: 'Éclat de Prisme', icon: 'shoal-shell', desc: 'Un fragment noir du Prisme de la Team Éclipse. Il est glacé au toucher.' },
};
export const itemName = (k) => ITEMS[k]?.name || ITEM_NAMES[k] || k;
export const POCKETS = [['soin', 'Soins'], ['balls', 'Balls'], ['objets', 'Objets'], ['cles', 'Rares']];

/** l'objet peut-il servir sur ce Pokémon ? */
export function canUseOn(item, m) {
  const it = ITEMS[item]; if (!it) return false;
  if (it.revive) return m.hp <= 0;
  if (m.hp <= 0) return false;
  if (it.heal && m.hp < m.stats[0]) return true;
  if (it.cure && m.status && (it.cure === 'all' || it.cure.includes(m.status))) return true;
  if (it.pp || it.ppAll) return m.moves.some((x) => x.pp < MOVES[x.id].pp);
  if (it.candy) return m.lvl < 100;
  if (it.stone) return !!itemEvolution(m, item);
  return false;
}

/** applique un objet de soin ; renvoie le message (ou null si sans effet) */
export function applyItem(item, m, moveIdx = -1) {
  const it = ITEMS[item]; const name = monName(m);
  if (!canUseOn(item, m)) return null;
  if (it.revive) { m.hp = Math.max(1, Math.floor(m.stats[0] * it.revive)); m.status = null; return `${name} a repris connaissance !`; }
  const msgs = [];
  if (it.heal) { const before = m.hp; m.hp = Math.min(m.stats[0], m.hp + it.heal); if (m.hp > before) msgs.push(`${name} récupère ${m.hp - before} PV.`); }
  if (it.cure && m.status && (it.cure === 'all' || it.cure.includes(m.status))) { m.status = null; m.slp = 0; m.tox = 0; msgs.push(`${name} est soigné.`); }
  if (it.pp) { const mv = m.moves[moveIdx >= 0 ? moveIdx : m.moves.findIndex((x) => x.pp < MOVES[x.id].pp)]; if (mv) { mv.pp = Math.min(MOVES[mv.id].pp, mv.pp + it.pp); msgs.push(`Les PP de ${MOVES[mv.id].n} sont restaurés.`); } }
  if (it.ppAll) { for (const mv of m.moves) mv.pp = Math.min(MOVES[mv.id].pp, mv.pp + it.ppAll); msgs.push(`Les PP de ${name} sont restaurés.`); }
  return msgs.join(' ') || null;
}

/** Super Bonbon : passe au niveau suivant, renvoie les étapes de gainExp */
export function useCandy(m) {
  const need = expFor(SPECIES[m.sp].g, m.lvl + 1) - m.exp;
  return gainExp(m, Math.max(1, need));
}
export { healFull };
