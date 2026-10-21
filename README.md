# Game Hub — Duo Drift, DavidSimulator, Bastion Clash et Tête de Calcul

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

## Tête de Calcul
Duel de calcul mental jusqu'à 6 joueurs (bots possibles) : tout le monde voit la même question et répond en même temps.
7 catégories et 54 types de questions : les 4 opérations, les astuces qui font passer pour un génie (47 × 53, 75², 43 × 11, 16 % de 50),
nombres (puissances, PGCD, binaire, premiers), fractions et décimaux, suites logiques, conversions et ordres de grandeur,
et le **Compte est bon** (atteindre une cible avec 4 nombres).

- **Modes** : Classique (le plus rapide marque plus), Péril (une erreur coûte des points), Éclair (seul le premier juste marque)
- **Bonus** : premier juste +50, série de bonnes réponses 🔥, dernière question quitte ou double
- Après chaque question, l'astuce qui permettait d'aller vite ; à la fin, podium et statistiques (série, réponse la plus rapide, catégories)

## Pour les développeurs
- Site statique (GitHub Pages), sans étape de build.
- `?local` dans l'adresse : réseau simulé entre onglets du même navigateur, pratique pour tester à plusieurs.
- `node tools/check-board.mjs` vérifie le plateau ; `node tools/test-rules.mjs` teste le moteur de DavidSimulator ;
  `node tools/bot-arena.mjs 100 expert,normal,normal,facile` fait s'affronter les niveaux de bots ;
  `node tools/test-calcul.mjs` teste le moteur de Tête de Calcul.
- Ajouter un jeu : [docs/NOUVEAU-JEU.md](docs/NOUVEAU-JEU.md).
- Architecture : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Version actuelle : **2.13** — voir le [journal des versions](CHANGELOG.md).

by Amiel and Claude
