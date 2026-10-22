# Journal des versions — Game Hub (Duo Drift, DavidSimulator)

## 2.22 — 22 octobre 2026
- **Bastion Clash** — Construction au clavier : avec un VCS sélectionné, **B** ouvre le menu puis **1-0 / R** choisit le bâtiment. Les chiffres seuls rappellent toujours tes groupes de contrôle.
- **Bastion Clash** — Deux nouvelles cartes :
  - 🏜️ **Canyon de Cuivre** : grès rouge, mesas et oasis ; la chaleur réduit la vision de 15 % mais les minéraux se récoltent 20 % plus vite ;
  - 🌃 **Ruines Néon** : une ville abandonnée de nuit, coupée par des canaux toxiques ; les unités voient 20 % moins loin et toutes les bases avancées ont des cristaux dorés.
- **Bastion Clash** — Nouveau format **Duel 1 contre 1**, sur une carte dédiée plus compacte (bases en diagonale, base naturelle, troisième base et deux coins disputés), sur les cinq champs de bataille.
- **Bastion Clash** — Nouveau mode **Coop : Défense contre des vagues** : tous les joueurs du même côté face à la Horde, 15 vagues de plus en plus fortes (10 en Blitz), un Colosse toutes les cinq vagues, une prime de 150💎 et 60🧪 par vague repoussée.
- **Bastion Clash** — Économie : les cristaux et les geysers s'épuisent, et il n'y a plus de revenu automatique. Tout vient de tes VCS : s'étendre vers d'autres bases devient indispensable.
- **Bastion Clash** — Améliorations par paliers : armes et blindages montent jusqu'au niveau 3 (+12 % de dégâts ou +10 % de points de vie par niveau), chaque niveau coûtant un peu plus cher.
- **Bastion Clash** — Le Scan Radar se lance depuis un Centre de Commandement et se recharge en 45 secondes.
- **Bastion Clash** — Des bots vraiment différents selon le niveau :
  - Facile reste sur une base et attaque en masse, sans finesse ;
  - Moyen s'étend, monte ses améliorations, utilise Stimpack et Mode Siège, recule quand il perd et envoie un éclaireur ;
  - Difficile s'étend tôt sur trois bases, produit davantage et fait des largages en Navette sur tes ouvriers ;
  - en 2 contre 2 coop, ton bot allié vient défendre ta base et suit tes attaques.
- **Bastion Clash** — Mode spectateur : une fois éliminé, ou si tu rejoins le salon en cours de partie, tu vois toute la carte, le tableau des joueurs (ressources, armée, bases, améliorations) et tu passes d'une base à l'autre avec Tab.
- **Bastion Clash** — Graphismes :
  - nouveau bouton ⚙️ : qualité Bas / Moyen / Haut / Ultra (Ultra ajoute des lueurs et des ombres plus fines), couleurs pour daltoniens, secousses de caméra, barres de vie toujours visibles ;
  - sol plus détaillé (herbe, cendres, congères), ombre au pied des falaises et des bâtiments, éclairs lumineux des explosions.
- **Bastion Clash** — Parties en ligne plus solides :
  - si un joueur quitte ou perd la connexion, un bot garde sa base ; il la reprend dès qu'il revient dans le salon ;
  - si l'hôte part, un autre joueur reprend la partie là où elle en était, sans retour au salon ;
  - chacun ne reçoit plus que ce que son équipe voit (fini le brouillard de guerre contournable), et les échanges réseau sont environ huit fois plus légers ;
  - l'hôte vérifie chaque ordre : pas de Scan sans Centre de Commandement, pas de réparation des bâtiments adverses.
- **Bastion Clash** — Corrections :
  - le classement de fin de partie met bien le meilleur score en tête chez les vainqueurs ;
  - si les dernières bases tombent en même temps, la partie se termine sur une égalité ;
  - les troupes embarquées dans une Navette ne prennent plus les dégâts de zone ;
  - les équipes ne se changent qu'en 2 contre 2, et seul l'hôte peut déplacer un autre joueur ;
  - le rayon de soin des Navettes Médicales est enfin visible ;
  - la touche C envoie récolter près de la souris, la sélection au cadre suit exactement le cadre tracé, et la caméra ne défile plus toute seule après un changement de fenêtre.

