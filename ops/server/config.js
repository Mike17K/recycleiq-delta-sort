/** Demo configuration for RecycleIQ Ops. Everything here is simulated; see OPS_MVP_PLAN.md ("Ειλικρίνεια"). */
export const CONFIG = {
  port: Number(process.env.PORT) || 8780,
  tickMs: 1000,                 // server tick (also the GPS ping period of every truck)
  // Real time by default: trucks drive at road-class speeds (about 12-30 km/h). `scale` multiplies all clocks (the dashboard offers 1x/2x/5x/10x).
  fillPerScale: 1.5,            // bin filling speed-up at scale 1 (so a 15 kg litter bin fills in about 6 real hours)
  plantPerScale: 2,             // sorting-plant simulation speed at scale 1
  collectSeconds: 30,           // dwell per bin
  unloadSeconds: 120,           // dwell at a plant
  reportSnapMeters: 40,         // a citizen report within this distance of a known bin is attached to it
  rateLimit: { perMinute: 5 },  // public portal, per IP
  maxPhotoBytes: 1_500_000,
  seed: 7,
};

/** Bin classes: capacity in kg of material and how many kg/h it receives (simulated). */
export const BIN_KINDS = {
  b: { name: 'waste_basket', capacityKg: 15, kgPerHour: 2.4, stream: 'general' },
  d: { name: 'waste_disposal', capacityKg: 120, kgPerHour: 12, stream: 'general' },
  r: { name: 'recycling', capacityKg: 150, kgPerHour: 14, stream: 'recycling' },
};

/** Demo coordinates only (not real facility locations). */
export const SITES = [
  { id: 'P1', kind: 'sorting', name: { el: 'Μονάδα διαλογής Α', en: 'Sorting plant A' }, lat: 37.9792, lon: 23.6905, scene: 'single-line' },
  { id: 'P2', kind: 'sorting', name: { el: 'Μονάδα διαλογής Β', en: 'Sorting plant B' }, lat: 38.0123, lon: 23.7655, scene: 'twin-lines' },
  { id: 'T1', kind: 'transfer', name: { el: 'Σταθμός μεταφόρτωσης', en: 'Transfer station' }, lat: 37.9560, lon: 23.7130 },
];

/** Typical item weight in kg, to turn the sorter's item counts into mass. */
export const ITEM_KG = { PET_CLEAR: 0.028, PET_COLOR: 0.03, HDPE: 0.045, PP: 0.02, PS: 0.012, ALU: 0.015, GLASS: 0.3, CARTON: 0.06, STEEL: 0.08, RESIDUE: 0.04 };
export const DESTINATIONS = {
  PET_CLEAR: { el: 'Ανακυκλωτής PET', en: 'PET recycler' }, PET_COLOR: { el: 'Ανακυκλωτής PET', en: 'PET recycler' },
  HDPE: { el: 'Ανακυκλωτής πολυολεφινών', en: 'Polyolefin recycler' }, PP: { el: 'Ανακυκλωτής πολυολεφινών', en: 'Polyolefin recycler' },
  PS: { el: 'Ανακυκλωτής PS', en: 'PS recycler' }, ALU: { el: 'Χυτήριο αλουμινίου', en: 'Aluminium smelter' },
  GLASS: { el: 'Υαλουργία', en: 'Glassworks' }, CARTON: { el: 'Χαρτοβιομηχανία', en: 'Paper mill' },
  STEEL: { el: 'Χαλυβουργία', en: 'Steelworks' }, RESIDUE: { el: 'ΧΥΤΑ', en: 'Landfill' },
};
