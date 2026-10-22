# Fil Rouge — désamorçage à deux voix

Un jeu de communication asymétrique : le **démineur** voit la bombe en 3D mais n'a pas le manuel,
l'**expert** a le manuel posé devant lui sur la table mais ne voit pas la bombe. Ils doivent se parler.

- **Coopération** (1 à 6 joueurs) : une équipe, un démineur, les autres lisent le manuel.
- **Duel** (2 à 6 joueurs, typiquement 2 contre 2) : deux équipes reçoivent **la même bombe** (même graine).
  La première qui la désamorce gagne ; si une équipe saute, l'autre gagne. Chaque module désamorcé envoie
  un **sabotage** à l'équipe adverse. Le chat est réservé à l'équipe pendant la partie.
- **Seul** : on fait les deux rôles, le manuel est posé à droite de la bombe (touche M).

## Ce qui est en jeu (version 2.15)

### La pièce
Table en bois sous une suspension, tapis de découpe, caisse à outils, tasse de café, carnet, horloge, affiche de la
brigade, fenêtre sur la Baie des Anges la nuit. Éclairage avec ombres portées ; la bombe reste toujours posée sur la table,
sa hauteur suit son point le plus bas quand on la tourne.

### Commandes du démineur
| Touche | Effet |
|---|---|
| Z / S | basculer la bombe vers l'avant / l'arrière (W / S en QWERTY) |
| Q / D | la faire pivoter à gauche / à droite (A / D en QWERTY) |
| A / E | la tourner sur elle-même (Q / E en QWERTY) |
| R / F | la remettre de face / la retourner |
| Clic | sur un module : s'en approcher ; sur une pièce : agir |
| Glisser, molette | tourner, zoomer |
| Échap, clic droit | reculer |
| M | se pencher sur le manuel (seul) |
| Icônes du bandeau | tourner la bombe et zoomer sur un module, même au dos |

Les touches de rotation sont lues par **position** (`KeyboardEvent.code`) : ZQSD en AZERTY, WASD en QWERTY.
L'aide affiche les lettres du clavier du joueur quand le navigateur les donne (`navigator.keyboard.getLayoutMap`).

### Le manuel
Un livret ouvert sur la table, avec une double page par section : consignes à gauche, table ou figure à droite.
Les onglets colorés sur la tranche mènent à chaque module. Clic sur la page de droite ou → pour avancer, sur la page de gauche ou ← pour revenir.
Molette pour zoomer, glisser pour déplacer. Les pages sont dessinées dans des canevas (`view/pages.js`) et tournent avec une vraie animation.

Le manuel est **tiré d'un numéro d'édition** (1000 à 9999) imprimé sous le chrono : chaque partie a des règles différentes,
impossible de les apprendre par cœur.

### L'extérieur de la bombe
- **N° de lot** sur un flanc (`K7R-42F`), à côté d'un autocollant « NE PAS SECOUER » (décor).
- **0 à 3 tampons** de villes de la Côte (NICE, MENTON, GRASSE, ANTIBES, CANNES, VENCE), encre rouge ou bleue, sur le flanc, le dessus ou le dessous.
- **Vis** aux coins de la face avant : 0 à 3 manquantes.
- Six conditions en découlent (dernier chiffre du lot pair, voyelle dans le lot, au moins deux tampons, tampon rouge, vis manquante, tampon NICE).

### Les six modules
| Module | Ce que voit le démineur | Ce que dit le manuel |
|---|---|---|
| ✂️ Raccordements | 4 à 6 fils entre des bornes A–F et 1–6 | grille lettre × chiffre : couper, laisser, couper si couleur, couper si condition |
| 🔐 Coffre | 3 symboles sans nom, une molette 0–9 | valeur de chaque symbole, + nombre de tampons au 1er chiffre, ordre inversé si condition |
| 🎚️ Leviers | un code, 5 leviers, 5 LED | position de chaque levier par code ; LED d'une couleur donnée = inverser |
| 🎵 Carillon | 4 notes à écouter, 4 touches de couleur | 8 mélodies dessinées sur des portées → ordre des touches, inversé si condition |
| 🚰 Tuyauterie | grille 4 × 4 de tuyaux à faire pivoter, vanne colorée, sorties I–IV | sortie selon couleur de la vanne et une condition |
| ⏲️ Manomètres | 3 cadrans colorés (pression 0–9), 3 molettes | réglage selon couleur × pression |

Chaque faute allume un voyant, accélère le chrono de 25 % et, pour le coffre et le carillon, remet le module à zéro.

