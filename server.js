// ===========================================================================
// PixelClash game server.
// Run it with:  npm run server
// It opens a WebSocket on port 2567 and runs the authoritative match loop.
// Keep this Terminal window open while playing; you'll see players join/leave.
// ===========================================================================

import { WebSocketServer } from "ws";
import GameServer from "./src/net/GameServer.js";
import { NET } from "./src/config.js";

const game = new GameServer();
game.start(NET.tickHz);

const wss = new WebSocketServer({ port: NET.port });

// Wrap each raw WebSocket in our simple connection interface so GameServer
// doesn't need to know anything about the "ws" library.
wss.on("connection", (socket) => {
  const conn = {
    send: (msg) => socket.send(JSON.stringify(msg)),
    onMessage: (cb) =>
      socket.on("message", (data) => {
        try {
          cb(JSON.parse(data.toString()));
        } catch {
          /* ignore malformed messages */
        }
      }),
    onClose: (cb) => socket.on("close", cb),
    close: () => socket.close(),
  };
  const id = game.addConnection(conn);
  console.log(`[server] ${id} joined — ${game.players.size} player(s) online`);
  socket.on("close", () =>
    console.log(`[server] ${id} left — ${game.players.size} player(s) online`)
  );
});

console.log(`[server] PixelClash server listening on ws://localhost:${NET.port}`);
console.log(`[server] Ticking at ${NET.tickHz}Hz. Press Ctrl+C to stop.`);
