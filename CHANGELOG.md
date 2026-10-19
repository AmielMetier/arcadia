# Journal des versions — Game Hub (Duo Drift, DavidSimulator)

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
