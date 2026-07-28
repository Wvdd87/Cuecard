import type { Song } from '../../lib/types';

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
    <section className="interstitial" onClick={onAdvance} role="presentation">
      <div className="kicker">Reposition</div>
      <div className="body">{from.repositionAfter}</div>
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
