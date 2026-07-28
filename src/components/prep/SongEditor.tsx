import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../lib/store';
import type { BlockGroup, BlockRow, BlockType, Song } from '../../lib/types';
import { BLOCKS, BLOCK_GROUPS, blocksInGroup } from '../../lib/types';
import { rowsOf, tagsOf, lineOf } from '../../lib/blocks';
import { uid } from '../../lib/util';
import { deleteImage, fileToDataUrl, getImage, putImage } from '../../lib/images';

export function SongEditor({
  projectId,
  song,
  usedIn,
  onDelete,
}: {
  projectId: string;
  song: Song;
  usedIn: number;
  onDelete: () => void;
}) {
  const updateSong = useStore((s) => s.updateSong);
  const set = (patch: Partial<Song>) => updateSong(projectId, song.id, patch);
  const setBlock = (block: BlockType, value: BlockRow[] | string[] | string) =>
    set({ blocks: { ...song.blocks, [block]: value } });

  return (
    <div className="section" style={{ maxWidth: 800 }}>
      <input
        className="input bare"
        style={{ fontSize: 26, fontWeight: 700, padding: '4px 8px', marginBottom: 6 }}
        placeholder="Song title"
        value={song.title}
        onChange={(e) => set({ title: e.target.value })}
      />
      <div className="row" style={{ marginBottom: 20 }}>
        <span className="hint">
          Used in {usedIn} playlist(s). Edits here apply everywhere.
        </span>
        <div className="spacer" />
        <button className="btn ghost danger" onClick={onDelete}>
          Delete song
        </button>
      </div>

      {/* Repositioning — not a block. A property of the transition. */}
      <div className="repo-editor">
        <div className="label" style={{ marginBottom: 8 }}>
          Camera repositioning
        </div>
        <div className="stack">
          <div>
            <div className="hint" style={{ marginBottom: 4 }}>
              ● <b>During</b> this song — pinned in the live view's fixed
              reposition band for the whole song.
            </div>
            <input
              className="input"
              placeholder="e.g. CAM 3 → downstage right after 2nd chorus"
              value={song.repositionDuring}
              onChange={(e) => set({ repositionDuring: e.target.value })}
            />
          </div>
          <div>
            <div className="hint" style={{ marginBottom: 4, marginTop: 6 }}>
              ▼ <b>After</b> this song — becomes a full-page card between this
              song and the next. Cannot be skipped past.
            </div>
            <input
              className="input"
              placeholder="e.g. CAM 3 + 4 → pit, handheld"
              value={song.repositionAfter}
              onChange={(e) => set({ repositionAfter: e.target.value })}
            />
          </div>
        </div>
      </div>

      {BLOCK_GROUPS.map((group) => (
        <Group key={group} group={group} song={song} setBlock={setBlock} />
      ))}

      <ImageBlock
        songId={song.id}
        hasImage={song.hasImage}
        onFlag={(v) => set({ hasImage: v })}
      />
    </div>
  );
}

function Group({
  group,
  song,
  setBlock,
}: {
  group: BlockGroup;
  song: Song;
  setBlock: (b: BlockType, v: BlockRow[] | string[] | string) => void;
}) {
  return (
    <>
      <div className="group-head">
        <span className="label">{group}</span>
        <span className="rule" />
      </div>
      {blocksInGroup(group).map((block) => {
        const spec = BLOCKS[block];
        switch (spec.kind) {
          case 'rows':
            return (
              <RowsBlock
                key={block}
                block={block}
                rows={rowsOf(song.blocks, block)}
                onChange={(rows) => setBlock(block, rows)}
              />
            );
          case 'tags':
            return (
              <TagsBlock
                key={block}
                block={block}
                tags={tagsOf(song.blocks, block)}
                onChange={(tags) => setBlock(block, tags)}
              />
            );
          case 'line':
            return (
              <LineBlock
                key={block}
                block={block}
                value={lineOf(song.blocks, block)}
                onChange={(v) => setBlock(block, v)}
              />
            );
        }
      })}
    </>
  );
}

function BlockCard({
  block,
  action,
  children,
}: {
  block: BlockType;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="block-card">
      <header>
        <span className="label">{BLOCKS[block].label}</span>
        <span className="hint">{BLOCKS[block].hint}</span>
        <div className="spacer" />
        {action}
      </header>
      <div className="body">{children}</div>
    </div>
  );
}

