import type {
  CameraDefinition,
  MilestonePin,
  Playlist,
  Project,
  Song,
  TrackBlock,
  TrackDefinition,
} from './types';
import { uid, today } from './util';

/**
 * The eight camera hues the design system reserves for cameras. A camera is
 * locked to one of these on creation and keeps it everywhere it appears, so
 * it is recognisable by colour without reading the number.
 */
export const CAMERA_COLORS = [
  'var(--cam1)',
  'var(--cam2)',
  'var(--cam3)',
  'var(--cam4)',
  'var(--cam5)',
  'var(--cam6)',
  'var(--cam7)',
  'var(--cam8)',
];

/** Track content colours — a separate system from cameras. See tracks.css. */
export const TRACK_COLORS = [
  'var(--trk1)',
  'var(--trk2)',
  'var(--trk3)',
  'var(--trk4)',
  'var(--trk5)',
  'var(--trk6)',
  'var(--trk7)',
  'var(--trk8)',
];

export const BLACK_COLOR = 'var(--trk-black)';

export function newCamera(index: number): CameraDefinition {
  const n = index + 1;
  return {
    id: `C${String(n).padStart(2, '0')}`,
    label: `Cam ${n}`,
    badgeColor: CAMERA_COLORS[index % CAMERA_COLORS.length],
  };
}

export function newTrack(name = 'New screen'): TrackDefinition {
  return { id: uid('t_'), name, recommendedBlocks: [] };
}

export function newSong(title = ''): Song {
  return {
    id: uid('s_'),
    title,
    pins: [],
    tracksData: {},
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
    createdAt: Date.now(),
  };
}

export function newProject(name: string): Project {
  return {
    id: uid('p_'),
    name,
    // A show starts with a workable camera list and two screens; both are
    // editable at project level and identical across every song.
    cameras: [0, 1, 2, 3].map(newCamera),
    tracks: [newTrack('Center Screen'), newTrack('Side IMAG')],
    bucket: [],
    playlists: [],
    createdAt: Date.now(),
  };
}

/* -------------------------------------------------------------------------- */

function block(
  label: string,
  color: string,
  widthPercent: number,
  extra: Partial<TrackBlock> = {},
): TrackBlock {
  return { id: uid('b_'), label, color, widthPercent, ...extra };
}

function pin(
  positionPercent: number,
  cardType: MilestonePin['cardType'],
  cardData: MilestonePin['cardData'],
): MilestonePin {
  return { id: uid('pin_'), positionPercent, cardType, cardData };
}

/**
 * A worked example so a new install shows the shape of the thing instead of
 * an empty screen. Deletable like any other project.
 */
export function demoProject(): Project {
  const p = newProject('Demo — The Wire');
  const [center, imag] = p.tracks;

  center.recommendedBlocks = [
    { id: uid(), label: 'IMAG', color: TRACK_COLORS[0], aspectRatio: 'full' },
    { id: uid(), label: 'Content', color: TRACK_COLORS[1], aspectRatio: '16:9' },
    { id: uid(), label: 'Black', color: BLACK_COLOR, aspectRatio: 'black' },
  ];
  imag.recommendedBlocks = [
    { id: uid(), label: 'IMAG', color: TRACK_COLORS[0], aspectRatio: 'full' },
    { id: uid(), label: 'Scenic', color: TRACK_COLORS[2], aspectRatio: '2.35:1' },
  ];

  const s1 = newSong('Coastline');
  s1.pins = [
    pin(0, 'first_shots', {
      shots: {
        C01: 'Wide stage',
        C02: 'MCU vox',
        C03: 'CU hands keys',
        C04: 'Crane high',
      },
    }),
    pin(34, 'specific_shot', { camera: 'C03', text: 'Keys solo — stay wide' }),
    pin(62, 'note', { text: 'No cuts through the bridge' }),
  ];
  s1.tracksData = {
    [center.id]: [
      block('Black', BLACK_COLOR, 12, { aspectRatio: 'black' }),
      block('Content', TRACK_COLORS[1], 48, { aspectRatio: '16:9' }),
      block('IMAG', TRACK_COLORS[0], 40, { aspectRatio: 'full' }),
    ],
    [imag.id]: [block('IMAG', TRACK_COLORS[0], 100, { aspectRatio: 'full' })],
  };

  const s2 = newSong('Halogen');
  s2.pins = [
    pin(0, 'first_shots', {
      shots: { C01: 'MS band', C02: 'CU vox', C03: 'MS gtr SL' },
    }),
    pin(28, 'specific_shot', { camera: 'C02', text: 'Catch the stab' }),
    pin(55, 'reposition', { camera: 'C03', destination: 'Downstage right' }),
    pin(80, 'note', { text: 'Crowd on the drop' }),
  ];
  s2.tracksData = {
    [center.id]: [
      block('IMAG', TRACK_COLORS[0], 55, { aspectRatio: 'full' }),
      block('Content', TRACK_COLORS[1], 45, { aspectRatio: '16:9' }),
    ],
    [imag.id]: [
      block('Scenic', TRACK_COLORS[2], 30, { aspectRatio: '2.35:1' }),
      block('IMAG', TRACK_COLORS[0], 70, { aspectRatio: 'full' }),
    ],
  };

  const s3 = newSong('Ten Thousand Rooms');
  s3.pins = [
    pin(0, 'first_shots', {
      shots: { C01: 'Wide', C02: 'CU vox', C04: 'Jib sweep' },
    }),
    pin(48, 'note', { text: 'Strings enter — hold the wide' }),
  ];
  s3.tracksData = {
    [center.id]: [block('Content', TRACK_COLORS[1], 100, { aspectRatio: '16:9' })],
    [imag.id]: [
      block('IMAG', TRACK_COLORS[0], 60, { aspectRatio: 'full' }),
      block('Black', BLACK_COLOR, 40, { aspectRatio: 'black' }),
    ],
  };
  s3.repositionAfter = {
    cameras: ['C03', 'C04'],
    destination: 'Pit — both handheld. Confirm on comms.',
  };

  const s4 = newSong('Static Bloom');
  s4.pins = [
    pin(0, 'first_shots', {
      shots: { C01: 'Wide', C03: 'HH pit low', C04: 'HH pit roam' },
    }),
    pin(70, 'specific_shot', { camera: 'C04', text: 'Crowd, wide roam' }),
  ];
  s4.tracksData = {
    [center.id]: [block('IMAG', TRACK_COLORS[0], 100, { aspectRatio: 'full' })],
    [imag.id]: [block('IMAG', TRACK_COLORS[0], 100, { aspectRatio: 'full' })],
  };

  p.bucket = [s1, s2, s3, s4];

  const show = newPlaylist('Show A');
  show.songIds = p.bucket.map((s) => s.id);
  p.playlists = [show];

  return p;
}
