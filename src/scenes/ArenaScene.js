// ===========================================================================
// ArenaScene — the playing field. Connects to the game server, sends input and
// attack requests, and draws every player (with health bars) plus all the
// projectiles the server reports.
// ===========================================================================

import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS, COMBAT, DASH, WALLS, BUTTONS, TOWER } from "../config.js";
import { generateTextures } from "../textures.js";
import { stepPosition } from "../sim.js";
import Player from "../entities/Player.js";
import Base from "../entities/Base.js";
import Minion from "../entities/Minion.js";
import Tower from "../entities/Tower.js";
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
    this.drawWalls();

    this.net = this.registry.get("net");
    this.audio = this.registry.get("audio");
    this.wonPlayed = false; // so the win jingle plays once per match, not per frame
    this.sprites = new Map(); // player id -> Player display object
    this.bolts = new Map(); // projectile id -> circle
    this.minionSprites = new Map(); // minion id -> Minion display object
    this.pickupSprites = new Map(); // pickup id -> sprite
    this.towerSprites = new Map(); // team -> Tower display object
    this.baseSprites = new Map(); // team -> Base display object
    this.damageNumbers = []; // active floating damage-number texts

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

    // --- Input: action buttons (touch, bottom-right) ------------------------
    // Each button triggers an action and shows its own cooldown sweep.
    this.buttons = {
      basic: new ActionButton(this, BUTTONS.basic.x, BUTTONS.basic.y, "A", COMBAT.basic.color, () =>
        this.doAction("basic")
      ),
      ability: new ActionButton(this, BUTTONS.ability.x, BUTTONS.ability.y, "B", COMBAT.ability.color, () =>
        this.doAction("ability")
      ),
      dash: new ActionButton(this, BUTTONS.dash.x, BUTTONS.dash.y, "C", 0x00e436, () =>
        this.doAction("dash")
      ),
    };

    // How long each action's cooldown lasts (matches the server's values).
    this.cooldowns = {
      basic: COMBAT.basic.cd,
      ability: COMBAT.ability.cd,
      dash: DASH.cd,
    };

    // --- Input: keyboard shortcuts for the same actions ---------------------
    this.input.keyboard.on("keydown-J", () => this.doAction("basic"));
    this.input.keyboard.on("keydown-SPACE", () => this.doAction("basic"));
    this.input.keyboard.on("keydown-K", () => this.doAction("ability"));
    this.input.keyboard.on("keydown-L", () => this.doAction("dash"));
    this.input.keyboard.on("keydown-SHIFT", () => this.doAction("dash"));

    // --- Audio: mute toggle --------------------------------------------------
    // M toggles mute; a small label in the corner reflects/triggers it (handy
    // on touch). Audio is unlocked by the tap-to-start gate below.
    this.input.keyboard.on("keydown-M", () => this.toggleMute());
    this.muteText = this.add
      .text(12, 12, "", { fontFamily: "monospace", fontSize: "16px", color: "#fff1e8" })
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", (p, x, y, e) => {
        if (e) e.stopPropagation();
        this.toggleMute();
      });
    this.updateMuteLabel();

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
      this.statusText.setText(`You are ${label}  —  move: left side   A/B attack   C dash`);
      this.statusText.setColor(msg.team === "red" ? "#ff6b8b" : "#9bd9ff");
    });

    // Team kill scoreboard, just below the status line.
    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 48, "", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#fff1e8",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(500);

    // Respawn countdown, shown centered while the local player is knocked out.
    this.respawnText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "", {
        fontFamily: "monospace",
        fontSize: "30px",
        color: "#ffec27",
        align: "center",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2000)
      .setVisible(false);

    // Both teams full: tell the player instead of leaving them stuck.
    this.net.on("full", () => {
      this.statusText.setText("Match is full — try again later").setColor("#ffec27");
    });

    // Lobby banner: shown while waiting for players or counting down to the
    // start. Hidden once the match is "playing"/"over".
    this.lobbyText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "", {
        fontFamily: "monospace",
        fontSize: "36px",
        color: "#fff1e8",
        align: "center",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2000)
      .setVisible(false);

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

    this.createStartGate();
    this.net.join();
  }

  // A full-screen "tap to start" gate. Mobile browsers won't play any sound
  // until the player interacts, so we use that first tap/key to unlock audio.
  // It also gives the match a clear "begin" moment. Dismissed on first input.
  createStartGate() {
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
      .setScrollFactor(0)
      .setDepth(3000)
      .setInteractive(); // swallow the first tap so it can't leak to controls
    const text = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "PIXELCLASH\n\nTap to play  🔊", {
        fontFamily: "monospace",
        fontSize: "34px",
        color: "#fff1e8",
        align: "center",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3001);
    this.startGate = { dim, text, dismissed: false };

    // The first real gesture (tap or key) unlocks audio and clears the gate.
    // Stop the tap from also reaching the movement joystick underneath.
    dim.once("pointerdown", (pointer, x, y, event) => {
      if (event) event.stopPropagation();
      this.dismissStartGate();
    });
    this.input.keyboard.once("keydown", () => this.dismissStartGate());
  }

  // Hide the start gate and wake the audio (idempotent). Also callable from
  // tests/screenshots to clear the gate without a real gesture.
  dismissStartGate() {
    this.audio.resume();
    if (!this.startGate || this.startGate.dismissed) return;
    this.startGate.dismissed = true;
    this.startGate.dim.destroy();
    this.startGate.text.destroy();
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
    this.syncTowers();
    this.syncPickups();
    this.syncMinions();
    this.syncPlayers(dt);
    this.syncProjectiles();
    this.updateLobby();
    this.updateGameOver();
    this.updateHud();

    // 3) Redraw the cooldown sweeps on the action buttons.
    this.buttons.basic.update();
    this.buttons.ability.update();
    this.buttons.dash.update();
  }

  // Whether our local player is currently alive (false if not yet connected).
  localAlive() {
    const me = this.net.players.find((p) => p.id === this.net.localId);
    return !!me && me.alive;
  }

  // Trigger an action ("basic" | "ability" | "dash"): send it to the server
  // (the authority) and start the matching button's cooldown sweep when we
  // mirror the server's rules (alive + off cooldown).
  doAction(kind) {
    this.audio.resume(); // a tap/keypress here is a valid gesture to wake audio
    if (kind === "dash") this.net.sendDash();
    else this.net.sendAttack(kind);

    const button = this.buttons[kind];
    if (this.localAlive() && button.isReady()) {
      button.startCooldown(this.cooldowns[kind]);
      // Play the shoot blip only when we actually fire (alive + off cooldown).
      if (kind !== "dash") this.audio.play("shoot");
    }
  }

  // Flip mute on/off (persisted in localStorage by the audio module) and update
  // the corner label.
  toggleMute() {
    this.audio.resume();
    this.audio.toggleMute();
    this.updateMuteLabel();
  }

  updateMuteLabel() {
    this.muteText.setText(this.audio.muted ? "[M] sound: off" : "[M] sound: on");
  }

  syncBases() {
    for (const b of this.net.bases) {
      let base = this.baseSprites.get(b.team);
      if (!base) {
        base = new Base(this, b.x, b.y, b.team);
        base.lastHp = b.hp; // remember HP to detect damage
        base.lastAlive = b.alive; // ...and alive-state to detect destruction
        this.baseSprites.set(b.team, base);
      }
      if (b.alive && b.hp < base.lastHp) {
        base.flashHit();
        this.audio.play("hit");
      }
      base.lastHp = b.hp;
      // A base just fell (alive -> dead): play the big "destroyed" boom.
      if (base.lastAlive && !b.alive) this.audio.play("base");
      base.lastAlive = b.alive;
      base.setHp(b.hp, b.maxHp);
      base.setAlive(b.alive);
      base.setShielded(b.shielded);
    }
  }

  // Show the lobby banner while we wait for players, and the "get ready"
  // countdown just before the match starts. Hidden during play and game over.
  updateLobby() {
    const phase = this.net.phase;
    if (phase === "waiting") {
      const present = this.net.players.length;
      const needed = this.net.needed || 2;
      this.lobbyText
        .setText(`Waiting for players…\n${present}/${needed}`)
        .setColor("#fff1e8")
        .setVisible(true);
    } else if (phase === "countdown") {
      this.lobbyText
        .setText(`Get ready!\nStarting in ${this.net.countdown}…`)
        .setColor("#ffec27")
        .setVisible(true);
    } else {
      this.lobbyText.setVisible(false);
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
      // Play the victory jingle once when the match ends.
      if (!this.wonPlayed) {
        this.audio.play("win");
        this.wonPlayed = true;
      }
    } else {
      this.gameOverText.setVisible(false);
      this.wonPlayed = false; // re-arm for the next match
    }
  }

  // The team scoreboard, and a respawn countdown while the local hero is down.
  updateHud() {
    const s = this.net.score || { blue: 0, red: 0 };
    this.scoreText.setText(`BLUE  ${s.blue} : ${s.red}  RED`);

    const me = this.net.players.find((p) => p.id === this.net.localId);
    if (this.net.phase === "playing" && me && !me.alive) {
      this.respawnText.setText(`Knocked out!\nRespawning in ${me.respawnIn || 0}…`).setVisible(true);
    } else {
      this.respawnText.setVisible(false);
    }
  }

  syncPlayers(dt) {
    const seen = new Set();
    for (const p of this.net.players) {
      seen.add(p.id);
      let sprite = this.sprites.get(p.id);
      if (!sprite) {
        sprite = new Player(this, p.x, p.y, p.team);
        sprite.lastHp = p.hp; // remember HP so we can detect damage later
        sprite.lastAlive = p.alive; // ...and alive-state so we can detect death
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

      // Detect damage: if HP dropped since the last snapshot, show feedback.
      if (p.alive && p.hp < sprite.lastHp) {
        const dmg = sprite.lastHp - p.hp;
        sprite.flashHit();
        this.spawnDamageNumber(sprite.x, sprite.y, dmg);
        this.audio.play("hit");
      }
      sprite.lastHp = p.hp;

      // Detect a knockout (alive -> dead) for the death sound.
      if (sprite.lastAlive && !p.alive) this.audio.play("death");
      sprite.lastAlive = p.alive;

      sprite.setHp(p.hp);
      sprite.setAlive(p.alive);
      sprite.setPowered(p.powered);
    }
    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
  }

  // A floating damage number that rises and fades, then cleans itself up.
  spawnDamageNumber(x, y, amount) {
    const text = this.add
      .text(x, y - 18, String(amount), {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(1500);
    this.damageNumbers.push(text);
    this.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      duration: 650,
      ease: "Quad.out",
      onComplete: () => {
        const i = this.damageNumbers.indexOf(text);
        if (i !== -1) this.damageNumbers.splice(i, 1);
        text.destroy();
      },
    });
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

  // Draw the guard towers (one per team): flash + chime on damage, big boom
  // when one is destroyed, faded rubble afterwards.
  syncTowers() {
    for (const tw of this.net.towers) {
      let sprite = this.towerSprites.get(tw.team);
      if (!sprite) {
        sprite = new Tower(this, tw.x, tw.y, tw.team);
        sprite.lastHp = tw.hp;
        sprite.lastAlive = tw.alive;
        this.towerSprites.set(tw.team, sprite);
      }
      if (tw.alive && tw.hp < sprite.lastHp) {
        sprite.flashHit();
        this.audio.play("hit");
      }
      sprite.lastHp = tw.hp;
      if (sprite.lastAlive && !tw.alive) this.audio.play("base"); // a structure falls
      sprite.lastAlive = tw.alive;
      sprite.setHp(tw.hp, tw.maxHp);
      sprite.setAlive(tw.alive);
    }
  }

  // Draw the available map pickups (the snapshot lists only active ones), with
  // a gentle pulse. A pickup that's been grabbed drops out of the list and its
  // sprite is removed.
  syncPickups() {
    const seen = new Set();
    for (const pk of this.net.pickups) {
      seen.add(pk.id);
      if (!this.pickupSprites.has(pk.id)) {
        const tex = pk.kind === "heal" ? "pickup_heal" : "pickup_power";
        const sprite = this.add.sprite(pk.x, pk.y, tex).setDepth(5);
        this.tweens.add({
          targets: sprite,
          scale: 1.18,
          yoyo: true,
          repeat: -1,
          duration: 600,
          ease: "Sine.inOut",
        });
        this.pickupSprites.set(pk.id, sprite);
      }
    }
    for (const [id, sprite] of this.pickupSprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.pickupSprites.delete(id);
      }
    }
  }

  // Draw the lane minions: create on first sight, glide toward their reported
  // position, flash on damage, and clean up the dead/departed.
  syncMinions() {
    const seen = new Set();
    for (const m of this.net.minions) {
      seen.add(m.id);
      let sprite = this.minionSprites.get(m.id);
      if (!sprite) {
        sprite = new Minion(this, m.x, m.y, m.team);
        sprite.lastHp = m.hp;
        this.minionSprites.set(m.id, sprite);
      }
      sprite.setTarget(m.x, m.y);
      sprite.smoothFollow();
      if (m.hp < sprite.lastHp) sprite.flashHit(); // hit feedback (no sound — too many)
      sprite.lastHp = m.hp;
      sprite.setHp(m.hp);
    }
    for (const [id, sprite] of this.minionSprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.minionSprites.delete(id);
      }
    }
  }

  syncProjectiles() {
    const seen = new Set();
    for (const b of this.net.projectiles) {
      seen.add(b.id);
      let dot = this.bolts.get(b.id);
      if (!dot) {
        // Tower zaps have their own look; everything else uses its attack style.
        let radius, color;
        if (b.kind === "tower") {
          radius = TOWER.boltRadius;
          color = TOWER.boltColor;
        } else {
          const spec = COMBAT[b.kind] || COMBAT.basic;
          radius = spec.radius;
          color = spec.color;
        }
        dot = this.add.circle(b.x, b.y, radius, color).setDepth(50);
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

  // Draw the solid obstacles from config. They sit above the grid but below
  // the players and bolts, so characters clearly pass in front of them.
  drawWalls() {
    const g = this.add.graphics().setDepth(-5);
    for (const w of WALLS) {
      g.fillStyle(COLORS.wall, 1);
      g.fillRect(w.x, w.y, w.w, w.h);
      g.lineStyle(2, COLORS.wallEdge, 1);
      g.strokeRect(w.x, w.y, w.w, w.h);
    }
  }
}
