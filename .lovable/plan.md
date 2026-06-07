# Fix: Edits made on Slide 2 appear on Slide 1 after "Save & Close" + "Save changes"

## 1. What you see, in plain language

a. You open Slide 2, edit its hotspots, click **Save & Close**.
b. You navigate to another slide (say Slide 1) and click the global **Save changes** button.
c. Slide 1 now shows what looks like Slide 2's edits — most visibly, Slide 1's thumbnail starts displaying Slide 2's hotspots overlaid.

## 2. What I'm checking, in plain language

There are two slides involved and two pieces of data that can move between them:

a. **Hotspot data** — the positions, labels, and types of the dots on each slide. Stored per slide.
b. **Thumbnail image** — the little preview image of the slide. Stored on the *template* the slide uses.

The bug is in (b), not (a). Many slides can share the same template. When a slide hasn't been customized yet, it just points at the shared template and reuses its thumbnail. If we overwrite that shared template's thumbnail, every slide pointing at it changes preview at once — which is exactly what looks like "Slide 2's edits leaked onto Slide 1".

## 3. Why it happens (technical)

In `src/pages/DeckEditor.tsx`:

a. Slides start out with `template_id` pointing at a **shared template** (a `viral_slide_configs` row with `slide_id IS NULL`). Several slides can share one template.
b. `handleSaveHotspots` (lines 926-952) stages the new hotspots correctly under `selectedSlide.id`. That part is fine. The staged change is never applied to the wrong slide's hotspots.
c. Immediately after staging, lines 946-950 auto-fire `handleCaptureThumbnail(slideForCapture)` where `slideForCapture.template_id` is **still the shared template's id** — because the per-slide `viral_slide_configs` row isn't created until you later click global Save Changes (that happens in lines 1339-1389).
d. `handleCaptureThumbnail` (lines 873-924) uses `slide.template_id` first as the `configId` it uploads the thumbnail to (line 880). So the new thumbnail (which shows Slide 2's preview with its new hotspots) gets written to the **shared template** row.
e. Every other slide that points to that same shared template — including Slide 1 — now displays the new thumbnail. From your perspective, Slide 1 "got" Slide 2's edits.
f. After global Save Changes runs, Slide 2 gets its own per-slide config and eventually its own thumbnail, but Slide 1's thumbnail on the shared template stays polluted until something rewrites it.

There is also a smaller, separate risk on top of this: if the hotspot editor dialog is left open and you click another slide in the sidebar, `selectedSlide` changes and a subsequent save would key the hotspots to the wrong slide. Worth fixing in the same pass.

## 4. Fix

a. **Never write thumbnails to a shared template from the editor.** In `handleCaptureThumbnail`, if `configId` resolves to a row whose `slide_id IS NULL` (a shared template), skip the upload and log a notice. Thumbnails for shared templates should only be set from the template editor, not from a deck slide edit.
b. **Defer the auto-thumbnail capture until a per-slide config exists.** In `handleSaveHotspots`, do not call `handleCaptureThumbnail` inline. Instead, mark the slide as "needs thumbnail capture" and run capture only after the per-slide `viral_slide_configs` row is created in the global Save Changes flow (after line 1387). At that point `configId` is guaranteed to be the slide's own per-slide config, not the shared one.
c. **Lock the editor to the slide it was opened for.** Add a `hotspotEditorSlide` state, set it in `handleOpenHotspotEditor`, and use *it* (not `selectedSlide`) inside `handleSaveHotspots` and in the dialog JSX at lines 1991-2010. This prevents a second class of bug where changing sidebar selection mid-edit retargets the save.
d. **Repair already-polluted shared template thumbnails.** A one-time check: if the user reports a wrong-looking thumbnail on Slide 1, re-capturing Slide 1 from its own (clean) state will overwrite the shared template's thumbnail back to something correct. Document this in the post-mortem; we don't need a migration.

## 5. How I'll verify

a. Reproduce on the current build first with the exact steps in section 1 and confirm Slide 1's thumbnail changes.
b. After the fix, repeat the same steps and confirm Slide 1's thumbnail is untouched and Slide 2 gets its own thumbnail once global Save Changes runs.
c. Bonus check for 4c: open Slide 2's hotspot editor, click Slide 1 in the sidebar while it's open, save — confirm Slide 2 receives the hotspots, not Slide 1.
d. Add both cases to the regression suite backlog in `docs/REGRESSION_TESTS.md`.

## 6. Files touched

a. `src/pages/DeckEditor.tsx` — guard in `handleCaptureThumbnail`, defer auto-capture in `handleSaveHotspots`, add `hotspotEditorSlide` state and thread it through the dialog.
b. `docs/REGRESSION_TESTS.md` — two new backlog entries.
c. `docs/decisions/deck-editor/2026-06-07_hotspot-edits-leaking-to-other-slides_bug-fix_lovable.md` — new decision doc per the Decision Log Rule (this is a new plan, not an update to an existing one).

## 7. One thing I want to confirm before building

The symptom I'm betting on is **Slide 1's thumbnail starts looking like Slide 2**. If instead you mean the actual hotspots on Slide 1 (when you open its editor or view it in the deck) became Slide 2's hotspots, that's a different code path and I'd want to look once more before I implement. Can you tell me which of the two it is?
