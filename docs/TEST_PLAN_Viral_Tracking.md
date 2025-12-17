# Viral Tracking Test Plan

## Overview

This test plan validates that L00 tokens from three EoA sources (`rs1-qr`, `rs1-text`, `rs1-mail`) display correctly on `/campaign-dashboard` in both **Samizdat Map** and **Activity Monitor (EventsV2)**.

---

## Actual Schema Reference

| PRD Concept | Actual Table | Key Columns |
|-------------|--------------|-------------|
| Token chain | `tokens` | `token`, `parent_token`, `root_token`, `level`, `eoa_id` |
| Events | `url_events` | `token`, `event_type`, `zip_code`, `latitude`, `longitude`, `occurred_at` |
| EoA (origin) | `events_actions` | `id`, `utm_id`, `campaign_id`, `mobilize_code`, `assigned_deck_slug` |
| Campaign | `campaigns` | `id`, `code`, `title` |
| Aggregates | `daily_aggregates` | `date`, `eoa_id`, `level`, `scans`, `views`, `shares` |
| ZIP coords | `zip_codes` | `zip_code`, `latitude`, `longitude` |

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INGEST PIPELINE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User scans QR / clicks link                                     │
│           │                                                          │
│           ▼                                                          │
│  2. URL contains token (t=xxx) + UTM params                         │
│           │                                                          │
│           ▼                                                          │
│  3. DeckViewer resolves token via lookup_token()                    │
│           │                                                          │
│           ▼                                                          │
│  4. Client calls log_event() with:                                  │
│     - token                                                          │
│     - event_type ('scan', 'view', 'share')                          │
│     - geolocation (zip_code, lat/lng from geoip edge function)      │
│           │                                                          │
│           ▼                                                          │
│  5. Row inserted into url_events                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        READ PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Samizdat Map:                                                       │
│    url_events (event_type='view')                                   │
│      → JOIN tokens ON url_events.token = tokens.token               │
│      → JOIN zip_codes ON url_events.zip_code = zip_codes.zip_code   │
│      → Filter by eoa_id (from selected EoAs)                        │
│      → One point per view event                                      │
│                                                                      │
│  Activity Monitor:                                                   │
│    url_events                                                        │
│      → JOIN tokens ON url_events.token = tokens.token               │
│      → Filter by eoa_id, event_type, date range                     │
│      → Raw rows displayed                                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Test Data Setup

### Campaign: res-sis-live

Campaign ID: `69b036da-e620-4068-b2d7-49df6781b7a3`

### Three EoAs (Origin Variants)

| EoA Name | utm_id | utm_medium | Purpose |
|----------|--------|------------|---------|
| RS1 QR | `rs1-qr` | `qr` | QR code scans |
| RS1 Text | `rs1-text` | `sms` | SMS link clicks |
| RS1 Mail | `rs1-mail` | `em` | Email link clicks |

### Verify EoAs Exist

```sql
SELECT 
  id as eoa_id,
  utm_id,
  title,
  mobilize_code,
  assigned_deck_slug,
  start_date
FROM events_actions
WHERE campaign_id = '69b036da-e620-4068-b2d7-49df6781b7a3'
  AND utm_id IN ('rs1-qr', 'rs1-text', 'rs1-mail');
```

### Mint L00 Tokens (One Per EoA)

```sql
-- For each EoA, mint an L00 token
-- Must be authenticated as admin or manager

-- QR origin
SELECT * FROM mint_l00(
  '<eoa_id_for_rs1-qr>'::uuid,
  '<assigned_deck_slug>',
  'qr'
);

-- SMS origin  
SELECT * FROM mint_l00(
  '<eoa_id_for_rs1-text>'::uuid,
  '<assigned_deck_slug>',
  'sms'
);

-- Email origin
SELECT * FROM mint_l00(
  '<eoa_id_for_rs1-mail>'::uuid,
  '<assigned_deck_slug>',
  'em'
);
```

**Note:** L00 token format is deterministic: `l00-{mobilize_code}-{utm_id_first_10_chars}`

---

## Core Test Matrix

Run these flows for each origin (`rs1-qr`, `rs1-text`, `rs1-mail`).

### Flow A: First Open (L00 View)

| Step | Action | Expected Write | Expected Render |
|------|--------|----------------|-----------------|
| 1 | Open L00 URL in fresh browser | `url_events` row: `event_type='view'`, `token=L00`, `zip_code` populated | Samizdat Map: 1 point at ZIP centroid |
| 2 | - | - | Activity Monitor: 1 row showing view event |

