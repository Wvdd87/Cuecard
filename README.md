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
Project  (one per artist)
├── bucket     every song ever entered for this artist
└── playlists  named, dated, ordered *references* into the bucket
    ├── layout     the show's default live-view template
    └── overrides  per-song layouts, for songs the default doesn't fit
```

A playlist never copies song content. Edit a song once, it updates in every
playlist that uses it. Duplicate a playlist for the next tour stop and tweak
it — both keep pointing at the same songs.

The live view always runs off a playlist, never off the raw bucket.

### Song content: a library of small blocks

Eleven blocks in three groups, no free text. They are deliberately small and
specific rather than a few big catch-all zones — the editor exists so you can
say exactly what goes where and how much room it gets.

| Group | Blocks |
|---|---|
| Cameras | Presets, First shots, Cam → Screen |
| Watch | Watch, Solos, Hits |
| Structure | Intro, Ending, Energy, Avoid, Note |

Structure is what would otherwise be one "notes" block. Split, because a
paragraph is unreadable in half a second and "the ending" is a different
question from "what not to do".

Each block is one of three shapes — rows, tags, or a single line — so adding
one to the library is a table entry in [types.ts](src/lib/types.ts), not new
rendering code.

A block with no content doesn't render live at all: its grid space is simply
left dark, never an empty placeholder.

### Camera repositioning is not a block

It's a property of the transition, set per song, in two independent forms:

| | Where it shows | Rail marker |
|---|---|---|
| **During** the song | fixed band above the grid, the whole song long | `●` |
| **After** the song | full-page card between this song and the next | `▼` |

The after-song card takes over the header and the entire content stage, so the
next song's cues are unreachable until it's acknowledged — it cannot be skipped
past by accident. The playlist rail deliberately stays visible on it: if the
artist audibles during a changeover, the operator still needs to be able to
jump.

## Live view

```
┌───────────────────────────────────────────────────┐
│ SONG TITLE                             NEXT: ···  │  fixed
├─────────┬─────────────────────────────────────────┤
│ playlist│  reposition band (during-song move)     │  fixed
│ rail    ├─────────────────────────────────────────┤
│ (jump   │                                         │
│  to any │       configurable 16 × 12 grid         │
│  song)  │                                         │
└─────────┴─────────────────────────────────────────┘
```

Title, next-song slot, rail and reposition band are fixed and unmovable. Only
the central grid is configurable.

The grid never reflows. Cell coordinates are explicit, so a song missing a
block leaves a hole rather than shifting everything else. Verified: the grid's
bounding box is identical between a song with a during-move and one without.

The reposition band keeps its height even when a song has no move. Collapsing
it would shift the grid, which is the one thing that breaks the whole point.

## The template editor

**One default template per playlist.** Every song in the show uses it — that
is what keeps the live view consistent song to song. Duplicating a playlist
carries its template forward, so a template stays stable across a run of dates
without being pinned to the artist.

**Per-song overrides.** When one song carries more than the default template
holds, open that song in the same editor and adjust it. The override applies
to that song, in that playlist, only — the default and every other song are
untouched. It starts as a copy of the default, so you're adjusting something
familiar rather than starting from a blank page. "Revert to playlist default"
drops it.

Overridden songs are marked in the running order, and the editor warns when a
song has content in blocks the current layout has nowhere to put.

**Content fits the space, not the other way around.** A block never grows to
fit its content; content that a block is too small to hold shrinks instead of
clipping. You shape the space, the text follows. Scaling only ever goes
downward — letting content also grow to fill spare room put the same type tier
at seven different sizes on one screen, which read as chaos rather than as a
scale.

The preview is a true scale model of the live stage, so what fits in the
editor fits in the room.

### Navigation

| | |
|---|---|
| `space` `→` `↓` `enter` | next song, or into/through a reposition card |
| `←` `↑` | back — symmetric, you pass back through the same card |
| `home` | first song |
| `[` `]` | dimmer / brighter |
| `f` | fullscreen |
| tap the stage | next |
| tap the rail | jump straight to any song |

Rail jumps bypass reposition cards by design: an explicit jump is intentional.

`Escape` only closes the tools popover — leaving the live view mid-show takes a
deliberate button press.

## Prep view

The same data, rendered differently: full detail, editable, and the only place
the reference image appears. Two tabs — **Playlists** (build, reorder,
duplicate, go live, export PDF, edit the template, override a song's layout)
and **Bucket** (song content, reposition flags, images).

The template editor previews against a real song using the real live renderer
and the real fit logic, so what you shape is what you get in the room.

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

Near-black `#000` — including the HTML background before any CSS loads, the
manifest, and the browser theme colour, so launch emits nothing.

**Three type tiers, and every string is exactly one of them.** One size and
weight per tier, everywhere, never chosen per block:

| Tier | What it carries |
|---|---|
| 1 | the one headline value — song name, watch tags, a one-line block |
| 2 | structural content — the rows of a table |
| 3 | labels and meta — block names, row numbers, "NEXT". Never scales, so it is identical in every block on every song |

Secondary information is separated by **brightness and weight, never by a size
of its own**. Monospace is used only where characters have to align in
columns.

**One accent, one meaning: a camera has to physically move.** Reposition
markers in the rail, the during-song band, the reposition card. It is not used
for selection, for the current song, for active controls or for warnings —
those are all carried by brightness. An accent that means two things means
nothing at a glance.

**One container language:** the block is the container — a panel with a
hairline and equal padding on all four sides. Content inside is never boxed
again, with one deliberate exception: tag chips, because "SOLO GTR DRUMS" is
ambiguous without a delimiter.

**Tables look like tables** — fixed columns, so a description starts at the
same x-position whether the value beside it is "P1" or "P7 lock", with
alternating row bands rather than rules.

The live view carries no pagination widget: position is the rail's job and
movement is the keyboard's. The only chrome is one dim button in the rail's
foot.

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
