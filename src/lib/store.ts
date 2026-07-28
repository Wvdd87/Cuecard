import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  BlockType,
  Display,
  GridCell,
  Playlist,
  Project,
  Session,
  Song,
} from './types';
import { GRID_COLS, GRID_ROWS, ensureReposition } from './types';
import {
  DEFAULT_LAYOUT,
  demoProject,
  newPlaylist,
  newProject,
  newSong,
} from './defaults';
import { migrate, STORE_VERSION } from './migrate';
import { clamp, move, today, uid } from './util';

/**
 * Everything except reference images lives in localStorage.
 * localStorage is synchronous, so a reload paints the restored live view on
 * the first frame — no loading state, no flash, no network round-trip.
 * Images are large and live-view-irrelevant, so they go to IndexedDB
 * (see lib/images.ts) and are never in the hot path.
 */

interface State {
  projects: Project[];
  session: Session;
  display: Display;

  // projects
  createProject: (name: string) => string;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  importProject: (p: Project) => void;

  // bucket
  addSong: (projectId: string, title?: string) => string;
  updateSong: (projectId: string, songId: string, patch: Partial<Song>) => void;
  deleteSong: (projectId: string, songId: string) => void;

  // playlists
  createPlaylist: (projectId: string, name: string) => string;
  duplicatePlaylist: (projectId: string, playlistId: string) => string | null;
  updatePlaylist: (
    projectId: string,
    playlistId: string,
    patch: Partial<Playlist>,
  ) => void;
  deletePlaylist: (projectId: string, playlistId: string) => void;
  addToPlaylist: (projectId: string, playlistId: string, songId: string) => void;
  removeFromPlaylist: (projectId: string, playlistId: string, i: number) => void;
  movePlaylistSong: (
    projectId: string,
    playlistId: string,
    from: number,
    to: number,
  ) => void;

  // templates — the playlist owns its default, songs may override it
  setLayout: (projectId: string, playlistId: string, layout: GridCell[]) => void;
  resetLayout: (projectId: string, playlistId: string) => void;
  toggleLayoutBlock: (
    projectId: string,
    playlistId: string,
    block: BlockType,
  ) => void;
  setSongLayout: (
    projectId: string,
    playlistId: string,
    songId: string,
    layout: GridCell[],
  ) => void;
  /** Start an override as a copy of the playlist default. */
  startOverride: (projectId: string, playlistId: string, songId: string) => void;
  /** Drop the override; the song goes back to the playlist default. */
  clearOverride: (projectId: string, playlistId: string, songId: string) => void;

  // session / live
  goLive: (projectId: string, playlistId: string, index?: number) => void;
  exitLive: () => void;
  next: () => void;
  prev: () => void;
  jumpTo: (index: number) => void;
  setProjectId: (id: string | null) => void;

  // display
  setDisplay: (patch: Partial<Display>) => void;
  nudgeBrightness: (delta: number) => void;
}

const DEFAULT_SESSION: Session = {
  projectId: null,
  playlistId: null,
  index: 0,
  interstitial: false,
  live: false,
};

const DEFAULT_DISPLAY: Display = { brightness: 1, contrast: 1 };

/** Mutate one project in the array, returning a new array. */
function withProject(
  projects: Project[],
  id: string,
  fn: (p: Project) => Project,
): Project[] {
  return projects.map((p) => (p.id === id ? fn(p) : p));
}

function withPlaylist(
  p: Project,
  playlistId: string,
  fn: (pl: Playlist) => Playlist,
): Project {
  return {
    ...p,
    playlists: p.playlists.map((pl) => (pl.id === playlistId ? fn(pl) : pl)),
  };
}

