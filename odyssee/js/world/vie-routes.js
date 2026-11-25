// odyssee/js/world/vie-routes.js — ce qui peuple les routes : les gens du coin, les scènes, les Pokémon qu'on croise et le
// menu décor de chaque biome (posés par decors-routes.js dans les clairières, sur les corniches et au bord des chemins).

/** menu décor (bloquant, semé un par un) de chaque biome : [dessin, poids] */
export const PETITS = {
  campagne: [['bush', 4], ['gerbe', 2], ['tournesol', 2], ['souche_m', 1], ['rock', 2]], valfleuri: [['hortensia', 4], ['rosier_blanc', 3], ['bush', 3], ['b_bouleau', 1]],
  murmure: [['champi_violet', 3], ['champi_rouge', 3], ['souche_m', 2], ['b_fougere', 4], ['bush', 1]], alpage: [['rock', 5], ['bush', 3], ['cairn', 1], ['menhir2', 1]],
  cerisaie: [['bush', 4], ['rosier_blanc', 2], ['hortensia', 2], ['rock', 1]], lande: [['rock', 4], ['bush', 2], ['menhir2', 1], ['b_pin_tordu', 1]],
  savane: [['bush', 4], ['rock', 3], ['b_acacia', 1], ['crane', 0.3]], lavande: [['bush', 3], ['b_olivier', 2], ['ruche', 0.6], ['tournesol', 2], ['rock', 1]],
  mirage: [['cristal_rose', 4], ['b_opale', 1], ['rock', 2], ['bush', 2]], jungle: [['b_fougere', 6], ['fleur_geante', 1.5], ['souche_m', 1.5], ['bush', 2], ['palm', 1]],
  gorge: [['rock', 6], ['geyser', 0.8], ['deadtree', 1], ['bush', 1]], taiga: [['rock', 3], ['cristal_glace', 2], ['souche_m', 2], ['bush', 1]],
  celeste: [['colonne_b', 1.5], ['rosier_blanc', 4], ['rock', 2]], cote: [['rock', 3], ['bush', 3], ['palm', 1.5], ['b_pin_parasol', 0.7]],
  verger: [['bush', 4], ['gerbe', 1], ['b_pommier', 1], ['tonneau', 0.5], ['rock', 1]], riziere: [['bush', 3], ['gerbe', 1], ['b_bambou', 2], ['rock', 1]],
  marais: [['roseaux_b', 5], ['champi_violet', 2], ['souche_m', 2], ['b_paletuvier', 0.8]], desert: [['cactus', 3], ['cactus2', 3], ['rock', 4], ['crane', 0.3]],
  canyon: [['cactus', 2], ['rock', 6], ['deadtree', 1], ['crane', 0.3]], roseraie: [['b_rosier', 4], ['rosier_blanc', 3], ['hortensia', 2]],
  hante: [['b_mort', 2], ['tombe', 1.4], ['tombe2', 1], ['champi_violet', 2], ['souche_m', 1.5], ['rock', 1]], vigne: [['bush', 4], ['tonneau', 0.6], ['gerbe', 1], ['rock', 1.5]],
  orage: [['rock', 4], ['menhir_orage', 1.5], ['b_foudroye', 1], ['paratonnerre', 0.4]], bambou: [['b_bambou', 4], ['b_fougere', 2], ['rock', 2], ['lanterne', 0.4]],
  braises: [['rock', 5], ['b_braise', 2], ['brasero_r', 0.6]], givre: [['cristal_glace', 3], ['rock', 2], ['snowpine', 2]],
};

/** les Pokémon qu'on y croise en liberté (ils ont un dessin de marche) */
export const FAUNE = {
  campagne: [16, 19, 52, 133], valfleuri: [43, 54, 60, 10], murmure: [43, 10, 16], alpage: [66, 74, 16], cerisaie: [133, 25, 16], lande: [19, 37, 74], savane: [52, 19, 37], lavande: [43, 25, 133],
  mirage: [133, 25, 1], jungle: [1, 152, 43, 10], gorge: [74, 50], taiga: [133, 16, 143], celeste: [16, 133], cote: [54, 60, 7, 158], verger: [16, 10, 133], riziere: [60, 54, 10], marais: [60, 43, 54],
  desert: [50, 74], canyon: [74, 50, 66], roseraie: [43, 1, 152], hante: [52, 19, 37], vigne: [52, 37, 133], orage: [25], bambou: [152, 66, 10], braises: [4, 155, 37], givre: [133, 7],
};

