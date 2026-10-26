'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 8080;
const PING_INTERVAL_MS = 30000;
// Protocole 2 : trames compactes « #{en-tête}\n<données> » retransmises sans relire les données,
// et messages volatils (instantanés d'état) sautés pour un destinataire dont la connexion n'arrive plus à suivre.
const PROTO = 2;
const SLOW_CLIENT_BYTES = 96 * 1024; // tampon d'envoi au-delà duquel un destinataire ne reçoit plus les messages volatils
// Sonde de retard : un ping WebSocket toutes les 250 ms à chaque joueur. Le pong revient après tout ce qui le précède
// dans la file : s'il tarde nettement plus que d'habitude pour ce joueur, ses données s'empilent (connexion trop juste
// pour le flux, coupure wifi…) et on lui saute les instantanés d'état le temps que la file se vide.
const PROBE_MS = 250, LAG_MARGIN_MS = 150, PROBE_WINDOW = 40;

const CRASH_DIR = path.resolve(__dirname, '..', 'logs', 'crash');
const JSONL_FILE = path.join(CRASH_DIR, 'crash-events.jsonl');
const LATEST_FILE = path.join(CRASH_DIR, 'latest.json');

function appendServerLog(entry) {
  try {
    fs.mkdirSync(CRASH_DIR, { recursive: true });
    fs.appendFileSync(JSONL_FILE, JSON.stringify(entry) + '\n', 'utf8');
    let list = [];
    if (fs.existsSync(LATEST_FILE)) {
      try { list = JSON.parse(fs.readFileSync(LATEST_FILE, 'utf8')); } catch (e) { list = []; }
    }
    if (!Array.isArray(list)) list = [];
    list.unshift(entry);
    fs.writeFileSync(LATEST_FILE, JSON.stringify(list.slice(0, 200), null, 2) + '\n', 'utf8');
  } catch (e) {}
}

// Serveur HTTP minimal (healthchecks + API de collecte des logs de crash/expulsion)
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && req.url === '/api/log') {
    let body = '';
    req.on('data', (c) => { if (body.length < 32768) body += c; });
    req.on('end', () => {
      try {
        const entry = JSON.parse(body);
        if (entry && typeof entry === 'object') appendServerLog(entry);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end('{"ok":true}');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end('{"ok":false}');
      }
    });
    return;
  }
  if (req.method === 'GET' && req.url === '/api/logs') {
    let list = [];
    try { if (fs.existsSync(LATEST_FILE)) list = JSON.parse(fs.readFileSync(LATEST_FILE, 'utf8')); } catch (e) {}
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(list));
    return;
  }

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

// Envoi d'une chaîne déjà sérialisée (une seule sérialisation pour tous les destinataires).
// volatile : on saute le message si ce destinataire a déjà du retard, au lieu d'allonger sa file d'attente.
function lagging(ws) {
  const base = ws.baseLat == null ? 150 : ws.baseLat;
  if (ws.probeAt && Date.now() - ws.probeAt > base + LAG_MARGIN_MS) return true; // sonde en attente depuis trop longtemps
  return ws.lastLat != null && ws.lastLat > base + LAG_MARGIN_MS;
}
function sendRaw(ws, str, volatile) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (volatile && (ws.bufferedAmount > SLOW_CLIENT_BYTES || lagging(ws))) { ws.dropped = (ws.dropped || 0) + 1; return; }
  try { ws.send(str); } catch (e) {}
}

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

