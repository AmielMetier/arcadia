// odyssee/js/core/questsData.js — Moteur et registre complet des quêtes d'Odyssée :
// - Quêtes principales (La Ligue Céleste, L'Ombre de l'Éclipse & Lugia Obscur)
// - Grandes aventures secondaires (Ponyta de Lucie, Lac Miroir, Courrier perdu, etc.)
// - Missions et requêtes des habitants (Médaillon, Spécimen Magicarpe, Géologue, etc.)
// - Système de suivi d'objectif actif ("en suivre une") avec calcul précis du "Où aller"

import { BADGES, LEADERS } from '../world/region.js';

export const QUEST_CATEGORIES = {
  main: { id: 'main', label: 'Histoire Principale', badge: 'PRINCIPALE', color: '#f8d030' },
  side: { id: 'side', label: 'Aventures & Mystères', badge: 'AVENTURE', color: '#00f0ff' },
  npc:  { id: 'npc',  label: 'Missions des Habitants', badge: 'HABITANTS', color: '#78c850' },
};

/**
 * Informations enrichies pour chaque quête du jeu
 */
const QUEST_METADATA = {
  // --- 1. HISTOIRE PRINCIPALE ---
  ligue: {
    id: 'ligue',
    cat: 'main',
    name: 'La Ligue Céleste',
    giver: 'Professeur Saule',
    icon: 'trophy',
    desc: 'Le voyage initiatique à travers la région d\'Odyssée : conquérir les 8 Badges d\'Arène et défier la Ligue Céleste.',
    reward: 'Titre de Maître de la Ligue & Badge Céleste',
  },
  eclipse: {
    id: 'eclipse',
    cat: 'main',
    name: 'L\'Ombre de la Team Éclipse',
    giver: 'Voyante de Mirage',
    icon: 'dark-gem',
    desc: 'La Team Éclipse vole l\'énergie de la région pour refermer le cœur de Lugia et plonger le monde dans une nuit éternelle.',
    reward: 'Apaisement de Lugia Obscur & Rétablissement du jour',
  },

  // --- 2. GRANDES AVENTURES SECONDAIRES (world/quetes.js) ---
  ponyta: {
    id: 'ponyta',
    cat: 'side',
    name: 'Le Ponyta de Lucie',
    giver: 'Lucie (Sylvebourg)',
    icon: 'heart',
    reward: 'Accès au Bois Murmure & Insigne de la Brume',
    dests: [
      { where: 'Sylvebourg', hint: 'Interroge les 3 villageois : le boulanger, l\'enfant et la grand-mère.' },
      { where: 'Bois Murmure (Sud)', hint: 'Poursuis le voleur en noir dans le sentier boisé au sud.' },
      { where: 'Clairière de la Brume', hint: 'Trouve le passage secret à l\'est du Bois Murmure et libère Ponyta de sa cage.' },
      { where: 'Sylvebourg', hint: 'Rends visite à Lucie dans sa maison pour lui ramener son Ponyta.' },
    ],
  },
  lac: {
    id: 'lac',
    cat: 'side',
    name: 'Les eaux troubles du Lac Miroir',
    giver: 'Gaston (Rive-Claire)',
    icon: 'water',
    reward: 'Lokhlass offert par Gaston & Mesprit apaisé',
    dests: [
      { where: 'Lac Miroir (Rive-Claire)', hint: 'Désactive les 3 pompes polluantes installées autour du lac.' },
      { where: 'Rive Nord du Lac', hint: 'Affronte l\'Admin Sylas qui supervise les opérations de la Brume.' },
      { where: 'Grotte des Marées (Surf)', hint: 'Traverse le lac en surfant jusqu\'à la caverne centrale.' },
      { where: 'Fond de la Grotte', hint: 'Explore les tréfonds de la grotte et rencontre le légendaire Mesprit.' },
      { where: 'Rive-Claire', hint: 'Retourne raconter tes exploits à Gaston dans sa cabane.' },
    ],
  },
  courrier: {
    id: 'courrier',
    cat: 'side',
    name: 'Le courrier perdu',
    giver: 'Facteur de Port-Azur',
    icon: 'air-mail',
    reward: 'Boîte aux lettres & Récompenses de gratitude',
    dests: [
      { where: 'Région d\'Odyssée', hint: 'Remets les 4 lettres : Lucie à Sylvebourg, Gaston à Rive-Claire, le Jardinier du Jardin des Songes et le Grand Prêtre de Kagura.' },
      { where: 'Port-Azur (Quais)', hint: 'Reviens voir le facteur près des bateaux pour lui rendre sa sacoche.' },
    ],
  },
  songes: {
    id: 'songes',
    cat: 'side',
    name: 'Les nuits blanches de Floralia',
    giver: 'Hélène (Floralia)',
    icon: 'lunar-wing',
    reward: 'Sommeil paisible des enfants & Rencontre de Darkrai',
    dests: [
      { where: 'Jardin des Songes (Route 6)', hint: 'Consulte le jardinier au sud de la Route 6 sur l\'origine des cauchemars.' },
      { where: 'Îlot du Lac Miroir', hint: 'Surfe jusqu\'à l\'îlot secret et obtiens la Plume Lune auprès de Cresselia.' },
      { where: 'Floralia', hint: 'Apporte la Plume Lune à Hélène pour apaiser les enfants tourmentés.' },
      { where: 'Jardin des Songes (Nuit)', hint: 'Surveille le Jardin des Songes en pleine nuit (entre 20h et 5h du matin).' },
      { where: 'Forêt des Torii (Route 7)', hint: 'Poursuis Ariane jusqu\'au Temple Kagura au bout de la Forêt des Torii.' },
      { where: 'Sanctuaire de Kagura', hint: 'Affronte le spectre cauchemardesque Darkrai dans le sanctuaire interdit.' },
      { where: 'Floralia', hint: 'Retourne rassurer Hélène : les cauchemars ont pris fin.' },
    ],
  },
  kagura: {
    id: 'kagura',
    cat: 'side',
    name: 'Les talismans du Temple Kagura',
    giver: 'Sakura (Mirage)',
    icon: 'spell-tag',
    reward: 'Éveil de la cloche sacrée & Rencontre d\'Uxie (Créhelf)',
    dests: [
      { where: 'Forêt des Torii (Route 7)', hint: 'Retrouve les 3 talismans dérobés et vaincs les sbires de la Brume.' },
      { where: 'Sommet du Temple Kagura', hint: 'Remets les talismans au Grand Prêtre au dernier étage de la tour.' },
      { where: 'Cour est du Temple', hint: 'Fais sonner la grande Cloche sacrée pour réveiller la bénédiction d\'Uxie.' },
    ],
  },
  voeu: {
    id: 'voeu',
    cat: 'side',
    name: 'Le vœu de la fontaine',
    giver: 'Fontaine aux Étoiles',
    icon: 'star-piece',
    reward: 'Rencontre du Pokémon Vœu Jirachi',
    dests: [
      { where: 'Jardin des Songes', hint: 'Découvre 7 éclats d\'étoile cachés dans les zones secrètes et jette-les dans l\'eau.' },
      { where: 'Banc du Jardin des Songes', hint: 'Le Pokémon étoile Jirachi s\'est posé sur le banc du jardin, va lui parler !' },
    ],
  },
  fossile: {
    id: 'fossile',
    cat: 'side',
    name: 'Le dragon de pierre',
    giver: 'Savant du Musée des Dragons',
    icon: 'old-amber',
    reward: 'Ptéra antique réanimé',
    dests: [
      { where: 'Grotte des Marées (Lac Miroir)', hint: 'Cherche dans les recoins inondés de la caverne pour dénicher un Vieil Ambre.' },
      { where: 'Musée des Dragons (Fort-Écaille)', hint: 'Confie le Vieil Ambre au scientifique pour redonner vie à l\'ancien souverain des cieux.' },
    ],
  },
  magma: {
    id: 'magma',
    cat: 'side',
    name: 'Le cœur du volcan',
    giver: 'L\'Ancien de Fumerolle',
    icon: 'red-orb',
    reward: 'Dissolution de la Brume & Master Ball suprême',
    dests: [
      { where: 'Base de la Brume (Fumerolle)', hint: 'Infiltre le quartier général secret de la Brume au nord du village volcanique.' },
      { where: 'Caverne du Magma', hint: 'Poursuis le Chef Nox dans les profondeurs ardentes de la caverne.' },
      { where: 'Cœur du Magma', hint: 'Groudon s\'est réveillé dans la lave ! Affronte le Titan des Terres.' },
      { where: 'Fumerolle', hint: 'Rejoins l\'Ancien du village pour sceller l\'Orbe Rouge et recevoir la Master Ball.' },
    ],
  },

  // --- 3. REQUÊTES DES HABITANTS (world/story.js) ---
  qMedaillon: {
    id: 'qMedaillon',
    cat: 'npc',
    name: 'Le médaillon de Lucie',
    giver: 'Lucie (Sylvebourg)',
    icon: 'gift',
    reward: '1 Super Bonbon & 3 Super Potions',
    where: 'Bois Murmure (Route 2)',
    desc: 'Lucie a égaré le médaillon précieux de sa grand-mère derrière un arbuste touffu.',
    dest: 'Bois Murmure — Utiliser la CS01 Coupe pour trancher l\'arbuste et récupérer le médaillon.',
  },
  qMagicarpe: {
    id: 'qMagicarpe',
    cat: 'npc',
    name: 'Le spécimen du pêcheur',
    giver: 'Pêcheur (Port-Azur)',
    icon: 'water',
    reward: '2 Super Bonbons',
    where: 'Port-Azur (Ponton)',
    desc: 'Le vieux pêcheur du ponton souhaite admirer un beau Magicarpe aux écailles luisantes.',
    dest: 'Port-Azur — Capturer un Magicarpe (en surfant ou pêchant) et le lui présenter.',
  },
  qRoche: {
    id: 'qRoche',
    cat: 'npc',
    name: 'L\'observation géologique',
    giver: 'Géologue (Bourg-Granit)',
    icon: 'rock',
    reward: '4 Super Balls',
    where: 'Bourg-Granit',
    desc: 'Un passionné de minéraux veut examiner la carapace protectrice d\'un Pokémon de type Roche.',
    dest: 'Grotte Lunaire — Attraper un Pokémon Roche (comme Racaillou) et le montrer au géologue.',
  },
  qEchange: {
    id: 'qEchange',
    cat: 'npc',
    name: 'L\'échange de Bastien',
    giver: 'Bastien (Voltacité)',
    icon: 'team',
    reward: 'Magnéti "Boulon" de niveau 18',
    where: 'Voltacité (Maison)',
    desc: 'Bastien cherche un Roucool et offre en échange son fidèle Magnéti.',
    dest: 'Voltacité — Capturer un Roucool sur les premières routes et procéder à l\'échange.',
  },
  giftEvoli: {
    id: 'giftEvoli',
    cat: 'npc',
    name: 'L\'adoption d\'Évoli',
    giver: 'Éleveuse (Floralia)',
    icon: 'heart',
    reward: 'Évoli de niveau 20',
    where: 'Floralia (Grande maison)',
    desc: 'Une éleveuse attentionnée cherche un dresseur aimant pour adopter un bébé Évoli.',
    dest: 'Floralia — Visiter la grande demeure bourgeoise et accepter de prendre soin d\'Évoli.',
  },
  dexpert: {
    id: 'dexpert',
    cat: 'npc',
    name: 'Les recherches du Chercheur',
    giver: 'Savant Pokédex (Mirage)',
    icon: 'dex',
    reward: '5 Hyper Balls, 3 Super Bonbons & 1 Master Ball',
    where: 'Mirage',
    desc: 'Un chercheur récompense les dresseurs qui enrichissent leur Pokédex aux paliers 25, 50 et 80 espèces capturées.',
    dest: 'Région d\'Odyssée — Capturer de nouvelles espèces et lui rendre visite à Mirage.',
  },
  qNiveau: {
    id: 'qNiveau',
    cat: 'npc',
    name: 'L\'épreuve des Sources',
    giver: 'Vétéran (Cendrelune)',
    icon: 'fire',
    reward: '2 Guérisons',
    where: 'Cendrelune (Sources chaudes)',
    desc: 'L\'accès aux sources chaudes nécessite d\'avoir entraîné un Pokémon valeureux de niveau 40 ou plus.',
    dest: 'Cendrelune — Présenter une créature de niveau 40+ au vétéran qui garde le bassin.',
  },
  giftMinidraco: {
    id: 'giftMinidraco',
    cat: 'npc',
    name: 'L\'héritage du clan des Dragons',
    giver: 'Ancien du clan (Cimelune)',
    icon: 'dragon',
    reward: 'Minidraco de niveau 30',
    where: 'Cimelune',
    desc: 'L\'Ancien transmet l\'héritage draconique aux seuls dresseurs ayant conquis le Badge Écaille.',
    dest: 'Cimelune — Vaincre le Champion Drakos puis aller parler à l\'Ancien dans sa hutte.',
  },
};

