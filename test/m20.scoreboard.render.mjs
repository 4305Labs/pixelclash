// Milestone 20 (render): the HUD shows the team scoreboard, and a respawn
// countdown appears only while the local hero is knocked out during play.
import { openGame, assert } from "./helpers.mjs";

const state = (score, p1alive, respawnIn = 0) => ({
  t: "state",
  tick: 1,
  phase: "playing",
  winner: null,
  score,
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: p1alive ? 100 : 0, alive: p1alive, respawnIn }],
  projectiles: [],
  minions: [],
  towers: [],
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

  const inject = (...args) =>
    page.evaluate((s) => {
      window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
      window.PIXELCLASH.net._receive(s);
    }, state(...args));

  await page.evaluate(() =>
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" })
  );

  // Scoreboard reflects the score; alive hero -> no respawn text.
  await inject({ blue: 2, red: 1 }, true);
  await page.waitForTimeout(100);
  let v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return { score: s.scoreText.text, respawn: s.respawnText.visible };
  });
  assert(/2\s*:\s*1/.test(v.score), "scoreboard shows the team kills (2 : 1)");
  assert(!v.respawn, "no respawn countdown while the hero is alive");

  // Knocked out -> respawn countdown appears with the seconds.
  await inject({ blue: 2, red: 1 }, false, 2);
  await page.waitForTimeout(100);
  v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return { respawn: s.respawnText.visible, text: s.respawnText.text };
  });
  assert(v.respawn && /2/.test(v.text), "respawn countdown shows while knocked out");

  // Back alive -> countdown hidden again.
  await inject({ blue: 2, red: 1 }, true);
  await page.waitForTimeout(100);
  const hidden = await page.evaluate(
    () => window.PIXELCLASH.game.scene.getScene("ArenaScene").respawnText.visible
  );
  assert(!hidden, "respawn countdown hides once the hero is back");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 20 SCOREBOARD RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
