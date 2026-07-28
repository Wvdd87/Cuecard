import { beforeEach, describe, expect, it } from 'vitest';
import { useStore, resolveSession } from './store';
import { newPlaylist, newProject, newSong } from './defaults';
import type { Project } from './types';
import { hasOverride, layoutFor } from './types';

/**
 * The navigation rules are the part of this app that must not misbehave in
 * front of an audience, so they are pinned down here.
 */

function scaffold(repos: {
  during?: number[];
  after?: number[];
} = {}): { project: Project; playlistId: string } {
  const project = newProject('Test');
  const titles = ['One', 'Two', 'Three', 'Four'];
  project.songs = titles.map((t, i) => {
    const s = newSong(t);
    if (repos.during?.includes(i)) s.repositionDuring = `during ${i}`;
    if (repos.after?.includes(i)) s.repositionAfter = `after ${i}`;
    return s;
  });
  const pl = newPlaylist('Show');
  pl.songIds = project.songs.map((s) => s.id);
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
      projectId: null,
      playlistId: null,
      index: 0,
      interstitial: false,
      live: false,
    },
  });
});

describe('advancing', () => {
  it('steps song to song when nothing is flagged', () => {
    const { project, playlistId } = scaffold();
    load(project, playlistId);

    useStore.getState().next();
    expect(at()).toEqual({ index: 1, interstitial: false });
    useStore.getState().next();
    expect(at()).toEqual({ index: 2, interstitial: false });
  });

  it('stops at the last song instead of running off the end', () => {
    const { project, playlistId } = scaffold();
    load(project, playlistId);
    for (let i = 0; i < 10; i++) useStore.getState().next();
    expect(at()).toEqual({ index: 3, interstitial: false });
  });

  it('cannot reach the next song without passing the reposition card', () => {
    const { project, playlistId } = scaffold({ after: [1] });
    load(project, playlistId);

    useStore.getState().next(); // -> song 2
    useStore.getState().next(); // -> interstitial, NOT song 3
    expect(at()).toEqual({ index: 1, interstitial: true });

    useStore.getState().next(); // acknowledged -> song 3
    expect(at()).toEqual({ index: 2, interstitial: false });
  });

  it('does not show a reposition card after the final song', () => {
    const { project, playlistId } = scaffold({ after: [3] });
    load(project, playlistId);
    for (let i = 0; i < 5; i++) useStore.getState().next();
    expect(at()).toEqual({ index: 3, interstitial: false });
  });
});

describe('going back', () => {
  it('is symmetric: you pass back through the same reposition card', () => {
    const { project, playlistId } = scaffold({ after: [1] });
    load(project, playlistId);
    useStore.getState().jumpTo(2);

    useStore.getState().prev();
    expect(at()).toEqual({ index: 1, interstitial: true });
    useStore.getState().prev();
    expect(at()).toEqual({ index: 1, interstitial: false });
  });

  it('holds at the first song', () => {
    const { project, playlistId } = scaffold();
    load(project, playlistId);
    useStore.getState().prev();
    expect(at()).toEqual({ index: 0, interstitial: false });
  });
});

describe('rail jumps', () => {
  it('goes straight to a song, bypassing reposition cards by design', () => {
    const { project, playlistId } = scaffold({ after: [0, 1, 2] });
    load(project, playlistId);
    useStore.getState().jumpTo(3);
    expect(at()).toEqual({ index: 3, interstitial: false });
  });

  it('clamps out-of-range jumps', () => {
    const { project, playlistId } = scaffold();
    load(project, playlistId);
    useStore.getState().jumpTo(99);
    expect(at().index).toBe(3);
    useStore.getState().jumpTo(-5);
    expect(at().index).toBe(0);
  });
});

describe('playlists reference the bucket', () => {
  it('reflects a song edit everywhere it is used', () => {
    const { project, playlistId } = scaffold();
    load(project, playlistId);
    const songId = project.songs[1].id;

    useStore.getState().updateSong(project.id, songId, { title: 'Renamed' });

    const s = useStore.getState();
    const ctx = resolveSession(s.projects, s.session)!;
    expect(ctx.songs[1].title).toBe('Renamed');
  });

  it('duplicating a playlist shares songs rather than copying them', () => {
    const { project, playlistId } = scaffold();
    useStore.setState({ projects: [project] });

    const copyId = useStore.getState().duplicatePlaylist(project.id, playlistId)!;
    useStore
      .getState()
      .updateSong(project.id, project.songs[0].id, { title: 'Edited once' });

    const p = useStore.getState().projects[0];
    const copy = p.playlists.find((pl) => pl.id === copyId)!;
    expect(copy.songIds).toEqual(p.playlists[0].songIds);
    expect(p.songs[0].title).toBe('Edited once');
    expect(p.songs.length).toBe(4); // no duplicated song content
  });

  it('removes a deleted song from every playlist using it', () => {
    const { project, playlistId } = scaffold();
    useStore.setState({ projects: [project] });
    const gone = project.songs[2].id;

    useStore.getState().deleteSong(project.id, gone);

    const p = useStore.getState().projects[0];
    expect(p.songs.find((s) => s.id === gone)).toBeUndefined();
    expect(p.playlists[0].songIds).not.toContain(gone);
    expect(p.playlists[0].songIds).toHaveLength(3);
    void playlistId;
  });

  it('survives a playlist that points at a deleted song', () => {
    const { project, playlistId } = scaffold();
    project.playlists[0].songIds.push('s_missing');
    load(project, playlistId);

    const s = useStore.getState();
    const ctx = resolveSession(s.projects, s.session);
    expect(ctx?.songs).toHaveLength(4);
  });
});

