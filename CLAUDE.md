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

> **Before changing anything visual**, read *The visual system* below. This UI
> implements the CueFlow design system, and its rules are specific and binding —
> they are not defaults to improve on. The kit itself is at
> `ui-kit/CueFlow UI Kit v2.html` (gitignored, machine-local).

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

- `repositionDuring` → renders in the **reposition cell**, for the whole song.
  There's no timecode to key a countdown off, so it is simply always-visible.
- `repositionAfter` → renders as `Interstitial`, a full page between this song
  and the next.

Adding a "reposition block" to `BlockType` would still be a category error —
these belong to transitions, not to song content. `repositionDuring` *is* laid
out in the grid, but as a `CellKey` (`'reposition'`), not a `BlockType`: it has
no `BLOCKS` entry, no editor of its own, and nothing you can type into it.

**The reposition cell is placeable but never removable.** It can be moved and
resized like anything else, and `ensureReposition()` puts it back on every
layout write — `setLayout`, `setSongLayout`, `startOverride` and
`toggleLayoutBlock` all go through it — so no default template and no per-song
override can drop it. The editor's palette entry for it is locked for the same
reason. A during-song move has to be visible for the whole song, and a
guarantee enforced only in the UI is not a guarantee.

When the song has no during-move the cell simply isn't rendered, like any
empty block; the grid's explicit coordinates keep everything else in place.

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
2. **Emptiness never moves anything.** This used to need a fixed-height
   `.repo-band` strip above the grid; now the band is a cell and the grid's
   explicit coordinates do the work, for it and every block alike.
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

### The visual system — CueFlow design system

**The authority for every visual decision is the CueFlow UI kit at
`ui-kit/CueFlow UI Kit v2.html`.** Open it before designing anything new. It is
gitignored — it lives on the machine, not in the repo — so a clone may not have
it, and the rules below are the durable copy. Treat them as binding even when
the file is absent. If the file is present and disagrees with this section, the
file wins and this section should be corrected.

The mockup this UI was built from (Claude Design project *Cuecard UI mockups*,
`b4410d53-36cd-4218-a90d-31d0ff470b97`) is an application of that kit. For
anything the mockup does not cover, go to the kit rather than inventing.

`src/styles/` is the whole visual layer:

```
tokens/       colors · typography · spacing · effects · base  (verbatim from the DS)
              fonts.css  (the one deviation — see below)
components.css  cf-btn · cf-input · cf-tag · cf-badge · cf-card, ported from the DS bundle
app.css         this app's layout, built only from tokens
index.css       the entry point that orders the above
```

**No raw values below the token layer.** `app.css` and `components.css` may not
introduce a colour, size or radius of their own — if something needs a value the
system doesn't have, that's a design-system question. Two literals survive and
both are deliberate: `#fff` inside the DS's own danger-button rule (ported
verbatim), and `#0c0703` for the reposition card, which the mockup hardcodes
because the system has no token for it.

#### The kit's rules, in the order it states them

**Foundations.** No new colours are ever invented: amber `--primary` =
standby / focus / primary action / key data values; red `--danger` = tally and
destructive; green `--success` = locked / validated; blue `--info` =
neutral information. Spacing is a strict 4px grid and every control height
snaps to **28 / 36 / 44** (`--ctrl-sm|md|lg`). Corners are square everywhere —
`--radius` is `0`; `--radius-pill` is for functional dots only (pips, camera
dots, radios).

**Type.** Three families with fixed jobs: `--sans` (IBM Plex Sans) for body and
help text, `--cond` (Condensed) for headlines, labels, eyebrows and all UI
caps, `--mono` (JetBrains Mono) for timecode, IDs, numbers and any value that
must align. **Body copy never drops below 12px** — the 9/10/11px sizes are the
*label* scale (`--fs-label`, `--fs-label-sm`, `--fs-micro`) and are only for
condensed caps, never for sentences. Numeric values are tabular.

**Controls (kit §1).** Every input ships focus, hover, active, disabled and
error states. **All buttons use condensed caps labels** — there are no bespoke
buttons; use `cf-btn` with one of four hierarchies (primary / secondary /
ghost / danger, plus icon-only) and one of three sizes. Text fields carry a
**monospace value** and **sans helper text underneath**; errors are marked in
tally red but **never as a red fill on the field**. Checkboxes are square,
radios circular, amber fill on select.

**Navigation (kit §2).** The nav bar is **56px** (`--navbar-h`), edge-to-edge,
and **always carries a 2px amber underline at 0.6 opacity** as a calm system
anchor. Layouts must scale 1440 → 768 without restructuring the DOM.

