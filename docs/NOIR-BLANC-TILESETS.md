# Odyssée, graphismes « Noir & Blanc » : ce qui manque et comment le faire

Fiche de reprise pour Claude Code (ou toute personne) qui continue le pack « Noir & Blanc » d'Odyssée sur sa propre machine.
À lire avec `AGENTS.md` (règles 5 et 6, et le paragraphe « Odyssée, choix des graphismes »).

## Le problème en deux phrases

1. **Une partie du jeu n'a pas encore d'équivalent Noir & Blanc.** Avec ce choix, les intérieurs des maisons, les grottes,
   les arènes, les donjons, les fonds de combat et le relief (falaises, montagnes) gardent les graphismes de base, ou
   des pièces bricolées. Le joueur passe donc d'un style à l'autre.
2. **Pokémon Noir & Blanc et Noir 2 & Blanc 2 n'ont pas de tilesets officiels.** Sur DS, les cartes sont des modèles 3D
   texturés, pas des grilles de tuiles comme sur GBA. Tout ce qu'on trouve, ce sont des reconstitutions faites par des fans,
   pour Pokémon Essentials (RPG Maker XP) surtout. Il faut donc chercher, télécharger, comparer et assembler à la main.

S'y ajoute une limite de l'environnement : la session Claude dans le cloud ne peut télécharger que depuis GitHub et les
registres de paquets. DeviantArt, PokéCommunity, Eevee Expo, The Spriters Resource, Google Drive ou Mediafire lui sont
fermés. **C'est pour ça que ce travail doit se faire dans Claude Code, sur la machine d'Amiel** (ou alors Amiel télécharge
lui-même les planches et les dépose dans le dépôt).

## Où en est le pack

Tout est fabriqué par `python3 tools/odyssee-pack-noirblanc.py` à partir des planches de `assets/graphics/noirblanc/`.
La sortie va dans `odyssee/img/gfx/noirblanc/` et `odyssee/js/data/gfx-noirblanc.js` (ce dernier ne se modifie pas à la main).
Crédits : `odyssee/img/gfx/noirblanc/LISEZMOI.txt` et `CREDITS` de `odyssee/js/gfx.js`.

**Déjà en Noir & Blanc** (kit « Pokémon Essentials BW » v3.1.1 de KleinStudio, plus quelques planches de fans) :
- **Dehors :**
  - herbe, chemins, sable, pavés, asphalte ;
  - mer et rivages animés, posés par quarts selon les huit voisins (`groundCell`, `quarts`) ;
  - hautes herbes, fleurs, neige, cendres, lave (Phyromatical) ;
  - ponts et rebords.
- **Décor :** 91 éléments `d_*` (arbres, sapins, haies, lampadaires, rochers…).
- **Bâtiments :** 91 bâtiments `b_*`, positions et portes dans `kit_bw_batiments.json`. Un bâtiment du pack n'est pris que
  si sa largeur colle à l'emprise (`poserBat` de `render/world3d.js`) ; sinon, c'est le modèle de base.
- **Personnages :** les PNJ, avec 35 lignes propres et 17 familles de variantes. Le joueur est recoloré selon sa tenue
  par les masques de `tenue.png`.
- **Intérieurs du Centre Pokémon et de la Boutique :** sols, comptoirs, machine de soin, PC, plantes, et couleurs des murs
  par `paletteMurs` de `render/murs-tex.js`. Les planches viennent d'UltimoSpriter et de ditto209 (`tools/noirblanc_critiques.py`).
- **Relief du dehors, en partie :**
  - bords d'herbe sur roche tirés du cadre du kit (pièces `x_nbf_*`, grille aux x 32/64/96, `Y0 = 14844`) ;
  - remplissage rocheux `x_rp_*` et `x_nbr` ;
  - buttes (`nbButte`) et parois (`paroiCell`, ombre par gradin `ombreGradin`).
  - Le reste du relief garde ses dessins, avec les roches grises reteintes en brun clair (`rocheBrune` de `render/textures.js`).

**Pas encore en Noir & Blanc**, par ordre de priorité, c'est-à-dire de ce que le joueur voit le plus :

