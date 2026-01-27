# Enhanced Server-Side Stats Page Rendering

## Status: ✅ Implemented

## Overview

Server-side rendering for stats page slides with:
1. A new **"Last Updated"** metric showing when the snapshot was last rendered
2. **Campaign-level** snapshot interval configuration
3. Reliable rendering across all platforms (iOS, Android, all browsers)

---

## Implementation Summary

### Database Changes
- Added `snapshot_interval_minutes` (default: 2) and `snapshot_enabled` (default: false) to `campaigns` table
- Added `cached_snapshot_path` and `snapshot_rendered_at` to `viral_slide_configs` table
- Created `slide-snapshots` storage bucket with public read access

### Type System
- Added `last_updated` to `LiveMetricKey` in `src/types/viralTemplates.ts`
- Updated `METRIC_LABELS` in `src/hooks/useLiveMetrics.ts`
- Updated `METRIC_OPTIONS` in `src/components/HotspotCalibrationControls.tsx`
- Updated `METRIC_LABELS` in `src/pages/DataTemplateTestHarness.tsx`

### Edge Function
- Created `supabase/functions/render-stats-snapshot/index.ts`
- Uses `og_edge` library for React-to-image rendering
- Calculates live metrics server-side
- Uploads PNG to storage bucket
- Updates template with snapshot path and timestamp

### Client-Side Integration
- Updated `src/components/StatsPageSlide.tsx` with cache-first rendering logic
- Updated `src/components/ViralSlideV2.tsx` to fetch and pass snapshot configuration
- Added snapshot URL helper functions

### Admin UI
- Created `src/components/CampaignSnapshotSettings.tsx` component
- Added to Campaign Dashboard's Filters tab
- Includes enable toggle, interval selector, render buttons, and status badges

---

## Usage

1. Go to Campaign Dashboard → Filters tab
2. Enable "Server-Side Rendering" for the campaign
3. Set the refresh interval (how often snapshots should update)
4. Click "Render Now" on individual templates or "Render All" for all templates
5. Viewers will see the cached static image instead of making API calls

---

## How It Works

```text
[Admin triggers render]
       ↓
[Edge function executes]
  - Fetches template hotspots
  - Calculates live metrics
  - Renders composite PNG using og_edge
  - Uploads to slide-snapshots bucket
  - Updates template record
       ↓
[Viewer loads stats page]
  - Checks if snapshot is fresh (< 2.5x interval)
  - If fresh → Show static PNG (no API calls)
  - If stale → Fall back to dynamic rendering
```

---

## Files Modified/Created

| File | Status |
|------|--------|
| `supabase/functions/render-stats-snapshot/index.ts` | Created |
| `src/components/CampaignSnapshotSettings.tsx` | Created |
| `src/types/viralTemplates.ts` | Modified |
| `src/hooks/useLiveMetrics.ts` | Modified |
| `src/components/HotspotCalibrationControls.tsx` | Modified |
| `src/pages/DataTemplateTestHarness.tsx` | Modified |
| `src/components/StatsPageSlide.tsx` | Modified |
| `src/components/ViralSlideV2.tsx` | Modified |
| `src/pages/CampaignDashboard.tsx` | Modified |

---

## Known Limitations

- Chart hotspots are rendered as placeholder text in snapshots
- Map hotspots are rendered as placeholder text in snapshots
- Scheduled/cron-based rendering not yet implemented (manual trigger only)

---

## Technical Notes

### Why Campaign-Level Configuration?

1. **Unified Control**: One place to manage refresh rates for all campaign templates
2. **Resource Efficiency**: Render all campaign templates on same schedule
3. **Simpler Mental Model**: "This campaign updates every 2 minutes" vs managing each template

### og_edge Image Generation

The edge function uses `og_edge` (Deno-native library) to render React-style JSX as images:
- Background image from template's `image_url`
- Text overlays positioned per hotspot coordinates
- Styles applied from `liveNumberStyle` configuration
- Charts and maps: Show placeholder text in initial version

### Fallback Behavior

If snapshot rendering fails or is stale:
- Dynamic rendering kicks in (current behavior)
- Logs error for admin visibility
- Doesn't break the viewer experience
