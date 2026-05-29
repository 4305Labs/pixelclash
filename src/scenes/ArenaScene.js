// ===========================================================================
// ArenaScene — the playing field. It connects to the game server, sends our
// input, and draws every player the server reports (us and any opponents).
// ===========================================================================

import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config.js";
import { generateTextures } from "../textures.js";
import Player from "../entities/Player.js";
import VirtualJoystick from "../ui/VirtualJoystick.js";

export default class ArenaScene extends Phaser.Scene {
  constructor() {
    super("ArenaScene");
  }

  create() {
    generateTextures(this);
    this.drawGrid();

    // The network client was created in main.js and stored in the registry.
    this.net = this.registry.get("net");
    this.sprites = new Map(); // player id -> Player display object

    // --- Input ---------------------------------------------------------------
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.input.addPointer(2);
    this.joystick = new VirtualJoystick(this);

    // --- HUD -----------------------------------------------------------------
    this.statusText = this.add
      .text(GAME_WIDTH / 2, 24, "Connecting to server...", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#fff1e8",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(500);

    // When the server welcomes us, update the HUD with our team color.
    this.net.on("welcome", (msg) => {
      const label = msg.team === "red" ? "RED" : "BLUE";
      this.statusText.setText(`You are ${label}  —  move: WASD / drag left side`);
      this.statusText.setColor(msg.team === "red" ? "#ff6b8b" : "#9bd9ff");
    });

    // Announce ourselves to the server.
    this.net.join();
  }

  update() {
    // 1) Read our input and send it to the server.
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dy += 1;
    if (dx === 0 && dy === 0) {
      const v = this.joystick.getVector();
      dx = v.x;
      dy = v.y;
    }
    if (this.net.localId) this.net.sendInput(dx, dy);

    // 2) Sync the on-screen sprites to the server's roster.
    this.syncPlayers();
  }

  syncPlayers() {
    const seen = new Set();

    for (const p of this.net.players) {
      seen.add(p.id);
      let sprite = this.sprites.get(p.id);
      if (!sprite) {
        // A player we haven't drawn yet — create them.
        sprite = new Player(this, p.x, p.y, p.team);
        this.sprites.set(p.id, sprite);
      }
      sprite.setTarget(p.x, p.y);
      sprite.smoothFollow();
    }

    // Remove sprites for players who have left.
    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
  }

  drawGrid() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.bg, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.lineStyle(1, COLORS.grid, 1);
    const step = 40;
    for (let x = 0; x <= GAME_WIDTH; x += step) g.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y <= GAME_HEIGHT; y += step) g.lineBetween(0, y, GAME_WIDTH, y);
    g.setDepth(-10);
  }
}
