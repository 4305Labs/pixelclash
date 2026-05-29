// ===========================================================================
// Player — the on-screen representation of one player in the arena.
// The SERVER decides positions and health; this object just shows a player,
// smoothly glides toward the latest server position, and displays a health bar.
//
// It's a Container (a group you move as one) holding the body sprite and the
// health bar, so everything follows the player together.
// ===========================================================================

import Phaser from "phaser";
import { SPRITE_SCALE, PLAYER_SIZE, COMBAT } from "../config.js";

const BAR_W = PLAYER_SIZE * SPRITE_SCALE; // health bar width matches the body
const BAR_Y = -(PLAYER_SIZE * SPRITE_SCALE) / 2 - 8; // sit just above the head

export default class Player extends Phaser.GameObjects.Container {
  constructor(scene, x, y, team) {
    super(scene, x, y);
    this.team = team;
    this.targetX = x;
    this.targetY = y;

    // A soft orange aura shown behind the body while a power buff is active.
    this.aura = scene.add.circle(0, 0, (PLAYER_SIZE * SPRITE_SCALE) / 2 + 6, 0xffa300, 0);

    const texture = team === "red" ? "player_red" : "player_blue";
    this.bodySprite = scene.add.sprite(0, 0, texture).setScale(SPRITE_SCALE);

    // Health bar: a dark background and a colored fill that shrinks with HP.
    this.hpBg = scene.add.rectangle(0, BAR_Y, BAR_W + 2, 5, 0x000000, 0.6);
    this.hpFill = scene.add
      .rectangle(-BAR_W / 2, BAR_Y, BAR_W, 3, 0x00e436)
      .setOrigin(0, 0.5);

    this.add([this.aura, this.bodySprite, this.hpBg, this.hpFill]);
    scene.add.existing(this);
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

  setHp(hp) {
    const frac = Math.max(0, hp) / COMBAT.maxHp;
    this.hpFill.width = BAR_W * frac;
    // Green when healthy, yellow when hurt, red when nearly dead.
    const color = frac > 0.5 ? 0x00e436 : frac > 0.25 ? 0xffec27 : 0xff004d;
    this.hpFill.setFillStyle(color);
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

  // Dead players fade out and hide their (empty) health bar.
  setAlive(alive) {
    this.bodySprite.setAlpha(alive ? 1 : 0.2);
    this.hpBg.setVisible(alive);
    this.hpFill.setVisible(alive);
  }
}
