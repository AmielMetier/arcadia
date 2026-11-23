// odyssee/js/world/apres-ligue.js — ce qui s'ouvre une fois Maître de la Ligue (sans DOM) :
//   - le Parc des Légendes (accessible depuis le hall de la Ligue) : regroupe les 32 légendaires invités d'autres
//     régions en quatre ailes thématiques + l'Autel Suprême (certains exigent les duos/trios liés : trois Regi avant
//     Regigigas, Dialga/Palkia/Giratina avant Arceus, etc. ; Odyssor reste unique au Cap des Étoiles) ;
//   - le Maître de la Tour de Combat, dans le hall de la Ligue (le jeu : vie-monde.js / tour-combat.js).
import { T } from './tiles.js';
import { GameMap } from './mapgen.js';

const pris = (f, ...ids) => ids.every((k) => f['L:' + k] === 'caught');
const maitre = (f) => !!f.champion;

/** [identifiant, espèce, niveau, x, y, condition en plus, apparition] (sur la carte dédiée `parc-legendes`, 46 × 38) */
const APRES = [
  // Aile Nord-Ouest : Terrasse Hoenn & Sinnoh
  ['regirock', 377, 70, 6, 6, null, 'Des points lumineux s\'allument sur un rocher immobile…'],
  ['regice', 378, 70, 10, 6, null, 'Un bloc de glace bouge tout seul…'],
  ['registeel', 379, 70, 14, 6, null, 'Une statue de métal se met à bourdonner…'],
  ['regigigas', 486, 75, 17, 7, (f) => pris(f, 'regirock', 'regice', 'registeel'), 'Les trois Regi t\'ont mené ici. Un colosse se réveille…'],
  ['kyogre', 382, 72, 6, 10, null, 'La mer se soulève d\'un coup…'],
  ['rayquaza', 384, 75, 11, 10, null, 'Un grondement descend du ciel…'],
  ['deoxys', 386, 70, 16, 10, null, 'Une étoile filante s\'écrase tout près…'],
  ['dialga', 483, 72, 6, 14, null, 'Le temps semble ralentir…'],
  ['palkia', 484, 72, 11, 14, null, 'L\'air se tord, comme plié en deux…'],
  ['giratina', 487, 72, 16, 14, null, 'Les ombres du parc s\'allongent…'],

  // Aile Nord-Est : Clairière d'Unys
  ['cobaltium', 638, 70, 29, 6, null, 'Un regard d\'acier te jauge…'],
  ['terrakium', 639, 70, 33, 6, null, 'Le sol tremble sous de lourds sabots…'],
  ['viridium', 640, 70, 37, 6, null, 'Un cerf vert surgit d\'entre les troncs…'],
  ['keldeo', 647, 70, 40, 7, (f) => pris(f, 'cobaltium', 'terrakium', 'viridium'), 'Un jeune poulain vient te défier, comme ses maîtres…'],
  ['boreas', 641, 70, 29, 10, null, 'Un vent violent se lève sans prévenir…'],
  ['fulguris', 642, 70, 34, 10, null, 'La foudre tombe tout près…'],
  ['demeteros', 645, 70, 39, 10, (f) => pris(f, 'boreas', 'fulguris'), 'La terre s\'apaise sous un nuage bienveillant…'],
  ['reshiram', 643, 75, 29, 14, null, 'Une flamme blanche embrase l\'horizon…'],
  ['zekrom', 644, 75, 34, 14, null, 'Un éclair noir déchire le ciel…'],
  ['kyurem', 646, 75, 39, 14, (f) => pris(f, 'reshiram', 'zekrom'), 'Un froid mortel monte du sol…'],

  // Aile Sud-Ouest : Jardin des Fabuleux
  ['phione', 489, 50, 6, 26, null, 'Une petite créature flotte dans une flaque…'],
  ['manaphy', 490, 50, 10, 26, null, 'Une petite créature bleue t\'observe depuis les fleurs…'],
  ['shaymin', 492, 60, 14, 26, null, 'Les fleurs s\'écartent : un petit hérisson dort dessous…'],
  ['victini', 494, 60, 17, 27, null, 'Une petite flamme de victoire danse dans la clairière…'],
  ['meloetta', 648, 60, 6, 31, null, 'Une mélodie flotte dans l\'air…'],
  ['genesect', 649, 70, 10, 31, null, 'Un insecte de métal te prend pour cible…'],
  ['hoopa', 720, 65, 14, 31, null, 'Un anneau doré flotte en l\'air… quelque chose en sort !'],
  ['volcanion', 721, 70, 17, 32, null, 'De la vapeur jaillit du sol…'],

  // Aile Sud-Est : Bosquet de Kalos
  ['xerneas', 716, 75, 30, 28, null, 'Des bois arc-en-ciel brillent entre les arbres…'],
  ['yveltal', 717, 75, 35, 28, null, 'Une ombre rouge plane au-dessus du bosquet…'],
  ['zygarde', 718, 75, 39, 31, null, 'Des cellules vertes se rassemblent devant toi…'],

  // Autel Suprême (Nord)
  ['arceus', 493, 80, 22, 4, (f) => pris(f, 'dialga', 'palkia', 'giratina'), 'Une lumière dorée rayonne au sommet du Sanctuaire…'],
];

