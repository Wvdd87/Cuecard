import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, resolveSession } from '../../lib/store';
import type { Song } from '../../lib/types';
import { Interstitial } from './Interstitial';
import { SongCanvas } from './SongCanvas';
import { LiveTools } from './LiveTools';
import { toggleFullscreen } from '../../lib/screen';

/**
 * The live view. Read-only: no drag handles, no inputs, no edit affordances,
 * and the whole song fits on screen — no scrollbars in either direction.
 */
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

  /*
   * One-handed, without looking away from the screen to find a key:
   * space advances, up/down step through the playlist.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;

      switch (e.key) {
        case ' ':
        case 'Spacebar':
        case 'Enter':
          e.preventDefault();
          next();
          break;
        case 'ArrowDown':
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          next();
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
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

  if (!ctx) {
    return (
      <div className="live live-empty-state">
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

  const { project, playlist, songs } = ctx;
  const index = Math.min(session.index, songs.length - 1);
  const song = songs[index];
  const upcoming = songs[index + 1];
  const onCard = session.interstitial && Boolean(upcoming);

  return (
    <div className={onCard ? 'live live-repo' : 'live'}>
      {/* Region A — fixed header and left rail. */}
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

      <Rail songs={songs} index={index} interstitial={session.interstitial} onJump={jumpTo}>
        <LiveTools
          open={toolsOpen}
          setOpen={setToolsOpen}
          onNext={next}
          onPrev={prev}
          onExit={exitLive}
          playlistName={playlist.name}
        />
      </Rail>

      {onCard ? (
        <Interstitial
          from={song}
          to={upcoming}
          project={project}
          onAdvance={next}
        />
      ) : (
        <div className="live-stage" onClick={next} role="presentation">
          <SongCanvas song={song} project={project} />
        </div>
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
              (i === index && interstitial ? ' moving' : '')
            }
            aria-current={i === index ? 'true' : undefined}
            onClick={() => onJump(i)}
          >
            <span className="n">{i + 1}</span>
            <span className="t">{s.title || 'Untitled'}</span>
            <span className="marker">{s.repositionAfter ? '▼' : ''}</span>
          </button>
        ))}
      </div>
      <div className="rail-foot">{children}</div>
    </nav>
  );
}

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
