# Pixel Galaxy — Architecture & Rules

Paste this file into a new chat for working context. It is the short
version: the full history lives in `CHANGES.md` (local only, ~465 KB)
and the playtest notes `PLAYTEST-3.9.29.md` / `PLAYTEST-3.9.57.md`.

## What the game is

Pixel Galaxy is a retro pixel space empire builder: plain HTML/CSS/JS,
no build step, no framework. Two modes share one game:

- **Single player** — 32-system galaxy, local save in
  `localStorage` key `pixelgalaxy-v3`. Victory: hold 13 systems or
  conquer the Dark Nexus.
- **Online** — one shared galaxy ("test-1", the Beta): 1,000 systems in
  16 rings, server-side state, guest accounts, Syndicates (alliances),
  daily challenges, global + Syndicate chat, PvP raids.

**Unification rule (Jayden, Nov 17): online and single player are the
SAME game — a change to one is made across the board.** Online reuses
the single-player UI and engine; only the galaxy (giant, shared,
server-side) and the save location differ. Intentional exceptions are
online-only by nature: naming/Home World labels, chat, bottom sheets,
panel minimize.

## Repo layout

### Client — `~/workspace/pixel-galaxy-ui-overhaul/` (this folder)

The 11 files that ship (GitHub + Cloudflare Pages):

| File | What it owns |
|---|---|
| `index.html` | Shell, version pins (`?v=N`, exactly 5×), footers |
| `style.css` | All styling, both modes |
| `data.js` | Single-player data: systems, techs, commanders, costs |
| `game.js` | Single-player engine + UI |
| `art.js` | Pixel sprites / canvas art |
| `online.js` | Online mode client (API calls, panels, sheets, chat) |
| `NOTES.md` | Design notes |
| `manifest.json`, `apple-touch-icon.png`, `icon-512.png` | PWA bits |
| `ARCHITECTURE.md` | This file |
| `CHANGES.md` | Full version history (local only, never shipped) |

### Backend — `~/workspace/pixel-galaxy-online/`

Cloudflare Worker + one Durable Object (see below). `wrangler.toml`
binds `GALAXY` to class `Galaxy`.

| File | What it owns |
|---|---|
| `src/index.js` | Worker entry: routing, galaxy whitelist, beta gate |
| `src/galaxy.js` | The Durable Object: empire, systems, raids, transits, revolts, settling, indexes |
| `src/galaxy-gen.js` | Galaxy generation: rings, power curve, names, factions, spawn points |
| `src/station.js` | Buildings, costs, production, storage caps |
| `src/fleet.js` | Ships, fleet power, upkeep, garrisons |
| `src/progress.js` | Techs, commanders, research |
| `src/empire.js` | Empire math: income, upkeep, colonies, rebellion |
| `src/quests.js` | The 18 online quests |
| `src/daily.js` | Daily challenge pool + hashing |
| `src/syndicate.js` | Syndicates + weekly challenges |
| `src/chat.js` | Global + Syndicate chat, 5s cooldown |

Tests: `test-progress-unit.mjs` (pure functions + DO route flows over
`Galaxy.fetch` + Worker route flows over the Worker `fetch` with a
stubbed `GALAXY` binding). Harness: `~/workspace/pixel-galaxy-v3.2-work/pg-verify-v32.js`
(static string checks over the real files, 1150+ checks).

## Online model

- **Backend:** Cloudflare Durable Objects, free tier. One object holds
  the whole galaxy (SQLite-backed). Worker:
  `https://pixel-galaxy-online.jaydenburnham.workers.dev`
  (routes under `/g/test-1/`). Client:
  `https://pixel-galaxy-852.pages.dev/` (canonical) and
  `https://jaydenstockalerts-cmyk.github.io/pixel-galaxy/` (legacy).
