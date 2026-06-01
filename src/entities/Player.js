// ===========================================================================
// Player — the on-screen representation of one player in the arena.
// The SERVER decides positions and health; this object just shows a player,
// smoothly glides toward the latest server position, and displays a health bar.
//
// It's a Container (a group you move as one) holding the body sprite and the
// health bar, so everything follows the player together.
// ===========================================================================

import Phaser from "phaser";
import { SPRITE_SCALE, PLAYER_SIZE, COMBAT, CLASSES } from "../config.js";
import { advancePhase, bodyPose, popScale } from "../anim.js";

const BAR_W = PLAYER_SIZE * SPRITE_SCALE; // health bar width matches the body
const BAR_Y = -(PLAYER_SIZE * SPRITE_SCALE) / 2 - 8; // sit just above the head

export default class Player extends Phaser.GameObjects.Container {
  constructor(scene, x, y, team) {
    super(scene, x, y);
    this.team = team;
    this.targetX = x;
    this.targetY = y;

    // A soft drop shadow on the ground under the feet, so the top-down hero
    // reads as standing on the map instead of floating. Stays put while the
    // body bobs above it (which reads as a little hop).
    const half = (PLAYER_SIZE * SPRITE_SCALE) / 2;
    this.shadow = scene.add.ellipse(0, half - 2, half * 1.4, half * 0.6, 0x000000, 0.28);

    // A soft orange aura shown behind the body while a power buff is active.
    this.aura = scene.add.circle(0, 0, (PLAYER_SIZE * SPRITE_SCALE) / 2 + 6, 0xffa300, 0);
    // A cyan ring shown while the tank's Bulwark shield is up.
    this.shield = scene.add
      .circle(0, 0, (PLAYER_SIZE * SPRITE_SCALE) / 2 + 8, 0x29adff, 0)
      .setStrokeStyle(2, 0x29adff, 0);

    const texture = team === "red" ? "player_red" : "player_blue";
    this.bodySprite = scene.add.sprite(0, 0, texture).setScale(SPRITE_SCALE);

    // --- Procedural animation state ----------------------------------------
    this.baseScale = SPRITE_SCALE; // class scale; animation multiplies on top
    this.animPhase = 0; // walk/idle cycle position (radians)
    this.attackAt = -Infinity; // timestamp of the last attack, for the pop
    this.prevX = x; // last frame's position, to detect movement
    this.prevY = y;
    // Top-down facing for the directional GB sprites. `facing` is one of
    // down/up/side; `flip` mirrors the side sprite to face LEFT. Derived from
    // movement each frame (heroes face the way they walk; idle keeps the last).
    this.facing = "down";
    this.flip = false;

    // Health bar: a dark background and a colored fill that shrinks with HP.
    this.hpBg = scene.add.rectangle(0, BAR_Y, BAR_W + 2, 5, 0x000000, 0.6);
    this.hpFill = scene.add
      .rectangle(-BAR_W / 2, BAR_Y, BAR_W, 3, 0x00e436)
      .setOrigin(0, 0.5);

    // A little "bot" tag shown above AI-controlled players.
    this.botLabel = scene.add
      .text(0, BAR_Y - 9, "bot", { fontFamily: "monospace", fontSize: "9px", color: "#c2c3c7" })
      .setOrigin(0.5)
      .setVisible(false);

    // A small level badge under the hero, shown once it's past level 1.
    this.levelLabel = scene.add
      .text(0, 20, "", { fontFamily: "monospace", fontSize: "10px", color: "#ffec27", stroke: "#000000", strokeThickness: 3 })
      .setOrigin(0.5)
      .setVisible(false);

    this.add([this.shadow, this.aura, this.shield, this.bodySprite, this.hpBg, this.hpFill, this.botLabel, this.levelLabel]);
    scene.add.existing(this);
  }

  setBot(isBot) {
    this.botLabel.setVisible(!!isBot);
  }

  // Show "L<n>" once a hero has leveled up (hidden at level 1 to cut clutter).
  setLevel(level) {
    if (level > 1) this.levelLabel.setText(`L${level}`).setVisible(true);
    else this.levelLabel.setVisible(false);
  }

  // Toggle the Bulwark shield ring.
  setShielded(on) {
    this.shield.setStrokeStyle(2, 0x29adff, on ? 0.9 : 0);
  }

  // Toggle the power-buff aura.
  setPowered(on) {
    this.aura.setFillStyle(0xffa300, on ? 0.4 : 0);
  }

