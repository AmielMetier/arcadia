# Consignes pour les assistants de code (Claude, Codex, Copilot, Cursor, Gemini…) et les contributeurs

Ce dépôt est **Arcadia** (anciennement « Game Hub »), le salon de jeux d'Amiel : un site statique (GitHub Pages, sans étape de build) qui réunit plusieurs
jeux multijoueurs dans le navigateur — Duo Drift, DavidSimulator, Tête de Calcul, Bastion Clash, Outbreak, Fil Rouge, Cyber Kart GP, Convoy Storm, Birdie Party, Mini-Golf Party, Island Rush, Odyssée.

## À chaque modification poussée sur `main` : journal + version

Les joueurs voient les nouveautés dans le Hub (bouton « ✨ Nouveautés »), qui lit `CHANGELOG.md`.
**Toute modification visible par les joueurs doit donc :**

1. **Monter la version** dans `hub/hub.js` : `const VERSION = '3.0';` → `'3.1'` (le Hub est en 3.x depuis le 27 octobre 2026,
   +1 sur le second nombre).
2. **Ajouter une entrée en haut de `CHANGELOG.md`**, juste sous le titre, au format :

   ```markdown
   ## 3.1 — 28 octobre 2026
   - **Nom du jeu** — ce qui change, écrit pour les joueurs (pas pour les développeurs).
     - détail éventuel (sous-liste indentée de deux espaces)
   ```

   - En français, phrases courtes, du point de vue du joueur (« Les échanges se proposent pendant son tour »),
     pas de noms de fichiers ni de fonctions.
   - Une ligne par nouveauté ou correction ; regrouper ce qui concerne le même jeu.
   - La date est celle du jour, en toutes lettres (`28 octobre 2026`).
3. **Faire les deux dans le même commit** que le changement (ou le même push).

Filet de sécurité : si un push sur `main` ne touche pas `CHANGELOG.md`, l'action GitHub
`.github/workflows/changelog.yml` rédige elle-même une entrée à partir des messages de commit
(`tools/changelog-auto.mjs`) et monte la version. Elle est moins bien écrite qu'une entrée faite à la main :
préférer l'écrire soi-même. Pour qu'elle soit lisible, écrire des messages de commit clairs, par exemple
`feat(calcul): mode Éclair` ou `fix(david): la caméra qui suit ne se désactive plus`
(portées reconnues : `drift`, `david`, `calcul`, `bastion`, `outbreak`, `filrouge`, `kart`, `convoy`, `golf`, `minigolf`, `royale`, `odyssee`, `hub`, `server`).
Ajouter `[skip changelog]` dans le message d'un commit purement technique pour qu'il n'apparaisse pas.

## Repères

- Chaque jeu vit dans son dossier (`drift/`, `david/`, `calcul/`, `bastion/`, `outbreak/`, `filrouge/`, `kart/`, `convoy/`, `golf/`, `minigolf/`, `royale/`, `odyssee/`) et tourne dans une iframe du Hub ;
  le Hub (`index.html`, `hub/`) gère le salon, le classement entre potes et le pont `shared/bridge.js`.
- Multijoueur : relais WebSocket (`shared/net.js`, serveur dans `server/`). `?local` dans l'adresse simule le réseau
  entre onglets du même navigateur pour tester à plusieurs.
- Registre des jeux et de leurs réglages : `hub/games.js` ; fiche de chaque jeu (catégorie, durée, commandes, astuces) dans `HUB_GAME_INFO`, au même endroit : à remplir pour tout nouveau jeu.
- Accueil : `hub/home.js` (vitrine, filtres, étiquettes tirées du journal). Autour du jeu : `hub/ingame.js` (écran de chargement commun, menu Arcadia).
  L'écran de chargement s'en va quand le pont envoie « shown » : automatique dès que le jeu est prêt et que `#loading`, `#app.loading` ou `#load`
  ont disparu ; un jeu peut l'annoncer lui-même avec `HubBridge.shown()`. Sons d'interface : `shared/uisfx.js` (Kenney, CC0, `assets/sfx/`). Ajouter un jeu : `docs/NOUVEAU-JEU.md`.
- Tests à lancer avant de pousser quand on touche à DavidSimulator, Tête de Calcul, Fil Rouge, Outbreak, Convoy Storm ou Birdie Party :
  `node tools/test-rules.mjs`, `node tools/check-board.mjs`, `node tools/test-calcul.mjs`, `node tools/test-filrouge.mjs`,
  `node tools/test-outbreak.mjs`, `node tools/test-convoy.mjs`, `node tools/test-golf.mjs`.
