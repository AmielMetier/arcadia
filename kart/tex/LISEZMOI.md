# Textures photo de Cyber Kart GP

Toutes ces textures viennent de **[Poly Haven](https://polyhaven.com/textures)**, sous licence **CC0** (domaine public :
utilisation libre, même commerciale, sans obligation de citer la source). Elles ont été réduites (1024 px pour la couleur,
512 px pour le relief), recompressées et parfois retouchées (couleurs plus vives pour l'herbe, sable éclairci…).

| Fichier | Texture d'origine (Poly Haven) | Utilisée pour |
|---|---|---|
| `asphalt` | asphalt_04 (assombrie) | routes goudronnées |
| `concrete` | concrete_wall_008 | murs et gradins du Grand Circuit |
| `brick` | red_brick_03 | bâtiments en briques |
| `grass` | leafy_grass (plus verte) | herbe des terrains |
| `dirt` | dry_ground_rocks | terre et tout-terrain |
| `rock` | mossy_rock | falaises et rochers |
| `bark` | bark_brown_02 | troncs d'arbres |
| `snow` | snow_01 | neige de Whisky Peak |
| `sand` | coast_sand_01 (éclairci) | plage, fond des Abysses |
| `chalk` | rock_boulder_dry | falaises et arches de la plage |
| `planks` | wood_planks | pontons |
| `stone` | stone_wall | pierres du temple de la jungle |
| `trail` | rocky_trail | chemins de la jungle |
| `cwall` | castle_wall_slates | murs du château |
| `gravel` | rocks_ground_01 | gravier du jardin hanté |

`<nom>.jpg` = couleur, `<nom>_n.jpg` = relief (normal map au format OpenGL). Chaque circuit ne charge que celles qu'il utilise ;
si un fichier manque, la texture dessinée par le code reste affichée. Pour en changer : remplacer le fichier en gardant le même nom.
