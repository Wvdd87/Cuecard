import { cameraColor, cameraLabel } from '../lib/camera';

/**
 * The kit's camera badge: a square, two-digit zero-padded number in mono 800
 * with tabular figures, filled with that camera's locked hue.
 *
 * `fluid` sizes itself in `em` so it scales with the row it sits in — and so
 * with the block's fit multiplier — while `xs` is the fixed 24px box the kit
 * specifies for dense list contexts.
 *
 * A value that isn't a camera number (blank, or a label like "ALL") renders
 * greyscale and typographic: per the kit, only cameras own colour.
 */
export function CameraBadge({
  cam,
  size = 'fluid',
}: {
  cam: string;
  size?: 'fluid' | 'xs';
}) {
  const color = cameraColor(cam);
  const label = cameraLabel(cam);

  if (!color) {
    return <span className={`cam-badge ${size} generic`}>{label || '—'}</span>;
  }
  return (
    <span className={`cam-badge ${size}`} style={{ background: color }}>
      {label}
    </span>
  );
}
