/**
 * CueCard data model.
 *
 * Project ─┬─ cameras   master camera list; each owns one badge colour
 *          ├─ tracks    screen definitions, identical on every song
 *          ├─ bucket    every song ever built for this artist
 *          └─ playlists ordered *references* into the bucket
 *
 * A playlist never copies song content, so editing a bucket song updates it
 * everywhere it is used, and duplicating a playlist is non-destructive.
 *
 * A song is a timeline read left to right: milestone pins along the song,
 * each carrying a cue card, and screen tracks underneath. There is no clock —
 * every position is a percentage of the song, which is exactly as precise as
 * the operator's own sense of the music.
 */

export interface CameraDefinition {
  id: string; // "C01"
  label: string;
  /** Reserved for this camera everywhere it appears. Never reused. */
  badgeColor: string;
}

export interface TrackBlockPreset {
  id: string;
  label: string;
  /** From the project's track colour system — never a camera colour. */
  color: string;
  aspectRatio?: AspectRatio;
}

export type AspectRatio = '16:9' | '4:3' | '2.35:1' | 'full' | 'black';

export const ASPECT_RATIOS: AspectRatio[] = [
  '16:9',
  '4:3',
  '2.35:1',
  'full',
  'black',
];

export interface TrackDefinition {
  id: string;
  name: string; // "Center Screen", "Side IMAG"
  /** Offered by the prep-view autocomplete for this track. */
  recommendedBlocks: TrackBlockPreset[];
}

export interface TrackBlock {
  id: string;
  /** Every block in a track sums to 100. */
  widthPercent: number;
  label: string;
  color: string;
  aspectRatio?: AspectRatio;
  text?: string;
}

/**
 * The four kinds of cue card.
 *
 * Reposition is its own type rather than a Note: missing one is a real
 * production problem, so it must be impossible to confuse with general text.
 */
export type CardType = 'first_shots' | 'specific_shot' | 'reposition' | 'note';

/**
 * Fixed vertical lanes, top to bottom.
 *
 * A card's horizontal position follows the song's own structure and therefore
 * changes song to song. Its lane does not: the operator always knows which
 * band to check for a given kind of information. First shots lead because
 * they are read before the song starts; reposition sits directly beneath
 * because it is the highest-stakes thing that can happen mid-song.
 */
export const CARD_LANES: CardType[] = [
  'first_shots',
  'reposition',
  'specific_shot',
  'note',
];

export const CARD_LABELS: Record<CardType, string> = {
  first_shots: 'First shots',
  reposition: 'Reposition',
  specific_shot: 'Shot',
  note: 'Note',
};

export interface CardData {
  title?: string;
  /** first_shots: camera id -> short description. Blank = unused camera. */
  shots?: Record<string, string>;
  /** specific_shot / reposition */
  camera?: string;
  /** reposition (during-song) */
  destination?: string;
  /** note */
  text?: string;
}

export interface MilestonePin {
  id: string;
  /** Anchor along the song, 0–100. There is no timecode to use instead. */
  positionPercent: number;
  cardType: CardType;
  cardData: CardData;
}

export interface Song {
  id: string;
  title: string;
  pins: MilestonePin[];
  /** Keyed by TrackDefinition.id. Each array's widthPercent sums to 100. */
  tracksData: Record<string, TrackBlock[]>;
  /**
   * Renders as a full-page interstitial after this song, outside the
   * pins/cards/tracks layout entirely.
   */
  repositionAfter?: {
    cameras: string[];
    destination: string;
  };
  /** Reference image lives in IndexedDB under this song id. Prep only. */
  hasImage: boolean;
  updatedAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  /** ISO yyyy-mm-dd. */
  date: string;
  songIds: string[];
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  cameras: CameraDefinition[];
  tracks: TrackDefinition[];
  bucket: Song[];
  playlists: Playlist[];
  createdAt: number;
}

/** Where the operator is right now. Persisted, restored verbatim on reload. */
export interface Session {
  projectId: string | null;
  playlistId: string | null;
  index: number;
  /** True when parked on the after-song reposition interstitial. */
  interstitial: boolean;
  live: boolean;
}

/** In-app screen adjustment, independent of the device's own brightness. */
export interface Display {
  brightness: number;
  contrast: number;
}

/* -------------------------------------------------------------------------- */

export function cameraById(
  project: Project,
  id: string | undefined,
): CameraDefinition | undefined {
  return id ? project.cameras.find((c) => c.id === id) : undefined;
}

/** Blocks for a track on a song — an empty track still renders its row. */
export function trackBlocks(song: Song, trackId: string): TrackBlock[] {
  return song.tracksData[trackId] ?? [];
}

/** Pins in a lane, left to right. */
export function pinsInLane(song: Song, lane: CardType): MilestonePin[] {
  return song.pins
    .filter((p) => p.cardType === lane)
    .sort((a, b) => a.positionPercent - b.positionPercent);
}

/** Normalise a track's blocks so they sum to exactly 100. */
export function normaliseWidths(blocks: TrackBlock[]): TrackBlock[] {
  if (blocks.length === 0) return blocks;
  const total = blocks.reduce((s, b) => s + b.widthPercent, 0);
  if (total <= 0) {
    const even = 100 / blocks.length;
    return blocks.map((b) => ({ ...b, widthPercent: even }));
  }
  return blocks.map((b) => ({
    ...b,
    widthPercent: (b.widthPercent / total) * 100,
  }));
}
