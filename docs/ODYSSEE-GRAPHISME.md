# Odyssée — règles graphiques

Ces règles disent comment doit être fait chaque dessin du décor pour qu'il tombe juste dans le jeu : taille, grille,
ancrage, couleurs. Les valeurs exactes (tailles des bâtiments, largeur de chaque objet, rôle de chaque case des kits)
sont dans `odyssee/js/data/regles.js`, lu à la fois par le jeu, par l'atelier et par l'outil de normalisation.

- **Atelier** : `odyssee/atelier.html` montre chaque élément à l'échelle du jeu, sur la grille, avec ce qui ne
  respecte pas les règles ; `odyssee/?vitrine` ouvre une ville de test avec tous les bâtiments et tous les objets.
- **Normalisation** : `python3 tools/odyssee-atelier.py` remet les dessins aux règles (voir plus bas).

## 1. La grille

| | |
|---|---|
| Une case du décor | **32 pixels à l'écran** |
| Densité du dessin | **16 pixels d'art par case**, chaque pixel d'art affiché en 2 × 2 (comme sur DS) |
| Exceptions tolérées | sols du tileset, hautes herbes et arbres « version 2 » : 32 pixels d'art par case |
| Lumière | vient d'**en haut à gauche** : faces éclairées en haut et à gauche, ombres en bas et à droite |
| Contour | 1 pixel d'art, d'une teinte sombre de la couleur voisine — jamais de noir pur |
| Transparence | tout ou rien (0 ou 255) ; pas de halo, pas de liseré du fond (magenta, violet) |
| Couleurs | tirées de la palette commune (`odyssee/atelier/palette.png`, 64 couleurs) ; 48 couleurs au plus par objet |

Un dessin fait à une autre densité (un objet en 24 ou 40 pixels par case, un « faux pixel art » agrandi par une IA)
n'a pas des pixels de la même taille que le reste : c'est ce qui donne l'impression que les éléments ne vont pas
ensemble. Toujours produire (ou ramener) le dessin à 16 pixels par case.

## 2. Les bâtiments

Un bâtiment est un volume : une **façade** (w cases de large, h cases de haut), deux **côtés**, un **toit** à deux
pans qui couvre toute son emprise (w × d cases au sol). À l'écran, une maison de 4 × 3 cases avec 2 cases de mur
fait environ 2 cases de mur et 3 cases de toit, comme dans HeartGold / SoulSilver. Les grands bâtiments ont
un mur d'autant plus haut que leur emprise est profonde (le toit ne doit pas écraser la façade).

| Bâtiment | Emprise (w × d) | Mur (h) | Porte (colonne) | Kit |
|---|---|---|---|---|
| Maison | 4 × 3 | 2 | 1 | maison (chalet sur la neige, pêcheur ou port dans les ports) |
| Maison large | 5 × 3 | 2 | 2 | maison |
| Grande maison | 6 × 4 | 3 | 2 | maison |
| Centre Pokémon | 5 × 4 | 3 | 2 | centre |
| Boutique | 4 × 4 | 3 | 1 | boutique |
| Arène | 7 × 5 | 3 | 3 | arene |
| Labo | 6 × 4 | 3 | 2 | labo |
| Ligue | 9 × 6 | 4 | 4 | ligue |
| Tour | 4 × 4 | 3 | 1 | maison |

Le toit est posé pour que son rebord tombe pile sur le haut de la façade (on voit toutes les rangées de fenêtres).
Un bâtiment cache environ h cases derrière lui : quand le joueur y passe, le bâtiment devient transparent.

Les bâtiments ne sont pas dessinés d'un bloc : le jeu les **assemble** à partir d'un **kit** de 4 × 4 cellules de
16 × 16 pixels (`odyssee/img/facades/<kit>.png`, 64 × 64 pixels). Chaque cellule a un rôle :