`TopNav` is on *every* screen including the projects list — the shell never
changes shape underneath the operator. Its five destinations are Projects,
Songs, Playlists, Template and Live; items that need a project or a playlist
are **disabled, not hidden**, in `--txt-low` (the kit's disabled ink). Because
Template and Live are nav destinations rather than buttons buried in a screen,
`PrepView` owns the section and editor state and passes it into `PlaylistsTab`
— do not push that state back down.

**Information display (kit §3).** Density is high by design; whitespace earns
its place. **Modals carry a 2px `--primary` top border** and a `--hair3` edge
against an opaque-leaning backdrop. Tooltips use condensed-caps payloads and
should pair with `aria-describedby`.

**Cameras (kit §4).** **Cameras own colour.** The eight hues `--cam1..8` are
reserved exclusively for camera sub-tracks and nothing else in the app may use
them. **Each camera is locked to one hue and is never recoloured.** Anything
that is not a camera stays quiet and typographic — greyscale — so lists read as
one rhythm. The camera badge is the kit's: a **square, two-digit zero-padded number in
mono 800** with tabular figures, dark ink on the camera's hue —
`src/components/CameraBadge.tsx`, with the number→hue mapping living only in
`src/lib/camera.ts`. In the song editor the cam *field itself* carries the hue,
so the identity you set is the identity you read. Sizes are `fluid` (em-based,
so it scales with the row and with `--fit`) and `xs` (the kit's fixed 24px
box). **Never name a size modifier after a layout class** — `.cam-badge.live`
collided with the live view's `.live` root and silently gave every badge
`display: grid`. Tally red is the
loudest signal in the system and **only an on-air state may fill solid red**.

**Feedback (kit §7).** Toasts stack top-right and escalate by severity; solid
red is reserved for show-stopping events.

#### What in the kit does NOT apply to CueCard

The kit is a cockpit for a **timecode-driven** show. CueCard exists precisely
because the music is *not* on timecode, so these parts of the kit describe
components this app must never grow:

- §5 Audio — waveforms, peak meters, LUFS.
- §6 Time & Cues — the timecode display, and especially the **next-fire bar**
  ("grows toward GO", "flips red under 5s") and any countdown.

There is no clock to key any of that off. If a future change seems to want a
countdown, a progress-to-fire bar or a timecode readout, that is a sign the
change has misunderstood the product: information that matters for a whole song
is *always-visible*, never timed. Borrow the kit's **look** freely; do not
borrow its **timing** components.

#### Fonts — the one intentional deviation

The DS's `tokens/fonts.css` `@import`s Google Fonts; ours `@font-face`s the same
latin subsets from `/fonts`. A remote import would put a network round-trip in
the boot path and silently fall back to system-ui in a venue with no wifi —
exactly the failure the reliability spec rules out. Verified: zero external
requests, and all three families still render with the network cut. Add a
weight by downloading the subset into `public/fonts` and adding a `@font-face`,
never by restoring the `@import`.

Live-view type carries `* var(--tier-scale, 1) * var(--fit, 1)`. Both are
behaviour, not style: `--fit` shrinks content a block is too small to hold, and
`--tier-scale` makes the template editor's preview a true scale model of the
stage. See the fit note below before adding a live text style.

### Persistence — split on purpose

- **localStorage** (`zustand/persist`, key `cuecard.v1`) holds everything
  show-critical. It's *synchronous*, so restored state is on the first painted
  frame: no splash, no loading state, no network call between opening the app
  and seeing the cue. Keep it small and keep it in the boot path.
- **IndexedDB** (`src/lib/images.ts`, idb-keyval) holds reference images only.
  They're large, prep-only, and must stay out of the hot path and out of the
  ~5 MB localStorage budget.

`src/lib/migrate.ts` converts persisted state on version bumps. Steps are
cumulative — `migrate` runs every step above the stored version, so v1 data
goes through v1→v2 *and* v2→v3. Prep data sits
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
interstitial, not on load. `--bg` (`#07070a`) is repeated in `index.html`'s
inline `<style>` (before any CSS loads), in the manifest and in `theme-color`,
so the first painted frame is already the system's base. The interstitial is
warm near-black with hazard hatching — "distinct", not "a white card in a dark
room".

**Brightness/contrast** is a CSS `filter` on `.app`, driven by CSS vars from
the store. Avoid `position: fixed` inside it unless you want it positioned
relative to the filtered root.

**Live typography** follows the mockup per block kind: rows are `--mono` so
columns align, tags and one-line blocks are `--cond` 700, labels are `--cond`
caps. See the `--fit` note above before adding any live text style.

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
