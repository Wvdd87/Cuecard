import type { CardType, MilestonePin, Project, Song } from '../../lib/types';
import { CARD_LANES, pinsInLane, trackBlocks } from '../../lib/types';
import { CueCard } from './CueCard';

/**
 * Region B + C: the song, read left to right.
 *
 * Cards sit in fixed vertical lanes and are anchored horizontally to their
 * pin's position along the song. Below them the pin rail, and below that the
 * screen tracks — whose structure is identical on every song, because track
 * definitions live at project level.
 *
 * Nothing here scrolls: a song is one fully-visible dashboard.
 */
export function SongCanvas({ song, project }: { song: Song; project: Project }) {
  return (
    <div className="canvas">
      <div className="lanes">
        {CARD_LANES.map((lane) => (
          <Lane key={lane} lane={lane} song={song} project={project} />
        ))}
      </div>

      {/* The rail every card hangs from. */}
      <div className="pin-rail">
        {song.pins.map((p) => (
          <span
            key={p.id}
            className={`pin pin-${p.cardType}`}
            style={{ left: `${p.positionPercent}%` }}
          />
        ))}
      </div>

      <div className="tracks">
        {project.tracks.map((t) => {
          const blocks = trackBlocks(song, t.id);
          return (
            <div className="track" key={t.id}>
              <div className="track-name">{t.name}</div>
              <div className="track-lane">
                {blocks.length === 0 ? (
                  <div className="track-empty" />
                ) : (
                  blocks.map((b) => (
                    <div
                      key={b.id}
                      className={
                        b.aspectRatio === 'black'
                          ? 'track-block is-black'
                          : 'track-block'
                      }
                      style={{
                        width: `${b.widthPercent}%`,
                        background: b.color,
                      }}
                    >
                      <span className="tb-label">{b.label}</span>
                      {b.aspectRatio && b.aspectRatio !== 'black' && (
                        <span className="tb-ar">{b.aspectRatio}</span>
                      )}
                      {b.text && <span className="tb-text">{b.text}</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * One lane. Cards are placed by percent, then nudged rightward only as far as
 * needed to stop two cards in the same lane overlapping — a card that covers
 * another is worse than a card a few percent off its pin.
 */
function Lane({
  lane,
  song,
  project,
}: {
  lane: CardType;
  song: Song;
  project: Project;
}) {
  const pins = pinsInLane(song, lane);
  const placed = layOut(pins);

  return (
    <div className={`lane lane-${lane}`}>
      {placed.map(({ pin, left }) => (
        <div
          className="lane-slot"
          key={pin.id}
          style={{ left: `${left}%` }}
        >
          <CueCard pin={pin} project={project} />
          {/* Connector down to the pin's true position on the rail. */}
          <span
            className="connector"
            style={{ left: `${pin.positionPercent - left}%` }}
          />
        </div>
      ))}
    </div>
  );
}

/** Percentage width a card occupies, used only for collision avoidance. */
const CARD_W = 21;

function layOut(pins: MilestonePin[]): { pin: MilestonePin; left: number }[] {
  let cursor = -Infinity;
  return pins.map((pin) => {
    const wanted = Math.min(pin.positionPercent, 100 - CARD_W);
    const left = Math.max(wanted, cursor);
    cursor = left + CARD_W + 1;
    return { pin, left: Math.min(left, 100 - CARD_W) };
  });
}