## 2.21 — 22 octobre 2026
- **Bastion Clash** — Les longues parties ne ralentissent plus : à partir de 8-10 minutes, le jeu passait au ralenti pour tout le monde dès que les armées grossissaient.
- **Bastion Clash** — Les unités contournent les bâtiments au lieu de se coincer contre eux, et les armées des bots sortent enfin de leur base.
- **Bastion Clash** — En chacun pour soi, les bots ne s'acharnent plus tous sur l'hôte : chacun choisit un adversaire proche et ils se répartissent les cibles.
- **Bastion Clash** — Les longues parties ne font plus grimper la mémoire de la carte graphique (explosions et unités détruites).
- **Bastion Clash** — Si l'hôte passe sur un autre onglet, la partie continue à vitesse normale au lieu de presque s'arrêter.

## 2.20 — 22 octobre 2026
- **DavidSimulator** — Échanges :
  - Quand un bot te fait une proposition, tu as maintenant 60 secondes pour répondre (au lieu de 25), avec un compte à rebours dans la fenêtre et dans la barre du bas (« Mamé Rose attend ta réponse · 42 s »). Si tu fermes la fenêtre, le bouton « Voir la proposition » la rouvre.
  - L'argent d'un échange s'affiche en billet de banque avec la somme dessus, à la couleur de la plus grosse coupure ; le billet suit le montant pendant que tu composes ta proposition.
  - Les bots proposent beaucoup moins d'échanges (au plus un tous les quatre tours de table, une seule fois la même affaire à un joueur humain) et des affaires simples : une somme ronde, ou un seul terrain, pour un seul terrain demandé.
- **DavidSimulator** — 2 contre 2 : une couleur détenue à deux par les coéquipiers suffit pour construire. Chacun bâtit sur ses propres terrains, toujours de façon égale sur tout le groupe, et le loyer des terrains nus est doublé. Si un coéquipier fait faillite et que la couleur n'est plus complète, les bâtiments du groupe sont revendus à moitié prix.
- **DavidSimulator** — Dés : chaque lancer reçoit un aléa neuf tiré par le générateur cryptographique du navigateur de l'hôte, et un nouvel onglet « Dés » dans les statistiques compare les lancers de la partie aux probabilités d'une vraie paire de dés. Il explique aussi pourquoi la prison et quelques cases reviennent plus souvent, même avec des dés parfaits.

## 2.19 — 22 octobre 2026
- **Cyber Kart GP** — Kart Rush GP devient Cyber Kart GP, avec une vraie affiche dans le Hub.
  - Grand Prix : « Course suivante » enchaîne le circuit suivant au lieu de revenir au menu, et les points s'additionnent course après course (classement général à la fin des 6 circuits).
  - 3 nouveaux circuits : la Jungle Perdue (forêt luxuriante, grand virage serré au bord d'un précipice, temple inca et tunnel sous la pyramide), le Château Hanté (de nuit : lave et serpentins jusqu'à la grande porte, labyrinthe à angles droits sur tapis rouge éclairé aux torches, jardin hanté sous la lune) et la Plage des Falaises (plein soleil, crabes qui traversent la route, pontons au pied des falaises de craie et de leurs arches).
  - Le choix du circuit montre une capture de chaque piste, et le décor derrière est bien plus visible.
  - Drift revu : le kart garde sa trajectoire avec un léger décalage, du côté où l'on tourne, à gauche comme à droite ; sans tourner, la touche fait juste un saut.
  - ↓ + E lance bien les objets vers l'arrière (bananes comprises), et la carapace bleue explose enfin sur le premier.
  - Nouveaux sons : vitre qui éclate sur les cubes, roulette qui ralentit au tirage de l'objet, crissement et toupie quand on se fait toucher.
  - Pilotes : Jordan retrouve le robot de course en tôle (Marine en version bleue), Cybertype a des yeux néon violets ; les karts ne sont plus rognés dans le menu.

