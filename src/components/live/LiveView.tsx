import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, resolveSession } from '../../lib/store';
import type { GridCell, Playlist, Song } from '../../lib/types';
import { BLOCKS, layoutFor } from '../../lib/types';
import { GRID_VARS } from '../../lib/grid';
import { BlockContent } from './blocks';
import { blockHasContent } from '../../lib/blocks';
import { useFitToBox } from '../../lib/fit';
import { Interstitial } from './Interstitial';
import { LiveTools } from './LiveTools';
import { toggleFullscreen } from '../../lib/screen';

export function LiveView() {
  const session = useStore((s) => s.session);
  const projects = useStore((s) => s.projects);
  const next = useStore((s) => s.next);
  const prev = useStore((s) => s.prev);
  const jumpTo = useStore((s) => s.jumpTo);
  const exitLive = useStore((s) => s.exitLive);
  const nudgeBrightness = useStore((s) => s.nudgeBrightness);

  const ctx = useMemo(
    () => resolveSession(projects, session),
    [projects, session],
  );

  const [toolsOpen, setToolsOpen] = useState(false);

  useKeepAwake(Boolean(ctx));

  // One-handed keyboard: space and arrows do the same thing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;

      switch (e.key) {
        case ' ':
        case 'Spacebar':
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case 'Enter':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          prev();
          break;
        case 'Home':
          e.preventDefault();
          jumpTo(0);
          break;
        case '[':
          nudgeBrightness(-0.05);
          break;
        case ']':
          nudgeBrightness(0.05);
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'Escape':
          setToolsOpen(false);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, jumpTo, nudgeBrightness]);

  /* Empty playlist keeps the rail, so Setup stays reachable. */
  if (!ctx) {
    return (
      <div className="live live-repo">
        <nav className="live-rail" aria-label="Playlist">
          <div className="rail-list">
            <div className="help" style={{ padding: 16 }}>
              No songs in this playlist yet.
            </div>
          </div>
          <div className="rail-foot">
            <button className="tool-btn" onClick={exitLive}>
              Setup
            </button>
          </div>
        </nav>
        <div className="live-empty">
          <div className="empty-state">
            This playlist has no songs to show.
            <div style={{ marginTop: 16 }}>
              <button className="cf-btn" onClick={exitLive}>
                Back to prep
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { playlist, songs } = ctx;
  const index = Math.min(session.index, songs.length - 1);
  const song = songs[index];
  const upcoming = songs[index + 1];

  return (
    <div className={session.interstitial ? 'live live-repo' : 'live'}>
      <Rail
        songs={songs}
        index={index}
        interstitial={session.interstitial}
        onJump={jumpTo}
      >
        <LiveTools
          open={toolsOpen}
          setOpen={setToolsOpen}
          onNext={next}
          onPrev={prev}
          onExit={exitLive}
          playlistName={playlist.name}
        />
      </Rail>

      {session.interstitial && upcoming ? (
        <Interstitial from={song} to={upcoming} onAdvance={next} />
      ) : (
        <>
          <header className="live-head">
            <h1 className="live-title">{song.title || 'Untitled'}</h1>
            <div className="live-next">
              <span className="label-cap">Next</span>
              {upcoming ? (
                <div className="name">{upcoming.title || 'Untitled'}</div>
              ) : (
                <div className="name end">End of set</div>
              )}
            </div>
          </header>

          <div className="live-stage" onClick={next} role="presentation">
            <RepoBand text={song.repositionDuring} />
            <SongGrid song={song} playlist={playlist} />
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Rail({
  songs,
  index,
  interstitial,
  onJump,
  children,
}: {
  songs: Song[];
  index: number;
  interstitial: boolean;
  onJump: (i: number) => void;
  /** Live chrome, parked in the rail's foot where it cannot cover a block. */
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector('[aria-current="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  return (
    <nav className="live-rail" aria-label="Playlist">
      <div className="rail-list" ref={ref}>
        {songs.map((s, i) => (
          <button
            key={`${s.id}-${i}`}
            className={
              'rail-item' +
              (i < index ? ' past' : '') +
              // During a reposition the rail still answers "where am I", but
              // shows it as a transition rather than as sitting on the song.
              (i === index && interstitial ? ' moving' : '')
            }
            aria-current={i === index ? 'true' : undefined}
            onClick={() => onJump(i)}
          >
            <span className="n">{i + 1}</span>
            <span className="t">{s.title || 'Untitled'}</span>
            <span className="marker">
              {s.repositionDuring ? '●' : ''}
              {s.repositionAfter ? '▼' : ''}
            </span>
          </button>
        ))}
      </div>
      <div className="rail-foot">{children}</div>
    </nav>
  );
}

/**
 * Fixed, dedicated spot for a during-song reposition. The band keeps its
 * height even when the song has no move, so the grid underneath never shifts
 * between songs.
 */
function RepoBand({ text }: { text: string }) {
  const on = Boolean(text.trim());
  return (
    <div className={on ? 'repo-band on' : 'repo-band'} aria-live="off">
      {on && (
        <>
          <span className="tagword">Move</span>
          <span className="txt">{text}</span>
        </>
      )}
    </div>
  );
}

/**
 * Every song renders the playlist's default template, unless that song has
 * an override — which is the only thing allowed to change the geometry, and
 * only for that one song.
 */
function SongGrid({ song, playlist }: { song: Song; playlist: Playlist }) {
  const layout = layoutFor(playlist, song.id);
  return (
    <div className="live-grid" style={GRID_VARS}>
      {layout.map((cell) =>
        blockHasContent(song, cell.block) ? (
          <Cell key={cell.block} cell={cell} song={song} />
        ) : null,
      )}
    </div>
  );
}

function Cell({ cell, song }: { cell: GridCell; song: Song }) {
  const ref = useFitToBox<HTMLDivElement>(
    `${song.id}:${song.updatedAt}:${cell.w}x${cell.h}`,
  );
  return (
    <div
      className="cell"
      style={{
        gridColumn: `${cell.x + 1} / span ${cell.w}`,
        gridRow: `${cell.y + 1} / span ${cell.h}`,
      }}
    >
      <div className="cell-label">{BLOCKS[cell.block].label}</div>
      <div className="cell-body" ref={ref}>
        <BlockContent song={song} block={cell.block} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Venue devices sleep. Hold a wake lock for as long as the live view is up. */
function useKeepAwake(active: boolean) {
  useEffect(() => {
    if (!active) return;
    type Sentinel = { release: () => Promise<void> };
    const wl = (
      navigator as Navigator & {
        wakeLock?: { request: (t: 'screen') => Promise<Sentinel> };
      }
    ).wakeLock;
    if (!wl) return;

    let sentinel: Sentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const s = await wl.request('screen');
        if (cancelled) void s.release();
        else sentinel = s;
      } catch {
        /* Denied or unsupported — not fatal. */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [active]);
}
