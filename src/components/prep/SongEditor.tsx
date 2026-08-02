import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../lib/store';
import type { MilestonePin, Project, Song } from '../../lib/types';
import { CARD_LABELS, CARD_LANES, cameraById } from '../../lib/types';
import { CameraBadge } from '../CameraBadge';
import { TrackEditor } from './TrackEditor';
import { deleteImage, fileToDataUrl, getImage, putImage } from '../../lib/images';

export function SongEditor({
  project,
  song,
  usedIn,
  onDelete,
}: {
  project: Project;
  song: Song;
  usedIn: number;
  onDelete: () => void;
}) {
  const updateSong = useStore((s) => s.updateSong);
  const addPin = useStore((s) => s.addPin);
  const set = (patch: Partial<Song>) => updateSong(project.id, song.id, patch);

  return (
    <div className="section" style={{ maxWidth: 940 }}>
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

      {/* Reposition after the song: its own screen live, not a card. */}
      <RepositionAfter project={project} song={song} onChange={set} />

      <div className="group-head">
        <span className="eyebrow">Milestones</span>
        <span className="rule" />
      </div>
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="help">Add a pin, then set where in the song it sits.</span>
        <div className="spacer" />
        {CARD_LANES.map((t) => (
          <button
            key={t}
            className="cf-btn sm"
            onClick={() => addPin(project.id, song.id, t)}
          >
            + {CARD_LABELS[t]}
          </button>
        ))}
      </div>

      {song.pins.length === 0 ? (
        <div className="help" style={{ marginBottom: 18 }}>
          No milestones yet. First shots are the usual starting point.
        </div>
      ) : (
        <div className="pin-list">
          {[...song.pins]
            .sort((a, b) => a.positionPercent - b.positionPercent)
            .map((pin) => (
              <PinEditor key={pin.id} project={project} song={song} pin={pin} />
            ))}
        </div>
      )}

      <div className="group-head">
        <span className="eyebrow">Screen tracks</span>
        <span className="rule" />
      </div>
      {project.tracks.length === 0 ? (
        <div className="help">
          No screens defined. Add them in the project's Screens settings — they
          are the same on every song.
        </div>
      ) : (
        project.tracks.map((t) => (
          <TrackEditor key={t.id} project={project} song={song} track={t} />
        ))
      )}

      <ImageBlock
        songId={song.id}
        hasImage={song.hasImage}
        onFlag={(v) => set({ hasImage: v })}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function RepositionAfter({
  project,
  song,
  onChange,
}: {
  project: Project;
  song: Song;
  onChange: (patch: Partial<Song>) => void;
}) {
  const repo = song.repositionAfter;
  const toggle = (id: string) => {
    const cams = repo?.cameras ?? [];
    onChange({
      repositionAfter: {
        destination: repo?.destination ?? '',
        cameras: cams.includes(id)
          ? cams.filter((c) => c !== id)
          : [...cams, id],
      },
    });
  };

  return (
    <div className="repo-editor">
      <div className="title">Reposition after this song</div>
      <div className="lede">
        ▼ A full-page card between this song and the next. Cannot be skipped
        past.
      </div>
      <div className="row" style={{ flexWrap: 'wrap', margin: '8px 0' }}>
        {project.cameras.map((c) => {
          const on = repo?.cameras.includes(c.id) ?? false;
          return (
            <button
              key={c.id}
              className={on ? 'chip on' : 'chip'}
              onClick={() => toggle(c.id)}
            >
              <CameraBadge camera={c} size="xs" />
              {c.label}
            </button>
          );
        })}
      </div>
      <input
        className="field"
        placeholder="Destination — e.g. pit, both handheld"
        value={repo?.destination ?? ''}
        onChange={(e) =>
          onChange({
            repositionAfter: e.target.value.trim()
              ? { cameras: repo?.cameras ?? [], destination: e.target.value }
              : undefined,
          })
        }
      />
    </div>
  );
}

function PinEditor({
  project,
  song,
  pin,
}: {
  project: Project;
  song: Song;
  pin: MilestonePin;
}) {
  const updatePin = useStore((s) => s.updatePin);
  const removePin = useStore((s) => s.removePin);
  const patch = (p: Partial<MilestonePin>) =>
    updatePin(project.id, song.id, pin.id, p);
  const data = (d: Partial<MilestonePin['cardData']>) =>
    patch({ cardData: { ...pin.cardData, ...d } });

  return (
    <div className={`pin-edit lane-${pin.cardType}`}>
      <div className="pin-edit-head">
        <span className="kind">{CARD_LABELS[pin.cardType]}</span>
        <span className="help">
          lane {CARD_LANES.indexOf(pin.cardType) + 1} of {CARD_LANES.length}
        </span>
        <div className="spacer" />
        <label className="pos">
          <span className="label-cap">At</span>
          <input
            type="range"
            min={0}
            max={100}
            value={pin.positionPercent}
            onChange={(e) => patch({ positionPercent: Number(e.target.value) })}
          />
          <span className="pct">{Math.round(pin.positionPercent)}%</span>
        </label>
        <button
          className="icon-x"
          aria-label="Remove milestone"
          onClick={() => removePin(project.id, song.id, pin.id)}
        >
          ✕
        </button>
      </div>

      <div className="pin-edit-body">
        {pin.cardType === 'first_shots' && (
          <div className="shot-grid">
            {project.cameras.map((c) => (
              <div className="shot-row" key={c.id}>
                <CameraBadge camera={c} size="xs" />
                <input
                  className="cell-input"
                  placeholder={`${c.label} — leave blank if unused`}
                  value={pin.cardData.shots?.[c.id] ?? ''}
                  onChange={(e) =>
                    data({
                      shots: { ...pin.cardData.shots, [c.id]: e.target.value },
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}

        {(pin.cardType === 'specific_shot' || pin.cardType === 'reposition') && (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <select
              className="field"
              style={{ maxWidth: 150 }}
              value={pin.cardData.camera ?? ''}
              onChange={(e) => data({ camera: e.target.value || undefined })}
            >
              <option value="">camera —</option>
              {project.cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              className="field"
              placeholder={
                pin.cardType === 'reposition' ? 'Destination' : 'Shot'
              }
              value={
                (pin.cardType === 'reposition'
                  ? pin.cardData.destination
                  : pin.cardData.text) ?? ''
              }
              onChange={(e) =>
                data(
                  pin.cardType === 'reposition'
                    ? { destination: e.target.value }
                    : { text: e.target.value },
                )
              }
            />
            {pin.cardData.camera && (
              <CameraBadge camera={cameraById(project, pin.cardData.camera)} size="xs" />
            )}
          </div>
        )}

        {pin.cardType === 'note' && (
          <input
            className="field"
            placeholder="Note"
            value={pin.cardData.text ?? ''}
            onChange={(e) => data({ text: e.target.value })}
          />
        )}
      </div>
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
        <input ref={input} type="file" accept="image/*" hidden
          onChange={(e) => void pick(e.target.files?.[0])} />
      </div>
    </>
  );
}
