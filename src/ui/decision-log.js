/** Scrolling list of the scheduler's decisions (newest first). */
export function createDecisionLog(el, { max = 60 } = {}) {
  let seen = 0;
  return {
    reset() { seen = 0; el.innerHTML = ''; },
    update(plant) {
      for (; seen < plant.decisions.length; seen++) {
        const d = plant.decisions[seen], row = document.createElement('div');
        row.textContent = `${d.t.toFixed(2)}s ${d.line}${d.robot} #${d.item} ${d.type}→${d.bin} @(${d.pickXY[0].toFixed(2)},${d.pickXY[1].toFixed(2)}) — ${d.reason}`;
        el.prepend(row);
      }
      while (el.children.length > max) el.lastChild.remove();
    },
  };
}
