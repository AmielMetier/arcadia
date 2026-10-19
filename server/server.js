'use strict';

const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 8080;
const PING_INTERVAL_MS = 30000;

// Serveur HTTP minimal (utile pour les healthchecks Render / Railway / Fly.io)
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Duo Drift WebSocket Relay Server OK\n');
});

const wss = new WebSocketServer({ server });

/**
 * rooms: Map<roomId, {
 *   host: WebSocket | null,
 *   guests: Map<cid, WebSocket>,
 *   clients: Set<WebSocket>,
 *   nextCid: number,
 *   maxPeers: number
 * }>
 */
const rooms = new Map();

function sendJson(ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(payload));
    } catch (e) {}
  }
}

function getOrCreateRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      host: null,
      guests: new Map(),
      clients: new Set(),
      nextCid: 0,
      maxPeers: 5,
    };
    rooms.set(roomId, room);
  }
  return room;
}

function leaveCurrentRoom(ws) {
  const roomId = ws.roomId;
  if (!roomId) return;
  ws.roomId = null;

  const room = rooms.get(roomId);
  if (!room) return;

  room.clients.delete(ws);

  if (room.host === ws) {
    room.host = null;
    // Prévenir tous les invités que l'hôte a quitté
    for (const [, guestWs] of room.guests) {
      sendJson(guestWs, { type: 'host_left', roomId });
    }
  } else if (ws.cid && room.guests.get(ws.cid) === ws) {
    room.guests.delete(ws.cid);
    // Prévenir l'hôte que cet invité a quitté
    if (room.host) {
      sendJson(room.host, { type: 'peer_left', roomId, cid: ws.cid });
    }
  }

  ws.role = null;
  ws.cid = null;

  // Nettoyage automatique des salles vides
  if (room.clients.size === 0 || (!room.host && room.guests.size === 0)) {
    rooms.delete(roomId);
  }
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.roomId = null;
  ws.role = null;
  ws.cid = null;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    ws.isAlive = true;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!msg || typeof msg !== 'object') return;

    const action = msg.type;
    const roomId = typeof msg.roomId === 'string' ? msg.roomId.trim().slice(0, 64) : ws.roomId;

    // Keep-alive applicatif
    if (action === 'ping') {
      sendJson(ws, { type: 'pong', roomId, ts: msg.ts });
      return;
    }
    if (action === 'pong') {
      return;
    }

    // Déconnexion volontaire d'un salon
    if (action === 'leave_room') {
      leaveCurrentRoom(ws);
      return;
    }

    // Association d'un joueur à un salon
    if (action === 'join_room') {
      if (!roomId) {
        sendJson(ws, { type: 'error', reason: 'invalid-room', message: 'Identifiant de salon manquant.' });
        return;
      }

      if (ws.roomId && ws.roomId !== roomId) {
        leaveCurrentRoom(ws);
      }

      const role = msg.role === 'host' ? 'host' : 'guest';

      if (role === 'host') {
        const existing = rooms.get(roomId);
        if (existing && existing.host && existing.host !== ws && existing.host.readyState === WebSocket.OPEN) {
          sendJson(ws, { type: 'error', roomId, reason: 'unavailable-id', message: 'Ce code de salon est déjà utilisé.' });
          return;
        }
        const room = getOrCreateRoom(roomId);
        room.host = ws;
        if (Number.isInteger(msg.maxPeers) && msg.maxPeers > 0) {
          room.maxPeers = msg.maxPeers;
        }
        room.clients.add(ws);
        ws.roomId = roomId;
        ws.role = 'host';
        ws.cid = 'host';
        sendJson(ws, { type: 'room_joined', roomId, role: 'host', cid: 'host' });
        return;
      }

      // Invité (guest)
      const room = rooms.get(roomId);
      if (!room || !room.host || room.host.readyState !== WebSocket.OPEN) {
        sendJson(ws, { type: 'error', roomId, reason: 'room-not-found', message: 'Aucun salon avec ce code.' });
        return;
      }
      if (room.guests.size >= room.maxPeers) {
        sendJson(ws, { type: 'error', roomId, reason: 'room-full', message: 'Le salon est complet.' });
        return;
      }

      const cid = 'c' + (++room.nextCid);
      ws.roomId = roomId;
      ws.role = 'guest';
      ws.cid = cid;
      room.guests.set(cid, ws);
      room.clients.add(ws);

      sendJson(ws, { type: 'room_joined', roomId, role: 'guest', cid });
      return;
    }

    // Relais des paquets de jeu (mouvements, tirs, états, chat, événements)
    if (action === 'relay') {
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || !room.clients.has(ws)) return;

      const packet = {
        type: 'relay',
        roomId,
        from: ws.cid || (ws === room.host ? 'host' : null),
        data: msg.data,
      };

      // Cible spécifique : vers l'hôte ou vers un invité précis (cid)
      if (msg.to === 'host') {
        if (room.host && room.host !== ws) {
          sendJson(room.host, packet);
        }
        return;
      }
      if (typeof msg.to === 'string' && msg.to !== 'all') {
        const target = room.guests.get(msg.to);
        if (target && target !== ws) {
          sendJson(target, packet);
        }
        return;
      }

      // Rediffusion générale à tous les autres joueurs présents dans la même salle
      const exceptCid = typeof msg.except === 'string' ? msg.except : null;
      for (const client of room.clients) {
        if (client !== ws && (!exceptCid || client.cid !== exceptCid)) {
          sendJson(client, packet);
        }
      }
    }
  });

  ws.on('close', () => {
    leaveCurrentRoom(ws);
  });

  ws.on('error', () => {
    leaveCurrentRoom(ws);
  });
});

// Ping/Pong (keep-alive toutes les 30 secondes) pour éviter les coupures des hébergeurs gratuits
const keepAliveInterval = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      leaveCurrentRoom(ws);
      try {
        ws.terminate();
      } catch (e) {}
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (e) {}
  }
}, PING_INTERVAL_MS);

wss.on('close', () => {
  clearInterval(keepAliveInterval);
});

server.listen(PORT, () => {
  console.log(`Serveur relais WebSocket démarré sur le port ${PORT}`);
});
