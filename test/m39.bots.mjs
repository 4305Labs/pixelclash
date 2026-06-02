// Milestone 39 (smarter bots): the bot brain plays with intent, not at random —
// it fires its ability when an enemy hero is in range, refuses to dive an enemy
// tower without minion support, and retreats home when low. Pure Node: we build
// a tiny scenario and call stepBots() directly, asserting the chosen behaviour.
import GameServer from "../src/net/GameServer.js";
import { CLASSES, TOWER } from "../src/config.js";
import { assert } from "./helpers.mjs";

// Make a fresh blue BOT vs a red enemy hero on a clean field (no towers/camps/
// minions unless the test adds them).
function scenario(botCls = "mage") {
  const server = new GameServer();
  server.phase = "playing";
  server.towers = [];
  server.camps = [];
  server.minions = [];
  server.projectiles = [];
  const bot = server.freshPlayer("b1", "blue", 0, botCls);
  bot.bot = true;
  bot.x = 300;
  bot.y = 300;
  server.players.set("b1", bot);
  const foe = server.freshPlayer("r1", "red", 0, "soldier");
  server.players.set("r1", foe);
  return { server, bot, foe };
}

try {
  // 1) Ability fires when an enemy hero is in range — deterministically, not on
  // a random roll.
  {
    const { server, bot, foe } = scenario("mage");
    foe.x = 410; foe.y = 300; // ~110px away, well within striking range
    server.stepBots();
    assert(
      server.projectiles.some((b) => b.ownerId === "b1" && b.kind === "ability"),
      "a bot fires its ability when an enemy hero is in range"
    );
  }

  // …and it does NOT blow the ability when no enemy hero is near.
  {
    const { server, bot, foe } = scenario("mage");
    foe.x = 760; foe.y = 300; // far away (> the ~300px ability range)
    server.stepBots();
    assert(
      !server.projectiles.some((b) => b.ownerId === "b1" && b.kind === "ability"),
      "a bot holds its ability when no enemy hero is in range"
    );
  }

  // 2) Tower respect: standing in an enemy tower's range with NO friendly minion,
  // the bot backs away from the tower instead of diving.
  {
    const { server, bot, foe } = scenario("soldier");
    foe.x = 560; foe.y = 300; // the target is past the tower
    server.towers = [{ team: "red", lane: "mid", x: 340, y: 300, hp: TOWER.maxHp, alive: true, cd: 0 }];
    server.stepBots();
    assert(bot.input.dx < 0, "a bot backs off from an enemy tower it can't safely dive");
  }

  // …but WITH a friendly minion to soak the tower, it pushes in toward the target.
  {
    const { server, bot, foe } = scenario("soldier");
    foe.x = 560; foe.y = 300;
    server.towers = [{ team: "red", lane: "mid", x: 340, y: 300, hp: TOWER.maxHp, alive: true, cd: 0 }];
    server.minions = [{ id: "m1", team: "blue", x: 320, y: 300, hp: 40, alive: true, cd: 0 }];
    server.stepBots();
    assert(bot.input.dx > 0, "with minion support a bot pushes the tower instead of backing off");
  }

  // 3) Low on HP, the bot retreats toward its own base (home is to the left).
  {
    const { server, bot, foe } = scenario("soldier");
    bot.hp = CLASSES.soldier.maxHp * 0.2; // hurt
    foe.x = 360; foe.y = 300; // enemy right next to it
    server.stepBots();
    assert(bot.input.dx < 0, "a hurt bot retreats toward home rather than fighting on");
  }

  console.log("\nMILESTONE 39 BOT TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
