

## Create Timezone Capture Hardening Documentation

### Overview
Add a reference document capturing the known timezone issues and hardening recommendations for the Mobilize API integration. This documents the data quality findings from our investigation and provides a validation allowlist for all US timezone designations.

### File to Create
**`docs/TIMEZONE_CAPTURE_HARDENING.md`**

### Content Summary

1. **Problem Statement** -- The `fetch-mobilize-event` edge function passes timezone strings from the Mobilize API without sanitization. At least one invalid value (`America/New York` with a space instead of underscore) has entered the `events_actions` table. The `TBD` placeholder also exists for manually-created EoAs.

2. **Known Data Quality Issues**
   - `America/New York` (space) should be `America/New_York`
   - `TBD` placeholder used when timezone is unknown

3. **Valid IANA Timezone Allowlist for Mobilize Events** -- A reference table of all US timezones that Mobilize.us may return, including territories:

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

4. **Hardening Recommendations**
   - Sanitize timezone strings in `fetch-mobilize-event` edge function (replace spaces with underscores)
   - Validate against the IANA allowlist; fall back to `America/New_York` with a console warning if unrecognized
   - Fix existing `America/New York` rows in `events_actions` via a one-time migration
   - Consider a shared timezone validation utility in `src/lib/dateUtils.ts` to centralize formatting and validation

5. **Existing Timezone Handling Locations** -- Cross-references to where timezone logic currently lives:
   - `src/lib/dateUtils.ts` -- floating local time formatter
   - `src/hooks/useLiveMetrics.ts` -- viewer-local display via `date-fns-tz`
   - `supabase/functions/fetch-mobilize-event/index.ts` -- Mobilize API timezone conversion

### Technical Details
- Single new file: `docs/TIMEZONE_CAPTURE_HARDENING.md`
- No code changes; documentation only

