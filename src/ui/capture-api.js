/**
 * window.__riq — the contract used by tools/capture-video. Frame-exact: the tool decides when time advances.
 * Keep these names stable; update the capture-video skill if you change them.
 */
export function installCaptureApi({ i18n, state, advance, renderFrame, startDemo }) {
  window.__riq = {
    get ready() { return !state.mode3d || !!state.view3d; },
    get scene() { return state.scene.id; },
    get t() { return state.plant.t; },
    get ended() { return !state.demoActive; },
    get duration() { return state.demo.duration; },
    setLang: l => i18n.set(l),
    startDemo: seed => { startDemo(seed); state.playing = false; },
    advance(seconds) { advance(seconds); renderFrame(); },
  };
}
