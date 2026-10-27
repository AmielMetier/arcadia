# Textures photo d'Island Rush

Reprises de Cyber Kart GP (`kart/tex/`) : elles viennent de **[Poly Haven](https://polyhaven.com/textures)**, sous
licence **CC0** (domaine public : utilisation libre, même commerciale, sans obligation de citer la source).

| Fichier | Texture d'origine (Poly Haven) | Utilisée pour |
|---|---|---|
| `asphalt` | asphalt_04 (assombrie) | routes, rues, carrefours ; grain des trottoirs et des places |
| `dirt` | dry_ground_rocks | chemins de terre, accotements des routes |

`<nom>.jpg` = couleur, `<nom>_n.jpg` = relief (normal map au format OpenGL). `view/roads.js` les plaque selon la
position dans le monde (4 m par photo) et les ramène à la couleur voulue d'après leur teinte moyenne : on peut remplacer
un fichier par une autre photo sans retoucher les couleurs. Si un fichier manque, un grain dessiné par le code le remplace.
