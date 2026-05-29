// Phase F — deploy: the client picks the right server address for each
// environment. Pure logic, no browser: we fake `window`/`location` globals and
// check the three cases (explicit override, HTTPS→wss, local http→ws:port).
import assert from "node:assert";
import { NET } from "../src/config.js";
import { defaultServerUrl } from "../src/net/WebSocketConnection.js";

function withGlobals({ search = "", hostname = "localhost", protocol = "http:", server }, fn) {
  const win = {};
  if (server) win.PIXELCLASH_SERVER = server;
  global.window = win;
  global.location = { search, hostname, protocol };
  try {
    return fn();
  } finally {
    delete global.window;
    delete global.location;
  }
}

try {
  // 3) Local dev over http → ws://host:port.
  const local = withGlobals({ hostname: "localhost" }, defaultServerUrl);
  assert.strictEqual(local, `ws://localhost:${NET.port}`, "local dev uses ws://host:port");
  console.log("  ok local:", local);

  // Phone on Wi-Fi reuses the page's IP host.
  const lan = withGlobals({ hostname: "192.168.1.5" }, defaultServerUrl);
  assert.strictEqual(lan, `ws://192.168.1.5:${NET.port}`, "LAN reuses the page host");
  console.log("  ok lan:", lan);

  // 2) Page served over HTTPS with no override → wss://host (port 443).
  const https = withGlobals({ hostname: "me.github.io", protocol: "https:" }, defaultServerUrl);
  assert.strictEqual(https, "wss://me.github.io", "https page uses wss:// (no insecure ws)");
  console.log("  ok https:", https);

  // 1a) Explicit global override wins (cross-host deploy).
  const viaGlobal = withGlobals(
    { hostname: "me.github.io", protocol: "https:", server: "wss://pixelclash.onrender.com" },
    defaultServerUrl
  );
  assert.strictEqual(viaGlobal, "wss://pixelclash.onrender.com", "PIXELCLASH_SERVER override wins");
  console.log("  ok override:", viaGlobal);

  // 1b) ?server= query param wins, even over the global.
  const viaQuery = withGlobals(
    { protocol: "https:", search: "?server=wss://q.example", server: "wss://ignored" },
    defaultServerUrl
  );
  assert.strictEqual(viaQuery, "wss://q.example", "?server= query param wins");
  console.log("  ok query:", viaQuery);

  console.log("\nMILESTONE 16 SERVER-URL TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
