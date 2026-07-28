import { useState } from 'react';
import { useStore } from '../../lib/store';

/** In-app dimming, independent of the device's own brightness control. */
export function DisplayPopover() {
  const display = useStore((s) => s.display);
  const setDisplay = useStore((s) => s.setDisplay);
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button className="cf-btn sm ghost" onClick={() => setOpen(!open)}>
        Screen {Math.round(display.brightness * 100)}%
      </button>
      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setOpen(false)}
          />
          <div
            className="live-tools-pop"
            style={{ position: 'absolute', right: 0, left: 'auto', top: '110%', bottom: 'auto', zIndex: 11 }}
          >
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
            <button
              className="cf-btn sm"
              onClick={() => setDisplay({ brightness: 1, contrast: 1 })}
            >
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  );
}
