// Scénario d'Outbreak : messages radio, dossiers à trouver, textes des cinématiques.
// Contexte : 2026, sous la technopole de Sophia-Antipolis, le Laboratoire Alpha travaillait sur la souche VIREO.
// Une fuite a contaminé la Côte. L'Escouade Delta doit remonter jusqu'au Spécimen Zéro pour que le Dr Lenoir
// puisse synthétiser un antidote, puis être extraite par l'hélico du Commandant Moreau.

export const SPEAKERS = {
  moreau: { name: 'Cdt Moreau', icon: '🎖️', color: '#ffc531' },
  lenoir: { name: 'Dr Lenoir', icon: '🧪', color: '#1fc7c1' },
  dede: { name: 'Dédé', icon: '🛒', color: '#ff8a1f' },
  pilote: { name: 'Pilote Sacha', icon: '🚁', color: '#2b8cff' },
  inconnu: { name: '???', icon: '📻', color: '#ff4b2b' },
};

// Mission annoncée dans la cinématique d'intro
export const MISSIONS = {
  lab: 'Descendez au cœur du Laboratoire Alpha et neutralisez la source.',
  sewers: 'Suivez les égouts jusqu\'au collecteur principal : la souche s\'y est nichée.',
  hospital: 'Traversez l\'Hôpital Pasteur jusqu\'au bloc opératoire. Le patient zéro y a été transféré.',
  metro: 'Remontez la ligne du tram souterrain jusqu\'au terminus. Attention aux rames automatiques.',
  nice: 'De la place Masséna à la Promenade : nettoyez la route jusqu\'au point d\'extraction.',
  survival: 'Tenez le hangar de quarantaine aussi longtemps que possible. Aucun renfort prévu.',
  defense: 'Protégez le générateur du fort Delta pendant 15 vagues : sans lui, plus de radio, plus d\'extraction.',
};

// Radio par secteur : clé = numéro de salle (campagne)
const ROUTE = {
  lab: {
    1: [['moreau', 'Escouade Delta, ici Moreau. Le labo est en confinement total. Vous êtes nos seuls yeux là-dedans.'], ['lenoir', 'Les bouches d\'aération sont reliées à tout le complexe. Restez groupés.']],
    2: [['lenoir', 'Les relevés montent. La souche VIREO réagit à votre présence… elle apprend vite.']],
    3: [['moreau', 'Vous avez fait la moitié du chemin. Ne gaspillez pas vos munitions.']],
    5: [['lenoir', 'J\'ai retrouvé les journaux du projet. Le Spécimen Zéro n\'était pas un accident.']],
    6: [['moreau', 'Le Noyau est juste derrière. Faites le plein, c\'est maintenant ou jamais.']],
  },
  sewers: {
    1: [['moreau', 'Delta, vous êtes sous le Paillon. L\'eau vous ralentira : ne vous faites pas coincer dans les canaux.'], ['lenoir', 'Les larves prolifèrent dans l\'humidité. Brûlez tout ce qui grouille.']],
    2: [['lenoir', 'Ces galeries remontent jusqu\'au collecteur. C\'est là que la souche a été rejetée.']],
    3: [['moreau', 'Les ponts sont vos meilleurs alliés. Tenez-les.']],
    5: [['lenoir', 'L\'odeur… vous êtes tout près du nid. Tout ce qui pousse ici vient de la même mère.']],
    6: [['moreau', 'Le collecteur principal, Delta. Fin du trajet.']],
  },
  hospital: {
    1: [['moreau', 'Hôpital Pasteur. Les premiers patients sont arrivés ici il y a trois jours. Plus personne n\'en est sorti.'], ['lenoir', 'Les néons sautent : profitez des lampes torches, et méfiez-vous des hurleuses.']],
    2: [['lenoir', 'Les dossiers médicaux parlent d\'un « patient zéro » transféré au bloc. Il faut le trouver.']],
    3: [['moreau', 'On a perdu le contact avec l\'équipe médicale du 3e. Ne comptez pas sur eux.']],
    5: [['lenoir', 'Les traqueurs étaient des infirmiers. Ils connaissent ces couloirs mieux que vous.']],
    6: [['moreau', 'Le bloc opératoire. Ce qui vous attend derrière n\'est plus un patient.']],
  },
  metro: {
    1: [['moreau', 'Station Garibaldi. Les rames tournent encore en pilote automatique : ne traînez jamais sur les voies.'], ['pilote', 'Je vous attends au terminus avec l\'hélico. Ne me faites pas attendre.']],
    2: [['lenoir', 'Les blindés portaient l\'uniforme de la sécurité. Prenez-les de côté.']],
    3: [['moreau', 'Quand la rame klaxonne, attirez-les sur les voies. Laissez le train faire le travail.']],
    5: [['pilote', 'Je vois de la fumée au terminus. Il y a quelque chose d\'énorme là-dedans.']],
    6: [['moreau', 'Terminus. Dernier arrêt, Delta.']],
  },
  nice: {
    1: [['moreau', 'Place Masséna, Delta. La ville est tombée en une nuit. Ne tirez pas dans les voitures : les alarmes les attirent.'], ['lenoir', 'Ils sont rapides en surface. Restez près des murs.']],
    2: [['moreau', 'Le cours Saleya est infesté. Tenez bon.']],
    3: [['lenoir', 'Une odeur de socca… quelqu\'un fait encore des affaires dans ce chaos.']],
    5: [['pilote', 'Je survole la Baie des Anges. La Promenade grouille, je ne peux pas me poser tant que ce n\'est pas nettoyé.']],
    6: [['moreau', 'La Promenade des Anglais. Le point d\'extraction est au bout. Ouvrez-nous la route.']],
  },
};

