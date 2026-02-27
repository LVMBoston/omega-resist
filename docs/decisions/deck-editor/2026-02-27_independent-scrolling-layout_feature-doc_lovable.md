# Deck Editor Layout: Independent Scrolling

**Status**: Approved & Implemented
**Date**: 2026-02-27

## Summary

Updated the Deck Editor's three-column layout so the left slide-thumbnail pane scrolls independently while the center (Selected Slide preview) and right (Slide Properties) panes remain fixed/sticky on screen.

## Changes

### Single file: `src/pages/DeckEditor.tsx`

1. **Outer grid** — Added `lg:h-[calc(100vh-180px)]` to fill remaining viewport height.
2. **Left pane** — Added `overflow-hidden h-full` to Card, `overflow-y-auto h-full` to CardContent for independent scrolling.
3. **Center & Right panes** — Added `h-full overflow-hidden` to Cards, `overflow-y-auto h-full` to CardContent to stay fixed in view.

## Technical Details

- Tailwind-only changes, no new dependencies or components
- Existing `selectedSlide` state and DnD context unaffected
- On mobile (< lg), layout remains single-column stacked

## Update — 2026-02-27

### Fix: Header scrolling with content

The outer container used `min-h-screen` and `space-y-6`, causing the entire page to scroll (header included). Updated to a flexbox layout:

- Outer div: `h-screen flex flex-col overflow-hidden` — fills viewport, prevents page scroll.
- Inner wrapper: `flex flex-col flex-1 min-h-0` — header stays fixed, grid fills remaining space.
- Header: `flex-shrink-0` — never collapses.
- Grid: `flex-1 min-h-0` replaces the previous `lg:h-[calc(100vh-180px)]` — dynamically fills remaining height.
