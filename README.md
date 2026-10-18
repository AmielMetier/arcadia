# Game Hub — Duo Drift et DavidSimulator

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
Mêmes prix, loyers et règles que l'original, en mode **Classique** ou **Express** (40 minutes).
Plateau 3D façon jeu de société, choix du pion parmi 10 figurines, statistiques en direct (courbe du patrimoine, heatmap, classement) et analyse financière des propriétés.

## Pour les développeurs
- Site statique (GitHub Pages), sans étape de build.
- `?local` dans l'adresse : réseau simulé entre onglets du même navigateur, pratique pour tester à plusieurs.
- `node tools/check-board.mjs` vérifie le plateau ; `node tools/test-rules.mjs` teste le moteur de DavidSimulator.
- Architecture : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Version actuelle : **2.8** — voir le [journal des versions](CHANGELOG.md).

by Amiel and Claude
