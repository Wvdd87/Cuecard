import type { BlockRow, BlockType, CellKey, Song, SongBlocks } from './types';
import { BLOCKS, isReposition } from './types';

/**
 * Typed access to a block's value.
 *
 * `SongBlocks` keeps one field per block so the persisted shape stays flat and
 * readable, while the spec table's `kind` says how to read it. These three
 * accessors are the only place that correspondence is asserted.
 */

export function rowsOf(blocks: SongBlocks, block: BlockType): BlockRow[] {
  const v = blocks[block];
  return Array.isArray(v) ? (v as BlockRow[]) : [];
}

export function tagsOf(blocks: SongBlocks, block: BlockType): string[] {
  const v = blocks[block];
  return Array.isArray(v) ? (v as string[]) : [];
}

export function lineOf(blocks: SongBlocks, block: BlockType): string {
  const v = blocks[block];
  return typeof v === 'string' ? v : '';
}

/**
 * Whether a song has anything to show for a block. Empty blocks are omitted
 * from the live view entirely — their grid space is simply left dark rather
 * than filled with an empty placeholder.
 */
export function blockHasContent(song: Song, block: BlockType): boolean {
  switch (BLOCKS[block].kind) {
    case 'rows':
      return rowsOf(song.blocks, block).some((r) => r.a || r.b || r.c);
    case 'tags':
      return tagsOf(song.blocks, block).length > 0;
    case 'line':
      return lineOf(song.blocks, block).trim().length > 0;
  }
}

/**
 * Whether a cell has anything to show — the band counts as filled exactly
 * when the song has a during-song move.
 */
export function cellHasContent(song: Song, key: CellKey): boolean {
  return isReposition(key)
    ? song.repositionDuring.trim().length > 0
    : blockHasContent(song, key);
}

/**
 * Blocks the song has content for that a given layout has nowhere to put.
 * Drives the "this song has content the template can't show" warning — the
 * cue that a per-song override is needed.
 */
export function unplacedBlocks(song: Song, placed: CellKey[]): BlockType[] {
  return (Object.keys(BLOCKS) as BlockType[]).filter(
    (b) => blockHasContent(song, b) && !placed.includes(b),
  );
}
