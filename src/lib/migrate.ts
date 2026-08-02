import type {
  CameraDefinition,
  MilestonePin,
  Project,
  Song,
  TrackBlock,
  TrackDefinition,
} from './types';
import { normaliseWidths } from './types';
import { CAMERA_COLORS, TRACK_COLORS, BLACK_COLOR, newTrack } from './defaults';
import { uid } from './util';

/**
 * Persisted-state migrations.
 *
 * This data sits on a working device between shows, so a schema change has to
 * convert it, never reset it — losing a show's prep to an app update is the
 * worst failure this app has. Steps are cumulative: `migrate` runs every step
 * above the stored version, and each must survive partially-shaped data.
 *
 * Everything before v5 described a fixed grid of content blocks. v5 replaces
 * that with a timeline of pins and screen tracks. The two models do not line
 * up field for field, so the rule for this step is: **nothing is discarded**.
 * What maps structurally is mapped; what does not becomes a Note pin, which
 * is exactly what a note is for.
 */

export const STORE_VERSION = 5;

type Legacy = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const arr = (v: unknown): Legacy[] => (Array.isArray(v) ? (v as Legacy[]) : []);

/** Cameras seen anywhere in the old data, so the master list isn't invented. */
function collectCameras(songs: Legacy[]): CameraDefinition[] {
  const seen = new Set<number>();
  for (const s of songs) {
    const b = (s.blocks ?? {}) as Legacy;
    for (const key of ['presets', 'firstShots']) {
      for (const r of arr(b[key])) {
        const n = parseInt(str(r.a), 10);
        if (Number.isFinite(n) && n > 0) seen.add(n);
      }
    }
    for (const row of arr(b.camScreen)) {
      for (const sg of arr(row.segments)) {
        const n = parseInt(str(sg.source), 10);
        if (Number.isFinite(n) && n > 0) seen.add(n);
      }
    }
  }
  const nums = [...seen].sort((a, b) => a - b);
  // Always leave a usable list, even for a project that never named a camera.
  const list = nums.length > 0 ? nums : [1, 2, 3, 4];
  return list.map((n) => ({
    id: `C${String(n).padStart(2, '0')}`,
    label: `Cam ${n}`,
    badgeColor: CAMERA_COLORS[(n - 1) % CAMERA_COLORS.length],
  }));
}

const camId = (raw: string): string | undefined => {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? `C${String(n).padStart(2, '0')}` : undefined;
};

/**
 * Screens were already timelines in v4 (a screen plus ordered segments), so
 * they become tracks almost directly: each distinct screen name is a track,
 * and its segments become blocks with widths from their spans.
 */
function collectTracks(songs: Legacy[]): TrackDefinition[] {
  const names: string[] = [];
  for (const s of songs) {
    const b = (s.blocks ?? {}) as Legacy;
    for (const row of arr(b.camScreen)) {
      const name = str(row.screen).trim();
      if (name && !names.includes(name)) names.push(name);
    }
  }
  if (names.length === 0) return [newTrack('Center Screen')];
  return names.map((name) => ({ ...newTrack(name), name }));
}

function trackDataFor(song: Legacy, tracks: TrackDefinition[]) {
  const b = (song.blocks ?? {}) as Legacy;
  const data: Record<string, TrackBlock[]> = {};

  for (const row of arr(b.camScreen)) {
    const track = tracks.find((t) => t.name === str(row.screen).trim());
    if (!track) continue;
    const segs = arr(row.segments);
    if (segs.length === 0) continue;
    const total = segs.reduce(
      (sum, sg) => sum + Math.max(1, Number(sg.span) || 1),
      0,
    );
    data[track.id] = normaliseWidths(
      segs.map((sg) => {
        const source = str(sg.source).trim();
        const isCam = Number.isFinite(parseInt(source, 10));
        return {
          id: uid('b_'),
          widthPercent: ((Math.max(1, Number(sg.span) || 1) / total) * 100),
          label: source || 'Black',
          // Camera hues belong to cameras; a track block gets a track colour.
          color: source ? TRACK_COLORS[0] : BLACK_COLOR,
          aspectRatio: source ? undefined : ('black' as const),
          text: isCam ? `Camera ${parseInt(source, 10)}` : source || undefined,
        };
      }),
    );
  }
  return data;
}

