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
export type BlockKind = 'rows' | 'tags' | 'line';

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
    label: 'Cam → Screen',
    hint: 'Which camera feeds which screen.',
    kind: 'rows',
    group: 'Cameras',
    cols: [
      { key: 'a', placeholder: 'CAM', width: 70 },
      { key: 'b', placeholder: 'SCREEN' },
    ],
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

export interface SongBlocks {
  presets: BlockRow[];
  firstShots: BlockRow[];
  camScreen: BlockRow[];
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
   * `during`: shown in the song's own live view, in the fixed reposition band.
   * `after`:  renders as a full-page interstitial before the next song.
   * Empty string means none. A song may have both.
   */
  repositionDuring: string;
  repositionAfter: string;
  /** Reference image lives in IndexedDB under this song id. Prep view only. */
  hasImage: boolean;
  updatedAt: number;
}

/** A block's position in the configurable central grid. Units = grid cells. */
export interface GridCell {
  block: BlockType;
  x: number;
  y: number;
  w: number;
  h: number;
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
