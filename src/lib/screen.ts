/** Venue devices are usually run fullscreen; this is the toggle. */
export function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void document.documentElement.requestFullscreen?.().catch(() => {
      /* Some browsers refuse outside a user gesture — not fatal. */
    });
  }
}