describe('display', () => {
  it('clamps brightness to a range that stays readable', () => {
    for (let i = 0; i < 40; i++) useStore.getState().nudgeBrightness(-0.05);
    expect(useStore.getState().display.brightness).toBe(0.2);
    for (let i = 0; i < 40; i++) useStore.getState().nudgeBrightness(0.05);
    expect(useStore.getState().display.brightness).toBe(1);
  });
});

describe('templates and per-song overrides', () => {
  it('every song uses the playlist default until overridden', () => {
    const { project } = scaffold();
    useStore.setState({ projects: [project] });
    const pl = () => useStore.getState().projects[0].playlists[0];

    for (const s of project.songs) {
      expect(layoutFor(pl(), s.id)).toBe(pl().layout);
    }
  });

  it('an override changes that song only, not the default or its neighbours', () => {
    const { project, playlistId } = scaffold();
    useStore.setState({ projects: [project] });
    const target = project.songs[1].id;
    const before = useStore.getState().projects[0].playlists[0].layout;

    useStore.getState().startOverride(project.id, playlistId, target);
    useStore
      .getState()
      .setSongLayout(project.id, playlistId, target, [
        { block: 'hits', x: 0, y: 0, w: 4, h: 4 },
      ]);

    const pl = useStore.getState().projects[0].playlists[0];
    expect(layoutFor(pl, target)).toHaveLength(1);
    expect(pl.layout).toEqual(before);
    for (const other of [0, 2, 3]) {
      expect(layoutFor(pl, project.songs[other].id)).toEqual(before);
    }
  });

  it('starts an override as a copy of the default, not a blank page', () => {
    const { project, playlistId } = scaffold();
    useStore.setState({ projects: [project] });
    const target = project.songs[0].id;

    useStore.getState().startOverride(project.id, playlistId, target);

    const pl = useStore.getState().projects[0].playlists[0];
    expect(pl.overrides[target]).toEqual(pl.layout);
    expect(pl.overrides[target]).not.toBe(pl.layout); // a copy, not a reference
  });

  it('does not clobber an existing override when re-opened', () => {
    const { project, playlistId } = scaffold();
    useStore.setState({ projects: [project] });
    const target = project.songs[0].id;
    const mine = [{ block: 'solos' as const, x: 1, y: 1, w: 3, h: 3 }];

    useStore.getState().setSongLayout(project.id, playlistId, target, mine);
    useStore.getState().startOverride(project.id, playlistId, target);

    expect(
      useStore.getState().projects[0].playlists[0].overrides[target],
    ).toEqual(mine);
  });

  it('clearing an override returns the song to the default', () => {
    const { project, playlistId } = scaffold();
    useStore.setState({ projects: [project] });
    const target = project.songs[2].id;

    useStore.getState().startOverride(project.id, playlistId, target);
    useStore.getState().clearOverride(project.id, playlistId, target);

    const pl = useStore.getState().projects[0].playlists[0];
    expect(hasOverride(pl, target)).toBe(false);
    expect(layoutFor(pl, target)).toBe(pl.layout);
  });

  it('editing the default leaves overridden songs alone', () => {
    const { project, playlistId } = scaffold();
    useStore.setState({ projects: [project] });
    const target = project.songs[1].id;

    useStore.getState().startOverride(project.id, playlistId, target);
    const pinned = useStore.getState().projects[0].playlists[0].overrides[target];
    useStore.getState().toggleLayoutBlock(project.id, playlistId, 'avoid');

    const pl = useStore.getState().projects[0].playlists[0];
    expect(pl.layout.some((c) => c.block === 'avoid')).toBe(true);
    expect(pl.overrides[target]).toEqual(pinned);
  });

  it('duplicating a playlist carries the template and overrides forward', () => {
    const { project, playlistId } = scaffold();
    useStore.setState({ projects: [project] });
    const target = project.songs[0].id;
    useStore.getState().startOverride(project.id, playlistId, target);

    const copyId = useStore.getState().duplicatePlaylist(project.id, playlistId)!;
    // Edit the copy's template; the original must not move.
    useStore.getState().toggleLayoutBlock(project.id, copyId, 'energy');

    const p = useStore.getState().projects[0];
    const original = p.playlists.find((x) => x.id === playlistId)!;
    const copy = p.playlists.find((x) => x.id === copyId)!;
    expect(hasOverride(copy, target)).toBe(true);
    expect(copy.layout.some((c) => c.block === 'energy')).toBe(true);
    expect(original.layout.some((c) => c.block === 'energy')).toBe(false);
  });
});
