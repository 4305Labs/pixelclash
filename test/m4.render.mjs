// Milestone 4 (rendering): load the real game in headless Chromium, inject the
// "welcome" + "state" messages the server would send, and confirm the arena
// draws both players (us + opponent) at the right spots and updates the HUD.
// We don't open a real socket here; we feed NetClient directly.
import { openGame, assert } from "./helpers.mjs";

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  // Pretend the server welcomed us as blue (p1) and reported two players.
  await page.evaluate(() => {
    const net = window.PIXELCLASH.net;
    net._receive({ t: "welcome", id: "p1", team: "blue" });
    net._receive({
      t: "state",
      tick: 1,
      players: [
        { id: "p1", team: "blue", x: 120, y: 300 },
        { id: "p2", team: "red", x: 680, y: 300 },
      ],
    });
  });

  // Give the scene a few frames to create the sprites.
  await page.waitForTimeout(200);

  const info = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const list = [...s.sprites.values()].map((sp) => ({
      team: sp.team,
      x: Math.round(sp.targetX),
      y: Math.round(sp.targetY),
    }));
    return { count: s.sprites.size, list, status: s.statusText.text };
  });
  console.log("rendered:", JSON.stringify(info));

  assert(info.count === 2, "two player sprites are drawn");
  assert(
    info.list.some((p) => p.team === "blue" && p.x === 120),
    "blue player drawn on the left"
  );
  assert(
    info.list.some((p) => p.team === "red" && p.x === 680),
    "red player drawn on the right"
  );
  assert(info.status.includes("BLUE"), "HUD shows our team");

  // A second snapshot moving the opponent should update their sprite target.
  await page.evaluate(() => {
    window.PIXELCLASH.net._receive({
      t: "state",
      tick: 2,
      players: [
        { id: "p1", team: "blue", x: 120, y: 300 },
        { id: "p2", team: "red", x: 600, y: 300 },
      ],
    });
  });
  await page.waitForTimeout(100);
  const moved = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return [...s.sprites.values()].find((sp) => sp.team === "red").targetX;
  });
  assert(moved === 600, "opponent sprite follows server updates");

  // Ignore the expected "WebSocket failed to connect" error (no server here).
  const realErrors = errors.filter(
    (e) => !/websocket|ws:\/\//i.test(e)
  );
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 4 RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