/** les gens du coin : [apparence, nom, répliques] */
export const GENS = {
  campagne: [['jardinier', 'Fermier', ['Le blé sera mûr dans une semaine. Enfin, je dis ça toutes les semaines.', 'Prends le sentier de derrière si tu veux marcher à l\'ombre.']], ['fillette', 'Lison', ['Je compte les Roucool. J\'en suis à quarante… ou alors c\'est toujours le même.']], ['vieil_homme', 'Papi Marcel', ['Le chemin n\'a jamais été droit, ici. On contourne les arbres : ils étaient là avant nous.']]],
  valfleuri: [['dame', 'Fleuriste', ['Sept couleurs de fleurs dans le même pré, et pas une graine semée par la main de l\'homme.']], ['enfant', 'Tom', ['J\'ai fait le tour de l\'étang en cent douze pas. Et toi ?']], ['kimono', 'Peintre', ['Je peins le val chaque matin. Il n\'a jamais eu deux fois la même couleur.']]],
  murmure: [['insectomane', 'Cueilleur', ['Les champignons bleus éclairent, les rouges endorment. Ne te trompe pas.']], ['medium', 'Ermite', ['Le bois murmure, oui. Ce soir, il parle de toi.']], ['gamin', 'Hugo', ['J\'ai suivi une lueur hors du sentier. Elle m\'a ramené au même endroit, trois fois !']]],
  alpage: [['montagnard', 'Berger', ['En haut de la corniche, on voit toute la route. Monte par les marches !']], ['randonneuse', 'Guide', ['Les cairns montrent le bon passage quand le brouillard tombe. Ajoute ta pierre.']], ['vieil_homme', 'Doyen', ['Les fanions portent nos vœux au vent. Le mien a mis trente ans à se réaliser.']]],
  cerisaie: [['kimono', 'Danseuse', ['On danse ici quand tombent les premiers pétales. Il en tombe toute l\'année.']], ['habitant', 'Promeneur', ['Je viens pique-niquer tous les jours. Je repars avec des pétales plein les poches.']], ['fillette2', 'Mina', ['Si tu attrapes un pétale avant qu\'il touche le sol, tu peux faire un vœu.']]],
  lande: [['savant', 'Archéologue', ['Ces pierres n\'ont pas été posées au hasard : vues d\'en haut, elles dessinent un Pokémon.']], ['montagnard', 'Tourbier', ['Garde un pied sur le sentier. La lande aime bien les chaussures.']], ['medium', 'Voyante', ['Les pierres gravées luisent avant l\'orage. Regarde-les bien.']]],
  savane: [['randonneuse', 'Pisteuse', ['Le soir, tout le monde vient boire à la même mare. Même ceux qui se battent la journée.']], ['habitant', 'Conteur', ['Un baobab a mille ans. Celui-ci a vu passer les géants dont tu vois les os.']], ['gamin', 'Samir', ['Je cours plus vite qu\'un Rattata ! Bon. Qu\'un Rattata fatigué.']]],
  lavande: [['dame', 'Parfumeuse', ['Une goutte de lavande, deux gouttes de pluie… Le reste est un secret.']], ['jardinier', 'Apiculteur', ['Doucement près des ruches : elles travaillent, elles.']], ['vieil_homme', 'Rêveur', ['Je m\'assois entre deux rangs, je ferme les yeux, et la journée est finie.']]],
  mirage: [['scientifique', 'Cristallographe', ['Ces cristaux résonnent entre eux. Frappe-en un : l\'autre répond, à cent pas.']], ['medium', 'Oracle', ['Ton reflet a souri avant toi. C\'est bon signe, paraît-il.']], ['fillette', 'Opaline', ['J\'ai trouvé une opale ! Ah non. C\'était un caillou mouillé.']]],
  jungle: [['insectomane', 'Explorateur', ['Plusieurs sentiers partent d\'ici. Un seul est court, mais c\'est le moins drôle.']], ['habitante', 'Herboriste', ['La fleur géante sent mauvais, mais elle soigne tout. Surtout l\'envie de la sentir.']], ['vieil_homme', 'Gardien', ['Les totems regardent ceux qui passent. Salue-les, ça ne coûte rien.']]],
  gorge: [['scientifique', 'Géologue', ['Un geyser toutes les sept minutes. Reste à l\'écart à la sixième.']], ['karateka', 'Ascète', ['Je m\'entraîne dans la vapeur. On ne voit pas ses adversaires : on les devine.']]],
  taiga: [['montagnard', 'Trappeur', ['Je ne chasse pas, je répare les sentiers. La neige les mange chaque nuit.']], ['topdresseuse', 'Candidate', ['La Ligue est au bout. Je prends le chemin le plus long, pour être prête.']]],
  celeste: [['pretre', 'Gardien des jardins', ['Chaque Maître a planté un arbre ici. Le tien a déjà sa place.']], ['topdresseur', 'Vétéran', ['J\'ai perdu au dernier combat, il y a dix ans. Je reviens tous les ans regarder la vue.']]],
  cote: [['pecheur', 'Pêcheur à pied', ['À marée basse, on trouve des coquillages sous chaque rocher. À marée haute, on court.']], ['marin', 'Vieux loup de mer', ['D\'en haut, je vois les bateaux, et les dresseurs qui se trompent de chemin.']], ['enfant', 'Coralie', ['Mon château de sable a trois étages et une arène !']]],
  verger: [['jardinier', 'Arboriculteur', ['Les pommes du fond sont les meilleures. C\'est toujours le fond, le meilleur.']], ['dame', 'Confiturière', ['Cent pots par jour. Tu peux goûter, mais il faut aimer très sucré.']], ['gamin', 'Léo', ['Je monte dans l\'arbre, je secoue, et Chenipan tombe. Désolé, Chenipan !']]],
  riziere: [['habitante', 'Repiqueuse', ['On marche sur les diguettes, jamais dans l\'eau : les pousses sont fragiles.']], ['vieil_homme', 'Maître des eaux', ['J\'ouvre une vanne, et dix casiers se remplissent. C\'est tout un art.']], ['kimono', 'Dame du thé', ['Une halte, une tasse de thé, et on repart. C\'est la règle de la route.']]],
  marais: [['pecheur', 'Passeur', ['Les passerelles sont sûres. Enfin, celles que j\'ai réparées.']], ['savant', 'Naturaliste', ['Les lumières au-dessus de l\'eau, le soir ? Des insectes. En général.']], ['insectomane', 'Guetteur', ['Chut. Tu entends ? Ça, c\'est un Ptitard. Et ça, c\'est mon ventre.']]],
  desert: [['montagnard', 'Caravanier', ['Les dunes bougent, les mesas non. Choisis bien tes repères.']], ['savant', 'Chercheur d\'os', ['Ces côtes sont celles d\'un géant. Il a dû avoir soif, lui aussi.']], ['randonneuse', 'Nomade', ['À l\'oasis, on boit, on dort, et on repart avant le soleil.']]],
  canyon: [['karateka', 'Grimpeur', ['Un canyon, c\'est un mur qu\'on n\'a pas encore escaladé.']], ['montagnard', 'Prospecteur', ['De l\'or ? Non. Mais de belles pierres, si on gratte au bon endroit.']], ['habitant', 'Promeneur', ['Crie ton nom dans la gorge. Parfois, elle répond par un autre.']]],
  roseraie: [['jardinier', 'Maître rosier', ['Mille rosiers, mille noms. Celui-ci s\'appelle « Patience ».']], ['dame', 'Comtesse', ['On se perd volontiers dans les allées. C\'est même fait pour.']], ['kimono', 'Musicienne', ['Je joue au kiosque, les soirs d\'été. Les roses s\'ouvrent pour écouter.']]],
  hante: [['pretre', 'Fossoyeur', ['Les tombes, je les compte chaque soir. Le compte n\'est jamais le même.']], ['medium', 'Spirite', ['Ils sont trois derrière toi. Ne t\'inquiète pas, ils sont gentils.']], ['gamin', 'Basile', ['J\'ai PAS peur. Je suis juste parti en courant pour m\'échauffer.']]],
  vigne: [['jardinier', 'Vigneron', ['Une bonne année : du soleil, de la pluie, et pas trop d\'oiseaux.']], ['dame', 'Vendangeuse', ['Monte sur le coteau, la vue vaut le détour. Et le raisin aussi.']], ['vieil_homme', 'Tonnelier', ['Un bon tonneau vit plus vieux que moi. Enfin, on verra.']]],
  orage: [['scientifique', 'Foudrologue', ['Les pierres attirent la foudre. Tiens-toi plutôt près des paratonnerres. Mais pas trop.']], ['gamin', 'Éclair', ['J\'ai les cheveux comme ça depuis mardi.']]],
  bambou: [['kimono', 'Flûtiste', ['Quand le vent passe dans les bambous, je n\'ai plus qu\'à l\'accompagner.']], ['karateka', 'Disciple', ['Plier sans rompre. C\'est le bambou qui me l\'a appris.']]],
  braises: [['karateka', 'Marcheur de feu', ['La lave avance d\'un pas par an. Moi, d\'un pas par jour. Je gagne.']], ['savant', 'Volcanologue', ['Ne t\'approche pas des mares : elles ne sont pas tièdes.']]],
  givre: [['randonneuse', 'Alpiniste', ['Le passage est gelé ? Contourne par les sapins, la neige y est moins profonde.']], ['montagnard', 'Sculpteur de glace', ['Il me faut un jour pour tailler un Pokémon. Et une nuit pour qu\'il fonde.']]],
};