/**
 * Calcule l'état en temps réel de la Quête Principale de la Ligue
 */
function resolveLigueQuest(game) {
  const st = game.state;
  const badges = st.badges || [];
  const bCount = badges.filter(Boolean).length;

  const stepsDef = [
    { name: 'Choisir son premier Pokémon', where: 'Bourg-Aube (Labo Saule)', hint: 'Rends-toi au laboratoire du Professeur Saule au sud-est pour choisir ton partenaire.' },
    { name: 'Vaincre Hector (Badge Roche/Insecte)', where: 'Bourg-Granit (Route 1)', hint: 'Traverse la Route 1 vers le nord et bats Hector dans l\'Arène de Bourg-Granit.' },
    { name: 'Vaincre Marine (Badge Eau)', where: 'Rive-Claire (Route 2)', hint: 'Franchis la Route 2 et la Grotte Lunaire vers l\'est pour défier Marine à Rive-Claire.' },
    { name: 'Vaincre Volta (Badge Volt)', where: 'Voltacité (Route 4)', hint: 'Chasse la Team Éclipse de la Centrale électrique au nord, puis bats Volta dans son Arène.' },
    { name: 'Vaincre Flora (Badge Pétale)', where: 'Floralia (Route 5)', hint: 'Suis la Route 5 vers l\'est jusqu\'à Floralia pour triompher de l\'Arène de Flora.' },
    { name: 'Vaincre Sibylle (Badge Mirage)', where: 'Mirage (Route 6)', hint: 'Traverse le Repaire de l\'Éclipse sur la Route 6 et rejoins Sibylle à l\'Arène de Mirage.' },
    { name: 'Vaincre Basalte (Badge Rocaille)', where: 'Fort-Écaille (Route 7)', hint: 'Prends la Route 7 vers le sud-est jusqu\'à Fort-Écaille pour défier Basalte.' },
    { name: 'Vaincre Pyros (Badge Volcan)', where: 'Cendrelune (Route 8)', hint: 'Gravis la Route 8 à flanc de cratère jusqu\'à Cendrelune pour défier Pyros.' },
    { name: 'Vaincre Drakos (Badge Écaille)', where: 'Cimelune (Route 9)', hint: 'Monte au sommet de la Route 9 et triomphe du clan des dragons de Drakos.' },
    { name: 'Triompher de la Ligue Céleste', where: 'Plateau Céleste (Nord)', hint: 'Franchis la Route Victoire au nord de Cimelune. Bats le Conseil 4 et la Maître Célestine !' },
  ];

  const hasStarter = !!(st.flags?.starter || (st.party && st.party.length) || bCount > 0);
  const isChampion = !!(st.flags?.champion || st.flags?.ligue);

  let curIdx = 0;
  if (!hasStarter) curIdx = 0;
  else if (bCount < 8) curIdx = bCount + 1;
  else if (!isChampion) curIdx = 9;
  else curIdx = 10;

  const done = isChampion;
  const currentStep = curIdx < stepsDef.length ? stepsDef[curIdx] : null;

  return {
    ...QUEST_METADATA.ligue,
    status: done ? 'done' : 'active',
    statusLabel: done ? 'Terminée' : 'En cours',
    step: done ? stepsDef.length : curIdx + 1,
    totalSteps: stepsDef.length,
    destination: done ? 'Plateau Céleste (Ligue Céleste)' : currentStep.where,
    direction: done ? 'Tu as conquis le titre suprême de Maître d\'Odyssée !' : currentStep.hint,
    stepDesc: done ? 'Tu es le Maître incontesté de la Ligue Céleste !' : currentStep.name,
    steps: stepsDef.map((s, idx) => ({
      index: idx + 1,
      desc: s.name,
      destination: s.where,
      done: idx < curIdx || done,
      current: idx === curIdx && !done,
    })),
    endText: 'Tu as triomphé du Conseil 4 et de Célestine. Ton nom est gravé au Panthéon de la Ligue Céleste !',
  };
}

