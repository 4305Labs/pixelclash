// Milestone 3 verification: the player loads, moves with the keyboard,
// and cannot leave the arena bounds. Runs in headless Chromium, no server.
import { openGame, getPlayerPos, assert } from "./helpers.mjs";

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  const start = await getPlayerPos(page);
  console.log("start pos:", start);

  // Hold "D" (right) for a bit; player x should increase.
  await page.keyboard.down("d");
  await page.waitForTimeout(500);
  await page.keyboard.up("d");
  await page.waitForTimeout(100);
  const afterRight = await getPlayerPos(page);
  console.log("after right:", afterRight);
  assert(afterRight.x > start.x + 20, "moving right increases x");

  // Hold "W" (up) for a bit; player y should decrease (up = smaller y).
  await page.keyboard.down("w");
  await page.waitForTimeout(500);
  await page.keyboard.up("w");
  await page.waitForTimeout(100);
  const afterUp = await getPlayerPos(page);
  console.log("after up:", afterUp);
  assert(afterUp.y < afterRight.y - 20, "moving up decreases y");

  // Slam into the right wall; confirm we stay inside the 800-wide arena.
  await page.keyboard.down("d");
  await page.waitForTimeout(1800);
  await page.keyboard.up("d");
  const atWall = await getPlayerPos(page);
  console.log("at wall:", atWall);
  assert(atWall.x < 800, "player stays within right bound");
  assert(atWall.x > afterRight.x, "player kept moving toward the wall");

  assert(errors.length === 0, "no console/page errors: " + JSON.stringify(errors));
  console.log("\nMILESTONE 3 TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
