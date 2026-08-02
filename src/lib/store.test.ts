import { beforeEach, describe, expect, it } from 'vitest';
import { useStore, resolveSession, playlistSongs } from './store';
import { newPlaylist, newProject, newSong } from './defaults';
import type { Project } from './types';
import { normaliseWidths, pinsInLane } from './types';

/**
 * The navigation rules and the track-width invariant are the parts that must
 * not misbehave in front of an audience, so they are pinned down here.
 */

function scaffold(after: number[] = []): { project: Project; playlistId: string } {
  const project = newProject('Test');
  project.bucket = ['One', 'Two', 'Three', 'Four'].map((t, i) => {
    const s = newSong(t);
    if (after.includes(i)) {
      s.repositionAfter = { cameras: ['C01'], destination: `move ${i}` };
    }
    return s;
  });
  const pl = newPlaylist('Show');
  pl.songIds = project.bucket.map((s) => s.id);
  project.playlists = [pl];
  return { project, playlistId: pl.id };
}

function load(project: Project, playlistId: string) {
  useStore.setState({ projects: [project] });
  useStore.getState().goLive(project.id, playlistId, 0);
}

const at = () => {
  const s = useStore.getState().session;
  return { index: s.index, interstitial: s.interstitial };
};

beforeEach(() => {
  useStore.setState({
    projects: [],
    session: {
      projectId: null, playlistId: null, index: 0,
      interstitial: false, live: false,
    },
  });
});

describe('advancing', () => {
  it('steps song to song when nothing is flagged', () => {
    const { project, playlistId } = scaffold();
    load(project, playlistId);
    useStore.getState().next();
    expect(at()).toEqual({ index: 1, interstitial: false });
  });

  it('stops at the last song instead of running off the end', () => {
    const { project, playlistId } = scaffold();
    load(project, playlistId);
    for (let i = 0; i < 10; i++) useStore.getState().next();
    expect(at()).toEqual({ index: 3, interstitial: false });
  });

  it('cannot reach the next song without passing the reposition screen', () => {
    const { project, playlistId } = scaffold([1]);
    load(project, playlistId);
    useStore.getState().next();
    useStore.getState().next();
    expect(at()).toEqual({ index: 1, interstitial: true });
    useStore.getState().next();
    expect(at()).toEqual({ index: 2, interstitial: false });
  });

  it('does not show a reposition screen after the final song', () => {
    const { project, playlistId } = scaffold([3]);
    load(project, playlistId);
    for (let i = 0; i < 6; i++) useStore.getState().next();
    expect(at()).toEqual({ index: 3, interstitial: false });
  });

  it('is symmetric going back', () => {
    const { project, playlistId } = scaffold([1]);
    load(project, playlistId);
    useStore.getState().jumpTo(2);
    useStore.getState().prev();
    expect(at()).toEqual({ index: 1, interstitial: true });
    useStore.getState().prev();
    expect(at()).toEqual({ index: 1, interstitial: false });
  });

  it('rail jumps bypass the reposition screen by design', () => {
    const { project, playlistId } = scaffold([0, 1, 2]);
    load(project, playlistId);
    useStore.getState().jumpTo(3);
    expect(at()).toEqual({ index: 3, interstitial: false });
  });
});

describe('playlists reference the bucket', () => {
  it('reflects a song edit everywhere it is used', () => {
    const { project, playlistId } = scaffold();
    load(project, playlistId);
    useStore.getState().updateSong(project.id, project.bucket[1].id, {
      title: 'Renamed',
    });
    const s = useStore.getState();
    expect(resolveSession(s.projects, s.session)!.songs[1].title).toBe('Renamed');
  });

  it('duplicating shares songs rather than copying them', () => {
    const { project, playlistId } = scaffold();
    useStore.setState({ projects: [project] });
    const copyId = useStore.getState().duplicatePlaylist(project.id, playlistId)!;
    useStore.getState().updateSong(project.id, project.bucket[0].id, {
      title: 'Edited once',
    });
    const p = useStore.getState().projects[0];
    const copy = p.playlists.find((pl) => pl.id === copyId)!;
    expect(copy.songIds).toEqual(p.playlists[0].songIds);
    expect(p.bucket).toHaveLength(4);
    expect(playlistSongs(p, copy)[0].title).toBe('Edited once');
  });

  it('survives a playlist pointing at a deleted song', () => {
    const { project, playlistId } = scaffold();
    project.playlists[0].songIds.push('s_missing');
    load(project, playlistId);
    const s = useStore.getState();
    expect(resolveSession(s.projects, s.session)?.songs).toHaveLength(4);
  });
});

