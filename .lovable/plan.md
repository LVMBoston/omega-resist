## 1. Goal

Let landscape decks display the Campaign Story across two side-by-side hotspots, with the story content split at the paragraph nearest the midpoint. Portrait decks keep working unchanged (a single hotspot still shows the whole story).

## 2. How it works (plain language)

- A new optional control on any `campaign_story` hotspot: **Story segment** with three choices: `Full` (default — today's behavior), `First half`, `Second half`.
- For landscape layouts, the user places two `campaign_story` hotspots side-by-side and sets one to `First half`, the other to `Second half`. Each renders only its slice of the narrative.
- The split point is computed automatically: walk the paragraphs, find the boundary whose cumulative character count is closest to half the total. The `__TITLE__` line always stays with `First half`; the `Date of this report:` footer always stays with `Second half`. Blank-line paragraph breaks are preserved.
- Identical splitting logic runs in both the in-app renderer (`StatsPageSlide` / `HybridSlide`) and the SSR snapshot (`render-stats-snapshot/index.ts`), satisfying the editor/SSR parity rule.

## 3. Technical details

### 3a. Type change
- `src/types/viralTemplates.ts`: add `storySegment?: 'full' | 'first' | 'second'` on `Hotspot` (optional, defaults to `full`).

### 3b. Shared splitter
- New helper `splitCampaignStoryAtMidpoint(story: string): { first: string; second: string }` in `src/lib/campaignStorySplit.ts`.
  - Tokenize into paragraph blocks separated by blank lines.
  - Keep any `__TITLE__…__TITLE__` block pinned to `first`.
  - Keep any block starting with `Date of this report:` pinned to `second`.
  - For remaining blocks, accumulate char counts; the split index is the boundary that minimizes `abs(leftChars − rightChars)`.
  - Re-join with `\n\n` so existing paragraph-gap rendering still works.
- Add Vitest unit tests covering: title pinning, footer pinning, even split, odd split, missing footer, single-paragraph fallback.
- Duplicate the function inside `supabase/functions/render-stats-snapshot/` (Deno can't import from `src/`); add a Deno test alongside the existing `canvas.test.ts` pattern.

### 3c. In-app rendering
- `src/components/StatsPageSlide.tsx` and `src/components/HybridSlide.tsx`: when `hotspot.metricKey === 'campaign_story'` and `hotspot.storySegment` is `'first'` or `'second'`, replace `value` with the corresponding slice from the splitter before passing it to the existing render path. `'full'`/undefined keeps current behavior.

### 3d. SSR rendering
- `supabase/functions/render-stats-snapshot/index.ts`: inside the `campaign_story` branch (line 1047), apply the same slice based on `hotspot.storySegment` before the `metricValue.split("\n")` pass. No other layout logic changes.

### 3e. Editor control
- `src/components/HotspotCalibrationControls.tsx` (or wherever live-number style controls live for `campaign_story`): add a small select labeled **Story segment** with options Full / First half / Second half. Visible only when `metricKey === 'campaign_story'`.

### 3f. Docs
- Append an `## Update — 2026-06-26` section to `docs/decisions/campaign-story/2026-02-27_two-tier-story-metric_feature-doc_lovable.md` describing the landscape split (matches the Decision Log Rule, since this updates an existing campaign-story decision).

## 4. What does not change

- Portrait decks and any hotspot left on `Full` render exactly as today.
- The narrative generator (`campaignNarrative.ts`) is untouched — same story content, same data integrity guarantees.
- No DB migration, no edge function redeploy beyond the existing `render-stats-snapshot` push.

## 5. Verification

- Vitest unit tests for the splitter.
- Browser check on `/deck-editor/thomas-luttig`: place two paired hotspots on a landscape slide, set First/Second, screenshot to confirm balanced columns and that title+footer land in the correct columns.
- Trigger a Server Refresh on a landscape campaign and compare the snapshot PNG to the live editor view for parity.

## 6. Decision log

This plan **updates the existing decision document** `docs/decisions/campaign-story/2026-02-27_two-tier-story-metric_feature-doc_lovable.md` via a new `## Update — 2026-06-26` section (per the Decision Log Rule).