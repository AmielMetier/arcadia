// odyssee/js/gfx.js — choix des graphismes (Options → Graphismes) : le sol du dehors et le style des sprites de Pokémon.
// Les choix sont gardés dans le navigateur (localStorage). Le sol se charge au lancement du jeu (il faut relancer pour
// le changer) ; les sprites se lisent à chaque image demandée (assets.js) et changent tout de suite pour les nouveaux écrans.

import { NB_TUILES, NB_COLS, NB_DECOR, NB_BATIMENTS } from './data/gfx-noirblanc.js';

const NB_MAISONS = ['maison_bleue', 'maison_a', 'maison_c', 'maison_brique', 'maison_b', 'maison_orange'];
const lire = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* navigation privée : le choix ne dure que le temps de la page */ } };

/** sol du dehors : « odyssee » (sol généré, relief 3D), « classique » (tuiles d'origine) ou un pack de tuiles Pokémon */
export const SOLS_CHOIX = [
  { id: 'odyssee', nom: 'Odyssée (de base)', info: 'les graphismes d\'origine du jeu' },
  { id: 'noirblanc', nom: 'Noir & Blanc', info: 'le monde de Pokémon Noir 2 & Blanc 2 : sol, mer, arbres, bâtiments et personnages' },
];
/** sprites de Pokémon (face, dos, chromatiques) : HeartGold / SoulSilver (Gen 4) ou Noir / Blanc (Gen 5) */
export const SPRITES_CHOIX = [
  { id: 'hgss', nom: 'HeartGold / SoulSilver', info: 'Gen 4' },
  { id: 'bw', nom: 'Noir & Blanc', info: 'Gen 5' },
];

/** packs de tuiles : dossier sous img/ et fichiers (16 × 16 px, noms du sol classique ; tools/odyssee-pack-sol.py) */
export const PACKS = {
  lumineux: {
    dossier: 'gfx/lumineux',
    tuiles: ['ash0', 'ash1', 'cave0', 'cave1', 'darktall0', 'darktall1', 'deep0', 'deep1', 'deep2', 'deep3', 'forest0', 'forest1',
      'grass0', 'grass1', 'grass2', 'lava0', 'lava1', 'path0', 'pave0', 'sand0', 'snow0', 'snow1', 'snowtall0', 'snowtall1',
      'tall0', 'tall1', 'water0', 'water1', 'water2', 'water3'],
  },
  // tout vient du kit Pokémon Essentials BW (tools/odyssee-pack-noirblanc.py → data/gfx-noirblanc.js)
  noirblanc: {
    dossier: 'gfx/noirblanc',
    planche: { fichier: 'sol', tuiles: NB_TUILES, cols: NB_COLS },   // tuiles de sol de 16 px sur une seule image
    decor: NB_DECOR,          // d_<nom>.png, 32 px par case : dessiné pixel pour pixel
    // murs des intérieurs aux couleurs de Noir & Blanc (render/murs-tex.js) : le Centre Pokémon crème et orange
    murs: { center: { fond: '#f6eab4', motif: '#eedd98', bande: '#f09a52', bandeS: '#c8692c', lam: '#f2d68a', lamC: '#faeab0', lamS: '#d2a85c', cim: '#fffdf2', pl: '#a8602c', cap: '#b06830', capC: '#f0b070' } },
    chars: 'chars',           // planche des personnages de Noir & Blanc 2 (même disposition que celle du jeu)
    // bâtiments entiers (b_<nom>.png) par style du jeu : le jeu prend celui dont la largeur colle à l'emprise
    batiments: Object.fromEntries(Object.entries({
      center: ['centre'], mart: ['boutique'], gym: ['arene'], lab: ['labo'], tower: ['tour'],
      house: NB_MAISONS, house2: NB_MAISONS, house3: NB_MAISONS, bighouse: NB_MAISONS,
    }).map(([st, L]) => [st, L.map((n) => [n, ...NB_BATIMENTS[n]])])),
  },
};

export function solChoix() {
  // ?sol=0 : ancien sol à tuiles, pour comparer
  try { if (/[?&]sol=0\b/.test(location.search)) return 'classique'; } catch (e) { /* hors navigateur */ }
  const v = lire('odyssee-gfx-sol', null);
  if (v && SOLS_CHOIX.some((s) => s.id === v)) return v;
  return 'odyssee';   // anciens choix (« Classique », « Lumineux ») : retour aux graphismes de base
}
export const spritesChoix = () => (lire('odyssee-gfx-sprites', 'hgss') === 'bw' ? 'bw' : 'hgss');
export const packActif = () => PACKS[solChoix()] || null;

export function choisirSol(id) { if (SOLS_CHOIX.some((s) => s.id === id)) { ecrire('odyssee-gfx-sol', id); ecrire('odyssee-sol', id === 'odyssee' ? '1' : '0'); } }
export function choisirSprites(id) { if (SPRITES_CHOIX.some((s) => s.id === id)) ecrire('odyssee-gfx-sprites', id); }

/** crédits affichés dans Options → Crédits graphismes */
export const CREDITS = [
  ['Sol « Pokémon Lumineux »', 'Tuiles de Flurmimon (planche « Bright »), adaptées par Bivurnum — Team Aqua\'s Asset Repo.'],
  ['Graphismes « Noir & Blanc »', 'Sol, mer, arbres, bâtiments et personnages : kit « Pokémon Essentials BW » de KleinStudio (graphismes de Pokémon Noir & Blanc 2 © Nintendo / Game Freak / Creatures). Lave : Phyromatical.'],
  ['Sprites Noir & Blanc', 'Sprites des jeux Pokémon © Nintendo / Game Freak / Creatures, récupérés par PokeAPI (projet PokeAPI/sprites).'],
  ['Sprites HeartGold / SoulSilver', 'Même source : PokeAPI/sprites.'],
  ['Utilisation', 'Projet de fans sans but lucratif. Les artistes restent propriétaires de leurs créations.'],
];