/** Add a block to a layout, or remove it if already placed. */
function toggleBlock(layout: GridCell[], block: BlockType): GridCell[] {
  if (layout.some((c) => c.block === block)) {
    return ensureReposition(layout.filter((c) => c.block !== block));
  }
  // Drop the new cell into the first free row, full width — somewhere
  // obvious, for the operator to then place properly.
  const maxY = layout.reduce((m, c) => Math.max(m, c.y + c.h), 0);
  const y = Math.min(maxY, GRID_ROWS - 2);
  return [
    ...layout,
    { block, x: 0, y, w: GRID_COLS, h: Math.min(2, GRID_ROWS - y) },
  ];
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      projects: [],
      session: DEFAULT_SESSION,
      display: DEFAULT_DISPLAY,

      createProject: (name) => {
        const p = newProject(name.trim() || 'Untitled');
        set((s) => ({ projects: [...s.projects, p] }));
        return p.id;
      },

      renameProject: (id, name) =>
        set((s) => ({
          projects: withProject(s.projects, id, (p) => ({ ...p, name })),
        })),

      deleteProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          session:
            s.session.projectId === id ? { ...DEFAULT_SESSION } : s.session,
        })),

      importProject: (p) =>
        set((s) => ({ projects: [...s.projects, { ...p, id: uid('p_') }] })),

      addSong: (projectId, title = '') => {
        const song = newSong(title);
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            songs: [...p.songs, song],
          })),
        }));
        return song.id;
      },

      updateSong: (projectId, songId, patch) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            songs: p.songs.map((song) =>
              song.id === songId
                ? { ...song, ...patch, updatedAt: Date.now() }
                : song,
            ),
          })),
        })),

      deleteSong: (projectId, songId) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            songs: p.songs.filter((song) => song.id !== songId),
            // A deleted bucket song disappears from every playlist using it.
            playlists: p.playlists.map((pl) => ({
              ...pl,
              songIds: pl.songIds.filter((id) => id !== songId),
            })),
          })),
        })),

      createPlaylist: (projectId, name) => {
        const pl = newPlaylist(name);
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            playlists: [...p.playlists, pl],
          })),
        }));
        return pl.id;
      },

      duplicatePlaylist: (projectId, playlistId) => {
        const project = get().projects.find((p) => p.id === projectId);
        const src = project?.playlists.find((pl) => pl.id === playlistId);
        if (!src) return null;
        const copy: Playlist = {
          ...src,
          id: uid('pl_'),
          name: `${src.name} (copy)`,
          date: today(),
          // songIds are references into the bucket — copying the array is
          // deliberately a shallow copy of references, not of content.
          songIds: [...src.songIds],
          // The template and any per-song overrides come with it. Duplicating
          // last night's playlist for tonight is how a template stays stable
          // across a run of dates.
          layout: src.layout.map((c) => ({ ...c })),
          overrides: Object.fromEntries(
            Object.entries(src.overrides).map(([id, l]) => [
              id,
              l.map((c) => ({ ...c })),
            ]),
          ),
          createdAt: Date.now(),
        };
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            playlists: [...p.playlists, copy],
          })),
        }));
        return copy.id;
      },

      updatePlaylist: (projectId, playlistId, patch) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withPlaylist(p, playlistId, (pl) => ({ ...pl, ...patch })),
          ),
        })),

      deletePlaylist: (projectId, playlistId) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            playlists: p.playlists.filter((pl) => pl.id !== playlistId),
          })),
          session:
            s.session.playlistId === playlistId
              ? { ...DEFAULT_SESSION, projectId: s.session.projectId }
              : s.session,
        })),

      addToPlaylist: (projectId, playlistId, songId) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withPlaylist(p, playlistId, (pl) => ({
              ...pl,
              songIds: [...pl.songIds, songId],
            })),
          ),
        })),

      removeFromPlaylist: (projectId, playlistId, i) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withPlaylist(p, playlistId, (pl) => ({
              ...pl,
              songIds: pl.songIds.filter((_, idx) => idx !== i),
            })),
          ),
        })),

      movePlaylistSong: (projectId, playlistId, from, to) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withPlaylist(p, playlistId, (pl) => ({
              ...pl,
              songIds: move(pl.songIds, from, to),
            })),
          ),
        })),

      setLayout: (projectId, playlistId, layout) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withPlaylist(p, playlistId, (pl) => ({
              ...pl,
              layout: ensureReposition(layout),
            })),
          ),
        })),

      resetLayout: (projectId, playlistId) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withPlaylist(p, playlistId, (pl) => ({
              ...pl,
              layout: DEFAULT_LAYOUT.map((c) => ({ ...c })),
            })),
          ),
        })),

      /**
       * Add or remove a block from the playlist's default template. Songs
       * with their own override are untouched — that is the point of one.
       */
      toggleLayoutBlock: (projectId, playlistId, block) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withPlaylist(p, playlistId, (pl) => ({
              ...pl,
              layout: toggleBlock(pl.layout, block),
            })),
          ),
        })),

      setSongLayout: (projectId, playlistId, songId, layout) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withPlaylist(p, playlistId, (pl) => ({
              ...pl,
              overrides: { ...pl.overrides, [songId]: ensureReposition(layout) },
            })),
          ),
        })),

      startOverride: (projectId, playlistId, songId) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withPlaylist(p, playlistId, (pl) =>
              pl.overrides[songId]
                ? pl
                : {
                    ...pl,
                    // Starts as a copy of the default, so the operator is
                    // adjusting a familiar layout rather than starting blank.
                    overrides: {
                      ...pl.overrides,
                      [songId]: ensureReposition(pl.layout.map((c) => ({ ...c }))),
                    },
                  },
            ),
          ),
        })),

      clearOverride: (projectId, playlistId, songId) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withPlaylist(p, playlistId, (pl) => {
              const { [songId]: _dropped, ...rest } = pl.overrides;
              return { ...pl, overrides: rest };
            }),
          ),
        })),

      goLive: (projectId, playlistId, index = 0) =>
        set(() => ({
          session: {
            projectId,
            playlistId,
            index: Math.max(0, index),
            interstitial: false,
            live: true,
          },
        })),

      exitLive: () =>
        set((s) => ({ session: { ...s.session, live: false } })),

      setProjectId: (id) =>
        set((s) => ({ session: { ...s.session, projectId: id } })),

      /**
       * Forward. If the current song is flagged "reposition after", the move
       * gets its own full page first — you cannot land on the next song
       * without passing through it.
       */
      next: () => {
        const { session, projects } = get();
        const ctx = resolveSession(projects, session);
        if (!ctx) return;
        const { songs } = ctx;
        const last = songs.length - 1;

        if (session.interstitial) {
          set({
            session: {
              ...session,
              interstitial: false,
              index: clamp(session.index + 1, 0, last),
            },
          });
          return;
        }
        const current = songs[session.index];
        if (current?.repositionAfter && session.index < last) {
          set({ session: { ...session, interstitial: true } });
          return;
        }
        if (session.index < last) {
          set({ session: { ...session, index: session.index + 1 } });
        }
      },

      /** Backward, symmetric: you pass back through the same interstitial. */
      prev: () => {
        const { session, projects } = get();
        const ctx = resolveSession(projects, session);
        if (!ctx) return;
        const { songs } = ctx;

        if (session.interstitial) {
          set({ session: { ...session, interstitial: false } });
          return;
        }
        if (session.index === 0) return;
        const previous = songs[session.index - 1];
        set({
          session: {
            ...session,
            index: session.index - 1,
            interstitial: Boolean(previous?.repositionAfter),
          },
        });
      },

      /** Rail jump. Explicit, so it bypasses interstitials by design. */
      jumpTo: (index) => {
        const { session, projects } = get();
        const ctx = resolveSession(projects, session);
        if (!ctx) return;
        set({
          session: {
            ...session,
            index: clamp(index, 0, Math.max(0, ctx.songs.length - 1)),
            interstitial: false,
          },
        });
      },

      setDisplay: (patch) =>
        set((s) => ({ display: { ...s.display, ...patch } })),

      nudgeBrightness: (delta) =>
        set((s) => ({
          display: {
            ...s.display,
            brightness: clamp(
              Math.round((s.display.brightness + delta) * 100) / 100,
              0.2,
              1,
            ),
          },
        })),
    }),
    {
      name: 'cuecard.v1',
      storage: createJSONStorage(() => localStorage),
      version: STORE_VERSION,
      migrate,
    },
  ),
);

