
# Add "Skip Deploy" Toggle to Slide Thumbnails

**Status**: Planned
**Date**: 2026-02-27

## Summary

Add a small checkbox/toggle on the right side of each slide thumbnail in the left pane. When checked, the slide is marked as "not to be deployed" -- visually dimmed with a label. This flag is persisted in the database via a new `skip_deploy` column on `slide_items`.

## Changes

### 1. Database migration -- add `skip_deploy` column

```sql
ALTER TABLE public.slide_items
  ADD COLUMN skip_deploy boolean NOT NULL DEFAULT false;
```

### 2. Update `Slide` interface in `src/pages/DeckEditor.tsx`

Add `skip_deploy: boolean` to the `Slide` interface and include it in the fetch query.

### 3. Update `SortableSlide` component

- Add `isSkipped` prop and `onToggleSkip` callback.
- On the **right side** of the thumbnail (bottom-right area, above the delete button area), render a small checkbox or toggle icon.
- When `isSkipped` is true, overlay the slide with a semi-transparent wash and show a small "Skip" badge.
- Click uses `e.stopPropagation()` and `onPointerDown` stop to avoid triggering drag or slide selection.

### 4. Wire up state and save logic

- Track skip changes in a local map or directly on the `slides` state array.
- On save (`handleSaveChanges`), include `skip_deploy` in the upsert/update calls for each slide.
- The deploy logic can later filter out `skip_deploy = true` slides.

### 5. Visual treatment

- Skipped slides get `opacity-50` and a small red/orange "Skip" badge on the right side.
- The checkbox sits at the right edge of the thumbnail, vertically centered or near the top-right (below the delete button).

## Technical Notes

- Single migration, single file edit (`DeckEditor.tsx`).
- No new dependencies.
- The `skip_deploy` flag is per-slide, persisted to the database, and survives page reloads.
- Existing deploy/snapshot logic can be updated later to filter `skip_deploy = true` slides.