/**
 * Calcule l'état en temps réel de la Quête de la Team Éclipse
 */
function resolveEclipseQuest(game) {
  const st = game.state;
  const f = st.flags || {};
  const isDone = !!f.lugia;

  const stepsDef = [
    { name: 'Pillage de la Grotte Lunaire', where: 'Grotte Lunaire (Route 2)', hint: 'Des sbires de la Team Éclipse pillent les Pierres Lune. Chasse Erèbe dans la grotte.' },
    { name: 'Interrogatoire à Port-Azur', where: 'Port-Azur (Pontons)', hint: 'Nyx tente d\'extorquer les secrets de Lugia à un vieux marin. Déloge-la des quais.' },
    { name: 'Sabotage de la Centrale', where: 'Centrale de Voltacité', hint: 'Erèbe détourne l\'électricité pour le Prisme Noir. Rétablis le courant dans la tour dorée.' },
    { name: 'Infiltration du Repaire secret', where: 'Route 6 (Repaire Éclipse)', hint: 'Infiltre le laboratoire secret au milieu de la Route 6 et défais le Chef Nocturne.' },
    { name: 'Purification au Sanctuaire des Marées', where: 'Sanctuaire des Marées (Sud Mirage)', hint: 'La nuit éternelle est tombée ! Obtiens la Plume Argentée auprès de la Voyante de Mirage et surfe vers l\'îlot du Sanctuaire pour sauver Lugia Obscur !' },
  ];

  let curIdx = 0;
  if (!f['T:ecl:erebe1']) curIdx = 0;
  else if (!f['T:ecl:nyx1']) curIdx = 1;
  else if (!f['T:ecl:erebe2']) curIdx = 2;
  else if (!f.eclipse) curIdx = 3;
  else if (!f.lugia) curIdx = 4;
  else curIdx = 5;

  const currentStep = curIdx < stepsDef.length ? stepsDef[curIdx] : null;

  return {
    ...QUEST_METADATA.eclipse,
    status: isDone ? 'done' : 'active',
    statusLabel: isDone ? 'Terminée' : 'En cours',
    step: isDone ? stepsDef.length : curIdx + 1,
    totalSteps: stepsDef.length,
    destination: isDone ? 'Sanctuaire des Marées' : currentStep.where,
    direction: isDone ? 'Lugia a été libéré de l\'emprise du Prisme Noir et la Team Éclipse est anéantie.' : currentStep.hint,
    stepDesc: isDone ? 'La Team Éclipse a été mise en déroute et Lugia a retrouvé sa sérénité.' : currentStep.name,
    steps: stepsDef.map((s, idx) => ({
      index: idx + 1,
      desc: s.name,
      destination: s.where,
      done: idx < curIdx || isDone,
      current: idx === curIdx && !isDone,
    })),
    endText: 'Le soleil brille à nouveau sur toute la région d\'Odyssée !',
  };
}

