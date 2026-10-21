# Ajouter un jeu au Game Hub

Ce guide explique comment un jeu s'intègre au Hub, à partir de l'exemple de **Tête de Calcul** (`calcul/`).
Il complète [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Comment ça marche

```
index.html (Hub)                         calcul/index.html (dans une iframe)
├── shared/net.js   connexion PeerJS     ├── shared/bridge.js   → window.HubBridge
├── shared/room.js  salon, chat, pings   ├── app.js             rôle hôte / invité / solo
├── hub/games.js    registre des jeux    ├── net/host.js        l'hôte fait autorité
└── hub/hub.js      lance l'iframe  ◄──postMessage──►  net/client.js  envoie des intentions
```

- Le **Hub** garde la connexion et le salon pendant toute la session. Changer de jeu ne coupe rien.
- Le jeu choisi est chargé dans une **iframe** avec `?hub=1&role=host|guest|solo&game=<id>&code=…` (et `&local`, `&debug` s'ils sont dans l'adresse du Hub).
- Le jeu ne parle **jamais** au réseau directement : il passe par `window.HubBridge` (`shared/bridge.js`).
- **L'hôte fait autorité** : il tient l'état, applique les règles et diffuse le résultat. Les invités n'envoient que des intentions.
- Ouvert sans le Hub (`calcul/` directement), le jeu doit rester jouable seul (`HubBridge.embedded === false`, rôle `solo`).

## 2. L'interface `HubBridge`

| Appel | Rôle |
|---|---|
| `H.embedded` | `true` si le jeu est dans le Hub |
| `H.on('init', fn)` | appelé une fois avec `info = { role, myId, hostId, code, game, settings }` |
| `H.on('roster', fn)` | la liste des joueurs a changé (`H.players`, `H.readyMap`). Sert aussi à détecter une **migration d'hôte** (`H.info.role` devient `'host'`) |
| `H.on('msg', (from, m) => …)` | message d'un autre joueur. `from` est l'identifiant donné par le salon : **c'est la seule identité fiable** |
| `H.signalReady()` | « mon jeu écoute » : à appeler après avoir branché `on('msg')`. Le Hub affiche « En jeu » et `H.readyMap[id] === '<id du jeu>'` |
| `H.send(to, m)` | `to` = id d'un joueur, `'host'` ou `'all'`. `m` doit être un objet JSON |
| `H.report(r)` | fin de partie (hôte ou solo seulement) : classement pour l'historique et le 🏆 |
| `H.exit()` | retour au salon (l'hôte arrête la partie pour tout le monde) |

Format de `H.report` :
```js
{ id: 'calcul-<début>-<ids>', mode: 'Classique',
  players: [{ id /* null pour un bot */, name, color, bot, rank /* 1 = vainqueur */, score }] }
```

## 3. Les fichiers à créer

```
calcul/
├── index.html         charge ../shared/bridge.js puis app.js (module)
├── calcul.css         styles (reprend les jetons de DavidSimulator : --ink, --paper, Bungee…)
├── app.js             démarrage : rôle, joueur courant, session, vue, migration d'hôte
├── engine/            moteur PUR (aucun DOM, aucun réseau) → testable sous Node
│   ├── rng.js         aléa reproductible (copié de DavidSimulator)
│   ├── expr.js        lecture des nombres et des expressions (sans eval)
│   ├── questions.js   générateur de questions par catégorie et difficulté
│   ├── rules.js       createGame, nextQuestion, answer, reveal, publicState…
│   └── bot.js         réponses et délais des bots
├── net/
│   ├── host.js        état, minuteurs, jugement des réponses, bots, rapport de fin
│   └── client.js      envoie { t:'ans' }, reçoit l'état
└── view/
    ├── game.js        écrans : avant-partie, question, révélation, podium
    ├── emotes.js      réactions (+ réactions des bots)
    ├── sfx.js         sons synthétisés WebAudio
    └── util.js        petits outils (copié de DavidSimulator)
tools/test-calcul.mjs  tests du moteur : node tools/test-calcul.mjs
```

Le squelette de `app.js` est le même pour tous les jeux « au tour par tour » ou « à manches » :

```js
const H = window.HubBridge;
function boot(info) {
  const role = H.embedded ? info.role : 'solo';
  const me = { id: H.embedded ? info.myId : 0, name: …, color: … };
  const view = mountGame(root, { me, answer: (v) => session.answer(v), start: () => session.start(), exit: () => H.embedded ? H.exit() : location.reload() });
  let session = role === 'guest' ? startClient({ bridge: H, … }) : startHost({ bridge: H, solo: role === 'solo', settings: info.settings, me, … });
  H.on('roster', () => { /* si je deviens hôte : startHost({ …, initial: session.state }) */ });
  H.signalReady();
}
if (H.embedded) H.on('init', boot); else boot({ role: 'solo', myId: 0 });
```

## 4. Le protocole de Tête de Calcul

| De → vers | Message | Sens |
|---|---|---|
| invité → hôte | `{ t:'ans', i, v }` | réponse `v` à la question n° `i` |
| invité → hôte | `{ t:'sab', power, target }` | lancer un pouvoir de sabotage (pendant la révélation) |
| invité → hôte | `{ t:'emote', id }` | réaction |
| invité → hôte | `{ t:'sync' }` | « renvoie-moi l'état » (arrivée en cours, nouvel hôte) |
| hôte → tous | `{ t:'setup', s }` | salle d'avant-partie (joueurs prêts, réglages) |
| hôte → tous | `{ t:'st', s, now }` | état public + heure de l'hôte (pour caler les chronos) |
| hôte → un | `{ t:'ack', i, locked }` / `{ t:'err', msg, soft }` | réponse reçue / refusée |
| hôte → tous | `{ t:'emo', from, id }` | réaction à afficher |

Déroulé : `intro` (3,5 s) → `question` (chrono) → `reveal` (5 s) → … → `over`.
L'hôte a **un seul minuteur**, réglé sur `state.endsAt`. Quand tout le monde a répondu, il révèle après 0,7 s.

Anti-triche : pendant une question, `publicState()` retire la réponse attendue, les réponses des autres et leur justesse.
Les invités ne voient que « a répondu ». La réponse n'est envoyée qu'à la révélation.

Reprise : la question n° i ne dépend que de `state.seed`, de i et de la difficulté. Si l'hôte part, le nouvel hôte
reprend le dernier état reçu et relance la question en cours (`restartQuestion`).

## 5. Brancher le jeu sur le Hub (3 fichiers à modifier)

1. **`hub/games.js`** : ajouter une entrée au tableau `HUB_GAMES`.
   ```js
   { id: 'calcul', title: 'Tête de Calcul', tag: '…', desc: '…', url: 'calcul/',
     minPlayers: 1, maxPlayers: 6, accent: '#ff5fa2',
     settings: [ { key: 'mode', label: 'Mode', options: [['classic', 'Classique'], …], def: 'classic' }, … ],
     cover: `<svg viewBox="0 0 320 180">…</svg>` }
   ```
   - `settings` : le Hub affiche les boutons, mémorise le choix et le passe au jeu dans `info.settings`
     (les valeurs numériques arrivent en nombres). Un réglage avec la clé `bots` est filtré pour ne pas dépasser `maxPlayers`.
     `group` ajoute un intertitre (ex. « Règles maison »).
   - `maxPlayers` ≤ 6 (capacité du salon, `DDRoom.MAX_PLAYERS`).
   - `cover` : SVG 320 × 180, même style (contours `#16181d` de 3 px, couleurs franches).
2. **`shared/results.js`** : ajouter l'id du jeu à la liste `['david', 'drift', 'bastion', 'calcul']`,
   sinon les résultats sont **rejetés** par la validation et n'apparaissent pas au classement.
3. **`hub/hub.js`** : nom du jeu dans `GNAME`, icône dans la liste des dernières parties, libellé de `scoreLabel`.
   (Bonus : `VERSION`, `README.md`, `CHANGELOG.md`.)

## 6. Tester

```bash
node tools/test-calcul.mjs
```

```bash
python3 -m http.server 8000
```

- Seul : http://localhost:8000/calcul/?debug (réglages dans l'adresse : `mode=eclair&theme=compte&len=15&diff=expert&bots=3&level=expert`).
- À plusieurs sur une seule machine : http://localhost:8000/?local dans un onglet (Créer un salon), puis
  http://localhost:8000/?local&join=CODE dans un second onglet. `?local` remplace WebRTC par un `BroadcastChannel`.
- `?debug` expose `window.__calcul` (session, vue) pour inspecter l'état depuis la console.

## 7. Mettre en ligne

Le site est statique : il suffit de pousser sur la branche publiée par GitHub Pages. Pas de build.

## 8. Pièges

- **Identité** : toujours utiliser `from` donné par le Hub, jamais un champ du message (`m.by` pourrait être falsifié).
- **`signalReady()`** après avoir branché `on('msg')`, sinon les premiers messages de l'hôte se perdent
  (le client redemande l'état toutes les 1,5 s avec `{ t:'sync' }` pour s'en protéger).
- **`report()`** une seule fois, et seulement chez l'hôte : le Hub ignore les rapports des invités.
- **Horloges** : les machines ne sont pas à l'heure ; l'hôte envoie `now` et chaque invité calcule son décalage.
  La durée de réponse est mesurée à la réception chez l'hôte (la latence pèse un peu sur les invités).
- **Sons** : le navigateur bloque l'audio avant un clic ; créer l'`AudioContext` au premier `pointerdown`.
- **État du dépôt** : `hub/games.js` contenait déjà une entrée `outbreak` (« Outbreak : Secteur Zéro ») alors que le dossier
  `outbreak/` n'existe pas : la carte s'affiche dans le salon mais le lancement ouvre une page 404.

## 9. Étendre Tête de Calcul

- **Nouvelle question** : ajouter une branche dans un générateur de `engine/questions.js` et son nom dans `KINDS`
  (ou une nouvelle catégorie dans `CATS`, `TIME`, `GEN`, `KINDS`, puis dans `THEMES` et `HARD` de `engine/bot.js`).
  Les tests vérifient que chaque type déclaré sort bien. Chaque question renvoie `text`, `answer`, `tip` et, si besoin, `sub`, `tol`
  (tolérance relative), `input: 'expr'`, `choices` (réponse en un clic : `answer` est alors l'indice du bon choix)
  ou `fig` (figure dessinée par `view/figure.js`). Les tests vérifient automatiquement que la réponse attendue est acceptée.
- **Nouveau mode** : ajouter une entrée dans `MODES` (`engine/rules.js`), son calcul de points dans `reveal()`,
  son option dans `hub/games.js`.
- **Bots** : niveaux et taux de réussite dans `SKILL` et `HARD` (`engine/bot.js`).
