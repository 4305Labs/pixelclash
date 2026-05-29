# How to keep building PixelClash

Written for a non-coder. Every change below is small and safe. After **any**
change, just refresh the browser tab (Vite reloads automatically). If you
change `server.js` or anything in `src/net/`, stop the server (`Ctrl+C`) and
run `npm run server` again, because the server only reads its code at startup.

> **Golden rule:** change one thing, save, refresh, and check it still works.
> If it breaks, undo that one change. Small steps are easy to debug together.

---

## 1. The easiest wins: tune the numbers

Open **`src/config.js`**. This file is just labeled numbers — no real "code."
Change a value, save, refresh. Examples:

| You want… | Change this | Try |
|---|---|---|
| Faster characters | `PLAYER_SPEED` | `300` |
| Beefier players | `COMBAT.maxHp` | `150` |
| Harder-hitting basic attack | `COMBAT.basic.dmg` | `12` |
| Faster ability cooldown | `COMBAT.ability.cd` | `1500` (=1.5s) |
| Tougher bases (longer matches) | `BASE.maxHp` | `400` |
| Quicker respawns | `COMBAT.respawnMs` | `1000` |
| Different team colors | `COLORS.blueTeam` / `redTeam` | any `0xRRGGBB` hex |

`0xRRGGBB` is how colors are written in code: `0x` then a 6-digit hex color
(e.g. `0x00ff00` is pure green). Pick colors at <https://htmlcolorcodes.com/>
and put `0x` in front of the 6 digits.

---

## 2. Change how an attack feels

Still in `src/config.js`, under `COMBAT`:
- `speed` — how fast the bolt flies (pixels/second).
- `ttl` — how long the bolt lives before vanishing (milliseconds). Bigger =
  longer range.
- `radius` / `color` — the bolt's size and color on screen.

The actual firing logic lives in `src/net/GameServer.js` → `tryAttack()`. You
usually won't need to touch it just to rebalance.

---

## 3. Add a second ability (a "dash")

This is the natural next feature. A dash teleports you a short distance.

1. In `src/config.js`, add a dash spec near `COMBAT`:
   ```js
   export const DASH = { distance: 120, cd: 2000 }; // 120px hop, 2s cooldown
   ```
2. In `src/net/GameServer.js` → `onMessage()`, handle a new message:
   ```js
   } else if (msg.t === "dash") {
     this.tryDash(p);
   }
   ```
   and add a `tryDash(player)` method that checks a cooldown and moves the
   player `DASH.distance` pixels along `player.face`.
3. In `src/net/NetClient.js`, add `sendDash() { this.conn.send({ t: "dash" }); }`.
4. In `src/scenes/ArenaScene.js`, add a key (e.g. `keydown-L`) and/or a third
   `ActionButton` that calls `this.net.sendDash()`.

Ask your AI assistant to write these exact edits — this list tells it precisely
where each piece goes.

---

## 4. Go from 1v1 to 3v3

Good news: the server already supports any number of players (it alternates
teams as people join), friendly fire is already off, and bolts already pick the
nearest enemy or base. To make 3v3 feel right you'd typically:

- **Lock teams / match size:** in `GameServer.addConnection`, stop accepting
  new players once 6 have joined, and consider starting the match only when
  both teams are full.
- **Spread out spawns:** in `src/config.js`, make `SPAWNS` an array of a few
  positions per team instead of one point, so teammates don't stack.
- **Maybe add lanes/obstacles:** draw walls in `ArenaScene.drawGrid()` and add
  collision checks in the server's movement step.

The networking itself does **not** need to change to add more players.

---

## 5. Replace the code-drawn art with real pixel art

Right now sprites are drawn in `src/textures.js`. To use real art instead:

1. Put `.png` files in a new `public/` folder (e.g. `public/player_blue.png`).
2. In `ArenaScene.preload()` (add one if missing), load them:
   ```js
   this.load.image("player_blue", "player_blue.png");
   ```
3. Remove or stop calling the matching `make…Texture` in `textures.js` so your
   real image isn't overwritten.

Free pixel-art tools: **Piskel** (<https://www.piskelapp.com/>, draws in the
browser) and **LibreSprite** (free, desktop). Free art packs: **Kenney**
(<https://kenney.nl/assets>, no account needed).

---

## 6. Movement feel (client-side prediction — already done ✅)

Your own player now moves the **instant** you press a key, instead of waiting
for the server to reply. This is "client-side prediction": the browser predicts
your movement locally, then gently corrects toward the server's authoritative
position so you never drift out of sync.

- The shared movement math lives in `src/sim.js` (used by **both** the server
  and the client, so they always agree).
- The prediction + correction lives in `src/scenes/ArenaScene.js` →
  `predictLocal()`. The `RECONCILE_RATE` constant at the top of that file
  controls how firmly you're pulled toward the server's truth — higher = more
  rigid/accurate, lower = smoother but looser. (Equilibrium error while moving
  ≈ `PLAYER_SPEED / RECONCILE_RATE` pixels.)

Other players are still drawn by gliding toward their latest reported position
(interpolation), which is the normal approach for opponents.

---

## 7. Put it online so friends can play

To play with someone **not** on your Wi-Fi, the server needs to live on the
internet. Beginner-friendly, free-tier-friendly options:

- **Render** (<https://render.com>) or **Railway** (<https://railway.app>) for
  the Node server (`server.js`). ⚠️ These have free tiers but **require making
  an account**, and free instances may sleep when idle — check current pricing
  before relying on them.
- **The web page** (the Vite build, `npm run build` → `dist/`) can be hosted
  free on **GitHub Pages**, **Netlify**, or **Cloudflare Pages**.
- You'll then point the client at your hosted server's address. The lookup
  lives in `src/net/WebSocketConnection.js` → `defaultServerUrl()`; you'd swap
  `ws://` for `wss://` (secure) and use your server's public hostname.

We can do this together when you're ready — flag it and we'll go one step at a
time.

---

## Troubleshooting

- **Phone can't connect on Wi-Fi:** your Mac's firewall may block it. Also
  confirm the phone uses the `http://192.168.x.x:5173` *Network* address (not
  `localhost`), and that `npm run server` is running. Some routers ("client
  isolation") block device-to-device traffic — try a phone hotspot instead.
- **"Connecting to server…" never goes away:** the game server isn't running.
  Start it with `npm run server` in its own Terminal.
- **Nothing happens when I move:** make sure you clicked *inside* the game tab
  first so it has keyboard focus.
- **Always paste the exact red error text** to your AI assistant — that's the
  single fastest way to get unstuck.
```
