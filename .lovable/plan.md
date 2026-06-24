## 1. What I found

1a. The fresh snapshot proves the deployed server output is still drawing the middle row as one clipped SVG text line.

1b. The local `render-stats-snapshot` source has wrap logic now, but it still does not match the Deck Editor for several style values.

1c. The current `/parity-harness` only tests rich-text manual entries. It does not test the plain `manualLabel` / metric text branch that is producing the clipped "Last updated" boxes in your screenshot.

## 2. Remaining hard-coded rendering mismatches

2a. `padding`: Deck Editor honors `style.padding`; SSR uses a hard-coded `4px` side inset only for wrap math.

2b. `borderRadius`: Deck Editor honors `style.borderRadius`; SSR hard-codes the background radius to `2`.

2c. `fontFamily`: Deck Editor honors `style.fontFamily`; SSR hard-codes `Inter, sans-serif`.

2d. `fontWeight`: Deck Editor defaults to `700`; SSR defaults to `normal` unless the value is exactly `bold` or `700`.

2e. `color`: Deck Editor defaults to `#1a1a1a`; SSR defaults to `#000000`.

2f. `clipOverflow`: Deck Editor can allow overflow when `clipOverflow === false`; SSR already has that guard, so this part is okay.

## 3. Fix plan

3a. Update the standard plain-text branch in `supabase/functions/render-stats-snapshot/index.ts` so it uses the same defaults and style fields as `StatsPageSlide.tsx`.

3b. Use parsed `style.padding` for text position and wrap width instead of the hard-coded `4px` inset.

3c. Use parsed `style.borderRadius` on background rectangles instead of hard-coded `rx="2"`.

3d. Pass through `style.fontFamily`, `style.fontWeight`, and the editor color default.

3e. Add a debug-safe marker/version log to the function so we can confirm the deployed edge function is the new code, not a stale deployment.

## 4. Parity harness plan

4a. Extend `src/pages/ParityHarness.tsx` with plain-text fixtures, not only rich-text fixtures.

4b. Add the exact problem shape: three adjacent tan boxes where the middle and right values must wrap instead of clipping.

4c. Add top, center, and bottom vertical-alignment fixtures for plain text.

4d. Add a padding/border-radius/font-family fixture so future hard-coded regressions are visible.

## 5. Verification plan

5a. Run the renderer tests that already cover snapshot canvas behavior.

5b. Deploy `render-stats-snapshot` after the code change.

5c. Trigger a fresh snapshot render for the Stoddard campaign.

5d. Check edge logs for the new version marker to prove the latest function handled the render.

5e. Use browser testing to view the fresh SSR preview and `/parity-harness`, then confirm by screenshot that the text wraps rather than clipping.

## 6. Decision log

6a. Archive this approved plan as a new decision document: `docs/decisions/snapshots/2026-06-24_ssr-editor-text-parity-hardening_feature-doc_lovable.md`.
