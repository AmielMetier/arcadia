# Game Hub — architecture (étape 1)

Ce document décrit comment transformer Duo Drift en **Game Hub** accueillant deux jeux :
**Duo Drift** (course) et **DavidSimulator** (Monopoly édition Nice).

## Ce qui existe aujourd'hui

- Un seul fichier `index.html` (≈ 438 Ko) : HTML, CSS, PeerJS 1.5.5 embarqué et tout le jeu.
- Réseau **en étoile** : l'hôte crée un identifiant PeerJS `duodrift-v3-<CODE>` (code de 4 lettres),
  les invités s'y connectent, l'hôte fait autorité et relaie les messages.
- Objet `Net` avec une API simple : `host(cb)`, `join(code, cb)`, `toHost(m)`, `to(cid, m)`, `bcast(m)`, `close()`.
  Mode `?local` qui remplace WebRTC par un `BroadcastChannel` pour tester entre onglets.
- Protocole de salon : `hello` → `welcome` → `lobby` (liste des joueurs + réglages), `ev` (chat, émotes…), `ping/pong`, `bye`.
- Profil en `localStorage` : pseudo, couleur, niveau, titre.
- Site 100 % statique publié par GitHub Pages, sans étape de build.

## Le choix structurant : un salon qui survit au changement de jeu

Si chaque jeu est une page séparée, passer du Hub au jeu recharge la page et **coupe la connexion
WebRTC** : tout le monde devrait se reconnecter. Deux solutions ont été comparées :

| | Coquille + iframe (retenue) | Pages séparées + reconnexion auto |
|---|---|---|
| Connexion pendant le changement de jeu | conservée | coupée puis rétablie (1 à 3 s, échecs possibles) |
| Modifs dans Duo Drift | remplacer `Net` par un pont de même API | réutiliser le même code de salon, gérer l'ID PeerJS encore occupé |
| Isolation entre jeux | totale (chaque jeu dans son iframe) | totale |
| Jeu jouable seul via son URL | oui | oui |

**Solution retenue** : le Hub est une **coquille** qui détient la connexion et le salon. Le jeu choisi
est chargé dans une **iframe plein écran** de la même origine et parle au Hub par `postMessage`
au travers de `shared/bridge.js`, qui expose **exactement la même API que `Net`**. Duo Drift n'a donc
presque rien à changer : s'il est lancé depuis le Hub il utilise le pont, sinon il garde `Net` en direct.

