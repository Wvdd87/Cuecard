import { useState } from 'react';
import { useStore, playlistSongs } from '../../lib/store';
import type { Project } from '../../lib/types';
import { formatDate } from '../../lib/util';
import { exportPlaylistPdf } from '../../lib/pdf';
import { Confirm } from './Confirm';

export function PlaylistsTab({
  project,
  selected,
  setSelected,
}: {
  project: Project;
  selected: string | null;
  setSelected: (id: string | null) => void;
}) {
  const createPlaylist = useStore((s) => s.createPlaylist);
  const duplicatePlaylist = useStore((s) => s.duplicatePlaylist);
  const deletePlaylist = useStore((s) => s.deletePlaylist);
  const updatePlaylist = useStore((s) => s.updatePlaylist);
  const addToPlaylist = useStore((s) => s.addToPlaylist);
  const removeFromPlaylist = useStore((s) => s.removeFromPlaylist);
  const movePlaylistSong = useStore((s) => s.movePlaylistSong);
  const goLive = useStore((s) => s.goLive);

  const [confirming, setConfirming] = useState<string | null>(null);
  const playlist = project.playlists.find((pl) => pl.id === selected);
  const songs = playlist ? playlistSongs(project, playlist) : [];
  const target = project.playlists.find((pl) => pl.id === confirming);

  return (
    <div className="pane">
      <div className="side">
        <div className="side-head">
          <span className="eyebrow" style={{ flex: 1 }}>Playlists</span>
          <button
            className="cf-btn primary sm"
            onClick={() => setSelected(createPlaylist(project.id, 'New show'))}
          >
            + New
          </button>
        </div>
        {project.playlists.length === 0 ? (
          <div className="empty-state">
            A playlist is a dated, ordered selection of bucket songs.
          </div>
        ) : (
          <ul style={{ listStyle: 'none' }}>
            {[...project.playlists]
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((pl) => (
                <li key={pl.id}>
                  <button
                    className="side-row"
                    aria-current={pl.id === selected ? 'true' : undefined}
                    onClick={() => setSelected(pl.id)}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div className="t">{pl.name}</div>
                      <div className="sub">
                        {formatDate(pl.date)} · {pl.songIds.length} songs
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
          <div className="empty-state">Select or create a playlist.</div>
        ) : (
          <div className="section" style={{ maxWidth: 900 }}>
            <div className="row" style={{ marginBottom: 4 }}>
              <input
                className="playlist-title"
                value={playlist.name}
                onChange={(e) =>
                  updatePlaylist(project.id, playlist.id, { name: e.target.value })
                }
              />
              <input
                className="date-field"
                type="date"
                value={playlist.date}
                onChange={(e) =>
                  updatePlaylist(project.id, playlist.id, { date: e.target.value })
                }
              />
            </div>

            <div className="row" style={{ marginBottom: 24, flexWrap: 'wrap' }}>
              <button
                className="cf-btn primary"
                disabled={songs.length === 0}
                onClick={() => goLive(project.id, playlist.id, 0)}
              >
                ▶ Go live
              </button>
              <button
                className="cf-btn"
                onClick={() => {
                  const id = duplicatePlaylist(project.id, playlist.id);
                  if (id) setSelected(id);
                }}
              >
                Duplicate
              </button>
              <button
                className="cf-btn"
                disabled={songs.length === 0}
                onClick={() => void exportPlaylistPdf(project, playlist)}
              >
                Export PDF
              </button>
              <div className="spacer" />
              <button
                className="cf-btn danger"
                onClick={() => setConfirming(playlist.id)}
              >
                Delete playlist
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
              <span className="eyebrow">Running order</span>
              <span className="help">{songs.length} songs</span>
            </div>

            {songs.length === 0 ? (
              <div className="help" style={{ marginBottom: 20 }}>
                Nothing in this playlist yet — add songs from the bucket below.
              </div>
            ) : (
              <ul className="order-list">
                {songs.map((s, i) => (
                  <li key={`${s.id}-${i}`}>
                    <div className="order-row">
                      <span className="n">{i + 1}</span>
                      <span className="t">{s.title || 'Untitled'}</span>
                      <span className="marker">{s.repositionAfter ? '▼' : ''}</span>
                      <span className="help">
                        {s.pins.length} milestone{s.pins.length === 1 ? '' : 's'}
                      </span>
                      <button
                        className="mini-btn"
                        disabled={i === 0}
                        onClick={() => movePlaylistSong(project.id, playlist.id, i, i - 1)}
                        aria-label="Move up"
                      >↑</button>
                      <button
                        className="mini-btn"
                        disabled={i === songs.length - 1}
                        onClick={() => movePlaylistSong(project.id, playlist.id, i, i + 1)}
                        aria-label="Move down"
                      >↓</button>
                      <button
                        className="mini-btn danger"
                        onClick={() => removeFromPlaylist(project.id, playlist.id, i)}
                        aria-label="Remove from playlist"
                      >✕</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '24px 0 10px' }}>
              <span className="eyebrow">Add from bucket</span>
            </div>
            {project.bucket.length === 0 ? (
              <div className="help">The bucket is empty. Add songs in the Songs tab first.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {project.bucket.map((s) => (
                  <button
                    key={s.id}
                    className="add-bucket-btn"
                    onClick={() => addToPlaylist(project.id, playlist.id, s.id)}
                  >
                    + {s.title || 'Untitled'}
                  </button>
                ))}
              </div>
            )}
            <div className="help" style={{ marginTop: 10 }}>
              A playlist references bucket songs — it never copies them. The same
              song can appear twice and stays in sync.
            </div>
          </div>
        )}
      </div>

      {target && (
        <Confirm
          title={`Delete playlist "${target.name}"?`}
          body="The songs stay in the bucket."
          confirmLabel="Delete playlist"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            deletePlaylist(project.id, target.id);
            setConfirming(null);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
