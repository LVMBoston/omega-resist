# Hotspot edits on Slide 2 appearing on Slide 1 — bug fix

Status: Approved & Implemented
Date: 2026-06-07

## 1. What the user saw

a. Open Slide 2, edit its hotspots, click **Save & Close**.
b. Navigate to another slide (e.g. Slide 1), click the global **Save changes**.
c. Slide 1's thumbnail started displaying Slide 2's edits.

## 2. Root cause

Many slides share a single `viral_slide_configs` "shared template" row (where `slide_id IS NULL`). When `handleSaveHotspots` auto-fired `handleCaptureThumbnail` right after staging hotspots, the slide's `template_id` still pointed at the shared template (the per-slide config isn't created until global Save Changes). `handleCaptureThumbnail` then uploaded the thumbnail of Slide 2 — with its new hotspots overlaid — onto that shared template row. Every sibling slide pointing at the same shared template (including Slide 1) immediately displayed Slide 2's preview.

A secondary risk also existed: `handleSaveHotspots` keyed staged changes off `selectedSlide.id`. If the user clicked another slide in the sidebar while the editor dialog was open, the save would target the wrong slide.

## 3. Fix (in `src/pages/DeckEditor.tsx`)

a. **Guard `handleCaptureThumbnail`** — look up the resolved config row; if `slide_id IS NULL` (shared template), skip the upload and add the slide id to `pendingThumbnailCaptureIds`.
b. **Deferred capture** — after global Save Changes creates a per-slide config row, if the slide id is in `pendingThumbnailCaptureIds` and the preview is still showing that slide, run capture against the new per-slide `config.id`.
c. **Lock editor target** — new `hotspotEditorSlide` state, set in `handleOpenHotspotEditor`, used by `handleSaveHotspots` and the dialog JSX in place of `selectedSlide`. Cleared on close.

## 4. What does not change

- Hotspot data itself was always keyed correctly by `slide.id` in `hotspotChanges` and persisted to the right per-slide config row by the global Save Changes flow. No data migration is needed for hotspots.
- Already-polluted shared template thumbnails will self-heal the next time any slide using that template captures a thumbnail from its own clean preview.

## 5. Verification

a. Confirmed lint/build clean.
b. Manual repro of the original sequence (steps 1a–1c) should now leave Slide 1's thumbnail untouched.
c. Regression entries added to `docs/REGRESSION_TESTS.md`.
