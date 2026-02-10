

## Problem: Samizdat Data Template Shows Empty Metrics on iOS

### Root Cause Analysis

The browser test confirms the Samizdat template works perfectly on desktop -- all 19 hotspots render with correct values (BUGTEST campaign title, 6 seeds, 13 opens, dates, etc.). The issue is **iOS-only**.

On iOS, the rendering flow is:

1. StatsPageSlide tries to load a campaign-specific snapshot PNG from `/slide-snapshots/{templateId}/snapshot-qr.png`
2. **No snapshot exists** -- `snapshot_enabled`, `cached_snapshot_path`, and `snapshot_rendered_at` are all null in the database for this template
3. The 404 triggers `snapshotLoadFailed = true`, falling back to dynamic rendering
4. Dynamic rendering on iOS Safari has known limitations with cross-origin asset positioning and text rendering in absolute-positioned overlays -- this is the exact problem the server-side snapshot pipeline was built to solve

### Fix: Deploy a Snapshot for the Samizdat Template

The `render-stats-snapshot` edge function generates pre-rendered PNG snapshots server-side, bypassing all iOS browser restrictions.

#### Step 1: Generate the Samizdat snapshot for the "qr" campaign

Call the `render-stats-snapshot` edge function with:
- `template_id`: `42485454-62e3-402a-8266-21de7bedc852` (Samizdat Template-1)
- `campaign_code`: `qr`

This will:
- Fetch the template's hotspot definitions
- Query live metrics for the "qr" campaign
- Render an SVG overlay with all 19 metric values
- Composite it onto the background image using resvg-wasm
- Save the result as `/slide-snapshots/42485454-.../snapshot-qr.png`

#### Step 2: Enable snapshot mode on the Samizdat template config

Update the `viral_slide_configs.config` JSONB to include:
```json
{
  "snapshot_enabled": true,
  "snapshot_interval_minutes": 5
}
```

This ensures that:
- iOS viewers always get the pre-rendered PNG (which includes all metrics baked in)
- The snapshot refreshes periodically to keep metrics current

#### Step 3: Verify on iOS

Navigate to `/deck/data-template-test` on an iPhone and confirm:
- Slide 1 (Samizdat) shows all metrics populated (campaign name, counts, dates)
- No white/cream empty boxes visible

### Technical Details

- **Template ID**: `42485454-62e3-402a-8266-21de7bedc852`
- **Campaign code**: `qr` (BUGTEST campaign)
- **Hotspot count**: 19 (all `live_number` type)
- **Background image**: `65d0af53-24b7-484d-a29f-42c4a96f2e5f.jpg` (accessible, 200 OK)
- **Edge function**: `render-stats-snapshot`
- **Snapshot storage path**: `slide-snapshots/42485454-62e3-402a-8266-21de7bedc852/snapshot-qr.png`

### Also Noted

The PPTxTemplate (Slide 2, template `43fe0298...`) has the same issue -- no snapshot deployed. It also has a broken background image reference. Both templates need snapshot deployment, but the PPTx one additionally needs its background image re-uploaded first.