```
┌──────────────────────── index.html (Hub) ────────────────────────┐
│ profil · salon commun · chat · choix du jeu                      │
│ shared/net.js ⇄ PeerJS ⇄ amis                                    │
│        ▲ postMessage                                             │
│ ┌──────┴────────────── iframe ─────────────────────────────────┐ │
│ │ drift/index.html   ou   david/index.html                     │ │
│ │ shared/bridge.js  (même API que Net)                         │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Arborescence cible

```
duo-drift/                         → https://amielmetier.github.io/duo-drift/
├── index.html                     Hub : accueil, profil, salon, choix du jeu, iframe du jeu
├── hub/
│   ├── hub.css                    habillage du Hub (thème commun aux deux jeux)
│   ├── hub.js                     écrans du Hub, lancement / retour de jeu
│   └── games.js                   registre : id, titre, vignette, joueurs min/max, URL
├── shared/
│   ├── vendor/peerjs.min.js       PeerJS sorti d'index.html (une seule copie)
│   ├── net.js                     Net extrait de Duo Drift ; préfixe d'ID paramétrable
│   ├── room.js                    salon générique : joueurs, pseudos, couleurs, chat, pings, hôte
│   ├── bridge.js                  pont Hub ⇄ jeu (postMessage), même API que Net
│   └── profile.js                 pseudo et couleur (clés localStorage communes avec Duo Drift)
├── drift/
│   └── index.html                 Duo Drift actuel déplacé ; Net → bridge s'il est dans le Hub
├── david/
│   ├── index.html                 DavidSimulator
│   ├── app.js                     démarrage : rôle (hôte, invité, solo), session, vue
│   ├── data/
│   │   └── board-nice.json        40 cases, groupes, règles, modes, 32 cartes   ← étape 1
│   ├── engine/                    moteur pur, sans DOM, testable sous Node      ← étape 2
│   │   ├── rules.js               reduce(state, action) → { state, events }
│   │   ├── modes.js               Classique / Express
│   │   ├── rng.js                 aléa reproductible (graine) : dés, mélange des cartes
│   │   ├── valuation.js           patrimoine net, monopoles, classement
│   │   ├── markov.js              probabilités d'arrivée (chaîne de Markov), rendement des propriétés
│   │   ├── bot.js                 joueur automatique
│   │   └── resume.js              reprise : renumérotation des joueurs, décalage du chrono
│   ├── net/
│   │   ├── host.js                l'hôte valide les intentions, lance les dés, diffuse
│   │   ├── client.js              envoie les intentions, rejoue les événements
│   │   └── saves.js               sauvegardes locales chez l'hôte
│   ├── view/                                                                    ← étape 3
│   │   ├── game.js                interface de jeu + « réalisateur » qui met en scène les événements
│   │   ├── board.js               plateau incliné en CSS 3D, pions, bâtiments, caméra qui suit le pion
│   │   ├── geometry.js            position des cases, des pions et des bâtiments (repère 880 × 880)
│   │   ├── dice.js                dés 3D (la face finale correspond au tirage du moteur)
│   │   ├── fx.js                  pièces, montants flottants, bandeaux, tampons, cartes, confettis
│   │   ├── modals.js              titre de propriété, achat, enchère, échange, mes biens, fin de partie
│   │   ├── sfx.js                 sons synthétisés (WebAudio), sans fichier
│   │   ├── music.js               musique lo-fi générée (séquenceur WebAudio, rendu hors ligne pour les tests)
│   │   ├── tokens.js              10 pions en métal (SVG) avec socle à la couleur du joueur
│   │   ├── setup.js               salle d'avant-partie : choix des pions, lancement par l'hôte
│   │   ├── icons.js, util.js      icônes SVG et petits outils
│   │   └── stats.js               statistiques : courbe, heatmap, classement, analyse financière (étape 4)
│   └── assets/                    sons, textures
├── tools/
│   ├── check-board.mjs            contrôle de fidélité du plateau (étape 1)
│   └── test-rules.mjs             tests du moteur (étape 2)
└── docs/ARCHITECTURE.md
```

URL : la racine devient le Hub. Duo Drift reste accessible directement via `/duo-drift/drift/`,
et `?local` est transmis du Hub au jeu pour les tests entre onglets.

## Salon commun

- Capacité du salon : **6** joueurs. Duo Drift reste limité à 5 : le Hub grise son lancement au-delà.
- Le salon (pseudos, couleurs, chat, pings) appartient au Hub. Les réglages propres à chaque jeu
  (circuit, mode Express…) sont gérés par le jeu et envoyés dans le même canal.
- Messages ajoutés au protocole existant :
  - `launch` `{ game, settings }` : l'hôte lance un jeu, tous les Hub chargent l'iframe correspondante ;
  - `back` : retour au salon pour tout le monde ;
  - `g` `{ game, m }` : enveloppe des messages propres à un jeu (le Hub les transmet sans les lire).

## DavidSimulator : principes du moteur

- **L'hôte fait autorité** (comme dans Duo Drift). Les invités envoient des *intentions*
  (`ROLL`, `BUY`, `BID`, `PROPOSE_TRADE`, `BUILD`, `MORTGAGE`, `PAY_BAIL`, `END_TURN`…).
  L'hôte les valide, tire les dés et diffuse des **événements** (`DICE`, `MOVE`, `PAY`, `BUY`,
  `CARD`, `BUILD`, `JAIL`, `BANKRUPT`…) que chaque client anime dans l'ordre.
- Le moteur est une **fonction pure** `reduce(state, action, board)` : la même logique tourne chez
  l'hôte, dans les tests et dans les bots. L'aléa (dés, paquets de cartes) vient d'une graine stockée
  dans l'état, si bien qu'une partie est rejouable à l'identique.
- La phase de jeu (`roll`, `buy`, `auction`, `debt`, `end`, `over`) est recalculée à partir de l'état
  après chaque action, plutôt que maintenue à la main.
- Les paiements impossibles deviennent des **dettes** traitées dans l'ordre : le débiteur vend,
  hypothèque ou échange, la dette se règle dès qu'il a la somme, sinon il déclare faillite.
- L'état complet tient en quelques Ko : il est envoyé après chaque action, avec les événements.
  Il est aussi sauvegardé chez l'hôte (`localStorage`), base de la future reprise de partie.
- Les statistiques (cases visitées, loyers perçus et payés par case, distance, tours en prison,
  patrimoine à chaque tour) sont tenues dans l'état par le moteur.

### Limites connues (étape 2)
- Si l'hôte quitte le salon, la partie s'arrête ; elle reste sauvegardée chez lui et peut être reprise.
- Un joueur qui revient au salon en cours de partie garde sa place et peut revenir ; s'il quitte le salon,
  ses biens retournent à la banque.
- Faillite envers la banque : les terrains redeviennent libres, sans enchère.
- Vente d'un hôtel quand la banque manque de maisons : refusée (il faut d'abord hypothéquer ailleurs).

## Plateau de Nice — `david/data/board-nice.json`

Les valeurs sont celles du Monopoly classique (édition en euros) : 40 cases, mêmes prix, loyers,
coûts de construction, hypothèques, taxes et 16 + 16 cartes aux effets identiques. Seuls les noms et
les textes sont niçois. `node tools/check-board.mjs` compare le fichier à la référence officielle.

| Groupe | Quartier | Cases (prix) |
|---|---|---|
| Marron | Quartiers Nord & Saint-Roch | Boulevard de l'Ariane (60), Boulevard Pierre Sola (60) |
| Bleu ciel | Libération & République | Avenue de la République (100), Avenue Malausséna (100), Place Charles de Gaulle (120) |
| Rose | Les Musiciens | Boulevard Gambetta (140), Rue Rossini (140), Rue de la Buffa (160) |
| Orange | Port Lympia | Quai Lunel (180), Quai Cassini (180), Place Île-de-Beauté (200) |
| Rouge | Vieux-Nice | Rue Pairolière (220), Place Rossetti (220), Cours Saleya (240) |
| Jaune | Centre-ville | Boulevard Victor Hugo (260), Avenue Jean Médecin (260), Place Masséna (280) |
| Vert | Cimiez | Boulevard de Cimiez (300), Avenue des Arènes de Cimiez (300), Place du Monastère (320) |
| Bleu foncé | Mont Boron & Promenade | Boulevard du Mont-Boron (350), Promenade des Anglais (400) |
| Transports | — | Gare Riquier (5), Tramway Ligne 1 (15), Gare Thiers (25), Aéroport Nice Côte d'Azur (35) |
| Compagnies | — | Eau d'Azur (12), Régie Lignes d'Azur (28) |

L'aéroport est placé en case 35, juste avant la Promenade des Anglais, comme dans la réalité.

### Format d'une case

```json
{ "i": 39, "type": "street", "name": "Promenade des Anglais", "district": "Baie des Anges",
  "group": "darkblue", "color": "#1C5FB4", "price": 400, "mortgage": 200, "houseCost": 200,
  "rent": [50, 200, 600, 1400, 1700, 2000] }
