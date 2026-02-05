
# Fix: Campaign-Specific Snapshot Paths for Data Templates

## Problem Statement

When you refresh the deck on your iPhone, the Data Template slide shows incorrect/stale data because **all campaigns share the same snapshot file**. The current implementation:

1. **Edge function** (`render-stats-snapshot`) saves ALL snapshots to `{template_id}/latest.png`
2. When "Deploy to Campaigns" runs for BUGTEST, no-kings, and ra-intro, each one overwrites the previous
3. Only the **last-rendered campaign's** metrics are visible to everyone

This is why you see "No Kings" data instead of "BUGTEST" data - whoever was deployed last wins.

## Solution Overview

Store snapshots at **campaign-specific paths** and resolve the correct one dynamically on the frontend.

| Current | Fixed |
|---------|-------|
| `{template_id}/latest.png` | `{template_id}/snapshot-{campaign_code}.png` |

---

## Implementation Details

### 1. Edge Function: `render-stats-snapshot/index.ts`

Change the storage path to include campaign code:

```typescript
// Line 206: Change from
const snapshotPath = `${template_id}/latest.png`;

// To
const snapshotPath = `${template_id}/snapshot-${campaign_code}.png`;
```

Also update the database record to store this campaign-specific path or skip updating the shared field.

---

### 2. Frontend: Pass `templateId` Through the Component Chain

**DeckViewer.tsx** → **ViralSlide** → **StatsPageSlide**

Currently `template_id` is available in `DeckViewer` but not passed down. The fix:

a) **ViralSlide props**: Add `templateId?: string` parameter

b) **DeckViewer**: Pass `template_id` when rendering `ViralSlide`:
```tsx
<ViralSlide 
  slideId={slide.id} 
  deckSlug={slug || ""} 
  viralToken={activeToken}
  templateId={slide.template_id}  // NEW
/>
```

c) **ViralSlideV2**: Pass `templateId` to `StatsPageSlide`:
```tsx
<StatsPageSlide 
  ...
  templateId={templateId || slideData.template_id}  // NEW
/>
```

---

### 3. Frontend: `StatsPageSlide.tsx` - Dynamic Snapshot URL

Instead of using `cachedSnapshotPath` from the database (which is template-level), construct the URL dynamically using `templateId` + resolved `campaignCode`:

a) **Add prop**: `templateId?: string`

b) **Build campaign-specific URL** after resolving `campaignCode`:
```typescript
const campaignSnapshotUrl = useMemo(() => {
  if (!templateId || !campaignCode) return null;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/slide-snapshots/${templateId}/snapshot-${campaignCode}.png`;
}, [templateId, campaignCode]);
```

c) **Use dynamic URL** in the cached snapshot rendering logic instead of `cachedSnapshotPath`.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/render-stats-snapshot/index.ts` | Campaign-specific storage path |
| `src/pages/DeckViewer.tsx` | Pass `templateId` to `ViralSlide` |
| `src/components/ViralSlideV2.tsx` | Accept and forward `templateId` to `StatsPageSlide` |
| `src/components/StatsPageSlide.tsx` | Accept `templateId`, construct dynamic snapshot URL |

---

## Post-Fix Behavior

1. Deploy to BUGTEST → saves to `template_id/snapshot-bugtest.png`
2. Deploy to no-kings → saves to `template_id/snapshot-no-kings.png`  
3. Deploy to ra-intro → saves to `template_id/snapshot-ra-intro.png`
4. iPhone refresh on BUGTEST deck → loads `snapshot-bugtest.png` with correct metrics

---

## Edge Case: What if snapshot doesn't exist?

If a campaign hasn't been deployed yet (no snapshot file exists), the component will fall back to live metrics fetching - which is the existing behavior for fresh/non-cached slides.
