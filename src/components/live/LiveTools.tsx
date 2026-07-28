import { useStore } from '../../lib/store';
import { toggleFullscreen } from '../../lib/screen';

/**
 * The only chrome in the live view, parked in the rail's foot — the one
 * place a control cannot land on top of a block. There is deliberately no
 * pagination widget: where you are is answered by the rail, and moving is
 * answered by space and the arrow keys.
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
    <div onClick={(e) => e.stopPropagation()}>
      {open && (
        <div className="live-tools-pop">
          <div>
            <div className="slider-label">
              Brightness {Math.round(display.brightness * 100)}%
            </div>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.01}
              value={display.brightness}
              onChange={(e) => setDisplay({ brightness: Number(e.target.value) })}
            />
          </div>
          <div>
            <div className="slider-label">
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

          <div className="keys">
            <span className="kbd">space</span>
            <span>next / confirm reposition</span>
            <span className="kbd">← →</span>
            <span>back / next</span>
            <span className="kbd">[ ]</span>
            <span>dimmer / brighter</span>
            <span className="kbd">f</span>
            <span>fullscreen</span>
            <span className="mark">●</span>
            <span>move during this song</span>
            <span className="mark">▼</span>
            <span>move after this song</span>
          </div>

          {/* Touch fallback for back/forward, kept off the glance surface. */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="pop-btn" onClick={onPrev}>
              ◀ Back
            </button>
            <button className="pop-btn" onClick={onNext}>
              Next ▶
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="pop-btn" onClick={toggleFullscreen}>
              Fullscreen
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span className="help">{playlistName}</span>
            <button className="leave-btn" onClick={onExit}>
              Leave live
            </button>
          </div>
        </div>
      )}

      <button
        className="tool-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? 'Close' : 'Setup'}
      </button>
    </div>
  );
}
