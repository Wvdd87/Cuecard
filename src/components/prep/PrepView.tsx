import { useState } from 'react';
import { useStore } from '../../lib/store';
import { ProjectsScreen } from './ProjectsScreen';
import { SongsTab } from './SongsTab';
import { PlaylistsTab } from './PlaylistsTab';
import { SetupTab } from './SetupTab';
import { TopNav, type NavKey } from './TopNav';

export function PrepView() {
  const projectId = useStore((s) => s.session.projectId);
  const project = useStore((s) =>
    s.projects.find((p) => p.id === s.session.projectId),
  );
  const setProjectId = useStore((s) => s.setProjectId);
  const goLive = useStore((s) => s.goLive);

  const [tab, setTab] = useState<'songs' | 'playlists' | 'setup'>('playlists');
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);

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
        setTab('songs');
        break;
      case 'playlists':
        setTab('playlists');
        break;
      case 'setup':
        setTab('setup');
        break;
      case 'live':
        if (playlist && liveReady) goLive(project.id, playlist.id, 0);
        break;
    }
  };

  return (
    <div className="prep">
      <TopNav
        active={tab}
        project={project}
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
          />
        )}
        {tab === 'setup' && <SetupTab project={project} />}
      </div>
    </div>
  );
}