## 2.18 — 22 octobre 2026
- **Kart Rush GP** — Nouveau jeu : course de karts en 3D, seul ou jusqu'à 6 joueurs, avec des IA pour compléter la grille (8 pilotes en piste).
  - 3 circuits au choix de l'hôte : le Grand Circuit (stade, cascades, tunnel), Whisky Peak (montagne enneigée, boules de neige géantes, route gelée, télésiège et skieurs à éviter) et la Route Arc-en-ciel (dans l'espace, face à la Terre et la Lune).
  - 8 pilotes et 4 karts, chacun avec ses statistiques ; un pilote par joueur.
  - Drift avec la touche Maj : 1 seconde de drift donne un mini-turbo, deux fois plus vite en alternant gauche et droite.
  - 16 objets dans les cubes irisés : champignons, bananes, carapaces verte, rouge et bleue, étoile, fleur de feu (rare), éclair, poulpe, fusée…
  - Une musique par circuit, qui accélère un peu à chaque tour.

## 2.17 — 22 octobre 2026
- **Outbreak : Secteur Zéro** — Le jeu de zombies est entièrement refait, graphismes et gameplay.
  - Vraie coop en ligne jusqu'à 5 : tout le monde voit les mêmes zombies, son propre survivant répond sans délai, et si l'hôte part, un autre joueur reprend la partie.
  - Campagne de 7 salles : à chaque salle nettoyée, deux portes annoncent leur récompense (Armurerie, Infirmerie, Laboratoire, Entrepôt) et l'escouade choisit son chemin jusqu'au Noyau et au boss, le Spécimen Zéro (3 phases : charge, onde de choc, salves d'acide, renforts).
  - Nouveau mode Survie : vagues sans fin dans un hangar, avec une brute toutes les 5 vagues et le boss toutes les 10.
  - Améliorations façon roguelite entre les salles : 22 cartes (dégâts, cadence, vampirisme, ricochets, réaction en chaîne, second souffle…), communes, rares ou épiques.
  - 8 armes (pistolet, mitraillette, pompe, fusil d'assaut, lance-flammes, lance-grenades, fusil à rail, minigun), grenades à lancer, roulade invulnérable.
  - 7 sortes de zombies qui se reconnaissent au premier coup d'œil : rôdeurs, coureurs, rampants, cracheurs (flaques d'acide), gonflés qui explosent, hurleuses qui enragent la horde, brutes qui chargent. Les attaques dangereuses sont annoncées au sol.
  - À terre, on peut encore ramper et tirer au pistolet pendant que les autres viennent vous relever (maintenir E) ; les K.O. reviennent à la salle suivante.
  - Équipiers IA (réglage « Équipiers IA ») : ils suivent, tirent, relèvent, ramassent et franchissent les portes avec vous.
  - Nouveau style dessiné à la main, dans l'esprit du Hub : lampes torches dans le noir, sang et cadavres qui restent au sol, explosions, barils, caisses à casser, sons et musique qui montent avec le combat.
  - Manette et écran tactile pris en charge ; difficulté Arcade, Normale ou Cauchemar ; le score de chacun entre au classement entre potes.

## 2.16 — 22 octobre 2026
- **Fil Rouge** — Nouveau jeu : désamorçage à deux voix, de 2 à 6 joueurs. Le démineur voit la bombe en 3D mais n'a pas le manuel ; l'expert a le manuel posé sur sa table mais ne voit pas la bombe. Il faut se parler !
  - Coopération, ou Duel 2 contre 2 : les deux équipes ont la même bombe, la première qui la désamorce gagne.
  - Une vraie pièce en 3D, la nuit, avec vue sur la Baie des Anges. On tourne la bombe avec Z/S, Q/D, A/E (W/S, A/D, Q/E en QWERTY) ou à la souris, et on clique un module pour s'en approcher.
  - Six modules : raccordements, coffre à symboles, leviers, carillon (une mélodie à décrire), tuyauterie, manomètres. L'extérieur de la bombe compte aussi : n° de lot, tampons de villes de la Côte, vis manquantes.
  - Le manuel est un livret 3D aux pages qui se tournent, avec un onglet par module. Ses règles changent à chaque partie.
  - Chaque faute fait accélérer le chrono. Quatre difficultés, de l'Initiation (2 modules) à Difficile (7 modules).
  - En duel : chat réservé à l'équipe, progression adverse en direct, et chaque module désamorcé envoie un sabotage à l'autre équipe (coupure de courant, fumigène, secousse, encre renversée).
  - Fil Rouge a sa colonne dans le classement entre potes.

## 2.15 — 22 octobre 2026
- **DavidSimulator** — Nouveau mode **2 contre 2** (réglage « Équipes » dans le salon) : deux équipes de deux, des bots complètent si vous êtes moins de 4.
  - Pas de loyer chez son coéquipier ; les cartes « chaque joueur » ne concernent que les adversaires.
  - Les coéquipiers s'échangent des terrains pour regrouper les couleurs (les bots le font d'eux-mêmes et dépannent un coéquipier à sec).
  - L'équipe au plus gros patrimoine cumulé gagne ; en Classique, la partie s'arrête quand une équipe a tout perdu.
  - Choix de l'équipe sur l'écran des pions, joueurs regroupés par équipe pendant la partie, écran de victoire d'équipe.
