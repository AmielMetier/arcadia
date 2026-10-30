# 🛠️ Diagnostic Complet : Raisons d'un Crash de Jeu ou d'un Joueur Expulsé d'une Partie

Ce document détaille **toutes les causes techniques** pouvant provoquer :
1. **L'expulsion ou la déconnexion d'un joueur** d'une partie ou d'un salon (`EXP_*`),
2. **Le crash, l'écran noir ou le blocage d'un jeu** (`CRASH_*`) sur le Hub et dans chacun des **11 jeux**.

---

## 1. Pourquoi un joueur est expulsé d'une partie (`EXP_*`)

### A. Au niveau du Hub et du Salon (`shared/room.js`, `shared/bridge.js`, `hub/hub.js`)

1. **`EXP_HOST_KICK` — Expulsion manuelle par l'hôte (`shared/room.js:334`)**
   - **Mécanisme** : L'hôte clique sur le bouton `✕` à côté d'un joueur dans le salon (ou appelle `room.kick(id, reason)` / `Net.drop(cid)`).
   - **Effet** : L'hôte envoie `{ t: 'kicked', by, reason }` au joueur ciblé, ferme son canal (`net.drop(p.cid)`), le retire de `R.players` et diffuse la mise à jour du salon. Le joueur expulsé est renvoyé à l'accueil avec le motif exact de l'expulsion.

2. **`EXP_HOST_STOPPED_GAME` — L'hôte quitte ou arrête la partie (`hub/hub.js:304`, `hub/hub.js:396`)**
   - **Mécanisme** : Lorsqu'un hôte clique sur « Quitter / Retour au salon » depuis un jeu (`case 'exit': if (room.isHost) room.setGame(null)`) ou sur « Arrêter pour tout le monde » dans le salon.
   - **Effet** : `R.game` passe à `null` dans le message `lobby`. Chez tous les invités, `syncFrame()` appelle `closeFrame(true)`, détruisant l'iframe du jeu et ramenant immédiatement tous les joueurs dans le salon.

3. **`EXP_HOST_NOT_READY_DESYNC` — Désynchronisation de l'état `ready` de l'hôte (`shared/bridge.js:98`)**
   - **Mécanisme** : Dans les jeux utilisant `HubBridge.patchNet(Net)` (notamment **Duo Drift**), `sync()` vérifie à chaque mise à jour du salon si `H.readyMap[H.info.hostId] === H.info.game`.
   - **Effet** : Si l'hôte recharge son iframe ou sort momentanément du jeu (`!hostReady`), `bridge.js` déclenche `cb.close()` chez tous les invités, ce qui appelle `leave()` → `HubBridge.exit()` et expulse les invités de la partie.

4. **`EXP_HOST_MIGRATION_RESET` — Départ ou coupure réseau de l'hôte (`shared/room.js:223`, `shared/bridge.js:97`)**
   - **Mécanisme** : Si la connexion WebSocket de l'hôte coupe, `server/server.js` envoie `{ type: 'host_left' }` à tous les invités. `DDRoom` calcule un nouveau code de salon déterministe (`deriveCode(code, succ)`) et transfère le rôle d'hôte au joueur ayant le plus petit `id`.
   - **Effet selon le jeu** :
     - **Duo Drift (`drift`)** : `hostChanged` (`openedHost !== H.info.hostId`) déclenche `cb.close()` dans `shared/bridge.js`, fermant la course et ramenant les joueurs au salon.
     - **Cyber Kart GP (`kart`)** : si une course était en cours (`UI.screen === 'race'`), `endRaceLocal()` arrête la course et ramène tout le monde à la sélection du circuit (`LOBBY.phase = 'map'`).
     - **Bastion Clash, DavidSimulator, Tête de Calcul, Fil Rouge, Birdie Party, Mini-Golf, Poké Duel** : le nouvel hôte reprend la partie à partir du dernier état reçu (`backupState` / `session.state`).

5. **`EXP_ROOM_FULL` — Salon complet ou limite de joueurs du jeu atteinte (`shared/room.js:95`, `server/server.js:270`, `drift/index.html:2016`)**
   - **Mécanisme** :
     - Le salon global refuse au-delà de `6 joueurs` (`MAX_PLAYERS = 6`, `maxPeers = 5` invités).
     - Certains jeux ont une limite inférieure : **Duo Drift** (`5 joueurs max`, `drift/index.html:2016` renvoie `{ t: 'full' }` + `Net.drop(cid)` au 6e joueur), **Bastion Clash** (`4 joueurs max`), **Birdie Party** (`4 joueurs max`), **Outbreak** (`5 joueurs max`), **DavidSimulator 2v2** (`4 joueurs max`).

