# SSR ↔ Editor Text Parity Hardening

Status: Approved & Implemented
Date: 2026-06-24

## 1. Problem

The Stoddard campaign snapshot taken less than a minute before the user's
report still showed clipped single-line SVG text in the three tan title
boxes, even though earlier work had introduced word-wrap into the
plain-text branch of `render-stats-snapshot`. The fresh snapshot proved
the deployed renderer still diverged from the Deck Editor for several
style fields.

## 2. Root cause

The standard (non-rich-text) hotspot branch in
`supabase/functions/render-stats-snapshot/index.ts` still hard-coded
several values that the Deck Editor (`StatsPageSlide.tsx`) reads from
`liveNumberStyle`:

2a. `padding` — editor honors it; SSR ignored it and used a 4 px sliver
only for wrap math.

2b. `borderRadius` — editor honors it; SSR always rendered `rx="2"`.

2c. `fontFamily` — editor falls back to the system stack; SSR hard-coded
`Inter, sans-serif`, so character widths and the wrap heuristic
disagreed.

2d. `fontWeight` — editor defaults to `700` and passes raw values; SSR
collapsed anything not exactly `bold`/`700` to `normal` and defaulted to
`normal`.

2e. `color` — editor defaults to `#1a1a1a`; SSR defaulted to `#000000`.

## 3. Fix

3a. Standard branch now reads `style.padding`, `style.borderRadius`,
`style.fontFamily`, and raw `style.fontWeight`; defaults align with the
editor.

3b. Padding is honored both as a text inset (left/right anchor X,
top/bottom vertical-align Y) and inside the word-wrap width
calculation. A minimum 4 px sliver is retained for wrap math so a
zero-padding hotspot still wraps sensibly.

3c. Background `<rect>` uses parsed `borderRadiusPx` for `rx`.

3d. Added a renderer version marker
(`RENDERER_VERSION = "2026-06-24-parity-2"`) logged at the start of
every render so we can confirm from edge logs which build handled a
given snapshot.

## 4. Parity harness extension

`src/pages/ParityHarness.tsx` gains §2.8 Stoddard regression cases that
mirror the user's three-box layout: a wide title box that must wrap to
two lines, a narrow "Last updated:" label, a timestamp value that must
wrap, and an "EDT note" that must wrap. These are addressable as
`/parity-harness?case=2.8a` … `2.8d`.

## 5. Verification

5a. Edge function redeployed.

5b. User triggers Server Refresh on the affected campaign and confirms
the title and "Last updated" boxes wrap rather than clip.

5c. Edge logs should show the new `v=2026-06-24-parity-2` marker on the
fresh render.

5d. `/parity-harness?section=2.8` shows side-by-side parity for the
plain-text regression cases.

## 6. Files touched

- `supabase/functions/render-stats-snapshot/index.ts`
- `src/pages/ParityHarness.tsx`
- `docs/decisions/snapshots/2026-06-24_ssr-editor-text-parity-hardening_feature-doc_lovable.md` (this file)
