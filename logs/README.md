# 📋 Logs & Diagnostic Crash / Expulsion — Game Hub

Ce dossier centralise les **journaux de crashs (`CRASH_*`)** et les **raisons d'expulsion ou de déconnexion d'un joueur (`EXP_*`)** pour le **Game Hub** et l'ensemble des **11 jeux** intégrés.

---

## 📁 Structure du dossier

- [`logs/index.html`](index.html) : **Centre de diagnostic interactif** (accessible depuis le bouton **📋 Logs & Crashs** du Hub ou via `/logs/`). Permet de filtrer les incidents en temps réel par jeu, d'inspecter les piles d'appels (`stack trace`) et métriques réseau (`ping`, `lag`, `hid`, `buffered`), et d'exporter les rapports.
- [`logs/crash/README.md`](crash/README.md) : **Référentiel complet des causes de crash d'un jeu et d'expulsion d'un joueur** (analyse technique du Hub, du relais WebSocket et des 11 jeux).
- [`logs/crash/reasons-catalog.json`](crash/reasons-catalog.json) : Catalogue JSON structuré des codes d'incidents (`CRASH_*` et `EXP_*`) et des règles de diagnostic par jeu.
- [`logs/crash/latest.json`](crash/latest.json) : Derniers événements de crash et d'expulsion enregistrés (mis à jour automatiquement via `POST /api/log`).
- [`logs/crash/crash-events.jsonl`](crash/crash-events.jsonl) : Journal chronologique au format JSON Lines (`.jsonl`).

---

## ⚡ Résumé rapide des codes d'incidents

### 🔴 1. Codes de Crash d'un jeu (`CRASH_*`)

| Code | Sévérité | Description & Cause principale |
| :--- | :---: | :--- |
| `CRASH_JS_ERROR` | Critique | Exception JavaScript non interceptée (`TypeError`, `ReferenceError`, `RangeError`) dans la boucle `update`/`render` ou lors du traitement d'un message réseau. |
| `CRASH_UNHANDLED_REJECTION` | Erreur | Promesse rejetée non gérée (échec de chargement d'un asset JSON/GLTF/Audio ou police Canvas). |
| `CRASH_WEBGL_CONTEXT_LOST` | Critique | Perte du contexte GPU WebGL (`webglcontextlost`) provoquant un écran noir ou figé dans les jeux 3D/WebGL (`kart`, `convoy`, `golf`, `minigolf`, `bastion`, `pokemon`). |
| `CRASH_ASSET_LOAD_ERROR` | Erreur | Script JS, module ES ou spritesheet critique introuvable (`404`) ou coupé par le réseau au lancement. |
| `CRASH_IFRAME_LOAD_FAIL` | Critique | L'iframe du jeu n'a pas envoyé le signal `hello` au Hub dans le délai de garde de `15 s` (`hub/hub.js`). |

### 🟠 2. Codes d'Expulsion / Déconnexion d'un joueur (`EXP_*`)

| Code | Catégorie | Pourquoi le joueur est expulsé de la partie ou du salon |
| :--- | :---: | :--- |
| `EXP_HOST_KICK` | Kick | **Expulsion manuelle par l'hôte** via le bouton `✕` du salon (`room.kick(id, reason)` dans `shared/room.js`) ou via `Net.drop(cid)` (`shared/bridge.js`). |
| `EXP_ROOM_FULL` | Capacité | **Salon ou partie complète** : le salon a déjà 6 joueurs (`DDRoom.MAX_PLAYERS = 6`) ou le jeu lancé a atteint sa limite propre (`4` sur Bastion/Golf, `5` sur Duo Drift/Outbreak). |
| `EXP_HOST_STOPPED_GAME` | Hôte | **Arrêt de la partie par l'hôte** : l'hôte a cliqué sur « Arrêter pour tout le monde » ou quitté la partie (`room.setGame(null)`), ce qui ferme l'iframe chez tous les invités. |
| `EXP_HOST_NOT_READY_DESYNC` | Synchro | **L'hôte n'est plus marqué `ready` dans le jeu** (`!isReady(hostId)` dans `shared/bridge.js`) : déclenche `cb.close()` chez les invités et les renvoie au salon. |
| `EXP_HOST_MIGRATION_RESET` | Hôte | **Déconnexion de l'hôte (`host_left`) et migration du salon** : le salon élit un nouvel hôte (`deriveCode`). Les jeux à état continu repris (`bastion`, `david`, `calcul`, `filrouge`, `golf`, `minigolf`, `kart`) continuent, tandis que `drift` (`patchNet` `hostChanged`) ferme la course en cours. |
| `EXP_WS_KEEPALIVE_TIMEOUT` | Réseau | **Timeout WebSocket de 30 s sur le serveur relais** (`PING_INTERVAL_MS = 30000` dans `server/server.js`) : aucune réponse `pong` reçue pendant 30 s (perte Wi-Fi/4G, veille mobile), le serveur exécute `ws.terminate()`. |
| `EXP_TAB_BACKGROUND_THROTTLE` | Navigateur | **Onglet en arrière-plan (`document.hidden = true`, `diag.hid = 1`)** : le navigateur bride les timers de l'onglet caché ; au-delà de `8 s` sur Bastion (`PRESENCE_TIMEOUT`) ou `30 s` sur le relais, le joueur passe en IA/AFK ou perd sa session. |
| `EXP_SLOW_CLIENT_OVERFLOW` | Performance | **Saturation du tampon d'envoi (`> 96 Ko`) ou PC saturé (`diag.lag > 60 ms`)** : `server/server.js` (`SLOW_CLIENT_BYTES`) et `shared/net.js` (`SEND_BUFFER_MAX = 64 Ko`) sautent les paquets volatils ; si les trames fiables s'accumulent, la connexion tombe. |
| `EXP_PEER_LEFT_MIDGAME` | Réseau | **Coupure WebSocket d'un invité en pleine partie (`peer_left`)** : dans `shared/room.js` (`onHostLeave`), le salon conserve la place du joueur (`cid = null`) pendant la partie pour permettre sa reconnexion transparente. |

---

👉 Pour l'analyse complète jeu par jeu, consulter **[`logs/crash/README.md`](crash/README.md)**.
