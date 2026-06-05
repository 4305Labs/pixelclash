// Milestone 35 (render): bush zones are drawn over the arena; a hidden LOCAL
// hero is faded (still visible) while a hidden ENEMY hero is fully hidden.
import { openGame, assert } from "./helpers.mjs";
import { BUSH_ZONES } from "../src/config.js";

const state = (players) => ({
  t: "state", tick: 1, phase: "playing", winner: null, score: { blue: 0, red: 0 },
  players, projectiles: [], minions: [], pickups: [], camps: [], towers: [],
  bases: [
    { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
    { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
  ],
});

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  await page.evaluate(() => {
    window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" });
  });

  // Bush zones exist on screen.
  const zoneCount = await page.evaluate(
    () => window.PIXELCLASH.game.scene.getScene("ArenaScene").bushZones.length
  );
  assert(zoneCount === BUSH_ZONES.length, "a bush zone is drawn for each config zone");

  // p1 (local) hidden -> faded but visible; p2 (enemy) hidden -> fully hidden.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state([
    { id: "p1", team: "blue", x: 200, y: 185, hp: 100, alive: true, hidden: true },
    { id: "p2", team: "red", x: 600, y: 415, hp: 100, alive: true, hidden: true },
  ]));
  await page.waitForTimeout(120);

  const v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const me = s.sprites.get("p1");
    const enemy = s.sprites.get("p2");
    return {
      meVisible: me.visible, meAlpha: me.bodySprite.alpha,
      enemyVisible: enemy.visible,
    };
  });
  assert(v.meVisible && v.meAlpha < 1, "our own hidden hero is faded but visible");
  assert(!v.enemyVisible, "a hidden enemy hero is not drawn");

  // Both step out of stealth -> both visible again.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state([
    { id: "p1", team: "blue", x: 200, y: 300, hp: 100, alive: true, hidden: false },
    { id: "p2", team: "red", x: 600, y: 300, hp: 100, alive: true, hidden: false },
  ]));
  await page.waitForTimeout(80);
  const after = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return { me: s.sprites.get("p1").visible, enemy: s.sprites.get("p2").visible };
  });
  assert(after.me && after.enemy, "heroes are visible again once out of the bush");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 35 BUSH RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
