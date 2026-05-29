// Cooldown indicators: pressing an action starts its button cooldown (button
// dims, not "ready"); it becomes ready again after the cooldown elapses; and a
// dead player pressing an action does NOT start a cooldown. Headless, no socket.
import { openGame, assert } from "./helpers.mjs";
import { COMBAT } from "../src/config.js";

const aliveState = (alive) => ({
  t: "state",
  tick: 1,
  phase: "playing",
  winner: null,
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive }],
  projectiles: [],
  bases: [],
});

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  // Welcome + a state where we're alive.
  await page.evaluate((s) => {
    const net = window.PIXELCLASH.net;
    net._receive({ t: "welcome", id: "p1", team: "blue" });
    net._receive(s);
  }, aliveState(true));
  await page.waitForTimeout(60);

  const readBasic = () =>
    page.evaluate(() => {
      const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
      return { ready: s.buttons.basic.isReady(), alpha: s.buttons.basic.circle.alpha };
    });

  assert((await readBasic()).ready, "basic starts ready");

  // Press J (basic, 400ms cd) -> goes on cooldown and dims.
  await page.keyboard.press("j");
  await page.waitForTimeout(60);
  const cooling = await readBasic();
  console.log("just after press:", JSON.stringify(cooling));
  assert(!cooling.ready, "basic is on cooldown right after pressing");
  assert(cooling.alpha < 0.85, "button dims while cooling down");

  // After the cooldown elapses it's ready again.
  await page.waitForTimeout(COMBAT.basic.cd + 150);
  const recovered = await readBasic();
  console.log("after cd elapsed:", JSON.stringify(recovered));
  assert(recovered.ready, "basic is ready again after its cooldown");
  assert(recovered.alpha >= 0.85, "button returns to full brightness");

  // Dead players pressing an action should NOT start a cooldown.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), aliveState(false));
  await page.waitForTimeout(40);
  await page.keyboard.press("k"); // ability
  await page.waitForTimeout(60);
  const abilityReady = await page.evaluate(
    () => window.PIXELCLASH.game.scene.getScene("ArenaScene").buttons.ability.isReady()
  );
  assert(abilityReady, "dead player's press does not start a cooldown");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 10 COOLDOWN TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
