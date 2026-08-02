import { describe, expect, it } from 'vitest';
import { migrate } from './migrate';
import type { Project } from './types';

/**
 * Everything before v5 described a fixed grid of content blocks. v5 is a
 * timeline. The models do not line up field for field, so the rule for the
 * step is that nothing is discarded: what maps structurally is mapped, and
 * what does not becomes a note — which is what a note is for.
 */

/** A v4 project exactly as the previous version persisted it. */
const v4 = {
  projects: [
    {
      id: 'p_1',
      name: 'Old Tour',
      createdAt: 1,
      songs: [
        {
          id: 's_1',
          title: 'Opener',
          blocks: {
            presets: [{ id: 'r0', a: '1', b: 'P2', c: 'wide' }],
            firstShots: [
              { id: 'r1', a: '1', b: 'WIDE STAGE', c: '' },
              { id: 'r2', a: '3', b: 'CU VOX', c: '' },
            ],
            camScreen: [
              {
                id: 'r3',
                screen: 'LED L',
                segments: [
                  { id: 'g1', source: '4', span: 1 },
                  { id: 'g2', source: 'PGM', span: 3 },
                ],
              },
            ],
            instruments: ['VOX'],
            solos: [],
            hits: [],
            intro: 'Cold open',
            ending: 'Hard stop',
            energy: '',
            avoid: 'No crowd',
            note: 'watch stage right',
          },
          repositionDuring: 'CAM 3 to downstage right',
          repositionAfter: 'CAM 3 + 4 to pit',
          hasImage: false,
          updatedAt: 5,
        },
      ],
      playlists: [
        { id: 'pl_1', name: 'Night One', date: '2026-05-02', songIds: ['s_1'], createdAt: 2 },
      ],
    },
  ],
};

const run = (): Project[] =>
  (migrate(structuredClone(v4), 4) as { projects: Project[] }).projects;

describe('pre-v5 -> v5 migration', () => {
  it('keeps the show: project, songs, playlists and running order', () => {
    const [p] = run();
    expect(p.name).toBe('Old Tour');
    expect(p.bucket).toHaveLength(1);
    expect(p.playlists[0].songIds).toEqual(['s_1']);
    expect(p.bucket[0].title).toBe('Opener');
  });

  it('builds the master camera list from the cameras actually used', () => {
    const [p] = run();
    // Cameras 1, 3 and 4 appear across presets, first shots and screens.
    expect(p.cameras.map((c) => c.id)).toEqual(['C01', 'C03', 'C04']);
    // Each gets its own reserved hue.
    expect(new Set(p.cameras.map((c) => c.badgeColor)).size).toBe(3);
  });

  it('turns first shots into a first_shots pin at the start of the song', () => {
    const [p] = run();
    const pin = p.bucket[0].pins.find((x) => x.cardType === 'first_shots')!;
    expect(pin.positionPercent).toBe(0);
    expect(pin.cardData.shots).toEqual({ C01: 'WIDE STAGE', C03: 'CU VOX' });
  });

  it('keeps a during-song move as a reposition card, never a note', () => {
    const [p] = run();
    const pin = p.bucket[0].pins.find((x) => x.cardType === 'reposition')!;
    expect(pin.cardData.destination).toBe('CAM 3 to downstage right');
  });

  it('keeps an after-song move as the full-page card', () => {
    const [p] = run();
    expect(p.bucket[0].repositionAfter?.destination).toBe('CAM 3 + 4 to pit');
  });

  it('turns screens into tracks, with segment spans becoming widths', () => {
    const [p] = run();
    const track = p.tracks.find((t) => t.name === 'LED L')!;
    const blocks = p.bucket[0].tracksData[track.id];
    expect(blocks.map((b) => b.label)).toEqual(['4', 'PGM']);
    // spans 1 and 3 -> 25% and 75%, still summing to 100.
    expect(blocks[0].widthPercent).toBeCloseTo(25);
    expect(blocks[1].widthPercent).toBeCloseTo(75);
    expect(blocks.reduce((s, b) => s + b.widthPercent, 0)).toBeCloseTo(100);
  });

  it('discards nothing: every leftover block survives as a note', () => {
    const [p] = run();
    const notes = p.bucket[0].pins
      .filter((x) => x.cardType === 'note')
      .map((x) => x.cardData.text ?? '')
      .join(' | ');
    for (const fragment of ['P2', 'VOX', 'Cold open', 'Hard stop', 'No crowd', 'watch stage right']) {
      expect(notes).toContain(fragment);
    }
  });

  it('spreads those notes across the song rather than stacking them', () => {
    const [p] = run();
    const positions = p.bucket[0].pins
      .filter((x) => x.cardType === 'note')
      .map((x) => x.positionPercent);
    expect(new Set(positions).size).toBe(positions.length);
    for (const v of positions) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('does not re-run against already-migrated state', () => {
    const already = { projects: [] };
    expect(migrate(already, 5)).toBe(already);
  });

  it('survives junk instead of throwing', () => {
    expect(migrate({ projects: 'nonsense' }, 4)).toEqual({ projects: [] });
    expect(migrate(undefined, 1)).toEqual({ projects: [] });
    const partial = migrate({ projects: [{ id: 'p' }] }, 4) as { projects: Project[] };
    expect(partial.projects[0].bucket).toEqual([]);
    expect(partial.projects[0].playlists).toEqual([]);
    // A project that never named a camera still gets a usable list.
    expect(partial.projects[0].cameras.length).toBeGreaterThan(0);
  });
});