const BOSS_LINES = {
  boss: [['lenoir', 'Le Spécimen Zéro. Le premier hôte… tout est parti de lui. Visez le cœur lumineux !']],
  colossus: [['lenoir', 'Le Colosse ! Sa carapace arrête les balles de face. Contournez-le, son point faible est dans le dos !']],
  queen: [['lenoir', 'La Reine… c\'est elle qui pond toute la nuée. Si elle disparaît, surveillez les bouches d\'aération !']],
  abomination: [['moreau', 'Contact massif ! Une abomination, Delta. Esquivez ses rochers et ses charges.']],
  mother: [['lenoir', 'La Mère des Cracheurs ! Tuez-la avant que les larves ne vous submergent.']],
};

const ROOM_LINES = {
  shop: [['dede', 'Bienvenue chez Dédé ! Je prends la ferraille, pas les excuses. Servez-vous, mais dépêchez-vous.'], ['dede', 'Ah, Delta ! J\'ai gardé des petites merveilles pour vous. La ferraille d\'abord.'], ['dede', 'Encore vivants ? Ça mérite une remise… non, je rigole. Ferraille sur le comptoir.']],
  vault: [['moreau', 'Un coffre-fort de la direction. Si vous le forcez, l\'alarme va réveiller tout le secteur. À vous de voir.']],
  dark: [['lenoir', 'Le courant est coupé dans cette section. Restez dans la lumière des lampes torches, les traqueurs adorent le noir.']],
  gas: [['lenoir', 'Fuite de gaz toxique ! Les nuages dérivent : contournez-les, ne restez pas dedans.']],
};

const EVENT_LINES = {
  blackout: [['moreau', 'Le générateur a lâché ! Ça va revenir, tenez le coup !']],
  horde: [['pilote', 'Je vois une horde qui fonce droit sur vous ! Préparez-vous !']],
  drop: [['pilote', 'Largage en approche ! Restez près de la caisse pour la sécuriser.']],
  carAlarm: [['moreau', 'Qui a tiré dans cette voiture ?!']],
  train: [['pilote', 'Rame en approche, dégagez les voies !']],
};

const SURVIVAL_LINES = {
  1: [['moreau', 'Hangar de quarantaine. Personne ne viendra vous chercher. Tenez.']],
  5: [['lenoir', 'Cinq vagues… ils envoient leurs plus gros spécimens maintenant.']],
  10: [['moreau', 'Dix vagues, Delta. Vous êtes en train d\'écrire l\'histoire.']],
  15: [['pilote', 'Je n\'ai jamais vu autant de zombies au même endroit.']],
  20: [['moreau', 'Vingt vagues. Je ne sais pas comment vous faites encore.']],
};

// Ligne(s) radio pour un évènement de la simulation, ou null. seed rend le choix stable entre les joueurs.
export function radioFor(ev, ctx) {
  const { sector = 'lab', mode = 'campaign', seed = 0 } = ctx || {};
  const pick = (arr) => (arr && arr.length ? [arr[Math.abs(seed) % arr.length]] : null);
  if (ev.e === 'room') {
    if (mode === 'defense') return [['moreau', 'Fort Delta. Le générateur alimente la radio et la balise d\'extraction : il ne doit pas tomber.'], ['lenoir', 'Entre les vagues, réparez les barricades et posez des pièges avec la ferraille.']];
    if (mode === 'survival') return SURVIVAL_LINES[1];
    if (ROOM_LINES[ev.ty]) return pick(ROOM_LINES[ev.ty]);
    if (ev.ty === 'core') return null; // la ligne arrive avec le boss
    return (ROUTE[sector] || ROUTE.lab)[ev.i] || null;
  }
  if (ev.e === 'boss') return BOSS_LINES[ev.k] || null;
  if (ev.e === 'wave' && mode === 'survival') return SURVIVAL_LINES[ev.n] || null;
  if (ev.e === 'barBreak' && seed % 2 === 0) return [['moreau', 'Une barricade a cédé ! Bouchez cette brèche !']];
  if (ev.e === 'wave' && mode === 'defense' && ev.n === 15) return [['moreau', 'Dernière vague, Delta. Tout ce qu\'il reste de la horde arrive.']];
  if (ev.e === 'blackout') return EVENT_LINES.blackout;
  if (ev.e === 'horde') return EVENT_LINES.horde;
  if (ev.e === 'dropIn') return EVENT_LINES.drop;
  if (ev.e === 'carAlarm') return EVENT_LINES.carAlarm;
  if (ev.e === 'trainWarn' && seed % 4 === 0) return EVENT_LINES.train;
  return null;
}

