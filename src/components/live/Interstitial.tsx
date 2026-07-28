import type { Song } from '../../lib/types';
import { FIT_MAX } from '../../lib/fit';

/**
 * Full-page camera-reposition card, shown between two songs.
 *
 * It takes over the header and the whole content stage so the next song's
 * cues are unreachable until it is acknowledged — that is the entire point.
 * The playlist rail stays, because if the artist audibles during the
 * changeover the operator still needs to be able to jump.
 *
 * Deliberately not a light surface: warm near-black with hazard hatching,
 * so it reads as "different" without flashing a dark room.
 */
export function Interstitial({
  from,
  to,
  onAdvance,
}: {
  from: Song;
  to: Song;
  onAdvance: () => void;
}) {
  return (
    <section
      className="interstitial"
      onClick={onAdvance}
      role="presentation"
      /* Tier 1 at the ceiling of its range — the same treatment the song
         title gets, because here this *is* the headline. */
      style={{ ['--fit' as string]: FIT_MAX }}
    >
      <div className="kicker t3">Reposition</div>
      <div className="body t1">{from.repositionAfter}</div>
      <div className="foot t3">
        <span>
          after <b>{from.title || 'Untitled'}</b>
        </span>
        <span>→</span>
        <span>
          then <b>{to.title || 'Untitled'}</b>
        </span>
        <span style={{ marginLeft: 'auto' }}>space when set</span>
      </div>
    </section>
  );
}
