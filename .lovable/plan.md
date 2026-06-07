## Goal

Stop guessing the deck's orientation at render time. Record the aspect ratio of the deck's first slide once, store it on the deck, and use that as the single source of truth in the editor and viewer. Block uploads/imports of slides whose aspect ratio doesn't match.

## 1. Database

a. Add two columns to `public.decks`:
   - `aspect_ratio numeric` — the canonical W/H ratio (e.g. 1.7778 for 16:9, 0.5625 for 9:16). Nullable until first slide is added.
   - `orientation text` — derived convenience field, `'landscape' | 'portrait' | 'square'`. Nullable.
b. No backfill in SQL — backfill happens lazily on first load (see §3a) so we use the real first-slide image rather than guessing from data we don't have at migration time.
c. No new RLS/grants needed; existing `decks` policies already cover update by admin/manager.

## 2. Shared helper

a. New `src/lib/deckAspectRatio.ts` exporting:
   - `loadImageDims(url: string): Promise<{w:number;h:number} | null>` (extracted from current DeckEditor logic).
   - `ratioToOrientation(r: number): 'landscape' | 'portrait' | 'square'` (square only when |r−1| < 0.02).
   - `ratiosMatch(a: number, b: number, tolerancePct = 2): boolean` — relative tolerance so a 1404×783 (1.793) image still matches a 16:9 (1.778) deck.

## 3. DeckEditor changes (`src/pages/DeckEditor.tsx`)

a. Replace the existing orientation `useEffect` (lines 316-360) with logic that:
   - Reads `deck.aspect_ratio` / `deck.orientation` from the loaded deck row.
   - If present → use them, skip image probing entirely.
   - If absent → probe the first slide in display order (its `content_url`, then `thumbnail_url`, then template `image_url`), persist `aspect_ratio` and `orientation` back to `decks` via Supabase update, and use them.
b. Pass the canonical aspect ratio (not just orientation) down to the preview container so the frame matches the deck exactly (e.g. 1.793 letterboxed cleanly instead of forced 16:9).
c. On any slide add/upload/Vimeo-poster/import flow, before accepting the file:
   - Probe the new image's dimensions.
   - If the deck already has `aspect_ratio` and the new image's ratio doesn't match within tolerance, reject with a toast: "This slide is {WxH, ratio} but the deck is {WxH, ratio}. All slides in a deck must share the same aspect ratio." Do not upload, do not stage.
   - If the deck has no `aspect_ratio` yet and this is the first slide, accept and persist the ratio after upload succeeds.
d. Solid-color and video slides are exempt from the check (no intrinsic ratio); they inherit the deck ratio.

## 4. DeckViewer changes (`src/pages/DeckViewer.tsx`)

a. Read `deck.aspect_ratio` / `deck.orientation` from the deck row instead of probing the first image.
b. If the column is null (older decks not yet opened in editor), fall back to current probe logic and write the result back to `decks`.
c. Apply `.deck-slide-container` (portrait) or `.deck-slide-landscape` (landscape) based on the stored orientation. Square decks use `.deck-slide-landscape` as the closest fit.

## 5. Behavior summary

- First time any deck is opened (editor or viewer) after this lands, its aspect ratio is recorded permanently.
- From then on, orientation is deterministic and instant — no race between image loads, no chance of the wrong slide winning.
- Editors cannot accidentally introduce mismatched slides; the upload is blocked with a clear message.
- Existing "thomas-luttig" deck will be recorded as ratio 1.793 / landscape on its next load, and slide #2's data preview will use that 1.793 frame instead of falling through to portrait.

## 6. Out of scope

- No tool to "convert" or letterbox existing mismatched slides — none exist in current decks per the rule above.
- No UI to manually override a deck's aspect ratio (can be added later if needed).
- No changes to `viral_slide_configs`, hotspot rendering, or map controls.

## 7. Decision log

This is a new plan: `docs/decisions/deck-editor/2026-06-07_deck-aspect-ratio-persistence_feature-doc_lovable.md`. It supersedes the runtime-only approach documented in `docs/decisions/deck-editor/2026-04-02_landscape-orientation-detection_feature-doc_lovable.md`; that file will get an `## Update — 2026-06-07` section pointing at the new doc.
