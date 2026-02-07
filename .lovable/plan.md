
# Data Template iOS Rendering: Root Cause Analysis and Fix Plan

## Executive Summary

The iOS rendering issue for Data Templates (stats_page) stems from **missing campaign-specific snapshots** combined with **no error handling** when snapshot images fail to load. On mobile, the system forces snapshot usage but displays a blank image when the snapshot file doesn't exist.

---

## Root Cause Analysis

### The Discovery
- Template **Samizdat Template-1** (ID: `403c8c8c-fa94-4645-8ea3-d49c4e7833aa`) is used by deck `why-protest`
- The deck `why-protest` is assigned to **multiple campaigns**: `no-kings`, `ra-intro`, `bugtest`
- Only ONE snapshot exists: `/403c8c8c-fa94-4645-8ea3-d49c4e7833aa/snapshot-ra-intro.png`

### The Failure Path
1. User visits deck via `bugtest` campaign link
2. `StatsPageSlide.tsx` resolves campaign code to `bugtest`
3. System constructs URL: `{supabase}/slide-snapshots/{templateId}/snapshot-bugtest.png`
4. This file **does not exist** (returns 404)
5. The `<img>` tag has no `onError` handler - renders nothing (blank/broken)
6. On mobile, dynamic fallback is skipped because `shouldUseCachedSnapshot` is `true`

### Why This Only Shows on iOS
- Desktop: Uses dynamic rendering (fresh API calls) because `snapshotEnabled` may be false
- Mobile: **Always** uses snapshots (`isMobile || ...`) regardless of freshness checks
- If snapshot is missing, mobile shows blank; desktop shows live data

---

## The Double-Timestamp Slug

The slug `samizdat-template-1-1770234933975-1770235908658` contains **two timestamps**. This is a cosmetic bug from the auto-save logic appending timestamps on each interim save, but it's **not causing the rendering failure**. The template ID (UUID) is what's used for snapshot paths.

---

## Solution Plan

### Phase 1: Add Snapshot Error Handling (Critical)

**File: `src/components/StatsPageSlide.tsx`**

Add state tracking and error handler to detect missing snapshots:

```text
State additions:
- snapshotFailed: boolean (default false)
- snapshotLoadAttempted: boolean (default false)

Image tag changes:
- Add onError handler to set snapshotFailed = true
- Add onLoad handler to confirm successful load

Render logic change:
- If snapshotFailed && isMobile: fall back to dynamic rendering
- If snapshotFailed && !isMobile: already using dynamic (no change)
```

This ensures that when a campaign-specific snapshot doesn't exist, the system falls back to dynamic rendering rather than showing a blank screen.

### Phase 2: Ensure Snapshots Exist for All Campaigns

**Two options (can do both):**

**Option A: Manual "Deploy to Campaigns" button**
- Already exists in the editor
- Generates snapshots for all campaigns using the template
- Requires admin to click after template changes

**Option B: Pre-flight snapshot check on slide load**
- When `StatsPageSlide` detects a missing snapshot, trigger on-demand rendering
- Adds latency but ensures snapshots are always current
- Could be rate-limited to prevent abuse

### Phase 3: Improve Slug Generation (Cosmetic)

**File: `src/components/DataTemplateEditor.tsx`**

Prevent double-timestamp slugs by:
- Only appending timestamp on initial creation (not on updates)
- Stripping existing timestamps before appending new ones

---

## Technical Implementation Details

### StatsPageSlide.tsx Changes

```text
New state variables:
  const [snapshotLoadFailed, setSnapshotLoadFailed] = useState(false);
  const [snapshotAttempted, setSnapshotAttempted] = useState(false);

Updated shouldUseCachedSnapshot logic:
  const shouldUseCachedSnapshot = campaignSnapshotUrl && 
    !snapshotLoadFailed && // NEW: skip if load failed
    (isMobile || (snapshotEnabled && isSnapshotFresh(...)));

Reset state when campaign changes:
  useEffect(() => {
    setSnapshotLoadFailed(false);
    setSnapshotAttempted(false);
  }, [campaignSnapshotUrl]);

Snapshot image element with handlers:
  <img
    src={campaignSnapshotUrl}
    onLoad={() => setSnapshotAttempted(true)}
    onError={() => {
      console.warn("Snapshot failed to load:", campaignSnapshotUrl);
      setSnapshotLoadFailed(true);
    }}
  />
```

### Fallback Behavior

When snapshot fails on mobile:
1. Set `snapshotLoadFailed = true`
2. Component re-renders
3. `shouldUseCachedSnapshot` becomes false (due to `!snapshotLoadFailed`)
4. Falls through to dynamic rendering path

---

## Verification Checklist

After implementation:

- [ ] Visit `why-protest` deck via `bugtest` campaign link on mobile
- [ ] Confirm error handler fires and fallback renders
- [ ] Visit via `ra-intro` campaign (has snapshot) - confirm snapshot loads
- [ ] Visit on desktop - confirm dynamic rendering still works
- [ ] Check console for helpful error messages

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/StatsPageSlide.tsx` | Add snapshot error handling and fallback logic |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Fallback to dynamic on mobile may cause layout issues | This is the existing behavior when no snapshot exists - acceptable tradeoff |
| Rate of failed snapshot loads may be high | Log warnings to console for debugging; future work could auto-trigger renders |
| Double-timestamp slug issue | Cosmetic - defer to future cleanup if needed |

---

## Summary

The fix adds **defensive error handling** to detect missing snapshots and fall back to dynamic rendering. This ensures users always see content (either cached or live) rather than a blank screen, while maintaining the performance benefits of snapshots when they exist.