  setTarget(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  smoothFollow() {
    this.x += (this.targetX - this.x) * 0.3;
    this.y += (this.targetY - this.y) * 0.3;
  }

  setHp(hp, maxHp = COMBAT.maxHp) {
    const frac = Math.max(0, hp) / maxHp;
    this.hpFill.width = BAR_W * frac;
    // Green when healthy, yellow when hurt, red when nearly dead.
    const color = frac > 0.5 ? 0x00e436 : frac > 0.25 ? 0xffec27 : 0xff004d;
    this.hpFill.setFillStyle(color);
  }

  // Switch to the class's size (tank bigger, scout smaller). We record the size
  // as the BASE scale; animate() multiplies bob/squash/pop on top and picks the
  // directional walk frame. Start on the down/idle pose.
  setClass(cls) {
    if (cls === this.cls || !CLASSES[cls]) return;
    this.cls = cls;
    this.baseScale = SPRITE_SCALE * CLASSES[cls].scale;
    this.shadow.setScale(CLASSES[cls].scale); // bigger heroes cast a bigger shadow
    this._applySprite("idle");
  }

  // Point the body sprite at the right directional + walk-frame texture for the
  // current class/facing, mirroring SIDE for a leftward walk. Keys are
  // "hero_<cls>_<team>_<dir>_<frame>" (see textures.js / gbsprites.js).
  _applySprite(frame) {
    if (!this.cls) return;
    const team = this.team === "red" ? "red" : "blue";
    const key = `hero_${this.cls}_${team}_${this.facing}_${frame}`;
    if (this.scene.textures.exists(key)) this.bodySprite.setTexture(key);
    this.bodySprite.setFlipX(this.facing === "side" && this.flip);
  }

  // Mark an attack so animate() plays a quick scale "pop".
  triggerAttack() {
    this.attackAt = this.scene.time.now;
  }

  // Per-frame procedural animation: idle breathing / walk hop with squash &
  // stretch, plus an attack pop. `dt` is seconds since the last frame. We
  // detect movement from how far the sprite travelled since the last frame.
  animate(dt) {
    if (this.dead) return; // the death tumble owns the body while knocked out
    const dx = this.x - this.prevX;
    const dy = this.y - this.prevY;
    const moved = Math.hypot(dx, dy);
    this.prevX = this.x;
    this.prevY = this.y;
    const moving = moved > 0.4; // px/frame threshold — ignores tiny jitter

    // Face the way we're walking (idle keeps the last facing). Dominant axis
    // wins: horizontal -> side (mirror for left), vertical -> up/down.
    if (moving) {
      if (Math.abs(dx) > Math.abs(dy)) {
        this.facing = "side";
        this.flip = dx < 0;
      } else {
        this.facing = dy < 0 ? "up" : "down";
      }
    }

    this.animPhase = advancePhase(this.animPhase, dt * 1000, moving);
    const pose = bodyPose(this.animPhase, moving);
    const pop = popScale(this.scene.time.now - this.attackAt);

    // Two-frame leg shuffle while moving; the still pose when idle.
    const frame = moving ? (Math.sin(this.animPhase) >= 0 ? "walkA" : "walkB") : "idle";
    this._applySprite(frame);

    this.bodySprite.y = pose.bob;
    this.bodySprite.setScale(this.baseScale * pose.sx * pop, this.baseScale * pose.sy * pop);
  }

  // Flash white briefly to show a hit landed. `hit` is a flag the tests read.
  flashHit() {
    this.hit = true;
    this.bodySprite.setTintFill(0xffffff); // solid white silhouette
    this.scene.time.delayedCall(110, () => {
      this.bodySprite.clearTint();
      this.hit = false;
    });
  }

  // Toggle alive/dead. On a fresh knockout, play a death tumble (spin + shrink
  // + fade); on respawn, snap back to a clean upright sprite.
  setAlive(alive) {
    this.hpBg.setVisible(alive);
    this.hpFill.setVisible(alive);

    if (!alive && !this.dead) {
      // Just died: tumble the body out.
      this.dead = true;
      this.scene.tweens.killTweensOf(this.bodySprite);
      this.scene.tweens.add({
        targets: this.bodySprite,
        angle: 540, // a couple of spins
        scaleX: this.baseScale * 0.3,
        scaleY: this.baseScale * 0.3,
        alpha: 0.2,
        y: 6,
        duration: 420,
        ease: "Quad.in",
      });
    } else if (alive && this.dead) {
      // Respawned: reset to a clean upright sprite for the live animation.
      this.dead = false;
      this.scene.tweens.killTweensOf(this.bodySprite);
      this.bodySprite.setAngle(0).setAlpha(1).setScale(this.baseScale).setPosition(0, 0);
    } else if (alive) {
      this.bodySprite.setAlpha(1);
    }
  }

  // Stealth in a bush. `isLocal` = this is our own hero: fade it so we know we're
  // hidden but keep it visible. Otherwise it's a hidden enemy: hide it entirely.
  // Call AFTER setAlive (which resets alpha each living frame). No-op when not
  // hidden so normal rendering resumes.
  setHidden(hidden, isLocal) {
    if (hidden) {
      this.setVisible(true);
      if (isLocal) this.bodySprite.setAlpha(0.4);
      else this.setVisible(false); // a hidden enemy isn't drawn at all
    } else {
      this.setVisible(true);
    }
  }
}
