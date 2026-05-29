// ===========================================================================
// PixelClash — main entry point.
// Boots Phaser, opens a connection to the game server, and loads the arena.
// ===========================================================================

import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "./config.js";
import ArenaScene from "./scenes/ArenaScene.js";
import NetClient from "./net/NetClient.js";
import { WebSocketConnection } from "./net/WebSocketConnection.js";

// Create the connection + client BEFORE the game, so the arena can use it.
const conn = new WebSocketConnection();
const net = new NetClient(conn);

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: COLORS.bg,
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scene: [ArenaScene],
};

const game = new Phaser.Game(config);
game.registry.set("net", net); // hand the network client to the scenes

// Expose for automated tests and for poking around in the browser console.
window.PIXELCLASH = { game, net };
