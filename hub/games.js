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
];
