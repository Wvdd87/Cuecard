import { useState } from 'react';
import { useStore, playlistSongs } from '../../lib/store';
import type { Project, Song } from '../../lib/types';
import { BLOCKS, hasOverride, layoutFor } from '../../lib/types';
import { unplacedBlocks } from '../../lib/blocks';
import { formatDate } from '../../lib/util';
import { exportPlaylistPdf } from '../../lib/pdf';
import { Confirm } from './Confirm';
import { LayoutEditor } from './LayoutEditor';

/** Which editor, if any, is open over the playlist detail. */
type Editing = { kind: 'template' } | { kind: 'song'; songId: string } | null;

export function PlaylistsTab({ project }: { project: Project }) {
  const createPlaylist = useStore((s) => s.createPlaylist);
  const duplicatePlaylist = useStore((s) => s.duplicatePlaylist);
  const deletePlaylist = useStore((s) => s.deletePlaylist);
  const updatePlaylist = useStore((s) => s.updatePlaylist);
  const addToPlaylist = useStore((s) => s.addToPlaylist);
  const removeFromPlaylist = useStore((s) => s.removeFromPlaylist);
  const movePlaylistSong = useStore((s) => s.movePlaylistSong);
  const setLayout = useStore((s) => s.setLayout);
  const resetLayout = useStore((s) => s.resetLayout);
  const setSongLayout = useStore((s) => s.setSongLayout);
  const startOverride = useStore((s) => s.startOverride);
  const clearOverride = useStore((s) => s.clearOverride);
  const goLive = useStore((s) => s.goLive);

  const [selected, setSelected] = useState<string | null>(
    project.playlists[0]?.id ?? null,
  );
  const [editing, setEditing] = useState<Editing>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const playlist = project.playlists.find((pl) => pl.id === selected);
  const songs = playlist ? playlistSongs(project, playlist) : [];
  const target = project.playlists.find((pl) => pl.id === confirming);

  const select = (id: string | null) => {
    setSelected(id);
    setEditing(null);
  };

  return (
    <div className="pane">
      <div className="side">
        <div className="side-head">
          <span className="label" style={{ flex: 1 }}>
            Playlists
          </span>
          <button
            className="btn primary sm"
            onClick={() => select(createPlaylist(project.id, 'New show'))}
          >
            + New
          </button>
        </div>
        {project.playlists.length === 0 ? (
          <div className="empty">
            A playlist is a dated, ordered selection of bucket songs, plus the
            live-view template every song in it uses.
          </div>
        ) : (
          <ul className="list">
            {[...project.playlists]
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((pl) => (
                <li key={pl.id}>
                  <button
                    className="list-item"
                    aria-current={pl.id === selected ? 'true' : undefined}
                    onClick={() => select(pl.id)}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div>{pl.name}</div>
                      <div className="sub">
                        {formatDate(pl.date)} · {pl.songIds.length} songs
                        {Object.keys(pl.overrides).length > 0 &&
                          ` · ${Object.keys(pl.overrides).length} custom`}
                      </div>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="main">
        {!playlist ? (
          <div className="empty">Select or create a playlist.</div>
        ) : editing?.kind === 'template' ? (
          <LayoutEditor
            layout={playlist.layout}
            onChange={(l) => setLayout(project.id, playlist.id, l)}
            song={busiestSong(songs)}
            heading={`${playlist.name} — default template`}
            subheading="Every song in this playlist uses this, unless it has its own override."
            onDone={() => setEditing(null)}
            onReset={() => resetLayout(project.id, playlist.id)}
            resetLabel="Reset to standard"
          />
        ) : editing?.kind === 'song' ? (
          (() => {
            const s = project.songs.find((x) => x.id === editing.songId);
            if (!s) return <div className="empty">Song not found.</div>;
            return (
              <LayoutEditor
                layout={layoutFor(playlist, s.id)}
                onChange={(l) => setSongLayout(project.id, playlist.id, s.id, l)}
                song={s}
                heading={`${s.title || 'Untitled'} — custom layout`}
                subheading={`Applies to this song in "${playlist.name}" only. The playlist default and every other song are untouched.`}
                onDone={() => setEditing(null)}
                onReset={() => {
                  clearOverride(project.id, playlist.id, s.id);
                  setEditing(null);
                }}
                resetLabel="Revert to playlist default"
              />
            );
          })()
        ) : (
          <div className="section" style={{ maxWidth: 940 }}>
            <div className="row" style={{ marginBottom: 4 }}>
              <input
                className="input bare"
                style={{ fontSize: 24, fontWeight: 700, padding: '4px 8px' }}
                value={playlist.name}
                onChange={(e) =>
                  updatePlaylist(project.id, playlist.id, {
                    name: e.target.value,
                  })
                }
              />
              <input
                className="input"
                type="date"
                style={{ width: 160 }}
                value={playlist.date}
                onChange={(e) =>
                  updatePlaylist(project.id, playlist.id, {
                    date: e.target.value,
                  })
                }
              />
            </div>

            <div className="row" style={{ marginBottom: 22, flexWrap: 'wrap' }}>
              <button
                className="btn primary"
                disabled={songs.length === 0}
                onClick={() => goLive(project.id, playlist.id, 0)}
              >
                ▶ Go live
              </button>
              <button
                className="btn"
                onClick={() => setEditing({ kind: 'template' })}
              >
                Edit template
              </button>
              <button
                className="btn"
                onClick={() => {
                  const id = duplicatePlaylist(project.id, playlist.id);
                  if (id) select(id);
                }}
              >
                Duplicate
              </button>
              <button
                className="btn"
                disabled={songs.length === 0}
                onClick={() => void exportPlaylistPdf(project, playlist)}
              >
                Export PDF
              </button>
              <div className="spacer" />
              <button
                className="btn ghost danger"
                onClick={() => setConfirming(playlist.id)}
              >
                Delete playlist
              </button>
            </div>

            <div className="section-head">
              <span className="label">Running order</span>
              <span className="hint">
                {songs.length} songs ·{' '}
                {playlist.layout.length} blocks in the default template
              </span>
            </div>

            {songs.length === 0 ? (
              <div className="hint" style={{ marginBottom: 20 }}>
                Nothing in this playlist yet — add songs from the bucket below.
              </div>
            ) : (
              <ul className="order-list">
                {songs.map((s, i) => {
                  const custom = hasOverride(playlist, s.id);
                  const missing = unplacedBlocks(
                    s,
                    layoutFor(playlist, s.id).map((c) => c.block),
                  );
                  return (
                    <li key={`${s.id}-${i}`}>
                      <div className="order-row">
                        <span className="n">{i + 1}</span>
                        <span className="t">
                          {s.title || 'Untitled'}
                          {(s.repositionDuring || s.repositionAfter) && (
                            <span
                              className="rail-mark"
                              style={{ marginLeft: 8 }}
                              title="camera repositioning"
                            >
                              {s.repositionDuring ? '●' : ''}
                              {s.repositionAfter ? '▼' : ''}
                            </span>
                          )}
                        </span>

                        <button
                          className={custom ? 'chip on' : 'chip'}
                          onClick={() => {
                            startOverride(project.id, playlist.id, s.id);
                            setEditing({ kind: 'song', songId: s.id });
                          }}
                          title={
                            custom
                              ? 'This song has its own layout'
                              : 'Give this song its own layout'
                          }
                        >
                          {custom ? '✓ custom layout' : 'custom layout'}
                        </button>

                        <button
                          className="btn ghost sm"
                          disabled={i === 0}
                          onClick={() =>
                            movePlaylistSong(project.id, playlist.id, i, i - 1)
                          }
                          aria-label="Move up"
                        >
                          ↑
                        </button>
                        <button
                          className="btn ghost sm"
                          disabled={i === songs.length - 1}
                          onClick={() =>
                            movePlaylistSong(project.id, playlist.id, i, i + 1)
                          }
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                        <button
                          className="btn ghost sm danger"
                          onClick={() =>
                            removeFromPlaylist(project.id, playlist.id, i)
                          }
                          aria-label="Remove from playlist"
                        >
                          ✕
                        </button>
                      </div>

                      {missing.length > 0 && (
                        <div className="order-warn">
                          {missing.map((b) => BLOCKS[b].label).join(', ')} not in
                          this song's layout — content there will not be shown
                          live.
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="section-head" style={{ marginTop: 26 }}>
              <span className="label">Add from bucket</span>
            </div>
            {project.songs.length === 0 ? (
              <div className="hint">
                The bucket is empty. Add songs in the Bucket tab first.
              </div>
            ) : (
              <div className="tagfield">
                {project.songs.map((s) => (
                  <button
                    key={s.id}
                    className="btn sm"
                    onClick={() => addToPlaylist(project.id, playlist.id, s.id)}
                  >
                    + {s.title || 'Untitled'}
                  </button>
                ))}
              </div>
            )}
            <div className="hint" style={{ marginTop: 10 }}>
              A playlist references bucket songs — it never copies them. The
              same song can appear twice (encore reprise) and stays in sync.
            </div>
          </div>
        )}
      </div>

      {target && (
        <Confirm
          title={`Delete playlist "${target.name}"?`}
          body="The songs stay in the bucket. The template and any custom song layouts go with it."
          confirmLabel="Delete playlist"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            deletePlaylist(project.id, target.id);
            setConfirming(null);
            select(null);
          }}
        />
      )}
    </div>
  );
}

/** Preview the template against the song that stresses it most. */
function busiestSong(songs: Song[]): Song | undefined {
  return [...songs].sort((a, b) => score(b) - score(a))[0];
}

function score(s: Song): number {
  const b = s.blocks;
  return (
    b.presets.length +
    b.camScreen.length +
    b.firstShots.length +
    b.instruments.length +
    b.solos.length +
    b.hits.length +
    [b.intro, b.ending, b.energy, b.avoid, b.note].filter(Boolean).length
  );
}
