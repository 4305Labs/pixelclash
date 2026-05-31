# HANDOVER — PixelClash

> **Purpose:** a living handover so any agent (Claude Code, ChatGPT Codex, or a
> human) can pick this project up cold and keep building safely.
> **Update this file after every major change** (see *Update protocol* at the end).
>
> **Last updated:** commit `9c8bb17` — "Three lanes (increment B): per-lane minion waves"
> **Status:** all tests green (54 test groups), live two-browser test green, build OK.
>
> ⚠️ **WORK FROM THE BRANCH, NOT `main`.** All work lives on
> **`claude/pixel-moba-game-WobPa`** (PR #1 → `main`). `main` is the empty root
> commit and does NOT have the game. First thing on a new machine:
> ```bash
> git fetch origin && git checkout claude/pixel-moba-game-WobPa
> ```
> Keep developing on this branch unless told otherwise.

---

## 1. What this is

PixelClash — a pixel-art, browser-first **MOBA arena battler**. Phaser 3 + Vite
client; a Node + `ws` **server-authoritative** game server. Move / basic attack /
ability / dash; lane minions + guard towers push the lane; a base is shielded
until its tower falls; destroy the enemy base (or be ahead on kills at the time
limit) to win. Solo vs **AI bots**, up to 3v3. Six hero classes, gold/XP
progression with a shop, map pickups + a base healing fountain, a 3-route map
(center lane + top/bottom jungle), and a full HUD (scoreboard, clock, kill feed,
respawn timer). All art is **drawn in code** (no asset files); all sound is
**synthesized** at runtime.

## 2. Run it / test it

```bash
npm install
npm run server     # authoritative server, ws://localhost:2567 (honors PORT)
npm run dev        # Vite client, usually http://localhost:5173
npm run build      # production build -> dist/
npm test           # the whole headless suite (test/run-all.mjs; builds once)
node test/live-browser.mjs   # full stack: real ws server + 2 headless Chromium tabs
node test/screenshot*.mjs    # regenerate docs/*.png
```

Open the client and you immediately get a **bot opponent** (server starts with
`{ bots: true }`); open a 2nd tab for a real 1v1 and the bot steps aside.

## 3. Architecture (read these first)

- **`src/net/GameServer.js`** — the authoritative brain. Owns ALL real state
  (players incl. bots, minions, towers, bases, pickups, projectiles, score, kill
  feed, match phase/clock, progression) and the fixed-tick `step(dt)` loop. Knows
  nothing about sockets/Phaser; talks to "connections" (`.send/.onMessage/.onClose`).
- **`src/sim.js`** — the SINGLE source of movement math (`stepPosition`,
  `resolveMove`, wall collision, `pointInWall`). Shared by server AND client
  prediction so they agree. **All heroes share one movement speed** — classes
  differ in HP/attacks only. Don't break this without updating prediction.
- **`src/net/NetClient.js`** — browser side: sends input/attack/dash/class/buy,
  stores the latest snapshot. Phaser-free, unit-testable in Node.
- **`src/scenes/ArenaScene.js`** — the only scene. Input, HUD, the touch UI, and
  `sync*()` methods that reconcile sprites to each snapshot. Local hero is
  predicted (`predictLocal`); everyone else interpolates. Also draws the map
  (`drawGrid` = floors, `drawDecor` = jungle props, `drawWalls`).
- **`src/entities/`** — display objects: `Player`, `Minion`, `Tower`, `Base`.
- **`src/anim.js`** — pure (no-Phaser) procedural animation math: idle bob, walk
  hop w/ squash-stretch, attack pop. Entities call `animate(dt)`.
- **`src/config.js`** — ALL tunable numbers + layout. Balance/map lives here.
- **`src/textures.js`** — every sprite drawn in code. `paintGrid(rows,palette)`
  + `shade(color,f)` toolkit; per-class hero grids (`HERO_HEADS` on a shared
  `HERO_BODY`); floor/wall/decor/structure makers. `generateTextures(scene)`
  bakes them all at boot.
- **`src/audio.js`** — WebAudio blips (shoot/hit/death/base/win/pickup) + mute,
  guarded so headless/no-audio is a silent no-op.
- **`src/record.js`** — persisted win/loss/draw tally (localStorage, guarded).
- Transports: `WebSocketConnection.js` (real, with `defaultServerUrl()` ws/wss
  auto-switch + `?server=`/`window.PIXELCLASH_SERVER` override) and
  `LocalConnection.js` (in-memory, used by tests).

### The snapshot is the contract
`GameServer.snapshot()` is the ONLY thing the client sees. When you add state,
add it to `snapshot()` AND read it in `NetClient._receive` AND render it in a
`sync*`/`update*` method. **`m30.snapshot` enforces that every top-level field is
read by NetClient**, so a new field with no client reader fails the suite.

Current top-level fields: `t, tick, phase, winner, score, killFeed, needed,
countdown, timeLeft, players[], projectiles[], minions[], pickups[], camps[],
towers[], bases[]`.
Per-player: `id, team, x, y, hp, maxHp, alive, cls, bot, level, gold, buys,
respawnIn, powered, hidden`. Per-base adds `shielded`.

## 4. Feature map (where to look)

| System | Server (`GameServer.js`) | Client | Config |
|---|---|---|---|
| Movement/prediction | `step()` move loop | `predictLocal`, `sim.js` | `PLAYER_SPEED` |
| Combat (basic/ability/dash) | `tryAttack`, `tryDash` | `doAction` | `COMBAT`, `DASH` |
| Bases + win/shield | `damageBase`, `baseVulnerable` | `Base` (shield ring) | `BASE`, `BASE_POS` |
| 3 lanes (top/mid/bot) | per-lane in `spawnWave`/`resetTowers` | lane geometry | `LANES`, `TOWER_X` |
| Lane minions (per lane) | `stepMinions`, `spawnWave`, `moveMinion` | `syncMinions`, `Minion` | `MINION` |
| Guard towers (6, array) | `stepTowers`, `nearestEnemyUnit`, `baseVulnerable` (all towers) | `syncTowers` (team+lane key), `Tower` | `TOWER`, `TOWER_X` |
| Map pickups + power buff | `stepPickups`, `grantPickup` | `syncPickups` | `PICKUP`, `PICKUP_SPOTS` |
| Healing fountain | `stepFountains` | `Base` fountain ring | `BASE.heal*` |
| Jungle camps (neutral) | `stepCamps`, `damageCamp`, `hitCamp` | `syncCamps`, `Camp` | `CAMP`, `CAMP_SPOTS` |
| Bush stealth | `isHidden` gates all enemy targeting | `Player.setHidden`, `drawDecor` zones | `BUSH`, `BUSH_ZONES` |
| Hero classes (×6) | per-class in `freshPlayer`/`tryAttack`/respawn | `Player.setClass`, lobby picker | `CLASSES`, `CLASS_ORDER` |
| Progression (XP/gold/shop) | `awardKill`, `levelOf`, `effective*`, `tryBuy` | `updateShopHud`, level badges | `PROGRESS` |
| Match lifecycle + timer | `evaluateLobby`, `beginPlaying`, `endByTimeout` | `updateLobby`, `updateGameOver` | `MATCH` |
| Scoreboard / kill feed / respawn | `score`, `killFeed`, `damage(...,byTeam,attacker)` | `updateHud`, `updateKillFeed` | `KILLFEED` |
| AI bots | `stepBots`, `fillBots`, `addBot` | "bot" tag | (`{bots:true}` in server.js) |
| Map (3 routes + jungle) | — | `drawGrid/drawDecor/drawWalls` | `WALLS`, `LANE_BAND`, `DECOR_SPOTS` |
| Art / animation | — | `textures.js`, `anim.js`, entities | `COLORS`, sprite grids |
| Audio / record | — | `audio.js`, `record.js` | — |

## 5. Conventions & invariants (don't break these)

- **Server stays authoritative.** Clients only render + predict the LOCAL player.
- **Tune in `config.js`**, not scattered literals.
- **All heroes share `PLAYER_SPEED`** (prediction depends on it).
- **One feature = one commit.** Commit messages end with the session link and
  **avoid backticks** (they get shell-substituted — use `git commit -F -` heredoc).
- **Each feature ships tests**: a `test/mNN.<name>.mjs` (server, pure Node) and
  usually a `.render.mjs` (headless via `openGame()` + injected snapshots), wired
  into `test/run-all.mjs`. Keep beginner-readable comments.
- **Whole-system safety nets — run/extend after cross-system changes:**
  - `m29.integration` — full bots match through the real `step()` loop, asserting
    invariants every tick (positions finite + in-bounds, hp≤max, gold/xp≥0, …).
  - `m30.snapshot` — every snapshot is NaN/undefined-free + JSON round-trips, and
    every top-level field is read by NetClient.
- **Headless tests have no audio/localStorage device** — guard new browser APIs
  (see `audio.js`/`record.js` `safeStorage`).
- **Texture dimensions are load-bearing**: bases/towers/pickups size from config
  radii and feed hit detection. Keep a sprite's texture the same size when
  reskinning, or update the matching radius.
- **Map invariants**: each `LANES` row (top=110, mid=300, bot=490) must stay
  clear of walls full-width so minions march it (verify with a wall-overlap
  script before moving a row). `WALLS[0]/[1]` are the two central pillars (now
  shortened to sit BETWEEN the lanes) — `m13.walls` reads `WALLS[0]` and shoots
  at its computed mid-row, so keep it a pillar at x≈392. `TOWER_X` spots and
  `BUSH_ZONES` must stay wall-free; `LANE_BAND` (the jungle-floor band) is purely
  cosmetic and independent of `LANES`.
- **Towers are an ARRAY** `[{team,lane,...}]` (not a Map) — 3 per team. Use
  `find(t=>t.team===x && t.lane===y)`, not `.get(team)`. `baseVulnerable(team)`
  is true only when ALL of a team's towers are dead. Client keys tower sprites
  by `team_lane`.

### Gotchas that have bitten us
- Several systems are **armed only by `beginPlaying()`** (minion `nextWaveAt`,
  `matchEndsAt`) and disarmed to `Infinity` otherwise, so tests that set
  `phase="playing"` directly don't trip them.
- Towers sit on the center row → some server tests `server.towers.clear()` to
  isolate a clean lane shot.
- **Bots are opt-in** (`new GameServer({ bots: true })`) so they never affect
  existing tests. Team balance counts *humans*; a human replaces a bot.
- `face` is stored as `{x,y}` but `normalizeInput` returns `{dx,dy}` — a past
  mismatch caused a dash-to-NaN bug. Keep facing as `{x,y}`.
- Phaser gives `tileSprite` internal UUID texture keys; store references (e.g.
  `this.laneFloor`, `this.decor`) rather than filtering the display list by key.
- **Process discipline:** edits to the same file applied as a parallel batch have
  landed out of order and produced a broken commit (a called-but-undefined
  method). Prefer **sequential** edits on a given file, and verify a change with
  a direct test run before committing — don't trust stale background-task output.

## 6. Deploy (already wired)

`server.js` honors `PORT` (Render/Railway). `index.html` has a commented
`window.PIXELCLASH_SERVER` hook for cross-host hosting; `defaultServerUrl()`
auto-uses `wss://` on an https page. Step-by-step guide:
`docs/HOW-TO-KEEP-BUILDING.md` §9.

## 7. Where things stand / good next steps

The core MOBA loop + progression + 6 heroes + a 3-route jungle map + full pixel-
art pass (characters/terrain/structures/animation) are all done and tested.
Candidate next features (each self-contained):
- **Jungle objectives** — a neutral buff camp per jungle pocket worth gold/XP
  (reuses the pickup/minion systems).
- **Bushes as stealth** — hide heroes standing in bush tiles (adds flank mind-games).
- **Per-hero unique abilities** (behaviorally different, not just stat deltas).
- **Recall/teleport home**; **lifesteal shop item**; **balance pass** via bot-vs-bot.

## 8. Branch / PR — IMPORTANT

- **All work is on `claude/pixel-moba-game-WobPa`.** This is the ONLY branch with
  the game. `main` is just the empty root commit (PR #1 targets it) — never
  develop on `main`, and don't push to other branches without explicit permission.
- On any fresh checkout / new tool (e.g. ChatGPT Codex), start with:
  ```bash
  git fetch origin && git checkout claude/pixel-moba-game-WobPa
  ```
- Repo: `4305labs/pixelclash`. PR: **#1**.

## 9. Player-facing docs to keep in sync

- `README.md` — how to play, controls, gallery.
- `docs/HOW-TO-KEEP-BUILDING.md` — non-coder's guide to tweaking/extending +
  the free-hosting deploy steps.
- `CLAUDE.md` — short agent-oriented project guide (overlaps this; keep both current).

---

## Update protocol (do this every major change)

1. Implement the change + its tests; get `npm test` AND `node test/live-browser.mjs`
   green and `npm run build` clean. Commit.
2. Update this file:
   - bump **Last updated** (newest commit hash + subject) and **Status**;
   - if you changed the snapshot, update §3's field list;
   - if you added a system, add a §4 row + any new §5 invariant/gotcha;
   - move anything you finished out of §7.
3. Keep `README.md`, `docs/HOW-TO-KEEP-BUILDING.md`, and `CLAUDE.md` in sync.
4. Commit the doc updates (can be the same feature commit).
