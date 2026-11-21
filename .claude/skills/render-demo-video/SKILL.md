---
name: render-demo-video
description: Render a RecycleIQ Delta Sort scene (single-line or twin-lines, 3D or 2D, scripted demo with captions, Gantt and live stats) to an MP4 using the reusable frame-exact capture tool, and verify it. Use when asked to make, re-render, update or share a demo video/capture/recording of any scene, or to change its scene, seed, language, length, speed, resolution or view; also when adding a new scene that needs a video.
---

# Render a scene video

Tool: `tools/capture-video/capture.js`. It serves the repo on localhost, opens `index.html?capture&scene=<id>&view=<3d|2d>` in headless Chrome, advances the simulation one video frame at a time through `window.__riq`, screenshots each frame and pipes it to ffmpeg. Same scene + seed + options give the same video, independent of machine speed. Everything is a flag; nothing is hard-coded to one scene.

## Prerequisites (check, don't assume)
- `ffmpeg` and Chrome/Chromium on PATH (or `--chrome PATH` / `CHROME_PATH`); `npm install` in the repo root.
- `npm test` passes (it also validates every scene). A video of a broken sim wastes the render time.

## Run
```bash
node tools/capture-video/capture.js --list                 # scenes: id, lines, robots, demo length
node tools/capture-video/capture.js --scene twin-lines     # full demo, defaults from the scene
npm run video -- --scene single-line --seed 7 --lang el --view 2d
```
| flag | default | meaning |
|---|---|---|
| `--scene` | `single-line` | scene id from `src/scenes/index.js` |
| `--out` | `videos/<scene>-demo.mp4` | output path |
| `--view` | `3d` | `3d` (Three.js, drifting camera) or `2d` |
| `--seed` | scene seed | drives every line (each line gets a derived seed) |
| `--lang` | `en` | `en` or `el` |
| `--duration` | scene demo length (90) | sim seconds to render |
| `--speed` | `1.5` | sim seconds per video second (90 s demo -> 60 s clip) |
| `--fps` | `24` | frame rate |
| `--width/--height` | scene `video` size, else 1280x720 | viewport = video size; twin-lines uses 1600x900 for its 12 Gantt lanes |
| `--crf` | `18` | x264 quality |

## Time budget (software rendering here, no GPU; see "Measured" below)
`frames = duration * fps / speed`; cost per frame grows with pixels and robot count. Run full renders with `run_in_background` and wait for the completion notice; don't poll. For a preview use `--duration 20 --speed 4 --fps 10`.

## After rendering (always verify)
```bash
tools/capture-video/verify.sh videos/twin-lines-demo.mp4
```
Prints duration/size/fps and extracts three frames next to the video. Look at them: caption present, view not cropped (the tool warns "page is Npx taller than the viewport"), robots moving, Gantt filling, no page errors in the render log. Report the real duration and size, and delete the extracted PNGs if the user doesn't want them.

## New scene checklist
1. Add it under `src/scenes/` (copy `single-line.js`) and register it in `src/scenes/index.js` (see README "Add a scene").
2. `npm test`. 3. Preview with the short command above and look at a frame. 4. Set `video: { width, height }` on the scene if the default 1280x720 crops the Gantt or squeezes the 3D view. 5. Full render + verify.

## What the demos show
Both scenes include bin logistics: a bin is force-filled, its carousel swaps in the standby bin, and mobile robots (3 in single-line, 5 in twin-lines) slide the full bin aboard from the aisle, haul it to a container and bring it back. The video exercises the whole stack (traffic control included), so a render is also a smoke test of the logistics code.

## Contract with the page (keep stable)
`src/ui/capture-api.js` exposes `window.__riq`: `ready`, `scene`, `t`, `ended`, `duration`, `setLang(l)`, `startDemo(seed)`, `advance(seconds)`. Capture mode (`?capture`) uses a fixed 16:9 layout and renders only inside `advance()`. If you rename anything there, update `tools/capture-video/capture.js` and this file together.

## Known pitfalls
- Headless Chrome uses SwiftShader (software WebGL); the tool passes the needed flags. Never add a free-running `requestAnimationFrame` render in capture mode: it doubles the cost.
- `pkill -f capture.js` from a Bash tool call can kill your own shell; use `ps` and `kill <pid>`.
- Web renderer only (Three.js). Blender was tried and dropped: slower per frame and it looked worse.
