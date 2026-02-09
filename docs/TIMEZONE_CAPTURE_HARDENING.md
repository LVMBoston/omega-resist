# Timezone Capture Hardening

## 1. Problem Statement

The `fetch-mobilize-event` edge function passes timezone strings from the Mobilize API without sanitization. At least one invalid value (`America/New York` with a space instead of underscore) has entered the `events_actions` table. The `TBD` placeholder also exists for manually-created EoAs.

---

## 2. Known Data Quality Issues

| Bad Value | Expected Value | Source |
|-----------|---------------|--------|
| `America/New York` | `America/New_York` | Mobilize API (space instead of underscore) |
| `TBD` | _(unknown)_ | Manually-created EoAs |

---

## 3. Valid IANA Timezone Allowlist for Mobilize Events

All US timezones that Mobilize.us may return, including territories:

| IANA Timezone | Region | UTC Offset (Std / DST) |
|---|---|---|
| `America/New_York` | Eastern | -5 / -4 |
| `America/Chicago` | Central | -6 / -5 |
| `America/Denver` | Mountain | -7 / -6 |
| `America/Los_Angeles` | Pacific | -8 / -7 |
| `America/Anchorage` | Alaska | -9 / -8 |
| `Pacific/Honolulu` | Hawaii | -10 / no DST |
| `America/Phoenix` | Arizona | -7 / no DST |
| `America/Puerto_Rico` | PR / USVI | -4 / no DST |
| `Pacific/Guam` | Guam / CNMI | +10 / no DST |
| `Pacific/Pago_Pago` | American Samoa | -11 / no DST |

---

## 4. Hardening Recommendations

1. **Sanitize timezone strings** in `fetch-mobilize-event` edge function — replace spaces with underscores before storing.
2. **Validate against the IANA allowlist** above; fall back to `America/New_York` with a `console.warn` if unrecognized.
3. **Fix existing bad data** — one-time migration to update `America/New York` → `America/New_York` in `events_actions`.
4. **Shared validation utility** — consider adding a `sanitizeTimezone()` function in `src/lib/dateUtils.ts` to centralize formatting and validation.

---

## 5. Existing Timezone Handling Locations

| Location | Purpose |
|----------|---------|
| `src/lib/dateUtils.ts` | `formatFloatingLocalTime()` — wall-clock display without conversion |
| `src/hooks/useLiveMetrics.ts` | `formatInTimeZone()` via `date-fns-tz` — viewer-local display |
| `supabase/functions/fetch-mobilize-event/index.ts` | `formatDatetimeInTimezone()` via `Intl.DateTimeFormat` — Mobilize API timezone conversion |
