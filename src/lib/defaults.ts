import type { BlockRow, GridCell, Playlist, Project, Song, SongBlocks } from './types';
import { uid, today } from './util';

/**
 * The template a new playlist starts from: the blocks most shows need, in
 * scan order. Everything else in the library is one click away in the editor.
 * Grid is 16 x 12.
 */
export const DEFAULT_LAYOUT: GridCell[] = [
  // The reposition band leads, where the fixed strip used to sit. It can be
  // moved and resized from here, but never removed.
  { block: 'reposition', x: 0, y: 0, w: 16, h: 2 },
  { block: 'presets', x: 0, y: 2, w: 8, h: 5 },
  { block: 'firstShots', x: 8, y: 2, w: 8, h: 5 },
  { block: 'camScreen', x: 0, y: 7, w: 8, h: 3 },
  { block: 'instruments', x: 8, y: 7, w: 8, h: 3 },
  { block: 'intro', x: 0, y: 10, w: 8, h: 2 },
  { block: 'ending', x: 8, y: 10, w: 8, h: 2 },
];

export function emptyBlocks(): SongBlocks {
  return {
    presets: [],
    firstShots: [],
    camScreen: [],
    instruments: [],
    solos: [],
    hits: [],
    intro: '',
    ending: '',
    energy: '',
    avoid: '',
    note: '',
  };
}

export function newSong(title = ''): Song {
  return {
    id: uid('s_'),
    title,
    blocks: emptyBlocks(),
    repositionDuring: '',
    repositionAfter: '',
    hasImage: false,
    updatedAt: Date.now(),
  };
}

export function newPlaylist(name: string): Playlist {
  return {
    id: uid('pl_'),
    name: name.trim() || 'Untitled show',
    date: today(),
    songIds: [],
    layout: DEFAULT_LAYOUT.map((c) => ({ ...c })),
    overrides: {},
    createdAt: Date.now(),
  };
}

export function newProject(name: string): Project {
  return {
    id: uid('p_'),
    name,
    songs: [],
    playlists: [],
    createdAt: Date.now(),
  };
}

function row(a: string, b: string, c = ''): BlockRow {
  return { id: uid(), a, b, c };
}

/**
 * A small worked example so a new install shows the shape of the thing
 * instead of an empty screen. Deletable like any other project.
 */
export function demoProject(): Project {
  const p = newProject('Demo — The Wire');

  const song1 = newSong('Coastline');
  song1.blocks.presets = [row('1', 'P2', 'wide'), row('2', 'P1'), row('4', 'P7', 'lock')];
  song1.blocks.firstShots = [
    row('1', 'WIDE STAGE'),
    row('2', 'MCU VOX'),
    row('3', 'CU HANDS KEYS'),
    row('4', 'CRANE HIGH'),
  ];
  song1.blocks.camScreen = [row('1', 'LED L'), row('2', 'CENTRE'), row('4', 'LED R')];
  song1.blocks.instruments = ['VOX', 'KEYS L'];
  song1.blocks.intro = 'Cold open, keys only';
  song1.blocks.ending = 'Hard stop on the downbeat';
  song1.blocks.avoid = 'No cuts in verse 1';

  const song2 = newSong('Halogen');
  song2.blocks.presets = [row('1', 'P4'), row('3', 'P2', 'tight')];
  song2.blocks.firstShots = [row('1', 'MS BAND'), row('2', 'CU VOX'), row('3', 'MS GTR SL')];
  song2.blocks.instruments = ['SOLO GTR', 'DRUMS'];
  song2.blocks.solos = ['GTR 2', 'KEYS'];
  song2.blocks.hits = ['2x STAB PRE-CH', 'STOP @ BRIDGE'];
  song2.blocks.energy = 'Slow build → drop';
  song2.blocks.ending = 'Fades out, hold wide';
  song2.repositionDuring = 'CAM 3 → downstage right, after 2nd chorus';

  const song3 = newSong('Ten Thousand Rooms');
  song3.blocks.presets = [row('2', 'P6'), row('4', 'P3')];
  song3.blocks.firstShots = [row('1', 'WIDE'), row('2', 'CU VOX'), row('4', 'JIB SWEEP')];
  song3.blocks.camScreen = [row('2', 'ALL')];
  song3.blocks.instruments = ['VOX', 'STRINGS'];
  song3.blocks.intro = 'Strings pad, 8 bars';
  song3.blocks.ending = 'Ritardando, long hold';
  song3.repositionAfter = 'CAM 3 + CAM 4 → pit, both handheld. Confirm on comms.';

  const song4 = newSong('Static Bloom');
  song4.blocks.firstShots = [row('1', 'WIDE'), row('3', 'HH PIT LOW'), row('4', 'HH PIT ROAM')];
  song4.blocks.instruments = ['CROWD', 'VOX'];
  song4.blocks.hits = ['DROP @ 2:10'];
  song4.blocks.energy = 'Flat out from bar 1';
  song4.blocks.note = 'Crowd shots on the drop';
  song4.blocks.ending = 'Cuts dead — be on wide';

  p.songs = [song1, song2, song3, song4];

  const show = newPlaylist('Show A');
  show.songIds = p.songs.map((s) => s.id);
  // Halogen carries more content than the default template holds comfortably,
  // so it ships with an override — the feature, demonstrated.
  show.overrides[song2.id] = [
    { block: 'reposition', x: 0, y: 0, w: 16, h: 2 },
    { block: 'presets', x: 0, y: 2, w: 6, h: 4 },
    { block: 'firstShots', x: 6, y: 2, w: 10, h: 4 },
    { block: 'solos', x: 0, y: 6, w: 6, h: 3 },
    { block: 'hits', x: 6, y: 6, w: 10, h: 3 },
    { block: 'instruments', x: 0, y: 9, w: 6, h: 3 },
    { block: 'energy', x: 6, y: 9, w: 5, h: 3 },
    { block: 'ending', x: 11, y: 9, w: 5, h: 3 },
  ];
  p.playlists = [show];

  return p;
}
