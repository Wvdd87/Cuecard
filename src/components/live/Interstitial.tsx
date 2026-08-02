import type { Project, Song } from '../../lib/types';
import { cameraById } from '../../lib/types';
import { CameraBadge } from '../CameraBadge';

/**
 * Full-page camera-reposition card, shown between two songs.
 *
 * This sits outside the pins/cards/tracks layout entirely — it is a dedicated
 * screen, not a card, because missing a reposition is a real production
 * problem and the next song's dashboard must be unreachable until it is
 * acknowledged. The playlist rail stays, so an artist audible during the
 * changeover is still recoverable.
 *
 * Deliberately not a light surface: warm near-black with hazard hatching.
 */
export function Interstitial({
  from,
  to,
  project,
  onAdvance,
}: {
  from: Song;
  to: Song;
  project: Project;
  onAdvance: () => void;
}) {
  const repo = from.repositionAfter;
  return (
    <section className="interstitial" onClick={onAdvance} role="presentation">
      <div className="kicker">Reposition</div>

      {repo && repo.cameras.length > 0 && (
        <div className="repo-cams">
          {repo.cameras.map((id) => (
            <CameraBadge key={id} camera={cameraById(project, id)} id={id} />
          ))}
        </div>
      )}

      <div className="body">{repo?.destination}</div>

      <div className="foot">
        <span>
          after <b>{from.title || 'Untitled'}</b>
        </span>
        <span>→</span>
        <span>
          then <b>{to.title || 'Untitled'}</b>
        </span>
        <span className="cue">space when set</span>
      </div>
    </section>
  );
}
