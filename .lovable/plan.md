

# Auto-Detect Deck Orientation from First Image

## Problem
`.deck-slide-container` is hardcoded for portrait (9:16). Landscape decks like "No Kings Falmouth" display incorrectly.

## Plan

### 1. Add `.deck-slide-landscape` CSS class (`src/index.css`)
   a. Add a new class after the existing `.deck-slide-container` block with inverted 16:9 formulas:
   ```css
   .deck-slide-landscape {
     width: min(100vw, calc(100dvh * 16 / 9));
     height: min(100dvh, calc(100vw * 9 / 16));
     max-width: 100%;
     max-height: 100dvh;
   }
   ```

### 2. Auto-detect orientation in `DeckViewer.tsx`
   a. Add `orientation` state (`'portrait' | 'landscape'`), default `'portrait'`.
   b. After `setSlides(slideData)` completes, add a `useEffect` that watches `slides`: find the first image-type slide, load it via `new Image()`, compare `naturalWidth > naturalHeight` → set `'landscape'`.
   c. On the slide container div (line 551), replace the hardcoded `deck-slide-container` class with a dynamic expression: `orientation === 'landscape' ? 'deck-slide-landscape' : 'deck-slide-container'`.

### 3. Update orientation-change reflow handler (line 360)
   a. Also query `.deck-slide-landscape` elements alongside `.deck-slide-container`.

### 4. Archive decision document
   a. Save new file: `docs/decisions/deck-editor/2026-04-02_landscape-orientation-detection_feature-doc_lovable.md`

---

**Files changed:** `src/index.css`, `src/pages/DeckViewer.tsx`, new decision doc.
**No database migration needed.**

