import { describe, expect, it } from 'vitest';
import { migrate } from './migrate';
import type { Project } from './types';
import { GRID_COLS, GRID_ROWS } from './types';

/**
 * This data sits on a working device between shows. A schema change has to
 * convert it, never drop it — losing a show's prep to an app update is the
 * worst failure this app has.
 */

/** A v1 project exactly as the previous version persisted it. */
const v1 = {
  projects: [
    {
      id: 'p_1',
      name: 'Old Tour',
      createdAt: 1,
      layout: [
        { block: 'presets', x: 0, y: 0, w: 6, h: 5 },
        { block: 'note', x: 6, y: 7, w: 6, h: 1 },
      ],
      songs: [
        {
          id: 's_1',
          title: 'Opener',
          blocks: {
            presets: [{ id: 'r1', cam: '1', preset: 'P2', note: 'wide' }],
            camScreen: [{ id: 'r2', cam: '2', screen: 'LED L' }],
            firstShots: [{ id: 'r3', cam: '3', shot: 'CU VOX' }],
            instruments: ['VOX'],
            note: 'no cuts in verse 1',
          },
          repositionDuring: '',
          repositionAfter: 'CAM 3 to pit',
          hasImage: false,
          updatedAt: 5,
        },
      ],
      playlists: [
        {
          id: 'pl_1',
          name: 'Night One',
          date: '2026-05-02',
          songIds: ['s_1'],
          createdAt: 2,
        },
        {
          id: 'pl_2',
          name: 'Night Two',
          date: '2026-05-03',
          songIds: ['s_1'],
          createdAt: 3,
        },
      ],
    },
  ],
};

function run(): Project[] {
  const out = migrate(structuredClone(v1), 1) as { projects: Project[] };
  return out.projects;
}

/** A layout's blocks, ignoring the reposition cell every layout now carries. */
function blocksOf(layout: Project['playlists'][number]['layout']) {
  return layout.filter((c) => c.block !== 'reposition').map((c) => c.block);
}

describe('v1 -> v2 migration', () => {
  it('keeps the show: project, songs, playlists and running order', () => {
    const [p] = run();
    expect(p.name).toBe('Old Tour');
    expect(p.songs).toHaveLength(1);
    expect(p.playlists.map((pl) => pl.name)).toEqual(['Night One', 'Night Two']);
    expect(p.playlists[0].songIds).toEqual(['s_1']);
  });

  it('converts named row fields to positional columns', () => {
    const [p] = run();
    const b = p.songs[0].blocks;
    expect(b.presets[0]).toMatchObject({ a: '1', b: 'P2', c: 'wide' });
    // A cam→screen pair becomes a screen with one segment.
    expect(b.camScreen[0]).toMatchObject({ screen: 'LED L' });
    expect(b.camScreen[0].segments).toMatchObject([{ source: '2', span: 1 }]);
    expect(b.firstShots[0]).toMatchObject({ a: '3', b: 'CU VOX' });
  });

  it('keeps the old note as a note rather than guessing where it belongs', () => {
    const [p] = run();
    const b = p.songs[0].blocks;
    expect(b.note).toBe('no cuts in verse 1');
    // The new specific blocks start empty — splitting one line across them
    // would be inventing the operator's intent.
    expect([b.intro, b.ending, b.energy, b.avoid]).toEqual(['', '', '', '']);
  });

  it('preserves repositioning', () => {
    const [p] = run();
    expect(p.songs[0].repositionAfter).toBe('CAM 3 to pit');
  });

  it('gives every playlist the old project-wide template, so nothing moves', () => {
    const [p] = run();
    for (const pl of p.playlists) {
      expect(blocksOf(pl.layout)).toEqual(['presets', 'note']);
      expect(pl.overrides).toEqual({});
    }
  });

  it('rescales the old 12x8 grid and keeps every cell in bounds', () => {
    const [p] = run();
    for (const cell of p.playlists[0].layout) {
      expect(cell.x + cell.w).toBeLessThanOrEqual(GRID_COLS);
      expect(cell.y + cell.h).toBeLessThanOrEqual(GRID_ROWS);
      expect(cell.w).toBeGreaterThan(0);
      expect(cell.h).toBeGreaterThan(0);
    }
    // 6/12 of the old width is still half the new one.
    const presets = p.playlists[0].layout.find((c) => c.block === 'presets')!;
    expect(presets.w).toBe(8);
  });

  it('does not re-run against already-migrated state', () => {
    const already = { projects: [{ id: 'p_9', name: 'New', songs: [], playlists: [], createdAt: 1 }] };
    expect(migrate(already, 4)).toBe(already);
  });

  it('survives junk instead of throwing', () => {
    expect(migrate({ projects: 'nonsense' }, 1)).toEqual({ projects: [] });
    expect(migrate(undefined, 1)).toEqual({ projects: [] });
    const partial = migrate({ projects: [{ id: 'p' }] }, 1) as { projects: Project[] };
    expect(partial.projects[0].songs).toEqual([]);
    expect(partial.projects[0].playlists).toEqual([]);
  });
});

describe('v3 -> v4: screens become timelines', () => {
  /** A v3 project: screens are still one camera per row. */
  const v3 = {
    projects: [
      {
        id: 'p_1',
        name: 'Tour',
        createdAt: 1,
        songs: [
          {
            id: 's_1',
            title: 'Opener',
            blocks: {
              presets: [],
              firstShots: [],
              camScreen: [
                { id: 'r1', a: '4', b: 'LED L', c: '' },
                { id: 'r2', a: '2', b: 'CENTRE', c: '' },
              ],
              instruments: [],
              solos: [],
              hits: [],
              intro: '',
              ending: '',
              energy: '',
              avoid: '',
              note: '',
            },
            repositionDuring: '',
            repositionAfter: '',
            hasImage: false,
            updatedAt: 1,
          },
        ],
        playlists: [
          {
            id: 'pl_1',
            name: 'Night',
            date: '2026-05-02',
            songIds: ['s_1'],
            layout: [{ block: 'reposition', x: 0, y: 0, w: 16, h: 2 }],
            overrides: {},
            createdAt: 1,
          },
        ],
      },
    ],
  };

  const run = () =>
    (migrate(structuredClone(v3), 3) as { projects: Project[] }).projects;

  it('turns each cam→screen pair into a screen with one segment', () => {
    const [p] = run();
    const cs = p.songs[0].blocks.camScreen;
    expect(cs).toHaveLength(2);
    expect(cs[0]).toMatchObject({ screen: 'LED L' });
    expect(cs[0].segments).toMatchObject([{ source: '4', span: 1 }]);
    expect(cs[1]).toMatchObject({ screen: 'CENTRE' });
    expect(cs[1].segments).toMatchObject([{ source: '2', span: 1 }]);
  });

  it('leaves an already-converted timeline alone', () => {
    const already = structuredClone(v3) as unknown as {
      projects: { songs: { blocks: { camScreen: unknown } }[] }[];
    };
    // Deliberately already v4-shaped, to prove the step is idempotent.
    already.projects[0].songs[0].blocks.camScreen = [
      { id: 'x', screen: 'LED R', segments: [{ id: 'g', source: 'PGM', span: 1 }] },
    ];
    const out = (migrate(already, 3) as { projects: Project[] }).projects;
    expect(out[0].songs[0].blocks.camScreen[0].segments).toMatchObject([
      { source: 'PGM' },
    ]);
  });
});
