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
    cover: `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="320" height="180" fill="#3a7440"/>
      <g fill="#2f6136"><circle cx="40" cy="30" r="16"/><circle cx="285" cy="150" r="20"/><circle cx="290" cy="28" r="12"/></g>
      <path d="M-20 140 C 60 140, 80 40, 160 40 S 260 140, 340 120" fill="none" stroke="#16181d" stroke-width="54"/>
      <path d="M-20 140 C 60 140, 80 40, 160 40 S 260 140, 340 120" fill="none" stroke="#4a4d55" stroke-width="44"/>
      <path d="M-20 140 C 60 140, 80 40, 160 40 S 260 140, 340 120" fill="none" stroke="#fff8ea" stroke-width="3" stroke-dasharray="12 12"/>
      <g transform="translate(118 58) rotate(-28)"><rect x="-17" y="-9" width="34" height="18" rx="5" fill="#ff4b2b" stroke="#16181d" stroke-width="3"/><rect x="2" y="-6" width="9" height="12" rx="2" fill="#16181d"/></g>
      <g transform="translate(206 86) rotate(32)"><rect x="-17" y="-9" width="34" height="18" rx="5" fill="#2b8cff" stroke="#16181d" stroke-width="3"/><rect x="2" y="-6" width="9" height="12" rx="2" fill="#16181d"/></g>
      <g transform="translate(64 116)"><path d="M0 0 h26 v16 h-26z" fill="#fff8ea" stroke="#16181d" stroke-width="2"/><path d="M0 0h6.5v4h-6.5zM13 0h6.5v4H13zM6.5 4H13v4H6.5zM19.5 4H26v4h-6.5zM0 8h6.5v4H0zM13 8h6.5v4H13zM6.5 12H13v4H6.5zM19.5 12H26v4h-6.5z" fill="#16181d"/></g>
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
    cover: `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="320" height="180" fill="#9FD8F5"/>
      <rect y="110" width="320" height="70" fill="#1C5FB4"/>
      <path d="M0 110 Q 80 100 160 112 T 320 106 V118 H0Z" fill="#f3e9d2"/>
      <circle cx="270" cy="40" r="18" fill="#FDE62F" stroke="#16181d" stroke-width="3"/>
      <g transform="translate(160 92)">
        <path d="M0 -62 L110 0 L0 62 L-110 0Z" fill="#fff8ea" stroke="#16181d" stroke-width="4"/>
        <path d="M0 -40 L72 0 L0 40 L-72 0Z" fill="#18A557" opacity=".22"/>
        <g stroke="#16181d" stroke-width="2">
          <path d="M-110 0 L-82 -16 L-72 -10 L-100 6Z" fill="#8A4B2A"/>
          <path d="M-82 -16 L-55 -31 L-45 -25 L-72 -10Z" fill="#9FD8F5"/>
          <path d="M-55 -31 L-27 -47 L-17 -41 L-45 -25Z" fill="#E0479E"/>
          <path d="M-27 -47 L0 -62 L10 -56 L-17 -41Z" fill="#F7941D"/>
          <path d="M0 -62 L28 -46 L18 -40 L-10 -56Z" fill="#E3262F"/>
          <path d="M28 -46 L55 -31 L45 -25 L18 -40Z" fill="#FDE62F"/>
          <path d="M55 -31 L83 -15 L73 -9 L45 -25Z" fill="#18A557"/>
          <path d="M83 -15 L110 0 L100 6 L73 -9Z" fill="#1C5FB4"/>
        </g>
        <g stroke="#16181d" stroke-width="2"><path d="M-14 -8 l14 -8 l14 8 v12 l-14 8 l-14 -8z" fill="#E3262F"/><path d="M-14 -8 l14 8 l14 -8" fill="none"/><path d="M0 0 v12"/></g>
        <g stroke="#16181d" stroke-width="2"><path d="M24 6 l9 -5 l9 5 v8 l-9 5 l-9 -5z" fill="#18A557"/></g>
      </g>
    </svg>`,
  },
  {
    id: 'calcul',
    title: 'Tête de Calcul',
    tag: 'Duel de calcul mental',
    desc: 'Calcul, astuces, vrai ou faux, équations, géométrie, devinettes, suites et Compte est bon. Le plus rapide gagne… et peut saboter les autres !',
    url: 'calcul/',
    minPlayers: 1, maxPlayers: 6,
    accent: '#ff5fa2',
    settings: [
      { key: 'mode', label: 'Mode', options: [['classic', 'Classique'], ['chartier', 'The Candidate'], ['peril', 'Péril'], ['eclair', 'Éclair']], def: 'classic' },
      { key: 'theme', label: 'Questions', options: [['mix', 'Mélangé'], ['base', '4 opérations'], ['malin', 'Astuces'], ['frac', 'Fractions'], ['logique', 'Logique'], ['flash', 'Vrai/Faux'], ['algebre', 'Équations'], ['geo', 'Géométrie'], ['vite', 'Vitesse'], ['compte', 'Compte est bon']], def: 'mix' },
      { key: 'len', label: 'Longueur', options: [[10, '10 questions'], [15, '15 questions'], [20, '20 questions'], [30, '30 questions']], def: 10 },
      { key: 'diff', label: 'Difficulté', options: [['facile', 'Facile'], ['normal', 'Moyen'], ['expert', 'Difficile']], def: 'normal' },
      { key: 'bots', label: 'Bots', options: [[0, 'Aucun'], [1, '1'], [2, '2'], [3, '3']], def: 1 },
      { key: 'level', label: 'Niveau des bots', options: [['facile', 'Facile'], ['normal', 'Moyen'], ['expert', 'Difficile']], def: 'normal' },
      { key: 'sabotage', label: 'Sabotage', group: 'Règles maison', options: [[1, 'Oui'], [0, 'Non']], def: 1 },
      { key: 'finale', label: 'Dernière question quitte ou double', options: [[1, 'Oui'], [0, 'Non']], def: 1 },
    ],
    cover: `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="320" height="180" fill="#3f86d0"/>
      <rect y="120" width="320" height="60" fill="#1C5FB4"/>
      <circle cx="276" cy="34" r="20" fill="#FDE62F" stroke="#16181d" stroke-width="3"/>
      <g font-family="Bungee,Impact,sans-serif" fill="#fff8ea" opacity=".22" font-size="40"><text x="14" y="52">+</text><text x="22" y="160">÷</text><text x="282" y="150">√</text><text x="230" y="98">%</text></g>
      <g transform="translate(160 92) rotate(-4)">
        <rect x="-96" y="-58" width="192" height="116" rx="14" fill="#16181d"/>
        <rect x="-100" y="-62" width="192" height="116" rx="14" fill="#fff8ea" stroke="#16181d" stroke-width="4"/>
        <rect x="-86" y="-50" width="66" height="18" rx="9" fill="#ff5fa2" stroke="#16181d" stroke-width="3"/>
        <rect x="-86" y="-24" width="164" height="12" rx="6" fill="#f3e9d2" stroke="#16181d" stroke-width="3"/>
        <rect x="-86" y="-24" width="104" height="12" rx="6" fill="#2fbf71" stroke="#16181d" stroke-width="3"/>
        <text x="-4" y="30" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="38" fill="#16181d">47×53</text>
      </g>
      <g transform="translate(250 136) rotate(10)"><rect x="-26" y="-18" width="52" height="34" rx="8" fill="#ffc531" stroke="#16181d" stroke-width="3"/>
        <text x="0" y="8" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="16" fill="#16181d">2491</text></g>
      <g transform="translate(58 128)"><circle r="20" fill="#ff8a1f" stroke="#16181d" stroke-width="3"/><text y="7" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="18" fill="#fff">48</text></g>
    </svg>`,
  },
  {
    id: 'bastion',
    title: 'Bastion Clash',
    tag: 'RTS StarCraft · Base & Micro',
    desc: 'Récolte minéraux et gaz avec tes VCS, construis ta base librement, gère ton ravitaillement et micro-gère ton armée (A-Move, Stimpack, Mode Siège).',
    url: 'bastion/',
    minPlayers: 1, maxPlayers: 4,
    accent: '#2fbf71',
    settings: [
      { key: 'map', label: 'Champ de bataille', options: [['vallee', '🌲 Vallée Tempérée (Classique)'], ['magma', '🌋 Fissures de Magma (+Gaz & Chokepoints)'], ['glace', '❄️ Glacier Boréal (+Vitesse & Forage Rapide)']], def: 'vallee' },
      { key: 'mode', label: 'Format & Équipes', options: [
        ['ffa', 'Chacun pour soi (FFA)'],
        ['2v2_coop', '2v2 Coop : Humains ensemble vs Bots'],
        ['2v2_duel', '2v2 Duel : Humain + Bot vs Humain + Bot'],
        ['2v2_pvp', '2v2 PvP : Joueurs 1 & 2 vs Joueurs 3 & 4'],
      ], def: 'ffa' },
      { key: 'pace', label: 'Durée max', options: [['standard', 'Standard · 25 min'], ['blitz', 'Blitz · 12 min']], def: 'standard' },
      { key: 'bots', label: 'Bots', options: [[0, 'Aucun'], [1, '1'], [2, '2'], [3, '3']], def: 1 },
      { key: 'level', label: 'Niveau des bots', options: [['facile', 'Facile'], ['normal', 'Moyen'], ['expert', 'Difficile']], def: 'normal' },
    ],
    cover: `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="320" height="180" fill="#5aa846"/>
      <ellipse cx="64" cy="40" rx="52" ry="30" fill="#4e963b"/>
      <ellipse cx="260" cy="148" rx="60" ry="34" fill="#68b853"/>
      <path d="M -10 150 Q 95 120 160 90 T 330 28" fill="none" stroke="#f3e9d2" stroke-width="32" stroke-linecap="round"/>
      <path d="M -10 150 Q 95 120 160 90 T 330 28" fill="none" stroke="#16181d" stroke-width="34" stroke-linecap="round" opacity=".18"/>
      <path d="M -10 150 Q 95 120 160 90 T 330 28" fill="none" stroke="#3a3d46" stroke-width="24" stroke-linecap="round"/>
      <path d="M -10 150 Q 95 120 160 90 T 330 28" fill="none" stroke="#ffc531" stroke-width="2.5" stroke-dasharray="9 8" stroke-linecap="round"/>
      <circle cx="160" cy="90" r="30" fill="#464b56" stroke="#16181d" stroke-width="3"/>
      <circle cx="160" cy="90" r="22" fill="none" stroke="#ffc531" stroke-width="2" stroke-dasharray="6 5"/>
      <circle cx="74" cy="122" r="58" fill="rgba(255,75,43,.12)" stroke="#ff4b2b" stroke-width="2.5" stroke-dasharray="8 6"/>
      <circle cx="248" cy="56" r="58" fill="rgba(43,140,255,.12)" stroke="#2b8cff" stroke-width="2.5" stroke-dasharray="8 6"/>
      <g transform="translate(160 88)">
        <polygon points="-14,6 -6,-14 4,-10 2,10" fill="#0d9b96" stroke="#16181d" stroke-width="2.5"/>
        <polygon points="4,8 10,-12 18,-4 12,12" fill="#1fc7c1" stroke="#16181d" stroke-width="2.5"/>
        <polygon points="-4,12 0,-20 10,-12 6,12" fill="#7cf7f2" stroke="#16181d" stroke-width="2.5"/>
      </g>
      <g transform="translate(68 122)">
        <rect x="-26" y="-18" width="52" height="44" rx="8" fill="#a82913" stroke="#16181d" stroke-width="3"/>
        <rect x="-26" y="-26" width="52" height="44" rx="8" fill="#ff4b2b" stroke="#16181d" stroke-width="3"/>
        <rect x="-15" y="-17" width="30" height="26" rx="5" fill="#fff8ea" stroke="#16181d" stroke-width="2.5"/>
        <circle cx="0" cy="-4" r="7" fill="#ffc531" stroke="#16181d" stroke-width="2.5"/>
        <line x1="0" y1="-4" x2="15" y2="-11" stroke="#16181d" stroke-width="4" stroke-linecap="round"/>
      </g>
      <g transform="translate(116 94)">
        <circle cx="0" cy="4" r="14" fill="#9a9382" stroke="#16181d" stroke-width="2.5"/>
        <circle cx="0" cy="-2" r="12" fill="#f3e9d2" stroke="#16181d" stroke-width="2.5"/>
        <circle cx="0" cy="-6" r="6" fill="#7cf7f2" stroke="#16181d" stroke-width="2"/>
        <polyline points="5,-6 22,-14 30,-8 46,-16" fill="none" stroke="#7cf7f2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <g transform="translate(250 54)">
        <rect x="-24" y="-16" width="48" height="40" rx="8" fill="#165299" stroke="#16181d" stroke-width="3"/>
        <rect x="-24" y="-24" width="48" height="40" rx="8" fill="#2b8cff" stroke="#16181d" stroke-width="3"/>
        <rect x="-14" y="-16" width="28" height="24" rx="5" fill="#fff8ea" stroke="#16181d" stroke-width="2.5"/>
        <circle cx="0" cy="-4" r="6.5" fill="#ffc531" stroke="#16181d" stroke-width="2.5"/>
      </g>
      <g transform="translate(132 132) rotate(-25)">
        <rect x="-15" y="-12" width="30" height="6" rx="2" fill="#262932" stroke="#16181d" stroke-width="2"/>
        <rect x="-15" y="6" width="30" height="6" rx="2" fill="#262932" stroke="#16181d" stroke-width="2"/>
        <rect x="-12" y="-8" width="24" height="16" rx="4" fill="#ff4b2b" stroke="#16181d" stroke-width="2.5"/>
        <rect x="0" y="-3" width="18" height="6" rx="2" fill="#3a3d46" stroke="#16181d" stroke-width="2"/>
        <circle cx="-1" cy="0" r="6" fill="#fff8ea" stroke="#16181d" stroke-width="2"/>
      </g>
      <g transform="translate(202 74) rotate(155)">
        <rect x="-15" y="-12" width="30" height="6" rx="2" fill="#262932" stroke="#16181d" stroke-width="2"/>
        <rect x="-15" y="6" width="30" height="6" rx="2" fill="#262932" stroke="#16181d" stroke-width="2"/>
        <rect x="-12" y="-8" width="24" height="16" rx="4" fill="#2b8cff" stroke="#16181d" stroke-width="2.5"/>
        <rect x="0" y="-3" width="18" height="6" rx="2" fill="#3a3d46" stroke="#16181d" stroke-width="2"/>
        <circle cx="-1" cy="0" r="6" fill="#fff8ea" stroke="#16181d" stroke-width="2"/>
      </g>
      <g fill="#2e7028" stroke="#16181d" stroke-width="2.5">
        <circle cx="32" cy="46" r="14"/><circle cx="50" cy="36" r="11"/><circle cx="286" cy="142" r="15"/><circle cx="264" cy="154" r="11"/>
      </g>
    </svg>`,
  },
  {
    id: 'outbreak',
    title: 'Outbreak : Secteur Zéro',
    tag: 'Shooter Zombie Roguelite 2D',
    desc: 'Shooter twin-stick cartoon et nerveux ! Éliminez les hordes mutantes salle par salle, déverrouillez l\'arsenal et terrassez le Spécimen Zéro en coop.',
    url: 'outbreak/',
    minPlayers: 1, maxPlayers: 5,
    accent: '#f43f5e',
    settings: [
      { key: 'difficulty', label: 'Intensité épidémie', options: [['normal', 'Normale'], ['hardcore', 'Hardcore · Cauchemar'], ['arcade', 'Arcade · Action']], def: 'normal' },
      { key: 'startingWeapon', label: 'Arme de départ', options: [['pistol', '🔫 Pistolet 9mm'], ['shotgun', '💥 Spas-12 Pompe'], ['smg', '⚡ Mitraillette MP5']], def: 'pistol' },
    ],
    cover: `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="outbreakBkg" cx="50%" cy="40%" r="75%">
          <stop offset="0%" stop-color="#221215"/>
          <stop offset="50%" stop-color="#140a0c"/>
          <stop offset="100%" stop-color="#080405"/>
        </radialGradient>
        <linearGradient id="laserSight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ff3344" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#ff3344" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <!-- Bunker corridor -->
      <rect width="320" height="180" fill="url(#outbreakBkg)"/>
      <!-- Grid laboratory tiles -->
      <g stroke="#2a1418" stroke-width="1" opacity="0.6">
        <line x1="0" y1="50" x2="320" y2="50"/>
        <line x1="0" y1="90" x2="320" y2="90"/>
        <line x1="0" y1="130" x2="320" y2="130"/>
        <line x1="60" y1="0" x2="60" y2="180"/>
        <line x1="120" y1="0" x2="120" y2="180"/>
        <line x1="180" y1="0" x2="180" y2="180"/>
        <line x1="240" y1="0" x2="240" y2="180"/>
      </g>
      <!-- Blood splatters on floor -->
      <path d="M70 120 Q85 105 100 122 Q115 135 95 140 Q80 145 70 120 Z" fill="#880814" opacity="0.85"/>
      <circle cx="112" cy="115" r="3" fill="#880814"/>
      <circle cx="62" cy="135" r="2.5" fill="#880814"/>
      <path d="M230 140 Q250 130 265 145 Q260 160 240 155 Z" fill="#6d0610" opacity="0.8"/>
      <!-- Biohazard warning door / airlock in background -->
      <rect x="110" y="20" width="100" height="110" rx="6" fill="#181c22" stroke="#ff3344" stroke-width="2.5"/>
      <rect x="120" y="35" width="80" height="25" fill="#0d0f12" stroke="#2a303a" stroke-width="1.5"/>
      <circle cx="160" cy="47" r="6" fill="#ff3344"/>
      <!-- Hazard stripes -->
      <g stroke="#ffc531" stroke-width="3">
        <line x1="112" y1="24" x2="124" y2="24"/>
        <line x1="130" y1="24" x2="142" y2="24"/>
        <line x1="148" y1="24" x2="160" y2="24"/>
        <line x1="166" y1="24" x2="178" y2="24"/>
        <line x1="184" y1="24" x2="196" y2="24"/>
        <line x1="202" y1="24" x2="208" y2="24"/>
      </g>
      <!-- Swarming mutant zombie silhouettes -->
      <g fill="#0e0708" stroke="#ff3344" stroke-width="0.5">
        <!-- Zombie 1 (left charging) -->
        <circle cx="45" cy="85" r="11"/>
        <path d="M38 96 L45 135 L35 170 M45 135 L55 170 M38 105 L20 85 M48 105 L65 92" stroke="#0e0708" stroke-width="6" stroke-linecap="round"/>
        <circle cx="48" cy="84" r="2.5" fill="#ff3344"/>
        <circle cx="42" cy="85" r="2.5" fill="#ff3344"/>
        <!-- Zombie 2 (center crawler) -->
        <circle cx="130" cy="120" r="10"/>
        <path d="M125 125 L105 138 M135 125 L150 135" stroke="#0e0708" stroke-width="5" stroke-linecap="round"/>
        <circle cx="132" cy="119" r="2" fill="#2de8bd"/>
        <!-- Zombie 3 (right titan) -->
        <circle cx="275" cy="70" r="16"/>
        <path d="M265 85 L275 135 L260 175 M275 135 L290 175 M265 95 L245 78 M285 95 L305 82" stroke="#0e0708" stroke-width="9" stroke-linecap="round"/>
        <circle cx="270" cy="68" r="3" fill="#ff3344"/>
      </g>
      <!-- SWAT Survivor aiming shotgun/rifle with muzzle flash -->
      <g transform="translate(160, 125)">
        <circle cx="-15" cy="-25" r="12" fill="#2d3748" stroke="#16181d" stroke-width="2"/>
        <!-- Helmet and visor -->
        <rect x="-18" y="-28" width="16" height="6" rx="2" fill="#1fc7c1"/>
        <!-- Torso & tactical vest -->
        <rect x="-24" y="-12" width="22" height="26" rx="4" fill="#1a202c" stroke="#16181d" stroke-width="2"/>
        <!-- Shotgun / Rifle -->
        <rect x="-10" y="-8" width="46" height="7" rx="2" fill="#4a5568" stroke="#16181d" stroke-width="1.5"/>
        <rect x="18" y="-7" width="18" height="4" fill="#2d3748"/>
        <!-- Muzzle flash explosion -->
        <polygon points="38,-5 58,-12 50,-5 62,-3 48,0 58,6 38,2" fill="#ffdc73"/>
        <circle cx="42" cy="-2" r="5" fill="#ff8524"/>
        <circle cx="40" cy="-2" r="2.5" fill="#ffffff"/>
      </g>
      <!-- Laser aim beam slicing the dark -->
      <line x1="195" y1="120" x2="45" y2="85" stroke="#ff3344" stroke-width="1.8" opacity="0.85" stroke-dasharray="4 2"/>
    </svg>`,
  },
  {
    id: 'kart',
    title: 'Kart Rush GP',
    tag: 'Course de karts en 3D',
    desc: 'Kart en 3D façon Mario Kart : 3 circuits (Grand Circuit, Whisky Peak, Route Arc-en-ciel), drift et mini-turbo, 16 objets, 8 pilotes et IA. Circuit et pilotes se choisissent dans le jeu.',
    url: 'kart/',
    minPlayers: 1, maxPlayers: 6,
    accent: '#ff4fd8',
    cover: `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="kartSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140a3a"/><stop offset="1" stop-color="#3a1470"/></linearGradient>
        <linearGradient id="kartRoad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#ff3b5c"/><stop offset=".17" stop-color="#ff9a2e"/><stop offset=".34" stop-color="#ffe23d"/>
          <stop offset=".5" stop-color="#3ee07a"/><stop offset=".67" stop-color="#2fb8ff"/><stop offset=".84" stop-color="#5b6bff"/><stop offset="1" stop-color="#c25bff"/>
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#kartSky)"/>
      <g fill="#fff"><circle cx="30" cy="22" r="1.6"/><circle cx="74" cy="48" r="1.2"/><circle cx="122" cy="16" r="1.8"/><circle cx="170" cy="40" r="1.1"/><circle cx="214" cy="12" r="1.5"/><circle cx="58" cy="78" r="1"/><circle cx="196" cy="70" r="1.3"/><circle cx="12" cy="56" r="1.2"/></g>
      <circle cx="270" cy="40" r="26" fill="#2f7be0" stroke="#16181d" stroke-width="3"/>
      <path d="M252 34c8-6 14 2 22-2s10 6 14 2M256 50c6 4 14-2 20 2" fill="none" stroke="#3ee07a" stroke-width="5" stroke-linecap="round"/>
      <path d="M150 180 C 170 120, 240 110, 330 92 L 330 132 C 250 140, 214 150, 214 180 Z" fill="url(#kartRoad)" stroke="#16181d" stroke-width="3"/>
      <path d="M-10 180 L 40 110 L 70 128 L 110 72 L 150 118 L 180 180 Z" fill="#e9f2fb" stroke="#16181d" stroke-width="3"/>
      <path d="M110 72 L 124 92 L 112 88 L 100 100 L 96 92 Z" fill="#b8cde6"/>
      <g transform="translate(210 112) rotate(-8)" stroke="#16181d" stroke-width="3">
        <rect x="-34" y="-6" width="68" height="22" rx="9" fill="#e53935"/>
        <rect x="-38" y="-14" width="22" height="7" rx="3" fill="#e53935"/>
        <circle cx="-22" cy="20" r="11" fill="#22252d"/><circle cx="24" cy="20" r="11" fill="#22252d"/>
        <circle cx="2" cy="-18" r="13" fill="#f2f2f2"/>
        <path d="M-11-22 a13 13 0 0 1 26 0 z" fill="#e53935"/>
        <ellipse cx="-3" cy="-17" rx="2.6" ry="3.4" fill="#16181d" stroke="none"/><ellipse cx="7" cy="-17" rx="2.6" ry="3.4" fill="#16181d" stroke="none"/>
      </g>
      <path d="M150 128 l-28 -4 M150 140 l-36 2 M156 116 l-22 -10" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
      <g stroke="#16181d" stroke-width="3"><path d="M44 30 l6 12 13 2 -10 9 3 13 -12 -7 -12 7 3 -13 -10 -9 13 -2 z" fill="#ffd53d"/></g>
    </svg>`,
  },
];