// Relais d'un paquet de jeu : vers l'hôte, vers un invité (cid) ou à toute la salle (sauf l'expéditeur et `except`).
// `data` est le JSON des données, déjà sérialisé : le paquet sortant est construit une seule fois.
function relay(ws, roomId, to, except, volatile, data) {
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room || !room.clients.has(ws)) return;
  const from = ws.cid || (ws === room.host ? 'host' : null);
  const out = '{"type":"relay","roomId":' + JSON.stringify(roomId) + ',"from":' + JSON.stringify(from) + ',"data":' + data + '}';
  if (to === 'host') {
    if (room.host && room.host !== ws) sendRaw(room.host, out, volatile);
    return;
  }
  if (typeof to === 'string' && to !== 'all') {
    const target = room.guests.get(to);
    if (target && target !== ws) sendRaw(target, out, volatile);
    return;
  }
  for (const client of room.clients) {
    if (client !== ws && (!except || client.cid !== except)) sendRaw(client, out, volatile);
  }
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.roomId = null;
  ws.role = null;
  ws.cid = null;

  ws.on('pong', () => {
    ws.isAlive = true;
    if (ws.probeAt) {
      // retard de ce joueur ; sa base est le plus petit retard des 10 dernières secondes
      ws.lastLat = Date.now() - ws.probeAt; ws.probeAt = 0;
      (ws.lats = ws.lats || []).push(ws.lastLat); if (ws.lats.length > PROBE_WINDOW) ws.lats.shift();
      ws.baseLat = Math.min(...ws.lats);
    }
  });

  ws.on('message', (raw) => {
    ws.isAlive = true;
    const text = typeof raw === 'string' ? raw : raw.toString();
    // trame compacte de relais : seul l'en-tête est lu, les données repartent telles quelles
    if (text.charCodeAt(0) === 35 /* # */) {
      const nl = text.indexOf('\n');
      if (nl < 0) return;
      let h;
      try { h = JSON.parse(text.slice(1, nl)); } catch (e) { return; }
      if (!h || typeof h !== 'object') return;
      relay(ws, ws.roomId, h.to, typeof h.x === 'string' ? h.x : null, !!h.v, text.slice(nl + 1));
      return;
    }
    let msg;
    try {
      msg = JSON.parse(text);
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
        sendJson(ws, { type: 'room_joined', roomId, role: 'host', cid: 'host', proto: PROTO });
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

      sendJson(ws, { type: 'room_joined', roomId, role: 'guest', cid, proto: PROTO });
      return;
    }

    // Relais des paquets de jeu (ancien format JSON, gardé pour les pages restées en cache)
    if (action === 'relay') {
      if (msg.data === undefined) return;
      relay(ws, roomId, msg.to, typeof msg.except === 'string' ? msg.except : null, !!msg.v, JSON.stringify(msg.data));
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
      if (ws.roomId) {
        appendServerLog({
          id: 'srv-timeout-' + Date.now(),
          ts: Date.now(),
          iso: new Date().toISOString(),
          code: 'EXP_WS_KEEPALIVE_TIMEOUT',
          category: 'EXPULSION',
          severity: 'warn',
          title: 'Joueur expulsé par le serveur relais (timeout WebSocket 30 s)',
          cause: 'Aucune réponse au ping WebSocket pendant 30 s (coupure Wi-Fi/4G ou appareil mobile verrouillé).',
          message: `Client ${ws.cid || ws.role || '?'} déconnecté du salon ${ws.roomId} après 30 s sans pong (paquets volatils sautés : ${ws.dropped || 0}).`,
          game: 'hub',
          roomCode: ws.roomId,
          role: ws.role || 'guest',
          player: ws.cid || 'Client WebSocket',
          diagnostics: { lastLat: ws.lastLat || null, baseLat: ws.baseLat || null, dropped: ws.dropped || 0, buffered: ws.bufferedAmount || 0 },
        });
      }
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

const probeInterval = setInterval(() => {
  const now = Date.now();
  for (const ws of wss.clients) {
    if (!ws.roomId || ws.probeAt || ws.readyState !== WebSocket.OPEN) continue;
    ws.probeAt = now;
    try { ws.ping(); } catch (e) {}
  }
}, PROBE_MS);

wss.on('close', () => {
  clearInterval(keepAliveInterval);
  clearInterval(probeInterval);
});

server.listen(PORT, () => {
  console.log(`Serveur relais WebSocket démarré sur le port ${PORT}`);
});
