# Auto-Detect Deck Orientation from First Image

**Status: Approved & Implemented**
**Date: 2026-04-02**

## Problem

`.deck-slide-container` is hardcoded for portrait (9:16). Landscape decks like "No Kings Falmouth" display incorrectly — they are letterboxed into a portrait container instead of filling the viewport with a 16:9 layout.

## Solution

Auto-detect orientation at runtime by loading the first image-type slide and comparing its natural dimensions. No database schema change required.

## Implementation

### 1. New CSS class (`src/index.css`)
Added `.deck-slide-landscape` with inverted 16:9 formulas alongside the existing `.deck-slide-container` (9:16):

```css
.deck-slide-landscape {
  width: min(100vw, calc(100dvh * 16 / 9));
  height: min(100dvh, calc(100vw * 9 / 16));
  max-width: 100%;
  max-height: 100dvh;
}
```

### 2. Orientation detection (`src/pages/DeckViewer.tsx`)
- Added `orientation` state defaulting to `'portrait'`.
- A `useEffect` watches `slides`: finds the first `type === 'image'` slide, loads it via `new Image()`, and sets `'landscape'` if `naturalWidth > naturalHeight`.
- The slide container div dynamically applies `deck-slide-landscape` or `deck-slide-container`.

### 3. Reflow handler update
- The `orientationchange` handler now queries both `.deck-slide-container` and `.deck-slide-landscape`.

## Behavior

- The first image slide's dimensions determine the container for **all** slides in the deck.
- Mixed-orientation slides will be letterboxed/pillarboxed within the detected container.
- If no image slides exist (all spread-word/vimeo), portrait is used as the default.

## Files Changed

- `src/index.css` — added `.deck-slide-landscape` class
- `src/pages/DeckViewer.tsx` — orientation state, detection useEffect, dynamic class application, reflow handler update
