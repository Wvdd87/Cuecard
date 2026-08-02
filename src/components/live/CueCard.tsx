import type { MilestonePin, Project } from '../../lib/types';
import { CARD_LABELS, cameraById } from '../../lib/types';
import { CameraBadge } from '../CameraBadge';

/**
 * A cue card: what happens at one pin.
 *
 * Four kinds, each locked to its own vertical lane by the canvas above, so
 * the operator always knows which band to check even though the horizontal
 * position follows the song's own structure.
 */
export function CueCard({
  pin,
  project,
}: {
  pin: MilestonePin;
  project: Project;
}) {
  const d = pin.cardData;

  return (
    <div className={`cue-card cue-${pin.cardType}`}>
      <div className="cue-kind">{d.title || CARD_LABELS[pin.cardType]}</div>
      <div className="cue-body">
        {pin.cardType === 'first_shots' && (
          <div className="shots">
            {project.cameras.map((cam) => {
              const shot = d.shots?.[cam.id] ?? '';
              // Unused cameras are left blank rather than dropped, so the
              // list reads the same on every song.
              return (
                <div
                  key={cam.id}
                  className={shot ? 'shot' : 'shot unused'}
                >
                  <CameraBadge camera={cam} />
                  <span className="shot-text">{shot || '—'}</span>
                </div>
              );
            })}
          </div>
        )}

        {pin.cardType === 'specific_shot' && (
          <div className="one-shot">
            <CameraBadge camera={cameraById(project, d.camera)} id={d.camera} />
            <span className="shot-text">{d.text || ''}</span>
          </div>
        )}

        {pin.cardType === 'reposition' && (
          <div className="one-shot">
            <CameraBadge camera={cameraById(project, d.camera)} id={d.camera} />
            <span className="shot-text">{d.destination || d.text || ''}</span>
          </div>
        )}

        {pin.cardType === 'note' && <div className="note-text">{d.text}</div>}
      </div>
    </div>
  );
}
