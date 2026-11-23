// odyssee/js/data/abilities.js — talents des Pokémon d'Odyssée : les vrais talents de chaque espèce (data/talents.js,
// tiré de PokeAPI), noms et descriptions en français. Le moteur de combat (core/battle.js) en joue l'effet.
import { TALENTS, TALENTS_ESPECES } from './talents.js';
import { SPECIES } from './species.js';

// talents propres à Odyssée et talents Méga manquants dans talents.js
Object.assign(TALENTS, {
  'sacoches-pollen': ['Sacoches de Pollen', 'Une fois par combat, quand ses PV passent sous la moitié, le Pokémon puise dans ses réserves de pollen : il récupère un quart de ses PV et sa Vitesse augmente.'],
  'coeur-vaillant': ['Cœur Vaillant', "Une fois par combat, la bravoure du Pokémon augmente son Attaque à son entrée sur le terrain. Protège aussi contre les baisses d'Attaque."],
  'parental-bond': ['Amour Filial', 'Le Pokémon et son petit attaquent ensemble : chaque capacité offensive frappe une seconde fois à puissance réduite (25 %).'],
  'aerilate': ['Peau Céleste', 'Les capacités de type Normal deviennent de type Vol et gagnent 20 % de puissance.'],
  'innards-out': ['Expuls\'Organes', "Si le Pokémon est mis K.O. par une attaque, il inflige à l'attaquant autant de dégâts qu'il lui restait de PV."],
  'mega-sol': ['Méga-Soleil', 'Les capacités de type Plante ignorent le tour de charge et gagnent en puissance sous le soleil.'],
  'dragonize': ['Peau Draconique', 'Les capacités de type Normal deviennent de type Dragon et gagnent 20 % de puissance.'],
  'piercing-drill': ['Foreuse Perçante', 'Les capacités de contact traversent Abri et Détection et ignorent les écrans adverses.'],
  'eelevate': ['Lévitation Volt', 'Le Pokémon flotte dans les airs (immunité Sol) et renforce ses capacités Électrik.'],
  'fire-mane': ['Crinière Ardente', 'Renforce les capacités de type Feu du Pokémon (20 %) et le protège de la brûlure.'],
  'electric-surge': ['Créa-Élec', 'À son entrée au combat, le Pokémon électrise le terrain, renforçant les capacités Électrik et empêchant le sommeil.'],
  'aura-guard': ['Garde Aura', "L'aura du Pokémon le protège des coups critiques et réduit les dégâts des attaques super efficaces."],
  'unseen-fist': ['Poing Invisible', 'Les attaques de contact du Pokémon passent à travers Abri et Détection.'],
});