- **DavidSimulator** — Échanges plus clairs :
  - On ne propose un échange que pendant son tour (on peut répondre à tout moment) ; une proposition sans réponse expire à la fin du tour.
  - Les terrains concernés s'affichent sur le plateau (vert : tu reçois, rouge : tu donnes) et la caméra prend de la hauteur pour les montrer.
  - La proposition présente les titres en petites cartes et laisse le plateau visible à côté.
  - Échange conclu : les terrains qui changent de main sont signalés à tous les joueurs.
- **DavidSimulator** — La caméra qui suit ne se coupe plus : un simple clic sur le plateau ne la désactive plus, elle reste sur le pion jusqu'à la fin du tour, et si on a déplacé la vue, elle reprend au tour suivant.
- **DavidSimulator** — Dés vérifiés sur 123 000 lancers simulés : ils suivent exactement les probabilités d'une vraie paire de dés. Pour lever les doutes, le résultat (« 5 + 2 = 7 ») reste affiché jusqu'au tour suivant, et les dés 3D tombent devant le pion qui joue, face à la caméra.
- **DavidSimulator** — Pioches Chance et Caisse de communauté en vraies piles de cartes en 3D : la carte du dessus se soulève et se retourne quand on pioche.
- **Hub** — Le journal des nouveautés se tient à jour tout seul : si quelqu'un (ou une IA) pousse une modification sans la noter, une entrée est rédigée à partir de ses messages de commit.

## 2.14 — 21 octobre 2026
- Le journal des nouveautés est maintenant dans le Hub : bouton « ✨ Nouveautés » sur l'accueil (ou clic sur le numéro
  de version). Il s'ouvre tout seul à la première visite après une mise à jour.
- Duo Drift lancé depuis le Hub : garage, profil (succès, statistiques) et réglages accessibles depuis la salle d'attente.
  Une nouvelle voiture, déco ou couleur choisie au garage est transmise aux autres joueurs.
- Duo Drift se lance de nouveau : l'adresse du serveur relais était déclarée deux fois, ce qui bloquait tout le jeu.
- Plateau 3D de DavidSimulator moins surexposé : éclairage réglé par mesure, les couleurs du plateau gardent leur saturation.

## 2.13 — 21 octobre 2026
- Nouveau jeu : **Tête de Calcul**, duel de calcul mental jusqu'à 6 joueurs, avec bots (facile, normal, expert).
- 5 catégories : les 4 opérations, astuces (nombres équidistants, carrés en 5, ×11, pourcentages inversés),
  nombres (puissances, restes, racines), ordres de grandeur (km/h ↔ m/s, trajets, estimations) et Compte est bon.
- 3 modes : Classique, Péril (erreurs pénalisées), Éclair (seul le premier juste marque). Bonus de rapidité,
  de série et finale quitte ou double. L'astuce de chaque question s'affiche à la révélation.
- Les réponses restent chez l'hôte jusqu'à la révélation ; les questions sont tirées d'une graine, ce qui permet
  à un nouvel hôte de reprendre la partie après un départ.
