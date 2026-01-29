
# Map Capture Test Tool

## Overview
Add a test tool to the existing `/data-template-test` page that validates the client-side Leaflet map capture approach. This will allow you to verify that:

1. A Leaflet map can be captured as a PNG image using `html2canvas`
2. The captured image can be uploaded to Supabase storage
3. The image can be retrieved and displayed correctly

## Scope

This is a **test tool only** — not the full snapshot system. It will prove the concept before we build:
- The admin registration workflow
- The cron-based refresh system
- The smartphone detection and display logic

---

## Implementation Steps

### 1. Add `html2canvas` Dependency
Install the library needed for client-side DOM-to-canvas capture.

**File**: `package.json`
- Add `html2canvas` version `^1.4.1` to dependencies

---

### 2. Create Map Capture Test Section
Add a new expandable section to the existing `DataTemplateTestHarness.tsx` page with:

**UI Components**:
- A collapsible "Map Capture Test" card (collapsed by default)
- Campaign selector (reuse existing dropdown)
- A preview map showing the Leaflet component with campaign data
- "Capture Map" button to trigger the screenshot
- Progress indicator during capture/upload
- Result display showing:
  - Captured image preview
  - Storage path
  - Public URL
  - File size

**Technical Flow**:
```text
User clicks "Capture Map"
    |
    v
Render MapHotspotRenderer at fixed dimensions (e.g., 800x500)
    |
    v
Use html2canvas to capture the map container as canvas
    |
    v
Convert canvas to PNG blob via toBlob()
    |
    v
Upload to Supabase storage bucket (slide-snapshots)
    |
    v
Display result: preview image, path, URL
```

---

### 3. New Component: `MapCaptureTestSection`

**File**: `src/components/MapCaptureTestSection.tsx`

**Props**:
- `campaignCode: string` — selected campaign to render
- `onCaptureComplete?: (result: CaptureResult) => void` — optional callback

**State**:
- `capturing: boolean`
- `captureResult: { imagePath, publicUrl, fileSize } | null`
- `error: string | null`

**Key Logic**:
```text
1. Render MapHotspotRenderer inside a ref'd container with fixed pixel dimensions
2. Wait for map to fully load (use mapReady callback)
3. On "Capture" click:
   a. Call html2canvas(containerRef.current, { useCORS: true })
   b. Convert returned canvas to blob
   c. Upload to slide-snapshots/test-captures/{timestamp}.png
   d. Get public URL and display result
```

**Handling Tile Loading**:
- The CartoDB tiles may not be fully loaded when html2canvas runs
- Solution: Add a short delay (1-2 seconds) after mapReady before enabling capture button
- Alternative: Use `leaflet-image` plugin for more reliable tile capture (evaluate if html2canvas has issues)

---

### 4. Wire Into DataTemplateTestHarness

**File**: `src/pages/DataTemplateTestHarness.tsx`

Add a new section at the bottom of the page:

```text
<Collapsible>
  <CollapsibleTrigger>
    🗺️ Map Capture Test (Experimental)
  </CollapsibleTrigger>
  <CollapsibleContent>
    <MapCaptureTestSection campaignCode={selectedCampaign?.code} />
  </CollapsibleContent>
</Collapsible>
```

---

### 5. Storage Bucket Verification

The `slide-snapshots` bucket already exists (used by the existing edge function). Test captures will go into a `test-captures/` subfolder to keep them separate from production snapshots.

---

## Technical Details

### Dependencies to Add
| Package | Version | Purpose |
|---------|---------|---------|
| `html2canvas` | `^1.4.1` | DOM-to-canvas capture |

### Files to Create/Modify
| File | Action |
|------|--------|
| `package.json` | Add html2canvas dependency |
| `src/components/MapCaptureTestSection.tsx` | **New** — Test tool component |
| `src/pages/DataTemplateTestHarness.tsx` | Add collapsible section with new component |

### html2canvas Considerations
- **CORS**: CartoDB tiles are served with CORS headers, so `useCORS: true` should work
- **SVG Markers**: The custom SVG markers may render correctly since they're inline SVG
- **Fallback**: If html2canvas struggles with tiles, we can evaluate `leaflet-image` which is specifically designed for Leaflet maps

### Storage Path Convention
```text
slide-snapshots/
  test-captures/
    capture-{timestamp}.png    ← Test captures go here
  {template_id}/
    latest.png                 ← Production snapshots (existing)
```

---

## Success Criteria

The test tool is successful when:
1. You can select a campaign with map data (e.g., `rs-good-1`)
2. The map renders with event dots
3. Clicking "Capture Map" produces a PNG image
4. The image is uploaded to storage and displays correctly
5. The captured image shows the map tiles AND the event markers

---

## What This Proves

Once this test works, we'll know:
- Client-side map capture is feasible
- The approach can be extended to capture entire StatsPageSlide components (map + numbers)
- The admin registration workflow can trigger captures on save
- Captured maps can be composited with live numbers in the edge function

---

## Future Integration Path

After this test validates the approach:
1. **Phase 2**: Add "Capture Snapshot" button to the Data Template Editor
2. **Phase 3**: Store captured map images per template+campaign pair
3. **Phase 4**: Modify edge function to composite map images with live numbers
4. **Phase 5**: Implement User-Agent detection for smartphone snapshot display