- Poké Duel, tournoi (`pokemon/engine/tournament.js`, `pokemon/net/`) : `node tools/test-pokemon-tournament.mjs` (draft, tableau, exemptions,
  forfaits, finale en 2 manches) et `node tools/test-pokemon-net.mjs` (tournoi joué en réseau simulé, départ d'un joueur, départ de l'hôte).
- Odyssée (`odyssee/`) : jeu à plusieurs par le Hub (`odyssee/js/net/` : positions, invitations, échanges, combats entre joueurs calculés
  à l'identique des deux côtés avec une graine commune, `odyssee/js/core/pvp.js`) et code de sauvegarde (`odyssee/js/core/savecode.js`) :
  `node tools/test-odyssee-link.mjs`, à lancer quand on touche au moteur de combat d'Odyssée (`odyssee/js/core/battle.js`).
- Mini-Golf Party : `node tools/test-minigolf.mjs` construit les 54 trous et vérifie qu'un bot expert les termine (à lancer quand on touche aux trous ou à la physique).
  `node tools/fuzz-minigolf.mjs [coups par trou]` tire au hasard sur chaque trou et compte les balles qui traversent un mur ou restent suspendues (doit afficher 0 et 0).
  Textures photo : celles de `kart/tex/` (Poly Haven, CC0), chargées par `dressPhoto` dans `minigolf/js/textures.js`.
- Odyssée (aventure solo façon DS, `odyssee/`) : `node tools/test-odyssee.mjs` joue 600 combats aléatoires et vérifie que toute la région
  (portes, grottes, PNJ, objets, arènes) est accessible depuis Bourg-Aube sans qu'un PNJ ne bloque le passage : à lancer quand on touche
  au moteur (`odyssee/js/core/`) ou à la carte (`odyssee/js/world/`). Les données des Pokémon (`odyssee/js/data/`) sont générées par
  `tools/odyssee-donnees.mjs` à partir des tables de PokeAPI ; les sprites sont chargés depuis PokeAPI (`odyssee/js/assets.js`) : ce sont des remplaçants.
  Histoire (Team Éclipse, Lugia Obscur, Conseil 4, CS et recoins cachés, quêtes) : posée sur la carte par `odyssee/js/world/story.js`,
  jouée par `odyssee/js/story.js`. `node tools/test-odyssee-story.mjs` refait toute l'aventure étape par étape (badges, CS, drapeaux)
  et vérifie qu'on ne peut pas sauter une étape ni se faufiler à côté d'un garde : à lancer quand on touche à la carte ou à l'histoire.
- Sauvegardes en ligne (`server/saves.js`, client `odyssee/js/net/cloud.js`) : le relais range les parties dans le dépôt GitHub,
  branche `saves`, sous le code ami du compte Hub. Mise en route sur Render : `docs/SAUVEGARDES.md`. Test : `node tools/test-saves.mjs`.
- Island Rush (battle royale, `royale/`) : l'île vient d'une graine (`royale/engine/map.js`, île officielle `ILE`), `royale/carte.html`
  la montre en 2D. `node tools/test-royale.mjs` vérifie l'île sur plusieurs graines, le déplacement (portes, escaliers, murs, nage),
  une partie (butin, combat, construction), les copies des invités et le relais d'hôte, la prédiction : à lancer quand on touche
  au moteur (`royale/engine/`). `node tools/bench-royale.mjs [joueurs] [niveau] [graine] [minutes]` fait jouer une partie entière
  entre bots (`WATCH=bot3` suit un bot) : coût d'un pas, éliminations, bots coincés, durée de la partie.
  Parties jouées : l'hôte tient un journal local (`royale/journal.js`), lu par `royale/stats.html` ; guide des soirées de
  test dans `docs/ISLAND-RUSH-TESTS.md`.
- Réseau (`shared/net.js`, `shared/room.js`, `server/`) : `node tools/test-relay.mjs` et `node tools/test-net.mjs`
  (prérequis : `cd server && npm install`). Le serveur relais doit être redéployé quand `server/server.js` change.
- Bastion Clash : le moteur (`bastion/engine/`, sans DOM) est testé par `node tools/test-bastion.mjs` ;
  `node tools/bench-bastion.mjs [minutes] [graine] [mode] [carte]` fait jouer 4 bots hors navigateur et mesure
  le coût d'un pas de simulation (doit rester sous 33 ms), les éliminations, les cibles des bots et les unités bloquées.
- Commits : auteur et messages en français, un message qui décrit ce que le joueur gagne.
