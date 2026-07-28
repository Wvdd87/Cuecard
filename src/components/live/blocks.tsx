import type { BlockType, Song } from '../../lib/types';
import { BLOCKS } from '../../lib/types';
import { rowsOf, tagsOf, lineOf } from '../../lib/blocks';

/**
 * Live renderings of each block. Three renderings, not eleven: a block's
 * `kind` decides how it draws, so adding a block to the library needs no
 * code here.
 *
 * Every string carries an explicit tier class. That is the whole type system
 * — nothing in the live view sets its own font-size, so the tier of any piece
 * of text is readable straight off the markup.
 */
export function BlockContent({
  song,
  block,
}: {
  song: Song;
  block: BlockType;
}) {
  const spec = BLOCKS[block];

  switch (spec.kind) {
    /*
     * Tier 2. Always three columns — number, value, description — even when
     * the block only uses two, so descriptions line up at the same
     * x-position on every row and across every table in the app.
     */
    case 'rows': {
      const rows = rowsOf(song.blocks, block);
      const threeCol = (spec.cols?.length ?? 2) > 2;
      return (
        <div className={threeCol ? 'codetable cols3' : 'codetable cols2'}>
          {rows.map((r) => (
            <RowLine key={r.id} n={r.a} value={r.b} note={threeCol ? r.c : undefined} />
          ))}
        </div>
      );
    }

    /* Tier 1 — the watch items are the takeaway, not supporting detail. */
    case 'tags':
      return (
        <div className="tagrow">
          {tagsOf(song.blocks, block).map((t, i) => (
            <span className="t1" key={`${t}-${i}`}>
              {t}
            </span>
          ))}
        </div>
      );

    /* Tier 1 — a one-line block is a single headline statement. */
    case 'line':
      return <div className="notetext t1">{lineOf(song.blocks, block)}</div>;
  }
}

function RowLine({
  n,
  value,
  note,
}: {
  n: string;
  value: string;
  /* Undefined for two-column blocks: the column is not reserved at all
     rather than reserved and left empty. */
  note?: string;
}) {
  return (
    <>
      {/* Row number is meta, not content: tier 3, same size in every block. */}
      <div className="num t3">{n}</div>
      <div className="val t2">{value}</div>
      {/* Supporting context: same tier as the value, dimmer and lighter —
          separated by brightness rather than by a size of its own. */}
      {note !== undefined && <div className="aside t2 sub">{note}</div>}
    </>
  );
}
