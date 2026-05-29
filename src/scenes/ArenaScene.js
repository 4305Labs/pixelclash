// ===========================================================================
// ArenaScene — the playing field. Connects to the game server, sends input and
// attack requests, and draws every player (with health bars) plus all the
// projectiles the server reports.
// ===========================================================================

import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS, COMBAT } from "../config.js";
import { generateTextures } from "../textures.js";
import { stepPosition } from "../sim.js";
import Player from "../entities/Player.js";
import Base from "../entities/Base.js";
import VirtualJoystick from "../ui/VirtualJoystick.js";
import ActionButton from "../ui/ActionButton.js";

// How firmly the local player is pulled toward the server's truth, per second.
// Equilibrium error while moving ≈ PLAYER_SPEED / RECONCILE_RATE pixels.
const RECONCILE_RATE = 8;

export default class ArenaScene extends Phaser.Scene {
  constructor() {
    super("ArenaScene");
  }

  create() {
    generateTextures(this);
    this.drawGrid();

    this.net = this.registry.get("net");
    this.sprites = new Map(); // player id -> Player display object
    this.bolts = new Map(); // projectile id -> circle
    this.baseSprites = new Map(); // team -> Base display object

    // --- Input: movement -----------------------------------------------------
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.input.addPointer(2);
    this.joystick = new VirtualJoystick(this);

    // --- Input: attacks (keyboard) ------------------------------------------
    this.input.keyboard.on("keydown-J", () => this.net.sendAttack("basic"));
    this.input.keyboard.on("keydown-SPACE", () => this.net.sendAttack("basic"));
    this.input.keyboard.on("keydown-K", () => this.net.sendAttack("ability"));

    // --- Input: attacks (on-screen buttons, bottom-right) -------------------
    new ActionButton(this, GAME_WIDTH - 70, GAME_HEIGHT - 70, "A", COMBAT.basic.color, () =>
      this.net.sendAttack("basic")
    );
    new ActionButton(this, GAME_WIDTH - 150, GAME_HEIGHT - 120, "B", COMBAT.ability.color, () =>
      this.net.sendAttack("ability")
    );

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

    this.net.on("welcome", (msg) => {
      const label = msg.team === "red" ? "RED" : "BLUE";
      this.statusText.setText(`You are ${label}  —  move: left side   attack: A / B`);
      this.statusText.setColor(msg.team === "red" ? "#ff6b8b" : "#9bd9ff");
    });

    // Both teams full: tell the player instead of leaving them stuck.
    this.net.on("full", () => {
      this.statusText.setText("Match is full — try again later").setColor("#ffec27");
    });

    // Win/lose banner (hidden until a base falls).
    this.gameOverText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "", {
        fontFamily: "monospace",
        fontSize: "56px",
        color: "#ffffff",
        align: "center",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2000)
      .setVisible(false);

    this.net.join();
  }

  // `delta` is the milliseconds since the last frame (Phaser passes it in).
  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05); // seconds, clamped to avoid big jumps

    // 1) Read movement input and send it.
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
    this.lastInput = { dx, dy };
    if (this.net.localId) this.net.sendInput(dx, dy);

    // 2) Sync everything to the server's snapshot.
    this.syncBases();
    this.syncPlayers(dt);
    this.syncProjectiles();
    this.updateGameOver();
  }

  syncBases() {
    for (const b of this.net.bases) {
      let base = this.baseSprites.get(b.team);
      if (!base) {
        base = new Base(this, b.x, b.y, b.team);
        this.baseSprites.set(b.team, base);
      }
      base.setHp(b.hp, b.maxHp);
      base.setAlive(b.alive);
    }
  }

  updateGameOver() {
    if (this.net.phase === "over" && this.net.winner) {
      const iWon = this.net.team && this.net.team === this.net.winner;
      const who = this.net.winner === "blue" ? "BLUE" : "RED";
      this.gameOverText
        .setText(`${who} WINS!\n` + (iWon ? "You win! 🎉" : "You lose…"))
        .setColor(this.net.winner === "blue" ? "#9bd9ff" : "#ff6b8b")
        .setVisible(true);
    } else {
      this.gameOverText.setVisible(false);
    }
  }

  syncPlayers(dt) {
    const seen = new Set();
    for (const p of this.net.players) {
      seen.add(p.id);
      let sprite = this.sprites.get(p.id);
      if (!sprite) {
        sprite = new Player(this, p.x, p.y, p.team);
        this.sprites.set(p.id, sprite);
      }

      if (p.id === this.net.localId) {
        // OUR player: predict locally for instant response, then nudge toward
        // the server's authoritative position so we never drift far.
        this.predictLocal(sprite, p, dt);
      } else {
        // Everyone else: glide toward their latest server position.
        sprite.setTarget(p.x, p.y);
        sprite.smoothFollow();
      }
      sprite.setHp(p.hp);
      sprite.setAlive(p.alive);
    }
    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
  }

  // Client-side prediction for the local player.
  predictLocal(sprite, serverP, dt) {
    const input = this.lastInput || { dx: 0, dy: 0 };

    // Step our sprite forward using the SAME math the server uses.
    const moved = stepPosition(sprite.x, sprite.y, input.dx, input.dy, dt);
    sprite.x = moved.x;
    sprite.y = moved.y;

    // If the server says we're far from where we think we are (e.g. we just
    // respawned, or got knocked back), snap. Otherwise correct gently with a
    // frame-rate-independent pull so the feel is the same at any frame rate.
    const gap = Math.hypot(serverP.x - sprite.x, serverP.y - sprite.y);
    if (gap > 60) {
      sprite.x = serverP.x;
      sprite.y = serverP.y;
    } else {
      const k = Math.min(1, RECONCILE_RATE * dt);
      sprite.x += (serverP.x - sprite.x) * k;
      sprite.y += (serverP.y - sprite.y) * k;
    }
  }

  syncProjectiles() {
    const seen = new Set();
    for (const b of this.net.projectiles) {
      seen.add(b.id);
      let dot = this.bolts.get(b.id);
      if (!dot) {
        const spec = COMBAT[b.kind] || COMBAT.basic;
        dot = this.add.circle(b.x, b.y, spec.radius, spec.color).setDepth(50);
        this.bolts.set(b.id, dot);
      }
      dot.setPosition(b.x, b.y);
    }
    for (const [id, dot] of this.bolts) {
      if (!seen.has(id)) {
        dot.destroy();
        this.bolts.delete(id);
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