/**
 * Résout une quête secondaire de quetes.js
 */
function resolveSideQuest(id, worldQuest, game) {
  const meta = QUEST_METADATA[id] || {};
  const f = game.state.flags || {};
  const rawState = f['Q:' + id];
  const isDone = rawState === 'fin';
  const isActive = rawState && rawState !== 'fin';
  const isUnmet = !rawState;

  const rawSteps = (typeof worldQuest.steps === 'function' ? worldQuest.steps(f, game) : worldQuest.steps) || (meta.dests ? meta.dests.map((d) => d.hint) : []);
  const totalSteps = Math.max(1, rawSteps.length);
  const n = typeof rawState === 'number' ? Math.max(1, Math.min(rawState, totalSteps)) : 1;
  const curIdx = isDone ? totalSteps - 1 : n - 1;

  const dests = meta.dests || [];
  const curDest = dests[curIdx] || dests[dests.length - 1] || { where: worldQuest.where || 'Odyssée', hint: 'Consulte ton journal de quêtes.' };

  const currentDesc = isDone
    ? (worldQuest.end || meta.end || 'Quête terminée.')
    : (rawSteps[curIdx] || rawSteps[0] || 'Objectif en cours.');

  const stepsList = rawSteps.map((txt, idx) => ({
    index: idx + 1,
    desc: txt,
    destination: dests[idx]?.where || worldQuest.where || 'Odyssée',
    done: idx < curIdx || isDone,
    current: idx === curIdx && !isDone,
  }));

  return {
    id,
    cat: 'side',
    name: worldQuest.name || meta.name || id,
    giver: meta.giver || 'Habitant',
    where: worldQuest.where || meta.where || 'Région d\'Odyssée',
    desc: meta.desc || rawSteps[0] || '',
    icon: meta.icon || 'notebook',
    status: isDone ? 'done' : isActive ? 'active' : 'unmet',
    statusLabel: isDone ? 'Terminée' : isActive ? 'En cours' : 'À découvrir',
    step: isDone ? totalSteps : n,
    totalSteps,
    destination: isDone ? (worldQuest.where || 'Odyssée') : curDest.where,
    direction: isDone ? (worldQuest.end || 'Quête terminée avec succès.') : curDest.hint,
    stepDesc: currentDesc,
    steps: stepsList,
    reward: meta.reward || 'Objets précieux & Reconnaissance',
    endText: worldQuest.end || meta.end || 'Quête menée à bien.',
  };
}

