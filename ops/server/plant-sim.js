/**
 * Sorting-plant feed: runs the real headless delta-robot simulation (src/core) for each plant and converts its item counts to
 * kilograms per material. Numbers are therefore produced by the same model as the 3D demo, not made up for the dashboard.
 */
import { Plant, DT } from '../../src/core/index.js';
import { getScene } from '../../src/scenes/index.js';
import { CONFIG, ITEM_KG, DESTINATIONS } from './config.js';

export class PlantSim {
  constructor(sites, { seed = 1 } = {}) {
    this.plants = sites.filter(s => s.kind === 'sorting').map(site => ({ site, plant: Plant.fromScene(getScene(site.scene), { seed: seed + site.id.charCodeAt(1) }) }));
  }
  tick(dtReal) {
    const steps = Math.round(dtReal * CONFIG.plantX / DT);
    for (const { plant } of this.plants) for (let i = 0; i < steps; i++) plant.step();
  }
  /** Per plant: kg per material, residue, outbound by destination, rates. Purity is 100% by construction (types are given). */
  summary() {
    return this.plants.map(({ site, plant }) => {
      const s = plant.summary(), kg = {};
      let spawnedKg = 0;
      for (const l of s.lines) for (const [m, n] of Object.entries(l.bins)) kg[m] = (kg[m] ?? 0) + n * ITEM_KG[m];
      const sortedKg = Object.values(kg).reduce((a, b) => a + b, 0);
      const items = s.totals.spawned, picked = s.totals.picked;
      // everything not picked (misses and the residue class itself) ends in the residue stream
      const residueKg = Math.max(0, items - picked) * ITEM_KG.RESIDUE;
      spawnedKg = sortedKg + residueKg;
      const simHours = Math.max(plant.t / 3600, 1e-9);
      const outbound = {};
      for (const [m, v] of Object.entries({ ...kg, RESIDUE: residueKg })) { const d = DESTINATIONS[m]; const o = (outbound[d.en] ??= { destination: d, kg: 0 }); o.kg += v; }
      return {
        id: site.id, name: site.name, simMinutes: plant.t / 60, itemsPerMin: s.totals.itemsPerMin, items, picked,
        materials: Object.fromEntries(Object.entries(kg).map(([m, v]) => [m, +v.toFixed(2)])), sortedKg: +sortedKg.toFixed(2), residueKg: +residueKg.toFixed(2),
        inputKg: +spawnedKg.toFixed(2), kgPerHour: sortedKg / simHours, recovery: spawnedKg ? sortedKg / spawnedKg : null, purity: 1,
        outbound: Object.values(outbound).map(o => ({ destination: o.destination, kg: +o.kg.toFixed(2) })),
      };
    });
  }
}
