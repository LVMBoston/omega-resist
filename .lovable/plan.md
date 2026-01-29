# Data Template Snapshot System

## Overview

Pre-render `stats_page` templates as static WebP snapshots to solve mobile browser ITP/cross-origin issues and provide fast, universal delivery of live metrics to activist viewers.

**Goal**: Provide momentum-based motivation — activists see real-time impact of their organizing efforts without client-side API calls.

---

## Proof of Concept ✅ (Completed)

The `/data-template-test` page validated the core technical approach:

| Capability | Status | Notes |
|------------|--------|-------|
| html2canvas + Leaflet | ✅ | `useCORS: true` works with CartoDB tiles |
| Mercator projection | ✅ | `Math.log(Math.tan(π/4 + lat/2))` for DOM overlay alignment |
| Actual bounds from Leaflet | ✅ | Must use rendered bounds, not config bounds |
| Supabase storage upload | ✅ | `slide-snapshots/test-captures/` working |
| WebP compression | ✅ | ~500KB maintains quality at original dimensions |

---

## Architecture

### Hybrid Client-Server Approach

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN WORKFLOW                               │
│  (Data Template Editor)                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. Admin configures template + selects campaign                │
│                    ↓                                             │
│   2. Admin clicks "Save & Capture"                               │
│                    ↓                                             │
│   3. Client-side html2canvas captures:                           │
│      • Leaflet map with event dots                               │
│      • Chart components (if any)                                 │
│                    ↓                                             │
│   4. Upload static assets to storage:                            │
│      slide-snapshots/{template_id}/map-{campaign_code}.webp      │
│      slide-snapshots/{template_id}/chart-{campaign_code}.webp    │
│                    ↓                                             │
│   5. Update viral_slide_configs:                                 │
│      • cached_snapshot_path → latest.webp path                   │
│      • snapshot_rendered_at → timestamp                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     CRON REFRESH (5-min)                         │
│  (render-stats-snapshot Edge Function)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. Check for new url_events since last snapshot_rendered_at    │
│                    ↓                                             │
│   2. If no new activity → skip (save resources)                  │
│                    ↓                                             │
│   3. If new activity:                                            │
│      a. Fetch latest metrics via useLiveMetrics logic            │
│      b. Load cached map/chart images from storage                │
│      c. Composite: overlay live numbers on static images         │
│      d. Generate final WebP snapshot                             │
│      e. Upload to slide-snapshots/{template_id}/latest.webp      │
│      f. Update snapshot_rendered_at                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     VIEWER DELIVERY                              │
│  (DeckViewer / ViralSlideV2)                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. Detect User-Agent                                           │
│                    ↓                                             │
│   ┌─────────────────────┬─────────────────────┐                  │
│   │    SMARTPHONE       │      DESKTOP        │                  │
│   ├─────────────────────┼─────────────────────┤                  │
│   │ Serve static WebP   │ Render live         │                  │
│   │ from storage        │ interactive slide   │                  │
│   │ (no API calls)      │ (full functionality)│                  │
│   └─────────────────────┴─────────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Admin Capture Workflow

**Goal**: Enable admins to capture map/chart snapshots when saving templates.

#### 1.1 Update Data Template Editor UI

**File**: `src/components/DataTemplateEditor.tsx`

- Add "Save & Capture Snapshot" button (alongside existing Save)
- Show capture progress indicator
- Display last snapshot timestamp from `snapshot_rendered_at`

#### 1.2 Create Capture Utility

**File**: `src/lib/snapshotCapture.ts`

```typescript
interface CaptureResult {
  mapPath?: string;      // slide-snapshots/{template_id}/map-{campaign_code}.webp
  chartPath?: string;    // slide-snapshots/{template_id}/chart-{campaign_code}.webp
  timestamp: string;
}

export async function captureTemplateAssets(
  templateId: string,
  campaignCode: string,
  containerRef: RefObject<HTMLDivElement>
): Promise<CaptureResult>
```

**Logic**:
1. Use `html2canvas` with `useCORS: true`
2. Capture at 2x scale for retina quality
3. Compress to WebP (~500KB target)
4. Upload to storage with structured paths
5. Return paths for database update

#### 1.3 Storage Path Convention

```
slide-snapshots/
  {template_id}/
    map-{campaign_code}.webp      ← Static map capture (admin-triggered)
    chart-{campaign_code}.webp    ← Static chart capture (admin-triggered)
    latest.webp                   ← Composited snapshot (cron-generated)
  test-captures/
    capture-{timestamp}.png       ← Test tool captures (existing)
```

#### 1.4 Database Updates

**Table**: `viral_slide_configs`

Existing columns to use:
- `cached_snapshot_path` → Path to latest.webp
- `snapshot_rendered_at` → Last render timestamp

No schema changes needed.

---

### Phase 2: Edge Function Compositing

**Goal**: Overlay live metrics on static map/chart images.

#### 2.1 Update render-stats-snapshot Edge Function

**File**: `supabase/functions/render-stats-snapshot/index.ts`

**New Logic**:
1. Receive template_id and campaign_code
2. Query latest metrics (replicating useLiveMetrics logic)
3. Load static assets from storage (map, chart images)
4. Use canvas API to:
   - Draw base images
   - Overlay text at hotspot positions
   - Apply fonts/colors from template config
5. Export as WebP
6. Upload to `latest.webp` path

#### 2.2 Metrics Resolution (Server-Side)