| # | Zone | Aujourd'hui | Fichiers concernés |
|---|------|-------------|--------------------|
| 1 | **Relief et montagnes** : falaises hautes, escaliers taillés dans la roche, sommets, bords de plateau vus de face | Pièces du kit plus dessins de base reteints. Le bord et le sol se distinguent mal sur les montagnes | `paroiCell`, `nbButte`, `reliefDehors` de `render/world3d.js` ; `x_rp_*`, `x_nbf_*` du script |
| 2 | **Grottes, intérieur** : murs de roche, entrées, échelles, rochers, eau de grotte, plafond sombre | Seul le sol (`cave0`, `cave1`, `cavestairs`) est Noir & Blanc ; les murs (`CAVEWALL`) restent de base | `render/world3d.js` (grottes), `render/textures.js` |
| 3 | **Intérieurs des maisons** : parquet, papiers peints, meubles (lits, tables, bibliothèques, télé, cuisine), escaliers intérieurs | Graphismes de base façon HeartGold / SoulSilver | `murCell` de `render/world3d.js`, `render/murs-tex.js` (`styleMur`, `paletteMurs`) |
| 4 | **Arènes et donjons** : `roche_gym`, `abime`, `alveoles`, `sable_glissant`, `estrade`, `gouffre`, `pont_ombre`, `fragile`, dalles, leviers, téléporteurs, miroirs, vannes… (environ 120 sortes de décor sans pièce Noir & Blanc) | Graphismes de base | `render/arenes-tex.js`, `celluleArene` de `render/world3d.js`, `odyssee/js/donjons/rendu.js` et `images.js` |
| 5 | **Fonds de combat** (`odyssee/img/battle/`) | Graphismes de base pour les deux choix | `ui/battleView.js` (`bg`), `odyssee/img/battle/` |
| 6 | **Bâtiments sans équivalent de la bonne largeur** | Modèle de base | `kit_bw_batiments.json`, `poserBat` |
| 7 | **Petits décors du dehors** sans pièce : `asph` en bordure, `ciel`, `exitlight`, `parterre`, `koi`, `echelle`… | Graphismes de base | `odyssee-pack-noirblanc.py` (`d_*`) |

Pour retrouver la liste exacte des décors sans équivalent, compter les `kind` des décors de toutes les cartes
(`buildWorld()` de `odyssee/js/world/region.js`) qui ne sont pas dans `NB_DECOR` de `odyssee/js/data/gfx-noirblanc.js`.

## Sources à essayer

À télécharger depuis la machine d'Amiel. Vérifier à chaque fois le style (Noir 2 & Blanc 2, pas Diamant / Perle ni
HeartGold / SoulSilver), la taille des tuiles (32 px dans Essentials, soit du 16 px doublé) et les conditions d'utilisation.
Il faut créditer chaque auteur.

- **Le kit déjà utilisé.** Les planches « Pokémon Essentials BW » de KleinStudio non encore exploitées : grottes,
  intérieurs, arènes. Commencer par regarder ce qu'il contient avant de chercher ailleurs.