/**
 * Runs once, straight after hydration. localStorage is synchronous, so this
 * completes before the first render — the app never paints a wrong state and
 * then corrects itself.
 */
function bootstrap() {
  const s = useStore.getState();

  // First run: a worked example beats an empty screen.
  if (s.projects.length === 0) {
    useStore.setState({ projects: [demoProject()] });
  }

  // A stale session — playlist deleted, songs removed since last show — must
  // never strand the operator on a blank live view.
  const now = useStore.getState();
  const ctx = resolveSession(now.projects, now.session);
  if (now.session.live && !ctx) {
    useStore.setState({ session: { ...now.session, live: false } });
  } else if (ctx && now.session.index > ctx.songs.length - 1) {
    useStore.setState({
      session: {
        ...now.session,
        index: Math.max(0, ctx.songs.length - 1),
        interstitial: false,
      },
    });
  }
}

if (useStore.persist.hasHydrated()) bootstrap();
else useStore.persist.onFinishHydration(bootstrap);

export interface SessionContext {
  project: Project;
  playlist: Playlist;
  /** Playlist songs, resolved against the bucket, in playlist order. */
  songs: Song[];
}

export function resolveSession(
  projects: Project[],
  session: Session,
): SessionContext | null {
  const project = projects.find((p) => p.id === session.projectId);
  if (!project) return null;
  const playlist = project.playlists.find((pl) => pl.id === session.playlistId);
  if (!playlist) return null;
  const songs = playlist.songIds
    .map((id) => project.songs.find((s) => s.id === id))
    .filter((s): s is Song => Boolean(s));
  if (songs.length === 0) return null;
  return { project, playlist, songs };
}

/** Resolve a playlist's songs outside of live state (prep view, PDF). */
export function playlistSongs(project: Project, playlist: Playlist): Song[] {
  return playlist.songIds
    .map((id) => project.songs.find((s) => s.id === id))
    .filter((s): s is Song => Boolean(s));
}

export function songIsEmpty(song: Song): boolean {
  const b = song.blocks;
  return (
    b.presets.length === 0 &&
    b.camScreen.length === 0 &&
    b.instruments.length === 0 &&
    b.firstShots.length === 0 &&
    !b.note.trim() &&
    !song.repositionDuring.trim() &&
    !song.repositionAfter.trim()
  );
}
