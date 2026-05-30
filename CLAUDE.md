# CLAUDE.md — working on PixelClash

A pixel-art, browser-first **MOBA arena battler** (Phaser 3 + Vite client, a
Node + `ws` **server-authoritative** game server). Heroes move/attack/ability/
dash; lane minions and guard towers push the lane; destroy the enemy base — which
is shielded until its tower falls — to win. Supports 1v1 up to 3v3, AI bots for
solo play, hero classes, map pickups, a scoreboard/clock/kill-feed HUD, and a
match timer with tiebreak.

## Commands
- `npm run server` — start the authoritative game server (ws, port 2567; honors `PORT`).
- `npm run dev` — Vite dev server for the web client.
- `npm run build` — production build to `dist/`.
- `npm test` — the whole headless suite (`test/run-all.mjs`, builds the bundle once).
- `node test/live-browser.mjs` — full-stack check: a real ws server + two real
  headless Chromium tabs playing over sockets. Run this after gameplay changes.
- `node test/screenshot*.mjs` — regenerate the `docs/*.png` images.

## Architecture (read these first)
- **`src/net/GameServer.js`** — the authoritative brain. Owns ALL real state
  (players incl. bots, minions, towers, bases, pickups, projectiles, score,
  kill feed, match phase/clock) and the fixed-tick `step(dt)` loop. Knows nothing
  about sockets or Phaser; it talks to "connections" (`.send/.onMessage/.onClose`).
- **`src/sim.js`** — the SINGLE source of movement math (`stepPosition`,
  `resolveMove`, wall collision, `pointInWall`). Shared by the server AND the
  client's prediction so they agree. Movement speed is the same for everyone
  (classes differ in HP/attacks, not speed) — keep it that way unless you also
  update prediction.
- **`src/net/NetClient.js`** — browser side: sends input/attack/dash/class,
  stores the latest snapshot. Phaser-free and unit-testable in Node.
- **`src/scenes/ArenaScene.js`** — the only scene: input, the HUD, and `sync*()`
  methods that reconcile sprites to each snapshot. The local hero is predicted
  (`predictLocal`); everyone else interpolates.
- **`src/entities/`** — display objects: `Player`, `Minion`, `Tower`, `Base`.
- **`src/config.js`** — ALL tunable numbers and layout (one place to balance).
- **`src/textures.js`** — sprites drawn in code (no asset files).
- Transports: `WebSocketConnection.js` (real) and `LocalConnection.js` (in-memory,
  used by tests). `defaultServerUrl()` auto-picks `ws://`/`wss://` (see deploy).

### The snapshot is the contract
The server's `snapshot()` is the only thing the client sees. When you add state,
add it to `snapshot()` AND read it in `NetClient._receive` AND render it in a
`sync*`/`update*` method. Current fields: `phase, winner, score, killFeed,
needed, countdown, timeLeft, players[] (id,team,x,y,hp,maxHp,alive,cls,bot,
respawnIn,powered), projectiles[], minions[], pickups[], towers[], bases[]
(+shielded)`.

## Conventions
- **Server stays authoritative.** Clients only render + predict the LOCAL player.
- **Tune in `config.js`**, not scattered literals.
- **One feature = one commit**, message ending with the session link. Commit only
  when `npm test` (all groups) AND `node test/live-browser.mjs` are green.
- **Commit messages: avoid backticks** — they get shell-substituted. Use
  `git commit -F -` with a heredoc.
- **Tests:** each feature ships a `test/mNN.<name>.mjs` (server, pure Node) and
  often a `.render.mjs` (headless via `openGame` + injected snapshots), wired into
  `test/run-all.mjs`. Keep beginner-readable comments; define jargon once.
- Headless tests run with no audio/localStorage device — keep new browser APIs
  guarded (see `audio.js`/`record.js` `safeStorage`).

### Gotchas worth knowing
- Several systems are **armed only by `beginPlaying()`** (minion `nextWaveAt`,
  `matchEndsAt`) and disarmed to `Infinity` otherwise, so tests that set
  `phase = "playing"` directly don't trip them.
- Towers sit on the center row, so a few server tests `server.towers.clear()` to
  isolate a clean lane shot.
- **Bots are opt-in** (`new GameServer({ bots: true })`, on in `server.js`, off
  by default) so they never affect existing tests. Team assignment balances by
  *human* count; a human replaces a bot's slot.

## Branch / PR
Develop on `claude/pixel-moba-game-WobPa`. PR #1 targets `main`. Don't push to
other branches without explicit permission.

## Player-facing docs
`README.md` (how to play) and `docs/HOW-TO-KEEP-BUILDING.md` (a non-coder's guide
to tweaking/extending, incl. the free-hosting deploy steps) — keep them updated
when behavior changes.
