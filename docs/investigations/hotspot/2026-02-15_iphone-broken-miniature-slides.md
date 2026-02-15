# Fix: iPhone Broken/Miniature Slides on Spread-the-Word and Data Templates

**Date:** 2026-02-15

## Problem

On iPhone:
1. **Portrait**: The "Spread-the-Word" (interactive_share) slide shows a broken/blank image on first load
2. **Landscape (after rotation)**: The slide renders as a tiny miniature
3. **Subsequent Data Template slides**: Also render as miniatures after rotation

## Root Cause

The `deck-slide-container` CSS class used `aspect-ratio: 9/16` with only `max-width`/`max-height` constraints and no explicit `width`/`height` in portrait mode. In iOS Safari's flexbox layout engine, this resolves to zero dimensions, causing all children with percentage-based sizing (`w-full h-full`) to collapse to 0×0.

1. **Portrait**: Container has no explicit dimensions → iOS flex child resolves to 0×0 → slides invisible.

2. **Landscape**: The landscape media query set `height: 100dvh` explicitly, giving the container a starting dimension → slides become visible. But the 9:16 ratio makes the container very narrow (e.g., 219px on iPhone landscape).

3. **Sticky miniature state**: After rotation back to portrait, iOS Safari doesn't always trigger proper relayout of the `aspect-ratio` container, keeping subsequent slides small.

## Fix (3 Parts)

### Part 1: Fix InteractiveShareSlide image sizing
**File:** `src/components/InteractiveShareSlide.tsx`

Change the image from `max-w-full max-h-full` to `w-full h-full` to match how regular slides render. This ensures the image fills the container using object-contain, rather than depending on intrinsic image dimensions.

```diff
- className="max-w-full max-h-full object-contain"
+ className="w-full h-full object-contain"
```

### Part 2: Add orientation-change relayout handler
**File:** `src/components/InteractiveSlideOverlay.tsx`

Add an `orientationchange` event listener alongside the existing `resize` listener. iOS Safari fires `orientationchange` but sometimes delays `resize`, so listening to both ensures hotspot positions recalculate after rotation.

### Part 3: Force relayout on orientation change in DeckViewer
**File:** `src/pages/DeckViewer.tsx`

Add an `orientationchange` listener that forces a reflow of the slide container. This prevents iOS Safari from keeping stale layout dimensions after rotation, which causes the "stuck miniature" state for subsequent slides.

## Technical Details

### Why `w-full h-full` works
Regular image slides (positions 1–7) already use `w-full h-full object-contain` and render correctly on iPhone. The `object-contain` property handles aspect ratio preservation, while `w-full h-full` ensures the image fills the container box. The current `max-w-full max-h-full` on InteractiveShareSlide prevents the image from filling the container when iOS hasn't fully resolved parent dimensions.

### Why orientation change matters
iOS Safari handles `aspect-ratio` relayout lazily after rotation. The carousel items and their children can retain stale dimensions from the pre-rotation layout. An explicit dimension recalculation triggered by `orientationchange` ensures all slide containers update their geometry.

## Files Changed

| File | Change |
|------|--------|
| `src/components/InteractiveShareSlide.tsx` | Change img className from `max-w-full max-h-full` to `w-full h-full` |
| `src/components/InteractiveSlideOverlay.tsx` | Add `orientationchange` event listener for hotspot repositioning |
| `src/pages/DeckViewer.tsx` | Add `orientationchange` handler to force container relayout |

## Testing

1. Scan QR code on iPhone in portrait mode
2. Swipe to Spread-the-Word slide — should render full-size, not blank
3. Rotate to landscape — slide should resize properly, not miniaturize
4. Rotate back to portrait — should return to full-size
5. Swipe to Data Template slide — should render normally in both orientations

## Status

- [x] Implementation complete
