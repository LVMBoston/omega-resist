

# Deck Editor Layout: Independent Scrolling

**Status**: Planned
**Date**: 2026-02-27

## Summary

Update the Deck Editor's three-column layout so the left slide-thumbnail pane scrolls independently while the center (Selected Slide preview) and right (Slide Properties) panes remain fixed/sticky on screen.

## Current State

The layout is a CSS grid: `grid-cols-[300px_1fr_300px]` with three `<Card>` children. All three columns scroll with the page -- nothing is sticky or independently scrollable.

## Changes

### Single file: `src/pages/DeckEditor.tsx`

**1. Make the outer grid fill the viewport height**

Change the grid container (line ~1060) to fill remaining height:
```
grid grid-cols-1 lg:grid-cols-[300px_1fr_300px] gap-6
```
becomes:
```
grid grid-cols-1 lg:grid-cols-[300px_1fr_300px] gap-6 lg:h-[calc(100vh-180px)]
```
(The 180px accounts for the header/toolbar area above.)

**2. Left pane -- independently scrollable**

Wrap the left `<Card>`'s `<CardContent>` so it scrolls within its column:
- Add `overflow-hidden h-full` to the Card
- Add `overflow-y-auto h-full` to the CardContent

**3. Center and Right panes -- fixed/sticky**

- Add `h-full overflow-hidden` to both the center and right `<Card>` elements
- Add `overflow-y-auto h-full` to their CardContent so content fits without pushing the page

This keeps all three panes locked in position. Only the left pane's slide list will scroll when it overflows.

## Technical Details

- No new dependencies or components needed
- Only Tailwind class changes on existing elements
- The `selectedSlide` state already links the left pane selection to center/right display -- no logic changes needed
- The DnD context for drag-reordering will continue to work within the scrollable left pane

