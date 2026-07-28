import { useStore } from '../../lib/store';
import { toggleFullscreen } from '../../lib/screen';

/**
 * The only chrome in the live view.
 *
 * There is deliberately no pagination widget here. Where you are is already
 * answered by the rail, and moving is answered by space and the arrow keys —
 * a ◀ ▶ 1/4 control in the corner duplicated both, read as an afterthought,
 * and invited the operator to fiddle with it mid-song. What remains is one
 * dim tier-3 button for the handful of settings that genuinely have to be
 * reachable during a show, and it stays shut until asked for.
 */
export function LiveTools({
  open,
  setOpen,
  onNext,
  onPrev,
  onExit,
  playlistName,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  onExit: () => void;
  playlistName: string;
}) {
  const display = useStore((s) => s.display);
  const setDisplay = useStore((s) => s.setDisplay);

  return (
    <div className="live-tools" onClick={(e) => e.stopPropagation()}>
      {open && (
        <div className="popover">
          <div>
            <div className="t3" style={{ marginBottom: 6 }}>
              Brightness {Math.round(display.brightness * 100)}%
            </div>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.01}
              value={display.brightness}
              onChange={(e) =>
                setDisplay({ brightness: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <div className="t3" style={{ marginBottom: 6 }}>
              Contrast {Math.round(display.contrast * 100)}%
            </div>
            <input
              type="range"
              min={0.7}
              max={1.7}
              step={0.01}
              value={display.contrast}
              onChange={(e) => setDisplay({ contrast: Number(e.target.value) })}
            />
          </div>

          <div className="dl">
            <span className="kbd">space</span>
            <span>next / confirm reposition</span>
            <span className="kbd">← →</span>
            <span>back / next</span>
            <span className="kbd">[ ]</span>
            <span>dimmer / brighter</span>
            <span className="kbd">f</span>
            <span>fullscreen</span>
            <span className="rail-mark">●</span>
            <span>move during this song</span>
            <span className="rail-mark">▼</span>
            <span>move after this song</span>
          </div>

          {/* Touch fallback for back/forward, kept inside the panel rather
              than on the glance surface. */}
          <div className="row">
            <button className="btn sm" onClick={onPrev}>
              ◀ Back
            </button>
            <button className="btn sm" onClick={onNext}>
              Next ▶
            </button>
            <div className="spacer" />
            <button className="btn sm" onClick={toggleFullscreen}>
              Fullscreen
            </button>
          </div>

          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="hint">{playlistName}</span>
            <button className="btn sm danger" onClick={onExit}>
              Leave live
            </button>
          </div>
        </div>
      )}

      <button
        className="tool-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Live settings"
      >
        {open ? 'Close' : 'Setup'}
      </button>
    </div>
  );
}
