import { useState } from 'react';
import { useStore } from '../../lib/store';
import type { Project } from '../../lib/types';
import { Confirm } from './Confirm';
import { TopNav } from './TopNav';

/**
 * Projects as cards, per the mockup: an eyebrow with a status pip, the name
 * as the card title, and the two numbers that actually matter — how many
 * songs are in the bucket and how many playlists are built from them.
 */
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
      {/* Same shell as every other screen — the chrome never changes shape. */}
      <TopNav active="projects" canGoLive={false} onNavigate={() => {}} />

      <div className="prep-body">
        <div className="projects">
          <div className="projects-inner">
            <div className="eyebrow">Projects</div>
            <p className="projects-intro">
              One project per artist or show. Each holds a bucket of every song
              ever built, and every playlist assembled from it.
            </p>

            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-end',
                marginBottom: 28,
              }}
            >
              <div className="cf-fld" style={{ minWidth: 280, maxWidth: 280 }}>
                <span className="cf-fld-lbl">Artist / show</span>
                <div className="cf-input">
                  <input
                    placeholder="e.g. Nova Wolf"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && create()}
                  />
                </div>
              </div>
              <button
                className="cf-btn primary"
                onClick={create}
                disabled={!name.trim()}
              >
                + New project
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="empty-state">No projects yet.</div>
            ) : (
              <div className="project-grid">
                {projects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onOpen={() => setProjectId(p.id)}
                    onDelete={() => setConfirming(p.id)}
                  />
                ))}
              </div>
            )}
          </div>
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

/* The pip is identity, not status — stable per project so the same show
   keeps the same colour every time you open the app. */
const PIPS = ['var(--primary)', 'var(--info)', 'var(--success)'];

function pipFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PIPS[h % PIPS.length];
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="cf-card">
      <button className="project-card-btn" onClick={onOpen} style={{ flex: 1 }}>
        <div className="cf-card-body">
          <div className="cf-card-eyebrow">
            <span className="cf-pip" style={{ background: pipFor(project.id) }} />
            Project
          </div>
          <h3 className="cf-card-title">{project.name}</h3>
          <div className="cf-card-meta">
            <div>
              <span className="cf-lbl">Songs</span>
              <span className="cf-v">{project.bucket.length}</span>
            </div>
            <div>
              <span className="cf-lbl">Playlists</span>
              <span className="cf-v">{project.playlists.length}</span>
            </div>
          </div>
        </div>
      </button>
      <div className="cf-card-foot">
        <button className="cf-btn sm ghost" onClick={onOpen}>
          Open
        </button>
        <button className="cf-btn sm danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </article>
  );
}