describe('track blocks always sum to 100', () => {
  const setup = () => {
    const { project, playlistId } = scaffold();
    useStore.setState({ projects: [project] });
    return { project, playlistId, trackId: project.tracks[0].id, songId: project.bucket[0].id };
  };
  const widths = (p: Project, songId: string, trackId: string) =>
    p.bucket.find((s) => s.id === songId)!.tracksData[trackId] ?? [];
  const total = (p: Project, songId: string, trackId: string) =>
    widths(p, songId, trackId).reduce((s, b) => s + b.widthPercent, 0);

  it('a first block fills the track', () => {
    const { project, songId, trackId } = setup();
    useStore.getState().addTrackBlock(project.id, songId, trackId);
    expect(total(useStore.getState().projects[0], songId, trackId)).toBeCloseTo(100);
  });

  it('adding a block splits the track without changing the total', () => {
    const { project, songId, trackId } = setup();
    for (let i = 0; i < 4; i++) {
      useStore.getState().addTrackBlock(project.id, songId, trackId);
      expect(total(useStore.getState().projects[0], songId, trackId)).toBeCloseTo(100);
    }
    expect(widths(useStore.getState().projects[0], songId, trackId)).toHaveLength(4);
  });

  it('dragging a divider moves only the pair either side', () => {
    const { project, songId, trackId } = setup();
    for (let i = 0; i < 3; i++) {
      useStore.getState().addTrackBlock(project.id, songId, trackId);
    }
    const before = widths(useStore.getState().projects[0], songId, trackId);
    useStore.getState().resizeTrackBlocks(project.id, songId, trackId, 0, 0.8);
    const after = widths(useStore.getState().projects[0], songId, trackId);

    expect(after[0].widthPercent).toBeGreaterThan(before[0].widthPercent);
    expect(after[1].widthPercent).toBeLessThan(before[1].widthPercent);
    // The third block is untouched, and the track still sums to 100.
    expect(after[2].widthPercent).toBeCloseTo(before[2].widthPercent);
    expect(total(useStore.getState().projects[0], songId, trackId)).toBeCloseTo(100);
  });

  it('never lets a block collapse to nothing', () => {
    const { project, songId, trackId } = setup();
    useStore.getState().addTrackBlock(project.id, songId, trackId);
    useStore.getState().addTrackBlock(project.id, songId, trackId);
    useStore.getState().resizeTrackBlocks(project.id, songId, trackId, 0, 99);
    for (const b of widths(useStore.getState().projects[0], songId, trackId)) {
      expect(b.widthPercent).toBeGreaterThan(0);
    }
  });

  it('removing a block re-spreads the rest to 100', () => {
    const { project, songId, trackId } = setup();
    for (let i = 0; i < 3; i++) {
      useStore.getState().addTrackBlock(project.id, songId, trackId);
    }
    const first = widths(useStore.getState().projects[0], songId, trackId)[0];
    useStore.getState().removeTrackBlock(project.id, songId, trackId, first.id);
    expect(total(useStore.getState().projects[0], songId, trackId)).toBeCloseTo(100);
  });

  it('normalises arbitrary widths', () => {
    const out = normaliseWidths([
      { id: 'a', widthPercent: 3, label: '', color: '' },
      { id: 'b', widthPercent: 1, label: '', color: '' },
    ]);
    expect(out.reduce((s, b) => s + b.widthPercent, 0)).toBeCloseTo(100);
    expect(out[0].widthPercent).toBeCloseTo(75);
  });
});

describe('pins keep their lane', () => {
  it('sorts a lane left to right and leaves other lanes alone', () => {
    const { project } = scaffold();
    const song = project.bucket[0];
    song.pins = [
      { id: 'a', positionPercent: 80, cardType: 'note', cardData: { text: 'late' } },
      { id: 'b', positionPercent: 10, cardType: 'note', cardData: { text: 'early' } },
      { id: 'c', positionPercent: 50, cardType: 'reposition', cardData: {} },
    ];
    expect(pinsInLane(song, 'note').map((p) => p.id)).toEqual(['b', 'a']);
    expect(pinsInLane(song, 'reposition').map((p) => p.id)).toEqual(['c']);
    expect(pinsInLane(song, 'first_shots')).toEqual([]);
  });

  it('clamps a pin to the song', () => {
    const { project, playlistId } = scaffold();
    useStore.setState({ projects: [project] });
    void playlistId;
    const songId = project.bucket[0].id;
    useStore.getState().addPin(project.id, songId, 'note');
    const pinId = useStore.getState().projects[0].bucket[0].pins[0].id;

    useStore.getState().updatePin(project.id, songId, pinId, { positionPercent: 140 });
    expect(useStore.getState().projects[0].bucket[0].pins[0].positionPercent).toBe(100);
    useStore.getState().updatePin(project.id, songId, pinId, { positionPercent: -20 });
    expect(useStore.getState().projects[0].bucket[0].pins[0].positionPercent).toBe(0);
  });
});

describe('removing a camera', () => {
  it('stops it being referenced by any card', () => {
    const { project } = scaffold();
    const song = project.bucket[0];
    song.pins = [
      { id: 'p1', positionPercent: 0, cardType: 'first_shots',
        cardData: { shots: { C01: 'wide', C02: 'cu' } } },
      { id: 'p2', positionPercent: 50, cardType: 'specific_shot',
        cardData: { camera: 'C01', text: 'x' } },
    ];
    song.repositionAfter = { cameras: ['C01', 'C02'], destination: 'pit' };
    useStore.setState({ projects: [project] });

    useStore.getState().removeCamera(project.id, 'C01');

    const s = useStore.getState().projects[0].bucket[0];
    expect(s.pins[0].cardData.shots).toEqual({ C02: 'cu' });
    expect(s.pins[1].cardData.camera).toBeUndefined();
    expect(s.repositionAfter!.cameras).toEqual(['C02']);
  });
});
