// pokemon/adventure/net.js
// Synchronisation multijoueur temps réel sur la carte de Menton via HubBridge.
// Diffuse les positions, directions, animations de pas et défis en duel direct.

export function createAdventureNetwork({ bridge, me, onRemoteUpdate, onDuelRequest, onDuelStart }) {
  const remotePlayers = new Map(); // id -> { id, name, color, x, y, visualX, visualY, dir, moving }

  function broadcastPos(player) {
    if (!bridge || !bridge.send) return;
    bridge.send({
      t: 'adv_pos',
      id: me.id,
      name: me.name,
      color: me.color,
      x: player.x,
      y: player.y,
      dir: player.dir,
      moving: player.moving
    });
  }

  function broadcastJoin(player) {
    if (!bridge || !bridge.send) return;
    bridge.send({
      t: 'adv_join',
      id: me.id,
      name: me.name,
      color: me.color,
      x: player.x,
      y: player.y,
      dir: player.dir
    });
  }

  function sendDuelRequest(targetPlayerId) {
    if (!bridge || !bridge.send) return;
    bridge.send({
      t: 'adv_duel_req',
      to: targetPlayerId,
      from: me.id,
      name: me.name
    });
  }

  function sendDuelAccept(requesterId, myActivePokemon) {
    if (!bridge || !bridge.send) return;
    bridge.send({
      t: 'adv_duel_acc',
      to: requesterId,
      from: me.id,
      poke: myActivePokemon
    });
  }

  function sendDuelDecline(requesterId) {
    if (!bridge || !bridge.send) return;
    bridge.send({
      t: 'adv_duel_dec',
      to: requesterId,
      from: me.id
    });
  }

  if (bridge && bridge.on) {
    bridge.on('msg', (msg) => {
      if (!msg || typeof msg !== 'object') return;

      if (msg.t === 'adv_join' && msg.id !== me.id) {
        // Un nouveau dresseur arrive : on l'enregistre
        const existing = remotePlayers.get(msg.id) || {
          id: msg.id,
          visualX: msg.x,
          visualY: msg.y
        };
        existing.name = msg.name;
        existing.color = msg.color;
        existing.x = msg.x;
        existing.y = msg.y;
        existing.dir = msg.dir || 'down';
        existing.moving = false;
        remotePlayers.set(msg.id, existing);

        // On lui renvoie notre propre position en réponse
        if (bridge.send) {
          bridge.send({
            t: 'adv_pos',
            id: me.id,
            name: me.name,
            color: me.color,
            x: me.x || 6,
            y: me.y || 8,
            dir: me.dir || 'down',
            moving: false
          });
        }
        if (onRemoteUpdate) onRemoteUpdate(Array.from(remotePlayers.values()));
      }

      if (msg.t === 'adv_pos' && msg.id !== me.id) {
        let rp = remotePlayers.get(msg.id);
        if (!rp) {
          rp = {
            id: msg.id,
            visualX: msg.x,
            visualY: msg.y
          };
          remotePlayers.set(msg.id, rp);
        }
        rp.name = msg.name || rp.name;
        rp.color = msg.color || rp.color;
        rp.x = msg.x;
        rp.y = msg.y;
        rp.dir = msg.dir;
        rp.moving = !!msg.moving;
        if (onRemoteUpdate) onRemoteUpdate(Array.from(remotePlayers.values()));
      }

      if (msg.t === 'adv_duel_req' && msg.to === me.id) {
        if (onDuelRequest) onDuelRequest({ fromId: msg.from, fromName: msg.name });
      }

      if (msg.t === 'adv_duel_acc' && msg.to === me.id) {
        if (onDuelStart) onDuelStart({ opponentId: msg.from, opponentPokemon: msg.poke });
      }

      if (msg.t === 'adv_duel_dec' && msg.to === me.id) {
        alert('Le dresseur a décliné le duel.');
      }
    });

    bridge.on('roster', () => {
      // Nettoyer les joueurs qui se sont déconnectés
      if (bridge.players) {
        const activeIds = new Set(bridge.players.map(p => p.id));
        for (const [id] of remotePlayers) {
          if (!activeIds.has(id)) {
            remotePlayers.delete(id);
          }
        }
        if (onRemoteUpdate) onRemoteUpdate(Array.from(remotePlayers.values()));
      }
    });
  }

  // Interpolation fluide des positions visuelles (60 FPS)
  function updateInterpolation() {
    for (const rp of remotePlayers.values()) {
      if (rp.visualX === undefined) rp.visualX = rp.x;
      if (rp.visualY === undefined) rp.visualY = rp.y;
      rp.visualX += (rp.x - rp.visualX) * 0.25;
      rp.visualY += (rp.y - rp.visualY) * 0.25;
    }
  }

  return {
    remotePlayers,
    broadcastPos,
    broadcastJoin,
    sendDuelRequest,
    sendDuelAccept,
    sendDuelDecline,
    updateInterpolation,
    getPlayersList: () => Array.from(remotePlayers.values())
  };
}
