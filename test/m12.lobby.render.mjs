// Phase B (UI): the lobby banner shows "Waiting for players… N/NEEDED" before
// the match, switches to a "Starting in N…" countdown, then disappears once the
// match is playing so the arena is unobstructed. Headless, no socket.
import { openGame, assert } from "./helpers.mjs";

const lobby = (overrides) => ({
  t: "state",
  tick: 1,
  phase: "waiting",
  winner: null,
  needed: 2,
  countdown: 0,
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true }],
  projectiles: [],
  bases: [
    { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
    { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true },
  ],
  ...overrides,
});

const readLobby = (page) =>
  page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return { visible: s.lobbyText.visible, text: s.lobbyText.text };
  });

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  // Welcome + a "waiting" snapshot: one of two needed players present.
  await page.evaluate((s) => {
    const net = window.PIXELCLASH.net;
    net._receive({ t: "welcome", id: "p1", team: "blue" });
    net._receive(s);
  }, lobby({}));
  await page.waitForTimeout(120);

  let view = await readLobby(page);
  console.log("waiting:", JSON.stringify(view));
  assert(view.visible, "lobby banner is visible while waiting");
  assert(/waiting/i.test(view.text), "banner says we're waiting for players");
  assert(view.text.includes("1/2"), "banner shows the present/needed count (1/2)");

  // Countdown snapshot: both players present, 3 seconds to go.
  await page.evaluate(
    (s) => window.PIXELCLASH.net._receive(s),
    lobby({
      tick: 2,
      phase: "countdown",
      countdown: 3,
      players: [
        { id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true },
        { id: "p2", team: "red", x: 680, y: 300, hp: 100, alive: true },
      ],
    })
  );
  await page.waitForTimeout(80);

  view = await readLobby(page);
  console.log("countdown:", JSON.stringify(view));
  assert(view.visible, "lobby banner stays visible during the countdown");
  assert(/starting/i.test(view.text), "banner shows the starting countdown");
  assert(view.text.includes("3"), "banner shows the seconds remaining (3)");

  // Playing snapshot: the banner gets out of the way.
  await page.evaluate(
    (s) => window.PIXELCLASH.net._receive(s),
    lobby({
      tick: 3,
      phase: "playing",
      countdown: 0,
      players: [
        { id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true },
        { id: "p2", team: "red", x: 680, y: 300, hp: 100, alive: true },
      ],
    })
  );
  await page.waitForTimeout(80);

  view = await readLobby(page);
  console.log("playing:", JSON.stringify(view));
  assert(!view.visible, "lobby banner hides once the match is playing");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 12 LOBBY RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
