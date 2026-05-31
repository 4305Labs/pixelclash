// ===========================================================================
// Camp — the on-screen representation of one neutral jungle monster. The SERVER
// owns its HP and behaviour; this just shows the creature with a health bar,
// flashes on hit, and fades to faint when it's been cleared (it respawns later).
// ===========================================================================

import Phaser from "phaser";
import { CAMP } from "../config.js";

const BAR_W = CAMP.radius * 2;
const BAR_Y = -(CAMP.radius + 8);

export default class Camp extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.body = scene.add.sprite(0, 0, "camp");
    this.hpBg = scene.add.rectangle(0, BAR_Y, BAR_W + 2, 5, 0x000000, 0.6);
    this.hpFill = scene.add.rectangle(-BAR_W / 2, BAR_Y, BAR_W, 3, 0x00e436).setOrigin(0, 0.5);
    this.add([this.body, this.hpBg, this.hpFill]);
    scene.add.existing(this);
  }

  setHp(hp, maxHp = CAMP.maxHp) {
    const frac = Math.max(0, hp) / maxHp;
    this.hpFill.width = BAR_W * frac;
    this.hpFill.setFillStyle(frac > 0.5 ? 0x00e436 : frac > 0.25 ? 0xffec27 : 0xff004d);
  }

  flashHit() {
    this.body.setTintFill(0xffffff);
    this.scene.time.delayedCall(90, () => this.body.clearTint());
  }

  // A cleared camp fades to a faint ghost and hides its (empty) bar; it respawns
  // on the server, which flips alive back true.
  setAlive(alive) {
    this.body.setAlpha(alive ? 1 : 0.15);
    this.hpBg.setVisible(alive);
    this.hpFill.setVisible(alive);
  }
}
