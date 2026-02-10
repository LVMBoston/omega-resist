

# Harden `useLiveMetrics` with Retry, Sanitization, and Safe Defaults

## Summary

Add three hardening layers to `src/hooks/useLiveMetrics.ts` -- retry logic, input sanitization, and an `EMPTY_METRICS` fallback -- without changing the hook's public API or metric computation logic. Then verify on iOS devices.

---

## Changes (single file: `src/hooks/useLiveMetrics.ts`)

### 1. Add `withRetry` helper

```typescript
async function withRetry<T>(
  queryName: string,
  operation: () => Promise<{ data: T | null; error: any }>,
  maxRetries = 3,
  initialDelay = 300
): Promise<T | null> {
  // Exponential backoff: 300ms -> 600ms -> 1200ms
  // Logs warning on each retry
  // Throws on final failure
}
```

Applied to all four Supabase queries:
- Campaign lookup (by ID or code)
- Token query
- Event query
- Child tokens query (seeds with spawns)

### 2. Add sanitization utilities

- **`sanitizeText(value)`** -- strips control characters `[\x00-\x1F\x7F]`, trims whitespace. Applied to `campaign.title`.
- **`getSafeTimezone(tz?)`** -- validates via `Intl.DateTimeFormat('en-US', { timeZone })`. Falls back to `"UTC"`. Replaces current `getViewerTimezone`.
- **`formatTimestamp(value, timezone)`** -- returns `"--"` for null/invalid dates. Otherwise uses `formatInTimeZone`.

Exported as:
```typescript
export const liveMetricSanitizers = { sanitizeText, getSafeTimezone, formatTimestamp };
```

### 3. Add `EMPTY_METRICS` fallback

A constant array of `MetricResult` objects with `0` for numeric keys and `"--"` for text/time keys. On catch, the hook calls `setMetrics(EMPTY_METRICS)` instead of leaving state empty, ensuring hotspots always have values to render.

### 4. What does NOT change

- The `UseLiveMetricsResult` interface and return shape
- All 21 `LiveMetricKey` values and their computation logic
- The `metricsMap` construction
- `StatsPageSlide.tsx` (already gates on `!metricsLoading`)

---

## iOS Testing Plan

Use the **`bugtest` campaign** via the canonical deck URL. This tests the full end-user path including campaign resolution, metric fetching, and hotspot rendering.

### Test URL

```
https://omega-resist.lovable.app/deck/why-protest?t=l00-837854-bug-sms
```

> **Important**: You must **publish** the frontend changes first before testing on iOS devices, since they load the live URL.

### Step-by-step

**On iPhone (Safari):**

1. Open the test URL in Safari
2. Wait for the deck to load (swipe to the Data Template slide)
3. Verify: all numeric hotspots show values (not blank, not "undefined")
4. Verify: campaign name shows "BUGTEST NAME CHANGE" (not blank)
5. Verify: date/time fields show a formatted timestamp with timezone suffix (e.g., "EST")
6. Verify: if the snapshot PNG loads, the image fills the viewport with no white/black bars
7. Force-refresh (pull down or clear cache) and repeat -- this tests the retry logic under iOS ITP conditions

**On iPad (Safari):**

8. Open the same URL in Safari
9. Repeat checks 2--6 above
10. Rotate to landscape -- verify hotspots reposition correctly
11. If the snapshot fails to load (404), verify the dynamic fallback renders with live numbers (not a blank screen)

**Network failure simulation (either device):**

12. Enable Airplane Mode briefly, then disable it
13. Reload the test URL
14. Watch the console (Safari Web Inspector via Mac) for `[withRetry]` warning logs showing retry attempts
15. Verify metrics eventually populate after connectivity returns (up to 3 retries)

**Snapshot path verification:**

16. On desktop, go to `/interactive-templates`, select the `bugtest` campaign
17. Click "Server Refresh" to regenerate the snapshot
18. Check edge function logs for successful render with no retry exhaustion warnings
19. Re-test the iPhone/iPad URL to confirm the fresh snapshot loads

### What constitutes a pass

- All hotspot positions show values (numbers, text, or timestamps) -- never blank
- On error/timeout, hotspots show `"--"` or `0` (the `EMPTY_METRICS` fallback) -- never undefined
- Console shows `[withRetry]` logs on flaky connections, followed by successful resolution
- No white or black blank screens on either iPhone or iPad

