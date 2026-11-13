# Pixel Galaxy: project notes

Paste this file (plus only the files being changed) at the start of a new chat.

## What it is
A retro pixel space empire builder. Build a station, produce ships, conquer a star map. Inspired by The Hobbit: Kingdoms of Middle-earth, History Great Empires: Rome (DS), and sports manager modes. Plain HTML/CSS/JS, no libraries, no build step. Free to host on GitHub Pages or itch.io.

## File map
- `index.html`: page skeleton, loads the files below
- `style.css`: layout and theme (4-color palette tokens, light and dark); bottom nav dock, resource pills, map controls, progress bars
- `data.js`: game data only (resources `R`, buildings `B`, ships `U`, weaknesses `WEAK`, star systems `SYS`) — UNCHANGED in v0.9
- `art.js`: pixel sprites and canvas drawing — `drawGalaxy(q, cam?)`, `drawBase(q)`, `SPR()`, `lay()`, `BBG()`, plus `planetSprite(i)` / `buildingSprite(t, l)` for the full pages (v0.9)
- `game.js`: state, save/load, production, UI updates, map drawing, attacks, game loop; camera `CAM` + page state `PAGE` are view-only (never saved)

## Current features (v0.7)
- 4 resources: energy, metal, crystal, credits. Storage cap grows with Command Station level.
- 6 buildings with levels; level cap = Command Station level x 2 + 1 (Command Station max 5).
- 3 ship types (Fighter, Cruiser, Capital) limited by Hangar slots; Cruiser needs Hangar Lv2, Capital needs Lv4.
- Star map of 8 systems. Attack only systems adjacent to owned ones. Enemy types are weak to one ship type (x1.5 power).
- Attack uses whole fleet. Win: lose 30% of ships, gain loot, system pays credits. Lose: keep 40% of ships.
- Autosave to localStorage (key `pixelgalaxy-v2`), offline earnings up to 8 hours.
- Ships burn energy; at 0 energy, ships desert.
- v0.3 additions: station grid (8x4 tiles) where buildings can be moved; each orthogonal neighbor adds +15% production (`mult()` in game.js).
- Build queue (2 jobs, time = 4s x 1.35^level) and shipyard queue (5 jobs; Fighter 3s, Cruiser 8s, Capital 20s). Jobs finish by timestamp, so they also complete while away.
- Quest list (`Q` in data.js): first 3 unclaimed shown, rewards claimed with a button.
- Scrap button on each ship type removes one ship and refunds 50% of its cost (frees hangar slots).
- v0.4 additions: 16-system galaxy (Dark Nexus is the new final boss), 12-tech research tree (one lab slot; `TECH` in data.js), 6 commanders (`CM`; one fleet slot, one station slot; they level from XP: +2 per victory for fleet, +1 per finished build/research for station). Commander types: fleet power, production, build speed.
- Storage cap is now 100 + 500 x Command Station level; Command max level is 5, 7 or 10 via research.
- v0.5 additions: two AI rivals (Crimson Pact, Vael Collective; `RV` in data.js, logic in `rivalTick()` in game.js). They start at far systems, claim an adjacent neutral system every 6 min (max 6 each), and raid player systems next to their territory every 5 min after 10 min of play. Rival strength grows with play time (`S.min`, capped at 6x) and territory. Raid beats home defense (`dpower()`) -> system lost and 25% of ships. Rival-held systems need 1.4x power to take. Event feed shows the last 3 messages. Rivals get no free turns while the tab is closed beyond 2 claims and 1 raid per rival per visit.
- v0.5.1: tab menus (Galaxy, Station, Fleet, Crew, Research, Quests). Pages are `<section data-pg="...">` in index.html; `showTab()` in game.js toggles them, and the current tab is saved in `S.tab`. Resource bar and tab bar are sticky at the top. Quests tab shows a count of claimable quests.
- v0.6: animated battle screen (`battle()` / `bframe()` in game.js). The outcome is rolled first as before; the animation only shows it (Skip button). Pixel planets on the star map with twinkling stars. Synth sound effects via WebAudio (`sfx()`, no audio files), Sound toggle button next to the title (tabs wrap onto two rows on narrow screens) (`S.mute`). Phone polish: `manifest.json`, `apple-touch-icon.png`, `icon-512.png`, standalone display, status-bar and safe-area handling. Add to Home Screen only works from the GitHub Pages link.
- v0.6.1: Galaxy map scaled to fit the screen (48vh) so the info panel stays visible; battle is a popup; messages are toasts (last 3, 5s) plus a Log popup (last 30); times show as 1m 50s; Fleet tab shows total power vs each enemy type and counter hints; ship queue = 5 + 2 x Hangar level, with x5/x10 build buttons; reset asks for confirmation in a popup; quests tab lists every claimable quest first; late-game research added (w4, w5, l3, c3: Command max 13, Hangar level cap 15).
- v0.7 interactive base map: buildings are individual objects `S.bl=[{u,t,x,y,l}]` placed on a 6x6 block map (32px sprites, canvas 192x192). Tap a building for stats, Upgrade, Move; use the Build list to Place new copies. Copy limits `MAXC()` depend on Command level (command 1, hangar up to 4, others up to 6); new copies cost 1.5x per existing copy; builder slots `bqcap()` = 2 + Command/2 and build in parallel. Derived totals `S.b` (sum of levels per type) and `S.bx` (max level) come from `recalc()` so older code still works. Old saves migrate automatically (one building per old type).
- Save key is now `pixelgalaxy-v3` (v0.2 saves do not carry over).
- v0.9 UI / graphics overhaul (UI ONLY — no mechanic, name, cost, power, or formula changed; see CHANGES.md): interactive galaxy map with camera `CAM={cx,cy,zoom}` (world 320x400, SYS x/y * 2.4, zoom 1-2.5, drag to pan, pinch / wheel / double-tap to zoom, tap-vs-drag threshold 8px, minimap `#mm`, Home / Fit / + / − controls, tap a planet opens a full System page); clickable menus as full pages — bottom nav dock (Galaxy, Station, Fleet, Crew, Research, Quests, Quests badge), full System page (planet hero via `planetSprite()`, power needed, fleet vs type, loot, Attack, Back), full Building page (building hero via `buildingSprite()`, stats, production, Upgrade, Move, Back), Empire page (owned systems, tap Go to to fly the camera there, Rivals). `S.tab` values are unchanged (map/station/fleet/crew/research/quests); pages live in view-only `PAGE` (tab/system/building/empire) and Back returns to the previous tab. Resource pills show name + amount + /s + storage cap; progress bars for build / research / shipyard. `data.js` is byte-identical to v0.8; `art.js` only gained the camera transform in `drawGalaxy` (no-arg call still draws the fit view) and the two sprite helpers.
- v0.9.1 detailed galaxy + homeland station (VISUAL ONLY — no mechanic, name, cost, power, or formula changed; see CHANGES.md): galaxy canvas 384x480, world 640x800 (SYS x/y * 5), planets ~2x larger with craters/bands/rings/atmosphere, name labels at zoom >= 1.5 and PWR labels at zoom >= 1.8 (hidden zoomed out), richer nebula + 120 twinkling stars, thicker owned routes, bigger flags/rival glyphs/selection brackets, map CSS 65vh, default camera zoom 1.8 centred on Home World (Fit still shows the whole galaxy). Station is now a 12x12-plot homeland (world 576x576, old 6x6 settled area top-left, open land around it) with its own view-only camera `STCAM` (drag/pinch/wheel/double-tap, 1-2.5x, 8px tap-vs-drag, Home/Fit/+/- controls, default zoom 1.8 on the buildings), richer ground (grass variation, dirt paths through the settled area, flower speckles, tree/rock/pond/crystal decor per empty plot), canvas 384x384 at 60vh. Tap a building opens the Building page; tap an open plot opens a Plot page listing every building type with name, description, cost (`newCost`, 1.5x per copy), copy count/limit (`MAXC`) and a Place button using the existing `placeB` logic. `S.bl` / save format unchanged — outer plots are just coordinates in the same `S.bl` array, same `pixelgalaxy-v3` key. `data.js` still byte-identical to v0.8.

## Roadmap
1. v0.3 Living Station: DONE
2. v0.4 Commanders, research tree, bigger galaxy: DONE
3. v0.5 Rival factions that expand, raid, and race for systems: DONE
4. v0.6 Battle screen, pixel planets, sound, phone polish: DONE (formations and commander abilities not yet)
5. v0.7 Pixel art, chiptune sound, random events, story campaign
6. Later: wrap as Windows .exe (Electron or Tauri), iPhone home-screen version

## Ideas to tune after playtesting
- Build times and costs, quest rewards, adjacency bonus size, ship timers

## Rules for working on this
- index.html loads files as `data.js?v=13` etc. Bump that number on every release so browsers never serve stale cached files from GitHub Pages.
- Keep game data in `data.js`, logic in `game.js`.
- Ask for targeted edits to specific functions, not full rewrites.
- If the save format changes, bump the localStorage key.
- Keep the retro 4-color look (CSS variables --bg, --hi, --mid, --fg).

## Ideas next
Building-specific bonuses, decorations/roads, defense buildings against raids, bigger base map via Command level, formations and commander abilities in battle.
