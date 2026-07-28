/**
 * Camera identity colour.
 *
 * The design system reserves eight hues exclusively for camera sub-tracks —
 * nothing else in the app may use them, which is what lets the operator read
 * "that's camera 3" off a colour instead of a numeral. Cameras beyond eight
 * wrap around the palette rather than falling back to grey.
 *
 * Anything that isn't a number (a blank cam field, or a label like "ALL")
 * gets no dot at all rather than an arbitrary colour.
 */
export function cameraColor(cam: string): string | null {
  const n = parseInt(cam, 10);
  if (!Number.isFinite(n)) return null;
  const i = (((n - 1) % 8) + 8) % 8 + 1;
  return `var(--cam${i})`;
}
