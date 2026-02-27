
# Bulk Selection for Slides in Deck Editor

**Status**: Planned
**Date**: 2026-02-27

## Summary

Add checkboxes to each slide thumbnail in the left pane, enabling multi-select for bulk delete and bulk move (reorder) operations. A toolbar appears when slides are checked, offering "Delete Selected" and "Move to Position" actions.

## Changes

### File: `src/pages/DeckEditor.tsx`

**1. Add bulk selection state**

New state variables in the `DeckEditor` component:
- `selectedSlideIds: Set<string>` -- tracks which slides are checked
- `bulkDeleteDialogOpen: boolean` -- controls the bulk delete confirmation
- `bulkMoveDialogOpen: boolean` -- controls the move-to-position dialog
- `bulkMoveTarget: string` -- the target position input

**2. Update `SortableSlide` component**

Add a new `isChecked` prop and `onToggleCheck` callback. Render a checkbox in the top-left area (next to the position badge):
- Checkbox is always visible (not hover-gated) so users can see the multi-select affordance
- Clicking the checkbox toggles selection without changing the preview (center pane)
- Clicking the slide image still sets the single `selectedSlide` for preview

**3. Add a "Select All / Deselect All" toggle**

Place a small checkbox + label row above the slide list (below the upload buttons). When some slides are checked, it shows the count.

**4. Add bulk action toolbar**

When `selectedSlideIds.size > 0`, render a sticky toolbar at the top of the left pane showing:
- "N selected" label
- "Delete" button (opens bulk delete confirmation dialog)
- "Move to..." button (opens a small dialog asking for a target position number; selected slides are moved as a group to that position, other slides shift accordingly)
- "Deselect All" button

**5. Bulk delete handler**

- Filters out all checked slides from `slides`
- Adds non-temp slides to `pendingDeletes`
- Reorders remaining slides sequentially
- Sets `hasChanges = true`
- Clears selection

**6. Bulk move handler**

- Takes the selected slides out of the array
- Inserts them as a contiguous block at the target position
- Reorders all positions sequentially
- Sets `hasChanges = true`

**7. Bulk delete confirmation dialog**

A new `AlertDialog` similar to the existing single-delete one, but saying "Delete N slides?" with appropriate warnings about interactive slides.

## Technical Notes

- No new files or dependencies needed -- all changes are within `DeckEditor.tsx`
- The existing DnD drag-reorder continues to work for individual slides
- The `selectedSlide` (single, for preview) remains independent from `selectedSlideIds` (multi, for bulk ops)
- Checkbox click uses `e.stopPropagation()` to avoid triggering the slide selection for preview
