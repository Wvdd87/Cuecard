import { useState } from 'react';
import { useStore } from '../../lib/store';
import { ProjectsScreen } from './ProjectsScreen';
import { SongsTab } from './SongsTab';
import { PlaylistsTab, type Editing } from './PlaylistsTab';
import { TopNav, type NavKey } from './TopNav';

/**
 * The prep shell. It owns which section is showing and whether a template
 * editor is open, because the top nav needs to drive both — Template is a
 * destination in the design, not just a button inside the playlist screen.
 */
export function PrepView() {
  const projectId = useStore((s) => s.session.projectId);
  const project = useStore((s) =>
    s.projects.find((p) => p.id === s.session.projectId),
  );
  const setProjectId = useStore((s) => s.setProjectId);
  const goLive = useStore((s) => s.goLive);

  const [tab, setTab] = useState<'songs' | 'playlists'>('playlists');
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);

  if (!projectId || !project) return <ProjectsScreen />;

  const playlistId = selectedPlaylist ?? project.playlists[0]?.id ?? null;
  const playlist = project.playlists.find((pl) => pl.id === playlistId);
  const liveReady = Boolean(playlist && playlist.songIds.length > 0);

  const navigate = (key: NavKey) => {
    switch (key) {
      case 'projects':
        setProjectId(null);
        break;
      case 'songs':
        setEditing(null);
        setTab('songs');
        break;
      case 'playlists':
        setEditing(null);
        setTab('playlists');
        break;
      case 'template':
        setTab('playlists');
        setEditing({ kind: 'template' });
        break;
      case 'live':
        if (playlist && liveReady) goLive(project.id, playlist.id, 0);
        break;
    }
  };

  const active: NavKey =
    editing ? 'template' : tab === 'songs' ? 'songs' : 'playlists';

  return (
    <div className="prep">
      <TopNav
        active={active}
        project={project}
        canTemplate={Boolean(playlist)}
        canGoLive={liveReady}
        onNavigate={navigate}
      />

      <div className="prep-body">
        {tab === 'songs' && <SongsTab project={project} />}
        {tab === 'playlists' && (
          <PlaylistsTab
            project={project}
            selected={playlistId}
            setSelected={setSelectedPlaylist}
            editing={editing}
            setEditing={setEditing}
          />
        )}
      </div>
    </div>
  );
}
