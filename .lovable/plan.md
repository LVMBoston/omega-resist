

# Render Interactive Slide Preview in DeckEditor

**Date:** 2026-03-07

---

## 1. Problem

The "Capture Thumbnail" button in the DeckEditor captures `[data-slide-preview]`, which only contains the raw background image (or solid color). No hotspot overlays are rendered in the center preview, so the capture is just a blank background — useless as a thumbnail.

For data templates (`stats_page`/`hybrid`), the hotspots need a campaign code to show live values, but no campaign is selected in the DeckEditor context.

---

## 2. Solution

Render the slide's hotspot overlays in the DeckEditor center preview as a **static visual layout** — no live data, just positioned placeholders showing hotspot type/label. Then the existing `captureSlideThumbnail` captures a meaningful thumbnail.

### 2a. Build a `SlidePreviewOverlay` component

A new lightweight component that renders hotspots as positioned boxes over the background image, using the same percentage-based positioning as `DraggableHotspotOverlay` but read-only and non-interactive:

- a. `live_number` hotspots → show `metricKey` label or `manualLabel` text (e.g., "seeds", "campaign_name") in a styled box.
- b. `chart` hotspots → show a "Chart" placeholder with a bar-chart icon.
- c. `map` hotspots → show a "Map" placeholder with a map icon.
- d. Action hotspots (`sms`, `email`, `social`, `external_link`, `email_links`, `vimeo`) → show the action icon and label.

### 2b. Render the overlay in DeckEditor center preview

For `spread-word` slides with a `template_id`, fetch the hotspots from `viral_slide_configs` (or `hotspotChanges` if staged) and render `SlidePreviewOverlay` on top of the background image inside `[data-slide-preview]`.

### 2c. Auto-capture after saving hotspots

After `handleSaveHotspots` stages changes, auto-trigger `handleCaptureThumbnail` with a short delay (to let the overlay render). This ensures the thumbnail is always current after editing.

---

## 3. Files Changed

| # | File | Change |
|---|------|--------|
| 3a | `src/components/SlidePreviewOverlay.tsx` | New component — renders positioned hotspot placeholders over a background |
| 3b | `src/pages/DeckEditor.tsx` | Import and render `SlidePreviewOverlay` in center preview for `spread-word` slides; fetch hotspots for preview; auto-capture after hotspot save |

---

## 4. Files NOT Changed

- `snapshotCapture.ts` (capture logic unchanged)
- `FullResolutionHotspotEditor` (editing unchanged)
- `DraggableHotspotOverlay` (DataTemplateEditor editing unchanged)
- All rendering components (`InteractiveSlideOverlay`, `StatsPageSlide`, etc.)

---

## 5. Implementation Sequence

- a. Create `SlidePreviewOverlay` — static positioned hotspot boxes.
- b. In DeckEditor, for `spread-word` slides, load hotspots (from `hotspotChanges` or `viral_slide_configs`) and render `SlidePreviewOverlay` atop the background.
- c. After `handleSaveHotspots`, wait 500ms for render, then auto-call `handleCaptureThumbnail`.

---

## 6. Risk Register

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 6a | Hotspots not loaded for preview on first select | Low | Fetch on slide selection when `type === 'spread-word'` |
| 6b | Auto-capture fires before overlay paints | Low | 500ms delay + the 2s stabilization in `captureSlideThumbnail` |
| 6c | html2canvas doesn't capture icon images | Low | Use CSS backgrounds or inline SVGs for placeholder icons |

