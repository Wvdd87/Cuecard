import { useState } from 'react';
import { useStore } from '../../lib/store';
import { formatDate } from '../../lib/util';
import { Confirm } from './Confirm';

export function ProjectsScreen() {
  const projects = useStore((s) => s.projects);
  const createProject = useStore((s) => s.createProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const setProjectId = useStore((s) => s.setProjectId);
  const [name, setName] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  const create = () => {
    if (!name.trim()) return;
    const id = createProject(name);
    setName('');
    setProjectId(id);
  };

  const target = projects.find((p) => p.id === confirming);

  return (
    <div className="prep">
      <div className="prep-bar">
        <span className="wordmark" style={{ cursor: 'default' }}>
          cuecard
        </span>
        <span className="hint">manual-cue show reference</span>
      </div>

      <div className="prep-body">
        <div className="section">
          <div className="section-head">
            <span className="label">Projects</span>
          </div>
          <div className="hint" style={{ marginBottom: 18 }}>
            One project per artist or show. It holds the bucket of every song
            you have ever entered for them, and every playlist built from it.
          </div>

          <div className="row" style={{ marginBottom: 22 }}>
            <input
              className="input"
              placeholder="Artist / show name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              style={{ maxWidth: 340 }}
            />
            <button className="btn primary" onClick={create} disabled={!name.trim()}>
              New project
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="empty">No projects yet.</div>
          ) : (
            <ul className="list" style={{ border: '1px solid var(--line)', borderRadius: 4 }}>
              {projects.map((p) => {
                const latest = [...p.playlists].sort((a, b) =>
                  a.date < b.date ? 1 : -1,
                )[0];
                return (
                  <li key={p.id} style={{ display: 'flex' }}>
                    <button
                      className="list-item"
                      onClick={() => setProjectId(p.id)}
                    >
                      <span style={{ flex: 1 }}>
                        <div>{p.name}</div>
                        <div className="sub">
                          {p.songs.length} songs · {p.playlists.length} playlists
                          {latest ? ` · latest ${formatDate(latest.date)}` : ''}
                        </div>
                      </span>
                    </button>
                    <button
                      className="btn ghost danger"
                      style={{ borderBottom: '1px solid var(--line)', borderRadius: 0 }}
                      onClick={() => setConfirming(p.id)}
                      aria-label={`Delete ${p.name}`}
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {target && (
        <Confirm
          title={`Delete "${target.name}"?`}
          body="This removes the bucket and every playlist in it. Cannot be undone."
          confirmLabel="Delete project"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            deleteProject(target.id);
            setConfirming(null);
          }}
        />
      )}
    </div>
  );
}
