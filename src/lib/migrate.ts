import type { BlockRow, GridCell, Project, ScreenRow } from './types';
import { GRID_COLS, GRID_ROWS, REPOSITION, repositionCell } from './types';
import { DEFAULT_LAYOUT, emptyBlocks } from './defaults';
import { uid } from './util';

/**
 * Persisted-state migrations.
 *
 * This data sits on a working device between shows, so a schema change has to
 * convert it, never reset it. Each step is one version bump and must be safe
 * to run against partially-shaped data — anything unrecognised falls back to
 * an empty value rather than throwing.
 */

export const STORE_VERSION = 4;

interface LegacyRow {
  id?: string;
  cam?: string;
  preset?: string;
  screen?: string;
  shot?: string;
  note?: string;
}

/** v1 grid was 12 x 8; v2 is 16 x 12. Same proportions, finer steps. */
const SCALE_X = GRID_COLS / 12;
const SCALE_Y = GRID_ROWS / 8;

function scaleCell(c: GridCell): GridCell {
  const x = Math.round(c.x * SCALE_X);
  const y = Math.round(c.y * SCALE_Y);
  return {
    block: c.block,
    x: Math.min(x, GRID_COLS - 1),
    y: Math.min(y, GRID_ROWS - 1),
    w: Math.max(1, Math.min(Math.round(c.w * SCALE_X), GRID_COLS - x)),
    h: Math.max(1, Math.min(Math.round(c.h * SCALE_Y), GRID_ROWS - y)),
  };
}

function toRows(legacy: unknown, b: 'preset' | 'screen' | 'shot'): BlockRow[] {
  if (!Array.isArray(legacy)) return [];
  return (legacy as LegacyRow[]).map((r) => ({
    id: r.id ?? uid(),
    a: r.cam ?? '',
    b: r[b] ?? '',
    c: b === 'preset' ? (r.note ?? '') : '',
  }));
}

/**
 * A cam→screen pair becomes a screen with one segment: "camera 1 feeds LED L"
 * is the same statement as "LED L shows camera 1 for the whole song".
 */
function toScreens(rows: BlockRow[]): ScreenRow[] {
  return rows.map((r) => ({
    id: r.id,
    screen: r.b,
    segments: [{ id: uid(), source: r.a, span: 1 }],
  }));
}

/**
 * v1 -> v2
 *  - row blocks move from named fields (cam/preset/screen/shot) to positional
 *    a/b/c, so a new row-shaped block needs no new type
 *  - the single `note` block splits into intro/ending/energy/avoid/note; the
 *    old text is kept as `note` rather than guessed at
 *  - the template moves from the project to each playlist, and playlists gain
 *    per-song overrides
 *  - grid resolution goes 12x8 -> 16x12
 */
function v1ToV2(projects: unknown): Project[] {
  if (!Array.isArray(projects)) return [];

  return (projects as Record<string, unknown>[]).map((p) => {
    const legacyLayout = Array.isArray(p.layout)
      ? (p.layout as GridCell[]).map(scaleCell)
      : DEFAULT_LAYOUT.map((c) => ({ ...c }));

    const songs = Array.isArray(p.songs) ? p.songs : [];
    const playlists = Array.isArray(p.playlists) ? p.playlists : [];

    return {
      id: String(p.id ?? uid('p_')),
      name: String(p.name ?? 'Untitled'),
      createdAt: Number(p.createdAt ?? Date.now()),

      songs: (songs as Record<string, unknown>[]).map((s) => {
        const b = (s.blocks ?? {}) as Record<string, unknown>;
        return {
          id: String(s.id ?? uid('s_')),
          title: String(s.title ?? ''),
          blocks: {
            ...emptyBlocks(),
            presets: toRows(b.presets, 'preset'),
            camScreen: toScreens(toRows(b.camScreen, 'screen')),
            firstShots: toRows(b.firstShots, 'shot'),
            instruments: Array.isArray(b.instruments)
              ? (b.instruments as string[])
              : [],
            // The old catch-all stays a catch-all. Splitting one line across
            // the new specific blocks would be guessing at the operator's
            // intent, and a wrong guess is worse than no split.
            note: typeof b.note === 'string' ? b.note : '',
          },
          repositionDuring: String(s.repositionDuring ?? ''),
          repositionAfter: String(s.repositionAfter ?? ''),
          hasImage: Boolean(s.hasImage),
          updatedAt: Number(s.updatedAt ?? Date.now()),
        };
      }),

      playlists: (playlists as Record<string, unknown>[]).map((pl) => ({
        id: String(pl.id ?? uid('pl_')),
        name: String(pl.name ?? 'Untitled show'),
        date: String(pl.date ?? ''),
        songIds: Array.isArray(pl.songIds) ? (pl.songIds as string[]) : [],
        // Every playlist inherits what used to be the project-wide template,
        // so nobody's live view changes shape on upgrade.
        layout: legacyLayout.map((c) => ({ ...c })),
        overrides: {},
        createdAt: Number(pl.createdAt ?? Date.now()),
      })),
    };
  });
}

