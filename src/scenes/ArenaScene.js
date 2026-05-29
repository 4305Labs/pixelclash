// ===========================================================================
// ArenaScene — the actual playing field. For Milestone 3 it contains one
// player you can move with the keyboard (WASD / arrows) or the touch joystick.
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
    // Build our pixel-art textures in code (no image files needed).
    generateTextures(this);

    // Define the world the player can move around in.
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw a faint grid so movement is visible and it feels like an arena.
    this.drawGrid();

    // Spawn the player in the center.
    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, "blue");

    // --- Input setup ---------------------------------------------------------
    // Keyboard: arrow keys + WASD.
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    // Allow up to 3 simultaneous touches (joystick + buttons later).
    this.input.addPointer(2);

    // Touch joystick for mobile.
    this.joystick = new VirtualJoystick(this);

    // A small hint label.
    this.add
      .text(GAME_WIDTH / 2, 24, "Move: WASD / arrows / drag left side", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#fff1e8",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
  }

  // Each frame, read input and move the player.
  update() {
    let dx = 0;
    let dy = 0;

    // Keyboard contribution.
    if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dy += 1;

    // Joystick contribution (only used if no key is pressed).
    if (dx === 0 && dy === 0) {
      const v = this.joystick.getVector();
      dx = v.x;
      dy = v.y;
    }

    this.player.move(dx, dy);
  }

  drawGrid() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.bg, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.lineStyle(1, COLORS.grid, 1);
    const step = 40;
    for (let x = 0; x <= GAME_WIDTH; x += step) {
      g.lineBetween(x, 0, x, GAME_HEIGHT);
    }
    for (let y = 0; y <= GAME_HEIGHT; y += step) {
      g.lineBetween(0, y, GAME_WIDTH, y);
    }
    g.setDepth(-10); // behind everything
  }
}
