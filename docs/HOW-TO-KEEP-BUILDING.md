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
| Stronger base healing fountain | `BASE.healPerSec` | `50` |
| Bigger fountain area | `BASE.healRadius` | `100` |
| Quicker respawns | `COMBAT.respawnMs` | `1000` |
| Longer/shorter time limit | `MATCH.maxDurationMs` | `300000` (=5 min) |
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

## 3. The dash ability (already done ✅)

There's now a **dash**: a quick burst along the direction you're facing, on a
cooldown. Use the **C** button (touch) or **L** / **Shift** (keyboard).

- Tune it in `src/config.js` → `DASH` (`distance` in pixels, `cd` cooldown ms).
- Server logic is `GameServer.tryDash()`; the client sends it via
  `NetClient.sendDash()`, wired to the key/button in `ArenaScene`.

This is a good template for **adding your own ability**: copy the same four
touch points — a config entry, a server `try…` method + an `onMessage` case, a
`send…` on `NetClient`, and a key/button in `ArenaScene`.

---

## 4. Tune the lane minions, towers & pickups (already done ✅)

Both teams now spawn waves of weak AI **minions** that march toward the enemy
base, fight whatever they meet, and chip the base when they arrive. Everything
about them lives in `src/config.js` → `MINION`:

| You want… | Change this | Try |
|---|---|---|
| Bigger waves | `perWave` | `5` |
| Waves more often | `waveEvery` | `6000` (=6s) |
| Tankier minions | `maxHp` | `70` |
| Harder-hitting minions | `dmg` | `7` |
| Minions that chase further | `aggro` | `220` |
| Faster minions | `speed` | `130` |

The brain is `GameServer.stepMinions()` (spawning, target choice, and melee);
`spawnWave()` places each wave just in front of its base, staggered across the
open center lane. Minions reuse the same wall-sliding movement (`resolveMove`)
as players, and are drawn by `src/entities/Minion.js`.

> Minions only spawn during a live match (after the countdown), so the lobby
> stays calm. If you want lane creeps to feel central, raise `perWave` and lower
> `waveEvery`; for a more hero-focused game, do the opposite.

**Guard towers** live alongside them, tuned in `src/config.js` → `TOWER` (and
positioned by `TOWER_POS`). A tower auto-zaps the nearest enemy unit in range:

| You want… | Change this | Try |
|---|---|---|
| Tankier towers | `maxHp` | `300` |
| Towers that hit harder | `dmg` | `20` |
| Faster-firing towers | `cd` | `500` (=0.5s) |
| Longer tower reach | `range` | `220` |
| Move a tower | `TOWER_POS.blue` / `.red` | `{ x, y }` in world px |

The logic is `GameServer.stepTowers()` (find nearest enemy unit in range, fire a
bolt on cooldown) and `nearestEnemyUnit()`. Towers reuse the projectile system,
so a tower bolt damages enemies exactly like a hero's does. They're drawn by
`src/entities/Tower.js`. Destroying a tower never wins the match — only razing
the enemy **base** does.