/**
 * v2 -> v3
 *  - the during-song reposition band stops being a fixed strip above the grid
 *    and becomes a placeable cell inside it
 *
 * The band used to occupy its own space above a 12-row grid, so the grid now
 * has that space back. Existing cells are compressed into the rows below the
 * band rather than shifted off the bottom, which keeps a layout's reading
 * order and rough proportions intact.
 */
const BAND_H = 2;

function v2ToV3(projects: unknown): Project[] {
  if (!Array.isArray(projects)) return projects as Project[];

  const withBand = (layout: unknown): GridCell[] => {
    if (!Array.isArray(layout)) return DEFAULT_LAYOUT.map((c) => ({ ...c }));
    const cells = layout as GridCell[];
    if (cells.some((c) => c.block === REPOSITION)) return cells;

    const usable = GRID_ROWS - BAND_H;
    const scaled = cells.map((c) => {
      const y = Math.min(usable - 1, Math.round((c.y * usable) / GRID_ROWS));
      const h = Math.max(
        1,
        Math.min(usable - y, Math.round((c.h * usable) / GRID_ROWS)),
      );
      return { ...c, y: y + BAND_H, h };
    });
    return [repositionCell(), ...scaled];
  };

  return (projects as Project[]).map((p) => ({
    ...p,
    playlists: (p.playlists ?? []).map((pl) => ({
      ...pl,
      layout: withBand(pl.layout),
      overrides: Object.fromEntries(
        Object.entries(pl.overrides ?? {}).map(([id, l]) => [id, withBand(l)]),
      ),
    })),
  }));
}

/**
 * v3 -> v4
 *  - a screen stops being a single camera and becomes a timeline of sources,
 *    because a screen is often fed by a switcher bus (PGM, ME1) and can change
 *    source part-way through a song
 *
 * An existing "camera 1 feeds LED L" is exactly a screen with one segment, so
 * nothing is lost or guessed at.
 */
function v3ToV4(projects: unknown): Project[] {
  if (!Array.isArray(projects)) return projects as Project[];

  return (projects as Project[]).map((p) => ({
    ...p,
    songs: (p.songs ?? []).map((song) => {
      const cs = song.blocks?.camScreen as unknown;
      if (!Array.isArray(cs)) return song;
      // Already a timeline? Leave it.
      const rows = cs as (BlockRow & Partial<ScreenRow>)[];
      if (rows.every((r) => Array.isArray(r.segments))) return song;
      return {
        ...song,
        blocks: {
          ...song.blocks,
          camScreen: rows.map((r) =>
            Array.isArray(r.segments)
              ? (r as unknown as ScreenRow)
              : {
                  id: r.id ?? uid(),
                  screen: r.b ?? '',
                  segments: [{ id: uid(), source: r.a ?? '', span: 1 }],
                },
          ),
        },
      };
    }),
  }));
}

export function migrate(persisted: unknown, version: number): unknown {
  const state = (persisted ?? {}) as Record<string, unknown>;
  if (version >= STORE_VERSION) return state;

  let projects = state.projects;
  if (version < 2) projects = v1ToV2(projects);
  if (version < 3) projects = v2ToV3(projects);
  if (version < 4) projects = v3ToV4(projects);
  return { ...state, projects };
}
