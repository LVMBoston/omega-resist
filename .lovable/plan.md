

# Fix: iPad Slide Clipping in Both Orientations

## Problem

The `.deck-slide-container` CSS causes the slide to overflow its parent in both orientations on iPad:

- **Portrait**: `width: 100%` + `aspect-ratio: 9/16` makes the container taller than the viewport (e.g., 820px wide produces a 1457px tall container, but the screen is only ~1180px). The bottom is clipped by `overflow-hidden` on the parent.
- **Landscape**: `height: 100%` uses `100vh`, which on Safari includes the area behind the toolbar/address bar, causing slight bottom clipping.

## Solution

Constrain the container in both dimensions so it never exceeds the viewport, using `max-height` and `max-width` alongside `dvh` (dynamic viewport height) for Safari compatibility.

## Changes

### 1. `src/index.css` — Update `.deck-slide-container`

Replace the current rules with dimension-constrained versions:

```css
.deck-slide-container {
  /* Fill available space but never overflow */
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100dvh; /* dvh respects Safari toolbar */
  aspect-ratio: 9 / 16;
  /* When aspect-ratio conflicts with max constraints, 
     object-fit on child img handles the rest */
}

@media (orientation: landscape) {
  .deck-slide-container {
    height: 100dvh;
    width: auto;
    max-width: 100%;
    max-height: 100dvh;
    aspect-ratio: 9 / 16;
  }
}
```

The key changes:
- Add `max-height: 100dvh` in portrait mode so the 9:16 container stops growing before it overflows the viewport
- Use `dvh` units instead of `vh` to account for Safari's dynamic toolbar
- Both orientations are now bounded in both dimensions

### 2. `src/pages/DeckViewer.tsx` — Update `main` to use `dvh`

Change `h-screen` (which uses `100vh`) to use dynamic viewport height:

```tsx
<main className="flex items-center justify-center bg-black overflow-hidden"
      style={{ height: '100dvh' }}>
```

This ensures the outermost container also respects Safari's dynamic toolbar height.

### No other changes needed
- The snapshot `<img>` inside `StatsPageSlide` already uses `max-w-full max-h-full object-contain`, so once the container is properly sized, the image will scale to fit without clipping.

