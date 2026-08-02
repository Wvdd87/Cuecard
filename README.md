# Cuecard

Camera-directing reference for music shows that **aren't on timecode**, where
every cue is called manually, by ear and eye. Replaces a Keynote-per-song
workflow.

It is a standalone tool. It is not the timecode-based cue app and not the
script-based cueing app, and it does not integrate with either.

The whole thing is built around one constraint: it is operated in a dark room,
under pressure, with a fraction of a second of look-time. Every decision below
was weighed against that first.

```
npm install
npm run dev        # http://localhost:5173
npm run build      # static, deployable anywhere
npm test           # navigation + data-model tests
```

A demo project is seeded on first run so the shape of the thing is visible
immediately. Delete it whenever.

---

## Model

```
Project ─┬─ cameras    master camera list, each with its own badge colour
         ├─ tracks     screen definitions, identical on every song
         ├─ bucket     every song ever built for this artist
         └─ playlists  named, dated, ordered *references* into the bucket
```

A playlist never copies song content. Edit a song once, it updates in every
playlist that uses it. Duplicate a playlist for the next tour stop and both
keep pointing at the same songs.

## A song is a timeline

The live view for a song is one fully-visible dashboard — everything for that
song on screen at once, no scrolling or scrubbing. The whole idea is steering
the eye left to right: as something happens, focus moves rightward to what's
next.

```
┌──────────────────────────────────────────────────────────────┐
│ SONG TITLE                                    NEXT: ······    │  A
├────────┬─────────────────────────────────────────────────────┤
│ 1 ···  │  first shots  [card]                                │  B
│ 2 ···  │  reposition                    [card]               │
│ 3 ···  │  shot                 [card]                        │
│ 4 ···  │  note                                    [card]     │
│        │  ───●──────────────●──────────●───────────●─────    │
│        ├─────────────────────────────────────────────────────┤
│        │  Center Screen [ IMAG ][ Content ][ IMAG ]          │  C
│        │  Side IMAG     [ Scenic ][ IMAG ]                    │
└────────┴─────────────────────────────────────────────────────┘
```

**Region A** — song title top left, next song top right, and the playlist rail
for jump-anywhere navigation.

**Region B** — milestone pins along the song, each connected up to a cue card.
Four card types: **First shots** (pulls the project's camera list, one short
field each, unused cameras left blank), **Specific shot**, **Reposition** and
**Note**.

A card's horizontal position follows the song's own structure, so it changes
song to song. Its **lane does not**: first shots are always the top band,
reposition always its own, and so on. The operator always knows which band to
check even though where it falls left-to-right varies.

**Region C** — screen tracks. Track definitions are set once at project level
and are identical on every song, so this region never changes shape. Within a
track, blocks always sum to 100% of the song; in prep, adding a block splits
the track and gives you a draggable divider. Tracks don't align to each other
or to the pins above — each is its own independent horizontal grid.

## Reposition

First-class, never a generic note, because missing one is a real production
problem. It renders two ways depending on when it happens:

| | How it shows |
|---|---|
| **After a song** | a full-page screen between this song and the next — outside the timeline layout entirely, and unskippable |
| **During a song** | a Reposition card in its own fixed lane, while the show keeps running |

## Navigation

| | |
|---|---|
| `space` | advance to the next song — the expected path through a show |
| `↑` `↓` | step through the playlist, for when the artist reorders or skips |
| rail click | jump straight to any song |
| `[` `]` · `f` | dimmer / brighter · fullscreen |

All one-handed, without looking away to hunt for a key.

## Colour

Three systems that never overlap, each answering a different question:

- **Accent** (amber) — what is active or selected. Nothing else.
- **Cameras** — eight reserved hues; a camera keeps its colour everywhere it
  appears, so it's recognisable without reading the number.
- **Tracks** — screen content and states, including a consistent treatment for
  black/off. Defined once at project level.

## Reliability

- **State survives everything.** Current playlist, song index, and whether
  you're parked on a reposition card persist across reload, backgrounding,
  sleep and crash. Stored in localStorage, which is synchronous — the restored
  state is on the first painted frame. No splash, no login, no network call
  between opening the app and seeing the cue.
- **Fully offline.** Everything is precached by a service worker on first load.
  Verified with the network cut: reload renders the live view intact.
- **Self-healing state.** A playlist pointing at a deleted song, or an index
  past the end of a shortened set, is repaired at boot rather than showing a
  blank screen.
- **Screen wake lock** while live, re-acquired when the app returns to the
  foreground.
- **Migrations, not resets.** Prep data lives on the device between shows, so
  schema changes convert it. The v1 → v2 upgrade moves the old project-wide
  layout onto every playlist, so no live view changes shape.
- **Paper fallback.** Export any playlist to PDF: running order with every
  reposition flagged, then one page per song. Paper ignores the screen template
  on purpose and prints every block the song has — dropping content because it
  wasn't placed on screen would lose it exactly when this page is the last
  resort.

## Visual system

CueCard implements the **CueFlow** design system — a dark broadcast-cockpit
kit — imported from the Claude Design project *Cuecard UI mockups*. The mockup
is the source of truth for anything visual.

- **Square corners throughout.** CueFlow is a hairline system; the only round
  forms are functional dots.
- **Three typefaces with jobs.** IBM Plex Sans Condensed for headings, labels
  and UI caps; IBM Plex Sans for body; JetBrains Mono for every value, code and
  number, tabular so figures never jitter.
- **Eight camera hues, reserved.** `--cam1..8` belong to cameras and nothing
  else, so a camera is identifiable by colour before you read the numeral.
  Every cam row carries its dot, live and in the editor.
- **Amber is standby/primary/focus** and carries camera repositioning; red is
  destructive only.
- **Strict 4px spacing grid**, control heights snapping to 28/36/44.

Fonts are self-hosted rather than pulled from Google Fonts, because the app has
to look right in a venue with no network — verified with the network cut: zero
external requests and all three families still render.

Content that a block is too small to hold shrinks to fit; a block never grows
to fit its content.

In-app brightness (20–100%) and contrast, independent of the device's own
control, since venues vary enormously.

## Not in v1

No multi-device sync of current position, no integration with the camera
blueprint or shot-list tools, no external hardware controller.

## Stack

React 19 + TypeScript + Vite. Zustand (localStorage) for state, idb-keyval for
reference images — images stay out of the hot path and out of the ~5 MB
localStorage budget. jsPDF, dynamically imported so it never sits in the boot
path. No layout library: the drag/resize grid editor is ~50 lines of pointer
maths, and the live view renders from stored coordinates with plain CSS grid.
Content scaling is a binary search over a `--fit` multiplier, written straight
to the DOM so a re-fit costs no React renders.
