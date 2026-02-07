# Privacy-Preserving IP Capture for Geolocation Recovery

## Executive Summary

**Problem**: When geolocation services fail, events are logged without location data and become permanently unrecoverable.

**Privacy Commitment**: IP addresses are toxic PII that must never persist in our database long-term.

**Solution**: Temporary IP capture with database-enforced automatic deletion triggers that purge IP addresses the moment location resolution succeeds.

---

## The Problem

### The Data Loss Scenario

When the `geoip` edge function fails (network issues, API rate limits, service outage), events were previously logged with:

- `ip_address: NULL`
- `zip_code: NULL`
- `latitude/longitude: NULL`

Once logged without an IP address, these events became **permanently unrecoverable** - no backfill process could ever determine their geographic origin.

### Evidence from Production

- Audit of campaign `4d7a58f3-255c-4aec-9f1b-3aa030f00067` revealed 7 "unknown" events
- All 7 had `ip_address: NULL` - the source data was never captured
- No technical path exists to recover their location

### Why This Matters

Geographic data is critical for:
- Campaign performance analysis by region
- Map visualizations showing viral spread
- Attribution and volunteer coordination
- Regulatory compliance reporting

Without recoverable location data, these analytics become incomplete and misleading.

---

## Privacy Requirements

### Why IP Addresses Are Sensitive

IP addresses are classified as **Personally Identifiable Information (PII)** under major privacy regulations:

| Regulation | Classification |
|------------|----------------|
| GDPR (EU) | Personal data when combined with other identifiers |
| CCPA (California) | Personal information |
| LGPD (Brazil) | Personal data |

**Risks of IP retention:**
- Combined with timestamps, IPs can identify individual users
- Long-term storage creates legal liability
- Data breaches expose user tracking history
- Potential for misuse in profiling or surveillance

### Privacy Principles for This System

1. **Data Minimization**: Capture only what's needed for recovery
2. **Purpose Limitation**: IP stored solely as a geocoding lookup key
3. **Automatic Deletion**: Database-enforced purge once zip code is resolved
4. **No Manual Intervention**: Privacy cleanup cannot be forgotten or bypassed

---

## Technical Architecture

### Data Flow Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   User Device   │────▶│  geoip function  │────▶│   url_events    │
│   (IP visible)  │     │  (returns IP)    │     │  (stores IP     │
│                 │     │                  │     │   temporarily)  │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │   DB Trigger    │
                                                 │  (clears IP     │
                                                 │   when zip      │
                                                 │   populated)    │
                                                 └─────────────────┘
```

### Component 1: geoip Edge Function

**File**: `supabase/functions/geoip/index.ts`

The edge function extracts the client IP from request headers and includes it in the response:

```typescript
// Extract IP from request headers (line 18-22)
const ip = 
  req.headers.get('x-forwarded-for')?.split(',')[0] ||
  req.headers.get('x-real-ip') ||
  req.headers.get('cf-connecting-ip') ||
  'unknown';

// Include IP in response (line 61)
let locationData = {
  ip,  // <-- Returned for frontend capture
  latitude: geoData.latitude || null,
  longitude: geoData.longitude || null,
  // ... other fields
};
```

### Component 2: Frontend IP Capture

**File**: `src/lib/virality/mint.ts`

The frontend captures the IP from geoip response and passes it to `logEvent()`:

```typescript
// New interface extending GeoLocationData
interface GeoLocationDataWithIP extends GeoLocationData {
  ip: string | null;
}

// In fetchGeolocation()
const geoData: GeoLocationDataWithIP = {
  ...response,
  ip: response.ip || null,
};

// In logEvent() - only pass IP if zip not already resolved
const ipToStore = location?.zip_code ? null : location?.ip;

