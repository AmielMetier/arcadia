// pokemon/adventure/net.js
// Synchronisation multijoueur temps réel sur la carte de Menton via HubBridge.
// Diffuse les positions, directions, animations de pas, Pokémon suiveurs (Follower) et défis en duel direct.

export function createAdventureNetwork({ bridge, me, onRemoteUpdate, onDuelRequest, onDuelStart, onDuelDeclined }) {
  const remotePlayers = new Map(); // id -> { id, name, color, avatar, x, y, visualX, visualY, prevX, prevY, dir, moving, leadPokeId }

  function sendToAll(payload, volatile = false) {
    if (!bridge || !bridge.send) return;
    try {
      bridge.send('all', payload, { volatile });
    } catch (e) {}
  }

  function sendToPeer(targetId, payload) {
    if (!bridge || !bridge.send) return;
    try {
      bridge.send(targetId, payload);
    } catch (e) {}
  }

  function getLeadId(player) {
    return (player && Array.isArray(player.party) && player.party[0]) ? player.party[0].id : null;
  }

  function broadcastPos(player) {
    sendToAll({
      t: 'adv_pos',
      id: me.id,
      name: me.name,
      color: me.color,
      avatar: player.avatar || 'red',
      mapId: player.mapId || 'outdoor',
      x: player.x,
      y: player.y,
      prevX: player.prevX ?? player.x,
      prevY: player.prevY ?? player.y,
      dir: player.dir,
      moving: player.moving,
      leadPokeId: getLeadId(player)
    }, true);
  }

  function broadcastJoin(player) {
    sendToAll({
      t: 'adv_join',
      id: me.id,
      name: me.name,
      color: me.color,
      avatar: player.avatar || 'red',
      mapId: player.mapId || 'outdoor',
      x: player.x,
      y: player.y,
      prevX: player.prevX ?? player.x,
      prevY: player.prevY ?? player.y,
      dir: player.dir,
      leadPokeId: getLeadId(player)
    }, false);
  }

  function sendDuelRequest(targetPlayerId) {
    sendToPeer(targetPlayerId, {
      t: 'adv_duel_req',
      to: targetPlayerId,
      from: me.id,
      name: me.name
    });
  }

  function sendDuelAccept(requesterId, myParty) {
    sendToPeer(requesterId, {
      t: 'adv_duel_acc',
      to: requesterId,
      from: me.id,
      name: me.name,
      party: myParty
    });
  }

  function sendDuelDecline(requesterId) {
    sendToPeer(requesterId, {
      t: 'adv_duel_dec',
      to: requesterId,
      from: me.id,
      name: me.name
    });
  }

  if (bridge && bridge.on) {
    bridge.on('msg', (arg1, arg2) => {
      // HubBridge émet ('msg', fromId, payload). On supporte aussi (payload) en fallback.
      const msg = (arg2 && typeof arg2 === 'object') ? arg2 : arg1;
      if (!msg || typeof msg !== 'object') return;

      if (msg.t === 'adv_join' && msg.id !== me.id) {
        const existing = remotePlayers.get(msg.id) || {
          id: msg.id,
          visualX: msg.x,
          visualY: msg.y
        };
        existing.name = msg.name;
        existing.color = msg.color;
        existing.avatar = msg.avatar || 'blue';
        existing.mapId = msg.mapId || 'outdoor';
        existing.x = msg.x;
        existing.y = msg.y;
        existing.prevX = msg.prevX ?? msg.x;
        existing.prevY = msg.prevY ?? msg.y;
        existing.dir = msg.dir || 'down';
        existing.moving = false;
        existing.leadPokeId = msg.leadPokeId || null;
        remotePlayers.set(msg.id, existing);

        // Renvoyer notre propre position au nouvel arrivant
        sendToPeer(msg.id, {
          t: 'adv_pos',
          id: me.id,
          name: me.name,
          color: me.color,
          avatar: me.avatar || 'red',
          mapId: me.mapId || 'outdoor',
          x: me.x || 6,
          y: me.y || 9,
          prevX: me.prevX || 6,
          prevY: me.prevY || 9,
          dir: me.dir || 'down',
          moving: false,
          leadPokeId: me.leadPokeId || null
        });
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
        if (rp.mapId !== (msg.mapId || 'outdoor')) {
          rp.visualX = msg.x;
          rp.visualY = msg.y;
        }
        if (rp.x !== msg.x || rp.y !== msg.y) {
          rp.prevX = rp.x ?? msg.x;
          rp.prevY = rp.y ?? msg.y;
        }
        rp.name = msg.name || rp.name;
        rp.color = msg.color || rp.color;
        rp.avatar = msg.avatar || rp.avatar || 'blue';
        rp.mapId = msg.mapId || 'outdoor';
        rp.x = msg.x;
        rp.y = msg.y;
        rp.dir = msg.dir;
        rp.moving = !!msg.moving;
        if (msg.leadPokeId !== undefined) rp.leadPokeId = msg.leadPokeId;
        if (onRemoteUpdate) onRemoteUpdate(Array.from(remotePlayers.values()));
      }

      if (msg.t === 'adv_duel_req' && (msg.to === me.id || msg.to === undefined)) {
        if (onDuelRequest) onDuelRequest({ fromId: msg.from, fromName: msg.name });
      }

      if (msg.t === 'adv_duel_acc' && (msg.to === me.id || msg.to === undefined)) {
        if (onDuelStart) {
          onDuelStart({
            opponentId: msg.from,
            opponentName: msg.name || 'Dresseur',
            opponentParty: msg.party || (msg.poke ? [msg.poke] : [])
          });
        }
      }

      if (msg.t === 'adv_duel_dec' && (msg.to === me.id || msg.to === undefined)) {
        if (onDuelDeclined) onDuelDeclined({ fromId: msg.from, fromName: msg.name || 'Le dresseur' });
      }
    });

    bridge.on('roster', () => {
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
