# Full Parity: Editor ↔ SSR for Campaign Story (portrait, landscape/two-column, and every other data hotspot)

Status: Proposed
Date: 2026-07-01

Guiding principle: **Parity means every time, in every case.** If the editor and the SSR snapshot render the same campaign at the same instant, every number, every wrapped line, every split point, and every pixel of layout must match. No "the formatter matches but the inputs drift." No "portrait works but the two-column split doesn't." No exceptions.

## 1. What the user sees today

For Stoddard's European Postcards, opened in the editor and rendered by SSR within the same minute:

a. Editor says **16 sprouts, 26% sprout rate**. SSR says **31 sprouts, 51% sprout rate**. Same campaign, same second.
b. Editor's tan story box fits its content. SSR's tan box overflows and clips at "…United Kingdom."
c. Editor shows a separate "Campaign Narrative" title bar. SSR shows the campaign title as line 1 inside the story box (duplicated when a header hotspot is also present).
d. On landscape decks (two-column story), any of the above problems get worse: a wrong split point puts the wrong sentence in the wrong column, and one column overflows while the other looks half-empty.

## 2. Root cause — parity was only half-built

The `src/shared/render/` module and `/parity-harness` cover **how pixels get drawn from given inputs**: wrapping, fonts, colors, defaults, formatter strings. They do NOT cover:

2a. **Metric inputs.** "How many sprouts?" is computed twice — once in `src/lib/campaignNarrative.ts` (distinct parent tokens → 16) and once in `supabase/functions/render-stats-snapshot/index.ts` (total L01+ tokens → 31). Two definitions, no shared code, no test.
2b. **The story-box's own text path.** `render-stats-snapshot/index.ts` still has an ad-hoc wrap-width estimator for the campaign story branch. It never switched to `textLayout.ts` like the other text hotspots did.
2c. **Structural assumptions.** The formatter emits `Campaign: <title>` as its first line. The editor also renders a separate header hotspot. Neither side knows what the other is doing.
2d. **The two-column split.** `campaignStorySplit.ts` exists in both `src/shared/render/` and `supabase/functions/_shared/render/`, but neither call site has been verified to use the single shared copy, and the split's column-boundary math has never been proven to use the same width/font/padding as the editor's column boxes. Any wrap-width drift moves the split point in one view but not the other.
2e. **Coverage.** Every parity harness case uses hand-crafted fixture data. There is no case that says "given campaign code X, both renderers must produce the same numbers and the same wrapped lines and the same split point."

## 3. Definition of parity (the standard we are enforcing)

For any campaign C, any timestamp T, and any deck orientation (portrait or landscape):

3a. Every metric field (`seedCount`, `sproutCount`, `viewCount`, `zipCount`, `stateCount`, `internationalCountries`, `maxDepth`, `propagationSpeed`, `shareMediums`, `lastShareAt`, `speedOriginCity`, `speedDestCity`) is computed by **one function**, imported by both editor and SSR.
3b. Every text hotspot (single story box AND each column of a two-column split) wraps through **one function** (`textLayout.ts`) with the same width, padding, font-metrics table, and vertical-align rules.
3c. Every hotspot's structural contract — what the formatter emits vs. what a separate header hotspot renders — is explicit and shared. No implicit "the caller will strip this."
3d. The two-column split runs through **one function** (`campaignStorySplit.ts` in `_shared/render/`) and uses the same wrap math as 3b. The split point is deterministic given identical inputs.
3e. Automated tests fail loudly the moment any of the above drifts.

## 4. Fix plan

### 4a. Extract metric-input computation into shared code

Create `supabase/functions/_shared/render/campaignStoryInputs.ts` exporting one function:

```
computeCampaignStoryInputs(supabase, {
  campaignCode, campaignId, dataSource, since
}) → Promise<CampaignStoryInput>
```

Re-export from `src/shared/render/campaignStoryInputs.ts`. Both `campaignNarrative.ts` and `render-stats-snapshot/index.ts` delete their local copies of these queries and import this. The `sproutCount` definition (distinct L00 parents whose children exist) lives here, once. This fix applies to the two-column split for free — the split runs on the *output* of the formatter, so fixing the inputs fixes both columns simultaneously.

### 4b. Route SSR's story-box text through `textLayout.ts` (single AND two-column)

Delete the ad-hoc wrap estimator in `render-stats-snapshot/index.ts` for the campaign_story branch. Call `wrapText()` from `src/shared/render/textLayout.ts` (already exported from `_shared`) with the same width/padding/font as the editor. For two-column decks, each column box calls the same `wrapText()` with its own width — same function, different width parameter. This mirrors the fix we applied to plain-text hotspots on 2026-06-24; the story hotspot and its columns finally join.

### 4c. Make the title contract explicit

Add an `includeTitle: boolean` parameter to `formatCampaignStory` (default `true` to preserve current standalone use). Both callers pass it explicitly based on whether a separate header hotspot exists in that slide's layout. Editor and SSR use the same decision function: `slideHasHeaderHotspot(slide) → boolean`. For split stories, the flag is honored once at formatter time before the split runs, so the title can't reappear in column two.

### 4d. Unify and harden the two-column split

Verify a single source of truth for `campaignStorySplit.ts`:

- Keep the canonical implementation in `supabase/functions/_shared/render/campaignStorySplit.ts`.
- `src/shared/render/campaignStorySplit.ts` becomes a thin re-export only (matches how `campaignStory.ts` already works).
- The split's line-measurement function is replaced by a call into `textLayout.ts` so column-boundary decisions use the same character-width table as the editor.
- Editor and SSR both call `splitCampaignStory(text, { leftWidth, rightWidth, font, padding })` with identical arguments derived from the slide layout. Same inputs in, same split out — always.

