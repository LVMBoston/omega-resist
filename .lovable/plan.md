
# Documentation Plan: Privacy-Preserving IP Capture for Geolocation Recovery

## Overview

This plan creates a new documentation file (`docs/IP_CAPTURE_PRIVACY_ARCHITECTURE.md`) that explains the problem, the privacy-first solution, and provides technical reference for the implementation.

---

## Document Structure

### 1. Executive Summary
- Problem statement: Geolocation failures leave events unrecoverable
- Privacy commitment: IP addresses are toxic PII that must not persist
- Solution: Temporary IP capture with automatic deletion triggers

### 2. The Problem

**The Data Loss Scenario**
When the `geoip` edge function fails (network issues, API rate limits, service outage), events were previously logged with:
- `ip_address: NULL`
- `zip_code: NULL`
- `latitude/longitude: NULL`

Once logged without an IP address, these events became **permanently unrecoverable** - no backfill process could ever determine their geographic origin.

**Evidence from Production**
- Audit of campaign `4d7a58f3-255c-4aec-9f1b-3aa030f00067` revealed 7 "unknown" events
- All 7 had `ip_address: NULL` - the source data was never captured
- No technical path exists to recover their location

### 3. Privacy Requirements (CRITICAL SECTION)

**Why IP Addresses Are Sensitive**
- IP addresses are classified as Personally Identifiable Information (PII)
- Combined with timestamps, they can identify individual users
- Regulatory frameworks (GDPR, CCPA) require minimization of PII retention
- Long-term storage creates legal liability and breach exposure

**Privacy Principles for This System**
1. **Data Minimization**: Capture only what's needed for recovery
2. **Purpose Limitation**: IP stored solely as a geocoding lookup key
3. **Automatic Deletion**: Database-enforced purge once zip code is resolved
4. **No Manual Intervention**: Privacy cleanup cannot be forgotten or bypassed

### 4. Technical Architecture

**Data Flow Diagram**
```text
+----------------+     +------------------+     +----------------+
|  User Device   | --> |  geoip function  | --> |  url_events    |
|  (IP visible)  |     |  (returns IP)    |     |  (stores IP    |
|                |     |                  |     |   temporarily) |
+----------------+     +------------------+     +----------------+
                                                       |
                                                       v
                                              +----------------+
                                              |  DB Trigger    |
                                              |  (clears IP    |
                                              |   when zip     |
                                              |   populated)   |
                                              +----------------+
```

**Component 1: geoip Edge Function Enhancement**
- File: `supabase/functions/geoip/index.ts`
- Change: Now returns `ip` field in response (line 61)
- The IP is extracted from request headers (`x-forwarded-for`, `x-real-ip`, etc.)

**Component 2: Frontend IP Capture**
- File: `src/lib/virality/mint.ts`
- New interface: `GeoLocationDataWithIP` extends `GeoLocationData` with `ip: string | null`
- Logic: IP is passed to `logEvent()` only if zip code is not already resolved
- Smart handling: GPS-based locations don't need IP (already have accurate location)

**Component 3: Database Privacy Triggers**

*Trigger 1: clear_ip_on_insert_trigger*
```sql
CREATE TRIGGER clear_ip_on_insert_trigger
  BEFORE INSERT ON public.url_events
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_ip_on_insert_if_zip_exists();
```
Function logic:
```sql
BEGIN
  IF NEW.zip_code IS NOT NULL THEN
    NEW.ip_address := NULL;
  END IF;
  RETURN NEW;
END;
```

*Trigger 2: clear_ip_when_zip_populated_trigger*
```sql
CREATE TRIGGER clear_ip_when_zip_populated_trigger
  BEFORE UPDATE ON public.url_events
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_ip_when_zip_populated();
```
Function logic:
```sql
BEGIN
  IF OLD.zip_code IS NULL AND NEW.zip_code IS NOT NULL THEN
    NEW.ip_address := NULL;
  END IF;
  RETURN NEW;
END;
```

### 5. Privacy Guarantees

**What This Architecture Ensures**
| Scenario | IP Stored? | IP Retention |
|----------|-----------|--------------|
| Geolocation succeeds on first try | NO | Never stored |
| GPS provides accurate location | NO | Never stored |
| Geolocation fails, later backfilled | YES → NO | Until backfill completes |
| Geolocation permanently fails | YES | See "Cleanup Job" below |

**The Safety Net**
- IP is only stored when zip_code cannot be determined
- Once zip_code is set (by insert OR update), IP is immediately cleared
- This is enforced at the DATABASE level - not dependent on application code

### 6. Future Work: Backfill Job

**Purpose**
Periodically retry geocoding for events that have `ip_address IS NOT NULL` but `zip_code IS NULL`.

**Proposed Implementation**
- Edge function or scheduled job queries events with IP but no zip
- Calls geoip service to resolve location
- Updates event with location data
- Database trigger automatically clears IP when zip is set

**Cleanup Job (for permanently unresolvable IPs)**
- After N days, clear IP addresses that could never be resolved
- Prevents indefinite PII retention for edge cases
- Recommended: 30-day maximum retention

### 7. Critical Files Reference

| File | Purpose |
|------|---------|
| `supabase/functions/geoip/index.ts` | Returns IP in response for frontend capture |
| `src/lib/virality/mint.ts` | Captures IP from geoip, passes to logEvent |
| `supabase/migrations/20260206231557_*.sql` | Creates privacy triggers |

### 8. Verification Checklist

- [ ] Events with successful geolocation have `ip_address: NULL`
- [ ] Events with failed geolocation have `ip_address` populated
- [ ] After manual backfill, IP is cleared when zip is set
- [ ] New events via GPS never store IP addresses

---

## Files to Create

**`docs/IP_CAPTURE_PRIVACY_ARCHITECTURE.md`**
- Full documentation following the structure above
- Approximately 200-250 lines
- Includes code samples, diagrams, and verification steps

---

## Implementation Notes

This is a documentation-only change. No code modifications required - the implementation was completed in the previous message. This document serves as:

1. **Architectural record** for future developers
2. **Privacy compliance evidence** for audits
3. **Troubleshooting guide** for debugging location issues
4. **Reference material** for the memory system