---

### B. Au niveau du Serveur Relais WebSocket & du Navigateur (`server/server.js`, `shared/net.js`)

6. **`EXP_WS_KEEPALIVE_TIMEOUT` — Coupure par le serveur relais après 30 s sans réponse (`server/server.js:302`)**
   - **Mécanisme** : Le serveur relais envoie un ping WebSocket toutes les `30 000 ms` (`PING_INTERVAL_MS`). Si `ws.isAlive` est toujours `false` au cycle suivant, le serveur appelle `leaveCurrentRoom(ws)` et `ws.terminate()`.
   - **Effet** : Le serveur envoie `{ type: 'peer_left', cid }` à l'hôte (ou `host_left` si c'était l'hôte), expulsant le joueur de la session réseau.

7. **`EXP_TAB_BACKGROUND_THROTTLE` — Onglet en arrière-plan ou téléphone verrouillé (`shared/room.js:55`, `bastion/main.js:216`)**
   - **Mécanisme** : Lorsqu'un joueur change d'onglet ou verrouille son écran (`document.hidden === true`, remonté dans `diag.hid = 1`), les navigateurs modernes brident les timers JS (`setTimeout`/`setInterval` limités à 1 fois/seconde ou suspendus après quelques minutes).
   - **Effet** :
     - Dans **Bastion Clash** (`PRESENCE_TIMEOUT = 8000 ms`), après 8 s sans message (`gping`), le joueur passe en statut `AFK` et un bot prend le contrôle de ses troupes.
     - Sur mobile (iOS Safari / Chrome Android), la mise en arrière-plan coupe la socket WebSocket après 30 s (`EXP_WS_KEEPALIVE_TIMEOUT`).

8. **`EXP_SLOW_CLIENT_OVERFLOW` — Connexion trop lente ou PC saturé (`server/server.js:45`, `shared/net.js:285`)**
   - **Mécanisme** :
     - Côté client (`shared/net.js`), si `ws.bufferedAmount > 64 Ko` (`SEND_BUFFER_MAX`) ou si la sonde RTT dépasse `baseLat + 150 ms`, les paquets d'état volatils sont jetés (`stats.dropped++`).
     - Côté serveur (`server/server.js`), si `ws.bufferedAmount > 96 Ko` (`SLOW_CLIENT_BYTES`) ou `lagging(ws)`, le relais saute les mises à jour d'état pour ce joueur. Si son PC accumule un fort retard d'affichage (`diag.lag > 60 ms`), il subit des téléportations ou finit par décrocher.

---

## 2. Diagnostic Jeu par Jeu (les 11 jeux du Hub)

