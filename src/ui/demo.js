/** UI wrapper around a scene's demo timeline: fires its controls and shows captions as sim time passes. */
import { createTimeline } from '../scenes/demo-timeline.js';

export function createDemo(scene, i18n, captionEl) {
  const timeline = createTimeline(scene.demo);
  let current = null;

  const show = () => {
    captionEl.style.display = current ? 'block' : 'none';
    captionEl.textContent = current ? i18n.pick(current.caption) : '';
  };

  return {
    reset() { timeline.reset(); current = null; show(); },
    refresh: show,                           // call when the language changes
    /** Call every step. Returns true once the demo duration has elapsed. */
    tick(plant) {
      const fired = timeline.advance(plant);
      if (fired.length) { current = fired[fired.length - 1]; show(); }
      return timeline.finished(plant);
    },
    get duration() { return scene.demo.duration; },
  };
}
