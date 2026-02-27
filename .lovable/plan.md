
# Two-Tier Campaign Story + `campaign_story` Metric

## Summary

Split the Campaign Story into a compact **headline** (fits one iPhone screen at 30pt) and a verbose **full story** (accessible via "Read more" in the dashboard dialog only). Register `campaign_story` as a new `LiveMetricKey` so it can be placed as a hotspot on Data Template slides and rendered in SVG snapshots.

---

## 1. Update narrative generator to return two tiers

**File:** `src/lib/campaignNarrative.ts`

- Change `generateCampaignNarrative` return type from `string` to `{ headline: string; fullStory: string }`.
- **Headline** (~8-10 short lines, no emojis, fits 30pt / ~18 chars per line):
  ```text
  Campaign Title
  X days active

  X cards dropped
  Y sprouted (Z%)

  Longest chain: N levels
  Reached LN in X hours

  V views, W zip codes
  across S states

  No ad budget.
  Every view earned.
  ```
- **Full story**: the current verbose narrative (unchanged content, just returned as `fullStory`).
- Add a new export `generateHeadlineOnly(data: NarrativeData): string` for use by the edge function (avoids importing the full module in Deno).

## 2. Update dialog for two-tier display

**File:** `src/components/CampaignNarrativeDialog.tsx`

- Store `{ headline, fullStory }` instead of a single string.
- Default view renders the `headline` at readable size.
- Add a "More..." / "Less" text toggle below the headline to expand to `fullStory`.
- Copy and Download always export the `fullStory` (the complete version).

## 3. Add `campaign_story` to `LiveMetricKey`

**File:** `src/types/viralTemplates.ts`

- Add `'campaign_story'` to the `LiveMetricKey` union type (after `last_updated`).

## 4. Resolve `campaign_story` in client-side hook

**File:** `src/hooks/useLiveMetrics.ts`

- Add `campaign_story: "Campaign Story"` to `METRIC_LABELS`.
- After computing all other metrics, import and call `fetchNarrativeData` + `generateCampaignNarrative` to get the headline.
- Push `{ key: "campaign_story", label: "Campaign Story", value: headline, source: "narrative" }`.

## 5. Resolve `campaign_story` in server-side snapshot renderer

**File:** `supabase/functions/render-stats-snapshot/index.ts`

- In `calculateMetrics`, after existing metric computation, build the headline inline using the already-fetched data (seeds count, shares count, views, depth, zip codes, states, days active, propagation speed).
- No external imports needed -- reuse `tokenArray`, `eventArray`, and campaign data already in scope.
- Set `metrics.campaign_story` to newline-separated headline text. The existing `<tspan>` multi-line renderer (lines 380-393) handles this automatically.

## 6. No changes needed in Data Template Editor

The `DataTemplateEditor` metric dropdown reads from `LiveMetricKey` automatically. When `campaign_story` is selected, the editor preview will render the multi-line headline in the hotspot area. Recommended hotspot size for this metric: ~60% width x 40% height (user can adjust).

## 7. Save decision document

**File:** `docs/decisions/campaign-story/2026-02-27_two-tier-story-metric_feature-doc_lovable.md`

Document the two-tier architecture, new metric key, and snapshot rendering behavior.

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/campaignNarrative.ts` | Return `{ headline, fullStory }`, add compact headline generator |
| `src/components/CampaignNarrativeDialog.tsx` | Two-tier display with "More..." toggle |
| `src/types/viralTemplates.ts` | Add `campaign_story` to `LiveMetricKey` |
| `src/hooks/useLiveMetrics.ts` | Resolve `campaign_story` metric |
| `supabase/functions/render-stats-snapshot/index.ts` | Generate headline inline in `calculateMetrics` |
| `docs/decisions/campaign-story/...` | Decision document |
