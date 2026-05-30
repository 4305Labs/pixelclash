// Milestone 24 (render): the scoreboard shows the match clock (m:ss) during
// play, and the game-over banner handles a draw with the final score.
import { openGame, assert } from "./helpers.mjs";

const playing = (timeLeft) => ({
  t: "state",
  tick: 1,
  phase: "playing",
  winner: null,
  score: { blue: 2, red: 1 },
  timeLeft,
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true }],
  projectiles: [],
  minions: [],
  pickups: [],
  towers: [],
  bases: [],
});

const draw = {
  t: "state",
  tick: 2,
  phase: "over",
  winner: "draw",
  score: { blue: 2, red: 2 },
  timeLeft: 0,
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true }],
  projectiles: [],
  minions: [],
  pickups: [],
  towers: [],
  bases: [],
};

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  await page.evaluate(() => {
    window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" });
  });

  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), playing(125));
  await page.waitForTimeout(100);
  const score = await page.evaluate(
    () => window.PIXELCLASH.game.scene.getScene("ArenaScene").scoreText.text
  );
  assert(/2 : 1/.test(score), "scoreboard shows the score");
  assert(/2:05/.test(score), "scoreboard shows the match clock (m:ss)");

  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), draw);
  await page.waitForTimeout(100);
  const banner = await page.evaluate(
    () => window.PIXELCLASH.game.scene.getScene("ArenaScene").gameOverText.text
  );
  assert(/DRAW/.test(banner), "the banner shows a draw");
  assert(/BLUE 2 . 2 RED/.test(banner), "the draw banner shows the final score");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 24 TIMER RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