**Verification Query:**
```sql
SELECT 
  e.id,
  e.token,
  e.event_type,
  e.zip_code,
  e.occurred_at,
  t.level,
  t.eoa_id
FROM url_events e
JOIN tokens t ON e.token = t.token
WHERE t.token LIKE 'l00-%'
  AND e.event_type = 'view'
  AND e.occurred_at > now() - interval '1 hour'
ORDER BY e.occurred_at DESC;
```

### Flow B: Share Intent (Mint L01)

| Step | Action | Expected Write | Expected Render |
|------|--------|----------------|-----------------|
| 1 | Click share button (SMS or Email) | `tokens` row: new L01 token with `parent_token=L00`, `level=1` | - |
| 2 | - | `url_events` row: `event_type='share'`, `token=L00` | Activity Monitor: share event row |

**Verification Query:**
```sql
-- Check L01 token was minted
SELECT 
  token,
  parent_token,
  root_token,
  level,
  utm_medium,
  minted_at
FROM tokens
WHERE parent_token LIKE 'l00-%'
  AND level = 1
  AND minted_at > now() - interval '1 hour'
ORDER BY minted_at DESC;

-- Check share event was logged
SELECT *
FROM url_events
WHERE event_type = 'share'
  AND occurred_at > now() - interval '1 hour'
ORDER BY occurred_at DESC;
```

### Flow C: Child Open (L01 View)

| Step | Action | Expected Write | Expected Render |
|------|--------|----------------|-----------------|
| 1 | Open L01 URL (minted from share) | `url_events` row: `event_type='view'`, `token=L01` | Samizdat Map: 1 additional point |
| 2 | - | - | Activity Monitor: view event for L01 |

**Verification Query:**
```sql
SELECT 
  e.id,
  e.token,
  e.event_type,
  e.zip_code,
  t.level,
  t.parent_token,
  t.root_token
FROM url_events e
JOIN tokens t ON e.token = t.token
WHERE t.level > 0
  AND e.event_type = 'view'
  AND e.occurred_at > now() - interval '1 hour'
ORDER BY e.occurred_at DESC;
```

---

## Assertions

### 1. Filter Parity (Map ↔ Activity Monitor)

For identical filters, counts must match:

```sql
-- Count for specific EoA
SELECT 
  COUNT(*) as total_views,
  COUNT(DISTINCT e.zip_code) as unique_zips
FROM url_events e
JOIN tokens t ON e.token = t.token
WHERE t.eoa_id = '<target_eoa_id>'
  AND e.event_type = 'view'
  AND e.is_simulated = false
  AND e.occurred_at >= '<start_date>'
  AND e.occurred_at < '<end_date>';
```

**Map should show:** `total_views` points
**Activity Monitor should show:** `total_views` rows

### 2. Origin Separation

When filtering to one EoA, other EoAs must not appear:

```sql
-- This should return 0 rows when filtering to rs1-qr
SELECT e.*
FROM url_events e
JOIN tokens t ON e.token = t.token
JOIN events_actions ea ON t.eoa_id = ea.id
WHERE ea.utm_id = 'rs1-qr'
  AND t.eoa_id IN (
    SELECT id FROM events_actions 
    WHERE utm_id IN ('rs1-text', 'rs1-mail')
  );
```

### 3. Token Chain Correctness

```sql
-- Verify parent-child chain integrity
SELECT 
  child.token as child_token,
  child.level as child_level,
  child.parent_token,
  parent.token as parent_token_exists,
  parent.level as parent_level,
  child.root_token,
  root.token as root_token_exists,
  CASE 
    WHEN child.level = parent.level + 1 THEN '✓ Level OK'
    ELSE '✗ Level ERROR'
  END as level_check,
  CASE 
    WHEN child.root_token = parent.root_token THEN '✓ Root OK'
    ELSE '✗ Root ERROR'
  END as root_check
FROM tokens child
JOIN tokens parent ON child.parent_token = parent.token
JOIN tokens root ON child.root_token = root.token
WHERE child.level > 0
  AND child.minted_at > now() - interval '1 hour';
```

### 4. Aggregate Consistency

After running `refresh_daily_aggregates()`:

