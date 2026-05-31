// ===========================================================================
// ArenaScene — the playing field. Connects to the game server, sends input and
// attack requests, and draws every player (with health bars) plus all the
// projectiles the server reports.
// ===========================================================================

import Phaser from "phaser";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  COLORS,
  COMBAT,
  DASH,
  WALLS,
  BUTTONS,
  TOWER,
  CLASSES,
  CLASS_ORDER,
  KILLFEED,
  PROGRESS,
  LANES,
  LANE_BAND_HALF,
  LANE_ENTRY_X,
  DECOR_SPOTS,
  BUSH_ZONES,
  BASE_POS,
} from "../config.js";
import { generateTextures } from "../textures.js";
import { stepPosition } from "../sim.js";
import Player from "../entities/Player.js";
import Base from "../entities/Base.js";
import Minion from "../entities/Minion.js";
import Tower from "../entities/Tower.js";
import Camp from "../entities/Camp.js";
import VirtualJoystick from "../ui/VirtualJoystick.js";
import ActionButton from "../ui/ActionButton.js";
import { loadRecord, bumpRecord, safeStorage } from "../record.js";

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
    this.drawDecor();
    this.drawAtmosphere();
    this.drawWalls();

    this.net = this.registry.get("net");
    this.audio = this.registry.get("audio");
    this.wonPlayed = false; // so the win jingle plays once per match, not per frame
    this.resultRecorded = false; // so a match counts once in the win/loss record
    this.recordStorage = safeStorage();
    this.record = loadRecord(this.recordStorage); // { w, l, d } across matches
    this.sprites = new Map(); // player id -> Player display object
    this.bolts = new Map(); // projectile id -> circle
    this.seenBlasts = new Set(); // blast ids already animated (so we play once)
    this.minionSprites = new Map(); // minion id -> Minion display object
    this.pickupSprites = new Map(); // pickup id -> sprite
    this.campSprites = new Map(); // camp id -> Camp display object
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

    // Kill feed: a few right-aligned lines in the top-right, newest on top.
    this.killLines = [];
    for (let i = 0; i < KILLFEED.max; i++) {
      this.killLines.push(
        this.add
          .text(GAME_WIDTH - 12, 74 + i * 20, "", {
            fontFamily: "monospace",
            fontSize: "14px",
            color: "#fff1e8",
            stroke: "#000000",
            strokeThickness: 3,
          })
          .setOrigin(1, 0)
          .setScrollFactor(0)
          .setDepth(500)
          .setVisible(false)
      );
    }

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

    // Hero-class picker, shown under the lobby banner. Press 1/2/3 to choose.
    this.classText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 80, "", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#fff1e8",
        align: "center",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2000)
      .setVisible(false);

    // Number keys 1–6 pick a class (the server ignores it during live play).
    const NUM_KEYS = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX"];
    CLASS_ORDER.forEach((cls, i) => {
      if (!NUM_KEYS[i]) return;
      this.input.keyboard.on(`keydown-${NUM_KEYS[i]}`, () => this.net.sendClass(cls));
    });

    // Z/X/C buy a specific shop upgrade; B buys the next one in the list.
    this.input.keyboard.on("keydown-B", () => this.net.sendBuy());
    ["Z", "X", "C"].forEach((k, i) => {
      this.input.keyboard.on(`keydown-${k}`, () => {
        const item = PROGRESS.shop[i];
        if (item) this.net.sendBuy(item.id);
      });
    });

    // Level / gold / shop line, bottom-left (clear of the action buttons).
    this.shopText = this.add
      .text(12, GAME_HEIGHT - 16, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#fff1e8",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(500);

    // --- Touch buttons for class + shop (keyboard still works) ---------------
    // Class picker: tappable buttons in the lobby, laid out in two rows of three
    // (centered, where the world is frozen so there's no joystick conflict).
    const COLS = 3;
    const BW = 150;
    const GAP = 12;
    const rowW = COLS * BW + (COLS - 1) * GAP;
    this.classButtons = CLASS_ORDER.map((cls, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = GAME_WIDTH / 2 - rowW / 2 + col * (BW + GAP);
      const y = GAME_HEIGHT / 2 + 104 + row * 38;
      const b = this.makeTapButton(x, y, BW, 32, `${i + 1} ${CLASSES[cls].name}`, () =>
        this.net.sendClass(cls)
      );
      b.cls = cls;
      return b;
    });

    // Shop: tappable item buttons on the RIGHT edge (the joystick only reacts to
    // the left half, so these never start movement). One per shop item.
    this.shopButtons = PROGRESS.shop.slice(0, 3).map((item, i) => {
      const b = this.makeTapButton(GAME_WIDTH - 150, 180 + i * 34, 138, 28, "", () =>
        this.net.sendBuy(item.id)
      );
      b.item = item;
      return b;
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

    // Portrait hint: the arena is landscape-native, so on a portrait phone it
    // shrinks to a strip — nudge the player to rotate. Shown only in portrait
    // (and suppressible by tests so the docs screenshot stays clean).
    this.rotateBg = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, 46, 0x000000, 0.8)
      .setScrollFactor(0)
      .setDepth(2500)
      .setVisible(false);
    this.rotateText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "↻  Rotate to landscape for the best view", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ffec27",
        align: "center",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2501)
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
    this.syncCamps();
    this.syncPickups();
    this.syncMinions(dt);
    this.syncPlayers(dt);
    this.syncProjectiles();
    this.syncBlasts();
    this.updateLobby();
    this.updateGameOver();
    this.updateHud();
    this.updateKillFeed();
    this.updateShopHud();
    this.updateOrientationHint();

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
      // Pop the local hero on an attack (the dash has its own movement burst).
      if (kind !== "dash") {
        const me = this.sprites.get(this.net.localId);
        if (me) me.triggerAttack();
      }
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

    // The class picker (text hint + tappable buttons) shows in the lobby. The
    // buttons carry the names/keys; the text just confirms the current pick.
    const picking = phase === "waiting" || phase === "countdown";
    if (picking) {
      const cur = CLASSES[this.net.cls] ? CLASSES[this.net.cls].name : "Soldier";
      this.classText.setText(`Choose your hero (tap or 1–6)\nSelected: ${cur}`).setVisible(true);
    } else {
      this.classText.setVisible(false);
    }
    for (const b of this.classButtons) {
      b.setVisible(picking);
      if (picking) b.setColor(b.cls === this.net.cls ? "#ffec27" : "#fff1e8");
    }
  }

  updateGameOver() {
    if (this.net.phase === "over" && this.net.winner) {
      const winner = this.net.winner;
      const draw = winner === "draw";
      const iWon = !draw && this.net.team && this.net.team === winner;

      // Tally this result once per match (W/L from our team's point of view).
      if (!this.resultRecorded && this.net.team) {
        const outcome = draw ? "d" : iWon ? "w" : "l";
        this.record = bumpRecord(this.recordStorage, outcome);
        this.resultRecorded = true;
      }

      const who = draw ? "DRAW!" : `${winner === "blue" ? "BLUE" : "RED"} WINS!`;
      const line2 = draw ? "Time! It's a draw." : iWon ? "You win! 🎉" : "You lose…";
      const s = this.net.score || { blue: 0, red: 0 };
      const rec = `Your record  ${this.record.w}W ${this.record.l}L${this.record.d ? ` ${this.record.d}D` : ""}`;
      this.gameOverText
        .setText(`${who}\n${line2}\nFinal score  BLUE ${s.blue} – ${s.red} RED\n${rec}`)
        .setColor(draw ? "#fff1e8" : winner === "blue" ? "#9bd9ff" : "#ff6b8b")
        .setVisible(true);
      // Play the victory jingle once when the match ends.
      if (!this.wonPlayed) {
        this.audio.play("win");
        this.wonPlayed = true;
      }
    } else {
      this.gameOverText.setVisible(false);
      this.wonPlayed = false; // re-arm for the next match
      this.resultRecorded = false;
    }
  }

  // Show the "rotate to landscape" banner only on a portrait viewport.
  updateOrientationHint() {
    const portrait =
      !this.suppressRotateHint &&
      typeof window !== "undefined" &&
      window.innerWidth < window.innerHeight;
    this.rotateBg.setVisible(portrait);
    this.rotateText.setVisible(portrait);
  }

  // Format seconds as m:ss for the match clock.
  fmtClock(sec) {
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  }

  // A small tappable UI button (a panel + centered label). Stops the tap from
  // reaching the movement joystick, so it works anywhere on screen. Returns a
  // handle with show/label/enable helpers (and `tap()` for tests). Starts hidden.
  makeTapButton(x, y, w, h, label, onTap) {
    const bg = this.add
      .rectangle(x, y, w, h, 0x29366f, 0.92)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(2001)
      .setStrokeStyle(1, 0x4a5680)
      .setInteractive({ useHandCursor: true });
    const txt = this.add
      .text(x + w / 2, y, label, { fontFamily: "monospace", fontSize: "13px", color: "#fff1e8" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2002);
    bg.on("pointerdown", (pointer, lx, ly, event) => {
      if (event) event.stopPropagation();
      onTap();
    });
    const btn = {
      bg,
      txt,
      setVisible(v) {
        bg.setVisible(v);
        txt.setVisible(v);
        return btn;
      },
      setLabel(s) {
        txt.setText(s);
        return btn;
      },
      setColor(c) {
        txt.setColor(c);
        return btn;
      },
      setEnabled(e) {
        bg.setFillStyle(0x29366f, e ? 0.92 : 0.5);
        txt.setColor(e ? "#ffec27" : "#9a9aa0");
        return btn;
      },
      tap: onTap, // for tests
    };
    return btn.setVisible(false);
  }

  // Bottom-left progression line for the local hero: level, gold, and the shop
  // (each item on its own key — Z/X/C), or "maxed" once fully upgraded.
  updateShopHud() {
    const keys = ["Z", "X", "C"];
    const me = this.net.players.find((p) => p.id === this.net.localId);
    if (!me) {
      this.shopText.setText("");
      return;
    }
    let line = `Lv ${me.level || 1}   ${me.gold || 0}g`;
    const maxed = (me.buys || 0) >= PROGRESS.shopMaxStacks;
    const shopOpen = this.net.phase === "playing" && !maxed;
    if (this.net.phase === "playing") {
      if (maxed) {
        line += "   upgrades maxed";
      } else {
        const shop = PROGRESS.shop
          .slice(0, keys.length)
          .map((it, i) => `[${keys[i]}] ${it.name} ${it.cost}`)
          .join("   ");
        line += `   ${shop}`;
      }
    }
    this.shopText.setText(line).setColor("#fff1e8");

    // Tappable shop buttons (right edge): labelled, dimmed when unaffordable.
    this.shopButtons.forEach((b, i) => {
      b.setVisible(shopOpen);
      if (shopOpen) {
        b.setLabel(`[${keys[i]}] ${b.item.name}  ${b.item.cost}`);
        b.setEnabled((me.gold || 0) >= b.item.cost);
      }
    });
  }

  // The corner kill feed: most recent knockouts on top, colored by the team
  // that got the kill ("BLUE ⚔ Red Tank").
  updateKillFeed() {
    const recent = (this.net.killFeed || []).slice().reverse();
    for (let i = 0; i < this.killLines.length; i++) {
      const line = this.killLines[i];
      const k = recent[i];
      if (!k) {
        line.setVisible(false);
        continue;
      }
      const who = k.byTeam === "blue" ? "BLUE" : "RED";
      const vt = k.victimTeam === "blue" ? "Blue" : "Red";
      const cls = CLASSES[k.victimCls]?.name || "Hero";
      line
        .setText(`${who} ⚔ ${vt} ${cls}`)
        .setColor(k.byTeam === "blue" ? "#9bd9ff" : "#ff6b8b")
        .setVisible(true);
    }
  }

  // The team scoreboard (with the match clock), and a respawn countdown while
  // the local hero is down.
  updateHud() {
    const s = this.net.score || { blue: 0, red: 0 };
    const t = this.net.timeLeft || 0;
    const clock = this.net.phase === "playing" && t > 0 ? `   ${this.fmtClock(t)}` : "";
    this.scoreText.setText(`BLUE  ${s.blue} : ${s.red}  RED${clock}`);

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

      // Local pickup cue: our HP jumped up while alive (heal), or our power
      // buff just turned on. (Not on respawn, which is a dead -> alive change.)
      if (p.id === this.net.localId) {
        const healed = p.alive && sprite.lastAlive && p.hp > sprite.lastHp;
        const justPowered = p.powered && !sprite.lastPowered;
        if (healed || justPowered) this.audio.play("pickup");
      }
      sprite.lastPowered = p.powered;
      sprite.lastHp = p.hp;

      // Detect a knockout (alive -> dead) for the death sound.
      if (sprite.lastAlive && !p.alive) this.audio.play("death");
      sprite.lastAlive = p.alive;

      if (p.cls) sprite.setClass(p.cls);
      sprite.setBot(p.bot);
      sprite.setLevel(p.level || 1);
      sprite.setHp(p.hp, p.maxHp);
      sprite.setAlive(p.alive);
      sprite.setPowered(p.powered);
      sprite.setShielded(p.shielded);
      // Stealth: a hero standing in a bush. Fade OUR own hidden hero (so we know
      // we're stealthed) but FULLY hide a hidden enemy (the honest client
      // respects the bush). `hidden` is a global flag, so the local id decides
      // which treatment to apply.
      sprite.setHidden(p.hidden, p.id === this.net.localId);
      // Procedural bob/walk/attack animation (movement is read from the sprite's
      // own travel since last frame, so it works for predicted + interpolated).
      if (p.alive) sprite.animate(dt);
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

  // A quick muzzle-flash spark: a bright dot that pops bigger and fades out,
  // shown where a bolt is first fired. Cleans itself up on tween complete.
  spawnSpark(x, y, color) {
    const spark = this.add.circle(x, y, 7, color, 0.9).setDepth(60);
    this.sparkCount = (this.sparkCount || 0) + 1; // total sparks (for tests)
    this.tweens.add({
      targets: spark,
      scale: 2.2,
      alpha: 0,
      duration: 180,
      ease: "Quad.out",
      onComplete: () => spark.destroy(),
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

  // Draw the guard towers (one per team per lane): flash + chime on damage, big
  // boom when one is destroyed, faded rubble afterwards.
  syncTowers() {
    for (const tw of this.net.towers) {
      const key = `${tw.team}_${tw.lane || "mid"}`; // one sprite per team+lane
      let sprite = this.towerSprites.get(key);
      if (!sprite) {
        sprite = new Tower(this, tw.x, tw.y, tw.team);
        sprite.lastHp = tw.hp;
        sprite.lastAlive = tw.alive;
        this.towerSprites.set(key, sprite);
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

  // Draw the neutral jungle camps: create on first sight, flash + chime on
  // damage, fade when cleared, restore when they respawn.
  syncCamps() {
    for (const c of this.net.camps) {
      let sprite = this.campSprites.get(c.id);
      if (!sprite) {
        sprite = new Camp(this, c.x, c.y);
        sprite.lastHp = c.hp;
        this.campSprites.set(c.id, sprite);
      }
      if (c.alive && c.hp < sprite.lastHp) {
        sprite.flashHit();
        this.audio.play("hit");
      }
      sprite.lastHp = c.hp;
      sprite.setHp(c.hp, c.maxHp);
      sprite.setAlive(c.alive);
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
  syncMinions(dt = 0) {
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
      sprite.animate(dt);
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
        dot.baseRadius = radius;
        dot.bornAt = this.time.now;
        this.bolts.set(b.id, dot);
        this.spawnSpark(b.x, b.y, color); // muzzle flash at the shot's origin
      }
      dot.setPosition(b.x, b.y);
      // A subtle energetic pulse (±12% radius) so bolts read as "live" energy.
      const pulse = 1 + 0.12 * Math.sin((this.time.now - dot.bornAt) / 60);
      dot.setScale(pulse);
    }
    for (const [id, dot] of this.bolts) {
      if (!seen.has(id)) {
        dot.destroy();
        this.bolts.delete(id);
      }
    }
  }

  // Mage Nova / brawler Slam shockwaves: each blast id animates exactly once as
  // an expanding, fading ring in the casting team's colour.
  syncBlasts() {
    const live = new Set();
    for (const x of this.net.blasts) {
      live.add(x.id);
      if (this.seenBlasts.has(x.id)) continue;
      this.seenBlasts.add(x.id);
      const color = x.team === "red" ? COLORS.redTeam : COLORS.blueTeam;
      const ring = this.add
        .circle(x.x, x.y, x.r, color, 0)
        .setStrokeStyle(3, color, 0.9)
        .setDepth(48);
      this.spawnSpark(x.x, x.y, color); // a bright flash at the centre
      this.tweens.add({
        targets: ring,
        scale: { from: 0.3, to: 1.15 },
        alpha: { from: 1, to: 0 },
        duration: 320,
        ease: "Quad.Out",
        onComplete: () => ring.destroy(),
      });
    }
    // Forget ids the server no longer reports, so the set can't grow forever.
    for (const id of this.seenBlasts) if (!live.has(id)) this.seenBlasts.delete(id);
  }

  // A stone road as a rotated rectangle from (x1,y1) to (x2,y2), `band` wide.
  // Used for the diagonal connectors that fan the side lanes out of each base.
  // `COLORS.grid` is the lighter stone-blue, so the road reads against the dark
  // jungle (the straight bands are a textured tile; these are a flat fill).
  drawRoad(x1, y1, x2, y2, band, color = COLORS.grid) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const r = this.add
      .rectangle((x1 + x2) / 2, (y1 + y2) / 2, len, band, color)
      .setRotation(Math.atan2(y2 - y1, x2 - x1))
      .setDepth(-9);
    return r;
  }

  drawGrid() {
    // Mossy jungle floor across the WHOLE arena, then stone "roads": the mid lane
    // runs straight across, while the top/bottom lanes run between their entries
    // and DIAGONAL connectors fan them out of each base — so the three lanes
    // radiate from the nexus instead of being parallel strips.
    this.jungleFloor = this.add
      .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "floor_jungle")
      .setOrigin(0, 0)
      .setDepth(-10);

    const band = LANE_BAND_HALF * 2;
    const entryL = LANE_ENTRY_X;
    const entryR = GAME_WIDTH - LANE_ENTRY_X;
    const midRow = GAME_HEIGHT / 2;

    this.laneFloors = [];
    for (const ln of LANES) {
      if (ln.id === "mid") {
        // Mid lane: a full-width stone band.
        this.laneFloors.push(
          this.add
            .tileSprite(0, ln.row - LANE_BAND_HALF, GAME_WIDTH, band, "floor")
            .setOrigin(0, 0)
            .setDepth(-9)
        );
      } else {
        // Side lane: a straight stone band only BETWEEN the two entries…
        this.laneFloors.push(
          this.add
            .tileSprite(entryL, ln.row - LANE_BAND_HALF, entryR - entryL, band, "floor")
            .setOrigin(0, 0)
            .setDepth(-9)
        );
        // …plus a diagonal connector from each base (mid row) to that entry.
        this.laneFloors.push(this.drawRoad(0, midRow, entryL, ln.row, band));
        this.laneFloors.push(this.drawRoad(GAME_WIDTH, midRow, entryR, ln.row, band));
      }
    }

    // A faint team tint at each base end (where the lanes converge), so each
    // side reads as that team's territory.
    const rows = LANES.map((l) => l.row);
    const yTop = Math.min(...rows) - LANE_BAND_HALF;
    const yBot = Math.max(...rows) + LANE_BAND_HALF;
    this.add
      .rectangle(0, yTop, entryL, yBot - yTop, COLORS.blueTeam, 0.08)
      .setOrigin(0, 0)
      .setDepth(-8);
    this.add
      .rectangle(entryR, yTop, GAME_WIDTH - entryR, yBot - yTop, COLORS.redTeam, 0.08)
      .setOrigin(0, 0)
      .setDepth(-8);
  }

  // Ambient layer: soft team glows at each nexus, lane direction chevrons, and a
  // vignette that darkens the edges. Purely cosmetic; sits just above the floor/
  // decor (depth -6 to -3) but below walls/units, except the vignette which is a
  // top overlay (depth 90, below the HUD).
  drawAtmosphere() {
    // Soft pulsing glow under each base, in team colour.
    for (const team of ["blue", "red"]) {
      const b = BASE_POS[team];
      const color = team === "blue" ? COLORS.blueTeam : COLORS.redTeam;
      const glow = this.add.circle(b.x, b.y, 64, color, 0.16).setDepth(-6);
      this.tweens.add({
        targets: glow,
        scale: 1.12,
        alpha: 0.24,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    }

    // Vignette: four dark edge bars (top/bottom/left/right) faded inward, framing
    // the arena. A simple, cheap stand-in for a radial vignette.
    const vig = 0x000000;
    const edge = 64;
    const mk = (x, y, w, h, a) =>
      this.add.rectangle(x, y, w, h, vig, a).setOrigin(0, 0).setDepth(90);
    for (let i = 0; i < edge; i += 8) {
      const a = 0.22 * (1 - i / edge);
      mk(0, i, GAME_WIDTH, 8, a); // top
      mk(0, GAME_HEIGHT - i - 8, GAME_WIDTH, 8, a); // bottom
      mk(i, 0, 8, GAME_HEIGHT, a); // left
      mk(GAME_WIDTH - i - 8, 0, 8, GAME_HEIGHT, a); // right
    }
  }

  // Scatter non-colliding decor (bushes/rocks) on the jungle floor. Above the
  // floor (-9) but below the walls (-5) and all units, so heroes pass in front.
  drawDecor() {
    this.decor = DECOR_SPOTS.map((d) =>
      this.add.image(d.x, d.y, d.kind === "rock" ? "decor_rock" : "decor_bush").setDepth(-7)
    );
    // Bush stealth zones: translucent leafy patches drawn ABOVE units (depth
    // 100) so a hero standing in one is partly obscured by the foliage.
    this.bushZones = BUSH_ZONES.map((z) =>
      this.add
        .rectangle(z.x, z.y, z.w, z.h, 0x2a8a3a, 0.42)
        .setOrigin(0, 0)
        .setDepth(100)
    );
  }

  // Draw the solid obstacles from config as tiled stone walls, with a dark
  // outline. They sit above the floor but below players/bolts, so characters
  // clearly pass in front of them.
  drawWalls() {
    for (const w of WALLS) {
      this.add
        .tileSprite(w.x, w.y, w.w, w.h, "wall")
        .setOrigin(0, 0)
        .setDepth(-5);
      this.add
        .rectangle(w.x, w.y, w.w, w.h)
        .setOrigin(0, 0)
        .setStrokeStyle(2, COLORS.wallEdge, 1)
        .setDepth(-5);
    }
  }
}