/** Everything the timeline has no structural home for, kept as notes. */
function leftoverNotes(b: Legacy): string[] {
  const out: string[] = [];

  const presets = arr(b.presets)
    .map((r) => [str(r.a), str(r.b), str(r.c)].filter(Boolean).join(' '))
    .filter(Boolean);
  if (presets.length) out.push(`Presets — ${presets.join(', ')}`);

  for (const [key, label] of [
    ['instruments', 'Watch'],
    ['solos', 'Solos'],
    ['hits', 'Hits'],
  ] as const) {
    const tags = Array.isArray(b[key]) ? (b[key] as string[]) : [];
    if (tags.length) out.push(`${label} — ${tags.join(', ')}`);
  }
  for (const [key, label] of [
    ['intro', 'Intro'],
    ['ending', 'Ending'],
    ['energy', 'Energy'],
    ['avoid', 'Avoid'],
    ['note', 'Note'],
  ] as const) {
    const v = str(b[key]).trim();
    if (v) out.push(label === 'Note' ? v : `${label} — ${v}`);
  }
  return out;
}

function songToTimeline(song: Legacy, tracks: TrackDefinition[]): Song {
  const b = (song.blocks ?? {}) as Legacy;
  const pins: MilestonePin[] = [];

  // First shots open the song, so they anchor at the start.
  const shots: Record<string, string> = {};
  for (const r of arr(b.firstShots)) {
    const id = camId(str(r.a));
    if (id) shots[id] = str(r.b);
  }
  if (Object.keys(shots).length > 0) {
    pins.push({
      id: uid('pin_'),
      positionPercent: 0,
      cardType: 'first_shots',
      cardData: { shots },
    });
  }

  // A during-song move keeps its own card type — it must never become a note.
  const during = str(song.repositionDuring).trim();
  if (during) {
    pins.push({
      id: uid('pin_'),
      positionPercent: 45,
      cardType: 'reposition',
      cardData: { destination: during },
    });
  }

  // Everything else is spread across the song so the notes don't stack.
  const notes = leftoverNotes(b);
  notes.forEach((text, i) => {
    pins.push({
      id: uid('pin_'),
      // Spread, and clear of the reposition pin, so nothing stacks.
      positionPercent: notes.length === 1 ? 60 : 15 + (70 * i) / (notes.length - 1),
      cardType: 'note',
      cardData: { text },
    });
  });

  const after = str(song.repositionAfter).trim();

  return {
    id: str(song.id) || uid('s_'),
    title: str(song.title),
    pins,
    tracksData: trackDataFor(song, tracks),
    repositionAfter: after ? { cameras: [], destination: after } : undefined,
    hasImage: Boolean(song.hasImage),
    updatedAt: Number(song.updatedAt) || Date.now(),
  };
}

/** Anything before v5 shared the same block shape closely enough to convert. */
function toTimelineModel(projects: unknown): Project[] {
  if (!Array.isArray(projects)) return [];

  return (projects as Legacy[]).map((p) => {
    const songs = arr(p.songs ?? p.bucket);
    const cameras = collectCameras(songs);
    const tracks = collectTracks(songs);

    return {
      id: str(p.id) || uid('p_'),
      name: str(p.name) || 'Untitled',
      cameras,
      tracks,
      bucket: songs.map((s) => songToTimeline(s, tracks)),
      playlists: arr(p.playlists).map((pl) => ({
        id: str(pl.id) || uid('pl_'),
        name: str(pl.name) || 'Untitled show',
        date: str(pl.date),
        songIds: Array.isArray(pl.songIds) ? (pl.songIds as string[]) : [],
        createdAt: Number(pl.createdAt) || Date.now(),
      })),
      createdAt: Number(p.createdAt) || Date.now(),
    };
  });
}

export function migrate(persisted: unknown, version: number): unknown {
  const state = (persisted ?? {}) as Legacy;
  if (version >= STORE_VERSION) return state;
  // Every pre-v5 shape converts through the same step: the intermediate
  // versions only ever moved blocks around inside a model v5 replaces.
  return { ...state, projects: toTimelineModel(state.projects) };
}
