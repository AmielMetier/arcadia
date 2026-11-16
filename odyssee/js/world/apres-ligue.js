// odyssee/js/world/apres-ligue.js — ce qui s'ouvre une fois Maître de la Ligue (sans DOM) :
//   - les 33 légendaires qu'on ne trouvait nulle part, posés au bord des routes (drapeau `champion`), certains
//     seulement quand on a ceux qui vont avec (les trois Regi avant Regigigas, Dialga, Palkia et Giratina avant Arceus…) ;
//   - le Maître de la Tour de Combat, dans le hall de la Ligue (le jeu : vie-monde.js tourCombat).
import { along, nearestWalkable } from './mapgen.js';

const pris = (f, ...ids) => ids.every((k) => f['L:' + k] === 'caught');
const maitre = (f) => !!f.champion;

/** [identifiant, espèce, niveau, route, position le long de la route (0 à 1), côté, condition en plus, apparition] */
const APRES = [
  ['regirock', 377, 70, 'r16', 0.3, 1, null, 'Des points lumineux s\'allument sur un rocher immobile…'],
  ['regice', 378, 70, 'givre1', 0.6, -1, null, 'Un bloc de glace bouge tout seul…'],
  ['registeel', 379, 70, 'r17', 0.4, 1, null, 'Une statue de métal se met à bourdonner…'],
  ['regigigas', 486, 75, 'r20', 0.3, -1, (f) => pris(f, 'regirock', 'regice', 'registeel'), 'Les trois Regi t\'ont mené ici. Un colosse se réveille…'],
  ['kyogre', 382, 72, 'r10', 0.75, 1, null, 'La mer se soulève d\'un coup…'],
  ['rayquaza', 384, 75, 'r9b', 0.6, 1, null, 'Un grondement descend du ciel…'],
  ['deoxys', 386, 70, 'r19', 0.5, -1, null, 'Une étoile filante s\'écrase tout près…'],
  ['dialga', 483, 72, 'r18', 0.4, 1, null, 'Le temps semble ralentir…'],
  ['palkia', 484, 72, 'r14', 0.6, -1, null, 'L\'air se tord, comme plié en deux…'],
  ['giratina', 487, 72, 'torii', 0.7, 1, null, 'Les ombres des torii s\'allongent…'],
  ['arceus', 493, 80, 'r20', 0.8, 1, (f) => pris(f, 'dialga', 'palkia', 'giratina'), 'Une lumière dorée t\'attendait au bout de la route…'],
  ['phione', 489, 50, 'r10', 0.5, -1, null, 'Une petite créature flotte dans une flaque…'],
  ['manaphy', 490, 50, 'r10', 0.3, -1, null, 'Une petite créature bleue t\'observe depuis les rochers…'],
  ['shaymin', 492, 60, 'r4', 0.5, 1, null, 'Les fleurs s\'écartent : un petit hérisson dort dessous…'],
  ['victini', 494, 60, 'r5', 0.7, -1, null, 'Une petite flamme de victoire danse sur la route…'],
  ['cobaltium', 638, 70, 'r17', 0.8, -1, null, 'Un regard d\'acier te jauge…'],
  ['terrakium', 639, 70, 'r16', 0.7, -1, null, 'Le sol tremble sous de lourds sabots…'],
  ['viridium', 640, 70, 'bois', 0.5, 1, null, 'Un cerf vert surgit d\'entre les troncs…'],
  ['keldeo', 647, 70, 'r12', 0.5, 1, (f) => pris(f, 'cobaltium', 'terrakium', 'viridium'), 'Un jeune poulain vient te défier, comme ses maîtres…'],
  ['boreas', 641, 70, 'orage1', 0.5, 1, null, 'Un vent violent se lève sans prévenir…'],
  ['fulguris', 642, 70, 'orage2', 0.5, -1, null, 'La foudre tombe tout près…'],
  ['demeteros', 645, 70, 'r15', 0.5, 1, (f) => pris(f, 'boreas', 'fulguris'), 'La terre s\'apaise sous un nuage bienveillant…'],
  ['reshiram', 643, 75, 'r13', 0.4, 1, null, 'Une flamme blanche embrase l\'horizon…'],
  ['zekrom', 644, 75, 'r14', 0.3, 1, null, 'Un éclair noir déchire le ciel…'],
  ['kyurem', 646, 75, 'givre2', 0.5, 1, (f) => pris(f, 'reshiram', 'zekrom'), 'Un froid mortel monte du sol…'],
  ['meloetta', 648, 60, 'r6', 0.5, 1, null, 'Une mélodie flotte dans l\'air…'],
  ['genesect', 649, 70, 'r19', 0.2, 1, null, 'Un insecte de métal te prend pour cible…'],
  ['xerneas', 716, 75, 'torii', 0.3, -1, null, 'Des bois arc-en-ciel brillent dans la forêt…'],
  ['yveltal', 717, 75, 'r18', 0.7, -1, null, 'Une ombre rouge plane au-dessus de la route…'],
  ['zygarde', 718, 75, 'r15', 0.8, -1, null, 'Des cellules vertes se rassemblent devant toi…'],
  ['hoopa', 720, 65, 'r7', 0.5, 1, null, 'Un anneau doré flotte en l\'air… quelque chose en sort !'],
  ['volcanion', 721, 70, 'r13', 0.7, -1, null, 'De la vapeur jaillit du sol…'],
  ['odyssor', 1052, 80, 'r9b', 0.3, -1, (f) => pris(f, 'arceus'), 'Le gardien d\'Odyssée descend du ciel. Il t\'attendait depuis le début.'],
];

/** pose les légendaires d'après la Ligue (avant fenceRoutes, qui garde leurs cases libres) */
export function poserLegendairesApresLigue(W, routes, legends) {
  const pose = [];
  for (const [id, sp, lvl, route, t, side, cond, texte] of APRES) {
    const R = routes.find((r) => r.id === route); if (!R) continue;
    const p = along(R.pts, t);
    let x, y;
    for (const off of [3, 4, 2, 5]) {
      [x, y] = nearestWalkable(W, p.x + 0.5 + p.nx * side * off, p.y + 0.5 + p.ny * side * off);
      if (!W.npcs.some((q) => q.x === x && q.y === y) && !W.items.some((q) => q.x === x && q.y === y) && !legends.some((q) => q.map === 'monde' && q.x === x && q.y === y)) break;
    }
    const L = { map: 'monde', id, sp, lvl, x, y, apresLigue: true, cond: (f) => maitre(f) && (!cond || cond(f)), intro: [texte, 'C\'est un Pokémon légendaire !'] };
    legends.push(L); pose.push(L);
  }
  return pose;
}

/** le Maître de la Tour de Combat, dans le hall de la Ligue */
export function poserTourDeCombat(league) {
  league.npc({ id: 'tour-combat', x: 10, y: 15, sprite: 'topdresseur', dir: 'left', script: 'tourCombat' });
}