A base is **shielded** (immune to damage, and ignored by auto-aim) until its own
tower is gone — so the tower is the gate to victory. That rule is just
`GameServer.baseVulnerable(team)` (is the team's tower dead?), checked in
`damageBase()` and `nearestTarget()`; the client shows a glowing ring around a
shielded base (`Base.setShielded`). Want classic uncapturable bases or a
different gate? Tweak `baseVulnerable`.

**Map pickups** are tuned in `src/config.js` → `PICKUP`, and placed by
`PICKUP_SPOTS` (all on the center column so they're fair to both teams):

| You want… | Change this | Try |
|---|---|---|
| Bigger heals | `PICKUP.heal` | `60` |
| Stronger power buff | `PICKUP.powerMult` | `2.0` |
| Longer power buff | `PICKUP.powerMs` | `10000` (=10s) |
| Faster orb respawns | `PICKUP.respawnMs` | `6000` |
| Add/move an orb | `PICKUP_SPOTS` | `{ id, kind: "heal"`\|`"power", x, y }` |

The logic is `GameServer.stepPickups()` (grant to a player standing on an active
orb, then respawn it on a timer) and `grantPickup()`. A heal restores HP
instantly; a power orb sets `player.powerUntil`, and `tryAttack()` multiplies a
buffed bolt's damage. The client draws active orbs (`syncPickups`) and a glow on
a powered hero (`Player.setPowered`). New `kind`s are easy: add a case to
`grantPickup` and a texture in `textures.js`.

**Progression (XP / levels / gold)** is tuned in `src/config.js` → `PROGRESS`:

| You want… | Change this | Try |
|---|---|---|
| Faster leveling | `PROGRESS.xpPerLevel` | `80` |
| Bigger per-level HP | `PROGRESS.hpPerLevel` | `30` |
| Bigger per-level damage | `PROGRESS.dmgPerLevel` | `0.18` |
| Richer last-hits | `PROGRESS.reward.minion` | `{ xp, gold }` |
| Cheaper/new shop items | `PROGRESS.shop` | `{ id, name, cost, dmg`\|`hp }` |

Heroes earn from last-hits (the killing bolt's owner is paid in `awardKill`, wired
through `damage`/`damageMinion`/`damageTower`) plus a passive trickle. `levelOf`,
`effectiveMaxHp`, and `effectiveDmgMult` fold level + shop buys into the stats
used by `tryAttack`, respawn, and the snapshot. `tryBuy` spends gold (bots call it
too); the client shows level/gold/next-item in `ArenaScene.updateShopHud` and `B`
buys. A fresh level-1 hero with no buys is exactly the base stats.

---

## 5. Hero classes (already done ✅)

Players pick a hero in the lobby (keys `1`/`2`/`3`): **Scout** (fast, fragile),
**Soldier** (balanced), or **Tank** (slow, beefy). Tune them in `src/config.js`
→ `CLASSES`. Each entry sets `maxHp`, an on-screen `scale`, and its own
`basic`/`ability` stats (`dmg`, `cd`, `speed`, `ttl`):

| You want… | Change this | Try |
|---|---|---|
| A beefier tank | `CLASSES.tank.maxHp` | `220` |
| A faster-firing scout | `CLASSES.scout.basic.cd` | `180` |
| A harder-hitting tank ult | `CLASSES.tank.ability.dmg` | `60` |

All classes move at the same speed, so the shared movement/prediction code
(`sim.js`) doesn't change. The server applies a player's class in `freshPlayer`,
`tryAttack` (per-class damage), and respawn/heal (per-class max HP); the client
draws the picker (`ArenaScene.updateLobby`) and the per-class size
(`Player.setClass`). "soldier" is intentionally identical to the base `COMBAT`
stats, so it's the safe default. Adding a 4th class? Add it to `CLASSES` and
`CLASS_ORDER`, then extend the lobby key handling (it currently maps keys 1–3).

---

## 6. Go from 1v1 to 3v3

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

> **AI bots (already done ✅):** the server is started with `new GameServer({
> bots: true })` (see `server.js`), so a lone player is given a bot opponent and
> the bot steps aside when a second human joins. Bots reuse the auto-aim picker
> to choose targets (`GameServer.stepBots`); `BOT_STANDOFF` sets how close they
> hold before firing. They fill up to `MATCH.minPerTeam` per team — raise that
> (and `SPAWNS`) for bot-filled 3v3.

The networking itself does **not** need to change to add more players.

---

## 7. The art: hand-drawn pixel sprites + procedural animation (already done ✅)

All art is **drawn in code** — no image files. `src/textures.js` paints each
sprite from a small palette: heroes/minions are authored as **pixel grids**
(`paintGrid` turns rows of characters into pixels; `shade` derives team
shadow/highlight tints), and the bases, towers, orbs, and floor/wall tiles are
built with shaded shapes. To tweak a sprite, edit its grid or maker and refresh
— team colours come from `COLORS` in `config.js`.

Movement is brought to life by `src/anim.js` — pure, testable animation math: an
idle breathing **bob**, a **walk hop** with squash & stretch, and an **attack
pop**. The entities (`Player`, `Minion`) call `animate(dt)` each frame and apply
the returned offset/scale on top of the class size. Tune the feel via the
constants at the top of `anim.js` (`WALK_HZ`, `WALK_BOB`, `POP_MS`, …).

### Want to swap in your own .png art instead?

Right now sprites are drawn in `src/textures.js`. To use real image files:

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

## 8. Movement feel (client-side prediction — already done ✅)

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

## 9. Put it online so friends can play

To play with someone **not** on your Wi-Fi, two things need a home on the
internet: the **game server** (`server.js`, a long-running Node process) and the
**web page** (a folder of static files). They can live in different places.

> ⚠️ The free tiers below **require making an account**, and free servers often
> **sleep when idle** — the first player after a quiet spell may wait ~30s for
> it to wake. That's fine for playing with friends; check current pricing before
> relying on it for anything bigger.

### Step 1 — Host the game server (Render, free tier)

1. Push this project to a GitHub repo (it probably already is).
2. Go to <https://render.com>, sign up, and click **New → Web Service**.
   Connect your GitHub and pick this repo.
3. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `npm run server`
   - **Instance Type:** Free
4. Create the service. When it's live, Render gives you a URL like
   `https://pixelclash-xyz.onrender.com`. Your WebSocket address is the **same
   host with `wss://`**: `wss://pixelclash-xyz.onrender.com`. Copy it.

   (No port to configure: the server already reads Render's `PORT` for you, and
   Render handles the secure `wss://` layer.)

   Railway (<https://railway.app>) works the same way if you prefer it.

### Step 2 — Point the web page at that server

Open **`index.html`**. Near the bottom there's a commented-out line; uncomment
it and paste your server address:

```html
<script>window.PIXELCLASH_SERVER = "wss://pixelclash-xyz.onrender.com";</script>
```

That's the **only** code change needed to go online. (Under the hood
`src/net/WebSocketConnection.js` → `defaultServerUrl()` reads that value; with no
override it auto-uses `wss://` on an https page and `ws://localhost` in dev. You
can also test without editing anything by adding `?server=wss://…` to the page
URL.)

### Step 3 — Host the web page (GitHub Pages or Netlify, free)

1. Build the static page: `npm run build` → it writes the `dist/` folder.
2. Put `dist/` online:
   - **Netlify** (<https://netlify.com>): drag-and-drop the `dist/` folder onto
     their dashboard — done, you get a public URL.
   - **GitHub Pages** / **Cloudflare Pages**: point them at this repo with build
     command `npm run build` and publish directory `dist`.
3. Open the page's URL on any device, share it with a friend, and you're both in
   the same battle. 🎉

> **Must be https:** browsers block a secure page from talking to an insecure
> `ws://` server, which is why Step 1 uses `wss://`. Netlify/Pages serve https
> automatically, so this just works.

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
