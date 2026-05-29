# PixelClash

A pixel-art mobile MOBA arena battler, built with **Phaser 3** (game engine)
and **Vite** (dev server). Browser-first; mobile packaging comes later.

## Running it on your Mac

You only do the first two steps once. After that, you just run `npm run dev`.

```bash
# 1. Get the code (first time only)
git clone https://github.com/4305labs/pixelclash.git
cd pixelclash
git checkout claude/pixel-moba-game-WobPa

# 2. Install the libraries the project needs (first time, and whenever they change)
npm install

# 3. Start the game (do this every time you want to play/test)
npm run dev
```

Then open the URL it prints (usually **http://localhost:5173**) in Chrome.

To stop the server, click in the Terminal and press `Ctrl + C`.

### Getting the latest changes later

```bash
git pull origin claude/pixel-moba-game-WobPa
npm install   # only needed if dependencies changed
npm run dev
```

## Project layout

- `index.html` — the web page that hosts the game.
- `src/main.js` — boots the Phaser engine and lists the scenes.
- `src/scenes/` — each "scene" is one screen of the game.
