// ===========================================================================
// Base — a team's crystal. Destroy the enemy's to win. The server owns its HP;
// this just shows it with a wide health bar and a "destroyed" look at 0 HP.
// ===========================================================================

import Phaser from "phaser";
import { BASE } from "../config.js";

const BAR_W = BASE.radius * 2 + 6;
const BAR_Y = -(BASE.radius + 12);

export default class Base extends Phaser.GameObjects.Container {
  constructor(scene, x, y, team) {
    super(scene, x, y);
    this.team = team;

    this.crystal = scene.add.sprite(0, 0, team === "red" ? "base_red" : "base_blue");

    this.hpBg = scene.add.rectangle(0, BAR_Y, BAR_W + 2, 7, 0x000000, 0.6);
    this.hpFill = scene.add
      .rectangle(-BAR_W / 2, BAR_Y, BAR_W, 5, 0x00e436)
      .setOrigin(0, 0.5);

    this.add([this.crystal, this.hpBg, this.hpFill]);
    scene.add.existing(this);
  }

  setHp(hp, maxHp) {
    const frac = Math.max(0, hp) / maxHp;
    this.hpFill.width = BAR_W * frac;
    const color = frac > 0.5 ? 0x00e436 : frac > 0.25 ? 0xffec27 : 0xff004d;
    this.hpFill.setFillStyle(color);
  }

  // Flash white briefly to show the base took a hit.
  flashHit() {
    this.hit = true;
    this.crystal.setTintFill(0xffffff);
    this.scene.time.delayedCall(110, () => {
      this.crystal.clearTint();
      this.hit = false;
    });
  }

  setAlive(alive) {
    this.crystal.setAlpha(alive ? 1 : 0.15);
    this.hpBg.setVisible(alive);
    this.hpFill.setVisible(alive);
  }
}
