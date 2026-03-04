# Two-Tier Campaign Story + `campaign_story` Metric

**Status: Approved & Implemented**  
**Date: 2026-02-27**

## Summary

Split the Campaign Story into two tiers:

1. **Headline** (~8-10 short lines, no emojis): fits one iPhone screen at 30pt font (~18 chars/line). Used as the `campaign_story` metric value on Data Template slides and SVG snapshots.
2. **Full Story** (verbose, with emojis): accessible via "More..." toggle in the Campaign Dashboard dialog only.

Registered `campaign_story` as a new `LiveMetricKey` so it can be placed as a hotspot on Data Template slides and rendered in SVG snapshots.

## Architecture

### Narrative Generator (`src/lib/campaignNarrative.ts`)

- `generateCampaignNarrative(data)` now returns `{ headline: string; fullStory: string }`.
- `generateHeadlineOnly(data)` is exported separately for use by the edge function (Deno context).
- `fetchNarrativeData()` unchanged — same queries, same data shape.

### Dialog (`src/components/CampaignNarrativeDialog.tsx`)

- Default view shows the compact **headline**.
- "More..." toggle expands to the **full story** with emojis and verbose prose.
- Copy and Download always export the **full story**.

### Metric Integration

- `LiveMetricKey` includes `'campaign_story'` (`src/types/viralTemplates.ts`).
- `useLiveMetrics` hook resolves it by calling `fetchNarrativeData` + `generateCampaignNarrative` and pushing the headline as the metric value.
- `METRIC_LABELS` maps it to `"Campaign Story"`.

### Snapshot Rendering (`render-stats-snapshot` edge function)

- `calculateMetrics` builds the headline inline from already-fetched token/event data.
- The SVG renderer's existing `<tspan>` multi-line logic handles the `\n` characters in the headline.

### Data Template Editor

- No structural changes needed — `campaign_story` automatically appears in the metric key dropdown.
- Recommended hotspot size: ~60% width × 40% height.

## Files Modified

| File | Change |
|------|--------|
| `src/lib/campaignNarrative.ts` | Return `{ headline, fullStory }`, export `generateHeadlineOnly` |
| `src/components/CampaignNarrativeDialog.tsx` | Two-tier display with "More..." / "Less" toggle |
| `src/types/viralTemplates.ts` | Add `campaign_story` to `LiveMetricKey` |
| `src/hooks/useLiveMetrics.ts` | Resolve `campaign_story` metric from narrative data |
| `supabase/functions/render-stats-snapshot/index.ts` | Generate headline inline in `calculateMetrics` |
| `src/pages/DataTemplateTestHarness.tsx` | Add `campaign_story` to local `METRIC_LABELS` |

## Update — 2026-02-27

Enhanced full story to match slide mockup:

- **Duration**: Shows "X days Y hours active" (both tiers + snapshot headline).
- **Seed explanation**: Added "(A seed is a QR scan not shared.)" to the sprout paragraph.
- **Share medium breakdown**: Fetches `utm_medium` counts (sms→text, em→email) and appends only when data exists — omitted entirely if no share medium data.
- **Varied closing**: Four closing paragraphs cycling deterministically on `(seedCount + sproutCount) % 4`, maintaining themes of virality, solidarity, anonymity, and whimsy.
- **Date of report**: Appended `Date of this report: Mon DD, YYYY HH:MM TZ` at the bottom of the full story.
- **New data field**: `shareMediums: { medium: string; count: number }[]` added to `NarrativeData` interface and `fetchNarrativeData`.

## Update — 2026-02-28

Switched `campaign_story` metric to use full story instead of headline:

- **Client-side** (`useLiveMetrics.ts`): `campaign_story` now resolves to `fullStory` (verbose, with emojis) instead of `headline`.
- **Server-side** (`render-stats-snapshot`): Snapshot story generation updated to match full story format with emojis, verbose prose, share medium breakdown, geo narrative, and date of report.

## Update — 2026-03-04

Enriched the ⚡ speed line with "Fastest share:" prefix and geographic origin/destination:

- **Prefix**: Speed line now opens with "Fastest share:" in both headline and full story tiers.
- **Geographic suffix**: Appends "; {origin city, region} to {dest city, region}" when both cities resolve from `url_events`.
- **Origin logic**: First L1 token minted for the campaign → first view event with a city.
- **Destination logic**: First max-level token on the same `l00_instance` chain → first view event with a city.
- **New interface fields**: `speedOriginCity: string | null` and `speedDestCity: string | null` added to `NarrativeData`.
- **Data integrity**: Geographic suffix omitted entirely when either city is null. No placeholders.
