// odyssee/js/donjons/images.js — ce que les donjons à plusieurs ajoutent au jeu : leur décor (odyssee/img/donjons/),
// Copycat, et les objets qu'on y trouve ou qu'on y gagne (leur image, ce qu'ils font depuis le Sac). Repris du labo.
import { ITEMS } from '../core/items.js';
import { MOVES } from '../data/moves.js';
import { monName, refreshStats } from '../core/mon.js';

const IMG = new URL('../../img/donjons/', import.meta.url).href;

/** le décor des donjons, ajouté aux images du jeu (dessiné à 16 pixels par case, sauf DENSITE_2) */
export const DECOR = [
  ...['miroir_mur', 'miroir_mur_jaune', 'miroir_mur_rouge', 'miroir_mur_bleu', 'miroir_mur_noir', 'miroir_mur_vert', 'miroir_brise', 'miroir_d', 'miroir_g', 'miroir_poche', 'socle', 'brasier', 'brasier_on', 'soleil', 'soleil_on', 'porte_miroirs', 'robot', 'porte_miroir', 'miroir_poche2', 'miroir_pied_d', 'miroir_pied_g', 'fourneau', 'fourneau_on'].map((k) => [k, IMG + 'miroirs/' + k + '.png']),
  ...['porte_sagesse', 'porte_force', 'porte_courage', 'porte_sagesse_f', 'porte_force_f', 'porte_courage_f', 'porte_code', 'porte_grille', 'coffre', 'coffre_ouvert', 'interrupteur', 'interrupteur_on', 'socle_statue'].map((k) => [k, IMG + 'voies/' + k + '.png']),
];
/** décors dessinés à 32 pixels par case (PixelForge) */
export const DENSITE_2 = ['porte_miroir', 'miroir_poche2', 'miroir_pied_d', 'miroir_pied_g', 'fourneau', 'fourneau_on'];
/** Copycat, qui marche en miroir du joueur */
export const IMAGES = { copycat: IMG + 'miroirs/copycat.png', ...Object.fromEntries([['down', 'bas'], ['left', 'gauche'], ['right', 'droite'], ['up', 'haut']].flatMap(([s, f]) => [['copycat_' + s, IMG + 'miroirs/copycat_' + f + '.png'], ...[1, 2].map((k) => ['copycat_' + s + '_' + k, IMG + 'miroirs/copycat_' + f + '_' + k + '.png'])])), horloge: IMG + 'miroirs/horloge.png' };
/** dessins de combat */
export const DRESSEURS = { robot_combat: 'miroirs/robot_combat.png', copycat_combat: 'miroirs/copycat_combat.png', miroir_piege: 'miroirs/miroir_piege.png' };

