/* Registre des jeux du Hub. Ajouter un jeu = ajouter une entrée ici et un dossier avec son index.html. */
window.HUB_GAMES = [
  {
    id: 'drift',
    title: 'Duo Drift',
    tag: 'Course et bataille',
    desc: 'Courses vues de dessus, Grand Prix, bataille, foot en voiture… avec bots et garage.',
    url: 'drift/',
    minPlayers: 1, maxPlayers: 5,
    accent: '#ff4b2b',
    // affiche : rendu du jeu (drift/img/affiche.jpg)
    cover: `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="320" height="180" fill="#2b1a0e"/>
      <image href="drift/img/affiche.jpg" x="0" y="0" width="320" height="180" preserveAspectRatio="xMidYMid slice"/>
    </svg>`,
  },
  {
    id: 'david',
    title: 'DavidSimulator',
    tag: 'Monopoly édition Nice',
    desc: 'De Saint-Roch à la Promenade des Anglais : achète, construis, négocie. Classique ou Express (40 min), seul ou en 2 contre 2.',
    url: 'david/',
    minPlayers: 1, maxPlayers: 6,
    accent: '#1C5FB4',
    settings: [
      { key: 'mode', label: 'Mode', options: [['classic', 'Classique'], ['express', 'Express · 40 min']], def: 'classic' },
      { key: 'teams', label: 'Équipes', options: [['solo', 'Chacun pour soi'], ['2v2', '2 contre 2']], def: 'solo' },
      { key: 'bots', label: 'Bots', options: [[0, 'Aucun'], [1, '1'], [2, '2'], [3, '3']], def: 1 },
      { key: 'level', label: 'Niveau des bots', options: [['facile', 'Facile'], ['normal', 'Moyen'], ['expert', 'Difficile']], def: 'normal' },
      { key: 'cash', label: 'Argent de départ', group: 'Règles maison', options: [[1000, '1 000 €'], [1500, '1 500 €'], [2000, '2 000 €'], [2500, '2 500 €']], def: 1500 },
      { key: 'jackpot', label: 'Cagnotte au Parc gratuit', options: [[0, 'Non'], [1, 'Oui']], def: 0 },
      { key: 'doubleGo', label: 'Salaire doublé pile sur Départ', options: [[0, 'Non'], [1, 'Oui']], def: 0 },
      { key: 'auctions', label: 'Enchères', options: [[1, 'Oui'], [0, 'Non']], def: 1 },
    ],
    // affiche : rendu du jeu (david/img/affiche.jpg)
    cover: `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="320" height="180" fill="#3a2010"/>
      <image href="david/img/affiche.jpg" x="0" y="0" width="320" height="180" preserveAspectRatio="xMidYMid slice"/>
    </svg>`,
  },
  {
    id: 'calcul',
    title: 'Tête de Calcul',
    tag: 'Duel de calcul mental',
    desc: 'Calcul, astuces, vrai ou faux, équations, géométrie, figures à compter, suites et Compte est bon. Le plus rapide gagne… et peut saboter les autres ! Mode The Candidate : un entretien éliminatoire, jusqu\'au code Python.',
    url: 'calcul/',
    minPlayers: 1, maxPlayers: 6, maxWithBots: 8, // 6 joueurs au plus, et jusqu'à 8 avec les bots
    accent: '#ff5fa2',
    settings: [
      { key: 'mode', label: 'Mode', options: [['classic', 'Classique'], ['chartier', 'The Candidate'], ['peril', 'Péril'], ['eclair', 'Éclair']], def: 'classic' },
      { key: 'theme', label: 'Questions', options: [['mix', 'Mélangé'], ['base', '4 opérations'], ['malin', 'Astuces'], ['frac', 'Fractions'], ['logique', 'Logique'], ['flash', 'Vrai/Faux'], ['algebre', 'Équations'], ['geo', 'Géométrie'], ['vite', 'Vitesse'], ['compte', 'Compte est bon']], def: 'mix' },
      { key: 'len', label: 'Longueur', options: [[10, '10 questions'], [15, '15 questions'], [20, '20 questions'], [30, '30 questions']], def: 10 },
      { key: 'diff', label: 'Difficulté', options: [['facile', 'Facile'], ['normal', 'Moyen'], ['expert', 'Difficile']], def: 'normal' },
      { key: 'bots', label: 'Bots', options: [[0, 'Aucun'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']], def: 1 },
      { key: 'level', label: 'Niveau des bots', options: [['facile', 'Facile'], ['normal', 'Moyen'], ['expert', 'Difficile']], def: 'normal' },
      { key: 'sabotage', label: 'Sabotage', group: 'Règles maison', options: [[1, 'Oui'], [0, 'Non']], def: 1, notMode: 'chartier' },
      { key: 'finale', label: 'Dernière question quitte ou double', options: [[1, 'Oui'], [0, 'Non']], def: 1 },
      // règles de The Candidate (affichées seulement dans ce mode)
      { key: 'module', label: 'Poste à pourvoir', group: 'The Candidate', options: [['gen', 'Généraliste'], ['trading', 'Trading'], ['ma', 'M&A'], ['quant', 'Quant'], ['risk', 'Risques']], def: 'gen', onlyMode: 'chartier' },
      { key: 'lives', label: 'Vies par candidat', options: [[2, '2'], [3, '3'], [5, '5']], def: 3, onlyMode: 'chartier' },
      { key: 'jokers', label: 'Jokers (50/50, ami)', options: [[1, 'Oui'], [0, 'Non']], def: 1, onlyMode: 'chartier' },
      { key: 'code', label: 'Épreuve de code Python', options: [[1, 'Oui'], [0, 'Non']], def: 1, onlyMode: 'chartier' },
      { key: 'sql', label: 'Épreuve SQL', options: [[1, 'Oui'], [0, 'Non']], def: 1, onlyMode: 'chartier' },
      { key: 'cut', label: 'Le dernier coupé à chaque tour', options: [[1, 'Oui'], [0, 'Non']], def: 1, onlyMode: 'chartier' },
      { key: 'duel', label: 'Face-à-face final', options: [[1, 'Oui'], [0, 'Non']], def: 1, onlyMode: 'chartier' },
      { key: 'chsab', label: 'Sabotage', options: [[0, 'Non'], [1, 'Oui']], def: 0, onlyMode: 'chartier' },
    ],
    // affiche : rendu du jeu (calcul/img/affiche.jpg)
    cover: `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="320" height="180" fill="#0b0d1a"/>
      <image href="calcul/img/affiche.jpg" x="0" y="0" width="320" height="180" preserveAspectRatio="xMidYMid slice"/>
    </svg>`,
  },
  {
    id: 'bastion',
    title: 'Bastion Clash',
    tag: 'RTS StarCraft · Base & Micro',
    desc: 'Deux factions (Terriens ou Synthèse), cinq cartes, duel, 2 contre 2 et défense contre des vagues : récolte, construis, gère ton ravitaillement et mène ton armée.',
    url: 'bastion/',
    minPlayers: 1, maxPlayers: 4,
    accent: '#2fbf71',
    settings: [
      { key: 'map', label: 'Champ de bataille', options: [['vallee', '🌲 Vallée Tempérée (Classique)'], ['magma', '🌋 Fissures de Magma (+Gaz & Chokepoints)'], ['glace', '❄️ Glacier Boréal (+Vitesse & Forage Rapide)'], ['desert', '🏜️ Canyon de Cuivre (Oasis & Récolte Rapide)'], ['ruines', '🌃 Ruines Néon (Nuit & Avant-postes Riches)']], def: 'vallee' },
      { key: 'mode', label: 'Format & Équipes', options: [
        ['ffa', 'Chacun pour soi (FFA)'],
        ['1v1', 'Duel 1 contre 1 (carte dédiée)'],
        ['waves', 'Coop : Défense contre des vagues'],
        ['2v2_coop', '2v2 Coop : Humains ensemble vs Bots'],
        ['2v2_duel', '2v2 Duel : Humain + Bot vs Humain + Bot'],
        ['2v2_pvp', '2v2 PvP : Joueurs 1 & 2 vs Joueurs 3 & 4'],
      ], def: 'ffa' },
      { key: 'factions', label: 'Factions', options: [['libre', 'Au choix de chacun'], ['terran', '🛡️ Tous Terriens'], ['synth', '💠 Tous Synthèse'], ['random', '🎲 Au hasard']], def: 'libre' },
      { key: 'pace', label: 'Rythme', options: [['standard', 'Standard'], ['blitz', 'Blitz (plus rapide)']], def: 'standard' },
      { key: 'bots', label: 'Bots', options: [[0, 'Aucun'], [1, '1'], [2, '2'], [3, '3']], def: 1 },
      { key: 'level', label: 'Niveau des bots', options: [['facile', 'Facile'], ['normal', 'Moyen'], ['expert', 'Difficile']], def: 'normal' },
    ],
    // affiche : rendu du jeu (bastion/img/affiche.jpg)
    cover: `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="320" height="180" fill="#0e1a12"/>
      <image href="bastion/img/affiche.jpg" x="0" y="0" width="320" height="180" preserveAspectRatio="xMidYMid slice"/>
    </svg>`,
  },
  {
    id: 'outbreak',
    title: 'Outbreak : Secteur Zéro',
    tag: 'Survie zombie en coop',
    desc: 'Twin-stick en équipe : 5 classes, 5 secteurs (dont les rues de Nice), boss, marchand, histoire. Campagne à embranchements, Survie ou Défense du fort.',
    url: 'outbreak/',
    minPlayers: 1, maxPlayers: 5,
    accent: '#f43f5e',
    settings: [
      { key: 'mode', label: 'Mode', options: [['campaign', 'Campagne · 7 salles'], ['survival', 'Survie · vagues infinies'], ['defense', 'Défense · tenir le fort']], def: 'campaign' },
      { key: 'difficulty', label: 'Difficulté', options: [['arcade', 'Arcade'], ['normal', 'Normale'], ['hardcore', 'Cauchemar']], def: 'normal' },
      { key: 'bots', label: 'Équipiers IA', options: [[0, 'Aucun'], [1, '1'], [2, '2'], [3, '3']], def: 1 },
      { key: 'startWeapon', label: 'Arme de départ', options: [['pistol', 'Pistolet'], ['shotgun', 'Fusil à pompe'], ['smg', 'Mitraillette']], def: 'pistol' },
      { key: 'sector', label: 'Secteur', options: [['random', 'Au hasard'], ['lab', 'Labo'], ['sewers', 'Égouts'], ['hospital', 'Hôpital'], ['metro', 'Métro'], ['nice', 'Rues de Nice']], def: 'random' },
    ],
    // affiche : rendu du jeu (outbreak/img/affiche.jpg)
    cover: `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="320" height="180" fill="#0a0b10"/>
      <image href="outbreak/img/affiche.jpg" x="0" y="0" width="320" height="180" preserveAspectRatio="xMidYMid slice"/>
    </svg>`,
  },
  {
    id: 'filrouge',
    title: 'Fil Rouge',
    tag: 'Désamorçage à deux voix',
    desc: 'Un démineur voit la bombe en 3D, l\'expert a le manuel posé sur sa table. Parlez-vous, coupez le bon fil… ou affrontez une autre équipe sur la même bombe.',
    url: 'filrouge/',
    minPlayers: 2, maxPlayers: 6,
    accent: '#c8102e',
    settings: [
      { key: 'mode', label: 'Mode', options: [['coop', '🤝 Coopération'], ['versus', '⚔️ Duel · 2 contre 2']], def: 'coop' },
      { key: 'diff', label: 'Bombe', options: [['initiation', 'Initiation · 2 modules'], ['facile', 'Facile · 3'], ['normal', 'Moyen · 5'], ['expert', 'Difficile · 7']], def: 'facile' },
      { key: 'strikes', label: 'Fautes permises', options: [[1, '1'], [3, '3'], [5, '5']], def: 3 },
      { key: 'sabotage', label: 'Sabotages en duel', group: 'Règles maison', options: [[1, 'Oui'], [0, 'Non']], def: 1 },
    ],
    // affiche : rendu du jeu (filrouge/img/affiche.jpg)
    cover: `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="320" height="180" fill="#140608"/>
      <image href="filrouge/img/affiche.jpg" x="0" y="0" width="320" height="180" preserveAspectRatio="xMidYMid slice"/>
    </svg>`,
  },
  {
    id: 'kart',
    title: 'Cyber Kart GP',
    tag: 'Course de karts en 3D',
    desc: 'Kart en 3D façon Mario Kart : Grand Prix de 6 circuits (Grand Circuit, Whisky Peak, Route Arc-en-ciel, Jungle Perdue, Château Hanté, Plage des Falaises) aux points cumulés, drift et mini-turbo, 16 objets, 8 pilotes et IA.',
    url: 'kart/',
    minPlayers: 1, maxPlayers: 6,
    accent: '#5ff3ff',
    // affiche : rendu du jeu (kart/img/affiche.jpg)
    cover: `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="320" height="180" fill="#1b0f4a"/>
      <image href="kart/img/affiche.jpg" x="0" y="0" width="320" height="180" preserveAspectRatio="xMidYMid slice"/>
    </svg>`,
  },
  {
    id: 'convoy',
    title: 'Convoy Storm',
    tag: 'Survie en coop dans le blizzard',
    desc: 'Un convoi blindé traverse une plaine gelée. Sautez du train, fouillez les ruines, repoussez les loups et gardez la chaudière en vie jusqu\'à Fort-Givre — ou aussi loin que possible.',
    url: 'convoy/',
    minPlayers: 1, maxPlayers: 6,
    accent: '#9fd3ff',
    settings: [
      { key: 'mode', label: 'Mode', options: [['expedition', 'Expédition'], ['endless', 'Sans fin']], def: 'expedition' },
      { key: 'difficulty', label: 'Difficulté', options: [['facile', 'Facile'], ['normal', 'Normale'], ['blizzard', 'Blizzard']], def: 'normal' },
    ],
    // affiche : rendu du jeu (convoy/img/affiche.jpg)
    cover: `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="320" height="180" fill="#c3ced9"/>
      <image href="convoy/img/affiche.jpg" x="0" y="0" width="320" height="180" preserveAspectRatio="xMidYMid slice"/>
    </svg>`,
  },
  {
    id: 'pokemon',
    title: 'Poké Duel',
    tag: 'Combat & Tournoi 3v3',
    desc: 'Batailles stratégiques 3v3 en tournoi : équipes aléatoires, faiblesses de types, switchs tactiques et attaques cultes.',
    url: 'pokemon/',
    minPlayers: 1, maxPlayers: 6,
    accent: '#ffcb05',
    settings: [
      { key: 'timer', label: 'Chrono par tour', options: [[15, '15 s (Blitz)'], [25, '25 s (Normal)'], [40, '40 s (Stratégique)']], def: 25 },
      { key: 'gen', label: 'Génération', options: [['all', 'Gens 1 à 3 (Iconiques)'], ['kanto', 'Gen 1 (Kanto 151)'], ['hoenn', 'Gen 2 & 3 (Johto & Hoenn)']], def: 'all' },
      { key: 'bots', label: 'Bots si salon incomplet', options: [[1, 'Oui (remplir le tournoi)'], [0, 'Non']], def: 1 },
      { key: 'level', label: 'Niveau des bots', options: [['facile', 'Facile'], ['normal', 'Moyen'], ['expert', 'Difficile']], def: 'normal' },
    ],
    cover: `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="pglow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="#ffdd44" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#1b2838" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="pbg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e3c72"/>
          <stop offset="100%" stop-color="#0e1726"/>
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#pbg)"/>
      <ellipse cx="160" cy="140" rx="140" ry="36" fill="#1b4d3e" stroke="#2a75bb" stroke-width="3"/>
      <ellipse cx="160" cy="140" rx="100" ry="24" fill="none" stroke="#ffcb05" stroke-width="2" stroke-dasharray="8 6"/>
      <circle cx="160" cy="90" r="80" fill="url(#pglow)"/>
      <g transform="translate(160, 85)">
        <ellipse cx="0" cy="55" rx="50" ry="12" fill="#000" opacity="0.45"/>
        <path d="M-45 0 A 45 45 0 0 1 45 0 Z" fill="#ee1515" stroke="#16181d" stroke-width="4"/>
        <path d="M-45 0 A 45 45 0 0 0 45 0 Z" fill="#f8f9fa" stroke="#16181d" stroke-width="4"/>
        <rect x="-45" y="-5" width="90" height="10" fill="#16181d"/>
        <circle cx="0" cy="0" r="16" fill="#16181d"/>
        <circle cx="0" cy="0" r="10" fill="#ffffff" stroke="#16181d" stroke-width="2"/>
        <circle cx="0" cy="0" r="5" fill="#ffcb05"/>
      </g>
      <path d="M70 40 L90 55 L82 62 L105 78 L85 70 L92 64 Z" fill="#ffcb05" stroke="#16181d" stroke-width="2"/>
      <path d="M250 35 L230 52 L238 58 L215 76 L235 68 L228 62 Z" fill="#ffcb05" stroke="#16181d" stroke-width="2"/>
      <circle cx="50" cy="120" r="18" fill="#e62829" stroke="#16181d" stroke-width="3"/>
      <text x="50" y="125" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="11" fill="#ffffff">FEU</text>
      <circle cx="270" cy="120" r="18" fill="#2980ef" stroke="#16181d" stroke-width="3"/>
      <text x="270" y="125" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="11" fill="#ffffff">EAU</text>
      <rect x="95" y="142" width="130" height="26" rx="8" fill="#ffcb05" stroke="#16181d" stroke-width="3"/>
      <text x="160" y="160" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="14" fill="#16181d">3v3 SHOWDOWN</text>
    </svg>`,
  },
];
