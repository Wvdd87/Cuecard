import type { CameraDefinition } from '../lib/types';

/**
 * The kit's camera badge: a square, two-digit zero-padded number in mono 800
 * with tabular figures, filled with that camera's locked hue.
 *
 * A camera keeps its colour everywhere it is referenced — first shots, a
 * specific shot, a reposition — so it is recognisable without reading the
 * number. `fluid` sizes in `em` so it scales with the text around it; `xs` is
 * the fixed 24px box the kit specifies for dense contexts.
 */
export function CameraBadge({
  camera,
  id,
  size = 'fluid',
}: {
  camera?: CameraDefinition;
  /** Shown when the camera is no longer in the project's list. */
  id?: string;
  size?: 'fluid' | 'xs';
}) {
  const label = (camera?.id ?? id ?? '').replace(/^C/, '') || '—';

  if (!camera) {
    return <span className={`cam-badge ${size} generic`}>{label}</span>;
  }
  return (
    <span
      className={`cam-badge ${size}`}
      style={{ background: camera.badgeColor }}
      title={camera.label}
    >
      {label}
    </span>
  );
}
