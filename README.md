# Game Hub — Duo Drift, DavidSimulator, Bastion Clash, Tête de Calcul et Kart Rush GP

Des jeux en ligne entre potes, directement dans le navigateur, sans rien installer. On crée un salon,
on partage le code, et l'hôte choisit le jeu. Le salon reste ouvert d'un jeu à l'autre.

**Jouer : https://amielmetier.github.io/duo-drift/**

## Duo Drift
Course et bataille en vue de dessus, jusqu'à 5 joueurs.

- **Modes** : Course, Grand Prix, Élimination, Bataille, Patate chaude, Roi de la colline, Foot en voiture, équipes
- **Mutateurs** : Nitro infini, Vitesse ×1,3, Patinoire, Objets en folie, Voitures fantômes
- **11 circuits**, dont 5 grandes villes (Paris, Nice, Milan, New York, Tokyo), avec tremplins et raccourcis
- **Progression** : niveaux, pièces, garage à débloquer, défis du jour, succès, médailles contre-la-montre, fantômes à partager, rivalités
- **Fin de course** : replay au ralenti, photo-finish, podium animé, finale du Grand Prix
- Clavier ou manette, bots, chat, émotes

## DavidSimulator
Le Monopoly classique transposé à Nice, de Saint-Roch à la Promenade des Anglais, jusqu'à 6 joueurs (bots possibles).
Mêmes prix, loyers et règles que l'original, en mode **Classique** ou **Express** (40 minutes), chacun pour soi ou en **2 contre 2**.
Plateau 3D façon jeu de société, choix du pion parmi 10 figurines, statistiques en direct (courbe du patrimoine, heatmap, classement) et analyse financière des propriétés.

## Tête de Calcul
Duel de calcul mental jusqu'à 6 joueurs (bots possibles) : tout le monde voit la même question et répond en même temps.
12 catégories et 80 types de questions : les 4 opérations, les astuces qui font passer pour un génie (47 × 53, 75², 43 × 11, 16 % de 50),
nombres (puissances, PGCD, binaire, premiers), fractions, suites logiques, vrai ou faux, le plus grand, équations, géométrie avec figure,
devinettes, ordres de grandeur, et le **Compte est bon** (atteindre une cible avec 4 nombres).

- **Modes** : Classique (le plus rapide marque plus), Péril (une erreur coûte des points), Éclair (seul le premier juste marque)
- **Bonus** : premier juste +50, série de bonnes réponses 🔥, dernière question quitte ou double
- **Sabotage** : une série de 3 rapporte un pouvoir (brouillard, chrono volé, tête à l'envers, bouclier) à lancer sur un adversaire
- Après chaque question, l'astuce qui permettait d'aller vite ; à la fin, podium, statistiques et récapitulatif de tes erreurs avec leurs astuces

## Kart Rush GP
Course de karts en 3D (Three.js), seul ou jusqu'à 6 joueurs, complétée par des IA jusqu'à 8 pilotes.

- **3 circuits** : Grand Circuit (stade, cascades, tunnel), Whisky Peak (montagne enneigée, boules de neige, télésiège), Route Arc-en-ciel (espace)
- **Drift** à la touche Maj : 1 s = mini-turbo, deux fois plus rapide en alternant Q et D ; figures sur les tremplins
- **16 objets** dans les cubes irisés, 8 pilotes originaux, 4 karts
- L'hôte choisit le circuit dans le jeu, chacun son pilote ; musiques par circuit dans `kart/music/` (voir `kart/music/LISEZMOI.md`)

## Pour les développeurs
- Site statique (GitHub Pages), sans étape de build.
- `?local` dans l'adresse : réseau simulé entre onglets du même navigateur, pratique pour tester à plusieurs.
- `node tools/check-board.mjs` vérifie le plateau ; `node tools/test-rules.mjs` teste le moteur de DavidSimulator ;
  `node tools/bot-arena.mjs 100 expert,normal,normal,facile` fait s'affronter les niveaux de bots ;
  `node tools/test-calcul.mjs` teste le moteur de Tête de Calcul.
- Ajouter un jeu : [docs/NOUVEAU-JEU.md](docs/NOUVEAU-JEU.md).
- Architecture : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Journal des versions : chaque modification visible par les joueurs monte `VERSION` dans `hub/hub.js` et ajoute une entrée
  en haut de `CHANGELOG.md` (consignes pour les assistants de code dans [AGENTS.md](AGENTS.md)). Si un push l'oublie,
  l'action `.github/workflows/changelog.yml` rédige l'entrée à partir des commits.

Version actuelle : **2.16** — voir le [journal des versions](CHANGELOG.md).

by Amiel and Claude
