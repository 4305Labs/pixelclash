// Milestone 25 (render): AI-controlled players show a "bot" tag; humans don't.
import { openGame, assert } from "./helpers.mjs";

const state = (players) => ({
  t: "state",
  tick: 1,
  phase: "playing",
  winner: null,
  score: { blue: 0, red: 0 },
  players,
  projectiles: [],
  minions: [],
  pickups: [],
  towers: [],
  bases: [],
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

  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state([
    { id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true, bot: false },
    { id: "bot2", team: "red", x: 680, y: 300, hp: 100, alive: true, bot: true },
  ]));
  await page.waitForTimeout(100);

  const v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return { human: s.sprites.get("p1").botLabel.visible, bot: s.sprites.get("bot2").botLabel.visible };
  });
  assert(v.bot, "an AI player shows the bot tag");
  assert(!v.human, "a human player has no bot tag");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 25 BOT RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