Create server-side equivalent of `useLiveMetrics`:

```typescript
// In edge function
async function resolveMetrics(campaignId: string): Promise<MetricsMap> {
  // Query tokens, url_events, events_actions
  // Calculate: total_scans, total_views, l0_count, l1_count, etc.
  // Return key-value map matching hotspot data bindings
}
```

#### 2.3 Text Rendering

For each hotspot with `type: 'number'` or `type: 'text'`:
- Calculate absolute pixel position from percentage
- Apply font size, color, alignment from hotspot config
- Render using canvas `fillText()`

---

### Phase 3: Cron-Based Refresh

**Goal**: Automatically update snapshots when new activity occurs.

#### 3.1 Activity Detection Query

```sql
-- Check if refresh is needed
SELECT COUNT(*) > 0 as has_new_activity
FROM url_events ue
JOIN tokens t ON ue.token = t.token
JOIN events_actions ea ON t.eoa_id = ea.id
JOIN campaigns c ON ea.campaign_id = c.id
WHERE c.code = $1
  AND ue.occurred_at > (
    SELECT COALESCE(snapshot_rendered_at, '1970-01-01')
    FROM viral_slide_configs
    WHERE id = $2
  )
```

#### 3.2 Cron Job Setup

**File**: `supabase/config.toml` (or pg_cron if available)

```toml
[functions.render-stats-snapshot]
schedule = "*/5 * * * *"  # Every 5 minutes
```

#### 3.3 Batch Processing

For efficiency, process all templates with `snapshot_enabled = true`:
1. Query all enabled templates with their campaign associations
2. Check activity for each
3. Only render those with new events
4. Log skipped vs rendered for monitoring

---

### Phase 4: Viewer Delivery

**Goal**: Serve static snapshots to mobile, live content to desktop.

#### 4.1 User-Agent Detection

**File**: `src/components/StatsPageSlide.tsx`

```typescript
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

if (isMobile && template.cached_snapshot_path) {
  return <StaticSnapshotView path={template.cached_snapshot_path} />;
}

return <LiveInteractiveView template={template} metrics={metrics} />;
```

#### 4.2 Static Snapshot Component

**File**: `src/components/StaticSnapshotView.tsx`

- Simple `<img>` tag with storage URL
- Lazy loading for performance
- Fallback to live view if snapshot unavailable
- Optional: tap to reveal timestamp ("Updated 2 min ago")

#### 4.3 Graceful Degradation

If `cached_snapshot_path` is null or image fails to load:
- Fall back to live interactive view
- Log for monitoring
- No user-visible error

---

### Phase 5: Campaign Settings Integration

**Goal**: Allow campaign-level control of snapshot behavior.

#### 5.1 Use Existing Campaign Columns

**Table**: `campaigns` (already has these)
- `snapshot_enabled` (boolean)
- `snapshot_interval_minutes` (integer)

#### 5.2 Campaign Dashboard Toggle

**File**: `src/pages/CampaignDetail.tsx` or similar

- Add "Enable Auto-Snapshots" toggle
- Show last snapshot time
- Manual "Refresh Now" button

---

## Technical Considerations

### Canvas Rendering in Edge Functions

Deno edge functions don't have DOM access. Options:

1. **Option A: Use @vercel/og-style approach**
   - Use Satori + Resvg for SVG → PNG
   - Limited but works for text overlays

2. **Option B: Use sharp/jimp**
   - Image manipulation without DOM
   - Can composite images and add text

3. **Option C: Client-side only**
   - All compositing happens in browser during admin capture
   - Edge function just serves cached images
   - Simpler but less fresh data

**Recommended**: Option C for MVP, upgrade to B if fresher data needed.

### Hotspot Position Mapping

Hotspots are stored as percentages. For compositing:
```typescript
const pixelX = (hotspot.x / 100) * imageWidth;
const pixelY = (hotspot.y / 100) * imageHeight;
```

### Font Handling

For server-side text rendering:
- Embed font files in edge function
- Or use system fonts (less consistent)
- Or pre-render all text client-side (Option C)

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Snapshot generation time | < 3 seconds |
| WebP file size | < 500KB |
| Mobile load time (snapshot) | < 1 second |
| Cron skip rate (no activity) | > 80% |
| Visual accuracy | Markers within 5px of live |

---

## Files to Create/Modify

| File | Action | Phase |
|------|--------|-------|
| `src/lib/snapshotCapture.ts` | **Create** | 1 |
| `src/components/DataTemplateEditor.tsx` | Modify | 1 |
| `supabase/functions/render-stats-snapshot/index.ts` | Modify | 2 |
| `src/components/StaticSnapshotView.tsx` | **Create** | 4 |
| `src/components/StatsPageSlide.tsx` | Modify | 4 |
| `src/pages/CampaignDetail.tsx` | Modify | 5 |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| html2canvas tile loading race | Add 2-second delay after mapReady |
| Edge function timeout | Process max 5 templates per invocation |
| Storage costs | WebP compression, skip unchanged |
| Stale data perception | Show "Updated X ago" timestamp |
| iOS Safari still blocks | Snapshot solves this by eliminating API calls |

---

## Next Steps

1. **Implement Phase 1** — Admin capture workflow
2. **Test with real templates** — Verify map + chart captures
3. **Decide on compositing approach** — Option A, B, or C
4. **Implement Phase 4** — Mobile detection + static delivery
5. **Add cron refresh** — Phase 3, if Option B chosen
