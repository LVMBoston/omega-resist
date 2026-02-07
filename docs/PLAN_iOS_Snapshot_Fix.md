# Plan: Fix iOS Safari Data Template Rendering

## Problem Summary

Data Templates on iOS Safari show **partial data** - some metrics render while others show placeholders:

- **Working**: Token-based metrics (seeds, shares, levels)
- **NOT working**: Campaign name, activity dates, opens, ZIP codes

Root cause: Race conditions in dynamic rendering where some Supabase queries complete while others fail or timeout on iOS Safari.

---

## Solution: Server-Side Snapshot Rendering with Retry Logic

Since snapshots are pre-rendered and cached, we have unlimited time to ensure data completeness. The edge function can retry failed queries without affecting user-perceived latency.

---

## Part 1: Portrait Aspect Ratio Fix

Data Templates use 9:16 portrait orientation for mobile viewing.

### Change (in `supabase/functions/render-stats-snapshot/index.ts`)

| Setting | Before | After |
|---------|--------|-------|
| Width | 1920 | 1080 |
| Height | 1080 | 1920 |
| Font scale | `baseFontSize * 2` | `Math.round(baseFontSize * (width / 960))` ≈ 1.125x |

---

## Part 2: Retry Logic for Database Queries

Added a `fetchWithRetry` helper that attempts each query up to 5 times with 1-second delays:

```typescript
async function fetchWithRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  description: string,
  maxAttempts = 5,
  delayMs = 1000
): Promise<T | null>
```

### Queries with Retry

1. **tokens query** - Token counts by level
2. **url_events query** - Event counts, opens, ZIP codes
3. **campaign title query** - Campaign name resolution
4. **child tokens query** - Seeds with spawns calculation
5. **template fetch** - Template configuration

---

## Part 3: Frontend Timing Fix

Modified `StatsPageSlide.tsx` to gate hotspot rendering on `!metricsLoading`:

```tsx
{imageLoaded && imageDimensions.width > 0 && !metricsLoading && liveNumberHotspots.map(...)}
```

This prevents partial renders where some hotspots appear before all metrics are resolved.

---

## Part 4: Campaign Unassignment (Database)

Unassign `no-kings` and `ra-intro` campaigns from the `why-protest` deck:

```sql
UPDATE events_actions
SET assigned_deck_slug = NULL, updated_at = NOW()
WHERE assigned_deck_slug = 'why-protest'
  AND campaign_id IN (
    SELECT id FROM campaigns WHERE code IN ('no-kings', 'ra-intro')
  );
```

Only the `bugtest` campaign (EOA: "L00=em Copy") will remain assigned.

---

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/render-stats-snapshot/index.ts` | Portrait dimensions (1080x1920), retry logic, improved logging |
| `src/components/StatsPageSlide.tsx` | Gate hotspot rendering on `!metricsLoading` |

---

## Testing

1. Navigate to Data Template Editor (`/interactive-templates`)
2. Select the `bugtest` campaign
3. Click "Server Refresh" to regenerate snapshot
4. Check edge function logs for retry attempts
5. Verify snapshot dimensions are 1080x1920 (portrait)
6. Test on iPhone: https://omega-resist.lovable.app/deck/why-protest?t=l00-837854-bug-sms:2919df

### Expected Results

- "BUGTEST NAME CHANGE" appears in Name field
- Activity dates populate correctly
- All numeric metrics (opens, ZIP codes) render
- No blank white sections in the snapshot

---

## Technical Details

### Why Retry Logic Works

Server-side snapshots have no user-perceived latency constraint:
- 5 retry attempts with 1-second delays = up to 5 seconds per query
- Total rendering time can take 20+ seconds without impacting UX
- Failed queries are logged for debugging

### Why Portrait Dimensions

- Mobile-first design uses 9:16 aspect ratio
- Hotspot positions are calculated as percentages
- Wrong canvas dimensions cause hotspots to render off-canvas
- 1080x1920 matches the template design proportions

---

## Metrics Available

The snapshot renderer calculates these metrics:

| Key | Description |
|-----|-------------|
| `campaign_name` | Campaign title from `campaigns.title` |
| `seeds` | Count of L00 tokens |
| `shares` | Count of L01+ tokens |
| `l01_count`, `l02_count`, `l03_count` | Tokens by level |
| `opens` | Total view events |
| `opens_us`, `opens_intl` | Views by country |
| `opens_qr`, `opens_text`, `opens_mail` | Views by medium |
| `neighborhoods` | Distinct ZIP codes |
| `depth` | Maximum token depth |
| `viral_coefficient` | shares / seeds |
| `seeds_with_spawns` | L00 tokens with children |
| `earliest_active` | First activity timestamp |
| `latest_active` | Most recent activity timestamp |
| `current_date`, `current_time`, `last_updated` | Render timestamps |