// ------------------------------------------------------------------ dossiers à trouver (4 par secteur)
export const NOTES = {
  lab: [
    ['Rapport VIREO-01', 'Souche VIREO : régénération cellulaire ×40. Effet secondaire observé chez le rat n° 7 : agressivité extrême. Recommandation : arrêt du protocole. — Refusée par la direction.'],
    ['Mémo interne', 'Le sujet « Zéro » est volontaire. Ancien militaire, en phase terminale. Il a signé. Personne ne doit savoir qu\'il a demandé à arrêter au troisième jour.'],
    ['Journal de garde', 'Jour 4 : il ne dort plus. Il parle aux bouches d\'aération. Elles répondent.'],
    ['Dernier message du Dr Vasseur', 'Si vous lisez ceci, il est déjà trop tard pour le confinement. L\'antidote est dans son sang. Ramenez un échantillon à Lenoir.'],
  ],
  sewers: [
    ['Bon de rejet n° 4471', 'Évacuation de 300 L d\'effluents « inertes » vers le collecteur Paillon. Signé : service technique du Labo Alpha.'],
    ['Carnet d\'un égoutier', 'Les rats ont disparu cette semaine. À la place, il y a ces choses pâles qui se tortillent dans l\'eau.'],
    ['Note scotchée sur une vanne', 'NE PAS OUVRIR. Elle est dans le collecteur. Elle pond.'],
    ['Relevé d\'analyse', 'Toutes les larves partagent le même ADN. Une seule mère. Si on la tue, la nuée meurt avec elle ?'],
  ],
  hospital: [
    ['Dossier d\'admission', 'Patient : inconnu (« Zéro »). Transféré du Labo Alpha à 03 h 12. Fièvre à 43 °C. Ne répond qu\'aux sons aigus.'],
    ['Planning des infirmiers', 'Équipe de nuit : absente. Équipe de jour : absente. Qui pousse les brancards dans le couloir B ?'],
    ['Ordonnance griffonnée', 'Sédatifs ×10 : aucun effet. Il a arraché les sangles. Fermez le bloc de l\'extérieur.'],
    ['Message vocal transcrit', '« Ici l\'interne de garde. Les hurleuses appellent les autres. Si vous en voyez une, tuez-la en premier. »'],
  ],
  metro: [
    ['Rapport d\'incident ligne 1', 'La rame 12 a continué sa route avec 40 passagers infectés. Pilotage automatique impossible à couper.'],
    ['Affichette de la sécurité', 'Agents équipés de boucliers anti-émeute : repli vers le terminus. Ordre de ne pas revenir.'],
    ['Ticket griffonné', 'Le train les écrase et ils reviennent quand même. Mais lui, au terminus, aucun train ne l\'a arrêté.'],
    ['Journal du chef de station', 'Il fait deux mètres cinquante. La balle ricoche sur sa carapace. On a vu une lueur dans son dos.'],
  ],
  nice: [
    ['Flash spécial Nice-Matin', 'Confinement de toute la Côte d\'Azur. Les habitants sont priés de rester chez eux et de ne pas ouvrir à leurs voisins.'],
    ['Menu du jour (kiosque)', 'Socca : 3 €. Pan bagnat : 6 €. Fermeture exceptionnelle pour cause de fin du monde.'],
    ['SMS sur un téléphone', '« Maman, ne prends pas la Promenade. Ils courent vite. Je t\'aime. »'],
    ['Plan d\'évacuation', 'Point d\'extraction hélico : bout de la Promenade des Anglais, face à l\'aéroport. Dernier vol à l\'aube.'],
  ],
};

// Clé de dossier stable : secteur + numéro
export const noteKey = (sector, i) => `${sector}:${i}`;
export const TOTAL_NOTES = Object.values(NOTES).reduce((n, a) => n + a.length, 0);

// ------------------------------------------------------------------ fins
export const ENDINGS = {
  won: (sector) => ({
    title: 'EXTRACTION RÉUSSIE',
    lines: [
      ['pilote', 'Je vous vois ! Montez, montez !'],
      ['lenoir', 'L\'échantillon est intact. Avec ça, je peux fabriquer l\'antidote. Vous avez sauvé la Côte, Delta.'],
      ['moreau', sector === 'nice' ? 'Le soleil se lève sur la Baie des Anges. Beau travail, Escouade Delta.' : 'Beau travail, Escouade Delta. Rentrez à la maison.'],
    ],
  }),
  over: () => ({
    title: 'FIN DE TRANSMISSION',
    lines: [['moreau', 'Delta, répondez… Delta ?'], ['inconnu', '…']],
  }),
};
