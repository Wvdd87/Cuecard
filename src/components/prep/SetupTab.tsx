import { useStore } from '../../lib/store';
import type { Project } from '../../lib/types';
import { CAMERA_COLORS } from '../../lib/defaults';
import { CameraBadge } from '../CameraBadge';

/**
 * Project-level definitions: the master camera list and the screen tracks.
 *
 * Both are set once here and are identical across every song — the track
 * region of the live view does not vary in structure at all, and a camera
 * keeps its badge colour everywhere it is referenced.
 */
export function SetupTab({ project }: { project: Project }) {
  const addCamera = useStore((s) => s.addCamera);
  const updateCamera = useStore((s) => s.updateCamera);
  const removeCamera = useStore((s) => s.removeCamera);
  const addTrack = useStore((s) => s.addTrack);
  const updateTrack = useStore((s) => s.updateTrack);
  const removeTrack = useStore((s) => s.removeTrack);

  return (
    <div className="section" style={{ maxWidth: 820 }}>
      <div className="group-head">
        <span className="eyebrow">Cameras</span>
        <span className="rule" />
        <button className="cf-btn sm" onClick={() => addCamera(project.id)}>
          + camera
        </button>
      </div>
      <div className="help" style={{ marginBottom: 12 }}>
        Each camera owns one colour, everywhere it appears — so a camera is
        recognisable without reading the number.
      </div>

      <div className="def-list">
        {project.cameras.map((c) => (
          <div className="def-row" key={c.id}>
            <CameraBadge camera={c} size="xs" />
            <input
              className="cell-input"
              value={c.label}
              onChange={(e) =>
                updateCamera(project.id, c.id, { label: e.target.value })
              }
            />
            <div className="row" style={{ gap: 4 }}>
              {CAMERA_COLORS.map((col) => (
                <button
                  key={col}
                  className={c.badgeColor === col ? 'swatch-btn on' : 'swatch-btn'}
                  style={{ background: col }}
                  aria-label={col}
                  onClick={() =>
                    updateCamera(project.id, c.id, { badgeColor: col })
                  }
                />
              ))}
            </div>
            <button
              className="icon-x"
              aria-label={`Remove ${c.label}`}
              onClick={() => removeCamera(project.id, c.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="group-head">
        <span className="eyebrow">Screens</span>
        <span className="rule" />
        <button className="cf-btn sm" onClick={() => addTrack(project.id)}>
          + screen
        </button>
      </div>
      <div className="help" style={{ marginBottom: 12 }}>
        Screen tracks are identical on every song — this is the part of the
        live view whose structure never changes.
      </div>

      <div className="def-list">
        {project.tracks.map((t) => (
          <div className="def-row" key={t.id}>
            <input
              className="cell-input"
              value={t.name}
              onChange={(e) =>
                updateTrack(project.id, t.id, { name: e.target.value })
              }
            />
            <span className="help" style={{ flex: 1 }}>
              {t.recommendedBlocks.length} remembered block
              {t.recommendedBlocks.length === 1 ? '' : 's'}
            </span>
            <button
              className="icon-x"
              aria-label={`Remove ${t.name}`}
              onClick={() => removeTrack(project.id, t.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