| Difficulté | Modules | Chrono |
|---|---|---|
| Initiation | 2 (raccordements, manomètres) | 5:00 |
| Facile | 3 | 5:00 |
| Moyen | 5 | 5:30 |
| Difficile | 7 (les six + un en double) | 6:30 |

Dès 3 modules, au moins un est au dos : il faut retourner la bombe.

### Sabotages (duel)
⚡ coupure de courant (lampe éteinte 5 s), 💨 fumigène (brouillard), 🫨 secousse, 🖋️ encre renversée sur le manuel.

## Architecture

```
filrouge/
├── index.html, fil.css, app.js     démarrage : rôle hôte / invité / solo, migration d'hôte
├── engine/                          moteur pur (aucun DOM), testé par tools/test-filrouge.mjs
│   ├── rng.js                       aléa reproductible (copié de Tête de Calcul)
│   ├── runes.js                     les 24 symboles du coffre (traits), en SVG et sur canevas
│   ├── manual.js                    makeManual(édition) : toutes les tables et règles d'une édition
│   ├── modules.js                   les 6 modules : gen / expect / act / solution ; makeBomb
│   └── rules.js                     createGame, act, tick, dropPlayer, rebase, solutionOf
├── net/host.js, net/client.js       l'hôte fait autorité ; chat relayé à l'équipe seulement en duel
└── view/
    ├── scene.js                     la pièce, la caméra, la rotation, le clic, les sabotages, l'explosion
    ├── bomb3d.js                    le boîtier et les 6 modules en 3D (pièces cliquables : userData.pick)
    ├── book3d.js, pages.js          le livret 3D et ses pages dessinées
    ├── manual.js                    manuel HTML de secours (navigateur sans WebGL)
    ├── game.js                      avant-partie, bandeau, chat, fin de partie
    ├── tex.js                       textures dessinées (bois, plâtre, nuit, étiquettes)
    └── sfx.js                       sons synthétisés
```

Protocole :

| De → vers | Message | Sens |
|---|---|---|
| invité → hôte | `{ t:'pick', team?, role? }` | choix d'équipe ou de rôle avant la partie |
| invité → hôte | `{ t:'act', m, op, i, d }` | manipulation du module n° m (`cut`, `dial`, `enter`, `flip`, `submit`, `key`, `rot`, `open`, `knob`) |
| invité → hôte | `{ t:'chat', text }` / `{ t:'sync' }` | message d'équipe / « renvoie l'état » |
| hôte → tous | `{ t:'setup', s }` | équipes, rôles, réglages |
| hôte → tous | `{ t:'st', s, now, ev }` | état complet + événements (`strike`, `solve`, `defused`, `boom`, `sab`, `promote`, `over`) |
| hôte → équipe | `{ t:'chat', from, name, color, text, team }` | message relayé |