### 4e. Audit every other data field for the same class of drift

While we're in there, run the same "one function, both callers" treatment on every metric currently duplicated between `campaignNarrative.ts` and `render-stats-snapshot/index.ts`:

- seeds / seeds_with_spawns / L01 / L02 / L03 counts
- shares, opens, viral_coefficient
- geographic aggregates (zips, states, international countries)
- share-medium breakdown
- propagation-speed timings and origin/dest cities

Each moves into `campaignStoryInputs.ts` (or a sibling `campaignMetrics.ts`) with a single definition and a test.

## 5. Tests that would have caught this

5a. **Cross-source metric test** (`src/shared/render/campaignStoryInputs.test.ts`, new). Seeds a fixture campaign with a known token/event graph. Asserts every field of `CampaignStoryInput` — with special attention to `sproutCount === distinctParents`, not `totalShares`.

5b. **`/parity-harness` §2.9 — real-campaign case, portrait AND landscape.** New harness section that takes a campaign code, runs both the editor path (via `campaignNarrative.ts`) and the SSR path (via a client-side call to the deployed edge function), and diffs the resulting text line by line for both a portrait slide (single story box) and a landscape slide (two-column split). Any mismatch fails the harness visibly. This is the single test that guarantees "works for every campaign, every orientation."

5c. **Wrap-parity test** for the story hotspot (`src/shared/render/plainText.test.ts`, extended). Given Stoddard-style long inputs and the tan-box width, both editor and SSR must produce the same array of wrapped lines.

5d. **Split-parity test** (`src/shared/render/campaignStorySplit.test.ts`, extended). Given the same narrative and identical column widths, the split must produce identical left- and right-column line arrays every time. Cover edge cases: very short story (right column empty is OK, but must be *deterministically* empty), very long story (both columns full, no line lost across the seam), story with an emoji at the split point (no line breaks in the middle of a multi-byte character).

5e. **CI check.** All the above run in the existing Vitest suite so drift can't ship silently again.

## 6. Verification steps

6a. Redeploy `render-stats-snapshot`. Bump `RENDERER_VERSION` to `2026-07-01-parity-full` so edge logs prove which build served a given snapshot.
6b. Trigger Server Refresh on Stoddard's European Postcards (portrait). Confirm the SSR snapshot shows **16 sprouts, 26%**, no title duplication, and the tan box does not clip.
6c. Trigger Server Refresh on a landscape deck (two-column story). Confirm both columns match the editor line-for-line and the split point is identical.
6d. Repeat 6b-6c on at least two other active campaigns (rs-good-1, ice-takedown) to catch anything Stoddard-specific.
6e. Open `/parity-harness?section=2.9` and confirm the real-campaign diff is empty for each campaign, in both orientations.
6f. Only after 6b-6e pass do we consider parity restored.

## 7. Files touched

7a. `supabase/functions/_shared/render/campaignStoryInputs.ts` — **new**, single source of truth for metric inputs.
7b. `src/shared/render/campaignStoryInputs.ts` — **new**, re-export.
7c. `supabase/functions/render-stats-snapshot/index.ts` — delete local metric queries, delete ad-hoc wrap estimator for story branch, call shared inputs + `textLayout.wrapText`, pass explicit `includeTitle`, call shared `splitCampaignStory` for two-column layouts.
7d. `src/lib/campaignNarrative.ts` — delete local metric queries, call shared inputs, pass explicit `includeTitle`.
7e. `supabase/functions/_shared/render/campaignStory.ts` — add `includeTitle` parameter.
7f. `supabase/functions/_shared/render/campaignStorySplit.ts` — replace internal line-measurement with `textLayout.ts` call; accept `{ leftWidth, rightWidth, font, padding }` explicitly.
7g. `src/shared/render/campaignStorySplit.ts` — reduce to thin re-export of 7f.
7h. `src/lib/campaignStorySplit.ts` — retire if now redundant; otherwise reduce to a re-export of the shared module. Verify no divergent copies remain.
7i. `src/shared/render/campaignStoryInputs.test.ts` — **new**, Vitest regression on metric inputs.
7j. `src/shared/render/plainText.test.ts` — extended with story-hotspot wrap cases.
7k. `src/shared/render/campaignStorySplit.test.ts` — extended with parity + edge cases (see 5d).
7l. `src/pages/ParityHarness.tsx` — add §2.9 real-campaign diff view, portrait and landscape.
7m. `docs/decisions/snapshots/2026-07-01_full-editor-ssr-parity_feature-doc_lovable.md` — **new**, this decision doc.

## 8. Out of scope (called out so we don't drift again)

8a. Rendering charts in SSR — still explicitly skipped.
8b. Auto-shrink font when the story still overflows worst-case boxes — file a follow-up only if 6b-6d still clip after the wrap fix.
8c. Any change to what a "sprout" means in the product. This plan only enforces the editor's existing definition on the SSR side.
8d. Any redesign of the two-column layout itself. This plan only guarantees that whatever layout you have, editor and SSR render it identically.

This is a **new** plan; it does not update a prior decision document. It supersedes the informal boundary of the 2026-06-24 parity hardening by extending "parity" to cover metric inputs, the story-box wrap path, and the two-column split — not just standalone text hotspots.
