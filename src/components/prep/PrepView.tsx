import { useState } from 'react';
import { useStore } from '../../lib/store';
import { ProjectsScreen } from './ProjectsScreen';
import { SongsTab } from './SongsTab';
import { PlaylistsTab } from './PlaylistsTab';
import { DisplayPopover } from './DisplayPopover';

type Tab = 'songs' | 'playlists';

export function PrepView() {
  const projectId = useStore((s) => s.session.projectId);
  const project = useStore((s) =>
    s.projects.find((p) => p.id === s.session.projectId),
  );
  const setProjectId = useStore((s) => s.setProjectId);
  const [tab, setTab] = useState<Tab>('playlists');

  if (!projectId || !project) return <ProjectsScreen />;

  return (
    <div className="prep">
      <div className="prep-bar">
        <button
          className="wordmark"
          onClick={() => setProjectId(null)}
          title="All projects"
        >
          cuecard
        </button>
        <span className="prep-title">{project.name}</span>

        <div className="tabs" role="tablist">
          {(
            [
              ['playlists', 'Playlists'],
              ['songs', `Bucket · ${project.songs.length}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              className="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="spacer" />
        <DisplayPopover />
      </div>

      <div className="prep-body">
        {tab === 'songs' && <SongsTab project={project} />}
        {tab === 'playlists' && <PlaylistsTab project={project} />}
      </div>
    </div>
  );
}
