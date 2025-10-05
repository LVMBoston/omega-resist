# Viral Tokens System

## Overview

The Viral Tokens system implements Democracy Forge's canonical nomenclature for tracking viral content sharing across multiple levels (L00-L03). It provides token minting, event logging, and analytics aggregation.

## Architecture

### Database Schema

- **campaigns**: Campaign metadata (code, title, description)
- **events_actions**: Events or Actions (EoAs) linked to campaigns
- **deck_versions**: Versioned decks that can be shared
- **placements**: L00 context (site, channel, batch)
- **tokens**: Unified L00-L03 tokens with parent/root tracking
- **url_events**: Append-only log of scan/view/share events
- **daily_aggregates**: Rollup metrics by date/campaign/eoa/deck/placement/level
- **user_roles**: Role-based access control (admin/manager/viewer)

### Token Hierarchy

```
L00 (Root) ─┬─ L01 (Share) ─┬─ L02 (Share) ── L03 (Share)
            │                └─ L02 (Share) ── L03 (Share)
            └─ L01 (Share) ─── L02 (Share) ── L03 (Share)
```

Each token maintains:
- `token`: Unique 8-character identifier
- `parent_token`: Token that generated this share (null for L00)
- `root_token`: Original L00 token (maintains chain lineage)
- `level`: 0-3 (L00, L01, L02, L03)

## Core Functions

### 1. `mint_l00(eoa_id, placement_id, deck_slug, utm_medium)`

**Purpose**: Mint root-level (L00) tokens for campaigns

**Permissions**: Requires `admin` or `manager` role

**Returns**: `{token, full_url}`

**Example**:
```typescript
import { mintL00 } from "@/lib/virality/mint";

const result = await mintL00({
  eoaId: "uuid-of-event-or-action",
  placementId: "uuid-of-placement",
  deckSlug: "falmouth-preview",
  utmMedium: "qr"
});

console.log(result.token);     // "abc12345"
console.log(result.full_url);  // Full URL with UTM parameters
```

### 2. `mint_share(parent_token, utm_medium)`

**Purpose**: Mint share tokens (L01-L03) from parent

**Permissions**: Any authenticated user

**Returns**: `{token, full_url, level}`

**Example**:
```typescript
import { mintShare } from "@/lib/virality/mint";

const result = await mintShare({
  parentToken: "abc12345",  // L00 token
  utmMedium: "sms"
});

console.log(result.level);     // 1 (L01)
console.log(result.token);     // "def67890"
console.log(result.full_url);  // Full URL with parent tracking
```

### 3. `log_event(token, event_type, utm_snapshot, ip, ua)`

**Purpose**: Log user interactions (scan/view/share)

**Permissions**: Public (append-only via SECURITY DEFINER)

**Event Types**: `scan`, `view`, `share`

**Example**:
```typescript
import { logEvent } from "@/lib/virality/mint";

await logEvent({
  token: "abc12345",
  eventType: "view",
  utmSnapshot: {
    utm_source: "L00",
    utm_medium: "qr",
    utm_campaign: "no-kings"
  },
  ip: "203.0.113.9",
  ua: navigator.userAgent
});
```

### 4. `refresh_daily_aggregates()`

**Purpose**: Refresh daily rollup metrics

**Permissions**: Admin only (typically called via cron)

**Example**:
```sql
SELECT refresh_daily_aggregates();
```

## UTM Parameter Structure

### L00 (Root Token)
```
?utm_campaign=no-kings
&utm_id=nkd25_02
&utm_source=L00
&utm_medium=qr
&utm_content=rally-site-001
&t=abc12345
&v_lvl=00
```

### L01+ (Share Tokens)
```
?utm_campaign=no-kings
&utm_id=nkd25_02
&utm_source=L01
&utm_medium=sms
&t=def67890
&p=abc12345
&v_lvl=01
```

## Query Utilities

### Token Metrics (Breadth & Depth)
```typescript
import { getTokenMetrics } from "@/lib/virality/queries";

const metrics = await getTokenMetrics("abc12345");
// { l0: 1, l1: 5, l2: 12, l3: 3, depth: 3 }
```

### Campaign Aggregates
```typescript
import { getCampaignAggregates } from "@/lib/virality/queries";

const aggregates = await getCampaignAggregates(
  "campaign-uuid",
  "2025-10-01",
  "2025-10-31"
);
```

### Token Chain
```typescript
import { getTokenChain } from "@/lib/virality/queries";

const chain = await getTokenChain("def67890");
// Returns all tokens in the parent/child chain
```

## RLS Security

| Table | Policy | Enforcement |
|-------|--------|-------------|
| **tokens** | View: anyone; Insert: authenticated | Standard |
| **url_events** | Insert: via `log_event()` only; View: admin/manager | SECURITY DEFINER |
| **daily_aggregates** | View: anyone; Insert/Update: via `refresh_daily_aggregates()` only | Read-only |
| **user_roles** | View own: user; Manage all: admin | `has_role()` function |

## Testing

See `src/lib/virality/test-queries.sql` for comprehensive E2E testing queries.

### Quick Test Flow

1. **Seed test data**:
   ```sql
   -- Campaign, EoA, Deck, Placement (already inserted via INSERT statements)
   ```

2. **Mint L00**:
   ```typescript
   const l00 = await mintL00({ ... });
   ```

3. **Log events**:
   ```typescript
   await logEvent({ token: l00.token, eventType: "scan", ... });
   await logEvent({ token: l00.token, eventType: "view", ... });
   ```

4. **Mint shares**:
   ```typescript
   const l01 = await mintShare({ parentToken: l00.token, utmMedium: "sms" });
   const l02 = await mintShare({ parentToken: l01.token, utmMedium: "em" });
   ```

5. **Check aggregates**:
   ```sql
   SELECT refresh_daily_aggregates();
   SELECT * FROM daily_aggregates WHERE campaign_id = '...';
   ```

## Edge Cases

- ✅ **Level cap**: Attempting L04 raises "Maximum share level (L03) reached"
- ✅ **Unknown token**: Invalid parent token raises "Parent token not found"
- ✅ **Direct insert**: Direct `INSERT INTO url_events` blocked by RLS
- ✅ **Permission check**: Non-admin/manager cannot mint L00

## Canonical Term Map

| Democracy Forge | Database Table | Field/Column |
|-----------------|----------------|--------------|
| Campaign | `campaigns` | `code`, `title`, `description` |
| EventAction (EoA) | `events_actions` | `utm_id`, `type` |
| Deck | `decks` | `slug` |
| DeckVersion | `deck_versions` | `deck_slug`, `version` |
| Placement | `placements` | `code`, `name`, `context` |
| Token | `tokens` | `token`, `level`, `parent_token`, `root_token` |
| UrlEvent | `url_events` | `event_type`, `utm_snapshot` |
| DailyAggregate | `daily_aggregates` | `scans`, `views`, `shares` |
| UserRole | `user_roles` | `role` (enum: admin/manager/viewer) |

## Future Enhancements

- [ ] Scheduled cron job for `refresh_daily_aggregates()`
- [ ] Real-time dashboards for campaign managers
- [ ] Export functionality for analytics
- [ ] Geolocation tracking for events
- [ ] A/B testing support for placements
