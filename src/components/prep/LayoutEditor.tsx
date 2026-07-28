import { useLayoutEffect, useRef, useState } from 'react';
import type { BlockType, GridCell, Song } from '../../lib/types';
import {
  BLOCKS,
  BLOCK_GROUPS,
  GRID_COLS,
  GRID_ROWS,
  blocksInGroup,
} from '../../lib/types';
import { clamp } from '../../lib/util';
import { blockHasContent, unplacedBlocks } from '../../lib/blocks';
import { BlockContent } from '../live/blocks';
import { useFitToBox } from '../../lib/fit';
import { GRID_VARS } from '../../lib/grid';

/**
 * The template editor. One component, used for both the playlist's default
 * template and a per-song override — an override is just this editor pointed
 * at a different layout, which is why they behave identically.
 *
 * The preview runs the real live-view renderer and the real fit logic, so
 * what the operator shapes here is what they get in the room.
 */
export function LayoutEditor({
  layout,
  onChange,
  song,
  heading,
  subheading,
  onDone,
  onReset,
  resetLabel,
}: {
  layout: GridCell[];
  onChange: (l: GridCell[]) => void;
  /** The song previewed inside the blocks. */
  song?: Song;
  heading: string;
  subheading: string;
  onDone: () => void;
  onReset: () => void;
  resetLabel: string;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<BlockType | null>(null);
  usePreviewScale(canvas);

  const placed = layout.map((c) => c.block);
  const missing = song ? unplacedBlocks(song, placed) : [];
  const overlapping = findOverlaps(layout);

  const beginDrag = (
    e: React.PointerEvent,
    cell: GridCell,
    mode: 'move' | 'resize',
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = canvas.current?.getBoundingClientRect();
    if (!rect) return;
    const cw = rect.width / GRID_COLS;
    const ch = rect.height / GRID_ROWS;
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...cell };
    setDragging(cell.block);

    const onMove = (ev: PointerEvent) => {
      const dx = Math.round((ev.clientX - startX) / cw);
      const dy = Math.round((ev.clientY - startY) / ch);
      const next: GridCell =
        mode === 'move'
          ? {
              ...orig,
              x: clamp(orig.x + dx, 0, GRID_COLS - orig.w),
              y: clamp(orig.y + dy, 0, GRID_ROWS - orig.h),
            }
          : {
              ...orig,
              w: clamp(orig.w + dx, 1, GRID_COLS - orig.x),
              h: clamp(orig.h + dy, 1, GRID_ROWS - orig.y),
            };
      onChange(layout.map((c) => (c.block === cell.block ? next : c)));
    };
    const onUp = () => {
      setDragging(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const toggle = (b: BlockType) => {
    if (placed.includes(b)) {
      onChange(layout.filter((c) => c.block !== b));
      return;
    }
    const maxY = layout.reduce((m, c) => Math.max(m, c.y + c.h), 0);
    const y = Math.min(maxY, GRID_ROWS - 2);
    onChange([
      ...layout,
      { block: b, x: 0, y, w: GRID_COLS, h: Math.min(2, GRID_ROWS - y) },
    ]);
  };

  return (
    <div className="section" style={{ maxWidth: 1180 }}>
      <div className="section-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{heading}</div>
          <div className="hint">{subheading}</div>
        </div>
        <button className="btn sm" onClick={onReset}>
          {resetLabel}
        </button>
        <button className="btn primary" onClick={onDone}>
          Done
        </button>
      </div>

      {/* Block library, grouped. Small specific units, not big zones. */}
      <div className="palette">
        {BLOCK_GROUPS.map((g) => (
          <div className="palette-group" key={g}>
            <span className="label">{g}</span>
            {blocksInGroup(g).map((b) => {
              const on = placed.includes(b);
              const empty = song ? !blockHasContent(song, b) : false;
              return (
                <button
                  key={b}
                  className={`chip${on ? ' on' : ''}${empty ? ' empty' : ''}`}
                  onClick={() => toggle(b)}
                  title={
                    empty
                      ? `${BLOCKS[b].hint} — this song has nothing in it yet`
                      : BLOCKS[b].hint
                  }
                >
                  {on ? '✓ ' : '+ '}
                  {BLOCKS[b].label}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {missing.length > 0 && (
        <div className="notice">
          Not in this template:{' '}
          <b>{missing.map((b) => BLOCKS[b].label).join(', ')}</b> — this song
          has content there that will not be shown.
        </div>
      )}
      {overlapping.length > 0 && (
        <div className="notice">
          Overlapping:{' '}
          <b>{overlapping.map((b) => BLOCKS[b].label).join(', ')}</b> — these
          will stack on top of each other live.
        </div>
      )}

      <div className="layout-stage">
        <div className="layout-mock-head">
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-dim)' }}>
            {song?.title || 'Song title'}
          </span>
          <span className="label">Next ▸ fixed</span>
        </div>
        <div className="layout-mock-body">
          <div className="layout-mock-rail">
            <span className="label">Playlist rail</span>
            <div>1 · fixed</div>
            <div>2 · fixed</div>
            <div>3 · fixed</div>
          </div>
          <div className="layout-mock-stage">
            <div className="repo-band">
              <span className="tagword" style={{ color: 'var(--text-faint)' }}>
                REPOSITION BAND — FIXED
              </span>
            </div>
            <div className="layout-canvas" ref={canvas} style={GRID_VARS}>
              {layout.map((cell) => (
                <div
                  key={cell.block}
                  className={
                    dragging === cell.block
                      ? 'layout-item dragging'
                      : 'layout-item'
                  }
                  style={{
                    gridColumn: `${cell.x + 1} / span ${cell.w}`,
                    gridRow: `${cell.y + 1} / span ${cell.h}`,
                  }}
                  onPointerDown={(e) => beginDrag(e, cell, 'move')}
                >
                  <div className="label">{BLOCKS[cell.block].label}</div>
                  <PreviewBody cell={cell} song={song} />
                  <div
                    className="handle"
                    onPointerDown={(e) => beginDrag(e, cell, 'resize')}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="hint" style={{ marginTop: 12 }}>
        Drag to move, corner to resize. Content resizes to whatever room you
        give it — shape the space, the text follows. Song title, next-song
        slot, playlist rail and the reposition band are fixed and cannot be
        moved; they are the parts you should find without looking.
      </div>
    </div>
  );
}

/** Live content at live scale, so resizing shows the real result. */
function PreviewBody({ cell, song }: { cell: GridCell; song?: Song }) {
  const ref = useFitToBox<HTMLDivElement>(
    `${song?.id ?? 'none'}:${song?.updatedAt ?? 0}:${cell.w}x${cell.h}`,
  );
  if (!song || !blockHasContent(song, cell.block)) return null;
  return (
    <div className="layout-item-body" ref={ref}>
      <BlockContent song={song} block={cell.block} />
    </div>
  );
}

/**
 * Make the preview a true scale model of the live stage.
 *
 * The mock stage is a fraction of a real screen, so rendering type at full
 * live size inside it reports overflow that will not happen in the room.
 * Scaling the whole tier ramp by the same ratio as the stage means the fit
 * result the operator sees here is the fit result they get live.
 */
function usePreviewScale(canvas: React.RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const apply = () => {
      const railW =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--rail-w'),
        ) || 240;
      const pad =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--pad'),
        ) || 16;
      const liveStage = window.innerWidth - railW - pad * 2;
      const ratio = el.clientWidth / liveStage;
      el.style.setProperty('--tier-scale', String(Math.min(1, ratio).toFixed(3)));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, [canvas]);
}

function findOverlaps(layout: GridCell[]): BlockType[] {
  const hit = new Set<BlockType>();
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      const a = layout[i];
      const b = layout[j];
      if (
        a.x < b.x + b.w &&
        b.x < a.x + a.w &&
        a.y < b.y + b.h &&
        b.y < a.y + a.h
      ) {
        hit.add(a.block);
        hit.add(b.block);
      }
    }
  }
  return [...hit];
}
