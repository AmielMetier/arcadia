# Musiques de Cyber Kart GP

Déposez vos morceaux **dans ce dossier** (`kart/music/`), avec exactement ces noms :

| Fichier | Joué pendant |
|---|---|
| `menu.mp3` | écran titre, choix du circuit, choix du pilote |
| `grand-circuit.mp3` | course sur le Grand Circuit |
| `whisky-peak.mp3` | course sur Whisky Peak |
| `arc-en-ciel.mp3` | course sur la Route Arc-en-ciel |
| `jungle.mp3` | course dans la Jungle Perdue (sinon : musique du Grand Circuit) |
| `chateau-hante.mp3` | course au Château Hanté (sinon : musique de Whisky Peak) |
| `plage.mp3` | course sur la Plage des Falaises (sinon : musique de l'Arc-en-ciel) |
| `abysses.mp3` | course dans les Abysses Néon (sinon : musique de l'Arc-en-ciel) |
| `resultats.mp3` | écran de classement (facultatif : sinon la musique du circuit continue) |

- Formats acceptés : `.mp3` (essayé en premier) ou `.ogg`. Un fichier absent donne simplement du silence, sans erreur.
- Chaque morceau est **lu en boucle**. Pour une boucle sans « trou », exportez un fichier qui commence et finit sur le temps
  (pas de silence au début ni à la fin).
- **Accélération à chaque tour** : la vitesse de lecture passe à ×1,04 au tour 2, ×1,09 au tour 3, puis ×1,13 et ×1,17.
  Le morceau monte aussi un peu dans les aigus en accélérant (la musique passe par le moteur audio des bruitages).
- Réglages modifiables en haut du code de `kart/index.html`, objet `MUSIC` :
  - `tracks` : les noms de fichiers ci-dessus ;
  - `lapRate` : la vitesse de lecture tour par tour ;
  - `volume` : volume relatif de la musique.
- Le bouton **🎵** des menus (et la touche **M**) coupe ou remet la musique du jeu ; ce réglage est indépendant de la musique d'ambiance du Hub.
  Le bouton indique aussi l'état : chargement, « touchez l'écran pour le son », fichier introuvable, lecture en flux.
- Taille conseillée : 2 à 5 Mo par morceau (mp3 128 à 192 kb/s), pour que le chargement reste rapide sur GitHub Pages.
