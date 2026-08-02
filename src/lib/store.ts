import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  CameraDefinition,
  CardType,
  Display,
  MilestonePin,
  Playlist,
  Project,
  Session,
  Song,
  TrackBlock,
  TrackDefinition,
} from './types';
import { normaliseWidths } from './types';
import {
  CAMERA_COLORS,
  TRACK_COLORS,
  demoProject,
  newCamera,
  newPlaylist,
  newProject,
  newSong,
  newTrack,
} from './defaults';
import { migrate, STORE_VERSION } from './migrate';
import { clamp, move, today, uid } from './util';

/**
 * Everything except reference images lives in localStorage.
 * localStorage is synchronous, so a reload paints the restored live view on
 * the first frame — no loading state, no flash, no network round-trip.
 */

interface State {
  projects: Project[];
  session: Session;
  display: Display;

  // projects
  createProject: (name: string) => string;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;

  // project-level definitions
  addCamera: (projectId: string) => void;
  updateCamera: (
    projectId: string,
    cameraId: string,
    patch: Partial<CameraDefinition>,
  ) => void;
  removeCamera: (projectId: string, cameraId: string) => void;

  addTrack: (projectId: string) => void;
  updateTrack: (
    projectId: string,
    trackId: string,
    patch: Partial<TrackDefinition>,
  ) => void;
  removeTrack: (projectId: string, trackId: string) => void;
  rememberPreset: (projectId: string, trackId: string, block: TrackBlock) => void;

  // bucket
  addSong: (projectId: string, title?: string) => string;
  updateSong: (projectId: string, songId: string, patch: Partial<Song>) => void;
  deleteSong: (projectId: string, songId: string) => void;

  // pins
  addPin: (projectId: string, songId: string, cardType: CardType) => void;
  updatePin: (
    projectId: string,
    songId: string,
    pinId: string,
    patch: Partial<MilestonePin>,
  ) => void;
  removePin: (projectId: string, songId: string, pinId: string) => void;