- **Auth — guest first (Jayden's pick):** opening the game mints a
  guest account (`POST /auth/guest` → playerId, token, recovery code).
  The token lives in `localStorage`; the server stores only its
  SHA-256 hash. Claiming later with Google/email is planned, not built.
- **Recovery codes:** a 12-char code returned ONCE at guest creation
  (only its hash is stored). `POST /auth/recover` verifies the code and
  issues a FRESH token — **recovery ROTATES the token**, signing out any
  other device holding the old one. Never recover Jayden's empire from
  a test window.
- **Galaxy:** 1,000 systems, 16 rings. Ring 0 is the Dark Nexus
  (power 5000); ring 15 is the spawn rim (power ~5). 2,378 links.
  Players start with exactly ONE system (their Home World).
  **Soft cap: 25 systems/player.** Spawn points: exactly 100 on ring 15
  (plus 24 added in v3.9.57); existing Home Worlds never move.
- **Combat:** battle to take every system beyond the Home World.
  Attack power = fleet power × counter bonus (×1.5) × command/tech
  multipliers × a hidden ±15% roll (tie wins). Home Worlds cannot be
  taken but CAN be raided for 10% of credits (cap 500); 90s warning,
  tribute option.
- **Factions** never expand beyond their original territory; conquered
  faction systems can revolt back (revolt pass every 4h).
- **Dark Matter** is earned in-game only, NEVER purchasable.
  Monetization: no route picked (cosmetics best fit, tip jar easiest).
- **No delete-empire endpoint exists.** Never delete anyone's empire;
  there is no cleanup build (Jayden, Nov 19).

## Beta gate

While the game is in closed beta, online mode is gated by a shared
access password (known only to Jayden and Muse). Enforcement lives
**server-side** (v3.9.66): `POST /auth/guest` and `POST /auth/recover`
require the password in the request body; the Worker compares its
SHA-256 to the `BETA_PASSWORD_HASH` Wrangler secret and returns 403
otherwise. The client keeps the password in a session-only variable
(never `localStorage`) and re-prompts on a 403. `/auth/beta` is the
prompt's immediate pre-check. The hash is NOT in any file. The whole
gate is one block in `src/index.js` — remove it in one place when the
game opens up. Single player is never gated.

**Galaxy whitelist:** `src/index.js` accepts only `test-1` as a galaxy
id (`ALLOWED_GALAXIES`). Any other id used to generate a whole new
1,000-system galaxy. `staging-1`'s DO data still exists and can be
re-added to the list if it ever comes back.

## Economy (the numbers that matter)

- Resources: energy, metal, crystal, credits. Fresh empire:
  energy 40 / metal 60 / crystal 30 / credits 10 (crystal was 10
  before v3.9.64).
- Buildings (base cost / production per level): solar (20M / +7.9
  energy/min), foundry (20E / +6.2 metal/min), mine (50M+20E / +4.5
  crystal/min), hub (60M+40Cr / +3.9 credits/min), hangar (80M+60Cr),
  command (120M+80Cr+40C). Upgrade = base × 1.4^level; new copy =
  base × 1.5^existing. Storage cap = 50 + 500 × Command level.
- Ships: Fighter (pw 1, 1 slot, 20E+10C, 9s), Cruiser (pw 3, 2 slots,
  50M+20Cr+20C, 24s), Capital (pw 8, 4 slots, 160M+100Cr+80C, 60s).
  Counter triangle ×1.5: swarm→Fighter, armored→Cruiser,
  fortress→Capital. Launched-ship upkeep: 0.025 energy/s per slot.
- Loot on conquest: 100 + 25 × floor(sqrt(power)) credits (rim ≈ 150).
- Colonies: conquered non-Home systems become Lv1 colonies earning
  1.1/min per level (Lv5 5.6/min), +15 defence/level, focus changeable.
- Research: 18 techs (weapons w1–w5, economy, hull, slots, command,
  builder, jump drive). Commanders: 6, one assigned at a time.

## Quota — the thing that took the game down twice

Cloudflare Durable Objects free tier: **5,000,000 rows read/day** and
**100,000 rows written/day**, resetting 00:00 UTC (6:00 PM CST).
Accounting can lag ~37 min past the reset.

- Nov 19 morning: writes limit hit — the 15s poll re-saved state
  (~20 rows/cycle/client). Fixed in v3.9.41 (persist only real changes).
- Nov 19 evening: reads limit hit — the poll read ~6,200 rows/cycle
  (unindexed full-table scans). Fixed in v3.9.63 (7 indexes) and
  v3.9.65 (one merged `GET /poll` per 15s instead of 8 requests;
  quests + Syndicate every 60s; daily while the Quests tab is open).
  Per-poll now ≈ 150 rows. **Never poll `/systems`** (1,511 rows);
  it refetches only when the galaxy version changes.
- **Close browser windows when done** — every open game tab polls
  every 15s and burns quota. Do not spawn new test-1 guests casually;
  reuse test empires, use throwaway galaxies only via the backend.

## Deploy workflow

Per version, in order:

1. Count-asserted replaces → `node --check` on changed JS →
   `?v=` appears exactly 5× in `index.html` → harness 0 failures →
   backend unit tests pass.
2. Push the client: `python3 ~/workspace/custom-connectors/custom.github/bin/push_pixel_galaxy.py "<msg>"`
   (uploads the 11 game files to `jaydenstockalerts-cmyk/pixel-galaxy`).
   The push uploads ALL local changes — staged code for a held version
   WILL leak live on the next push.
3. Deploy the backend if it changed:
   `python3 ~/workspace/custom-connectors/custom.cloudflare/bin/deploy_backend.py ab8a14c07e5332eeb850e23dd568ee51`
   (from `~/workspace/pixel-galaxy-online/`).
4. Deploy the client to Pages: stage exactly the 11 game files in
   `/tmp/pg-pages-stage` (never `CHANGES.md` / `PLAYTEST` notes) and
   run `python3 ~/workspace/custom-connectors/custom.cloudflare/bin/deploy_pages.py pixel-galaxy <staged-dir>`.
5. Curl-verify BOTH live URLs (Pages `/index.html` 308-redirects to
   `/`, follow it). Then a live browser check (one tab only).
6. `CHANGES.md` entry with `Pages serves ?v=N (5x) / Pixel Galaxy
   vX.Y.Z` and `Deployed: Worker <id>` lines.

**Stale-DO rule: a `wrangler deploy` does NOT restart a running
Durable Object** — the old instance keeps serving the OLD Worker code
until Cloudflare evicts it (idle eviction). Open game tabs poll every
15s and keep the instance alive. After EVERY backend deploy, curl the
newest endpoint ON test-1 with a fresh guest before claiming the
deploy is live; a throwaway galaxy only proves the new code exists.
If test-1 404s a new endpoint, close every open game window/tab, wait
for eviction (minutes), re-probe once, then live-check.

**No client route to a throwaway galaxy:** `onGalaxy()` in
`online.js` only accepts `test-1` and falls back to it for any other
stored value. No URL parameter, no picker. Browser playthroughs MUST
use test-1 unless the code is changed.

## Standing decisions (do not re-litigate without Jayden)

- Report game detail, not work-process narration (Jayden, Nov 18).
- Per-feature explicit picks only; never bundle an unpicked change
  into a build claimed complete.
- The game is meant to be LONG (a world played for a year), with
  frequent individual + alliance challenges. The Nexus is beatable
  only at total max-out — that is the point.
- Repo goes private Thu Nov 26, 2026 (grace period for the
  github.io → pages.dev migration popup, v3.9.55). Cron
  `pixel-galaxy-repo-privatize-nov26` handles the flip.
- The hidden ±15% battle factor stays unstated.
- **Profanity is blocked everywhere (v3.9.67, Jayden Nov 20):** no profanity in any shape in chat (Global + Syndicate) or in any name (Syndicate, Home World at spawn + rename). Enforced server-side in `src/profanity.js` — reject, never mask. The client only pre-checks for instant feedback.
- Emoney outage / reselling work lives in the main chat, not here.
