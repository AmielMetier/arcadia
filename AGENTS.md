# Consignes pour les assistants de code (Claude, Codex, Copilot, Cursor, Gemini…) et les contributeurs

Ce dépôt est **Arcadia** (anciennement « Game Hub »), le salon de jeux d'Amiel : un site statique (GitHub Pages, sans étape de build) qui réunit plusieurs
jeux multijoueurs dans le navigateur — Duo Drift, DavidSimulator, Tête de Calcul, Bastion Clash, Outbreak, Fil Rouge, Cyber Kart GP, Convoy Storm, Birdie Party, Mini-Golf Party, Island Rush, Odyssée, Mollo !, Site Noir, Mystère Mystère, Dogfight 3D, The Backrooms et Fief Maudit.

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
   - The Backrooms : ne jamais écrire le nom des monstres ni des personnages du lore (prénoms des personnes qui leur servent de modèle) dans le journal ni dans les messages de commit. Parler de « l'entité », « le monstre du Level 1 », « le bouc »…
3. **Mettre le même numéro dans les `?v=` de `index.html` et `apropos.html`** (liens vers `hub/` et `shared/`) : sinon les navigateurs gardent l'ancienne version en cache.
4. **Faire tout ça dans le même commit** que le changement (ou le même push).

Filet de sécurité : si un push sur `main` ne touche pas `CHANGELOG.md`, l'action GitHub
`.github/workflows/changelog.yml` rédige elle-même une entrée à partir des messages de commit
(`tools/changelog-auto.mjs`) et monte la version. Elle est moins bien écrite qu'une entrée faite à la main :
préférer l'écrire soi-même. Pour qu'elle soit lisible, écrire des messages de commit clairs, par exemple
`feat(calcul): mode Éclair` ou `fix(david): la caméra qui suit ne se désactive plus`
(portées reconnues : `drift`, `david`, `calcul`, `bastion`, `outbreak`, `filrouge`, `kart`, `convoy`, `golf`, `minigolf`, `royale`, `odyssee`, `mollo`, `sitenoir`, `mystery`, `fief`, `hub`, `server`).
Ajouter `[skip changelog]` dans le message d'un commit purement technique pour qu'il n'apparaisse pas.

## Repères

- Chaque jeu vit dans son dossier (`drift/`, `david/`, `calcul/`, `bastion/`, `outbreak/`, `filrouge/`, `kart/`, `convoy/`, `golf/`, `minigolf/`, `royale/`, `odyssee/`, `mollo/`, `sitenoir/`, `mystery/`, `backrooms/`, `fief/`) et tourne dans une iframe du Hub ;
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
  Objets tenus (`pokemon/engine/items.js`) et Méga-Évolutions (`pokemon/engine/megas.js`) : `node tools/test-pokemon-items.mjs`.
  Roster : 61 Pokémon faits main (`pokemon/engine/data.js`) + toutes les évolutions finales des Gens 1 à 6, leurs attaques, talents et Méga-Évolutions
  générés depuis PokeAPI dans `pokemon/engine/roster-gen.js` par `node tools/pokemon-roster.mjs` (ne pas modifier ce fichier à la main).
  Format VGC (combat en double) : moteur commun dans `battle.js` (emplacements A et C contre B et D, `resolveActions`, attaques de zone, Abri),
  bots `chooseDoublesAction`, écran `pokemon/view/doubles.js` : `node tools/test-pokemon-vgc.mjs` (le tournoi VGC en réseau est dans `test-pokemon-net.mjs`).
  Format « 2 joueurs contre 2 » (`format: 'multi'`) : même moteur en double, un emplacement par joueur (`battle.owners`) avec ses propres Pokémon (`battle.pools`), équipes tirées au sort (`match.aIds` / `bIds`).
  Talents (`pokemon/engine/abilities.js` : un talent par Pokémon, le meilleur que le moteur sait jouer ; météo dans `battle.js`) : `node tools/test-pokemon-abilities.mjs`. Le mode aventure Kalos-Sud a été retiré
  (l'aventure Pokémon du Hub, c'est Odyssée).
