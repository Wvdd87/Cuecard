/**
 * Camera identity.
 *
 * The design system reserves eight hues exclusively for camera sub-tracks —
 * nothing else in the app may use them, which is what lets the operator read
 * "that's camera 3" off a colour instead of a numeral. Cameras beyond eight
 * wrap around the palette rather than falling back to grey, and each camera
 * is locked to its hue: never recoloured, anywhere.
 */

export function cameraNumber(cam: string): number | null {
  const n = parseInt(cam, 10);
  return Number.isFinite(n) ? n : null;
}

export function cameraColor(cam: string): string | null {
  const n = cameraNumber(cam);
  if (n === null) return null;
  const i = (((n - 1) % 8) + 8) % 8 + 1;
  return `var(--cam${i})`;
}

/**
 * Badge label: two-digit zero-padded, per the kit's camera badge. Anything
 * that isn't a camera number (a blank field, or a label like "ALL") keeps its
 * own text and renders greyscale — non-camera tracks stay quiet by design.
 */
export function cameraLabel(cam: string): string {
  const n = cameraNumber(cam);
  if (n === null) return cam;
  return String(Math.abs(n)).padStart(2, '0');
}
