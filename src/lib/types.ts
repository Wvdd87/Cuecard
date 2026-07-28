/**
 * Cuecard data model.
 *
 * Project ─┬─ songs: Song[]         the bucket — every song for this artist
 *          └─ playlists: Playlist[] ordered *references* into the bucket,
 *                                   each owning its own live-view template
 *
 * A playlist never copies song content, so editing a song in the bucket
 * updates it in every playlist that uses it.
 */

/**
 * The block library.
 *
 * Blocks are deliberately small and specific rather than a few big catch-all
 * regions — the editor exists so the operator can say exactly what goes where
 * and how much room it gets. "Notes" in particular is split into the distinct
 * things a director actually needs at a glance, because "the note block" would
 * otherwise become a paragraph nobody can read in half a second.
 */
export type BlockType =
  // Cameras
  | 'presets'
  | 'firstShots'
  | 'camScreen'
  // Watch
  | 'instruments'
  | 'solos'
  | 'hits'
  // Structure — what used to be one "note" block
  | 'intro'
  | 'ending'
  | 'energy'
  | 'avoid'
  | 'note';

/** How a block stores and renders its content. */
export type BlockKind = 'rows' | 'tags' | 'line' | 'screens';

export type BlockGroup = 'Cameras' | 'Watch' | 'Structure';

export interface BlockSpec {
  /** Shown live. Short — it is a signpost, not a sentence. */
  label: string;
  /** Prep-view only. Never shown live. */
  hint: string;
  kind: BlockKind;
  group: BlockGroup;
  /** `rows` blocks only: which of a/b/c are used, and how they are labelled. */
  cols?: { key: 'a' | 'b' | 'c'; placeholder: string; width?: number }[];
  /** `line` blocks only. Keeps entries glanceable. */
  maxLen?: number;
}

export const BLOCKS: Record<BlockType, BlockSpec> = {
  presets: {
    label: 'Presets',
    hint: 'Short codes only — "1 / P4", not sentences.',
    kind: 'rows',
    group: 'Cameras',
    cols: [
      { key: 'a', placeholder: 'CAM', width: 70 },
      { key: 'b', placeholder: 'PRESET', width: 110 },
      { key: 'c', placeholder: 'note (optional, shown small)' },
    ],
  },
  firstShots: {
    label: 'First shots',
    hint: 'The shot each camera opens the song on.',
    kind: 'rows',
    group: 'Cameras',
    cols: [
      { key: 'a', placeholder: 'CAM', width: 70 },
      { key: 'b', placeholder: 'OPENING SHOT' },
    ],
  },
  camScreen: {
    label: 'Screens',
    hint: 'What feeds each screen, and when it changes. A camera number, or a switcher bus like PGM or ME1.',
    kind: 'screens',
    group: 'Cameras',
  },

  instruments: {
    label: 'Watch',
    hint: 'Instruments and positions to stay on. SOLO GTR, KEYS L, HORNS.',
    kind: 'tags',
    group: 'Watch',
  },
  solos: {
    label: 'Solos',
    hint: 'Who takes one, in order. GTR 2, SAX, DRUMS.',
    kind: 'tags',
    group: 'Watch',
  },
  hits: {
    label: 'Hits',
    hint: 'Stops, stabs and drops to catch. Short codes.',
    kind: 'tags',
    group: 'Watch',
  },

  intro: {
    label: 'Intro',
    hint: 'How it starts. "Cold, drums only."',
    kind: 'line',
    group: 'Structure',
    maxLen: 48,
  },
  ending: {
    label: 'Ending',
    hint: 'How it ends — the thing you need before it arrives.',
    kind: 'line',
    group: 'Structure',
    maxLen: 48,
  },
  energy: {
    label: 'Energy',
    hint: 'The arc, in a few words. "Slow build → drop."',
    kind: 'line',
    group: 'Structure',
    maxLen: 40,
  },
  avoid: {
    label: 'Avoid',
    hint: 'What not to do. "No crowd", "no cuts in verse 1".',
    kind: 'line',
    group: 'Structure',
    maxLen: 44,
  },
  note: {
    label: 'Note',
    hint: 'Anything the specific blocks above do not cover.',
    kind: 'line',
    group: 'Structure',
    maxLen: 56,
  },
};

export const BLOCK_TYPES = Object.keys(BLOCKS) as BlockType[];

export const BLOCK_GROUPS: BlockGroup[] = ['Cameras', 'Watch', 'Structure'];

export function blocksInGroup(group: BlockGroup): BlockType[] {
  return BLOCK_TYPES.filter((t) => BLOCKS[t].group === group);
}

/**
 * One row of a `rows` block. Columns are positional (a/b/c) and named by the
 * block's spec, so a new row-shaped block needs no new type.
 */
export interface BlockRow {
  id: string;
  a: string;
  b: string;
  c: string;
}

