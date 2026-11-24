// odyssee/js/core/battle-helpers.js — constantes d'attaques et utilitaires purs du moteur de combat.
import { TYPE_CHART } from '../data/types.js';

export const STAGE_NAMES = { 1: 'l\'Attaque', 2: 'la Défense', 3: 'l\'Attaque Spéciale', 4: 'la Défense Spéciale', 5: 'la Vitesse', 6: 'la Précision', 7: 'l\'Esquive' };
export const HP_TYPES = ['fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark'];
export const SOUND_MOVES = new Set(['growl', 'roar', 'sing', 'supersonic', 'screech', 'snore', 'uproar', 'hyper-voice', 'bug-buzz', 'perish-song', 'metal-sound', 'grass-whistle', 'echoed-voice', 'round', 'chatter', 'boomburst', 'disarming-voice', 'snarl', 'noble-roar', 'parting-shot']);
export const POWDER_MOVES = new Set(['sleep-powder', 'spore', 'stun-spore', 'poison-powder', 'cotton-spore']);
export const VANISH_MOVES = new Set(['shadow-force', 'phantom-force']);
export const BULLET_MOVES = new Set([
  'egg-bomb', 'sludge-bomb', 'octazooka', 'zap-cannon', 'shadow-ball', 'mist-ball', 'bullet-seed', 'rock-blast',
  'aura-sphere', 'seed-bomb', 'focus-blast', 'energy-ball', 'mud-bomb', 'magnet-bomb', 'electro-ball', 'acid-spray',
  'searing-shot', 'rock-wrecker', 'ice-ball', 'barrage',
]);

/** Calcule le multiplicateur d'efficacité d'un type offensif `mt` contre `defTypes` (optionnellement inversé). */
export function typeEff(mt, defTypes, inverse = false) {
  let e = 1;
  for (const d of defTypes) {
    let r = TYPE_CHART[mt]?.[d];
    if (inverse) {
      const f = r == null ? 1 : r;
      r = (f === 0 || f < 1) ? 2 : f > 1 ? 0.5 : 1;
    }
    if (r != null) e *= r;
  }
  return e;
}

/** Détermine le type et la puissance de Puissance Cachée à partir des IV d'un Pokémon. */
export function hiddenPower(m) {
  const order = [0, 1, 2, 5, 3, 4];
  let t = 0, p = 0;
  order.forEach((s, i) => {
    t += (m.iv[s] & 1) << i;
    p += ((m.iv[s] >> 1) & 1) << i;
  });
  return { type: HP_TYPES[Math.floor(t * 15 / 63)], power: Math.floor(p * 40 / 63) + 30 };
}

/** Crée un objet d'état volatil vierge pour un emplacement de combat actif. */
export const freshVol = () => ({
  st: [0, 0, 0, 0, 0, 0, 0, 0],
  conf: 0,
  flinch: false,
  charge: null,
  recharge: false,
  protect: false,
  protChain: 0,
  seed: null,
  trap: 0,
  rampage: null,
  invuln: null,
  dmgTaken: null,
  turns: 0,
  ability: null,
  types: null,
  proteanUsed: false,
});