/** ce que disent les campeurs, les pique-niqueurs, les chercheurs et les dresseurs des clairières (partout) */
export const CAMP = ['Tu as l\'air d\'avoir beaucoup marché. Assieds-toi près du feu avec nous !', 'On marche depuis trois jours. Le feu, c\'est ce qu\'il y a de mieux.', 'Ici, le soir, on voit toutes les étoiles. Et quelques yeux.'];
export const PIQUENIQUE = ['On a trop de baies pour deux. Tiens, prends-en une !', 'Un pique-nique sans Pokémon gourmand, ce n\'est pas un vrai pique-nique. Tiens, goûte !', 'La nappe s\'est envolée deux fois. On tient bon. Tu veux une baie ?'];
export const ETUDE = ['J\'étudie les Pokémon qui vivent hors des sentiers. Tu en as croisé ? Alors prends ça, pour la science !', 'Mes instruments pèsent trop lourd. Tiens, ceci te servira plus qu\'à moi.', 'Chaque clairière a ses habitants. Voilà de quoi les observer !'];
export const DEFI = ['Je m\'entraîne loin du chemin, là où personne ne vient. Enfin, d\'habitude.', 'Tu as trouvé la clairière ? Alors tu as du flair. Voyons tes Pokémon !', 'Ici, pas de public. Juste toi, moi, et nos Pokémon.', 'Le grand chemin, c\'est pour les pressés. Les vrais combats se font ici !'];
export const APRES_DEFI = ['Le sentier continue par là. Il rejoint la route un peu plus loin.', 'Reviens quand tu veux, je ne bouge pas d\'ici.', 'Bien joué. Personne ne m\'avait trouvé depuis longtemps.'];
/** prénoms des dresseurs des clairières (aucun autre dresseur ne les porte) */
export const DEFIEURS = {
  m: ['Achille', 'Alaric', 'Amaury', 'Anatole', 'Ancelin', 'Aristide', 'Barnabé', 'Béranger', 'Calixte', 'Célestin', 'Colomban', 'Côme', 'Cyprien', 'Edgar', 'Eustache', 'Evrard', 'Fulbert', 'Gaëtan', 'Gauvain', 'Gontran', 'Hilaire', 'Isidore', 'Josselin', 'Lazare', 'Léandre', 'Lothaire', 'Malo', 'Modeste', 'Octavien', 'Perceval', 'Philibert', 'Quentin', 'Rodrigue', 'Siméon', 'Tancrède', 'Tibère', 'Ulrich', 'Valère', 'Wandrille', 'Zéphyrin', 'Elzéar', 'Ombrin', 'Sylvère', 'Aubin', 'Gwendal'],
  f: ['Abelle', 'Alix', 'Ambre', 'Apolline', 'Aude', 'Bérengère', 'Blandine', 'Capucine', 'Cassandre', 'Clotilde', 'Colombe', 'Daphné', 'Diane', 'Églantine', 'Eulalie', 'Flavie', 'Garance', 'Gisèle', 'Hermine', 'Hortense', 'Iseult', 'Joséphine', 'Léopoldine', 'Lucrèce', 'Maïwenn', 'Maud', 'Mélisande', 'Ninon', 'Ombeline', 'Ondine', 'Pénélope', 'Philippine', 'Quitterie', 'Rosemonde', 'Salomé', 'Solveig', 'Tiphaine', 'Ursule', 'Valentine', 'Yseult', 'Zélie', 'Aliénor', 'Bathilde', 'Coline', 'Doriane'],
};