/**
 * One stretch of a song during which a screen shows a single source.
 *
 * There is no timecode to place these against, so a segment carries an
 * ordering and a relative weight, never a time. Equal weights read as "this,
 * then this, then this" — which is exactly as precise as the operator's own
 * knowledge of the song.
 */
export interface ScreenSegment {
  id: string;
  /** A camera number ("4") or a switcher bus ("PGM", "ME1"). */
  source: string;
  /** Relative width. 1 unless the operator wants to weight a stretch. */
  span: number;
}

/** A screen and what feeds it across the song. */
export interface ScreenRow {
  id: string;
  screen: string;
  segments: ScreenSegment[];
}

export interface SongBlocks {
  presets: BlockRow[];
  firstShots: BlockRow[];
  /** Screens are timelines, not rows — see ScreenRow. */
  camScreen: ScreenRow[];
  instruments: string[];
  solos: string[];
  hits: string[];
  intro: string;
  ending: string;
  energy: string;
  avoid: string;
  note: string;
}

export interface Song {
  id: string;
  title: string;
  blocks: SongBlocks;
  /**
   * Camera repositioning. Not a block — a property of the transition.
   * `during`: shown in the song's own live view, in the reposition cell — a
   *           placeable region that every layout is guaranteed to contain.
   * `after`:  renders as a full-page interstitial before the next song.
   * Empty string means none. A song may have both.
   */
  repositionDuring: string;
  repositionAfter: string;
  /** Reference image lives in IndexedDB under this song id. Prep view only. */
  hasImage: boolean;
  updatedAt: number;
}

/**
 * The during-song reposition band.
 *
 * It is still not a block — it has no entry in BLOCKS, no editor of its own,
 * and no content you can type into it; it renders the song's
 * `repositionDuring`, which is a property of the transition. What changed is
 * that it is *placeable*: the operator positions and sizes it in the grid
 * like everything else.
 *
 * It may be moved and resized but never removed. A during-song move has to be
 * visible for the whole song, so `ensureReposition` puts the cell back on
 * every write and the editor's palette entry for it is locked.
 */
export const REPOSITION = 'reposition';
export type RepositionKey = typeof REPOSITION;

/** Anything that can occupy a cell: a content block, or the reposition band. */
export type CellKey = BlockType | RepositionKey;

export function isReposition(key: CellKey): key is RepositionKey {
  return key === REPOSITION;
}

/** Live label for any cell. */
export function cellLabel(key: CellKey): string {
  return isReposition(key) ? 'Move' : BLOCKS[key].label;
}

/** A cell's position in the configurable central grid. Units = grid cells. */
export interface GridCell {
  block: CellKey;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Default geometry for the band: full width, two rows, at the top. */
export function repositionCell(): GridCell {
  return { block: REPOSITION, x: 0, y: 0, w: GRID_COLS, h: 2 };
}

/**
 * The guarantee, enforced at every write: a layout always contains the
 * reposition cell. If one is somehow missing it is put back at the top —
 * overlapping a block if it must, because a move the operator cannot see is
 * worse than a block drawn over.
 */
export function ensureReposition(layout: GridCell[]): GridCell[] {
  return layout.some((c) => isReposition(c.block))
    ? layout
    : [repositionCell(), ...layout];
}

export interface Playlist {
  id: string;
  name: string;
  /** ISO yyyy-mm-dd. Free-form date of the show. */
  date: string;
  songIds: string[];
  /**
   * The playlist's default live-view template. Every song in the playlist
   * uses this unless it has an override — that is what keeps the live view
   * consistent from song to song within one show.
   */
  layout: GridCell[];
  /**
   * songId -> layout, for songs whose content does not fit the default.
   * Scoped to the playlist because the same bucket song may sit in another
   * playlist built on a completely different default template.
   */
  overrides: Record<string, GridCell[]>;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  songs: Song[];
  playlists: Playlist[];
  createdAt: number;
}

/**
 * Grid resolution. Fine enough that small, specific blocks can be placed
 * precisely rather than snapped into a handful of big zones.
 */
export const GRID_COLS = 16;
export const GRID_ROWS = 12;

/** Where the operator is right now. Persisted, restored verbatim on reload. */
export interface Session {
  projectId: string | null;
  playlistId: string | null;
  index: number;
  /** True when parked on the "after this song, reposition" interstitial. */
  interstitial: boolean;
  live: boolean;
}

/** In-app screen adjustment, independent of the device's own brightness. */
export interface Display {
  brightness: number;
  contrast: number;
}

/** The layout a given song renders with: its override, else the default. */
export function layoutFor(playlist: Playlist, songId: string): GridCell[] {
  return playlist.overrides[songId] ?? playlist.layout;
}

export function hasOverride(playlist: Playlist, songId: string): boolean {
  return Boolean(playlist.overrides[songId]);
}
