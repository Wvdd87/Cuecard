import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../lib/store';
import type { BlockGroup, BlockRow, BlockType, Song } from '../../lib/types';
import { BLOCKS, BLOCK_GROUPS, blocksInGroup } from '../../lib/types';
import { rowsOf, tagsOf, lineOf } from '../../lib/blocks';
import { cameraColor } from '../../lib/camera';
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
    <div className="section" style={{ maxWidth: 760 }}>
      <input
        className="editor-title"
        placeholder="Song title"
        value={song.title}
        onChange={(e) => set({ title: e.target.value })}
      />
      <div className="row" style={{ marginBottom: 20 }}>
        <span className="cf-badge info">
          Used in {usedIn} playlist{usedIn === 1 ? '' : 's'}
        </span>
        <span className="help">Edits here update everywhere it's used.</span>
        <div className="spacer" />
        <button className="cf-btn sm danger" onClick={onDelete}>
          Delete song
        </button>
      </div>

      {/* Repositioning — not a block. A property of the transition. */}
      <div className="repo-editor">
        <div className="title">Camera repositioning</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div className="lede">
              ● <b>During</b> this song — pinned in the fixed reposition band,
              whole song long.
            </div>
            <input
              className="field"
              placeholder="e.g. CAM 3 → downstage right after 2nd chorus"
              value={song.repositionDuring}
              onChange={(e) => set({ repositionDuring: e.target.value })}
            />
          </div>
          <div>
            <div className="lede">
              ▼ <b>After</b> this song — full-page card before the next. Cannot
              be skipped past.
            </div>
            <input
              className="field"
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
        <span className="eyebrow">{group}</span>
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
  children,
}: {
  block: BlockType;
  children: React.ReactNode;
}) {
  return (
    <div className="block-card">
      <header>
        <span className="name">{BLOCKS[block].label}</span>
        <span className="hint">{BLOCKS[block].hint}</span>
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
  const hasNote = cols.length > 2;
  const add = () => onChange([...rows, { id: uid(), a: '', b: '', c: '' }]);
  const template = hasNote ? '86px 1fr 1fr 28px' : '86px 1fr 28px';

  const patch = (i: number, key: 'a' | 'b' | 'c', v: string) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));

  return (
    <BlockCard block={block}>
      <div className="editor-rows">
        {rows.map((row, i) => {
          const color = cameraColor(row.a);
          return (
            <div
              key={row.id}
              className="editor-row"
              style={{ gridTemplateColumns: template }}
            >
              {/* Camera cell carries the reserved camera colour, so the
                  identity you read live is the identity you set here. */}
              <div className="cam-cell">
                <span
                  className="cam-dot"
                  style={{ background: color ?? 'var(--txt-dim)' }}
                />
                <input
                  value={row.a}
                  placeholder={cols[0]?.placeholder ?? 'CAM'}
                  onChange={(e) => patch(i, 'a', e.target.value)}
                />
              </div>
              <input
                className="cell-input"
                placeholder={cols[1]?.placeholder ?? ''}
                value={row.b}
                onChange={(e) => patch(i, 'b', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && i === rows.length - 1) add();
                }}
              />
              {hasNote && (
                <input
                  className="cell-input note"
                  placeholder={cols[2]?.placeholder ?? ''}
                  value={row.c}
                  onChange={(e) => patch(i, 'c', e.target.value)}
                />
              )}
              <button
                className="icon-x"
                aria-label="Remove row"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          );
        })}
        <button
          className="cf-btn sm"
          style={{ alignSelf: 'flex-start', marginTop: 2 }}
          onClick={add}
        >
          + row
        </button>
      </div>
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
      <div className="tag-field">
        {tags.map((t, i) => (
          <span className="cf-tag" key={`${t}-${i}`}>
            {t}
            <button
              className="cf-x"
              onClick={() => onChange(tags.filter((_, j) => j !== i))}
              aria-label={`Remove ${t}`}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          className="tag-input"
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
        className="field sans"
        maxLength={max}
        placeholder="One short line"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mono-sm" style={{ marginTop: 5 }}>
        {value.length}/{max}
      </div>
    </BlockCard>
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
        <span className="eyebrow">Reference</span>
        <span className="rule" />
      </div>
      <div className="imagebox">
        {url && <img src={url} alt="Reference" />}
        <div className="cap">
          screen content / camera framing · prep only, never shown live
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="cf-btn sm" onClick={() => input.current?.click()}>
            {url ? 'Replace' : 'Add image'}
          </button>
          {url && (
            <button
              className="cf-btn sm danger"
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
    </>
  );
}
