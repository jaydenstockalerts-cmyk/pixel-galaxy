# Pixel Galaxy: project notes

Paste this file (plus only the files being changed) at the start of a new chat.

## What it is
A retro pixel space empire builder. Build a station, produce ships, conquer a star map. Inspired by The Hobbit: Kingdoms of Middle-earth, History Great Empires: Rome (DS), and sports manager modes. Plain HTML/CSS/JS, no libraries, no build step. Free to host on GitHub Pages or itch.io.

## File map
- `index.html`: page skeleton, loads the files below
- `style.css`: layout and theme (4-color palette tokens, light and dark)
- `data.js`: game data only (resources `R`, buildings `B`, ships `U`, weaknesses `WEAK`, star systems `SYS`)
- `game.js`: state, save/load, production, UI updates, map drawing, attacks, game loop

## Current features (v0.2)
- 4 resources: energy, metal, crystal, credits. Storage cap grows with Command Station level.
- 6 buildings with levels; level cap = Command Station level x 2 + 1 (Command Station max 5).
- 3 ship types (Fighter, Cruiser, Capital) limited by Hangar slots; Cruiser needs Hangar Lv2, Capital needs Lv4.
- Star map of 8 systems. Attack only systems adjacent to owned ones. Enemy types are weak to one ship type (x1.5 power).
- Attack uses whole fleet. Win: lose 30% of ships, gain loot, system pays credits. Lose: keep 40% of ships.
- Autosave to localStorage (key `pixelgalaxy-v2`), offline earnings up to 8 hours.
- Ships burn energy; at 0 energy, ships desert.

## Roadmap
1. v0.3 Living Station: visible building grid, build/train timers and queues, quests
2. v0.4 Commanders (named, leveling) and research tree
3. v0.5 Rival factions that expand, raid, and race for systems
4. v0.6 Real battle screen with formations and commander abilities
5. v0.7 Pixel art, chiptune sound, random events, story campaign
6. Later: wrap as Windows .exe (Electron or Tauri), iPhone home-screen version

## Rules for working on this
- Keep game data in `data.js`, logic in `game.js`.
- Ask for targeted edits to specific functions, not full rewrites.
- If the save format changes, bump the localStorage key.
- Keep the retro 4-color look (CSS variables --bg, --hi, --mid, --fg).
