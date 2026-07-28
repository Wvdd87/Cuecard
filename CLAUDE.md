# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                        # dev server (no service worker — offline won't work here)
npm run build                      # tsc -b && vite build
npm run preview                    # serve dist/ — the only way to test offline/PWA behaviour
npm test                           # vitest run
npm test -- -t "reposition card"   # single test / matching describe block
npm run typecheck                  # tsc -b
npm run lint                       # oxlint (config in .oxlintrc.json)
```

Lint is expected to be clean, not just warning-free-ish — the one recurring
warning is `react/only-export-components`, which is why pure helpers live in
`src/lib/` rather than beside the components that use them.

## What this app is

Camera-directing reference for music shows **not on timecode** — every cue is
called manually, in real time. See README.md for the full product rationale.

Two consequences shape nearly every technical decision:

1. **There is no clock to key anything off.** Nothing can be timed, counted
   down, or auto-advanced. Information that matters for a whole song has to be
   *always visible* for that song.
2. **It runs in a dark room with a fraction of a second of look-time.** The
   operator is glancing, not reading, and must be able to hit a screen zone
   from memory.

## Architecture

### Data model (`src/lib/types.ts`)

```
Project ─┬─ songs: Song[]         the "bucket" — every song for this artist
         └─ playlists: Playlist[]
              ├─ songIds: string[]                REFERENCES, not copies
              ├─ layout: GridCell[]               the show's default template
              └─ overrides: Record<songId, GridCell[]>