| Jeu | ID | Max Joueurs | Moteur | Raisons principales de Crash (`CRASH_*`) | Raisons principales d'Expulsion (`EXP_*`) |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **Duo Drift** | `drift` | 5 | Canvas 2D | Contexte 2D saturé sur très grands circuits urbains ; erreur audio WebAudio. | `EXP_ROOM_FULL` si 6 joueurs dans le salon (limite à 5 dans `drift/index.html:2016`) ; `EXP_HOST_MIGRATION_RESET` et `EXP_HOST_NOT_READY_DESYNC` ferment la course via `patchNet` (`cb.close()` → `leave()`). |
| **Poké Duel** | `pokemon` | 6 | Phaser 3 + DOM | `CRASH_WEBGL_CONTEXT_LOST` sur Phaser ; texture ou tileset (`map_outdoor_base.png`, `chars_overworld.png`) manquant ; état d'aventure désynchronisé. | `EXP_HOST_STOPPED_GAME` si l'hôte quitte le tournoi ou l'aventure ; déconnexion d'un adversaire en plein match d'arène 3v3 (`forfeit`). |
| **Cyber Kart GP** | `kart` | 6 | Three.js (WebGL) | `CRASH_WEBGL_CONTEXT_LOST` (7 circuits 3D riches en géométrie et shaders) ; mémoire GPU insuffisante sur mobile. | `EXP_HOST_MIGRATION_RESET` interrompt la course en cours (`endRaceLocal()`) et renvoie au choix du circuit ; joueur parti remplacé par IA (`kart/index.html:5602`). |
| **Bastion Clash** | `bastion` | 4 | Three.js + Canvas | `CRASH_WEBGL_CONTEXT_LOST` sur le décor 3D ; dépassement mémoire si des centaines d'unités/projectiles s'accumulent. | `PRESENCE_TIMEOUT = 8000 ms` (`bastion/main.js:216`) : 8 s sans paquet `gping` bascule le joueur en `AFK` (remplacé par un bot) ; limite stricte à 4 joueurs (`2` en mode `1v1`). |
| **Outbreak : Secteur Zéro** | `outbreak` | 5 | Canvas 2D | Échec de chargement d'une planche de sprites ou d'un secteur ; exception dans la boucle `sim.step(DT)`. | Limite à 5 joueurs ; seuls les joueurs ayant envoyé `signalReady()` au moment de `startRun()` sont intégrés à l'escouade (`outbreak/app.js:131`). |
| **Convoy Storm** | `convoy` | 6 | Three.js (WebGL) | `CRASH_WEBGL_CONTEXT_LOST` (`showNoGL()` affiché si WebGL indisponible ou perdu en cours de tempête). | Joueur non prêt (`!p.ready`) au lancement de `startRun()` (`convoy/app.js:144`) non embarqué sur le train ; perte de l'hôte interrompt l'expédition. |
| **DavidSimulator** | `david` | 6 (4 en 2v2) | DOM / SVG / 3D | Erreur de sérialisation d'état lors d'une enchère ou d'un échange simultané. | Limite de 4 joueurs en mode `2v2` ; joueur déconnecté pendant son tour voit ses actions reprises ou passées. |
| **Tête de Calcul** | `calcul` | 6 (8 avec bots) | DOM / JS | Exception lors de l'évaluation du mini-interpréteur Python/SQL en mode *The Candidate*. | Élimination (« coupé ») à la fin d'un tour en mode *The Candidate* (`cut: 1`) ou perte de toutes ses vies (`lives = 0`) en mode *Péril*. |
| **Fil Rouge** | `filrouge` | 6 | Three.js + DOM | Police `Bungee` / `Chakra Petch` bloquée ou perte WebGL sur le rendu 3D de la bombe. | Nécessite au moins 2 joueurs ; si un démineur ou expert quitte en duel 2v2, l'équipe est déséquilibrée. |
| **Birdie Party** | `golf` | 4 | Three.js (WebGL) | `CRASH_WEBGL_CONTEXT_LOST` (`golf/app.js:27` : *« Affichage 3D interrompu : recharge la page »*). | Limite stricte à 4 joueurs ; confirmation d'abandon de l'hôte (`leaveGame()`) arrête le parcours pour les 4 joueurs. |
| **Mini-Golf Party** | `minigolf` | 6 | Three.js (WebGL) | `CRASH_WEBGL_CONTEXT_LOST` ou baisse automatique en qualité `low` (`perfWatch`). | Timer de tour expiré (`turnEnds`, 45 s par défaut) ; si un joueur quitte pendant son coup (`minigolf/js/main.js:742`), son état passe à `done[id] = 'left'` et son tour est sauté (`hostNextTurn()`). |

---

## 3. Comment consulter et exporter les logs

1. **Depuis Arcadia** : cliquez sur **📋 Logs & Crashs** sur l'écran d'accueil ou **📋 Logs** dans la barre supérieure du salon.
2. **En ligne / localement** : ouvrez `/logs/` (`logs/index.html`).
3. **Automatiquement sur disque (mode développement / serveur)** :
   - Lorsque vous lancez `node tools/serve.mjs 8000` ou `node server/server.js`, chaque crash ou expulsion capturé par `shared/logger.js` est envoyé en `POST /api/log` et inscrit automatiquement dans :
     - `logs/crash/latest.json`
     - `logs/crash/crash-events.jsonl`
4. **Depuis la console développeur (F12)** :
   - `DDLogger.getAll()` : retourne la liste complète des crashs et expulsions enregistrés.
   - `DDLogger.logCrash(code, message, extra)` : enregistre manuellement un crash.
   - `DDLogger.logExpulsion(code, message, extra)` : enregistre manuellement une expulsion.
