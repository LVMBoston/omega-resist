# Share Flow Visualization Feature Specification

## Status: Approved & Implemented (Border Model) — 2026-03-17

## Overview

This document describes how the Samizdat Map visualizes share engagement state using a **3-state border color model** on existing markers. Geographic spread is shown organically through the appearance of new markers at recipient locations — no connecting arcs are drawn.

## Terminology

| Term                 | Definition                                                        | Data Source                                         |
| -------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| **Opened**           | User scans a QR code, creating an L00 instance and logging a view | `url_events.event_type = 'view'` for L00 instance   |
| **Share Intent**     | User taps share button, minting a child token                     | `tokens` row with `parent_token` pointing to sharer |
| **Share Completion** | Recipient opens the shared link                                   | `url_events.event_type = 'view'` for L01+ token     |
| **Share Chain**      | Parent token → child token relationship                           | `tokens.parent_token` linkage                       |

## Corrected Lifecycle

There is no "seeded but unopened" state. A QR code does not exist on the map until someone scans it.

```
1. QR Scan (L00 view event)
   → Green circle appears at scanner's location
   → White border (opened, no share attempted)
   → Unique L00 instance created (e.g., "l00-908742-nkd25:abcdef")

2. Scanner taps Share button (mint_share called)
   → L01 child token created with parent_token = scanner's instance
   → Scanner's marker border changes: white → amber
   → Note: The share may be abandoned (user closes SMS/email without sending)

3. Recipient opens shared link (L01 view event)
   → New marker appears at recipient's location (L01, different color)
   → Scanner's marker border changes: amber → green (share completed)
```

## 3-State Border Color Model

All marker shapes (circle/QR, square/email, triangle/SMS) use the same border state logic:

| State         | Border Color         | Trigger                                         | Meaning                                    |
| ------------- | -------------------- | ----------------------------------------------- | ------------------------------------------ |
| **Opened**    | White (`#ffffff`)    | L00 instance exists with a `view` event         | Person scanned/opened, hasn't shared       |
| **Intent**    | Amber (`#f59e0b`)   | Child token exists (`parent_token` → this token) | Share button tapped; may or may not be sent |
| **Completed** | Green (`#22c55e`)   | Child token has a `view` event in `url_events`  | Recipient opened the shared link           |

### Key Design Decisions

1. **No arcs.** Geographic spread is visible through the organic appearance of child markers at recipient locations. Arcs were rejected as too cluttered.

2. **Shape = channel, border = engagement.** The marker shape (circle, square, triangle) communicates *how* the content arrived. The border color communicates *what happened next*.

3. **Intent includes abandoned shares.** When `mint_share()` fires on button tap, the child token is created before the user confirms sending. Some amber borders represent shares that were never actually sent. This ambiguity is acceptable — willingness to share is itself a meaningful signal.

4. **Applies to all levels.** While the primary use case is L00 instances, the border model applies to any token that could spawn children (L00, L01, L02). L03 tokens cannot spawn children (level cap) so they always have white borders.

## Data Requirements

### Engagement State Query

To determine border state for each marker, the map needs:

```sql
-- For each displayed token, determine engagement state
-- 1. Check if any child token exists (intent)
-- 2. Check if that child has a view event (completed)

SELECT
  parent.token AS parent_token,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM url_events ve
      WHERE ve.token = child.token AND ve.event_type = 'view'
    ) THEN 'completed'
    WHEN child.token IS NOT NULL THEN 'intent'
    ELSE 'none'
  END AS engagement_state
FROM tokens parent
LEFT JOIN tokens child ON child.parent_token = parent.token
WHERE parent.token = ANY($displayed_tokens);
```

This can be integrated into the existing `fetchEventData()` call in SamizdatMap.

### Implementation in `getShapeSVG()`

Replace the current `hasSpawns: boolean` parameter with a 3-state enum:

```typescript
type EngagementState = "none" | "intent" | "completed";

const ENGAGEMENT_BORDER_COLORS: Record<EngagementState, string> = {
  none: "#ffffff",      // white — opened, no share
  intent: "#f59e0b",    // amber — share button tapped
  completed: "#22c55e", // green — recipient opened
};

const getShapeSVG = (
  shape: EoaShape,
  fillColor: string,
  size: number = 14,
  engagementState: EngagementState = "none"
): string => {
  const strokeColor = ENGAGEMENT_BORDER_COLORS[engagementState];
  // ... rest of shape rendering
};
```

## Edge Cases

### Abandoned Shares (Intent Without Completion)

User taps share, `mint_share()` fires, but they close the SMS/email app without sending.

**Handling:** Marker stays amber indefinitely. This is by design — we cannot distinguish abandoned from pending.

### Multiple Share Attempts

User taps share multiple times (e.g., SMS to one person, then email to another).

**Handling:** Any child token triggers amber. Any child with a view triggers green. The "highest" engagement state wins.

### Completion Without Intent Location

The child token's view event has geolocation but the parent's share moment doesn't.

**Handling:** The parent marker still transitions to green. The recipient's marker appears at their location independently.

### Same Location (Local Share)

Origin and destination in same ZIP code.

**Handling:** Both markers appear at the same location with jitter (existing SamizdatMap behavior).

## Metrics

### Conversion Rate

```
Conversion = Completed shares / Share intents
           = (child tokens with view events) / (child tokens that exist)
```

This metric can be added to the Viewport Activity Report.

## Implementation Checklist

- [ ] Add `engagementState` field to `EventPoint` interface
- [ ] Query child token existence + view events in `fetchEventData()`
- [ ] Replace `hasSpawns: boolean` with `engagementState` in `getShapeSVG()`
- [ ] Update legend to show border color meanings
- [ ] Update tooltip to show engagement state
- [ ] Add conversion rate to Viewport Activity Report (future)

## Dependencies

- Existing: Leaflet map, marker shapes, `tokens.parent_token`, `url_events`
- No new libraries required (D3.js/SVG overlay no longer needed)

---

_Document created: December 16, 2024_
_Status: Specification — Arc model_

## Update — 2026-03-17

Replaced the arc-based visualization model with a 3-state border color model (white → amber → green) on existing markers. Removed all arc rendering modes (static, animated, heatmap), Bezier curve calculations, D3.js dependency, and simulator animation controls. The corrected lifecycle eliminates the false "seeded" state — markers only appear upon QR scan (which is inherently an open/view event).