- Classement entre potes : Tête de Calcul y a sa colonne.
- Banque de questions agrandie : 54 types de questions au lieu de 17, et jamais deux fois la même question dans une partie.
  - Calcul : chaînes d'opérations, nombre manquant (? × 7 = 56), moitié / double / quart / triple, priorités opératoires.
  - Astuces : × 5, × 25, × 9, × 99, × 1,5, carrés voisins d'un nombre rond (39²), compléments à 100 / 1 000, pourcentages par 10 %.
  - Nombres : cubes, PGCD, PPCM, factorielles, binaire, nombre premier suivant, nombre de diviseurs.
  - Nouvelle catégorie **Fractions** : fraction d'un nombre, décimaux connus (0,25 × 36), fraction → décimal, fraction → %, somme de fractions.
  - Nouvelle catégorie **Suite logique** : arithmétiques, géométriques, carrés et cubes, Fibonacci, écarts croissants, alternances, nombres premiers.
  - Ordres de grandeur : durées, unités (km, L, kg, m²…), soldes, règle de trois, moyennes, « +20 % puis −20 % ».
- Deux nouveaux thèmes dans le salon : Fractions & décimaux, Suites & logique. Les réponses décimales acceptent la virgule.
- **Sabotage** (règle maison, activée par défaut) : 3 bonnes réponses d'affilée rapportent un pouvoir à lancer sur un adversaire
  entre deux questions — 🌫️ Brouillard (question floue 5 s), ⏱️ Chrono volé (5 s de moins), 🙃 Tête à l'envers — ou un 🛡️ Bouclier
  qui bloque le prochain sabotage reçu. Les bots visent le meneur. La pause entre deux questions s'allonge quand quelqu'un peut saboter.
- 5 nouvelles catégories : **Vrai ou faux** et **Le plus grand** (réponse en un clic, ou touches 1 / 2, V / F), **Équations** (3x + 7 = 22),
  **Géométrie** avec une figure cotée (aires, périmètres, angles, Pythagore, volumes, polygones) et **Devinettes** (« Je suis pair, entre 40 et 50… »).
  Trois nouveaux thèmes : Vrai/faux & comparaisons, Équations & devinettes, Géométrie & mesures. 80 types de questions en tout.
- Animations : cartes qui tombent et se retournent, résultats en cascade, étincelles quand c'est juste, secousse quand c'est raté,
  tampon « verrouillé », bandeau du plus rapide, classement qui se réordonne en glissant, podium qui monte, pouvoirs qui volent d'un joueur à l'autre.
- Fin de partie : **récapitulatif des erreurs** (ta réponse, la bonne, et l'astuce), et colonne des sabotages envoyés et reçus.

## 2.12 — 19 octobre 2026
- DavidSimulator en vraie 3D (WebGL) : plateau en relief posé sur une table en bois, ombres, pions en métal modélisés
  en volume, maisons et hôtels en 3D, dés physiques qui roulent et tombent sur la bonne face.
- Caméra libre (clic-glisser pour tourner, molette pour zoomer, ⌖ pour recentrer) et caméra qui suit le pion :
  elle se place du côté du plateau où il se trouve, pour lire les noms de rues à l'endroit, comme autour d'une vraie table.
- Couleurs fidèles au plateau (rendu « neutre »), vue de dessus toujours disponible (bouton 3D/2D).
- Le plateau classique reste disponible (bouton 🧊) et sert de secours si WebGL manque ; il est utilisé par défaut
  sur les écrans tactiles, plus légers.

## 2.11 — 19 octobre 2026
- Musique lo-fi aussi dans l'accueil et le salon du Hub (bouton 🎵 et volume en bas à gauche, réglages partagés
  avec DavidSimulator). Elle s'efface quand un jeu démarre, chaque jeu ayant sa propre musique.
