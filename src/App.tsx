import { useStore } from './lib/store';
import { LiveView } from './components/live/LiveView';
import { PrepView } from './components/prep/PrepView';

export default function App() {
  const brightness = useStore((s) => s.display.brightness);
  const contrast = useStore((s) => s.display.contrast);
  const live = useStore((s) => s.session.live);

  return (
    <div
      className="app"
      style={
        {
          '--app-brightness': brightness,
          '--app-contrast': contrast,
        } as React.CSSProperties
      }
    >
      {live ? <LiveView /> : <PrepView />}
    </div>
  );
}
