// Milestone 25 (AI bots): with bots enabled, a lone human gets a bot opponent so
// the match can start; the bot actually plays (moves and shoots); a second human
// takes the bot's place; and bots clear out once the last human leaves. Bots are
// OFF by default, so a plain server is unchanged. Pure Node, no sockets.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { assert } from "./helpers.mjs";

const flush = () => new Promise((r) => setTimeout(r, 10));

function connect(server) {
  const pair = createLocalPair();
  server.addConnection(pair.server);
  const c = new NetClient(pair.client);
  c.join();
  return c;
}

try {
  // --- Bots are off by default ----------------------------------------------
  {
    const plain = new GameServer();
    connect(plain);
    assert(
      plain.countTeam("blue") === 1 && plain.countTeam("red") === 0,
      "without the option, no bot fills the empty team"
    );
    plain.stop();
  }

  // --- A lone human gets a bot opponent -------------------------------------
  const server = new GameServer({ bots: true });
  connect(server); // human p1 -> blue
  await flush();
  let bots = [...server.players.values()].filter((p) => p.bot);
  assert(server.players.size === 2, "the server has the human plus one bot");
  assert(bots.length === 1 && bots[0].team === "red", "a bot fills the empty red team");
  assert(server.phase === "countdown", "with the bot present, the match can start");

  // --- The bot plays --------------------------------------------------------
  server.timeMs = server.startAt;
  server.step(1 / 30);
  assert(server.phase === "playing", "match is live");
  const bot = bots[0];
  const bx0 = bot.x;
  for (let i = 0; i < 12; i++) server.step(1 / 30);
  assert(
    bot.x !== bx0 || server.projectiles.some((b) => String(b.ownerId).startsWith("bot")),
    "the bot acts — it moves and/or shoots"
  );

  // --- A second human takes the bot's place ---------------------------------
  connect(server); // human -> red, replacing the bot
  await flush();
  assert(
    [...server.players.values()].filter((p) => p.bot).length === 0,
    "a second human replaces the bot"
  );
  assert(
    server.countHumans("blue") === 1 && server.countHumans("red") === 1,
    "one human on each team"
  );

  // --- The last human leaving clears the bots -------------------------------
  for (const id of [...server.connections.keys()]) server.removeConnection(id);
  assert(server.players.size === 0, "with no humans left, bots are cleared");

  server.stop();
  console.log("\nMILESTONE 25 BOT TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