const PARCHEMIN = 'Un vieux parchemin trouvé dans le Donjon des Miroirs. Son texte parle d\'un autre lieu, encore inconnu.';
export const OBJETS = {
  'eau-fraiche': { pocket: 'soin', price: 0, heal: 50, name: 'Eau Fraîche', icon: 'fresh-water', desc: 'Une eau limpide et glacée. Restaure 50 PV. Elle ne se garde pas hors du Donjon des Miroirs.' },
  'parchemin-miroirs-1': { pocket: 'cles', price: 0, key: true, name: 'Parchemin des Miroirs I', img: 'miroirs/objet_parchemin.png', desc: PARCHEMIN, lire: ['« Là où la lumière se brise, une porte attend. »', 'Le reste du texte est effacé.'] },
  'parchemin-miroirs-2': { pocket: 'cles', price: 0, key: true, name: 'Parchemin des Miroirs II', img: 'miroirs/objet_parchemin.png', desc: PARCHEMIN, lire: ['« Trois reflets, trois clés, un seul chemin. »', 'Une carte à moitié déchirée accompagne le texte.'] },
  'parchemin-miroirs-3': { pocket: 'cles', price: 0, key: true, name: 'Parchemin des Miroirs III', img: 'miroirs/objet_parchemin.png', desc: PARCHEMIN, lire: ['« Celui qui porte l\'éclat verra ce qui est caché. »', 'L\'encre a bavé sur le bas du parchemin.'] },
  'ct-voile-miroir': { pocket: 'cles', price: 0, key: true, name: 'CT Voile Miroir', img: 'miroirs/objet_ct.png', ct: 'mirror-coat', desc: 'Apprend Voile Miroir à un Pokémon : il renvoie le double des dégâts spéciaux reçus. Elle sert autant de fois qu\'on veut.' },
  'ct-abri': { pocket: 'cles', price: 0, key: true, name: 'CT Abri', img: 'miroirs/objet_ct.png', ct: 'protect', desc: 'Apprend Abri à un Pokémon : il se protège de presque toutes les attaques pendant un tour. Elle sert autant de fois qu\'on veut.' },
  'relique-triforce': { pocket: 'cles', price: 0, key: true, name: 'Relique de Triforce', img: 'voies/objet_relique.png', desc: 'Trois pierres serties dans un disque ancien : bleue, rouge et verte. Elle ouvrira peut-être un autre donjon.' },
  'bouchon-or': { pocket: 'objets', price: 0, name: 'Bouchon d\'Or', img: 'miroirs/objet_bouchon.png', iv: true, desc: 'Un bouchon doré et brillant. Il porte au maximum toutes les valeurs cachées (IV) d\'un Pokémon.' },
  'eclat-miroir': { pocket: 'cles', price: 0, key: true, name: 'Éclat de Miroir', img: 'miroirs/objet_eclat.png', desc: 'Un éclat qui reflète un lieu que tu n\'as jamais vu. Il ouvrira peut-être un autre donjon.' },
};

const idAttaque = (key) => Object.values(MOVES).find((m) => m.key === key)?.id;
let fait = false;
/** ajoute les objets aux tables du jeu ; avec ASSETS (navigateur), branche aussi leurs images et ce qu'ils font */
export function installerDonjons(ASSETS, { partyScreen } = {}) {
  if (!fait) { fait = true; for (const [k, o] of Object.entries(OBJETS)) ITEMS[k] ||= o; }
  if (!ASSETS || ASSETS._donjons) return;
  ASSETS._donjons = true;
  const item = ASSETS.item, trainer = ASSETS.trainer;
  ASSETS.item = (k) => (OBJETS[k]?.img ? IMG + OBJETS[k].img : item(k));
  ASSETS.trainer = (k) => (DRESSEURS[k] ? IMG + DRESSEURS[k] : trainer(k));
  for (const [k, o] of Object.entries(OBJETS)) {
    const it = ITEMS[k];
    if (o.lire) it.use = async (g) => { await g.ui.say(['Tu déroules le parchemin...', ...o.lire]); return false; };
    if (o.ct && partyScreen) it.use = async (g) => {
      const id = idAttaque(o.ct), mv = MOVES[id];
      const i = await partyScreen(g, { mode: 'pick', prompt: `Apprendre ${mv.n} à quel Pokémon ?`, filter: (m) => (m.moves.some((x) => x.id === id) ? 'Déjà appris' : null) });
      if (i < 0) return false;
      const m = g.state.party[i];
      if (m.moves.length < 4) { m.moves.push({ id, pp: mv.pp }); g.sound.sfx('learn'); await g.ui.say(`${monName(m)} apprend ${mv.n} !`); }
      else await g.askLearn(m, id);
      return false;
    };
    if (o.iv && partyScreen) it.use = async (g, cle) => {
      const i = await partyScreen(g, { mode: 'pick', prompt: 'Utiliser le Bouchon d\'Or sur quel Pokémon ?', filter: (m) => (m.iv.every((v) => v >= 31) ? 'Déjà au maximum' : null) });
      if (i < 0) return false;
      const m = g.state.party[i];
      m.iv = m.iv.map(() => 31); refreshStats(m, true);
      g.take(cle || k); g.sound.sfx('levelup');
      await g.ui.say(`Les valeurs cachées de ${monName(m)} sont au maximum !\nSes statistiques augmentent.`);
      return false;
    };
  }
}
installerDonjons();
