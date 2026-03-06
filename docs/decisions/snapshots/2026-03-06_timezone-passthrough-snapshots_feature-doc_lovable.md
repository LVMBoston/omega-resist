# Timezone Passthrough for Snapshot Rendering

**Status:** Approved — Not Implemented  
**Date:** 2026-03-06

---

## 1. Problem

The `render-stats-snapshot` edge function formats all timestamps (e.g., `last_updated`, `first_scan`) using `toLocaleDateString()` / `toLocaleTimeString()` without a `timeZone` option. Because the Deno runtime defaults to UTC, every snapshot displays UTC times regardless of the campaign's actual locale.

## 2. Solution

### 2a. Accept `timezone` parameter in `render-stats-snapshot`

Add an optional `timezone` field to the request body (e.g., `"America/New_York"`). Validate it with `Intl.DateTimeFormat` and fall back to `"UTC"` if invalid or missing.

### 2b. Pass validated timezone to `calculateMetrics`

Update `calculateMetrics(supabase, campaignCode)` → `calculateMetrics(supabase, campaignCode, timezone)`. All `toLocaleDateString()` and `toLocaleTimeString()` calls gain `{ timeZone: validatedTz }`.

### 2c. Update client-side callers

| Caller | Timezone source |
|---|---|
| `CampaignSnapshotSettings.tsx` — Render / Render All buttons | `Intl.DateTimeFormat().resolvedOptions().timeZone` (browser) |
| `DataTemplateEditor.tsx` — Server Refresh button | `Intl.DateTimeFormat().resolvedOptions().timeZone` (browser) |
| `deploy-template-snapshots/index.ts` — batch deploy | Default `"America/New_York"` (no browser context) |
| `refresh-all-snapshots/index.ts` — cron refresh | Default `"America/New_York"` (no browser context) |

## 3. Technical Detail

### Validation helper (in `render-stats-snapshot/index.ts`)

```typescript
function validateTimezone(tz: string | undefined): string {
  if (!tz) return "UTC";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}
```

### Formatting calls (before → after)

```typescript
// Before
new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

// After
new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: validatedTz })
```

## 4. Files Changed

| File | Change |
|---|---|
| `supabase/functions/render-stats-snapshot/index.ts` | Accept `timezone`, validate, pass to `calculateMetrics`, use in all formatting |
| `src/components/CampaignSnapshotSettings.tsx` | Send browser timezone in render calls |
| `src/components/DataTemplateEditor.tsx` | Send browser timezone in server-refresh call |
| `supabase/functions/deploy-template-snapshots/index.ts` | Pass `"America/New_York"` default |
| `supabase/functions/refresh-all-snapshots/index.ts` | Pass `"America/New_York"` default |

## 5. Risk Assessment

- **Low risk** — additive change; no schema migration; existing behavior preserved when `timezone` is omitted (falls back to UTC).
- **Edge case** — if an invalid IANA string is sent, the validator silently falls back to UTC rather than erroring.
- **Future enhancement** — store a per-campaign timezone preference so batch renders use the campaign's home timezone instead of a hardcoded Eastern default.
