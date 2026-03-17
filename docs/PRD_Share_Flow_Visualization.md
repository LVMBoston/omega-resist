# Share Flow Visualization Feature Specification

## Status: Approved & Implemented (Border Model) — 2026-03-17

## Overview

This document describes how the Samizdat Map visualizes share engagement state using a **3-state border color model** on existing markers. Geographic spread is shown organically through the appearance of new markers at recipient locations — no connecting arcs are drawn.

## Terminology

| Term                 | Definition                                                        | Data Source                                         |
| -------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| **Opened**           | User opens a link (QR scan, email blast, SMS blast)               | `url_events.event_type = 'view'` for L00 instance   |
| **Share Intent**     | User taps share button, minting a child token                     | `tokens` row with `parent_token` pointing to sharer |
| **Share Completion** | Recipient opens the shared link                                   | `url_events.event_type = 'view'` for L01+ token     |
| **Share Chain**      | Parent token → child token relationship                           | `tokens.parent_token` linkage                       |

## Corrected Lifecycle

There is no "seeded but unopened" state. A marker does not exist on the map until someone opens the link (via QR scan, email, or SMS).

```
1. Person opens link (L00 view event)
   → Marker appears at person's location
   → Shape determined by channel: ● circle (QR), ◻ square (email), △ triangle (SMS)
   → Dark fill (#1e293b), white border (opened, no share attempted)
   → Unique L00 instance created (e.g., "l00-908742-nkd25:abcdef")

2. Person taps Share button (mint_share called)
   → L01 child token created with parent_token = person's instance
   → Person's marker border changes: white → amber
   → Note: The share may be abandoned (user closes SMS/email without sending)

3. Recipient opens shared link (L01 view event)
   → New marker appears at recipient's location (L01 green fill)
   → Person's marker border changes: amber → cyan (share completed)
```

## Multi-Channel L00 Distribution

L00 tokens can originate from any distribution channel. The marker **shape** indicates the channel; the **level** (fill color) indicates how many hops from the organization.

| Distribution Method | Who Initiates | Recipient Level | Marker Shape | Fill Color |
| ------------------- | ------------- | --------------- | ------------ | ---------- |
| QR poster scanned   | Organization  | L00             | ● Circle     | ⬛ Dark    |
| Email blast opened  | Organization  | L00             | ◻ Square     | ⬛ Dark    |
| SMS blast opened    | Organization  | L00             | △ Triangle   | ⬛ Dark    |
| Person shares via SMS   | L00 recipient | L01         | △ Triangle   | 🟢 Green   |
| Person shares via Email | L00 recipient | L01         | ◻ Square     | 🟢 Green   |

## Color Palette (Contrast-Verified)

### Level Fill Colors

| Level  | Color           | Hex       | Rationale                            |
| ------ | --------------- | --------- | ------------------------------------ |
| **L00** | Dark (slate-800) | `#1e293b` | Organization origin; max border contrast |
| **L01** | Green           | `#22c55e` | First viral hop                      |
| **L02** | Purple          | `#a855f7` | Second viral hop                     |
| **L03** | Red             | `#ef4444` | Third viral hop (level cap)          |

### Engagement Border Colors

| State         | Color           | Hex       | Meaning                              |
| ------------- | --------------- | --------- | ------------------------------------ |
| **Opened**    | White           | `#ffffff` | Opened, no share attempted           |
| **Intent**    | Amber           | `#f59e0b` | Share button tapped (may be abandoned) |
| **Completed** | Cyan            | `#06b6d4` | Recipient opened the shared link     |

### Full Contrast Matrix

All 10 meaningful permutations verified for contrast at 16px marker size:

| Level | Fill `→` | Border: White `#ffffff` | Border: Amber `#f59e0b` | Border: Cyan `#06b6d4` |
| ----- | -------- | ----------------------- | ----------------------- | ---------------------- |
| **L00** | ⬛ `#1e293b` | ✅ Excellent | ✅ Excellent | ✅ Excellent |
| **L01** | 🟢 `#22c55e` | ✅ High      | ✅ Good      | ✅ Good      |
| **L02** | 🟣 `#a855f7` | ✅ High      | ✅ Excellent | ✅ Good      |
| **L03** | 🔴 `#ef4444` | ✅ High      | _(n/a — can't share)_ | _(n/a — can't share)_ |

L03 tokens cannot spawn children (level cap) so they always have white borders.

## Full Lifecycle Example: Email Blast → SMS → Email → SMS