/**
 * Résout une mission d'habitant de story.js
 */
function resolveNpcQuest(id, game) {
  const meta = QUEST_METADATA[id];
  const f = game.state.flags || {};
  const isDone = !!f[id];

  return {
    id,
    cat: 'npc',
    name: meta.name,
    giver: meta.giver,
    where: meta.where,
    desc: meta.desc,
    icon: meta.icon || 'gift',
    status: isDone ? 'done' : 'active',
    statusLabel: isDone ? 'Terminée' : 'En cours',
    step: isDone ? 1 : 1,
    totalSteps: 1,
    destination: meta.where,
    direction: isDone ? 'Mission accomplie auprès de l\'habitant.' : meta.dest,
    stepDesc: isDone ? 'Mission accomplie !' : meta.desc,
    steps: [
      {
        index: 1,
        desc: meta.desc,
        destination: meta.where,
        done: isDone,
        current: !isDone,
      },
    ],
    reward: meta.reward,
    endText: 'Le donneur de quête a reçu ce qu\'il demandait et t\'a chaleureusement remercié !',
  };
}

/**
 * Renvoie la liste complète ordonnée de toutes les quêtes du jeu
 */
export function getAllQuests(game) {
  const list = [];
  const trackedId = game.state?.trackedQuest;

  // 1. Quêtes Principales
  list.push(resolveLigueQuest(game));
  list.push(resolveEclipseQuest(game));

  // 2. Grandes Aventures (world/quetes.js)
  const WQ = game.world?.quests || {};
  const sideIds = ['ponyta', 'lac', 'courrier', 'songes', 'kagura', 'voeu', 'fossile', 'magma'];
  for (const id of sideIds) {
    const q = WQ[id] || {
      id,
      name: QUEST_METADATA[id]?.name || id,
      where: QUEST_METADATA[id]?.dests?.[0]?.where,
      steps: QUEST_METADATA[id]?.dests?.map((d) => d.hint) || [],
    };
    list.push(resolveSideQuest(id, q, game));
  }

  // 3. Missions d'habitants (story.js)
  const npcIds = ['qMedaillon', 'qMagicarpe', 'qRoche', 'qEchange', 'giftEvoli', 'dexpert', 'qNiveau', 'giftMinidraco'];
  for (const id of npcIds) {
    if (QUEST_METADATA[id]) {
      list.push(resolveNpcQuest(id, game));
    }
  }

  // Marquage de la quête suivie
  for (const q of list) {
    q.isTracked = trackedId ? q.id === trackedId : q.id === 'ligue';
  }

  return list;
}

/**
 * Renvoie la quête actuellement suivie par le joueur
 */
export function getTrackedQuest(game) {
  const all = getAllQuests(game);
  const trackedId = game.state?.trackedQuest;
  if (trackedId) {
    const found = all.find((q) => q.id === trackedId);
    if (found) return found;
  }
  // Par défaut, suivre la Ligue Céleste si active
  return all.find((q) => q.id === 'ligue' && q.status === 'active') || all[0];
}

/**
 * Active ou désactive le suivi d'une quête
 */
export function setTrackedQuest(game, questId) {
  if (!game.state) return;
  if (game.state.trackedQuest === questId) {
    game.state.trackedQuest = null;
  } else {
    game.state.trackedQuest = questId;
  }
  game.save?.(true);
}
