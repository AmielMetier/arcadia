// odyssee/js/donjons/voies.js — le Sanctuaire des Trois Voies : un donjon à trois joueurs, salles séparées.
//
// Salle 1 : trois dalles, une par joueur, pour ouvrir la porte.
// Salle 2 : les statues du trio des lacs et trois portes (Sagesse, Force, Courage). Une porte ne laisse passer
//           qu'un joueur, et on ne revient pas en arrière : chacun suit son chemin.
// Salles 3 : Sagesse, l'énigme des menteurs ; Force, deux dresseurs et un gardien à blocs (immunisé aux attaques
//            spéciales tant que son premier bloc tient, son Attaque monte à chaque bloc cassé) ; Courage, une salle en
//            croix : chaque interrupteur ouvre quelques secondes la grille suivante (bas → gauche → droite → haut), un
//            dresseur en embuscade, des caisses à pousser ; coincé derrière une grille, on recommence la salle.
//            Au bout de chaque épreuve : un parchemin avec un nombre à deux chiffres.
// Salles 4 : la même grande salle pour les trois, dans le noir (le coffre brille au centre). Cinq dresseurs (un deuxième parchemin), un coffre qui s'ouvre avec ses
//            deux nombres et donne l'ordre du code de la grande porte, code fait des nombres des deux autres.
// Salle 5 : un couloir commun, trois sentinelles à affronter à trois contre trois (neuf Pokémon chacune).
// Salle 6 : le gardien des Trois Voies, à trois contre un.
import { T } from '../world/tiles.js';

const VOIES = { s: 'Sagesse', f: 'Force', c: 'Courage' };


// les salles 4 sont des copies : mêmes plans, mêmes dresseurs, lettres différentes pour chaque chemin
const PLAN4 = [
  '#######################################',
  '###################N###################',
  '##################VVV##################',
  '#...........#.##.......##.#...........#',
  '##.%.....%..#..#.......#..#..%.....%.##',
  '#.%................K................%.#',
  '####...#.....$...........?.....#...####',
  '##...................................##',
  '##........1.................2........##',
  '#.....................................#',
  '#..............#%#...#%#..............#',
  '#..#.....%%.....#.....#.....%%.....#..#',
  '#&.#..%..%.#...%.......%...#.%..%..#.&#',
  '#........%..#.............#..%........#',
  '#....%%.........&.....&.........%%....#',
  '#......%.......................%......#',
  '#....+%............H............%*....#',
  '#.....................................#',
  '#.........%.................%.........#',
  '##........%....&.......&....%........##',
  '###.....4.......&.....&.......5.....###',
  '##...................................##',
  '#......%...........3...........%......#',
  '#......%.......................%......#',
  '###...%.&.....................&.%...###',
  '###......&&.................&&......###',
  '##%..%....&.&.............&.&....%..%##',
  '##%%...&.&..&.+.........+.&..&.&...%%##',
  '#.......&...#..#.......#..#...&.......#',
  '#...........#.##.......##.#...........#',
  '###################S###################',
  '###################D###################',
  '#######################################',
];
const LETTRES4 = { s: 'abcde', f: 'fghjk', c: 'lmnvw' };
const DRESSEURS4 = [
  { cls: 'Gardien', nom: 'Aubin', sprite: 'vieil_homme', equipe: [[16, 22], [17, 23]] },
  { cls: 'Gardienne', nom: 'Iris', sprite: 'fillette2', equipe: [[19, 22], [20, 23], [21, 22]] },
  { cls: 'Gardien', nom: 'Colas', sprite: 'montagnard', equipe: [[27, 23], [28, 24]] },
  { cls: 'Gardienne', nom: 'Nell', sprite: 'dame', equipe: [[43, 23], [44, 24], [69, 23], [70, 24]] },
  { cls: 'Gardien', nom: 'Hugo', sprite: 'gamin', equipe: [[60, 24], [61, 25], [54, 24]] },
];
// ils guettent le passage : dès qu'ils te voient, ils viennent te défier
const DIRS4 = ['right', 'left', 'down', 'right', 'left'];
const plan4 = (v) => PLAN4.map((r) => r.replace(/[1-5]/g, (n) => LETTRES4[v][+n - 1]));
const pnj4 = () => {
  const out = {};
  for (const [v, l] of Object.entries(LETTRES4)) [...l].forEach((k, i) => { out[k] = { ...DRESSEURS4[i], id: `${v}4-${i}`, dir: DIRS4[i], vue: 6, defi: 'Tu ne passeras pas sans m\'affronter !', perd: 'Ton chemin continue...' }; });
  return out;
};