```

`rent` = [terrain nu, 1 maison, 2, 3, 4, hôtel]. Le loyer nu est doublé quand le groupe entier
appartient au même joueur et qu'aucun terrain n'est hypothéqué. Un hôtel coûte `houseCost`
(les maisons sont rendues à la banque). Gares : `rent` selon le nombre possédé (1 à 4).
Compagnies : 4 × ou 10 × les dés selon qu'on en possède 1 ou 2.

### Mode Express

| Paramètre | Valeur |
|---|---|
| Propriétés offertes au départ | 3 par joueur, tirées au hasard, sans former de groupe complet |
| Maisons pour un hôtel | 3 (on paie l'hôtel après 3 maisons ; le loyer « hôtel » s'applique) |
| Prison | 2 tours maximum |
| Fin | première faillite **ou** fin du chrono de 40 min |
| Vainqueur | patrimoine le plus élevé : argent + prix des terrains (moitié si hypothéqués) + coût des bâtiments |

Le calcul du patrimoine reprend celui de la variante « partie courte » des règles officielles.

## Mise en scène (étape 3)

Chaque mise à jour reçue de l'hôte contient l'état complet et la liste des événements qui y ont mené.
La vue joue ces événements dans l'ordre (dés, déplacement case par case, paiement, achat, carte…)
puis applique l'état final, qui fait foi. Si plusieurs mises à jour s'accumulent (bots rapides,
reconnexion), la lecture accélère jusqu'à devenir instantanée. Pendant la lecture, les boutons
d'action sont neutralisés, sauf ceux des enchères. L'hôte estime la durée de la mise en scène
pour faire patienter les bots d'autant.

Le plateau est un plan de 880 × 880 px incliné en CSS 3D ; pions et bâtiments sont des panneaux
tournés en sens inverse pour rester face à l'écran. `?debug` expose `window.__david` pour les tests.

## Sauvegarde et reprise (version 2.7)

L'hôte enregistre l'état après chaque action dans `localStorage` (`david_saves`, 6 parties au plus,
identifiées par `state.gid`) et retire la sauvegarde en fin de partie. Pour reprendre, `proposeMapping`
associe les joueurs de la sauvegarde à ceux du salon (par nom, puis dans l'ordre, sinon bot) et
`remapPlayers` renumérote d'un coup tous les identifiants de l'état (propriétaires, cartes, échanges,
dettes, enchère, statistiques). `resumeAt` décale le chrono Express de la durée de la pause.

## Règles maison (version 2.6)

`makeConfig(board, mode, house)` fusionne les règles du plateau, le mode et les règles maison
(`cleanHouse` valide les valeurs reçues du salon). Elles sont toutes désactivées par défaut :
sans réglage, la partie suit les règles officielles. La cagnotte vit dans `state.pot` ; les paiements
qui l'alimentent portent `pot: true` dans leur événement, pour que la vue envoie les billets vers le Parc gratuit.

## Avant-partie et clics (version 2.3)

Avant `createGame`, l'hôte tient une petite salle d'avant-partie : les joueurs envoient `{ t:'pick', token }`,
l'hôte vérifie qu'un pion n'est pris qu'une fois et diffuse `{ t:'setup', s }`. Au lancement, les bots et les
retardataires reçoivent un pion libre au hasard ; le pion est stocké dans l'état (`player.token`).

Le navigateur détecte mal les clics sur un plan incliné en CSS 3D (les cases et le plateau sont coplanaires).
Les cases ne reçoivent donc plus la souris : le plateau repère ses 4 coins à l'écran, calcule l'homographie
écran → plateau et en déduit la case visée. Les cases restent des boutons pour la navigation au clavier.

## Statistiques (étape 4)

Le moteur tient les compteurs dans l'état (visites et loyers par case, distance, prison, doubles,
achats, constructions) et un historique du patrimoine et du liquide à chaque fin de tour, plafonné
à 400 points (un point sur deux est retiré au-delà, le dernier est toujours gardé).

`markov.js` calcule la probabilité d'arrêt à long terme sur chaque case : matrice de transition
40 × 40 (deux dés, cartes du paquet réel, « Allez en prison », trois doubles), distribution
stationnaire par itération de puissance. On retrouve les résultats connus : prison ≈ 6,3 %,
puis Cours Saleya (l'équivalent d'Illinois Avenue), Départ et le groupe orange. L'analyse financière
en déduit, avec les loyers actuels, le revenu espéré par tour de table, le rendement et le gain
marginal d'une maison de plus.

## Étapes suivantes

2. Hub (coquille, salon, pont) + moteur de règles complet avec tests.
3. Plateau isométrique, dés, pions, effets, fenêtres d'interaction.
4. Tableau de bord temps réel, courbes, heatmap, classement final.

La sortie du Hub sera publiée en **version 2.0** avec son entrée dans le journal des versions.