- Réactions dans DavidSimulator (bouton 😀 ou touche R) : 8 émotes et 8 phrases (« Nissa la bella ! », « T'es fada ! »…),
  en bulle à côté du joueur et au-dessus de son pion. Les bots réagissent aussi de temps en temps.
- Classement entre potes (🏆, accueil et salon) : victoires, parties, % de victoires, podiums, meilleur score,
  par jeu ou tous jeux confondus, et dernières parties. Chaque joueur est reconnu par un identifiant permanent ;
  les historiques sont fusionnés quand on se retrouve dans un salon, pour que tout le monde voie le même classement.

## 2.10 — 19 octobre 2026
- Multijoueur sur les wifi publics (université, hôtel, gare) : quand la connexion directe est bloquée,
  le jeu passe automatiquement par un relais sur les ports 80 et 443 (TLS compris), comme une page web.
- Message clair quand le réseau bloque la connexion, au lieu de « Pas de réponse ».
- Nouveau bouton « Tester ma connexion » sur l'accueil : il indique ce que le réseau laisse passer
  (mise en relation, connexion directe, relais 3478, 80, 443, TLS) et fait un essai réel par le relais.
- Duo Drift joué seul (hors Hub) profite des mêmes relais.

## 2.9 — 19 octobre 2026
- Trois niveaux de bots, à choisir dans le salon :
  - Facile : achète à moitié au hasard, construit peu, ne propose jamais d'échange ;
  - Normal : le bot habituel ;
  - Expert : juge la valeur stratégique des terrains (compléter ou bloquer un monopole), garde une réserve adaptée
    aux loyers qui le menacent, construit là où le modèle de Markov promet le meilleur rendement, propose des échanges
    (sans harceler : 3 essais au plus, espacés) et reste en prison quand le plateau devient dangereux.
- Sur 180 parties de test, l'expert gagne environ deux parties sur trois face aux bots normaux.
- Correctif : une proposition d'échange devenue impossible (argent dépensé, terrain bâti…) est retirée automatiquement ;
  elle pouvait bloquer la partie.
- Correctif : une proposition d'échange reçue ne se referme plus toute seule à l'action suivante.

## 2.8 — 19 octobre 2026
- Si l'hôte quitte ou perd la connexion, le salon continue : le joueur suivant devient hôte en une seconde environ,
  sous un nouveau code, et les autres s'y reconnectent automatiquement en gardant leur place.
- DavidSimulator continue la partie en cours avec le nouvel hôte, sans rechargement.
- Un joueur déconnecté depuis 20 secondes est remplacé par un bot ; il reprend la main s'il revient.
- Duo Drift : une course ne peut pas changer d'hôte, tout le monde revient proprement au salon pour relancer.

## 2.7 — 19 octobre 2026
- Sauvegarde automatique des parties de DavidSimulator chez l'hôte, après chaque action (6 parties gardées).
- Reprise depuis l'écran de choix des pions : l'hôte choisit une sauvegarde, chacun retrouve son pion, son argent
  et ses propriétés. Les places sont attribuées par nom ; un joueur absent est joué par un bot.
- Le chrono Express repart là où il s'était arrêté.

## 2.6 — 18 octobre 2026
- Règles maison pour DavidSimulator, à régler dans le salon avant de lancer :
  argent de départ (1 000 à 2 500 €), cagnotte au Parc gratuit (taxes, amendes et cartes s'y accumulent),
  salaire doublé en tombant pile sur Départ, enchères désactivables.
- Les règles choisies s'affichent avant la partie ; la cagnotte est visible sur la case Parc gratuit.

## 2.5 — 18 octobre 2026
- Trois ambiances musicales qui s'enchaînent selon la partie : calme ; tendue (dette, joueur presque à sec,
  dernières 5 minutes en Express) ; enchères, façon jeu télévisé. Les changements se font en fin de mesure.
- Petite fanfare de victoire en fin de partie.

## 2.4 — 18 octobre 2026
- Musique d'ambiance « lo-fi » dans DavidSimulator, générée en direct (aucun fichier, libre de droits) :
  piano électrique, basse ronde, batterie feutrée, petites mélodies ; les accords changent toutes les 8 mesures.
- Bouton 🎵 pour la couper, curseur de volume au survol, réglages mémorisés.
- La musique s'efface pendant les enchères et en fin de partie.

## 2.3 — 18 octobre 2026
- DavidSimulator prend le look d'un vrai jeu de société : plateau posé sur une table en bois, avec son épaisseur,
  centre vert classique, logo en diagonale, paquets de cartes en pointillés, coins à 45°.
- Choix du pion avant chaque partie : 10 pions façon figurines en métal (voiture, chapeau, chien, pointu, botte,
  dé à coudre, chat, canard, chaise bleue, palmier). Un pion ne peut être pris qu'une fois ; ton favori est mémorisé.
- Les pions tombent sur la case Départ au début de la partie.
- Titres de propriété dans le style d'origine (loyers avec pointillés, prix des maisons, valeur hypothécaire).
- Cartes Chance et Caisse de communauté redessinées.
- Billets de couleur qui volent à chaque paiement ; le titre de propriété file vers l'acheteur.
- Maisons et hôtels en volume.
- Clic sur les cases fiable en vue 3D : la case visée est calculée à partir de la projection du plateau.

## 2.2 — 18 octobre 2026
- Tableau de bord en direct : rang, liquide, valeur immobilière, monopoles, patrimoine net et mini-courbe pour chaque joueur.
- Écran « Statistiques » (bouton 📊, en direct et en fin de partie) :
  - courbe du patrimoine net ou du liquide tour par tour, avec infobulle au survol ;
  - heatmap du plateau (visites, loyers perçus, probabilité théorique), affichable sur le plateau 3D ;
  - classement détaillé et triable : loyers perçus et payés, distance, tours en prison, doubles, achats…
  - analyse financière : probabilité d'arrivée (chaîne de Markov), revenu espéré, rendement, délai de rentabilité
    et meilleur prochain investissement.
- L'historique de partie reste léger même dans les très longues parties.

## 2.1 — 18 octobre 2026
- DavidSimulator a son vrai plateau : vue 3D inclinée (ou vue de dessus), coins illustrés, centre aux couleurs de Nice.
- Dés en 3D qui roulent et rebondissent, pions qui sautent de case en case, caméra qui suit le joueur.
- Effets : pièces qui volent lors des paiements, tampons « VENDU » et « ADJUGÉ », maisons et hôtels qui tombent du ciel,
  cartes Chance et Caisse de communauté qui se retournent, confettis et podium en fin de partie.
- Titres de propriété complets, fenêtres d'achat, d'enchère (avec compte à rebours), d'échange et « Mes biens ».
- Sons synthétisés (coupables), raccourci Espace pour lancer les dés ou finir son tour, affichage adapté au téléphone.
- Les bots attendent la fin des animations avant de jouer.

## 2.0 — 18 octobre 2026
- Nouveau **Game Hub** : un seul salon entre potes (jusqu'à 6), avec pseudo, couleur, chat et lien d'invitation, pour choisir le jeu.
- Le salon reste ouvert d'un jeu à l'autre : pas besoin de se reconnecter pour changer de jeu.
- Duo Drift déplacé dans `drift/`, inchangé en jeu ; « Quitter » ramène au salon du Hub.
- **DavidSimulator** (Monopoly édition Nice) : moteur de règles complet — achats, enchères, échanges, maisons et hôtels,
  hypothèques, prison, doublés, cartes Chance et Caisse de communauté, dettes et faillite.
- Mode **Express** : 3 propriétés offertes, hôtel dès 3 maisons, prison limitée à 2 tours, chrono de 40 minutes.
- Bots pour compléter la table ou jouer seul.
- Interface provisoire jouable ; le plateau animé arrive à l'étape suivante.

## 1.1 — 18 octobre 2026
- Nouveau salon en 3 étapes : Mode, Circuit, Réglages. Les options rares sont rangées dans « Plus d'options ».
- Bots plus rapides dans les virages, et ils ne se laissent plus distancer par les humains.
- Éclair et bombe beaucoup plus rares en course (et jamais deux éclairs à moins de 20 s).
- Grand Prix : le podium n'arrive qu'à la fin de la dernière manche.
- Numéro de version et journal des nouveautés dans le jeu.

## 1.0 — 18 octobre 2026
- Jeu en ligne à jusqu'à 5 joueurs (peer-to-peer), bots, chat, émotes, manette.
- Modes Course, Grand Prix, Élimination, Bataille, Patate chaude, Roi de la colline, Foot en voiture.
- 11 circuits dont 5 grandes villes (Paris, Nice, Milan, New York, Tokyo), tremplins et raccourcis.
- Mutateurs : Nitro infini, Vitesse ×1,3, Patinoire, Objets en folie, Voitures fantômes.
- Progression : niveaux, pièces, garage à débloquer, défis du jour, succès, médailles, fantômes, rivalités.
- Replay au ralenti, photo-finish, podium animé et finale du Grand Prix.
