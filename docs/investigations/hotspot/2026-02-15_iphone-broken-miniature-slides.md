# Fix: iPhone Broken/Miniature Slides on Spread-the-Word and Data Templates

**Date:** 2026-02-15

## Problem

On iPhone:
1. **Portrait**: The "Spread-the-Word" (interactive_share) slide shows a broken/blank image on first load
2. **Landscape (after rotation)**: The slide renders as a tiny miniature
3. **Subsequent Data Template slides**: Also render as miniatures after rotation
4. **Data Templates invisible**: After initial fix attempt using `w-full h-full`, Data Templates became completely invisible in portrait

## Root Cause

The `deck-slide-container` CSS class used `aspect-ratio: 9/16` with only `max-width`/`max-height` constraints and no explicit `width`/`height` in portrait mode. In iOS Safari's flexbox layout engine, this resolves to zero dimensions, causing all children with percentage-based sizing (`w-full h-full`) to collapse to 0×0.

1. **Portrait**: Container has no explicit dimensions → iOS flex child resolves to 0×0 → slides invisible.

2. **Landscape**: The landscape media query set `height: 100dvh` explicitly, giving the container a starting dimension → slides become visible. But the 9:16 ratio makes the container very narrow (e.g., 219px on iPhone landscape).

3. **Sticky miniature state**: After rotation back to portrait, iOS Safari doesn't always trigger proper relayout of the `aspect-ratio` container, keeping subsequent slides small.

## Fix (3 Parts)

### Part 1: Explicit computed container dimensions (CSS)
**File:** `src/index.css`

Replace `aspect-ratio: 9/16` + `max-*` constraints with explicit `min()` calculations that compute the largest 9:16 rectangle fitting the viewport. This eliminates iOS Safari's flexbox sizing ambiguity entirely.

```css
/* Before (broken on iOS) */
.deck-slide-container {
  max-width: 100%;
  max-height: 100dvh;
  aspect-ratio: 9 / 16;
}

/* After (explicit dimensions, works everywhere) */
.deck-slide-container {
  width: min(100vw, calc(100dvh * 9 / 16));
  height: min(100dvh, calc(100vw * 16 / 9));
  max-width: 100%;
  max-height: 100dvh;
}
```

**Why this works:** `min()` picks the smaller of (a) viewport width and (b) height-derived width, ensuring the 9:16 rectangle never exceeds either viewport dimension. No `aspect-ratio` property needed — the ratio is baked into the calculations. Both portrait and landscape orientations are handled by the same rule (no media query needed).

### Part 2: Fix InteractiveShareSlide image sizing
**File:** `src/components/InteractiveShareSlide.tsx`

Change the image from `max-w-full max-h-full` to `w-full h-full` to match how regular slides render.

```diff
- className="max-w-full max-h-full object-contain"
+ className="w-full h-full object-contain"
```

### Part 3: Add orientation-change handlers
**File:** `src/components/InteractiveSlideOverlay.tsx`

Add an `orientationchange` event listener alongside the existing `resize` listener. iOS Safari fires `orientationchange` but sometimes delays `resize`, so listening to both ensures hotspot positions recalculate after rotation.

**File:** `src/pages/DeckViewer.tsx`

Add a gentle `orientationchange` listener that reads `offsetHeight` on slide containers to trigger layout recalculation. Uses a simple property read (not `display: none` toggle, which caused additional rendering issues).

## Files Changed

| File | Change |
|------|--------|
| `src/index.css` | Replace `aspect-ratio` + `max-*` with explicit `min()` width/height calculations |
| `src/components/InteractiveShareSlide.tsx` | Change img className from `max-w-full max-h-full` to `w-full h-full` |
| `src/components/InteractiveSlideOverlay.tsx` | Add `orientationchange` event listener for hotspot repositioning |
| `src/pages/DeckViewer.tsx` | Add gentle `orientationchange` handler (offsetHeight read) |

## Iteration History

1. **Attempt 1**: Changed img to `w-full h-full` + aggressive `display: none` reflow on orientation change → Data Templates became completely invisible in portrait (container had no explicit dimensions for `h-full` to resolve against)
2. **Attempt 2 (final)**: Replaced CSS `aspect-ratio` approach with explicit `min()` width/height calculations → container always has computable dimensions, eliminating the iOS flexbox sizing bug at its source

## Testing

1. Scan QR code on iPhone in portrait mode
2. Swipe to Spread-the-Word slide — should render full-size, not blank
3. Rotate to landscape — slide should resize properly, not miniaturize
4. Rotate back to portrait — should return to full-size
5. Swipe to Data Template slide — should render normally in both orientations

## Status

- [x] Implementation complete (v2 — explicit min() dimensions)