| Step | Action | Who | Shape | Fill Color | Border | Notes |
| ---- | ------ | --- | ----- | ---------- | ------ | ----- |
| 1 | Person A opens email blast link | A | ◻ Square | ⬛ Dark (L00) | White | Email channel, first contact |
| 2 | Person A taps "Share via SMS" | A | ◻ Square | ⬛ Dark (L00) | **Amber** | Intent — L01 child minted |
| 3 | Person B opens SMS link | B | △ Triangle | 🟢 Green (L01) | White | New marker at B's location |
| 3b | _(A's marker updates)_ | A | ◻ Square | ⬛ Dark (L00) | **Cyan** | Share completed |
| 4 | Person B taps "Share via Email" | B | △ Triangle | 🟢 Green (L01) | **Amber** | Intent — L02 child minted |
| 5 | Person C opens email link | C | ◻ Square | 🟣 Purple (L02) | White | New marker at C's location |
| 5b | _(B's marker updates)_ | B | △ Triangle | 🟢 Green (L01) | **Cyan** | Share completed |
| 6 | Person C taps "Share via SMS" | C | ◻ Square | 🟣 Purple (L02) | **Amber** | Intent — L03 child minted |
| 7 | Person D opens SMS link | D | △ Triangle | 🔴 Red (L03) | White | New marker at D's location |
| 7b | _(C's marker updates)_ | C | ◻ Square | 🟣 Purple (L02) | **Cyan** | Share completed |
| — | Person D **cannot share** | D | △ Triangle | 🔴 Red (L03) | White | L03 cap — border stays white forever |

### Visual Key

| Dimension | What it tells you | Values |
| --------- | ----------------- | ------ |
| **Shape** | Channel (how it arrived) | ● Circle = QR, ◻ Square = Email, △ Triangle = SMS |
| **Fill color** | Level (hops from org) | ⬛ Dark = L00, 🟢 Green = L01, 🟣 Purple = L02, 🔴 Red = L03 |
| **Border color** | Engagement state | White = opened, Amber = intent, Cyan = completed |

## 3-State Border Color Model

All marker shapes (circle/QR, square/email, triangle/SMS) use the same border state logic.

### Key Design Decisions

1. **No arcs.** Geographic spread is visible through the organic appearance of child markers at recipient locations. Arcs were rejected as too cluttered.

2. **Shape = channel, border = engagement.** The marker shape (circle, square, triangle) communicates *how* the content arrived. The border color communicates *what happened next*.

3. **Intent includes abandoned shares.** When `mint_share()` fires on button tap, the child token is created before the user confirms sending. Some amber borders represent shares that were never actually sent. This ambiguity is acceptable — willingness to share is itself a meaningful signal.

4. **Applies to all levels.** The border model applies to any token that could spawn children (L00, L01, L02). L03 tokens cannot spawn children (level cap) so they always have white borders.

5. **No animation.** Pulsing or animated indicators are incompatible with server-side snapshot rendering (Mapbox Static Images API captures a single frame). All visual states must be static.

6. **Contrast-verified palette.** Fill and border colors were chosen to ensure all 10 meaningful permutations have strong visual contrast at 16px marker size.

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
      JOIN tokens child ON child.parent_token = parent.token
      WHERE ve.token = child.token AND ve.event_type = 'view'
    ) THEN 'completed'
    WHEN EXISTS (
      SELECT 1 FROM tokens child
      WHERE child.parent_token = parent.token
    ) THEN 'intent'
    ELSE 'none'
  END AS engagement_state
FROM tokens parent
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
  completed: "#06b6d4", // cyan — recipient opened
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

**Handling:** Any child token triggers amber. Any child with a view triggers cyan. The "highest" engagement state wins.

### Completion Without Intent Location

The child token's view event has geolocation but the parent's share moment doesn't.

**Handling:** The parent marker still transitions to cyan. The recipient's marker appears at their location independently.

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

- [x] Update `LEVEL_COLORS` in SamizdatMap.tsx (L00 → `#1e293b`, L02 → `#a855f7`)
- [x] Add `engagementState` field to `EventPoint` interface
- [x] Query child token existence + view events in `fetchEventData()`
- [x] Replace `hasSpawns: boolean` with `engagementState` in `getShapeSVG()`
- [x] Update border colors: white/amber/cyan
- [x] Update legend to show border color meanings
- [x] Update tooltip to show engagement state
- [ ] Add conversion rate to Viewport Activity Report (future)

## Dependencies

- Existing: Leaflet map, marker shapes, `tokens.parent_token`, `url_events`
- No new libraries required (D3.js/SVG overlay no longer needed)

---

_Document created: December 16, 2024_
_Status: Specification — Arc model_

## Update — 2026-03-17

Replaced the arc-based visualization model with a 3-state border color model on existing markers. Removed all arc rendering modes (static, animated, heatmap), Bezier curve calculations, D3.js dependency, and simulator animation controls. The corrected lifecycle eliminates the false "seeded" state — markers only appear upon QR scan/email open/SMS open.

Updated color palette after contrast analysis:
- L00 fill changed from blue (`#3b82f6`) to dark (`#1e293b`) for maximum border contrast
- L02 fill changed from orange (`#f97316`) to purple (`#a855f7`) to avoid amber border conflict
- "Completed" border changed from green (`#22c55e`) to cyan (`#06b6d4`) to avoid L01 green fill conflict
- All 10 meaningful fill+border permutations verified for contrast at 16px marker size
