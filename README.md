# RecycleIQ Delta Sort — simulation

Browser simulation of conveyor lines with delta robots sorting known recyclables into bins. Simulated only: item types are given (no vision), timings are indicative.

```bash
npm install                          # puppeteer-core (video) + three (vendored copy lives in vendor/)
python3 -m http.server 8000          # then open http://localhost:8000/?scene=twin-lines
npm test                             # node --test tests/
node tools/capture-video/capture.js --list
npm run video -- --scene twin-lines  # MP4 of a scene's scripted demo (see .claude/skills/render-demo-video)
```

## Layout (one folder per concept)

| Path | Concept | Depends on |
|---|---|---|
| `src/core/` | Headless simulation: `rng`, `motion` (trapezoid), `kinematics` (delta IK/pose), `materials`, `line-config`, `planner` (intercept + cycle), `scheduler` (EDF), `line` (one belt line), `plant` (many lines, controls, export/replay). **Bin logistics:** `bin-slot` (bins, reservations, auto-switch), `navigation` (aisle graph), `containers`, `logistics-config`, `service-planner` + `dispatcher` + `fleet` (mobile robots). No DOM. | nothing |
| `src/scenes/` | Scenes are **data**: lines, robots, bins, mixes, demo timeline. `layout.js` has helpers, `index.js` the registry. | `core` (via `Plant`) |
| `src/view/three/` | 3D: `stage` (renderer/camera/lights), `belt`, `robot`, `items` per line; `bins`, `logistics` (aisles, containers, mobile robots) per plant; composed by `index.js`. | `core` |
| `src/view/canvas2d/` | 2D top-down view and the Gantt strip. | `core` |
| `src/ui/` | Page wiring: `app` (loop, lifecycle), `plant-controls`, `stats-panel`, `decision-log`, `demo`, `i18n`, `capture-api`. | all of the above |
| `tools/capture-video/` | Frame-exact MP4 renderer + `verify.sh`. | `scenes`, page via `window.__riq` |
| `tests/` | One test file per module, plus every scene validated. | |

Rule of thumb: dependencies point down the table. `core` never imports views or UI; views never import UI.

## Bin logistics (mobile robots)

Optional per scene. A bin with `capacity` (and `standby: true`) fills; when full, the slot's **carousel** (two bays side by side, rotated half a turn so the bins never cross) swaps in the standby bin, and a mobile robot (AMR) collects the full one: it stops **in the aisle** in front of the bay (it never drives into the bin area), the bin slides across onto it, it hauls it to a big container (1 s to empty), and slides it back as the next standby. A full active bin leaves only when its neighbour bay is empty, so nothing is pulled through another bin. Scenes without `capacity`/`logistics` behave as before.

**Availability rule (enforced in `bin-slot.js`, `planner.js`, `line.js`, tested):** an item is only planned for a bin that is physically present at the active spot, not full, not switching and not claimed; each pick *reserves* room in that bin, a bin with reservations is never removed or switched, and a deposit into a missing bin is refused and counted as a `violation` (must stay 0). Items whose bin is unavailable ride on and become "bin unavailable" misses. Slot states: `open`, `closing`, `switching`, `gap`.

**Mobile-robot traffic (`fleet.js`):** aisles are one-way loops (`aisleGraph()` with lane directions and cross-links), idle robots park on sidings off the lane, a robot never moves closer than `minGap` (0.75 m) to another (it waits; if two block each other the higher id backs up along its own path), and junctions are single-occupancy zones so merging traffic queues. Tests check minimum distance, no deadlock under a worst-case burst (every bin full at once), and that robots stay clear of resting bins.

Flexibility points: dispatch policy (`dispatcher.js`), service steps (`service-planner.js`), aisle graph, sidings and containers (scene data), number of mobile robots (`logistics.amrs`), transfer/empty times and gaps (`logistics-config.js`), truck swap of full containers (`tTruck`).

## Add a scene

1. Copy `src/scenes/single-line.js`, change `id`, `name`, `lines` (any number; give each a unique `id` and an `origin` so lines sit side by side) and `demo`.
2. Describe robots with `evenXs(n, first, spacing)` and bins with `binRows(classes, slotXs, rowY, { capacity, standby, side })` (`side` picks the active bay so every robot has a bin in reach; clearance to gantry posts is validated). For mobile robots add a `logistics` block: `aisleGraph({ lanes, xs: bayXs(bins), links, homes })` (stops in front of every bay, one-way loops, sidings) and `containers`.
3. Register it in `src/scenes/index.js`.
4. `npm test` validates reachability, conservation and that every robot works; then `npm run video -- --scene <id> --duration 20 --speed 4 --fps 10` for a preview.

## Add a material class
Add it to `src/core/materials.js` (colour + EN/EL label) and, for a distinct 3D shape, to `SHAPES` in `src/view/three/items.js` (falls back to a generic shape).
