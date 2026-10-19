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
    desc: 'De Saint-Roch à la Promenade des Anglais : achète, construis, négocie. Classique ou Express (40 min).',
    url: 'david/',
    minPlayers: 1, maxPlayers: 6,
    accent: '#1C5FB4',
    settings: [
      { key: 'mode', label: 'Mode', options: [['classic', 'Classique'], ['express', 'Express · 40 min']], def: 'classic' },
      { key: 'bots', label: 'Bots', options: [[0, 'Aucun'], [1, '1'], [2, '2'], [3, '3']], def: 1 },
      { key: 'level', label: 'Niveau des bots', options: [['facile', 'Facile'], ['normal', 'Normal'], ['expert', 'Expert']], def: 'normal' },
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
    id: 'bastion',
    title: 'Bastion Clash',
    tag: 'RTS StarCraft · Base & Micro',
    desc: 'Récolte minéraux et gaz avec tes VCS, construis ta base librement, gère ton ravitaillement et micro-gère ton armée (A-Move, Stimpack, Mode Siège).',
    url: 'bastion/',
    minPlayers: 1, maxPlayers: 4,
    accent: '#2fbf71',
    settings: [
      { key: 'mode', label: 'Format', options: [['ffa', 'Chacun pour soi'], ['2v2', 'Équipes 2v2']], def: 'ffa' },
      { key: 'pace', label: 'Durée max', options: [['standard', 'Standard · 25 min'], ['blitz', 'Blitz · 12 min']], def: 'standard' },
      { key: 'bots', label: 'Bots', options: [[0, 'Aucun'], [1, '1'], [2, '2'], [3, '3']], def: 1 },
      { key: 'level', label: 'Niveau des bots', options: [['facile', 'Facile'], ['normal', 'Normal'], ['expert', 'Expert']], def: 'normal' },
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
];
