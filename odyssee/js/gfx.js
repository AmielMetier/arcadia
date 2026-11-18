// odyssee/js/gfx.js — choix des graphismes (Options → Graphismes) : le sol du dehors et le style des sprites de Pokémon.
// Les choix sont gardés dans le navigateur (localStorage). Le sol se charge au lancement du jeu (il faut relancer pour
// le changer) ; les sprites se lisent à chaque image demandée (assets.js) et changent tout de suite pour les nouveaux écrans.

import { NB_TUILES, NB_COLS, NB_DECOR, NB_BATIMENTS, NB_CHAR_ROWS, NB_CHAR_VARIANTS } from './data/gfx-noirblanc.js';

const NB_MAISONS = [
  'maison_bleue', 'maison_verte', 'maison_rouge', 'maison_jaune',
  'maison_a', 'maison_a_bl', 'maison_a_g', 'maison_a_g_bl',
  'maison_c', 'maison_c_ve', 'maison_brique', 'maison_brique_r',
  'maison_b', 'maison_orange', 'maison_d', 'maison_e', 'maison_e_bl',
  'maison_f', 'maison_f_bleue', 'maison_g', 'maison_g_ocre',
  'maison_ville_rg', 'maison_ville_bl', 'maison_ville_ve',
  'manoir', 'manoir_r', 'manoir_v',
];
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
    charRows: NB_CHAR_ROWS,   // rangées supplémentaires (au-delà des 73 de base) propres au pack Noir & Blanc
    charVariants: NB_CHAR_VARIANTS,
    // bâtiments entiers (b_<nom>.png) par style du jeu : le jeu prend celui dont la largeur colle à l'emprise (+ filtre biome)
    batiments: (() => {
      const m = (n, biomes = null) => (NB_BATIMENTS[n] ? [[n, ...NB_BATIMENTS[n], ...(biomes ? [biomes] : [])]] : []);
      const mapList = (specs) => specs.flatMap((s) => (Array.isArray(s) ? m(s[0], s[1]) : m(s)));
      const MAISONS_BIO = [
        ['maison_desert_1', ['desert', 'dunes']], ['maison_desert_2', ['desert', 'dunes']], ['maison_desert_3', ['desert', 'dunes']], ['maison_desert_4', ['desert', 'dunes']],
        ['maison_hiver', ['snow', 'givre', 'cime']], ['maison_neige_bl', ['snow', 'givre', 'cime']], ['maison_neige_rg', ['snow', 'givre', 'cime']], ['maison_neige_b', ['snow', 'givre', 'cime']], ['manoir_neige', ['snow', 'givre', 'cime']],
        ['maison_mirage_1', ['mirage', 'kagura']], ['maison_mirage_2', ['mirage', 'kagura']],
        ['maison_ombre_2', ['ombre']], ['manoir_ombre', ['ombre']], ['maison_ombre', ['ombre']],
        ['maison_brique', ['forge']], ['maison_brique_r', ['forge']], ['atelier_brique', ['forge']], ['maison_forge_1', ['forge', 'metro', 'volta']], ['maison_forge_2', ['forge', 'metro', 'volta']],
        ['maison_ville_rg', ['metro', 'volta']], ['maison_ville_bl', ['metro', 'volta']], ['maison_ville_ve', ['metro', 'volta']], ['maison_a_bl', ['metro', 'volta']], ['maison_f_bleue', ['metro', 'volta']], ['maison_bleue', ['metro', 'volta']], ['maison_c_ve', ['metro', 'volta']], ['maison_g', ['metro', 'volta']], ['maison_g_ocre', ['metro', 'volta']], ['manoir', ['metro', 'volta']],
        ...NB_MAISONS,
      ];
      return {
        center: mapList([['centre_desert', ['desert', 'dunes']], ['centre_neige', ['snow', 'givre', 'cime']], ['centre_mirage', ['mirage', 'kagura']], 'centre']),
        mart: mapList([['boutique_desert', ['desert', 'dunes']], ['boutique_neige', ['snow', 'givre', 'cime']], ['boutique_neige_b', ['snow', 'givre', 'cime']], 'boutique', 'boutique_p', 'boutique_b']),
        gym: mapList(['arene']), lab: mapList(['labo']), fontaine: mapList(['fontaine']),
        tower: mapList([['fonderie', ['forge']], ['fonderie_b', ['forge']], ['tour_brique', ['forge', 'metro', 'volta']], ['atelier_brique', ['forge', 'metro', 'volta']], ['tour_jaune', ['metro', 'volta']], ['tour_vitre', ['metro', 'volta']], 'tour', 'tour_jaune', 'tour_vitre', 'tour_brique']),
        house: mapList(MAISONS_BIO), house2: mapList(MAISONS_BIO), house3: mapList(MAISONS_BIO), bighouse: mapList(MAISONS_BIO),
        chapelle: mapList(['chapelle']), gare: mapList(['gare']), mairie: mapList(['mairie']), bourse: mapList(['bourse']), casino: mapList(['casino']),
        centrale: mapList(['centrale']), serre: mapList(['serre']), fonderie: mapList(['fonderie', 'fonderie_b']),
      };
    })(),
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

export const aChoisiGfx = () => lire('odyssee-gfx-asked', null) === '1' || lire('odyssee-gfx-sol', null) !== null;
export function marquerGfxChoisi() { ecrire('odyssee-gfx-asked', '1'); }
export function choisirSol(id) { if (SOLS_CHOIX.some((s) => s.id === id)) { ecrire('odyssee-gfx-sol', id); ecrire('odyssee-sol', id === 'odyssee' ? '1' : '0'); marquerGfxChoisi(); } }
export function choisirSprites(id) { if (SPRITES_CHOIX.some((s) => s.id === id)) ecrire('odyssee-gfx-sprites', id); }

/** crédits affichés dans Options → Crédits graphismes */
export const CREDITS = [
  ['Sol « Pokémon Lumineux »', 'Tuiles de Flurmimon (planche « Bright »), adaptées par Bivurnum — Team Aqua\'s Asset Repo.'],
  ['Graphismes « Noir & Blanc »', 'Sol, mer, arbres, bâtiments, intérieurs et personnages : kit « Pokémon Essentials BW » de KleinStudio et ressources Pokémon Essentials Gen 5 (FloofyPanthar ; © Nintendo / Game Freak / Creatures). Lave : Phyromatical. Compléments désert, grottes et sanctuaires : Magiscarf, J-Treecko252, TerribleJared, Anarlaurendil, RisingTempest3, JavaPlume.'],
  ['Sprites Noir & Blanc', 'Sprites des jeux Pokémon © Nintendo / Game Freak / Creatures, récupérés par PokeAPI (projet PokeAPI/sprites).'],
  ['Sprites HeartGold / SoulSilver', 'Même source : PokeAPI/sprites.'],
  ['Utilisation', 'Projet de fans sans but lucratif. Les artistes restent propriétaires de leurs créations.'],
];
