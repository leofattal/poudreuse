# Poudreuse ❄

A snowboarding French-conjugation game — conjugate verbs fast, land tricks, chain combos, unlock slopes. Built by Leo for Leila.

Pure static site: HTML + CSS + vanilla JS, no build step, no dependencies.

## Project structure

```
.
├── index.html          # markup (screens + HUD) and script/style includes
├── css/
│   └── styles.css      # all styles
├── js/
│   ├── data.js         # save storage, player state, verb engine, mountains, boards
│   ├── audio.js        # procedural Web Audio sound effects (Sfx)
│   ├── ui.js           # menu/shop/settings UI, accent strip, answer checking
│   ├── world.js        # canvas world: rider, scenery, particles (World)
│   ├── missions.js     # toast, daily streak, daily missions, count-up helper
│   └── game.js         # game loop, scoring, results, boot
├── vercel.json         # static hosting config (clean URLs + asset caching)
└── .gitignore
```

Scripts load in dependency order (`data → audio → ui → world → missions → game`)
as classic scripts sharing one global scope, so inline `onclick` handlers
(`UI.show`, `Game.start`, …) keep working.

## Run locally

Any static file server works. For example:

```bash
python3 -m http.server 3000
# then open http://localhost:3000
```

## Deploy to Vercel

```bash
vercel login      # one-time, opens the browser
vercel            # preview deploy
vercel --prod     # production deploy
```

No framework preset needed — Vercel serves the files as-is.