```

`Playlist.songIds` holds bucket ids. Nothing ever copies song content —
`duplicatePlaylist` shallow-copies the id array on purpose. Editing a song
updates it in every playlist, and the same song may legitimately appear twice
in one playlist (encore reprise), so **never key a list on `song.id` alone** —
use `` `${song.id}-${index}` ``.

Resolution from ids to songs goes through `resolveSession()` / `playlistSongs()`
in `src/lib/store.ts`, which filter out ids with no matching song. A playlist
pointing at a deleted song must degrade, never crash.

### The block library is a spec table

`BLOCKS` in `src/lib/types.ts` is the single source of truth: label, prep hint,
`kind` (`rows` | `tags` | `line`), group, and column layout. Rendering
(`components/live/blocks.tsx`), editing (`prep/SongEditor.tsx`), the palette,
and the PDF all switch on `kind`, so **adding a block is a table entry plus a
field on `SongBlocks` plus a migration** — never new rendering code. Row blocks
share one positional `BlockRow { id, a, b, c }` shape for the same reason.

Blocks are deliberately small and specific. If you find yourself adding a
general-purpose "notes" or "other" block, that's the thing this design exists
to avoid — Structure (intro/ending/energy/avoid/note) is the split-up version
of exactly that.

### Templates and overrides

`layoutFor(playlist, songId)` — `overrides[songId] ?? layout` — is the only
place this resolves, and both the live view and the editor go through it.

- The **playlist** owns the default template. Not the project: that was an
  earlier design, and duplicating a playlist (which copies layout *and*
  overrides) is what carries a template across a run of dates instead.
- An **override** is scoped to (playlist, song), because the same bucket song
  may sit in another playlist built on a completely different default.
- `startOverride` seeds from the default and is idempotent — it must never
  clobber an override that already exists.
- Editing the default must leave overridden songs untouched. That's the point
  of an override and it's covered by tests.

### Camera repositioning is not a block

It's a property of the transition, stored on the song as two independent
strings (empty = none). A song may have both:

- `repositionDuring` → renders in the fixed band above the grid, for the whole
  song. There's no timecode to key a countdown off, so it is simply
  always-visible.
- `repositionAfter` → renders as `Interstitial`, a full page between this song
  and the next.

Adding a "reposition block" to `BlockType` would be a category error — these
belong to transitions, not to song content, and they render in fixed regions
that the grid config cannot move.

### Navigation state machine (`next` / `prev` / `jumpTo` in `store.ts`)

`session.interstitial` is a boolean parked *on* `session.index`, not a separate
index. The rules, all covered by `src/lib/store.test.ts`:

- Forward onto a song with `repositionAfter` lands on the interstitial first —
  you cannot reach the next song without passing through it.
- Backward is symmetric: you pass back through the same card.
- No interstitial after the final song.
- `jumpTo` (the rail) **bypasses interstitials by design** — an explicit jump
  is intentional, and the operator needs it when the artist audibles.

Change any of this and the tests should be updated deliberately, not patched
to match.

### Two renderings, one dataset

`PrepView` and `LiveView` render the same songs. Prep is full-detail and
editable and is the *only* place reference images appear. Live is stripped to
fixed regions plus the configured grid, and never loads images. The template
editor's preview uses the real live renderer and the real fit logic, so it
stays honest — don't fork a simplified preview renderer.

### Fixed-geometry invariants — the things most likely to be broken by accident

The live layout must look structurally identical on every song in a playlist.
Three mechanisms enforce this; all three are load-bearing:

1. **`.live-grid` cells use explicit `gridColumn`/`gridRow` coordinates** from
   `layoutFor(playlist, song.id)`. A block with no content is *not rendered* (`blockHasContent`
   in `src/lib/blocks.ts`), leaving its space dark. Never switch to
   auto-placement, flex, or any "collapse empty cells" behaviour.
2. **`.repo-band` keeps its height even when the song has no during-move.**
   Collapsing it would shift the whole grid between songs.
3. **`useFitToBox` in `src/lib/fit.ts`** shrinks cell content that a block is
   too small to hold, so a block never has to grow to fit its content.
   Binary search over a `--fit` multiplier, written straight to the DOM (no
   React renders), re-run by a `ResizeObserver`. `FIT_MAX` is **1**: fitting
   only ever shrinks. It used to grow content to fill spare room too, which
   put the same tier at seven different sizes on one screen. Nothing in a
   live cell may use `text-overflow: ellipsis` — a self-truncating child
   measures as "fitting" and silently hides a cue instead of scaling.

There is a browser-level check for this: the `.live-grid` bounding box must be
identical between a song with a during-move and one without.

**Grid dimensions come from `GRID_COLS`/`GRID_ROWS` via the `GRID_VARS` inline
style**, not from hardcoded `repeat()` in CSS. Hardcoding them once already
caused a silent bug where every row past the eighth collapsed to auto height.

### The visual system — three tiers, one accent, one container

Defined in `src/styles.css`. It is a system, not a set of per-block choices;
the failure mode it exists to prevent is every block quietly acquiring its own
size, colour and box.

**Three tiers, and every string is exactly one of them.** Applied as `.t1` /
`.t2` / `.t3` classes in the markup, so the tier of any string is readable off
the JSX and auditable in the DOM. Nothing in the live view sets its own
`font-size`.

| | What | Treatment |
|---|---|---|
| `.t1` | the one headline value — song name, watch tags, a one-line block | largest, brightest, sans, weight 700 |
| `.t2` | structural content — the rows of a table | one medium size, mono (alignment) |
| `.t3` | labels and meta — block names, row numbers, "NEXT" | 11px, uppercase, dim, **never scales** |

`.sub` is the only modifier: same tier, dimmer and lighter. Secondary
information is separated by brightness, never by a size of its own. If
something seems to need a fourth size, it should be split or merged instead.

Mono is used *only* where characters must align in columns. That is the whole
rule for font family.

**`--fit` must appear in a real property, never inside a `:root` token.** An
unregistered custom property has its `var()` references substituted at the
element that *declares* it, so `--t2-size: calc(... * var(--fit))` on `:root`
resolves `--fit` against `:root`, where it is unset — and silently stops
scaling everywhere. Hence `--t1-base` / `--t2-base` hold plain sizes and the
tier classes write `calc(var(--t2-base) * var(--tier-scale) * var(--fit, 1))`.
Same trap for `em`-based metrics: `.codetable` declares `--cell-y`/`--cell-x`
on the table so they resolve against the table's font-size, not against each
cell — the row-number cell is tier 3 and the value beside it is tier 2, so
cell-declared padding would give one row two different heights.

**`--tier-scale`** is 1 live, and in the template editor is the ratio between
the preview stage and the real one, so the preview is a true scale model:
what fits there fits in the room.

**One accent, one meaning: a camera has to physically move.** Reposition
markers in the rail, the during-song band, the reposition card, and the
reposition fields in prep. Nothing else, in either view — not "selected", not
"active", not "warning". Position in the rail, primary buttons, active tabs
and editor warnings are all carried by brightness and weight instead. The one
exception is `--danger`, on destructive confirmation in prep only.

**One container language: the block is the container** — a panel with a
hairline and the same padding on all four sides. Content inside a block is
never boxed again. The single deliberate exception is tag chips (Watch, Solos,
Hits), because "SOLO GTR DRUMS" is ambiguous without a delimiter, so the box
is doing real work. It applies to all three tag blocks and to nothing else.

**Tables** use two or three columns depending on whether the block has a
description, sized to content (`width: max-content`) so row banding stops at
the table rather than running out into empty space. Banding, not rules: a rule
has to span the full row and ends up drawn past the last column.

**There is no pagination control in the live view.** Position is answered by
the rail and movement by space/arrows; a `◀ ▶ 1/4` widget duplicated both and
invited fiddling mid-song. The only chrome is one tier-3 button in the rail's
foot — the one place a control cannot land on top of a block.

### Persistence — split on purpose

- **localStorage** (`zustand/persist`, key `cuecard.v1`) holds everything
  show-critical. It's *synchronous*, so restored state is on the first painted
  frame: no splash, no loading state, no network call between opening the app
  and seeing the cue. Keep it small and keep it in the boot path.
- **IndexedDB** (`src/lib/images.ts`, idb-keyval) holds reference images only.
  They're large, prep-only, and must stay out of the hot path and out of the
  ~5 MB localStorage budget.

`src/lib/migrate.ts` converts persisted state on version bumps. Prep data sits
on a working device between shows, so a schema change must **convert, never
reset** — losing a show's prep to an app update is the worst failure this app
has. Every step has to survive partially-shaped data; anything unrecognised
falls back to empty rather than throwing. Bump `STORE_VERSION` and add a step.

`bootstrap()` at the bottom of `store.ts` seeds the demo project and repairs
stale sessions. It runs **after** `create()`, via `persist.hasHydrated()` /
`onFinishHydration` — not in `onRehydrateStorage`. With synchronous
localStorage, hydration happens *during* `create()`, when `useStore` is still
in TDZ; touching it there throws silently and the callback never appears to
run.

### Nothing that only matters before the show belongs in the boot path

jsPDF is `await import(...)`-ed inside `exportPlaylistPdf`. It's ~400 kB and
would otherwise quadruple the main chunk. Apply the same rule to anything new
that's prep-only.

## Conventions worth knowing

**No bright surfaces, anywhere, ever.** Not on transitions, not on the
interstitial, not on load. The black background is set in `index.html`'s inline
`<style>` (before any CSS loads), in the manifest, and in `theme-color`. The
interstitial is warm near-black with hazard hatching — "distinct", not "a white
card in a dark room". One accent (amber `--accent`), which reads warm at low
luminance.

**Brightness/contrast** is a CSS `filter` on `.app`, driven by CSS vars from
the store. Avoid `position: fixed` inside it unless you want it positioned
relative to the filtered root.

**Live typography** is monospace, uppercase-ish, tabular. Short codes over
prose. See the `--fit` note above before adding any live text style.

**jsPDF's built-in fonts are Latin-1 only.** `→`, `—`, `·` and friends render
as mojibake, not as nothing. Everything reaching a PDF page goes through
`ascii()` in `src/lib/pdf.ts`. Text is wrapped with `splitTextToSize` against a
measured column width rather than character-count truncation.

**The PDF deliberately ignores the screen template** and prints every block the
song has. The grid exists to put things where the operator's eye already is; on
paper that buys nothing, and dropping a block because it wasn't placed on
screen would lose information exactly when the printout is the last resort.

**Keyboard handling** lives in one `window` listener in `LiveView`. It bails on
`INPUT`/`TEXTAREA`/`SELECT` targets. `Escape` deliberately does *not* leave the
live view — exiting mid-show takes a deliberate button press.

## Scope boundaries

Cuecard is deliberately separate from the timecode-based cue app and the
script-based cueing app, and does not integrate with the camera blueprint or
shot-list tools. Song content is entered directly here. Also out of scope for
v1: multi-device sync of current position, external hardware controllers.
