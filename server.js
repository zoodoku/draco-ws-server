// server.js
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;

// Map: gameId -> Set of connected clients
const rooms = new Map();

function joinRoom(ws, gameId) {
  if (!rooms.has(gameId)) rooms.set(gameId, new Set());
  rooms.get(gameId).add(ws);
  ws._gameId = gameId;
}

function leaveRoom(ws) {
  const g = ws._gameId;
  if (!g) return;
  const set = rooms.get(g);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(g);
  }
  ws._gameId = null;
}

// Broadcast innerhalb eines Raums
function broadcastInRoom(gameId, data, except = null) {
  const set = rooms.get(gameId);
  if (!set) return;
  for (const client of set) {
    if (client === except) continue;
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}

const wss = new WebSocketServer({ port: PORT });

console.log("WebSocket server running on port", PORT);

wss.on("connection", (ws) => {
  ws._playerId = null;
  ws._gameId = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); }
    catch { return; }

    if (msg.type === "join") {
      const gameId = String(msg.gameId || "").trim();
      const playerId = String(msg.playerId || "").trim();
      if (!gameId || !playerId) return;

      leaveRoom(ws);

      ws._playerId = playerId;
      joinRoom(ws, gameId);

      ws.send(JSON.stringify({
        type: "joined",
        gameId,
        playerId
      }));

      return;
    }

    // Ab hier: Aktionen nur wenn in Raum
    const gameId = ws._gameId;
    if (!gameId) return;

    // Board-Events
    if (msg.type === "cardDrop" || msg.type === "cardRemove") {
      msg.gameId = gameId;
      msg.playerId = ws._playerId;
      broadcastInRoom(gameId, JSON.stringify(msg), ws);
      return;
    }
  });

  ws.on("close", () => leaveRoom(ws));
});