  // track data
  addTrackBlock: (projectId: string, songId: string, trackId: string) => void;
  updateTrackBlock: (
    projectId: string,
    songId: string,
    trackId: string,
    blockId: string,
    patch: Partial<TrackBlock>,
  ) => void;
  removeTrackBlock: (
    projectId: string,
    songId: string,
    trackId: string,
    blockId: string,
  ) => void;
  /** Move the divider between block i and i+1. `ratio` is 0–1 of their pair. */
  resizeTrackBlocks: (
    projectId: string,
    songId: string,
    trackId: string,
    index: number,
    ratio: number,
  ) => void;

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

function withProject(
  projects: Project[],
  id: string,
  fn: (p: Project) => Project,
): Project[] {
  return projects.map((p) => (p.id === id ? fn(p) : p));
}

function withSong(p: Project, songId: string, fn: (s: Song) => Song): Project {
  return {
    ...p,
    bucket: p.bucket.map((s) =>
      s.id === songId ? { ...fn(s), updatedAt: Date.now() } : s,
    ),
  };
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

function withTrackData(
  s: Song,
  trackId: string,
  fn: (blocks: TrackBlock[]) => TrackBlock[],
): Song {
  const next = normaliseWidths(fn(s.tracksData[trackId] ?? []));
  return { ...s, tracksData: { ...s.tracksData, [trackId]: next } };
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

      /* ---- project-level definitions ---- */

      addCamera: (projectId) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            cameras: [...p.cameras, newCamera(p.cameras.length)],
          })),
        })),

      updateCamera: (projectId, cameraId, patch) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            cameras: p.cameras.map((c) =>
              c.id === cameraId ? { ...c, ...patch } : c,
            ),
          })),
        })),

      removeCamera: (projectId, cameraId) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            cameras: p.cameras.filter((c) => c.id !== cameraId),
            // A deleted camera stops being referenced by any card.
            bucket: p.bucket.map((song) => ({
              ...song,
              pins: song.pins.map((pin) => {
                const d = { ...pin.cardData };
                if (d.shots) {
                  const { [cameraId]: _gone, ...rest } = d.shots;
                  d.shots = rest;
                }
                if (d.camera === cameraId) d.camera = undefined;
                return { ...pin, cardData: d };
              }),
              repositionAfter: song.repositionAfter && {
                ...song.repositionAfter,
                cameras: song.repositionAfter.cameras.filter(
                  (c) => c !== cameraId,
                ),
              },
            })),
          })),
        })),

      addTrack: (projectId) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            tracks: [...p.tracks, newTrack(`Screen ${p.tracks.length + 1}`)],
          })),
        })),

      updateTrack: (projectId, trackId, patch) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            tracks: p.tracks.map((t) =>
              t.id === trackId ? { ...t, ...patch } : t,
            ),
          })),
        })),

      removeTrack: (projectId, trackId) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            tracks: p.tracks.filter((t) => t.id !== trackId),
            bucket: p.bucket.map((song) => {
              const { [trackId]: _gone, ...rest } = song.tracksData;
              return { ...song, tracksData: rest };
            }),
          })),
        })),

      /** Keep a block the operator built as a suggestion for this track. */
      rememberPreset: (projectId, trackId, b) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            tracks: p.tracks.map((t) => {
              if (t.id !== trackId) return t;
              const label = b.label.trim();
              if (!label || t.recommendedBlocks.some((r) => r.label === label)) {
                return t;
              }
              return {
                ...t,
                recommendedBlocks: [
                  ...t.recommendedBlocks,
                  {
                    id: uid(),
                    label,
                    color: b.color,
                    aspectRatio: b.aspectRatio,
                  },
                ],
              };
            }),
          })),
        })),

      /* ---- bucket ---- */

      addSong: (projectId, title = '') => {
        const song = newSong(title);
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            bucket: [...p.bucket, song],
          })),
        }));
        return song.id;
      },

      updateSong: (projectId, songId, patch) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withSong(p, songId, (song) => ({ ...song, ...patch })),
          ),
        })),

      deleteSong: (projectId, songId) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            bucket: p.bucket.filter((song) => song.id !== songId),
            // A deleted bucket song disappears from every playlist using it.
            playlists: p.playlists.map((pl) => ({
              ...pl,
              songIds: pl.songIds.filter((id) => id !== songId),
            })),
          })),
        })),

      /* ---- pins ---- */

      addPin: (projectId, songId, cardType) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withSong(p, songId, (song) => ({
              ...song,
              pins: [
                ...song.pins,
                {
                  id: uid('pin_'),
                  positionPercent: 50,
                  cardType,
                  cardData:
                    cardType === 'first_shots' ? { shots: {} } : { text: '' },
                },
              ],
            })),
          ),
        })),

      updatePin: (projectId, songId, pinId, patch) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withSong(p, songId, (song) => ({
              ...song,
              pins: song.pins.map((pin) =>
                pin.id === pinId
                  ? {
                      ...pin,
                      ...patch,
                      positionPercent:
                        patch.positionPercent === undefined
                          ? pin.positionPercent
                          : clamp(patch.positionPercent, 0, 100),
                    }
                  : pin,
              ),
            })),
          ),
        })),

      removePin: (projectId, songId, pinId) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withSong(p, songId, (song) => ({
              ...song,
              pins: song.pins.filter((pin) => pin.id !== pinId),
            })),
          ),
        })),

      /* ---- track data ---- */

      /**
       * Adding a block splits the track: the new block takes half of the last
       * one, so widths still sum to 100 without the operator doing sums.
       */
      addTrackBlock: (projectId, songId, trackId) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withSong(p, songId, (song) =>
              withTrackData(song, trackId, (blocks) => {
                const fresh: TrackBlock = {
                  id: uid('b_'),
                  label: '',
                  color: TRACK_COLORS[blocks.length % TRACK_COLORS.length],
                  widthPercent: 0,
                };
                if (blocks.length === 0) {
                  return [{ ...fresh, widthPercent: 100 }];
                }
                const last = blocks[blocks.length - 1];
                const half = last.widthPercent / 2;
                return [
                  ...blocks.slice(0, -1),
                  { ...last, widthPercent: half },
                  { ...fresh, widthPercent: half },
                ];
              }),
            ),
          ),
        })),

      updateTrackBlock: (projectId, songId, trackId, blockId, patch) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withSong(p, songId, (song) =>
              withTrackData(song, trackId, (blocks) =>
                blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
              ),
            ),
          ),
        })),

      removeTrackBlock: (projectId, songId, trackId, blockId) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withSong(p, songId, (song) =>
              withTrackData(song, trackId, (blocks) =>
                blocks.filter((b) => b.id !== blockId),
              ),
            ),
          ),
        })),

      /**
       * Drag a divider. Only the two blocks either side move, so the rest of
       * the track holds still and the total stays at 100.
       */
      resizeTrackBlocks: (projectId, songId, trackId, index, ratio) =>
        set((s) => ({
          projects: withProject(s.projects, projectId, (p) =>
            withSong(p, songId, (song) =>
              withTrackData(song, trackId, (blocks) => {
                const a = blocks[index];
                const b = blocks[index + 1];
                if (!a || !b) return blocks;
                const pair = a.widthPercent + b.widthPercent;
                // Never let a block collapse to nothing — it would be
                // unclickable and unreadable.
                const min = Math.min(2, pair / 2);
                const aw = clamp(pair * ratio, min, pair - min);
                return blocks.map((blk, i) =>
                  i === index
                    ? { ...blk, widthPercent: aw }
                    : i === index + 1
                      ? { ...blk, widthPercent: pair - aw }
                      : blk,
                );
              }),
            ),
          ),
        })),

      /* ---- playlists ---- */

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
          // songIds are references into the bucket — this copies references,
          // never content, so both playlists stay in sync with the song.
          songIds: [...src.songIds],
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

      /* ---- session ---- */

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

      exitLive: () => set((s) => ({ session: { ...s.session, live: false } })),

      setProjectId: (id) =>
        set((s) => ({ session: { ...s.session, projectId: id } })),

      /**
       * Forward. A song flagged with `repositionAfter` puts its full-page
       * card in the way first — you cannot reach the next song without
       * passing through it.
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

      /** Backward, symmetric: you pass back through the same card. */
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

/* -------------------------------------------------------------------------- */

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
  const songs = playlistSongs(project, playlist);
  if (songs.length === 0) return null;
  return { project, playlist, songs };
}

/** A playlist pointing at a deleted song must degrade, never crash. */
export function playlistSongs(project: Project, playlist: Playlist): Song[] {
  return playlist.songIds
    .map((id) => project.bucket.find((s) => s.id === id))
    .filter((s): s is Song => Boolean(s));
}

export function songIsEmpty(song: Song): boolean {
  return (
    song.pins.length === 0 &&
    Object.values(song.tracksData).every((b) => b.length === 0) &&
    !song.repositionAfter
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Runs once, straight after hydration. localStorage is synchronous, so this
 * completes before the first render — the app never paints a wrong state and
 * then corrects itself.
 */
function bootstrap() {
  const s = useStore.getState();
  if (s.projects.length === 0) {
    useStore.setState({ projects: [demoProject()] });
  }

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

export { CAMERA_COLORS, TRACK_COLORS };
