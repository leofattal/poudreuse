# CLAUDE.md

Guidance for working in this repo.

## What this is

**Poudreuse** — a French conjugation snowboarding game for kids (built by Leo for Leila). Conjugate verbs fast, land tricks, chain combos, climb the leaderboard. Pure **static site**: HTML + CSS + vanilla JS, **no build step, no framework, no bundler, no npm dependencies**. Deployed on Vercel at https://poudreuse.vercel.app, auto-deploying on every push to GitHub `main`.

## Structure

```
index.html          markup (screens + HUD) + <script>/<link> includes
css/styles.css      all styles; design tokens are CSS vars in :root
js/
  data.js       save storage (Store), player state P, persist(), mergeCloudSave,
                verb engine (conjugate), MOUNTAINS (6 levels, ids 0-5), BOARDS
  audio.js      Sfx — procedural Web Audio sound effects
  ui.js         UI screens (menu/mountains/shop/settings/leaderboard), Settings,
                accent strip, answer normalization, escapeHTML
  world.js      World — canvas rendering (rider, scenery, particles, physics)
  missions.js   toast, Daily streak, Missions du jour, countUp
  game.js       Game loop, scoring, results, boot, + cloud-event glue
  cloud.js      Supabase bridge (ES module) — see below
vercel.json     cleanUrls + must-revalidate cache on /css /js
.env.example    documents the Google OAuth env (real values in .env.local, gitignored)
```

## Critical conventions — read before editing JS

- **Classic scripts share one global scope.** `js/data.js`…`js/game.js` are plain
  `<script>`s (NOT modules), loaded in dependency order: `data → audio → ui → world
  → missions → game`. They reference each other by bare globals (`P`, `UI`, `Game`,
  `Sfx`, `World`, `MOUNTAINS`…), and inline `onclick="UI.show(...)"` handlers in
  index.html depend on those being global. **Do not convert these to ES modules** or
  wrap them in a way that hides the globals — it breaks the inline handlers.
- **`cloud.js` is the one ES module** (`<script type="module">`, loaded last). ES
  modules canNOT see the classic scripts' `const P`/`UI`/`Game` (those are global
  *lexical* bindings, not `window` properties). So the module is a **pure data/auth
  layer** on `window.Cloud` and communicates only via DOM events:
  - Module → classic: dispatches `cloud-ready`, `cloud-auth`, `cloud-signin`,
    `cloud-save` (detail = cloud save row) on `window`.
  - Classic → module: calls `window.Cloud.*` (all guarded with `window.Cloud &&`
    since the module loads after the classic boot runs).
  - The event listeners that mutate `P`/`UI` live at the bottom of `game.js`
    ("cloud glue"). Put any new cross-boundary logic there, not in cloud.js.
- **Persistence goes through `persist()`** (data.js). It writes localStorage AND,
  when signed in, queues a debounced cloud push. Always call `persist()` after
  mutating `P` — don't write `Store`/localStorage directly.
- **Match the existing style**: terse vanilla JS, IIFE modules returning a small
  API object, French UI strings, emoji, the CSS-var design tokens.

## Run locally

```bash
python3 -m http.server 4321   # then open http://localhost:4321
```
No install step. To verify in a real browser, the Claude-in-Chrome tools work well
(check the console for errors, screenshot screens).

## Deploy

Just `git push origin main` — Vercel auto-deploys. `vercel --prod` also works
(CLI is logged in). Assets are served `must-revalidate` (filenames aren't
content-hashed, so a long immutable cache would strand returning visitors on stale
JS — keep it that way unless you add hashing).

## Backend (Supabase)

Project ref **`ikqwsxnczncfhsbmswaz`** (org: leofattal's Org). Three RLS-protected
tables: `scores` (per-mountain leaderboard, anonymous inserts allowed),
`profiles` (auto-created on Google login), `saves` (jsonb cloud save of `P`,
owner-only). Client uses the **publishable anon key** hard-coded in cloud.js —
that's safe; RLS is the security boundary.

- Prefer the **Supabase MCP** tools for schema/data (`apply_migration`,
  `execute_sql`, `get_advisors`). Run `get_advisors` after any DDL.
- **Auth-provider config is NOT in the MCP.** Google OAuth was enabled via the
  Management API: `PATCH https://api.supabase.com/v1/projects/<ref>/config/auth`
  with a token from the macOS keychain (`security find-generic-password -s
  "Supabase CLI" -w`).
- The Google OAuth **client secret** lives only in `.env.local` (gitignored, 600)
  and in Supabase server config — never in client code or the committed repo.
- Verify auth flows **from the database** (`execute_sql` on `auth.users`) rather
  than via browser automation — the Google Cloud console for this project is under
  a different Chrome profile the extension can't reach.

## Gotchas

- The leaderboard/cloud features degrade gracefully offline: everything is guarded
  with `window.Cloud &&`, and the game is fully playable logged-out (localStorage).
- User-supplied names in the leaderboard are rendered through `escapeHTML` — keep it.
- Supervised/child Google accounts are blocked by Google from OAuth; only adult
  accounts can sign in. The anonymous leaderboard is the always-works path for kids.
