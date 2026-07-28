import { cameraColor, cameraLabel, cameraNumber } from './camera';

/**
 * What can feed a screen.
 *
 * Usually a camera, but a switcher bus — PGM, ME1, ME2, PVW — is just as
 * common: the screen mirrors whatever that bus is doing rather than one fixed
 * camera.
 *
 * Cameras keep their locked hue. Switcher buses deliberately do **not** get a
 * hue: the design system reserves the eight camera colours for cameras alone,
 * and reusing one for a bus would break the thing that lets an operator read
 * "camera 3" off a colour. Buses are filled but neutral — quiet and
 * typographic, per the kit's rule for non-camera tracks — and told apart by
 * their label and a lightness step.
 */

export type SourceKind = 'camera' | 'bus';

export function sourceKind(source: string): SourceKind {
  return cameraNumber(source) === null ? 'bus' : 'camera';
}

/** Two-digit zero-padded for cameras; the label itself for a bus. */
export function sourceLabel(source: string): string {
  const s = source.trim();
  if (!s) return '—';
  return sourceKind(s) === 'camera' ? cameraLabel(s) : s.toUpperCase();
}

/**
 * Neutral steps for switcher buses. Deterministic, so PGM is the same shade
 * every time and two buses on one screen never collide.
 */
const BUS_FILLS = ['var(--surface3)', 'var(--hair2)', 'var(--hair3)'];

function busFill(source: string): string {
  let h = 0;
  for (const ch of source.toUpperCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BUS_FILLS[h % BUS_FILLS.length];
}

export interface SourceFill {
  background: string;
  color: string;
  /** Buses carry a hairline so a neutral fill still reads as deliberate. */
  boxShadow?: string;
}

export function sourceFill(source: string): SourceFill {
  const s = source.trim();
  if (!s) {
    return { background: 'var(--surface2)', color: 'var(--txt-low)' };
  }
  const cam = cameraColor(s);
  if (cam) return { background: cam, color: 'var(--on-primary)' };
  return {
    background: busFill(s),
    color: 'var(--txt-hi)',
    boxShadow: 'inset 0 0 0 1px var(--hair3)',
  };
}