- Odyssée (`odyssee/`) : jeu à plusieurs par le Hub (`odyssee/js/net/` : positions, invitations, échanges, combats entre joueurs calculés
  à l'identique des deux côtés avec une graine commune, `odyssee/js/core/pvp.js`) et code de sauvegarde (`odyssee/js/core/savecode.js`) :
  `node tools/test-odyssee-link.mjs`, à lancer quand on touche au moteur de combat d'Odyssée (`odyssee/js/core/battle.js`).
- Mini-Golf Party, robustesse : `node tools/fuzz-minigolf.mjs [coups par trou]` tire au hasard sur chaque trou et compte les balles qui traversent un mur ou restent suspendues (doit afficher 0 et 0).
  Textures photo : celles de `kart/tex/` (Poly Haven, CC0), chargées par `dressPhoto` dans `minigolf/js/textures.js`.
- Site Noir (`sitenoir/`, moteur sans DOM dans `sitenoir/engine/`) : horreur asymétrique à la première personne, l'hôte fait autorité. `node tools/test-sitenoir.mjs` teste la carte, le déplacement, les clés, les fusibles, le générateur, l'ascenseur, les coups, l'extraction, les copies des invités et le relais d'hôte, et des parties entières entre bots ; `node tools/bench-sitenoir.mjs [parties] [niveau|all] [enquêteurs]` mesure la durée des parties, les victoires et le coût d'un pas. `sitenoir/plan.html` montre une partie de bots vue de dessus. L'image passe par `sitenoir/view/post.js` (grain VHS côté enquêteurs seulement).
- Mollo ! (`mollo/`, moteur sans DOM dans `mollo/engine/`) : pantins physiques à sept points (Verlet et contraintes), muscles qui mollissent sous les coups. `node tools/test-mollo.mjs` teste les six arènes et leurs pièges, les objets (tirage à chaque manche, poêle, pétard, parapluie, banane), les collisions, le combat (visée, série de poings, garde, saisie, coup de tête), tenir debout, la marche, le saut,
  les coups, le KO, saisir / soulever / jeter, s'accrocher et se hisser, la fatigue des bras, la chute, des parties entières entre bots, l'instantané et la reprise par un nouvel hôte : à lancer quand on touche au moteur. Personnages et décors dessinés dans le code, aucun modèle externe.
- Mystère Mystère (`mystery/`, moteur sans DOM dans `mystery/engine/`) : murder mystery façon Murder Mystery 2, à la première personne, l'hôte fait autorité.
  Le manoir (`map.js`) tient sur une grille de cases de 1 m et trois niveaux (cave y = -4, rez-de-chaussée, étage y = 4) ; un escalier appartient à deux niveaux,
  on n'y entre que par le haut ou le bas. Règles, armes et réseau dans `sim.js` (les rôles ne partent jamais dans l'état public : chacun reçoit sa fiche,
  `sheet`), chemins des bots dans `nav.js` (A* entre niveaux, passages secrets compris), bots dans `bots.js`. `node tools/test-mystery.mjs`, `node tools/test-backrooms.mjs` teste le manoir,
  le déplacement, les escaliers, les passages secrets, le couteau, le lancer, le revolver, la bavure, le héros, les pièces, la coupure, le secret des rôles,
  la prédiction des invités et des manches entières entre bots (à lancer quand on touche au moteur). Modèles CC0 (Quaternius, Kenney, KayKit) : `mystery/models/LICENSE.txt`.
  `?debug` expose `__mystery` (`ff(sec)` avance le moteur sans dessiner, `to(x, z, niveau)`, `start()`) ; `?autostart`, `?seed`, `?role=m|s|i`, `?mode=explore`, `?bots=4`, `?lag=150`, `?q=bas`.