function RowsBlock({
  block,
  rows,
  onChange,
}: {
  block: BlockType;
  rows: BlockRow[];
  onChange: (rows: BlockRow[]) => void;
}) {
  const cols = BLOCKS[block].cols ?? [];
  const add = () => onChange([...rows, { id: uid(), a: '', b: '', c: '' }]);
  const template =
    cols.map((c) => (c.width ? `${c.width}px` : '1fr')).join(' ') + ' 28px';

  return (
    <BlockCard
      block={block}
      action={
        <button className="btn sm" onClick={add}>
          + row
        </button>
      }
    >
      {rows.length === 0 ? (
        <EmptyNote />
      ) : (
        <div className="grid-rows">
          {rows.map((row, i) => (
            <div
              key={row.id}
              className="grid-row"
              style={{ gridTemplateColumns: template }}
            >
              {cols.map((c) => (
                <input
                  key={c.key}
                  className={c.width ? 'input mono' : 'input mono'}
                  placeholder={c.placeholder}
                  value={row[c.key]}
                  onChange={(e) =>
                    onChange(
                      rows.map((r, j) =>
                        j === i ? { ...r, [c.key]: e.target.value } : r,
                      ),
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && i === rows.length - 1) add();
                  }}
                />
              ))}
              <button
                className="btn ghost"
                aria-label="Remove row"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </BlockCard>
  );
}

function TagsBlock({
  block,
  tags,
  onChange,
}: {
  block: BlockType;
  tags: string[];
  onChange: (t: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const v = draft.trim().toUpperCase();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft('');
  };

  return (
    <BlockCard block={block}>
      <div className="tagfield">
        {tags.map((t, i) => (
          <span className="tag" key={`${t}-${i}`}>
            {t}
            <button
              onClick={() => onChange(tags.filter((_, j) => j !== i))}
              aria-label={`Remove ${t}`}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          className="input mono"
          style={{ width: 150 }}
          placeholder="+ tag"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Backspace' && !draft && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
        />
      </div>
    </BlockCard>
  );
}

function LineBlock({
  block,
  value,
  onChange,
}: {
  block: BlockType;
  value: string;
  onChange: (v: string) => void;
}) {
  const max = BLOCKS[block].maxLen ?? 56;
  return (
    <BlockCard block={block}>
      <input
        className="input"
        maxLength={max}
        placeholder="One short line"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="hint" style={{ marginTop: 5 }}>
        {value.length}/{max}
        {value.length === 0 && ' — empty blocks never appear in the live view'}
      </div>
    </BlockCard>
  );
}

function EmptyNote() {
  return (
    <div className="hint">
      Empty — this block will not appear in the live view at all.
    </div>
  );
}

/** Prep-view only. The live view never loads or shows this. */
function ImageBlock({
  songId,
  hasImage,
  onFlag,
}: {
  songId: string;
  hasImage: boolean;
  onFlag: (v: boolean) => void;
}) {
  const [url, setUrl] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    if (hasImage) void getImage(songId).then((u) => alive && setUrl(u));
    else setUrl(undefined);
    return () => {
      alive = false;
    };
  }, [songId, hasImage]);

  const pick = async (file?: File) => {
    if (!file) return;
    const data = await fileToDataUrl(file);
    await putImage(songId, data);
    setUrl(data);
    onFlag(true);
  };

  return (
    <>
      <div className="group-head">
        <span className="label">Reference</span>
        <span className="rule" />
      </div>
      <div className="block-card">
        <header>
          <span className="label">Reference image</span>
          <span className="hint">
            Screen content / framing. Prep only — never shown live.
          </span>
        </header>
        <div className="body">
          <div className="imagebox">
            {url && <img src={url} alt="Reference" />}
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn sm" onClick={() => input.current?.click()}>
                {url ? 'Replace' : 'Add image'}
              </button>
              {url && (
                <button
                  className="btn sm danger"
                  onClick={async () => {
                    await deleteImage(songId);
                    setUrl(undefined);
                    onFlag(false);
                  }}
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={input}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void pick(e.target.files?.[0])}
            />
          </div>
        </div>
      </div>
    </>
  );
}
