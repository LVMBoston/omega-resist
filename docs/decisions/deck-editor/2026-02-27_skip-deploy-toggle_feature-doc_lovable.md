# Add "Skip Deploy" Toggle to Slide Thumbnails

**Status**: Approved & Implemented
**Date**: 2026-02-27

## Summary

Added a checkbox on the right side of each slide thumbnail in the Deck Editor. When checked, the slide is marked as "not to be deployed" — visually dimmed with a "SKIP" overlay badge. The flag is persisted via a `skip_deploy` boolean column on `slide_items`.

## Changes

1. **Database**: Added `skip_deploy boolean NOT NULL DEFAULT false` to `slide_items`.
2. **Slide interface**: Added `skip_deploy: boolean`.
3. **SortableSlide**: Added `isSkipped`/`onToggleSkip` props with a right-side checkbox and semi-transparent overlay with "SKIP" badge when active.
4. **Save logic**: `handleSaveChanges` now persists `skip_deploy` alongside position updates.
