import type { CSSProperties } from 'react';
import { GRID_COLS, GRID_ROWS } from './types';

/**
 * Grid dimensions travel from the constants into CSS rather than being
 * written twice. Hardcoding `repeat(12, 1fr)` in the stylesheet once already
 * let the CSS drift from the data and silently collapsed every row past the
 * eighth to auto height.
 */
export const GRID_VARS = {
  '--grid-cols': GRID_COLS,
  '--grid-rows': GRID_ROWS,
} as CSSProperties;
