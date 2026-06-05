// THE FULL STACK, FOR REAL: live WebSocket server + TWO real headless browsers
// running the actual game bundle, connecting over real sockets — exactly like
// opening the game in two tabs. Verifies cross-browser sync and screenshots
// what each browser sees.
import { WebSocketServer } from "ws";
import { chromium } from "playwright";
import GameServer from "../src/net/GameServer.js";
import { NET } from "../src/config.js";
import { buildInlinedHtml, assert } from "./helpers.mjs";

const game = new GameServer();
game.start(NET.tickHz);
const wss = new WebSocketServer({ port: NET.port });
wss.on("connection", (socket) => {
  game.addConnection({
    send: (m) => socket.send(JSON.stringify(m)),
    onMessage: (cb) => socket.on("message", (d) => cb(JSON.parse(d.toString()))),
    onClose: (cb) => socket.on("close", cb),
    close: () => socket.close(),
  });
});

const CHROME =
  process.env.PIXELCLASH_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const html = buildInlinedHtml();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let browser;
try {
  browser = await chromium.launch({ executablePath: CHROME });

  async function openTab() {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    await page.setContent(html, { waitUntil: "load" });
    // Wait until this browser has actually connected and been welcomed by the
    // live server over the real socket.
    await page.waitForFunction(() => window.PIXELCLASH?.net?.localId, { timeout: 10000 });
    return page;
  }

  const tabA = await openTab(); // becomes blue p1
  const tabB = await openTab(); // becomes red p2
  await wait(200);

  const idA = await tabA.evaluate(() => window.PIXELCLASH.net.localId);
  const teamA = await tabA.evaluate(() => window.PIXELCLASH.net.team);
  const idB = await tabB.evaluate(() => window.PIXELCLASH.net.localId);
  const teamB = await tabB.evaluate(() => window.PIXELCLASH.net.team);
  console.log(`Tab A = ${idA}/${teamA}, Tab B = ${idB}/${teamB}`);
  assert(idA === "p1" && teamA === "blue", "Tab A joined the live server as blue");
  assert(idB === "p2" && teamB === "red", "Tab B joined the live server as red");
  assert(game.players.size === 2, "the live server has both real browsers connected");

  // Both teams are now present, so the server runs a short "get ready"
  // countdown before play. The world is frozen until then, so wait for the
  // match to actually start before we try to move.
  await tabA.waitForFunction(() => window.PIXELCLASH.net.phase === "playing", {
    timeout: 10000,
  });
  assert(game.phase === "playing", "the match left the lobby and is now playing");

  // Drive Tab A's keyboard. Tab A must be focused to receive keys.
  await tabA.bringToFront();
  const aStart = await tabA.evaluate(
    () => window.PIXELCLASH.net.players.find((p) => p.id === "p1").x
  );
  await tabA.keyboard.down("d");
  await wait(700);
  await tabA.keyboard.up("d");
  await wait(200);

  const aNow = await tabA.evaluate(
    () => window.PIXELCLASH.net.players.find((p) => p.id === "p1").x
  );
  // What does Tab B *see* for player A (its rendered sprite target)?
  const bSeesA = await tabB.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return s.sprites.get("p1").targetX;
  });
  console.log(`A start=${aStart}, A now=${aNow}, B's sprite of A=${Math.round(bSeesA)}`);
  assert(aNow > aStart + 50, "Tab A's player moved (driven by real keypresses)");
  assert(Math.abs(bSeesA - aNow) <= 12, "Tab B's screen shows A's new position");

  // Fire an attack from A and confirm a bolt appears in B's world.
  await tabA.keyboard.press("k");
  await wait(150);
  const bBolts = await tabB.evaluate(
    () => window.PIXELCLASH.game.scene.getScene("ArenaScene").bolts.size
  );
  console.log(`B renders ${bBolts} bolt(s) from A's attack`);

  // Clear each tab's start gate so the screenshots show the live arena.
  for (const t of [tabA, tabB]) {
    await t.evaluate(() =>
      window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate()
    );
  }
  await tabA.screenshot({ path: "docs/live-tabA.png" });
  await tabB.screenshot({ path: "docs/live-tabB.png" });
  console.log("saved docs/live-tabA.png and docs/live-tabB.png");

  console.log("\nLIVE BROWSER TEST PASSED — two real browsers played over real sockets.");
} catch (e) {
  console.error("\nLIVE BROWSER FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  game.stop();
  wss.close();
}