| | colonne 0 | colonne 1 | colonne 2 | colonne 3 |
|---|---|---|---|---|
| **ligne 0** | mur | fenêtre (jour) | fenêtre (nuit, allumée) | socle (mur du bas) |
| **ligne 1** | porte (jour) | porte (nuit) | linteau (au-dessus de la porte) | côté du bâtiment |
| **ligne 2** | toit | rebord du toit (bas du pan) | faîte (haut du pan) | cheminée |
| **ligne 3** | enseigne gauche | enseigne droite | jardinière | lampe murale |

- Les cellules **de mur** (mur, fenêtres, socle, porte, linteau, côté, toit, rebord, faîte) remplissent toute la
  cellule et **se raccordent** à gauche, à droite, en haut et en bas avec elles-mêmes et avec leurs voisines :
  même ligne d'horizon des planches, mêmes joints, même couleur au bord.
- Les cellules **d'objet** (enseigne, jardinière, lampe, cheminée) sont détourées, posées en bas de leur cellule.
  L'enseigne fait deux cellules de large (gauche + droite) et se place au-dessus de la porte.
- Fenêtre de nuit = même dessin que la fenêtre de jour, vitre jaune allumée ; idem pour la porte.
- Toits gris : les toits du kit « maison » sont recolorés par le jeu (rouge, bleu, vert…) en gardant leurs nuances.
- Un kit qui s'écarte de cette grille (centre, boutique, arène…) le déclare dans `REGLES.kits.variantes`.

Le jeu place lui-même : la porte à sa colonne, les fenêtres symétriques de part et d'autre, le socle sur la rangée du
bas, le linteau au-dessus de la porte, l'enseigne centrée sur la porte (au demi-pixel près), la lampe à côté de la
porte, les jardinières sous les fenêtres du rez-de-chaussée, le rebord en bas du pan avant et le faîte en haut.

## 3. Les objets du décor

Un objet est **détouré**, **ancré à ses pieds** (le bas du dessin touche le bas de l'image, centré), et sa **largeur
est fixée en cases** dans `REGLES.deco` (par exemple fontaine 2,5 cases, banc 1,5, lanterne 0,75). La hauteur suit
les proportions du dessin. Un objet de plusieurs cases (`cases`) est posé à cheval sur ces cases.

Repères d'échelle : un personnage fait 1 case de large et environ 1,7 case de haut ; une porte 1 case ; un arbre 1,5.

## 4. Produire un nouveau dessin

1. Le dessiner (ou le générer) **directement à 16 pixels par case** : une tuile en 16 × 16, un objet de 2 cases en
   32 pixels de large, un kit en 64 × 64. Lumière en haut à gauche, contour sombre, fond transparent.
2. Le passer à l'outil : `python3 tools/odyssee-atelier.py normaliser dessin.png --deco fontaine` (ou `--tuile`,
   `--kit maison`). Il retrouve la grille d'un faux pixel art, enlève le fond, met l'alpha en tout ou rien,
   ramène à la bonne taille et à la palette, et écrit le résultat au bon endroit.
3. Ouvrir l'atelier pour vérifier, puis la vitrine pour voir l'élément en place.

Pour un générateur (Retro Diffusion, PixelLab…), décrire le style plutôt que donner une image d'un jeu existant :
« top-down RPG, DS pixel art, 16 px tiles, 3/4 view, light from top-left, dark colored outlines, limited palette,
transparent background », et imposer la palette `odyssee/atelier/palette.png` quand l'outil le permet.

## 5. Outils

```
python3 tools/odyssee-atelier.py kits        # kits de façade du tileset → img/facades/ (16 px par cellule)
python3 tools/odyssee-atelier.py deco        # objets du tileset → img/deco/ (largeurs de REGLES.deco)
python3 tools/odyssee-atelier.py palette     # palette commune → odyssee/atelier/palette.png
python3 tools/odyssee-atelier.py rapport     # contrôle de toutes les images → odyssee/atelier/rapport.json
python3 tools/odyssee-atelier.py normaliser <image> (--tuile | --deco <nom> | --kit <nom>) [--sortie <fichier>]
```
