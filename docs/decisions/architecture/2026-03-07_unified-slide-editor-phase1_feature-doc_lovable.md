# Phase 1 — Unified Slide Architecture: Editor UX

- **Status:** Approved & Implemented
- **Date:** 2026-03-07
- **Author:** Lovable AI + project owner

---

## Summary

Implemented the "image-first, auto-detect" unified slide model in `DeckEditor.tsx`:

1. **Edit Hotspots button** added to the right sidebar properties panel for any selected slide (except Vimeo). Opens `FullResolutionHotspotEditor` with existing hotspots loaded via a priority chain: staged changes → per-slide `viral_slide_configs` → shared template fallback.

2. **Auto-classification on save**: When hotspots are saved, the system determines `template_type` from hotspot content:
   - Action hotspots only → `interactive_share`
   - Data hotspots only → `stats_page`
   - Both → `hybrid`
   - None → auto-demote to `image`

3. **Auto-demotion**: Empty hotspot arrays trigger deletion of the per-slide `viral_slide_configs` row (guarded: `slide_id IS NOT NULL` only), revert of `slide_items.type` to `image`, and clearing of `template_id`.

4. **Auto-promotion**: Adding hotspots to a plain image slide creates a per-slide `viral_slide_configs` row, sets `slide_items.type` to `spread-word`, and links the new config via `template_id`.

5. **Template picker preserved** as a shortcut for applying pre-built templates.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/DeckEditor.tsx` | Added `classifyHotspots()`, `loadHotspotsForSlide()`, `handleOpenHotspotEditor()`; "Edit Hotspots" button in properties panel; auto-classify + auto-demote/promote in `handleSaveChanges`; pass `initialHotspots` to `FullResolutionHotspotEditor` |

## Files NOT Changed

- Database schema (no migrations)
- Edge functions
- Rendering components (`ViralSlideV2`, `HybridSlide`, `StatsPageSlide`, etc.)
- `FullResolutionHotspotEditor` component
- `InteractiveTemplates.tsx`
