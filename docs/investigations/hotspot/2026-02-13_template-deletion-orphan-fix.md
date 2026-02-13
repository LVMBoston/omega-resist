# Template Deletion Orphan Prevention Fix

**Date:** 2026-02-13  
**Author:** Lovable AI  
**Related Feature:** Interactive Template Repository  
**Project Area:** data-integrity  
**Status:** Implemented

## Problem

Deleting a template from the Interactive Templates repository caused `slide_items.template_id` to become `NULL` via `ON DELETE SET NULL`, breaking Stats Page slides with a "data is null" error. The confirmation message falsely stated "This will not affect decks already using it."

## Changes Made

### 1. Pre-delete linkage check (InteractiveTemplates.tsx)

- Added `handleDeleteClick` callback that queries `slide_items` for any slides referencing the template before showing the delete confirmation.
- Replaced inline `confirm()` with a proper `AlertDialog` that dynamically displays:
  - **If linked:** Warning listing affected deck slugs, with a "Delete Anyway" button.
  - **If unlinked:** Simple "Safe to delete" message.

### 2. Scoped DeckManagement deletes (DeckManagement.tsx)

- Added `.not("slide_id", "is", null)` guard to the "Delete deck" viral config cleanup query (line ~278), ensuring shared repository templates (which have `slide_id = null`) are not accidentally deleted.

### 3. Removed misleading confirmation text

- The old `confirm("Delete this template? This will not affect decks already using it.")` is replaced with context-aware messaging.

## Files Modified

- `src/pages/InteractiveTemplates.tsx` — Added delete confirmation dialog with linkage check
- `src/pages/DeckManagement.tsx` — Scoped deck deletion to per-deck configs only

## Change Log (Other Recent Fixes)

| Date | Change | Files |
|------|--------|-------|
| 2026-02-13 | Template deletion orphan prevention | InteractiveTemplates.tsx, DeckManagement.tsx |
| 2026-02-13 | Leaflet classList cleanup guard | MapHotspotRenderer.tsx |
