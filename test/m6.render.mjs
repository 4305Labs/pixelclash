// Milestone 6 (UI): bases are drawn with health bars, and the win/lose banner
// appears with the right text when the match ends. Headless, no socket.
import { openGame, assert } from "./helpers.mjs";
import { BASE } from "../src/config.js";

const BAR_W = BASE.radius * 2 + 6;

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  await page.evaluate(() => {
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" });
    window.PIXELCLASH.net._receive({
      t: "state",
      tick: 1,
      phase: "playing",
      winner: null,
      players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true }],
      projectiles: [],
      bases: [
        { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
        { team: "red", x: 756, y: 300, hp: 125, maxHp: 250, alive: true },
      ],
    });
  });
  await page.waitForTimeout(150);

  const bases = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const red = s.baseSprites.get("red");
    return {
      count: s.baseSprites.size,
      redHpWidth: red.hpFill.width,
      bannerVisible: s.gameOverText.visible,
    };
  });
  console.log("bases:", JSON.stringify(bases));
  assert(bases.count === 2, "both bases are drawn");
  assert(Math.abs(bases.redHpWidth - BAR_W * 0.5) < 0.5, "red base bar shows 50% HP");
  assert(bases.bannerVisible === false, "no win banner while playing");

  // Now end the match: blue destroys red's base.
  await page.evaluate(() => {
    window.PIXELCLASH.net._receive({
      t: "state",
      tick: 2,
      phase: "over",
      winner: "blue",
      score: { blue: 5, red: 3 },
      players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true }],
      projectiles: [],
      bases: [
        { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
        { team: "red", x: 756, y: 300, hp: 0, maxHp: 250, alive: false },
      ],
    });
  });
  await page.waitForTimeout(150);

  const banner = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return { visible: s.gameOverText.visible, text: s.gameOverText.text };
  });
  console.log("banner:", JSON.stringify(banner));
  assert(banner.visible === true, "win banner shows at game over");
  assert(banner.text.includes("BLUE WINS"), "banner names the winner");
  assert(banner.text.includes("You win"), "banner tells this (blue) player they won");
  assert(/BLUE 5 . 3 RED/.test(banner.text), "banner shows the final score");
  assert(/Your record\s+1W/.test(banner.text), "banner shows the player's win/loss record");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 6 RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
