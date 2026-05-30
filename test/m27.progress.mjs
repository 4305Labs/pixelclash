// Milestone 27 (progression): heroes earn XP + gold by last-hitting minions,
// towers, and enemy heroes (and a passive trickle); leveling raises max HP and
// attack damage; gold buys capped, cycling shop upgrades; and a reset clears it
// all. The snapshot carries level/gold/buys/maxHp. Pure Node, no sockets.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { PROGRESS, CLASSES } from "../src/config.js";
import { assert } from "./helpers.mjs";

const flush = () => new Promise((r) => setTimeout(r, 10));

const server = new GameServer();
function connect() {
  const pair = createLocalPair();
  server.addConnection(pair.server);
  const c = new NetClient(pair.client);
  c.join();
  return c;
}

try {
  const blue = connect();
  connect();
  server.timeMs = server.startAt;
  server.step(1 / 30);
  assert(server.phase === "playing", "match is live");
  server.minions = [];
  server.nextWaveAt = Infinity;
  server.towers.clear();
  server.pickups = [];

  const p1 = server.players.get("p1"); // blue soldier
  const p2 = server.players.get("p2"); // red

  // --- Start clean ----------------------------------------------------------
  assert(server.levelOf(p1) === 1, "heroes start at level 1");
  assert(server.effectiveMaxHp(p1) === CLASSES[p1.cls].maxHp, "level-1 max HP is the class base");
  assert(server.effectiveDmgMult(p1) === 1, "level-1 damage multiplier is 1");

  // --- Last-hit rewards (minion / tower / hero) -----------------------------
  p1.xp = 0;
  p1.gold = 0;
  server.damageMinion({ team: "red", hp: 5, alive: true }, 999, p1);
  assert(
    p1.xp === PROGRESS.reward.minion.xp && p1.gold === PROGRESS.reward.minion.gold,
    "last-hitting a minion pays its reward"
  );

  p1.xp = 0;
  p1.gold = 0;
  server.damageTower({ team: "red", hp: 5, alive: true }, 999, p1);
  assert(p1.gold === PROGRESS.reward.tower.gold, "destroying a tower pays its reward");

  p1.xp = 0;
  p1.gold = 0;
  p2.alive = true;
  p2.hp = 5;
  server.damage(p2, 999, p1.team, p1);
  assert(p1.gold === PROGRESS.reward.hero.gold, "a hero kill pays its reward");

  // A kill with no hero attacker (e.g. minion melee) pays no one.
  p1.xp = 0;
  p1.gold = 0;
  server.damageMinion({ team: "red", hp: 5, alive: true }, 999); // no attacker
  assert(p1.gold === 0, "a kill with no hero attacker pays nobody");

  // --- Leveling raises HP and damage ----------------------------------------
  p1.xp = PROGRESS.xpPerLevel; // exactly level 2
  assert(server.levelOf(p1) === 2, "XP raises the level");
  assert(
    server.effectiveMaxHp(p1) === CLASSES[p1.cls].maxHp + PROGRESS.hpPerLevel,
    "leveling raises max HP"
  );

  server.projectiles = [];
  p1.cd.basic = 0;
  p1.x = 400;
  p1.y = 300;
  p2.x = 500;
  p2.y = 300;
  p2.alive = true;
  p2.hp = 100;
  server.tryAttack(p1, "basic");
  const lvlDmg = Math.round(CLASSES.soldier.basic.dmg * (1 + PROGRESS.dmgPerLevel));
  assert(server.projectiles.at(-1).dmg === lvlDmg, "leveling raises attack damage");

  // --- Shop: buy, cycle, cap, and the gold gate -----------------------------
  p1.gold = 1000;
  p1.buys = 0;
  p1.bonusHp = 0;
  p1.bonusDmg = 0;
  const item0 = PROGRESS.shop[0];
  server.tryBuy(p1);
  assert(p1.buys === 1 && p1.gold === 1000 - item0.cost, "buying spends gold");
  assert(p1.bonusDmg + p1.bonusHp > 0, "the upgrade applies a bonus");

  server.tryBuy(p1); // cycles to shop[1]
  assert(p1.buys === 2 && p1.bonusHp === PROGRESS.shop[1].hp, "the next buy cycles to the next item");

  p1.gold = 0;
  const heldBuys = p1.buys;
  server.tryBuy(p1);
  assert(p1.buys === heldBuys, "you can't buy without enough gold");

  p1.gold = 100000;
  p1.buys = 0;
  for (let i = 0; i < PROGRESS.shopMaxStacks + 3; i++) server.tryBuy(p1);
  assert(p1.buys === PROGRESS.shopMaxStacks, "buying is capped at the max stacks");

  // --- Passive trickle ------------------------------------------------------
  p1.xp = 0;
  p1.gold = 0;
  for (let i = 0; i < 30; i++) server.step(1 / 30);
  assert(p1.xp > 0 && p1.gold > 0, "alive heroes earn a passive XP/gold trickle");

  // --- Snapshot carries it all ----------------------------------------------
  p1.xp = PROGRESS.xpPerLevel;
  p1.gold = 99;
  p1.buys = 1;
  server.broadcast();
  await flush();
  const me = blue.players.find((p) => p.id === "p1");
  assert(me.level === 2 && me.gold === 99 && me.buys === 1, "snapshot carries level, gold, and buys");
  assert(me.maxHp === server.effectiveMaxHp(p1), "snapshot maxHp reflects level + upgrades");

  // --- Reset clears progression ---------------------------------------------
  server.resetMatch();
  const fresh = server.players.get("p1");
  assert(
    fresh.xp === 0 && fresh.gold === 0 && fresh.buys === 0 && fresh.bonusHp === 0,
    "a match reset clears XP, gold, and upgrades"
  );

  server.stop();
  console.log("\nMILESTONE 27 PROGRESSION TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
