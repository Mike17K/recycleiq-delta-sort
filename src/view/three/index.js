/** 3D view of a Plant: stage + per-line parts (belt, robots, items) + plant-level parts (bins, logistics). */
import { THREE } from './three-utils.js';
import { createStage } from './stage.js';
import { buildBelt } from './belt.js';
import { buildBins } from './bins.js';
import { buildLogistics } from './logistics.js';
import { buildRobot } from './robot.js';
import { createItemsView } from './items.js';
import { buildFactory } from './factory.js';

export function createView3D(canvas, { fast = false, nameOf } = {}) {
  const stage = createStage(canvas, { fast });
  let built = null;           // { plant, root, lines: [{ line, belt, robots, items }], bins, logistics }
  let names = nameOf;

  function build(plant) {
    if (built) stage.scene.remove(built.root);
    const root = new THREE.Group();                                   // everything in plant (world) coordinates
    stage.scene.add(root);
    const lines = plant.lines.map(line => {
      const { cfg } = line, group = new THREE.Group();
      group.position.set(cfg.origin.x, 0, -cfg.origin.y);              // lines sit side by side in the plant
      root.add(group);
      return {
        line,
        belt: buildBelt(group, cfg),
        robots: line.robots.map(r => buildRobot(group, cfg, r)),
        items: createItemsView(group),
      };
    });
    const bounds = plant.bounds();
    built = { plant, root, lines, bins: buildBins(root, plant, names), logistics: buildLogistics(root, plant), factory: buildFactory(root, bounds) };
    stage.floor.visible = stage.grid.visible = false;                  // the factory brings its own floor
    stage.frameBounds(bounds);
  }

  /** @param t optional sim time: when given the camera follows the deterministic cinematic orbit (video capture). */
  function render(plant, t) {
    if (!built || built.plant !== plant) build(plant);
    for (const p of built.lines) {
      p.belt.update(p.line);
      p.robots.forEach(r => r.update(p.line, plant.t));
      p.items.update(p.line, plant.t, p.robots);
    }
    built.bins.update(plant, plant.t);
    built.logistics.update(plant, plant.t);
    built.factory.update(plant.t, stage.camera);
    stage.render(t);
  }
  function setNames(fn) { names = fn; built?.bins.setNames(fn); }

  return { render, setNames, resize: stage.resize, setPreset: stage.setPreset, stage };
}
