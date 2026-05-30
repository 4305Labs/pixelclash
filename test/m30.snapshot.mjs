// Milestone 30 (snapshot contract): the snapshot is the ONLY thing the client
// sees, so it must always be clean, serializable JSON. JSON silently turns NaN
// into null and drops undefined fields, so a shape bug (like the dash-to-NaN one)
// could corrupt the wire invisibly. This test:
//   1) confirms every top-level "state" key is actually read by NetClient, and
//   2) deep-checks every snapshot across a full live match for NaN / undefined /
//      non-finite numbers — server-side AND after a JSON round-trip.
import { readFileSync } from "node:fs";
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { assert } from "./helpers.mjs";

const DT = 1 / 30;

// Walk any value and report the first "dirty" path (undefined, NaN, or a
// non-finite number). Returns null if clean.
function findDirty(value, path = "snap") {
  if (value === undefined) return `${path} is undefined`;
  if (typeof value === "number" && !Number.isFinite(value)) return `${path} is ${value}`;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const bad = findDirty(value[i], `${path}[${i}]`);
      if (bad) return bad;
    }
  } else if (value && typeof value === "object") {
    for (const k of Object.keys(value)) {
      const bad = findDirty(value[k], `${path}.${k}`);
      if (bad) return bad;
    }
  }
  return null;
}

try {
  // 1) Every top-level state key the server emits is consumed by NetClient.
  //    (We read the client source so this fails loudly if a new field is added
  //    to the snapshot but never wired into the client.)
  const probe = new GameServer();
  const keys = Object.keys(probe.snapshot()).filter((k) => k !== "t");
  const clientSrc = readFileSync(new URL("../src/net/NetClient.js", import.meta.url), "utf8");
  for (const k of keys) {
    assert(clientSrc.includes(`msg.${k}`), `NetClient reads the snapshot field "${k}"`);
  }
  probe.stop();

  // 2) Deep-clean across a full bots-enabled match (the busiest path).
  const server = new GameServer({ bots: true });
  const pair = createLocalPair();
  server.addConnection(pair.server);
  const client = new NetClient(pair.client);
  client.join();

  server.timeMs = server.startAt;
  server.step(DT);
  assert(server.phase === "playing", "match is live");

  const ticks = Math.ceil(45 / DT);
  for (let i = 0; i < ticks; i++) {
    server.step(DT);
    const snap = server.snapshot();
    const bad = findDirty(snap, `tick${i}`);
    assert(bad === null, `snapshot is clean (${bad || "ok"})`);
    // It must also survive the real wire (JSON), unchanged in shape.
    const wire = JSON.parse(JSON.stringify(snap));
    const wireBad = findDirty(wire, `tick${i}.wire`);
    assert(wireBad === null, `snapshot round-trips clean (${wireBad || "ok"})`);
    if (server.phase === "over") break;
  }

  // The client's stored state after real delivery is also clean.
  server.broadcast();
  await new Promise((r) => setTimeout(r, 10));
  for (const p of client.players) {
    assert(Number.isFinite(p.x) && Number.isFinite(p.y), "client player positions are finite");
  }

  server.stop();
  console.log("\nMILESTONE 30 SNAPSHOT CONTRACT TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
