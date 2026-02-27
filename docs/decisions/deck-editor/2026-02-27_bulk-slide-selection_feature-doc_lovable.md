# Bulk Selection for Slides in Deck Editor

**Status**: Approved & Implemented
**Date**: 2026-02-27

## Summary

Added checkboxes to each slide thumbnail in the left pane, enabling multi-select for bulk delete and bulk move (reorder) operations. A toolbar appears when slides are checked, offering "Delete Selected" and "Move to Position" actions.

## Changes

### File: `src/pages/DeckEditor.tsx`

1. **Bulk selection state** — `selectedSlideIds: Set<string>`, `bulkDeleteDialogOpen`, `bulkMoveDialogOpen`, `bulkMoveTarget`
2. **SortableSlide** — Added `isChecked` + `onToggleCheck` props; renders a checkbox next to the position badge
3. **Select All / Deselect All** — Checkbox + label row above slide list; shows count when some are selected
4. **Bulk action toolbar** — Appears when selection is non-empty with Delete, Move to…, and Deselect buttons
5. **Bulk delete handler** — Filters out checked slides, adds non-temp to `pendingDeletes`, reorders remaining
6. **Bulk move handler** — Extracts selected slides, inserts as contiguous block at target position, reorders
7. **Bulk delete confirmation dialog** — AlertDialog warning about count + interactive slides
8. **Bulk move dialog** — Small dialog with target position input

## Technical Notes

- No new files or dependencies — all changes within `DeckEditor.tsx`
- Existing DnD drag-reorder continues to work for individual slides
- `selectedSlide` (single, for preview) remains independent from `selectedSlideIds` (multi, for bulk ops)
- Checkbox click uses `e.stopPropagation()` to avoid triggering single-slide preview
