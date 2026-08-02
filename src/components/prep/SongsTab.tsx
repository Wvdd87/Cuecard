import { useState } from 'react';
import { useStore, songIsEmpty } from '../../lib/store';
import type { Project } from '../../lib/types';
import { SongEditor } from './SongEditor';
import { Confirm } from './Confirm';

export function SongsTab({ project }: { project: Project }) {
  const addSong = useStore((s) => s.addSong);
  const deleteSong = useStore((s) => s.deleteSong);
  const [selected, setSelected] = useState<string | null>(
    project.bucket[0]?.id ?? null,
  );
  const [filter, setFilter] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  const song = project.bucket.find((s) => s.id === selected);
  const visible = project.bucket.filter((s) =>
    s.title.toLowerCase().includes(filter.toLowerCase()),
  );
  const usedIn = (songId: string) =>
    project.playlists.filter((pl) => pl.songIds.includes(songId)).length;
  const target = project.bucket.find((s) => s.id === confirming);

  return (
    <div className="pane">
      <div className="side">
        <div className="side-head">
          <div className="cf-input sm" style={{ flex: 1, minWidth: 0 }}>
            <input
              placeholder="Filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <button
            className="cf-btn primary icon sm"
            onClick={() => setSelected(addSong(project.id))}
            aria-label="New song"
          >
            +
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="empty-state">
            The bucket holds every song you have ever built for this project.
            Playlists pull from it.
          </div>
        ) : (
          <ul style={{ listStyle: 'none' }}>
            {visible.map((s) => (
              <li key={s.id}>
                <button
                  className="side-row"
                  aria-current={s.id === selected ? 'true' : undefined}
                  onClick={() => setSelected(s.id)}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <div className="t">{s.title || 'Untitled'}</div>
                    <div className="sub">
                      {songIsEmpty(s)
                        ? 'empty'
                        : `${s.pins.length} milestone${s.pins.length === 1 ? '' : 's'}`}
                    </div>
                  </span>
                  <span className="marker">{s.repositionAfter ? '▼' : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="main">
        {song ? (
          <SongEditor
            key={song.id}
            project={project}
            song={song}
            usedIn={usedIn(song.id)}
            onDelete={() => setConfirming(song.id)}
          />
        ) : (
          <div className="empty-state">Select or add a song.</div>
        )}
      </div>

      {target && (
        <Confirm
          title={`Delete "${target.title || 'Untitled'}" from the bucket?`}
          body={`It will be removed from ${usedIn(target.id)} playlist(s) too.`}
          confirmLabel="Delete song"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            deleteSong(project.id, target.id);
            setConfirming(null);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