- **PokéCommunity**, fil « Resources » de la section RPG Maker
  (<https://www.pokecommunity.com/threads/352449>). Il recense des packs « DPP / HGSS / BW » au format RPG Maker XP.
  Voir aussi « RMXP Black and White Package » de TheMarkCrafter (<https://www.pokecommunity.com/threads/rmxp-black-and-white-package.258840/>)
  et « Various Tilesets (DPPt, HGSS, BW) » (<https://www.pokecommunity.com/threads/293193>).
- **Intérieurs :** « Public Interior Tileset » de ThatsSoWitty (DeviantArt), qui contient des tuiles au style Noir & Blanc.
  Le crédit exige de citer tous les auteurs listés dans sa description.
- **Planches Gen 5 de fans** sur DeviantArt : UltimoSpriter, ditto209 (déjà utilisés pour le Centre Pokémon), Kyledove,
  Phyromatical (déjà utilisé pour la lave), et les autres auteurs cités dans ces packs.
- **Eevee Expo** (<https://eeveeexpo.com/resources/>), section « Tiles » : ressources pour Essentials, souvent avec leurs
  conditions d'utilisation.
- **The Spriters Resource et The Models Resource :**
  - pages Noir & Blanc et Noir 2 & Blanc 2 (<https://www.spriters-resource.com/ds_dsi/pokemonblack2white2/>,
    <https://models.spriters-resource.com/ds_dsi/pokemonblack2white2>) ;
  - les sprites de personnages et d'interface sont rippés ;
  - les cartes sont des modèles 3D (bâtiments, objets de décor), qu'on peut rendre en vue de dessus pour en tirer des tuiles ;
  - les fonds de combat de Noir 2 & Blanc 2 ont été rippés.
- **En dernier recours, ripper soi-même :** méthode « How To rip Tiles from Pokémon DPPt/HGSS/BW/B2W2 » sur PokéCommunity
  (<https://www.pokecommunity.com/threads/357039>). On capture les textures des cartes 3D, puis on les remet à plat.

## Comment faire (une zone à la fois)

1. **Chercher et télécharger** la planche dans un dossier neuf hors du dépôt. Les fichiers téléchargés ne sont pas fiables :
   ne pas lancer de script depuis leur dossier.
2. **Ranger la planche utile** dans `assets/graphics/noirblanc/` sous un nom français parlant (ex. `grotte_murs.png`).
   Noter sa source et son auteur.
3. **La découper dans `tools/odyssee-pack-noirblanc.py`**, avec les outils déjà en place :
   - `L()` charge une planche ;
   - `cell(cx, cy, im)` prend une case de 32 px ;
   - `half()` ramène le pixel art doublé à 16 px, sans perte ;
   - `net()` enlève les pixels semi-transparents ;
   - `sans()` rend une couleur transparente ;
   - `auto16()` prend les 16 pièces d'un terrain selon ses voisins ;
   - `tone()` reteinte.

   Les noms suivent les conventions existantes : `q_<terrain>_<0|v|h|f|i>` pour les terrains posés par quarts, `d_<nom>`
   pour le décor, `b_<nom>` pour les bâtiments, `x_<clé>` pour une tuile du pack qui remplace la tuile `<clé>` dessinée par le code.
4. **Lancer** `python3 tools/odyssee-pack-noirblanc.py`. Ensuite, remettre à leur version précédente les PNG réencodés
   à l'identique (comparer les pixels avec numpy et faire `git checkout` sur ceux qui n'ont pas changé), puis
   `rm -rf tools/__pycache__`.
5. **Brancher le rendu.** Ça se fait dans `odyssee/js/render/world3d.js` (`groundCell`, `paroiCell`, `murCell`,
   `celluleArene`, `poserBat`), `render/textures.js` (`setArt`, `buildAtlas`, ré-application des `x_*`) ou
   `render/murs-tex.js`, toujours derrière le choix de graphismes (classe `gfx-noirblanc`, `gfx.js`). Avec « Odyssée (de base) »,
   rien ne doit changer.
6. **Vérifier à l'œil avec les deux graphismes**, dans Options → Graphismes. Ce n'est pas facultatif : c'est la règle 6
   d'`AGENTS.md`. Prendre des captures aux mêmes endroits avec les deux choix (Playwright, `localStorage` `odyssee-gfx-sol`
   à `noirblanc` ou `odyssee`), en plein jour et de nuit.
7. **Lancer les tests :**
   - `node tools/test-odyssee.mjs` ;
   - `NODE_PATH=$(npm root -g) CHROME_PATH=… node tools/test-odyssee-ecrans.mjs` ;
   - pour une arène : `node tools/test-odyssee-arenes-plan.mjs` et `test-odyssee-arenes-jeu.mjs`.
8. **Créditer** dans `odyssee/img/gfx/noirblanc/LISEZMOI.txt` et `CREDITS` de `odyssee/js/gfx.js`.
9. **Publier :**
   - monter `VERSION_ODYSSEE` (+0.1) et lancer `node tools/odyssee-preload.mjs` ;
   - monter la version du Hub ;
   - ajouter une entrée au `CHANGELOG.md` ;
   - mettre le même numéro dans les `?v=` d'`index.html` et `apropos.html` ;
   - faire un seul commit, en français.

## Pièges déjà rencontrés

- **Pixels semi-transparents.** La carte n'affiche que des pixels opaques (`alphaTest` 0,5). Les ombres et l'antialiasing
  à moitié transparents du kit deviennent des pâtés ou des traits gris : sur les pentes en escalier, ça donnait des lignes
  en diagonale. Il faut toujours passer par `net()`.
- **Mauvaise grille.** Les cadres du kit ne sont pas toujours alignés sur 32 px depuis le bord. Pour les bords de falaise,
  la grille est aux x 32/64/96 et le cadre commence à y 14844. Le premier découpage, décalé, faisait passer l'intérieur
  d'un plateau pour un trou. Avant de découper un cadre, l'afficher en ASCII ou en gros plan.
- **Franges d'herbe.** Une roche posée à côté d'un chemin laissait une frange d'herbe bleu-vert. Correction : la base sous
  `CAVEWALL` est `q_path_f` près d'un chemin, et les quarts du chemin traitent la roche comme du chemin.
- **Largeur des bâtiments.** Un bâtiment du pack plus large ou plus étroit que son emprise n'est pas pris. Sans prévenir,
  le modèle de base reste.
- **Images du joueur.** La tenue recolore le dresseur par zones. Avec le pack, ces zones viennent des masques de `tenue.png`
  (768 × 128) et non de la détection automatique. Toute nouvelle planche de joueur demande ses masques.
- **Réencodage des PNG.** Relancer le script réécrit des PNG identiques au pixel près. Il faut les annuler pour ne pas
  gonfler le commit.
- **Cartes.** La carte est reconstruite à chaque chargement à partir du code : les sauvegardes ne contiennent pas la carte.
  Un changement de décor est donc visible tout de suite, même sur une vieille partie.

## Ce qu'on attend au bout

Que le joueur qui choisit « Noir & Blanc » ne retombe plus sur les graphismes de base nulle part, en commençant par ce
qu'il voit le plus : relief et montagnes, grottes, maisons, arènes. La règle reste la même qu'au départ :
**à la manière de Noir 2 & Blanc 2**, avec des pièces authentiques et créditées plutôt que dessinées à la main dans le code.
