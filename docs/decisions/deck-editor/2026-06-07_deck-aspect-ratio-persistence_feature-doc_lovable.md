# Persist Deck Aspect Ratio from First Slide

**Status: Approved & Implemented**
**Date: 2026-06-07**

Supersedes the runtime-only orientation detection in
`2026-04-02_landscape-orientation-detection_feature-doc_lovable.md`.

## Problem

Orientation was guessed at render time by racing image loads. Slow networks,
broken thumbnails, or template image_urls could cause the wrong slide to win,
leaving landscape decks (e.g. `thomas-luttig`, 1404×783, ratio 1.793)
displaying inside a 9:16 portrait frame.

There was also no guard preventing mismatched slides from being added to a
deck — only a pixel-dimension match against the first slide's exact pixel
dimensions, which could be bypassed and didn't think in aspect-ratio terms.

## Solution

1. **Persist** the deck's aspect ratio + orientation on the `decks` row, computed
   once from the first slide that successfully decodes.
2. **Read** that persisted value on every subsequent load — no probing.
3. **Reject** new slides whose aspect ratio differs from the deck's by more
   than 2% (relative).

## Implementation

### Database (migration)

Added to `public.decks`:

- `aspect_ratio numeric` — W/H ratio (e.g. 1.7778 = 16:9, 0.5625 = 9:16).
- `orientation text` with check `IN ('landscape','portrait','square')`.

Both nullable; populated lazily on first load.

### Shared helper — `src/lib/deckAspectRatio.ts`

- `loadImageDims(url)` — Promise resolving to `{w,h}` or `null`, skipping
  `solid:` URLs and video extensions.
- `probeFirstDims(urls)` — sequentially tries candidates until one decodes.
- `ratioToOrientation(r)` — `'square'` when `|r−1| < 0.02`, else
  landscape/portrait.
- `ratiosMatch(a, b, tolerancePct = 2)` — relative tolerance comparator.
- `fetchDeckShape(slug)` — returns `{aspectRatio, orientation} | null`.
- `persistDeckShape(slug, shape)` — fire-and-forget update.

### `src/pages/DeckEditor.tsx`

- New `deckAspectRatio` state alongside `deckOrientation`.
- Orientation `useEffect` now calls `fetchDeckShape(slug)` first; on miss,
  probes the ordered slide list and persists the result.
- Preview container applies an inline `aspectRatio` style derived from the
  exact ratio (so a 1.793 deck letterboxes at 1.793, not forced 16:9).
- `validateImage` rejects uploads whose ratio doesn't match the recorded deck
  ratio within ±2%, with a clear toast: *"This slide is W×H (ratio R) but the
  deck is ratio D. All slides in a deck must share the same aspect ratio."*

### `src/pages/DeckViewer.tsx`

- Replaced runtime probe with `fetchDeckShape(slug)`; falls back to probe +
  persist when the row has no recorded shape (older decks).
- Continues to apply `.deck-slide-container` (portrait) or
  `.deck-slide-landscape` (landscape) — square decks use landscape.

## Behavior

- First open of any existing deck records its shape permanently.
- From then on, orientation is deterministic and instant — no image race.
- Mismatched uploads are blocked at the validation stage.
- Solid-color and video slides are exempt (no intrinsic ratio); they inherit
  the deck's recorded ratio.

## Out of Scope

- No tool to convert/letterbox existing mismatched slides.
- No UI to manually override a deck's aspect ratio.

## Files Changed

- `supabase/migrations/*` — added `aspect_ratio`, `orientation` columns.
- `src/lib/deckAspectRatio.ts` — new helper module.
- `src/pages/DeckEditor.tsx` — replaced orientation effect, updated
  `validateImage`, threaded inline aspect-ratio style.
- `src/pages/DeckViewer.tsx` — replaced orientation effect with
  fetch-then-fallback-probe.
