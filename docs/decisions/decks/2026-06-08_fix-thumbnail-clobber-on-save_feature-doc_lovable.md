# Fix: Selected Slide Reset on `fetchSlides` Clobbered Thumbnails on Save

- **Status:** Approved & Implemented
- **Date:** 2026-06-08

## 1. Problem

a. Reported in `thomas-luttig`: every time the deck was saved, the second slide's sidebar thumbnail reverted to the first slide's background image.
b. Manually pressing "Capture Thumbnail" temporarily recovered it, but the next Save reproduced the bug.

## 2. Root cause

a. `fetchSlides()` always called `setSelectedSlide(slidesWithThumbnails[0])`, silently snapping the user's selection back to slide 1 on every reload.
b. `handleSaveChanges()` runs `await fetchSlides()` and then, 800 ms later, fires a post-save thumbnail recapture for the slide the user *was* editing. The recapture target (`configId`) was correct, but the on-screen `[data-slide-preview]` DOM was now showing slide 1 (because of (a)).
c. `html2canvas` therefore captured slide 1's background and uploaded it to the originally-selected slide's `slide-snapshots/{templateId}/thumbnail.png`, overwriting its thumbnail with slide 1's image.

## 3. Fix

a. `fetchSlides()` now preserves the current `selectedSlide` across reloads — it only falls back to the first slide when nothing was previously selected, or when the previously-selected slide no longer exists.
b. Added a defensive guard in `handleCaptureThumbnail`: if `selectedSlide.id !== slide.id`, the capture is aborted with a console warning. This prevents any future race from writing the wrong slide's preview into a thumbnail file.

## 4. Files changed

- `src/pages/DeckEditor.tsx` — `fetchSlides()` preserves selection; `handleCaptureThumbnail()` guards against DOM/target mismatch.

## 5. Recovery

a. The bug only ever wrote wrong data into `viral_slide_configs.thumbnail_url`. Source images, hotspots, and slide content were never touched.
b. Affected slides can be recovered by selecting them in the deck editor and clicking "Capture Thumbnail" — the new guard ensures the capture is correct.
