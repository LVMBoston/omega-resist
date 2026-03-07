# Slide Thumbnail Capture via html2canvas

- **Status:** Approved & Implemented
- **Date:** 2026-03-07
- **Author:** Lovable AI + project owner

---

## Summary

Added client-side thumbnail capture for interactive slides using the same `html2canvas` mechanism as the existing snapshot pipeline. Any `spread-word` slide can now have its visual appearance (background + hotspot overlays) captured as a PNG thumbnail and stored in the `thumbnail_url` column of `viral_slide_configs`.

## Changes

1. **`src/lib/snapshotCapture.ts`** — Added `captureSlideThumbnail()`: 1x scale capture, ~200KB compression target, uploads to `slide-snapshots/{templateId}/thumbnail.png`, updates `viral_slide_configs.thumbnail_url`.

2. **`src/pages/DeckEditor.tsx`** — 
   - Slide interface extended with `thumbnail_url`.
   - `fetchSlides` joins `viral_slide_configs` via `template_id` FK to retrieve `thumbnail_url`.
   - Sidebar thumbnails and center preview prefer `thumbnail_url` over `content_url`.
   - "Capture Thumbnail" button in properties panel for `spread-word` slides.
   - `handleCaptureThumbnail()` captures the preview DOM element and updates local state.

3. **`src/pages/CampaignManager.tsx`** — Deck Thumbnail View query joins `viral_slide_configs(thumbnail_url, cached_snapshot_path)`. Rendering prefers `thumbnail_url → cached_snapshot_path → content_url`.

4. **`src/pages/DeckManagement.tsx`** — First slide preview query joins `viral_slide_configs(thumbnail_url)`. No longer filters to `type=image` only, so interactive first slides show their captured thumbnail.

## Files NOT Changed

- Database schema (`thumbnail_url` column already existed)
- Edge functions
- Rendering components
- `FullResolutionHotspotEditor`
