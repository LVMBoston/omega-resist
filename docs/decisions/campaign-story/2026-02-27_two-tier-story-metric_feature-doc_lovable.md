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

## Update — 2026-03-04 (SVG Formatting)

Synchronized server-side SVG snapshot rendering with client-side dialog formatting:

- **Title rendering**: `__TITLE__` sentinels now used in server-side narrative. SVG renderer strips sentinels and renders title text at 1.25× font size, bold.
- **Emoji hanging indents**: Emoji-prefixed paragraphs rendered with emoji at left margin and body text indented, matching the flexbox pattern in the dialog.
- **Paragraph spacing**: Blank lines produce vertical gaps instead of zero-height tspans.
- **Word wrapping**: Long lines auto-wrap to fit within hotspot width.
- **Top-aligned text**: `campaign_story` hotspot uses top-aligned layout instead of vertical centering.
- **Clipping**: SVG `clipPath` prevents text overflow beyond hotspot bounds.
- **Content sync**: Added `__TITLE__` markers, "Last share" timestamp query, "Fastest share:" prefix with geographic origin/destination queries.
- **UTC fix**: Removed manual `" UTC"` suffixes that caused "UTC UTC" duplication with Deno's `timeZoneName: "short"`.

## Update — 2026-06-26

Status: Approved & Implemented

### Landscape two-column support

The campaign_story metric is sized for portrait decks. On landscape decks the
narrative is too tall to fit. Instead of changing the story content or
auto-flowing CSS columns (which would break editor/SSR parity), each
`campaign_story` hotspot now carries an optional `storySegment` field:

- `full` (default) — entire story, today's behavior.
- `first` — left/top column. Always includes the `__TITLE__` block.
- `second` — right/bottom column. Always includes the `Date of this report:` footer.

For landscape layouts, place two `campaign_story` hotspots side-by-side and
set one to First, the other to Second. The split point is computed by
`splitCampaignStoryAtMidpoint` (in `src/lib/campaignStorySplit.ts` and a
mirrored Deno copy at `supabase/functions/render-stats-snapshot/campaignStorySplit.ts`)
by picking the paragraph boundary that minimizes `abs(leftChars − rightChars)`.

### Files touched
- `src/types/viralTemplates.ts` — added `storySegment` field on `Hotspot`.
- `src/lib/campaignStorySplit.ts` + `.test.ts` — splitter + 7 unit tests.
- `supabase/functions/render-stats-snapshot/campaignStorySplit.ts` — Deno mirror.
- `supabase/functions/render-stats-snapshot/index.ts` — slice story before render.
- `src/components/StatsPageSlide.tsx`, `src/components/HybridSlide.tsx` — apply slice in editor.
- `src/components/HotspotCalibrationControls.tsx` — Story segment selector (campaign_story only).

### Parity
Identical splitter logic runs in the in-app renderer and the SSR snapshot,
satisfying the editor/SSR parity rule. Portrait decks and any hotspot left
on `full` render exactly as before.
