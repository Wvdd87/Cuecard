import type { BlockType, Song } from '../../lib/types';
import { BLOCKS } from '../../lib/types';
import { rowsOf, tagsOf, lineOf } from '../../lib/blocks';
import { CameraBadge } from '../CameraBadge';

/**
 * Live renderings of each block. Three renderings, not eleven: a block's
 * `kind` decides how it draws, so adding a block to the library needs no
 * code here.
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
    case 'rows': {
      const rows = rowsOf(song.blocks, block);
      const threeCol = (spec.cols?.length ?? 2) > 2;
      return (
        <div className={threeCol ? 'codetable cols3' : 'codetable cols2'}>
          {rows.map((r, i) => {
            // Alternating band, applied to every cell of the row so it runs
            // unbroken across the columns.
            const band = i % 2 === 1 ? ' band' : '';
            return (
              <Fragmentish key={r.id}>
                <div className={`num${band}`}>
                  <CameraBadge cam={r.a} />
                </div>
                <div className={`val${band}`}>{r.b}</div>
                {threeCol && <div className={`aside${band}`}>{r.c}</div>}
              </Fragmentish>
            );
          })}
        </div>
      );
    }

    case 'tags':
      return (
        <div className="tagrow">
          {tagsOf(song.blocks, block).map((t, i) => (
            <span key={`${t}-${i}`}>{t}</span>
          ))}
        </div>
      );

    case 'line':
      return <div className="linetext">{lineOf(song.blocks, block)}</div>;
  }
}

/** Cells are direct grid children, so rows cannot introduce a wrapper. */
function Fragmentish({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
