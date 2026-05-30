// Milestone 31 (render): each base draws its healing-fountain ring, sized to
// the configured heal radius.
import { openGame, assert } from "./helpers.mjs";
import { BASE } from "../src/config.js";

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  await page.evaluate(() => {
    window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" });
    window.PIXELCLASH.net._receive({
      t: "state", tick: 1, phase: "playing", winner: null, score: { blue: 0, red: 0 },
      players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true }],
      projectiles: [], minions: [], pickups: [], towers: [],
      bases: [
        { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: true },
        { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: true },
      ],
    });
  });
  await page.waitForTimeout(120);

  const v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const b = s.baseSprites.get("blue");
    return { hasFountain: !!b.fountain, radius: b.fountain.radius, visible: b.fountain.visible };
  });
  assert(v.hasFountain, "a base has a fountain ring");
  assert(v.visible, "the fountain ring is visible");
  assert(v.radius === BASE.healRadius, "the fountain ring matches the heal radius");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 31 FOUNTAIN RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
