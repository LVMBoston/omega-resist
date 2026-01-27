
# Enhanced Server-Side Stats Page Rendering

## Overview

Implement server-side rendering for stats page slides with:
1. A new **"Last Updated"** metric showing when the snapshot was last rendered
2. **Campaign-level** snapshot interval configuration (not per-template)
3. Reliable rendering across all platforms (iOS, Android, all browsers)

---

## Browser Compatibility Notes

**Current Issue (iOS Safari):**
- WebKit's Intelligent Tracking Prevention (ITP) can block cross-origin Supabase API calls
- Safari's stricter CORS handling and cookie policies affect client-side fetching

**Android/Chrome/Firefox:**
- These browsers generally handle client-side Supabase calls without issue
- However, server-side rendering still provides benefits:
  - Faster load times (no API calls on viewer's device)
  - Consistent experience across all devices
  - Reduced battery drain on mobile

**Solution:**
Server-side pre-rendered images bypass all browser-specific API issues since the viewer just loads a static image.

---

## Architecture Changes

### Campaign-Level Configuration

Instead of configuring snapshot intervals per-template, the interval is set per-campaign. This makes sense because:
- Multiple templates may be used for the same campaign
- Admins configure campaigns, not individual templates
- Simplifies the UI and mental model

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        Data Model                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   campaigns (existing table)                                            │
│   ├── id                                                                │
│   ├── title                                                             │
│   ├── code                                                              │
│   ├── snapshot_interval_minutes (NEW, default: 2)                       │
│   └── snapshot_enabled (NEW, default: false)                            │
│                                                                         │
│   viral_slide_configs (existing table)                                  │
│   ├── id                                                                │
│   ├── template_type = 'stats_page'                                      │
│   ├── cached_snapshot_path (NEW) → relative path in storage            │
│   └── snapshot_rendered_at (NEW) → timestamp of last render            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database Schema

### 1.1 Add Campaign-Level Snapshot Settings

Add to `campaigns` table:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `snapshot_interval_minutes` | integer | 2 | How often to refresh snapshots |
| `snapshot_enabled` | boolean | false | Enable server-side rendering for this campaign |

### 1.2 Add Template-Level Snapshot State

Add to `viral_slide_configs` table:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `cached_snapshot_path` | text | null | Relative path in storage bucket |
| `snapshot_rendered_at` | timestamptz | null | When last rendered |

### 1.3 Create Storage Bucket

Create `slide-snapshots` bucket with public read access.

---

## Phase 2: New Metric - "Last Updated"

### 2.1 Add to Type System

**File: `src/types/viralTemplates.ts`**

Add `'last_updated'` to `LiveMetricKey` union:
```typescript
export type LiveMetricKey = 
  | 'manual_entry'
  | 'seeds'
  // ... existing metrics ...
  | 'latest_active'
  | 'last_updated';  // NEW: When snapshot was last rendered
```

### 2.2 Add to Metrics Hook

**File: `src/hooks/useLiveMetrics.ts`**

Add `last_updated` to `METRIC_LABELS`:
```typescript
const METRIC_LABELS: Record<LiveMetricKey, string> = {
  // ... existing labels ...
  last_updated: "Last Updated",
};
```

The value will be passed in from `StatsPageSlide` when rendering a cached snapshot.

### 2.3 Update StatsPageSlide

**File: `src/components/StatsPageSlide.tsx`**

When displaying a cached snapshot, inject `last_updated` into the metrics map:
- Format the `snapshot_rendered_at` timestamp in viewer's local timezone
- Display like other time metrics: "Jan 27, 2026 3:45 PM EST"

---

## Phase 3: Edge Function

### 3.1 Create `render-stats-snapshot`

**File: `supabase/functions/render-stats-snapshot/index.ts`**

Deno-based function that:
1. Receives `template_id` and `campaign_code` parameters
2. Fetches template data (image_url, hotspots)
3. Queries live metrics (replicating useLiveMetrics logic)
4. Uses `og_edge` library to render composite image:
   - Load base template image as background
   - Overlay text values at hotspot positions with configured styles
5. Uploads PNG to `slide-snapshots/{template_id}/latest.png`
6. Updates template with `cached_snapshot_path` and `snapshot_rendered_at`

### 3.2 Metric Calculation in Edge Function

The edge function replicates the core metric queries:
- Count tokens by level (L00, L01, L02, L03)
- Count view events (total, by channel, by location)
- Calculate viral coefficient
- Get earliest/latest activity timestamps
- Add `last_updated` = current render timestamp

---

## Phase 4: Client-Side Integration

### 4.1 Update StatsPageSlide

**File: `src/components/StatsPageSlide.tsx`**

Add cache-first rendering logic:

```text
Rendering Priority:
1. IF campaign.snapshot_enabled
   AND template.cached_snapshot_path exists
   AND template.snapshot_rendered_at < freshness_threshold
   THEN → Render static <img> (no API calls)
        → Inject last_updated into display
2. ELSE → Current dynamic rendering with useLiveMetrics hook
```

Freshness threshold = `campaign.snapshot_interval_minutes * 2.5` (buffer)

### 4.2 Update ViralSlideV2

**File: `src/components/ViralSlideV2.tsx`**

Pass snapshot configuration (path, rendered_at) from template to StatsPageSlide.

---

## Phase 5: Campaign Admin UI

### 5.1 Update Campaign Config Section

**File: `src/pages/CampaignDashboard.tsx`** or new section

Add "Server Rendering" panel in Campaign Config view:

- **Toggle**: "Enable server-side snapshot rendering"
- **Dropdown**: Refresh interval (1, 2, 5, 10, 15, 30 minutes)
- **Button**: "Render All Now" - triggers snapshot for all templates linked to campaign
- **Status list**: Shows each template's last render time

### 5.2 New Component: CampaignSnapshotSettings

A dedicated component for managing snapshot settings:
- Displays list of stats_page templates associated with campaign
- Shows render status badge for each (green/yellow/red)
- "Render Now" button per template
- Global interval setting

---

## Phase 6: Metric Selection in Editor

### 6.1 Update DataTemplateEditor

**File: `src/components/DataTemplateEditor.tsx`**

Add `last_updated` to the metric dropdown options when configuring live_number hotspots.

The metric appears as "Last Updated" in the selector and displays the snapshot render timestamp when viewed.

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| Migration: `add_campaign_snapshot_settings.sql` | Create | Add snapshot_interval_minutes, snapshot_enabled to campaigns |
| Migration: `add_template_snapshot_state.sql` | Create | Add cached_snapshot_path, snapshot_rendered_at to viral_slide_configs |
| Migration: `create_snapshots_bucket.sql` | Create | Create slide-snapshots storage bucket |
| `src/types/viralTemplates.ts` | Modify | Add `last_updated` to LiveMetricKey |
| `src/hooks/useLiveMetrics.ts` | Modify | Add `last_updated` to METRIC_LABELS |
| `supabase/functions/render-stats-snapshot/index.ts` | Create | Edge function for image generation |
| `src/components/StatsPageSlide.tsx` | Modify | Add cached snapshot rendering, inject last_updated |
| `src/components/ViralSlideV2.tsx` | Modify | Pass snapshot config to StatsPageSlide |
| `src/pages/CampaignDashboard.tsx` | Modify | Add snapshot settings UI section |
| `src/components/CampaignSnapshotSettings.tsx` | Create | Dedicated UI for snapshot management |
| `src/components/DataTemplateEditor.tsx` | Modify | Add last_updated to metric selector |

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

### Map/Chart Handling in Snapshots

Initial implementation:
- **Charts**: Rendered as simplified bar representation
- **Maps**: Show "Map loads on interaction" placeholder

Future enhancement: Static map tile rendering for snapshots.
