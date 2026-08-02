import type { Project } from '../../lib/types';

export type NavKey = 'projects' | 'songs' | 'playlists' | 'setup' | 'live';

/**
 * The app's persistent chrome, per kit §2.1: 56px, edge-to-edge, always
 * carrying a 2px amber underline as a calm system anchor. Items that need a
 * project or a playlist are disabled rather than hidden, so the shell never
 * changes shape underneath the operator.
 */
export function TopNav({
  active,
  project,
  canGoLive,
  onNavigate,
}: {
  active: NavKey | 'songs' | 'playlists' | 'setup';
  project?: Project;
  canGoLive: boolean;
  onNavigate: (key: NavKey) => void;
}) {
  const items: { key: NavKey; label: string; enabled: boolean }[] = [
    { key: 'projects', label: 'Projects', enabled: true },
    { key: 'songs', label: 'Songs', enabled: Boolean(project) },
    { key: 'playlists', label: 'Playlists', enabled: Boolean(project) },
    { key: 'setup', label: 'Screens & cams', enabled: Boolean(project) },
    { key: 'live', label: 'Live', enabled: canGoLive },
  ];

  return (
    <div className="prep-bar">
      <span className="wordmark">CUECARD</span>
      <div className="sep" />
      <nav className="tabs" aria-label="Sections">
        {items.map((it) => (
          <button
            key={it.key}
            className="tab"
            aria-current={active === it.key ? 'page' : undefined}
            disabled={!it.enabled}
            onClick={() => onNavigate(it.key)}
          >
            {it.label}
          </button>
        ))}
      </nav>
      <div className="spacer" />
      {project && <span className="ctx">{project.name}</span>}
    </div>
  );
}