// 60 créatures originales d'Odyssée (1001..1060) : isole complètement des IDs Gen 9 dans TALENTS_ESPECES
export const TALENTS_ORIGINALES = {
  1001: ['halo-sylvestre', null, 'rain-dish'],
  1002: ['halo-sylvestre', null, 'rain-dish'],
  1003: ['halo-sylvestre', null, 'rain-dish'],
  1004: ['cire-brulante', null, 'flash-fire'],
  1005: ['cire-brulante', null, 'flash-fire'],
  1006: ['cire-brulante', null, 'flash-fire'],
  1007: ['coeur-vaillant', null, 'shell-armor'],
  1008: ['coeur-vaillant', null, 'shell-armor'],
  1009: ['coeur-vaillant', null, 'shell-armor'],
  1010: ['keen-eye', 'tangled-feet', 'gale-wings'],
  1011: ['keen-eye', 'tangled-feet', 'gale-wings'],
  1012: ['keen-eye', 'tangled-feet', 'gale-wings'],
  1013: ['pickup', 'guts', 'thick-fat'],
  1014: ['pickup', 'guts', 'thick-fat'],
  1015: ['insomnia', 'keen-eye', 'tinted-lens'],
  1016: ['insomnia', 'keen-eye', 'tinted-lens'],
  1017: ['shield-dust', null, 'run-away'],
  1018: ['shed-skin', null, null],
  1019: ['compound-eyes', 'tinted-lens', 'magic-bounce'],
  1020: ['sacoches-pollen', null, null],
  1021: ['effect-spore', 'poison-point', 'regenerator'],
  1022: ['effect-spore', 'poison-point', 'regenerator'],
  1023: ['levitate', 'infiltrator', 'cursed-body'],
  1024: ['inner-focus', 'infiltrator', 'poison-touch'],
  1025: ['inner-focus', 'infiltrator', 'poison-touch'],
  1026: ['sturdy', 'shell-armor', 'hyper-cutter'],
  1027: ['sturdy', 'shell-armor', 'hyper-cutter'],
  1028: ['sand-force', 'sturdy', 'mold-breaker'],
  1029: ['water-veil', 'shell-armor', 'magic-guard'],
  1030: ['water-veil', 'shell-armor', 'magic-guard'],
  1031: ['swift-swim', 'water-absorb', 'hydration'],
  1032: ['swift-swim', 'water-absorb', 'hydration'],
  1033: ['iron-fist', 'swift-swim', 'tough-claws'],
  1034: ['static', 'lightning-rod', 'motor-drive'],
  1035: ['static', 'lightning-rod', 'motor-drive'],
  1036: ['levitate', 'static', 'analytic'],
  1037: ['cute-charm', 'fur-coat', 'technician'],
  1038: ['chlorophyll', 'natural-cure', 'serene-grace'],
  1039: ['synchronize', 'magic-guard', 'natural-cure'],
  1040: ['synchronize', 'magic-guard', 'natural-cure'],
  1041: ['flame-body', 'flash-fire', 'sheer-force'],
  1042: ['flame-body', 'flash-fire', 'sheer-force'],
  1043: ['intimidate', 'infiltrator', 'moxie'],
  1044: ['intimidate', 'infiltrator', 'moxie'],
  1045: ['thick-fat', 'ice-body', 'slush-rush'],
  1046: ['thick-fat', 'ice-body', 'slush-rush'],
  1047: ['clear-body', 'sturdy', 'technician'],
  1048: ['clear-body', 'sturdy', 'technician'],
  1049: ['shed-skin', 'inner-focus', 'multiscale'],
  1050: ['shed-skin', 'inner-focus', 'multiscale'],
  1051: ['multiscale', 'inner-focus', 'clear-body'],
  1052: ['multiscale', null, null],
  1053: ['magic-guard', 'cute-charm', 'pixilate'],
  1054: ['magic-guard', 'cute-charm', 'pixilate'],
  1055: ['iron-fist', 'guts', 'static'],
  1056: ['iron-fist', 'guts', 'static'],
  1057: ['levitate', 'infiltrator', 'magic-bounce'],
  1058: ['levitate', 'infiltrator', 'magic-bounce'],
  1059: ['sand-veil', 'sand-force', 'solid-rock'],
  1060: ['sand-stream', 'sand-force', 'solid-rock'],
};
for (const [sp, t] of Object.entries(TALENTS_ORIGINALES)) TALENTS_ESPECES[sp] = t;
export const ABILITIES = Object.fromEntries(Object.entries(TALENTS).map(([id, [name, desc]]) => [id, { id, name, desc }]));

// créatures originales (sans entrée dans PokeAPI) : un talent selon leur premier type
const PAR_TYPE = { grass: 'overgrow', fire: 'blaze', water: 'torrent', bug: 'swarm', electric: 'static', ghost: 'levitate', rock: 'sturdy',
  ground: 'sand-veil', ice: 'ice-body', poison: 'poison-point', flying: 'keen-eye', fighting: 'guts', psychic: 'synchronize',
  dark: 'intimidate', dragon: 'rough-skin', steel: 'clear-body', fairy: 'cute-charm', normal: 'run-away' };
const ui = (id) => ABILITIES[id] || { id, name: id, desc: '' };

/** talents possibles d'une espèce : [talent 1, talent 2 (ou null), talent caché (ou null)] */
export function abilitiesOf(sp) {
  if (sp >= 1001 && sp <= 1060 && TALENTS_ORIGINALES[sp]) return TALENTS_ORIGINALES[sp];
  return TALENTS_ESPECES[sp] || [PAR_TYPE[SPECIES[sp]?.t?.[0]] || 'run-away', null, null];
}

/** talent d'un Pokémon : priorité absolue à la forme Méga, sinon celui qu'on lui a donné, sinon un des talents de son espèce */
export function getAbility(m) {
  if (!m) return null;
  const megaAb = SPECIES[m.sp]?.megaAb;
  if (megaAb) return ui(megaAb);
  if (m.ability && ABILITIES[m.ability]) return ABILITIES[m.ability];
  const [a, b, h] = abilitiesOf(m.sp), iv = m.iv || [0, 0, 0, 0, 0, 0];
  const seed = iv.reduce((s, x, k) => s + x * (k + 3), 0) + (m.nat || 0) * 7;
  if (h && (seed % 25 === 0 || !a)) return ui(h);
  return ui(b && seed % 2 ? b : a);
}

export function abilityName(key) {
  if (key && typeof key === 'object') return key.name || 'Aucun';
  return ABILITIES[key]?.name || key || 'Aucun';
}