Les chronos sont stockés comme `{ left, at, rate }` (temps restant à l'instant `at`, vitesse) : une faute recale `left`
et augmente `rate`. Un nouvel hôte recale `at` sur son horloge (`rebase`). Un démineur qui quitte le salon est remplacé
par un coéquipier ; une équipe vide abandonne.

---

## Propositions pour la suite

### Nouveaux modules
1. **Télégraphe à cadran** : une aiguille pointe des lettres en séquence ; l'expert reconstitue un mot dans un lexique et donne la fréquence à régler.
2. **Fusibles** : une rangée de fusibles dont certains sont grillés (visibles seulement en penchant la bombe) ; l'ordre de remplacement dépend du nombre de vis manquantes.
3. **Labyrinthe à billes** : une bille dans un plateau qu'on fait rouler en **inclinant toute la bombe** avec Z/Q/S/D. L'expert a le plan des trous.
4. **Tiroir secret** : un module qui ne s'ouvre qu'en tournant la bombe à l'envers ; à l'intérieur, un deuxième étage (fils ou code).
5. **Horloge mécanique** : mettre les aiguilles sur une heure calculée à partir du chrono restant et du tampon de ville.
6. **Plaque d'immatriculation** : lettres niçoises (06), l'expert applique un chiffrement (César selon la couleur du boîtier).
7. **Thermomètre / réservoir** (module « en continu ») : un niveau monte tout seul, à purger régulièrement sans faute pendant qu'on fait le reste.
8. **Clavier de pétanque** : choisir la bonne boule selon les points marqués, en clin d'œil à la Côte.
9. **Écran radio** : une phrase codée lue à voix haute par une synthèse vocale que seul le démineur entend.
10. **Câble rouge final** : quand tout est désamorcé, un dernier fil apparaît ; le couper au mauvais moment (chiffre du chrono) fait tout sauter.

### Extérieur et pièges
- **Batterie de secours** branchée sur un flanc : elle compte dans certaines règles et peut se débrancher si on secoue trop la bombe.
- **Autocollants leurres** (« NE PAS COUPER LE BLEU ») que le manuel demande d'ignorer… sauf certaines éditions.
- **Numéro de série en UV** visible seulement quand la lumière est coupée (le sabotage devient un indice).
- **Bombe asymétrique** : formats valise, caisse longue, cylindre, avec des modules sur les flancs.

### Événements pendant la partie
- **Coupure de courant** aléatoire en Difficile, même en coopération (seul l'écran du chrono éclaire).
- **Alarme** : le chrono s'affole 5 s, il faut appuyer sur un bouton caché sous la bombe.
- **Téléphone qui sonne** sur la table : un indice si on décroche, ou un piège.
- **Café renversé** sur le manuel côté expert : quelques cases illisibles, à reconstituer avec une autre page.

### Modes de jeu
- **Relais** : en coopération à 3 ou plus, le rôle de démineur tourne à chaque module désamorcé.
- **Expert aveugle partiel** : en duel, chaque expert n'a que la moitié du manuel ; les deux experts d'une équipe doivent se partager les pages.
- **Contre-la-montre** : bombes générées par une graine du jour, même bombe pour tout le monde, classement des temps.
- **Survie** : bombes enchaînées de plus en plus difficiles jusqu'à l'explosion ; le score compte les modules.
- **Campagne** : 20 bombes scénarisées autour de Nice (Port Lympia, Vieux-Nice, aéroport…), avec un nouveau module présenté à chaque chapitre.
- **Mode chaos à 6** : un démineur et cinq experts qui ont chacun **une seule section** du manuel.
- **Bombes partagées** : un code de 6 caractères (graine + difficulté) pour rejouer exactement la même bombe entre amis.

### Duel : sabotages et interactions
- Choisir son sabotage au lieu de le recevoir au hasard (jauge qui se remplit à chaque module).
- **Brouilleur** : le chat de l'équipe adverse est coupé 6 s.
- **Fausse page** : une page du manuel adverse est remplacée par celle d'une autre édition pendant 10 s.
- **Bouclier** : désamorcer le carillon sans faute protège du prochain sabotage.
- Vue « télévision » pour les joueurs éliminés ou spectateurs : les deux bombes côte à côte.

### Communication
- **Chat vocal intégré** (WebRTC audio) par équipe. Il faut ajouter `microphone` à l'attribut `allow` de l'iframe dans le Hub,
  et passer les flux audio par la connexion PeerJS existante.
- **Talkie-walkie** : appuyer sur Espace pour parler, avec un grésillement ; en duel, le sabotage « brouilleur » le coupe.
- Réponses rapides contextuelles (« Le fil A va au 4, il est rouge ») générées en cliquant sur un fil quand on est seul.

### Progression et rejouabilité
- Statistiques : modules les plus ratés, temps moyen par module, meilleur duo démineur/expert.
- Médailles : « Sans faute », « Dernière seconde » (désamorcée à moins de 3 s), « Sourd » (carillon du premier coup).
- Habillages de bombe (valise rouge, caisse de pétanque, boîte à socca) et de pièce (bureau de la brigade, cave du Vieux-Nice, cabine de bateau).
- Tableau des records par difficulté dans le classement du Hub (colonne « Secondes restantes » déjà branchée).

### Ambiance
- Musique qui monte quand le chrono passe sous 30 s, battements de cœur sous 10 s.
- Tic-tac en 3D spatialisé (plus fort quand on approche la bombe).
- Le démineur voit ses mains (gants) tenir la bombe ; la pince coupante apparaît quand on vise un fil.
- Ralenti et caméra qui recule à l'explosion ; replay des 10 dernières secondes à la fin.
- Lampe frontale en mode Difficile : seule la zone visée est bien éclairée.

### Accessibilité
- Mode daltonien : chaque couleur de fil et de touche porte aussi un motif (rayures, pois).
- Option « carillon visuel » pour jouer sans le son (les notes s'affichent en barres).
- Taille du texte du manuel réglable ; contraste élevé.
- Contrôles tactiles déjà présents (pavé de rotation) ; pincer pour zoomer à ajouter.