```sql
-- Trigger refresh
SELECT refresh_daily_aggregates();

-- Compare raw vs aggregate
WITH raw_counts AS (
  SELECT 
    date_trunc('day', e.occurred_at)::date as date,
    t.eoa_id,
    t.level,
    COUNT(*) FILTER (WHERE e.event_type = 'view') as raw_views,
    COUNT(*) FILTER (WHERE e.event_type = 'share') as raw_shares
  FROM url_events e
  JOIN tokens t ON e.token = t.token
  WHERE e.is_simulated = false
  GROUP BY 1, 2, 3
)
SELECT 
  r.date,
  r.eoa_id,
  r.level,
  r.raw_views,
  da.views as agg_views,
  r.raw_shares,
  da.shares as agg_shares,
  CASE WHEN r.raw_views = da.views THEN '✓' ELSE '✗' END as views_match,
  CASE WHEN r.raw_shares = da.shares THEN '✓' ELSE '✗' END as shares_match
FROM raw_counts r
LEFT JOIN daily_aggregates da 
  ON r.date = da.date 
  AND r.eoa_id = da.eoa_id 
  AND r.level = da.level;
```

---

## Test Isolation

### Using `is_simulated` Flag

Both `tokens` and `url_events` have an `is_simulated` boolean column.

**For test data:**
- Set `is_simulated = true` on test tokens/events
- Filter production views with `WHERE is_simulated = false`
- Clean up with `DELETE FROM tokens WHERE is_simulated = true`

**Note:** RLS policy allows admins/managers to delete simulated data.

---

## Manual Test Checklist

### Prerequisites
- [ ] Logged in as admin or manager
- [ ] Campaign `res-sis-live` selected
- [ ] Three EoAs exist with `utm_id`: rs1-qr, rs1-text, rs1-mail
- [ ] Each EoA has `assigned_deck_slug` and `mobilize_code` set

### Test Execution

#### Round 1: rs1-qr
- [ ] Mint L00 token for rs1-qr EoA
- [ ] Open L00 URL in incognito browser
- [ ] Verify view event in Activity Monitor
- [ ] Verify point on Samizdat Map
- [ ] Click share (SMS)
- [ ] Verify L01 token minted
- [ ] Open L01 URL
- [ ] Verify L01 view event
- [ ] Verify second point on Map

#### Round 2: rs1-text
- [ ] Repeat above steps for rs1-text EoA

#### Round 3: rs1-mail
- [ ] Repeat above steps for rs1-mail EoA

#### Cross-Origin Verification
- [ ] Select only rs1-qr in Samizdat EoA selector
- [ ] Verify Map shows only rs1-qr points
- [ ] Verify Activity Monitor shows only rs1-qr events
- [ ] Repeat for rs1-text and rs1-mail

---

## Automation Recommendations

### Playwright E2E Tests

```typescript
// Example test structure
test.describe('Viral Tracking', () => {
  test('L00 view creates map point', async ({ page }) => {
    // Open L00 URL
    await page.goto(l00Url);
    
    // Navigate to campaign dashboard
    await page.goto('/campaign-dashboard?campaignId=...');
    
    // Select Samizdat tab
    await page.click('text=Samizdat');
    
    // Verify map has point
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
  });
  
  test('Share mints L01 token', async ({ page }) => {
    // Open deck
    await page.goto(l00Url);
    
    // Click share
    await page.click('[data-testid="share-button"]');
    
    // Select SMS
    await page.click('text=SMS');
    
    // Verify L01 URL generated
    await expect(page.locator('[data-testid="share-url"]')).toContainText('v_lvl=01');
  });
});
```

### Database Tests (pgTAP)

```sql
-- Test: L01 must have parent_token
BEGIN;
SELECT plan(1);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM tokens 
    WHERE level > 0 AND parent_token IS NULL
  ),
  'All L01+ tokens must have parent_token'
);

SELECT * FROM finish();
ROLLBACK;
```

---

## Quick Reference: Key Functions

| Function | Purpose | Usage |
|----------|---------|-------|
| `mint_l00(eoa_id, deck_slug, utm_medium)` | Create L00 token | Admin/manager only |
| `mint_share(parent_token, utm_medium)` | Create L01-L03 token | Called on share |
| `log_event(token, event_type, ...)` | Record view/share/scan | Called on page load |
| `lookup_token(token)` | Resolve token to deck | Called by DeckViewer |
| `refresh_daily_aggregates()` | Rebuild aggregate table | Manual or cron |

---

## Troubleshooting

### No points on Map
1. Check `url_events` has rows with `zip_code` populated
2. Check `zip_codes` table has matching coordinates
3. Check EoA selector has the right EoAs checked

### Events not showing in Activity Monitor
1. Check `url_events` has `is_simulated = false`
2. Check date filter includes event timestamp
3. Check EoA filter matches token's `eoa_id`

### Token chain broken
1. Check `parent_token` points to existing token
2. Check `root_token` matches L00 token
3. Check `level` increments correctly (0 → 1 → 2 → 3)