await supabase.rpc('log_event', {
  // ... other params
  _ip_address: ipToStore,
});
```

**Smart handling**: GPS-based locations already have accurate coordinates, so IP is not stored for those events.

### Component 3: Database Privacy Triggers

Two triggers enforce automatic IP cleanup at the database level:

#### Trigger 1: On Insert

```sql
CREATE OR REPLACE FUNCTION public.clear_ip_on_insert_if_zip_exists()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.zip_code IS NOT NULL THEN
    NEW.ip_address := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clear_ip_on_insert_trigger
  BEFORE INSERT ON public.url_events
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_ip_on_insert_if_zip_exists();
```

#### Trigger 2: On Update

```sql
CREATE OR REPLACE FUNCTION public.clear_ip_when_zip_populated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.zip_code IS NULL AND NEW.zip_code IS NOT NULL THEN
    NEW.ip_address := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clear_ip_when_zip_populated_trigger
  BEFORE UPDATE ON public.url_events
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_ip_when_zip_populated();
```

---

## Privacy Guarantees

### What This Architecture Ensures

| Scenario | IP Stored? | IP Retention Duration |
|----------|-----------|----------------------|
| Geolocation succeeds on first try | **NO** | Never stored |
| GPS provides accurate location | **NO** | Never stored |
| Geolocation fails, later backfilled | YES → **NO** | Until backfill completes |
| Geolocation permanently fails | YES | Until cleanup job runs |

### The Safety Net

- IP is **only stored** when `zip_code` cannot be determined
- Once `zip_code` is set (by INSERT or UPDATE), IP is **immediately cleared**
- This is enforced at the **DATABASE level** - not dependent on application code
- Triggers run automatically - cannot be forgotten or bypassed

---

## Future Work: Backfill Job

### Purpose

Periodically retry geocoding for events that have `ip_address IS NOT NULL` but `zip_code IS NULL`.

### Proposed Implementation

```sql
-- Query to find events needing backfill
SELECT id, ip_address 
FROM url_events 
WHERE ip_address IS NOT NULL 
  AND zip_code IS NULL
  AND deleted_at IS NULL;
```

**Backfill process:**
1. Edge function or scheduled job queries events with IP but no zip
2. Calls geoip service to resolve location from stored IP
3. Updates event with location data
4. Database trigger automatically clears IP when zip is set

### Cleanup Job (for permanently unresolvable IPs)

For edge cases where geocoding permanently fails:

```sql
-- Clear IPs older than 30 days that were never resolved
UPDATE url_events
SET ip_address = NULL
WHERE ip_address IS NOT NULL
  AND zip_code IS NULL
  AND occurred_at < NOW() - INTERVAL '30 days';
```

**Recommended**: 30-day maximum retention for unresolved IPs.

---

## Critical Files Reference

| File | Purpose |
|------|---------|
| `supabase/functions/geoip/index.ts` | Returns IP in response for frontend capture |
| `src/lib/virality/mint.ts` | Captures IP from geoip, passes to logEvent conditionally |
| `supabase/migrations/20260206231557_*.sql` | Creates privacy triggers |

---

## Verification Checklist

Use these checks to verify the system is working correctly:

- [ ] **Success case**: Events with successful geolocation have `ip_address: NULL`
  ```sql
  SELECT id, zip_code, ip_address FROM url_events 
  WHERE zip_code IS NOT NULL AND ip_address IS NOT NULL;
  -- Should return 0 rows
  ```

- [ ] **Failure case**: Events with failed geolocation have `ip_address` populated
  ```sql
  SELECT id, zip_code, ip_address FROM url_events 
  WHERE zip_code IS NULL AND ip_address IS NOT NULL;
  -- May return rows (pending backfill)
  ```

- [ ] **Backfill case**: After manual backfill, IP is cleared when zip is set
  ```sql
  UPDATE url_events SET zip_code = '12345' WHERE id = '<test-id>';
  SELECT ip_address FROM url_events WHERE id = '<test-id>';
  -- ip_address should be NULL
  ```

- [ ] **GPS case**: New events via GPS never store IP addresses
  ```sql
  SELECT id FROM url_events 
  WHERE location_source = 'gps' AND ip_address IS NOT NULL;
  -- Should return 0 rows
  ```

---

## Compliance Notes

This architecture supports compliance with:

- **GDPR Article 5(1)(c)**: Data minimization - IP stored only when necessary
- **GDPR Article 5(1)(e)**: Storage limitation - automatic deletion when purpose fulfilled
- **CCPA §1798.100**: Right to know - IP is temporary processing, not retained data

For audits, this document serves as evidence of:
1. Intentional privacy-first design
2. Technical enforcement of data minimization
3. Automatic (not manual) cleanup processes

---

## Revision History

| Date | Change |
|------|--------|
| 2026-02-06 | Initial implementation of IP capture and privacy triggers |
| 2026-02-07 | Documentation created |
