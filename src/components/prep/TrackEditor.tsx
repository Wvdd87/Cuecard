import { useRef, useState } from 'react';
import { useStore } from '../../lib/store';
import type { Project, Song, TrackDefinition } from '../../lib/types';
import { ASPECT_RATIOS, trackBlocks } from '../../lib/types';
import { TRACK_COLORS, BLACK_COLOR } from '../../lib/defaults';

/**
 * One track for one song, in prep.
 *
 * Blocks always sum to 100% of the track. Adding one splits the last block;
 * dragging a divider moves only the two blocks either side, so the rest of
 * the track holds still and the total never drifts.
 */
export function TrackEditor({
  project,
  song,
  track,
}: {
  project: Project;
  song: Song;
  track: TrackDefinition;
}) {
  const addTrackBlock = useStore((s) => s.addTrackBlock);
  const updateTrackBlock = useStore((s) => s.updateTrackBlock);
  const removeTrackBlock = useStore((s) => s.removeTrackBlock);
  const resizeTrackBlocks = useStore((s) => s.resizeTrackBlocks);
  const rememberPreset = useStore((s) => s.rememberPreset);

  const lane = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const blocks = trackBlocks(song, track.id);

  const beginResize = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = lane.current?.getBoundingClientRect();
    if (!rect) return;

    const a = blocks[index];
    const b = blocks[index + 1];
    if (!a || !b) return;
    // Left edge of the pair, as a fraction of the lane.
    const startFrac =
      blocks.slice(0, index).reduce((s, blk) => s + blk.widthPercent, 0) / 100;
    const pairFrac = (a.widthPercent + b.widthPercent) / 100;

    const onMove = (ev: PointerEvent) => {
      const x = (ev.clientX - rect.left) / rect.width;
      const ratio = (x - startFrac) / pairFrac;
      resizeTrackBlocks(project.id, song.id, track.id, index, ratio);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div className="track-edit">
      <div className="track-edit-head">
        <span className="eyebrow">{track.name}</span>
        <div className="spacer" />
        <button
          className="cf-btn sm"
          onClick={() => addTrackBlock(project.id, song.id, track.id)}
        >
          + block
        </button>
      </div>

      <div className="track-lane edit" ref={lane}>
        {blocks.length === 0 ? (
          <div className="track-empty" />
        ) : (
          blocks.map((b, i) => (
            <div
              key={b.id}
              className={b.aspectRatio === 'black' ? 'track-block is-black' : 'track-block'}
              style={{ width: `${b.widthPercent}%`, background: b.color }}
              onClick={() => setOpen(open === b.id ? null : b.id)}
              role="presentation"
            >
              <span className="tb-label">{b.label || '—'}</span>
              {b.aspectRatio && b.aspectRatio !== 'black' && (
                <span className="tb-ar">{b.aspectRatio}</span>
              )}
              <span className="tb-pct">{Math.round(b.widthPercent)}%</span>

              {i < blocks.length - 1 && (
                <span
                  className="divider"
                  title="Drag to resize"
                  onPointerDown={(e) => beginResize(e, i)}
                  onClick={(e) => e.stopPropagation()}
                  role="separator"
                />
              )}
            </div>
          ))
        )}
      </div>

      {open && (
        <BlockForm
          project={project}
          song={song}
          track={track}
          blockId={open}
          onClose={() => setOpen(null)}
          onChange={(patch) =>
            updateTrackBlock(project.id, song.id, track.id, open, patch)
          }
          onRemove={() => {
            removeTrackBlock(project.id, song.id, track.id, open);
            setOpen(null);
          }}
          onRemember={(b) => rememberPreset(project.id, track.id, b)}
        />
      )}
    </div>
  );
}

/** Edit one block, with autocomplete from what this track has used before. */
function BlockForm({
  project,
  song,
  track,
  blockId,
  onClose,
  onChange,
  onRemove,
  onRemember,
}: {
  project: Project;
  song: Song;
  track: TrackDefinition;
  blockId: string;
  onClose: () => void;
  onChange: (patch: Partial<import('../../lib/types').TrackBlock>) => void;
  onRemove: () => void;
  onRemember: (b: import('../../lib/types').TrackBlock) => void;
}) {
  void project;
  const block = trackBlocks(song, track.id).find((b) => b.id === blockId);
  if (!block) return null;

  return (
    <div className="block-form">
      {track.recommendedBlocks.length > 0 && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="label-cap">Used before</span>
          {track.recommendedBlocks.map((r) => (
            <button
              key={r.id}
              className="chip"
              title="Fill label, colour and aspect ratio from this"
              onClick={() =>
                onChange({
                  label: r.label,
                  color: r.color,
                  aspectRatio: r.aspectRatio,
                })
              }
            >
              <span className="swatch" style={{ background: r.color }} />
              {r.label}
            </button>
          ))}
        </div>
      )}

      <div className="row">
        <input
          className="field"
          placeholder="Label"
          value={block.label}
          onChange={(e) => onChange({ label: e.target.value })}
          style={{ maxWidth: 200 }}
        />
        <select
          className="field"
          style={{ maxWidth: 130 }}
          value={block.aspectRatio ?? ''}
          onChange={(e) =>
            onChange({
              aspectRatio: (e.target.value || undefined) as
                | import('../../lib/types').AspectRatio
                | undefined,
              ...(e.target.value === 'black' ? { color: BLACK_COLOR } : {}),
            })
          }
        >
          <option value="">aspect —</option>
          {ASPECT_RATIOS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <button className="cf-btn sm" onClick={() => onRemember(block)}>
          Remember
        </button>
        <button className="cf-btn sm danger" onClick={onRemove}>
          Remove
        </button>
        <button className="cf-btn sm ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <span className="label-cap">Colour</span>
        {[...TRACK_COLORS, BLACK_COLOR].map((c) => (
          <button
            key={c}
            className={block.color === c ? 'swatch-btn on' : 'swatch-btn'}
            style={{ background: c }}
            aria-label={c}
            onClick={() => onChange({ color: c })}
          />
        ))}
      </div>

      <input
        className="field"
        placeholder="Detail (optional)"
        value={block.text ?? ''}
        onChange={(e) => onChange({ text: e.target.value })}
      />
    </div>
  );
}
