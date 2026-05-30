// Milestone 23 (render): the corner kill feed shows recent knockouts (colored
// by the killing team) and clears when there are none.
import { openGame, assert } from "./helpers.mjs";

const state = (killFeed) => ({
  t: "state",
  tick: 1,
  phase: "playing",
  winner: null,
  score: { blue: 1, red: 0 },
  killFeed,
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true }],
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

  const inject = (killFeed) =>
    page.evaluate((s) => {
      window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
      window.PIXELCLASH.net._receive(s);
    }, state(killFeed));

  await page.evaluate(() =>
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" })
  );

  await inject([
    { id: 1, byTeam: "red", victimTeam: "blue", victimCls: "scout" },
    { id: 2, byTeam: "blue", victimTeam: "red", victimCls: "tank" },
  ]);
  await page.waitForTimeout(100);

  const v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return {
      top: { text: s.killLines[0].text, visible: s.killLines[0].visible },
      second: { text: s.killLines[1].text, visible: s.killLines[1].visible },
      third: s.killLines[2].visible,
    };
  });
  // Newest (id 2) is on top.
  assert(v.top.visible && /BLUE/.test(v.top.text) && /Tank/.test(v.top.text), "newest kill shows on top");
  assert(v.second.visible && /RED/.test(v.second.text) && /Scout/.test(v.second.text), "older kill below it");
  assert(!v.third, "unused feed lines stay hidden");

  // Empty feed hides all lines.
  await inject([]);
  await page.waitForTimeout(80);
  const anyVisible = await page.evaluate(() =>
    window.PIXELCLASH.game.scene.getScene("ArenaScene").killLines.some((l) => l.visible)
  );
  assert(!anyVisible, "the feed clears when there are no recent kills");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 23 KILL-FEED RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
