// Client-side prediction: our own player should move the INSTANT we press a
// key, even before any new server snapshot arrives. We welcome the player and
// inject a single state, then press a key WITHOUT sending any further state —
// so any movement we see is pure local prediction.
import { openGame, assert } from "./helpers.mjs";

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  await page.evaluate(() => {
    const net = window.PIXELCLASH.net;
    net._receive({ t: "welcome", id: "p1", team: "blue" });
    net._receive({
      t: "state",
      tick: 1,
      phase: "playing",
      winner: null,
      players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true }],
      projectiles: [],
      bases: [],
    });
  });
  await page.waitForTimeout(100);

  const readSprite = () =>
    page.evaluate(() => {
      const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
      const sp = s.sprites.get("p1");
      const server = s.net.players.find((p) => p.id === "p1").x;
      return { spriteX: sp.x, serverX: server };
    });

  const before = await readSprite();
  console.log("before:", JSON.stringify(before));
  assert(before.spriteX <= 121, "starts at the spawn position");

  // Hold right WITHOUT injecting any new server state.
  await page.keyboard.down("d");
  await page.waitForTimeout(400);
  const moving = await readSprite();
  await page.keyboard.up("d");
  console.log("while holding D:", JSON.stringify(moving));

  // 1) The sprite moved right (prediction) while the server's number is fixed.
  assert(moving.serverX === 120, "server position did NOT change (no new snapshot)");
  assert(moving.spriteX > before.spriteX + 8, "our player moved immediately (prediction)");

  // 2) Reconciliation is actively counteracting: pure prediction over 0.4s
  // would reach ~120 + 220*0.4 = 208; we settle far short of that (toward the
  // server's truth), and nowhere near the far wall. Equilibrium ≈ 120 + 220/8.
  assert(moving.spriteX < 170, "reconciliation pulls us back from pure prediction");

  // After releasing, prediction stops — we never keep drifting right.
  await page.waitForTimeout(300);
  const settled = await readSprite();
  console.log("after release:", JSON.stringify(settled));
  assert(settled.spriteX <= moving.spriteX + 1, "stops moving right after release");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 7 PREDICTION TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