- The Backrooms (`backrooms/`, moteur sans DOM dans `backrooms/engine/`) : Level 0 sur deux étages (`createLevel0` dans `map.js` : on tombe par les trous
  du couloir piégé, des puits de 6,40 m (`FLOOR_DY`), on remonte par 2 escaliers coudés : deux volées et un palier, repère `u`/`v` de `stairAt` ; 5 cassettes réparties ; un ascenseur par étage, un seul vrai, `realFloor`) puis Level 1 (`level1.js`, entrepôt,
  étagères, 3 fusibles, coupures de courant, embuscades), reliés par un ascenseur qui part quand tous les joueurs encore en vie sont dedans.
  À plusieurs, l'hôte fait autorité (`snapshot` / `applySnapshot`), l'invité se déplace chez lui (`predict`). `node --experimental-detect-module tools/test-backrooms.mjs`.
  Puis Level 37, les Poolrooms (`poolrooms.js`), après l'ascenseur du Level 1 : des salles préfabriquées (lagon, voûtes d'arêtes, tunnel, galerie, verrière, pataugeoire, local technique) posées sur des modules de 10 m et reliées par des portes ; le moteur garde sa grille (murs hors des salles) plus `segs` (cloisons minces, portes ôtées), `cols` (colonnes), `collide`, `lightBlocked` et `depthAt` (forme des bassins en distance signée, l'eau ralentit) ; 3 volants de vanne = les `fuses` ; une fois trouvés, on sort par l'un des 3 toboggans colorés (`slides`, table `SLIDES` : chaque couleur a son niveau d'arrivée `to`, `null` = sortie des Backrooms ; le premier joueur qui s'y glisse choisit, `sim.slide`) ; l'entité du Level 1 y chasse aussi (même modèle, mêmes sons : `sfx/level1/`, et le dossier `models/level1/` attend sa nouvelle entité), ses chemins ne passent que par les portes (`canStep`), les cloisons cachent (`lightBlocked` dans `hasLineOfSight`). Les objectifs de chaque niveau sont placés le plus loin possible les uns des autres (`spreadOut` dans `map.js`). Rendu des salles, de l'eau et de l'ombre : `view/water.js`.
  Puis Level 5, le Terror Hotel (`hotel.js`, rendu `view/hotel.js`), par le toboggan rouge des Poolrooms (`SLIDES[0].to = 4`, `HOTEL_LEVEL` ; le 3 est le Level 2, les Tuyauteries, par le jaune) : un couloir en boucle autour de 21 chambres (201 à 221), 6 lettres (`letters`, ramassées en passant, gardées par chaque joueur dans `P.letters`) à poster dans les boîtes du hall (`mailbox`, E), puis le code à 4 chiffres (`map.code`, affiché au plafond quand `sim.codeShown`) à taper sur le clavier (`enterCode`, action réseau `c`) : la porte de secours s'ouvre (`powered`). Cachettes (`spots`, lit ou armoire, `P.hidden` ; ce sont aussi les `hides` du moteur, comme les casiers : `enterHide`, `leaveHide`, souffle retenu), accroupi (`P.crouch`, touche C), jauge de détection (`P.detect`) ; l'entité y rôde (ronde, enquête au bruit, traque, perte de trace, `map.nav` lui fait contourner les meubles). Le mot vient de `WORDS` (standard) ou, en mode VIP, de `backrooms/password_level5/mots.txt` (un mot de 6 lettres par ligne, `parseWords`).
  `backrooms/?parkour` (seul) fait commencer devant le couloir piégé, `backrooms/?level1` (seul) directement au Level 1, `backrooms/?level37` aux Poolrooms, `backrooms/?level5` à l'hôtel.
  Habillage du Level 1 (rayonnages, marchandises, tuyaux, marquages, piliers, panneaux) : `backrooms/view/warehouse.js`.
  Level 1, salles de sécurité (`map.safes`, `roomAt` dans `level1.js` : des pièces comme le poste de garde, de 2 à 4 selon la taille de la carte ; `safeAt`, `inSafe`) : porte blindée verrouillée de l'intérieur (`toggleSafe`, commande `safe`), fermée elle entre dans `collide`, `lightBlocked` et `canStep` ; l'entité qui poursuivait frappe (`bangStep`, `BANG_T`) puis repart à plus de `RETREAT_R` m. L'imposteur (`M.mimic`, `startMimic`, `mimicStep`, `unmask` dans `sim.js`) : après une victime, l'entité porte son corps (`scene.js`), marche comme un joueur et l'appelle (`mimicCall`) ; chaque client rejoue la voix de la victime gardée dans un tampon circulaire (`view/voice.js`, `CLIP_KEEP`), ou une voix de synthèse sans enregistrement.
- Sauvegardes en ligne (`server/saves.js`, client `odyssee/js/net/cloud.js`) : le relais range les parties dans le dépôt GitHub,
  branche `saves`, sous le code ami du compte Hub. Mise en route sur Render : `docs/SAUVEGARDES.md`. Test : `node tools/test-saves.mjs`.
  Comptes Arcadia (identifiant + mot de passe, profil chiffré dans le navigateur avant de partir) : client `hub/account.js`, serveur `server/accounts.js`
  (même branche, dossier `accounts/`). Test : `node tools/test-accounts.mjs`. Le relais doit être redéployé sur Render pour qu'ils marchent.
  Comptes VIP (`hub/vip.js`) : jeux, réglages ou options réservés avec `vip: true` dans `hub/games.js` (option : `['val', 'Libellé', { vip: true }]`),
  retirés de la liste des autres joueurs ; dans un jeu, `HubBridge.info.vip`. Donner le grade à un compte en ligne : `node tools/vip-add.mjs <identifiant>`
  (`--retirer` pour l'enlever). Test : `node tools/test-vip.mjs`.
- Mini-Golf Party : `node tools/test-minigolf.mjs` construit les 72 trous (dont les 18 du Marathon, ~2 min) et vérifie qu'un bot expert les termine (à lancer quand on touche aux trous ou à la physique).
- Odyssée (aventure solo façon DS, `odyssee/`) : `node tools/test-odyssee.mjs` joue 600 combats aléatoires et vérifie que toute la région
  (portes, grottes, PNJ, objets, arènes) est accessible depuis Bourg-Aube sans qu'un PNJ ne bloque le passage, et que la progression
  tient (avec k badges et les capacités de terrain qu'ils débloquent, l'arène k+1 est ouverte mais pas la suivante ; Ligue à 8 badges ;
  depuis chaque quai du bateau, les légendaires de l'île sont accessibles avec les bons badges et leurs quêtes) :
  à lancer quand on touche au moteur (`odyssee/js/core/`) ou à la carte (`odyssee/js/world/`). Les données des Pokémon (`odyssee/js/data/`)
  sont générées par `tools/odyssee-donnees.mjs` à partir des tables de PokeAPI (leurs sprites viennent de PokeAPI : des remplaçants) ;
  les créatures originales sont dans `odyssee/js/data/creatures.js`. Les dessins d'origine (1024 px) sont dans `assets/graphics/`
  (portraits : `portrait_nom.png`) ; `python3 tools/odyssee-sprites.py [chars portraits crea items nature mobilier sol facades title]`
  les découpe et les réduit dans `odyssee/img/` et met à jour `odyssee/js/data/sprites.js`. Les planches « version 2 » (pixel art agrandi ×4
  ou ×8, personnages en 3 × 4 cases carrées, `nature_arbres.png`, `nature_petits.png`) sont ramenées à leur vraie résolution
  (grille retrouvée automatiquement, même au pas fractionnaire ; profils des personnages triés gauche / droite). Une case du décor
  fait 32 pixels à l'écran : tuiles (16 px) agrandies ×2, sprites « version 2 » à densité 2 (personnages en cases de 64 × 64).
  Le tileset global assemblé à la main (`assets/graphics/tileset.png` : sols, eau, rebords, hautes herbes en 4 × 4 pièces,
  kits de façade) est découpé par `python3 tools/odyssee-tileset.py [sol herbes kits]` en tuiles de 32 px (`odyssee/img/sol32/`,
  `odyssee/img/herbes/`, `odyssee/img/facades/`) ; chaque tuile y est repérée par un point de son dessin (tables `SOL`, `HERBES`, `KITS`).
  Personnages provisoires de HeartGold / SoulSilver : `python3 tools/odyssee-hgss.py [clone pret/pokeheartgold] [clone smogon/sprites]`
  (images brutes gardées dans `assets/graphics/hgss/`). Les créatures originales sont remplacées par des Pokémon
  (`odyssee/js/data/remplacants.js`, `ORIGINALES = true` pour les remettre).
  Histoire principale (la Team Éclipse, Lugia Obscur au Sanctuaire des Marées, l'Éclipse, le Conseil 4 avant Célestine, les CS Flash et Force
  et leurs recoins cachés, les quêtes annexes) : `odyssee/js/world/story.js` (PNJ et lieux) et `odyssee/js/story.js` (scènes) ;
  `node tools/test-odyssee-story.mjs` rejoue toute l'aventure dans l'ordre et vérifie que chaque étape est atteignable au bon moment.
  Arènes dessinées dans un plan ASCII (les quinze, Sylvebourg comprise) : plans, légendes, registres et règles dans `odyssee/js/world/arenes-plans.js`,
  écrit par `python3 tools/odyssee-arenes/dessiner.py` (arènes peintes dans `nord.py` et `sud.py` à côté ; `archipel()` : 3 × 4 îles reliées par
  des passages, configurations trouvées par recherche). Mécanismes et solveur communs dans `odyssee/js/world/arenes-plan.js` (portes à condition
  sur des registres, dalles et leviers, verrous, tapis qui tournent, glace et sable, trous, téléporteurs, canons à vent, rochers et fosses, rayon
  et miroirs qui barrent la route, dalles d'argile, pupitre de remise) ; côté jeu `odyssee/js/arenes-jeu.js` (registres dans le drapeau `R:<carte>`,
  `PV:<carte>` pour les sauvegardes d'avant), graphismes `odyssee/js/render/arenes-tex.js`, une case d'arène = plusieurs décors (`celluleArene`
  de `world3d.js`). Chaque place de dresseur du plan reçoit son dresseur (`GYM_CINQUIEME` de `region.js`). `node tools/test-odyssee-arenes-plan.mjs [type]` :
  chaque arène se résout, sans état sans retour, sans dresseur qui bloque ; `node tools/test-odyssee-arenes-jeu.mjs [n°]` (Playwright, `CHROME_PATH`
  possible) rejoue chaque solution dans le vrai jeu et compare les registres coup par coup : à lancer quand on touche à l'un de ces fichiers.
  Les énigmes tirées d'une graine (`odyssee/js/world/arenes.js`, `node tools/test-odyssee-arenes.mjs`) ne servent plus que de repli ; l'ancienne
  Grande Serre de Sylvebourg (`arene-sylve.js`, `serre-tex.js`) reste vérifiée seule par `node tools/test-odyssee-arene-sylve.mjs` (avec Sacoches de
  Pollen et la CT01 Pollen Collant).
  Intérieurs façon HeartGold / SoulSilver (`murCell` de `world3d.js`, tuiles de `odyssee/js/render/murs-tex.js`) : mur du fond en deux (papier peint
  et corniche, lambris et plinthe), fenêtres là où rien ne s'adosse, murs latéraux en vrais volumes coiffés d'un chaperon, muret en bas, ombre des
  murs sur le sol, tapis sous la table des maisons ; quatre papiers peints de maison tirés de l'identifiant de la carte (`styleMur`) ; `?anciensmurs`
  dans l'adresse remet l'ancien rendu pour comparer.
  Histoire secondaire (la Brume) et nouveaux lieux (Lac Miroir, Grotte des Marées, Jardin des Songes, Forêt des Torii et Temple Kagura,
  Île du Magma) : `odyssee/js/world/quetes.js`. Une quête = des étapes dans `flags['Q:id']`, des PNJ qui apparaissent selon l'étape
  (`when`), des scripts (`talk`, `use`, `onWin`, `after`) qui reçoivent les outils de `game.api()`. `node tools/test-odyssee-quetes.mjs`
  joue toutes les quêtes de bout en bout (à lancer quand on touche aux quêtes). Animations de terrain HGSS (mer, rivages, fleurs) :
  `odyssee/img/hgss/`, extraites par `tools/odyssee-hgss.py`, qui découpe aussi les icônes de la carte de la région (style Pokégear,
  `assets/graphics/hgss/carte_guide.png` → `odyssee/img/carte/`).
  Les outils de dessin (atelier graphique, vitrine, sources PixelLab, scripts de découpe des sols, kits, personnages
  et créatures à 16 px) vivent sur la branche `atelier` du fork ; `main` ne garde que le jeu.
  Sprites des Pokémon (face, dos, chromatiques, icônes, générations 1 à 6) : copiés de PokeAPI dans `odyssee/img/pokeapi/`
  par `node tools/odyssee-sprites-pokeapi.mjs` ; cris dans `odyssee/snd/cris/` (le jeu ne charge plus rien en ligne pour les Pokémon).
  Méga-Évolution : `node tools/odyssee-megas.mjs` écrit `odyssee/js/data/megas.js` (81 Méga de PokeAPI, dont celles de Légendes Z-A,
  pour les Pokémon des générations 1 à 6) et copie leurs sprites et les cris ; `odyssee/js/core/mega.js` enregistre les formes
  (espèces invisibles des listes, n° 10033 et plus), les Méga-Gemmes et le Méga-Anneau ; le moteur (`battle.js`) : `canMega`, `doMega`,
  une par dresseur et par combat, retour à la forme de base dans `end()`. Méga-Anneau remis par le Pr Orme à Port-Granit (5 badges),
  qui vend aussi les gemmes ; 12 gemmes cachées sur les routes de la fin. Dresseurs : `trainer.megaSp` (n° d'espèce ou 'ace').
  Méga imaginées par des fans (24, n° 20001 et plus) : `odyssee/js/data/megasFans.js` et `odyssee/img/megas/` (origine dans `LISEZMOI.txt`) ;
  quand l'espèce a déjà une Méga officielle, la version des fans porte le signe Δ et sa propre gemme. Toutes les gemmes se vendent chez le Pr Orme.
  Interface : un écran plein cadre par fichier dans `odyssee/js/ui/screens/` (`map.js`, `card.js`, `pc.js`, `friends.js`…),
  outils communs et fermeture d'écran (`closer`) dans `screens/common.js` ; `ui/screens.js` ne fait que tout réexporter (importer depuis lui).
  Styles découpés de même dans `odyssee/css/NN-ecran.css`, chargés dans l'ordre par `index.html` (l'ordre compte : un fichier
  plus loin peut surcharger un plus tôt) ; `odyssee.css` les réunit par `@import` pour les pages d'aperçu.
  `node tools/test-odyssee-ecrans.mjs` ouvre le jeu dans un vrai Chrome (Playwright, sauté s'il manque) : chaque écran au clavier
  (Espace ne ferme pas, Échap ferme et rend la main), carte, Carte de Dresseur, saisie du code ami, météo (brume, cendres) — à lancer quand on touche à l'interface.
  Météo du monde : `getMapWeather()` dans `game.js` ; seules pluie, soleil, sable et grêle comptent en combat (`BATTLE_WEATHERS`), brume et cendres sont du décor (`render/weather3d.js`, `css/22-meteo.css`).
  Touches reçues par les écrans : celles de `odyssee/js/input.js` uniquement (`a`, `b`, flèches, `map`, `menu`…), jamais `space` ni `enter`.
  Rendu : les sprites sont dessinés à l'écran pixel pour pixel, ancrés à leurs pieds
  (shader `screenSprite` de `odyssee/js/render/world3d.js`), les bâtiments prennent la profondeur de leur façade.
- Odyssée, choix des graphismes (Options → Graphismes, `odyssee/js/gfx.js`) : sol du dehors (« odyssee » = sol généré, « classique » = tuiles d'origine, ou un pack de tuiles de 16 px dans `odyssee/img/gfx/<pack>/`, déclaré dans `PACKS`) et sprites des Pokémon (HeartGold / SoulSilver ou Noir & Blanc, `gen()` dans `assets.js`) ; écran « Crédits graphismes » (`CREDITS`). Le sol se lit au chargement (`loadArt` dans `main.js`, `setArt` dans `render/textures.js`). Pack « Lumineux » : `python3 tools/odyssee-pack-sol.py <planche 1.png de Team Aqua>`. Sprites Noir & Blanc 1 à 493 : copiés de PokeAPI/sprites dans `odyssee/img/pokeapi/pokemon/versions/generation-v/black-white/`. Toute tuile ou sprite ajouté doit être crédité (`CREDITS` et un `LISEZMOI.txt` à côté).
- Island Rush (battle royale, `royale/`) : l'île vient d'une graine (`royale/engine/map.js`, île officielle `ILE`), `royale/carte.html`
  la montre en 2D. `node tools/test-royale.mjs` vérifie l'île sur plusieurs graines, le déplacement (portes, escaliers, murs, nage),
  une partie (butin, combat, construction), les copies des invités et le relais d'hôte, la prédiction : à lancer quand on touche
  au moteur (`royale/engine/`). `node tools/bench-royale.mjs [joueurs] [niveau] [graine] [minutes]` fait jouer une partie entière
  entre bots (`WATCH=bot3` suit un bot) : coût d'un pas, éliminations, bots coincés, durée de la partie.
  Parties jouées : l'hôte tient un journal local (`royale/journal.js`), lu par `royale/stats.html` ; guide des soirées de
  test dans `docs/ISLAND-RUSH-TESTS.md`.
- Dogfight 3D (`dogfight/`) : le moteur (`dogfight/engine/`, sans DOM) survole la vraie île d'Island Rush. `node tools/test-dogfight.mjs` vérifie le vol, les armes, l'IA, les règles et le réseau : à lancer quand on touche au moteur.
  `node tools/bench-dogfight.mjs [joueurs] [niveau] [éliminations] [parties]` fait jouer des bots hors navigateur. `python3 tools/glb-webp.py modele.glb` allège un modèle. Licences des modèles : `dogfight/LICENSE.txt` (F-22 à confirmer).
- Réseau (`shared/net.js`, `shared/room.js`, `server/`) : `node tools/test-relay.mjs` et `node tools/test-net.mjs`
  (prérequis : `cd server && npm install`). Le serveur relais doit être redéployé quand `server/server.js` change.
  Si l'hôte part, son successeur est choisi par `successorOf` (`shared/room.js`) : un joueur présent (pas `away`), de préférence
  dans la partie (`ready[id] === game`), puis le plus petit numéro ; un jeu qui le devine (Bastion Clash, pour sa sauvegarde
  de reprise) suit la même règle. Un invité n'écoute que l'hôte (`from: 'host'`), et le relais ne le laisse écrire qu'à l'hôte.
  Côté hôte, une place tenue par une connexion ne se reprend que par hello (avec le `sid` de la page) ; le numéro `fromId` d'un
  message ne rattache une nouvelle connexion qu'à une place libre. Un hôte qui renonce à sa place (file d'envoi débordée,
  `_overflow` dans `shared/net.js`) fait comme si elle avait expiré (`cb.lost`) : il suit le successeur, ou rouvre son code s'il est seul.
- Bastion Clash : le moteur (`bastion/engine/`, sans DOM) est testé par `node tools/test-bastion.mjs` ;
  `node tools/bench-bastion.mjs [minutes] [graine] [mode] [carte]` fait jouer 4 bots hors navigateur et mesure
  le coût d'un pas de simulation (doit rester sous 33 ms), les éliminations, les cibles des bots et les unités bloquées.
- Fief Maudit (`fief/`, moteur sans DOM dans `fief/engine/`) : survie médiévale en coop (conception et étapes dans `docs/FIEF-MAUDIT.md`).
  Vallée, village, braseros, arbres et collisions dans `map.js` ; chemins A* sur une grille de 1 m dans `nav.js` ; joueurs, hache, bûches, entrepôt, cycle jour / nuit (`CYCLE`),
  braseros (`FUEL`), squelettes (`FOES`, réveil, cibles, résurrection dans la brume `RISE`), à terre / relevé (`HP`), défaite, `snapshot` / `restore` dans `sim.js` ;
  métiers (`JOBS`), poutres à deux (`BEAM`, `stepBeams`), arrivées et départs (`addPlayer`, `removePlayer`, `setJob`) dans `sim.js` ;
  bâtiments à relever (`BUILDS`, `siteNear`, `startBuild`, `finishBuild`, effets `hpBonus` / `dmgMul` / `canRise` / `sheltered`), faim et baies (`FOOD`, `map.bushes`),
  froid (`COLD`), modes et difficultés (`MODES`, `DIFF`), nuits de siège et chevalier noir (`siegeNight`, `nightLen`, `FOES.knight`), sauvegarde (`saveData` / `loadSave`,
  écrite par l'hôte dans `localStorage` à chaque aube) dans `sim.js` ;
  la crypte : plan et salles dans `crypt.js` (grille de 2 m, `inside`, `halls`), règles dans `sim.js` (`openCrypt`, `stepCrypt` : leviers `LEVER_T`, herse, brume, Roi `FOES.king` en trois phases, torches `relight`) ;
  capacités des métiers sur F (`ABILITY`, `ability`, entrée `ac`), fusées `flares` et barricades `bars` dans `sim.js` ;
  durée du jour `dayLen` (premier jour plus court), bûches empilées (`LOAD_MAX`, `p.load`), coffres gardés des bois (`placeChests`, `LOOT`, gardes `state: 'sleep'`, vue `view/chests.js`), cloche du feu de camp (`ring`) ;
  coéquipiers IA dans `bots.js` (mêmes entrées qu'un joueur). Réseau dans `net.js` : l'hôte envoie `encodeState` (~15 fois par seconde), `encodeWorld` et
  un `snapshot` complet toutes les 4 s ; l'invité garde une copie de la vallée (`applyState`, `smooth`) et prédit son déplacement (`predict`, `reconcile`) ;
  le nouvel hôte repart du dernier instantané. `tools/fief-duo.html?q=debug%26manual` charge deux ou trois jeux dans une page et fait passer leurs messages
  comme le salon (`duo.dropHost()` fait partir l'hôte). Vue : `view/night.js` (lumière, ciel, brume, braseros), `view/actors.js` (héros, squelettes, Roi), `view/crypt.js` (crypte et effets des capacités), `view/music.js` (musique WebAudio) ; réglages par `DDVolume.panel`, qualité `scene.setQuality`.
  `node tools/test-fief.mjs` (le `Sim` des tests retire les coffres sauf `{ chests: true }` ; à lancer quand on touche au moteur : vallée, chemins, hache et bûches, nuit, braseros, squelettes, bouclier, relève, défaite, instantané, une nuit jouée par deux bots, métiers, poutres, arrivées et départs, réseau, construction, faim, froid, sièges, dix nuits, sauvegarde, crypte et Roi, capacités, début de partie : jour court, bûches empilées, cloche, coffres).
  Modèles (Quaternius Medieval Village MegaKit, KayKit Adventurers et Skeletons, CC0) préparés par `node tools/fief-assets.mjs <clones>` dans `fief/models/` (crédits : `fief/models/LICENSE.txt`) ;
  arbres, ciel et textures repris de Birdie Party, rochers de Kenney et sons d'Island Rush et Birdie Party. `?debug` expose `__fief` (`ff(sec)`, `tp(x, z, cap)`, `cam(cap, inclinaison, distance)`, `press('fc'|'uc')`), `?manual` ne dessine qu'à la demande (`__fief.frames(n)`), `?seed`, `?bots=0..2`, `?job=…`, `?autostart`.
- Commits : auteur et messages en français, un message qui décrit ce que le joueur gagne.
