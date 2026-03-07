

# Slide Thumbnail Capture via html2canvas

**Date:** 2026-03-07

---

## 1. Problem

Two issues with interactive slide previews:

1a. The DeckEditor sidebar thumbnails (line 85) and center preview (line 1474) render `slide.content_url` — the raw background image. For `spread-word` slides, this shows the bare background (or a solid color) with no visible hotspots, icons, or overlays. The slide's actual visual identity is invisible.

1b. The same applies to the CampaignManager deck preview dialog (line 778+) and DeckManagement thumbnails — anywhere slides are shown as thumbnails.

1c. Server-rendered SVG snapshots only exist for `stats_page` slides deployed to campaigns. Action-only slides (`interactive_share`) and undeployed data slides have no snapshot at all.

## 2. Solution

Use the same `html2canvas` client-side capture mechanism from `snapshotCapture.ts` to generate a **thumbnail PNG** for any interactive slide. The capture renders the slide DOM (background + hotspot overlays) into an image and uploads it to storage.

### 2a. Add a `thumbnail_url` column usage on `viral_slide_configs`

The column `thumbnail_url` already exists on `viral_slide_configs` (currently unused). Store the captured thumbnail there.

### 2b. Create a `captureSlideThumbnail` utility

A lighter variant of `captureTemplateSnapshot` that:
- a. Takes a container DOM element (the rendered slide with overlays).
- b. Captures via `html2canvas` at 1x scale (thumbnails don't need retina).
- c. Compresses to ~200KB max.
- d. Uploads to `slide-snapshots` bucket at path `{templateId}/thumbnail.png`.
- e. Updates `viral_slide_configs.thumbnail_url` with the public URL.

### 2c. Trigger capture in DeckEditor after saving hotspots

After `handleSaveHotspots` persists the hotspots and the slide is promoted/updated:
- a. Briefly render the slide (background + hotspot overlay) in the center preview panel.
- b. Auto-capture a thumbnail using `captureSlideThumbnail`.
- c. Store the result in `viral_slide_configs.thumbnail_url`.

This happens once on save, not on every view.

### 2d. Use `thumbnail_url` in all thumbnail views

Everywhere a slide thumbnail is rendered, prefer `thumbnail_url` over `content_url` for `spread-word` slides:

```text
src = slide.viral_slide_configs?.thumbnail_url
   || slide.viral_slide_configs?.cached_snapshot_path
   || slide.content_url
```

Apply this in:
- a. `DeckEditor.tsx` — sidebar `SortableSlide` (line 85) and center preview (line 1474)
- b. `CampaignManager.tsx` — deck preview dialog
- c. `DeckManagement.tsx` — deck card thumbnails

### 2e. "Capture Thumbnail" button in properties panel

Add an explicit "Capture Thumbnail" button next to "Edit Hotspots" for `spread-word` slides, so admins can re-capture at will.

---

## 3. Files Changed

| # | File | Change |
|---|------|--------|
| 3a | `src/lib/snapshotCapture.ts` | Add `captureSlideThumbnail()` — lighter capture targeting `thumbnail_url` |
| 3b | `src/pages/DeckEditor.tsx` | Render slide with overlays in preview for capture; trigger capture after hotspot save; "Capture Thumbnail" button; use `thumbnail_url` in sidebar/preview |
| 3c | `src/pages/CampaignManager.tsx` | Join `viral_slide_configs.thumbnail_url` in slide query; prefer it as thumbnail src |
| 3d | `src/pages/DeckManagement.tsx` | Same thumbnail_url preference in deck card rendering |

No database migrations (column already exists). No edge function changes.

---

## 4. Files NOT Changed

- `viral_slide_configs` schema (column exists)
- Edge functions (`render-stats-snapshot`, `refresh-all-snapshots`)
- Rendering components (`InteractiveShareSlide`, `StatsPageSlide`, `HybridSlide`)
- `FullResolutionHotspotEditor`

---

## 5. Implementation Sequence

- a. Add `captureSlideThumbnail()` to `snapshotCapture.ts`.
- b. Update DeckEditor preview to render hotspot overlays for the selected slide (so there's a DOM element to capture).
- c. Wire "Capture Thumbnail" button and post-save auto-capture.
- d. Update thumbnail rendering in DeckEditor, CampaignManager, DeckManagement to prefer `thumbnail_url`.

---

## 6. Risk Register

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 6a | html2canvas can't render complex overlays (maps, Vimeo) | Medium | Acceptable — captures what it can; maps render as tiles, Vimeo shows placeholder |
| 6b | Capture timing — overlays not yet painted | Low | Same 2-second stabilization delay used by existing snapshot capture |
| 6c | `thumbnail_url` stale after hotspot edits | Low | Auto-capture on save; manual "Capture Thumbnail" button for re-capture |