/** construit le Parc des Légendes, son portail dans le hall de la Ligue et pose les 32 légendaires invités */
export function poserLegendairesApresLigue(W, maps, legends) {
  const m = new GameMap('parc-legendes', 46, 38, { outdoor: true, fill: T.TREE, name: 'Parc des Légendes', music: 'mystic' });
  maps['parc-legendes'] = m;

  // Clairières des 4 ailes reliées largement aux allées pavées + Autel Suprême au nord
  m.rect(4, 4, 18, 19, T.GRASS);
  m.rect(27, 4, 41, 19, T.GRASS);
  m.rect(4, 22, 18, 34, T.GRASS);
  m.rect(27, 22, 41, 34, T.GRASS);
  m.rect(19, 2, 26, 6, T.PAVE);
  m.rect(19, 18, 26, 23, T.PAVE);
  m.rect(18, 10, 27, 11, T.PAVE);
  m.rect(22, 6, 23, 36, T.PAVE);
  m.rect(5, 20, 40, 21, T.PAVE);
  m.rect(20, 30, 25, 35, T.PAVE);
  m.rect(22, 37, 23, 37, T.PATH);
  // fleurs & décorations hors cases occupées
  m.rect(5, 24, 9, 24, T.FLOWER);
  m.rect(36, 24, 40, 24, T.FLOWER);
  for (const [x, y] of [[20, 3], [25, 3], [19, 18], [26, 18], [19, 23], [26, 23]]) m.prop('statue', x, y);
  for (const [x, y] of [[21, 7], [24, 7], [21, 15], [24, 15], [21, 26], [24, 26], [21, 34], [24, 34]]) m.prop('lanterne', x, y);
  for (const [x, y] of [[18, 18], [27, 18], [18, 23], [27, 23]]) m.prop('cerisier', x, y);

  m.sign(20, 35, 'PARC DES LÉGENDES\n↑ Autel Suprême · ← Fabuleux / Hoenn & Sinnoh · → Unys / Kalos');
  m.sign(19, 17, 'TERRASSE HOENN & SINNOH ←\nColosses, Cieux, Temps et Espace');
  m.sign(26, 17, 'CLAIRIÈRE D\'UNYS →\nLames, Forces de la Nature, Idéal & Réalité');
  m.sign(19, 24, 'JARDIN DES FABULEUX ←\nMers, Fleurs, Vœux et Portails');
  m.sign(26, 24, 'BOSQUET DE KALOS →\nVie, Mort et Équilibre');

  m.npc({
    id: 'parc:archiviste', x: 20, y: 31, sprite: 'savant', dir: 'right',
    text: [
      'Bienvenue au Parc des Légendes, réservé aux Maîtres de la Ligue Céleste.',
      'Ici convergent les présences légendaires venues d\'au-delà d\'Odyssée. Odyssor, lui, demeure fidèle au Cap des Étoiles.',
      'Certains ne s\'éveillent qu\'en présence de leurs pairs : les trois Colosses appellent Regigigas, les Dragons du Temps appellent Arceus, et les duos/trios d\'Unys s\'appellent entre eux.',
    ],
  });

  m.zone(0, 0, 45, 37, { name: 'Parc des Légendes', music: 'mystic' });

  const league = maps['plateau:ligue'];
  const back = { map: 'plateau:ligue', x: 12, y: 15, dir: 'left', step: true };
  m.warp(22, 37, back);
  m.warp(23, 37, back);
  m.outside = league?.outside || { map: 'monde', x: 90, y: 184, dir: 'down' };

  if (league) {
    league.set(13, 15, T.STAIRS);
    league.warp(13, 15, { map: 'parc-legendes', x: 22, y: 35, dir: 'up', step: true });
    const g = league.npc({
      id: 'parc:gardien', x: 12, y: 14, sprite: 'garde', dir: 'down',
      gate: { badges: 15, open: (f) => !!f.champion, tiles: [[13, 15]] },
      text: ['Ce portail dimensionnel mène au Parc des Légendes.', 'Seul un Maître de la Ligue Céleste a le droit d\'y pénétrer !'],
    });
    league.gates.push({ npc: g.id, ...g.gate });
  }

  const pose = [];
  for (const [id, sp, lvl, x, y, cond, texte] of APRES) {
    const L = { map: 'parc-legendes', id, sp, lvl, x, y, apresLigue: true, cond: (f) => maitre(f) && (!cond || cond(f)), intro: [texte, 'C\'est un Pokémon légendaire !'] };
    legends.push(L); pose.push(L);
  }
  return pose;
}

/** le Maître de la Tour de Combat, dans le hall de la Ligue */
export function poserTourDeCombat(league) {
  league.npc({ id: 'tour-combat', x: 10, y: 15, sprite: 'topdresseur', dir: 'left', script: 'tourCombat' });
}