/** codes tirés à chaque descente : deux nombres par chemin, l'ordre du code de chaque grande porte */
function preparer(r) {
  const vus = new Set(), nombre = () => { for (;;) { const n = 10 + Math.floor(r() * 90); if (!vus.has(n)) { vus.add(n); return n; } } };
  const codes = {}; for (const v of Object.keys(VOIES)) codes[v] = [nombre(), nombre()];
  const motifs = {}, portes = {};
  for (const v of Object.keys(VOIES)) {
    const [a, b] = Object.keys(VOIES).filter((q) => q !== v);
    // deux places pour chacun des deux autres chemins, et pour chacun l'ordre de ses deux nombres
    const places = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]][Math.floor(r() * 6)];
    const motif = [0, 1, 2, 3].map((k) => (places.includes(k) ? a : b));
    const ordre = { [a]: r() < 0.5 ? [0, 1] : [1, 0], [b]: r() < 0.5 ? [0, 1] : [1, 0] }, vu = { [a]: 0, [b]: 0 };
    motifs[v] = motif;
    portes[v] = motif.map((q) => String(codes[q][ordre[q][vu[q]++]])).join('');
  }
  return { codes, motifs, portes };
}

export default {
  id: 'voies',
  carte: 'voies',
  nom: 'Sanctuaire des Trois Voies',
  niveau: 'niv. 20 à 30',
  entree: 'Trois vertus, trois chemins. Aucun ne mène au bout sans les deux autres.',
  joueurs: { mode: 'exact', n: 3 },
  musique: 'fairy',
  equipe: 'debut',
  preparer,
  voies: VOIES,
  vueLarge: true,   // salles sombres : on y voit comme dans le labyrinthe du Bois des Contes
  portesDecor: { 1: 'porte_grille' },
  decor: { '%': 'caverock', '&': 'stalag', '~': 'fontaine' },
  objets: {
    // statues du trio des lacs, sur leur socle : Créhelf (Sagesse), Créfadet (Force), Créfollet (Courage)
    '<': { type: 'statue', decor: 'socle_statue', sp: 480 },
    '^': { type: 'statue', decor: 'socle_statue', sp: 482 },
    '>': { type: 'statue', decor: 'socle_statue', sp: 481 },
    // les grandes statues du centre, en triangle
    '(': { type: 'statue', decor: 'socle_statue', sp: 480, grand: true },
    '=': { type: 'statue', decor: 'socle_statue', sp: 482, grand: true },
    ')': { type: 'statue', decor: 'socle_statue', sp: 481, grand: true },
    P: { type: 'panneau', texte: 'Trois portes, trois épreuves, trois aventuriers.\nVos chemins se séparent ici, mais vos destins restent liés.' },
    Q: { type: 'panneau', texte: 'Certains d\'entre nous mentent toujours, les autres disent toujours vrai.\nLisez-nous toutes, puis désignez qui dit vrai et qui ment.' },
    Z: { type: 'voie', decor: 'porte_sagesse', voie: 's' },
    Y: { type: 'voie', decor: 'porte_force', voie: 'f' },
    W: { type: 'voie', decor: 'porte_courage', voie: 'c' },
    // (les lettres S, D, N et o sont réservées au plan : arrivée, sortie, passage, dalle)
    A: { type: 'menteur', decor: 'socle_statue', sp: 7, n: 0 },
    E: { type: 'menteur', decor: 'socle_statue', sp: 4, n: 1 },
    F: { type: 'menteur', decor: 'socle_statue', sp: 1, n: 2 },
    G: { type: 'menteur', decor: 'socle_statue', sp: 25, n: 3 },
    X: { type: 'menteur', decor: 'socle_statue', sp: 133, n: 4 },
    K: { type: 'parchemin', sol: true },
    H: { type: 'coffre', decor: 'coffre' },
    V: { type: 'porteCode', decor: 'porte_code' },
    L: { type: 'caisse', decor: 'caisse' },
    R: { type: 'levier', decor: 'pc' },
    // Courage : chaque interrupteur ouvre des grilles pour quelques secondes (la suivante et celle du bras où il est)
    I: { type: 'interrupteur', sol: true, decor: 'interrupteur', ouvre: ['J'], duree: 5 },
    C: { type: 'interrupteur', sol: true, decor: 'interrupteur', ouvre: ['J', 'O'], duree: 4 },
    U: { type: 'interrupteur', sol: true, decor: 'interrupteur', ouvre: ['O', 'T'], duree: 4 },
    J: { type: 'grille', decor: 'porte_grille' },
    O: { type: 'grille', decor: 'porte_grille' },
    T: { type: 'grille', decor: 'porte_grille' },
    '!': { type: 'embuscade', sol: true, pnj: 'r' },
    '$': { type: 'ramasser', objet: 'hyper-potion' },
    '?': { type: 'ramasser', objet: 'full-heal' },
    '+': { type: 'ramasser', objet: 'super-potion', n: 2 },
    '*': { type: 'ramasser', objet: 'revive' },
  },
  pnj: {
    p: { id: 'f3-1', cls: 'Karatéka', nom: 'Bruno', sprite: 'karateka', dir: 'right', vue: 16, duoAvec: 'q', defi: 'Halte ! À deux contre toi, voyons ce que vaut ta force !', perd: 'Ta force est réelle...', equipe: [[66, 21], [56, 21]] },
    q: { id: 'f3-2', cls: 'Karatéka', nom: 'Shin', sprite: 'karateka', dir: 'left', vue: 16, duoAvec: 'p', equipe: [[67, 23], [57, 22], [106, 23]] },
    B: {
      id: 'f3-gardien', cls: 'Gardien', nom: 'de la Force', sprite: 'karateka', dir: 'down', raid: true, espece: 68, niveau: 25,
      blocs: 3, immunite: 'speciale', boost: 2,
      avant: ['Je suis le gardien de la Force.', 'Chaque bouclier brisé me rendra plus fort !'],
      cri: 'Montre-moi ce que vaut ta force !', apres: 'Ta force est réelle. Le chemin est à toi.',
    },
    r: { id: 'c3-1', cls: 'Dompteuse', nom: 'Sacha', sprite: 'fillette2', dir: 'right', equipe: [[58, 22], [77, 22], [37, 23]], embuscade: 'Halte ! Personne ne passe sans m\'affronter !' },
    ...pnj4(),
    // sentinelles du couloir : à trois contre trois, neuf Pokémon chacune, l'une après l'autre
    x: { id: 'c5-1', cls: 'Sentinelle', nom: 'Bleue', sprite: 'vieil_homme', dir: 'right', groupe: true, avant: ['Halte, aventuriers. Vous voici de nouveau réunis.', 'Montrez-moi que vous savez vous battre ensemble !'], apres: 'Bien. Avancez.',
      equipe: [[60, 21], [72, 21], [118, 21], [129, 20], [116, 21], [54, 22], [86, 21], [90, 21], [98, 22]] },
    y: { id: 'c5-2', cls: 'Sentinelle', nom: 'Rouge', sprite: 'vieil_homme', dir: 'left', groupe: true, avant: ['Mes Pokémon brûlent d\'impatience.', 'À trois contre trois !'], apres: 'Votre flamme est plus forte que la mienne.',
      equipe: [[37, 22], [58, 22], [77, 22], [4, 21], [126, 22], [218, 21], [228, 22], [240, 21], [255, 22]] },
    z: { id: 'c5-3', cls: 'Sentinelle', nom: 'Verte', sprite: 'vieil_homme', dir: 'right', groupe: true, avant: ['Dernière sentinelle avant le cœur du sanctuaire.', 'Voyons si votre lien tient jusqu\'au bout.'], apres: 'Le Gardien vous attend.',
      equipe: [[43, 22], [69, 22], [102, 22], [1, 21], [152, 21], [187, 22], [191, 21], [270, 22], [273, 22]] },
    M: {
      id: 'gardien-voies', cls: '', nom: 'Gardien des Trois Voies', sprite: 'vieil_homme', dir: 'down', raid: true, espece: 151, niveau: 30, blocs: 5,
      // Psyko, Lance-Flammes, Tonnerre, Soin (rend deux blocs) ; à chaque bloc brisé, une fois par combat :
      boost: 0, moves: [94, 53, 85, 105], soinBlocs: 2,
      effets: { 4: ['boostTout', 'piegeRoc'], 3: ['baisseAttaques', 'ko'], 2: ['ko'], 1: ['ko'] },
      avant: ['Trois chemins, trois épreuves... et vous voilà réunis.', 'Voyons si ce lien tient face à moi.'],
      cri: 'Montrez-moi la force de votre lien !', apres: 'Votre lien est plus fort que mes trois boucliers. Le sanctuaire vous reconnaît.',
    },
  },
  salles: [
    { id: 's1', nom: 'Salle des Dalles', type: 'dalles', porte: '1', plan: [
      '###########',
      '#####N#####',
      '####111####',
      '##.......##',
      '##.......##',
      '##.o.o.o.##',
      '##.......##',
      '##.......##',
      '#####S#####',
      '#####D#####',
    ] },
    { id: 's2', nom: 'Salle des Trois Voies', type: 'voies', voies: { Z: 's3s', Y: 's3f1', W: 's3c' }, plan: [
      '###########################',
      '####<Z<#####^Y^#####>W>####',
      '#.........................#',
      '#.........................#',
      '#.........................#',
      '#.........................#',
      '#............(............#',
      '#.........................#',
      '#............~............#',
      '#.........=.....).........#',
      '#............P............#',
      '#.........................#',
      '#.........................#',
      '#.........................#',
      '#############S#############',
      '#############D#############',
    ] },
    { id: 's3s', nom: 'Épreuve de la Sagesse', type: 'menteurs', voie: 's', porte: '1', parchemin: 1, apres: ['s2'], suivante: 's4s', plan: [
      '###################',
      '#########N#########',
      '########111########',
      '##.......K.......##',
      '##...............##',
      '##.A..E..F..G..X.##',
      '##...............##',
      '##.......Q.......##',
      '##...............##',
      '##...............##',
      '#########S#########',
    ] },
    { id: 's3f1', nom: 'Épreuve de la Force', type: 'combat', voie: 'f', pnj: ['p', 'q'], apres: ['s2'], plan: [
      '#################',
      '########N########',
      '#######...#######',
      '###...........###',
      '##.............##',
      '##..%.......%..##',
      '#p.............q#',
      '##..%.......%..##',
      '##.............##',
      '###...........###',
      '###...........###',
      '#######...#######',
      '#######...#######',
      '########S########',
    ] },
    { id: 's3f2', nom: 'Gardien de la Force', type: 'raid', voie: 'f', pnj: ['B'], parchemin: 1, apres: ['s3f1'], suivante: 's4f', plan: [
      '#############',
      '######N######',
      '#####.K.#####',
      '##.........##',
      '##....B....##',
      '##.........##',
      '##.........##',
      '##.........##',
      '######S######',
      '######D######',
    ] },
    { id: 's3c', nom: 'Épreuve du Courage', type: 'combat', voie: 'c', pnj: ['r'], parchemin: 1, apres: ['s2'], suivante: 's4c', plan: [
      '#######################N#######################',
      '#####################..K..#####################',
      '#####################.....#####################',
      '#####################.....#####################',
      '#####################TTTTT#####################',
      '#####################.....#####################',
      '#####################.....#####################',
      '#####################%....#####################',
      '#####################.....#####################',
      '#####################....%#####################',
      '#####################.....#####################',
      '#####################.....#####################',
      '#...%...%..J...!.r.........###.L...O....%.....#',
      '#..........J...!............L...#.#O..........#',
      '#.C........J...!..........#####..L#O........U.#',
      '#..........J...!...............#...O..........#',
      '#...%......J...!............####..#O....%.....#',
      '#####################.....#####################',
      '#####################.....#####################',
      '#####################.....#####################',
      '#####################%....#####################',
      '#####################.....#####################',
      '#####################....%#####################',
      '#####################.....#####################',
      '#####################..I..#####################',
      '#####################.....#####################',
      '#####################.....#####################',
      '####################R....%#####################',
      '#####################.....#####################',
      '#####################.....#####################',
      '#######################S#######################',
      '###############################################',
    ] },
    { id: 's4s', nom: 'Salle des Codes (Sagesse)', type: 'combat', voie: 's', pnj: [...LETTRES4.s], parchemin: 2, sombre: true, ouvertPar: 'porte', apres: ['s3s'], suivante: 's5', plan: plan4('s') },
    { id: 's4f', nom: 'Salle des Codes (Force)', type: 'combat', voie: 'f', pnj: [...LETTRES4.f], parchemin: 2, sombre: true, ouvertPar: 'porte', apres: ['s3f2'], suivante: 's5', plan: plan4('f') },
    { id: 's4c', nom: 'Salle des Codes (Courage)', type: 'combat', voie: 'c', pnj: [...LETTRES4.c], parchemin: 2, sombre: true, ouvertPar: 'porte', apres: ['s3c'], suivante: 's5', plan: plan4('c') },
    { id: 's5', nom: 'Couloir des Sentinelles', type: 'groupe', pnj: ['x', 'y', 'z'], apres: ['s4s', 's4f', 's4c'], plan: [
      '###############',
      '#######N#######',
      '######...######',
      '###.........###',
      '#z...........##',
      '##...........##',
      '##...........y#',
      '##...........##',
      '#x...........##',
      '##...........##',
      '###.........###',
      '######...######',
      '#######S#######',
    ] },
    { id: 's6', nom: 'Cœur du Sanctuaire', type: 'raid', pnj: ['M'], apres: ['s5'], plan: [
      '#############',
      '#...........#',
      '#.....M.....#',
      '#...........#',
      '#...........#',
      '#...........#',
      '######S######',
    ] },
  ],
  // menteurs de l'Épreuve de la Sagesse (dans l'ordre des statues A, C, D, E, F), vérifiés par les tests
  menteurs: {
    noms: ['Carapuce', 'Salamèche', 'Bulbizarre', 'Pikachu', 'Évoli'],
    paroles: [
      'Nous sommes exactement un à mentir.',
      'Entre Bulbizarre et Carapuce, un seul dit la vérité.',
      'Pikachu ou Carapuce ment, peut-être les deux.',
      'Bulbizarre ou Salamèche ment, peut-être les deux.',
      'Salamèche ment.',
    ],
    // la règle de chaque phrase, pour les tests : v = qui dit vrai
    regles: [
      (v) => v.filter((x) => !x).length === 1,
      (v) => v[2] !== v[0],
      (v) => !v[3] || !v[0],
      (v) => !v[2] || !v[1],
      (v) => !v[1],
    ],
    sinceres: [1, 2],
  },
  inscriptions: {
    s: ['Porte de la Sagesse.', 'Pour celui qui voit clair là où les autres se perdent. Ici, la force ne sert à rien.'],
    f: ['Porte de la Force.', 'Pour celui qui ne recule devant aucun adversaire. Ici, seule la puissance ouvre le chemin.'],
    c: ['Porte du Courage.', 'Pour celui qui avance sans savoir ce qui l\'attend. Ici, il faudra oser.'],
  },
  journal: [
    { id: 'dalles', nom: 'Les trois dalles', salle: 's1', but: 'Il faut un joueur sur chaque dalle en même temps.' },
    { id: 'voie', nom: 'Choisir sa voie', salle: 's2', but: 'Chacun prend une porte différente.' },
    { id: 'epreuve', nom: 'Ton épreuve', salle: 's2', but: 'Termine l\'épreuve de ton chemin.' },
    { id: 'codes', nom: 'La grande porte', salle: 's2', but: 'Bats les gardiens, ouvre le coffre avec tes deux nombres, puis trouve le code de la grande porte avec tes coéquipiers.' },
    { id: 'gardien', nom: 'Le Gardien des Trois Voies', salle: 's6', but: 'Retrouvez-vous et affrontez le gardien ensemble.' },
  ],
  textes: {
    masque: 'Une présence immense emplit la salle.',
    cri: 'Montrez-moi la force de votre lien !',
    apres: 'Le sanctuaire vous reconnaît.',
    perdu: ['Tes Pokémon n\'en peuvent plus...', 'Tu te réveilles à l\'entrée de la salle. Ton équipe a été soignée.'],
    victoire: 'Le sanctuaire vous reconnaît.',
  },
  recompense: { objets: { 'ct-abri': 1, 'relique-triforce': 1 } },
};
