# Share Flow Visualization Feature Specification

## Overview

This document describes a map visualization feature that displays the geographic relationship between **share intents** (when a user clicks share) and **share completions** (when a recipient opens the shared link). The feature renders visual arcs connecting origin and destination locations, showing how content spreads virally across geography.

## Terminology

| Term | Definition | Data Source |
|------|------------|-------------|
| **Share Intent** | User clicks share button, opening SMS/email composer | `url_events.event_type = 'share'` |
| **Share Completion** | Recipient opens the shared link | `url_events.event_type = 'view'` for L01+ tokens |
| **Origin Location** | Geographic location where share intent occurred | Geolocation of the `share` event |
| **Destination Location** | Geographic location where share was opened | Geolocation of the L01+ `view` event |
| **Share Chain** | Parent token → child token relationship | `tokens.parent_token` linkage |

## Data Model

### Linking Share Intent to Completion

```
L00 Token (root)
    ↓ user clicks share
Share Event logged (intent) → L01 Token minted (parent_token = L00)
    ↓ recipient opens link
View Event logged for L01 (completion)
```

**Key relationships:**
- `tokens.parent_token` links child to parent
- `url_events.token` links events to tokens
- Share intent location: geolocation from `share` event
- Completion location: geolocation from `view` event for L01+ token

### Query Pattern

```sql
-- Get share intent → completion pairs with locations
SELECT 
  intent.id as intent_event_id,
  intent.latitude as origin_lat,
  intent.longitude as origin_lng,
  intent.zip_code as origin_zip,
  intent.occurred_at as intent_time,
  completion.id as completion_event_id,
  completion.latitude as dest_lat,
  completion.longitude as dest_lng,
  completion.zip_code as dest_zip,
  completion.occurred_at as completion_time,
  child_token.token as child_token,
  child_token.parent_token,
  child_token.level
FROM url_events intent
JOIN tokens child_token ON intent.token = child_token.parent_token
JOIN url_events completion ON completion.token = child_token.token
WHERE intent.event_type = 'share'
  AND completion.event_type = 'view'
  AND child_token.level > 0
  AND intent.latitude IS NOT NULL
  AND completion.latitude IS NOT NULL;
```

## Feature Modes

### Mode 1: Static Arcs (Production - Samizdat Map)

**Use case:** Real data visualization on campaign dashboard

**Behavior:**
- Curved arcs drawn from share intent location to completion location(s)
- Arc color matches EoA color coding (consistent with existing point markers)
- Arcs are static (not animated)
- Hover interaction highlights specific share chain
- Click on arc shows popup with share details

**Visual Design:**
- Arc curvature: Bezier curve with apex proportional to distance
- Arc opacity: 0.6 base, 1.0 on hover
- Arc stroke width: 2px base, 3px on hover
- Multiple completions from same intent: multiple arcs radiating from single origin

**Toggle Control:**
- Button: "Show Share Flow" (default: OFF)
- When enabled, arcs overlay existing point markers
- Independent of "Show ZIP counts" toggle

**Performance Constraints:**
- Maximum 500 arcs rendered simultaneously
- Arcs outside viewport are culled
- Consider clustering origins with >5 completions

### Mode 2: Animated Flow (Simulator Only)

**Use case:** Dramatic visualization for demos, internal testing, presentations

**Behavior:**
- Animated particles flow from origin to destination
- Particles follow curved path (same Bezier as static arcs)
- Animation speed proportional to time elapsed (compressed timeline)
- Supports "replay" mode with time controls

**Visual Design:**
- Particle: Small glowing dot (4px radius)
- Particle trail: Fading gradient tail (20px length)
- Particle color: Matches EoA color
- Particle speed: 2-3 second travel time per arc
- Staggered start times based on actual `occurred_at` timestamps

**Time Controls:**
- Play / Pause button
- Speed selector: 1x, 2x, 5x, 10x
- Timeline scrubber showing elapsed time since go-live
- "Jump to" presets: First share, Peak activity, Latest

**Why Simulator Only:**
- Animation is CPU-intensive
- Not suitable for production with large datasets
- Accessibility concerns (motion sensitivity)
- Battery drain on mobile devices
- Simulator has controlled data volume

### Mode 3: Aggregate Heatmap (Future)

**Use case:** High-volume campaigns where individual arcs would be overwhelming

**Behavior:**
- Heatmap overlay showing share completion density
- Separate layer for share intent density
- No individual arcs, just geographic intensity

**Not in initial scope.**

## User Interface

### Samizdat Map Controls (Mode 1)

```
┌─────────────────────────────────────────────┐
│ [Show ZIP counts] [Show Share Flow]         │
│                                             │
│              MAP CANVAS                     │
│                                             │
│   ○ ────────────────────> ●                 │
│   │                       │                 │
│   origin                  destination       │
│                                             │
└─────────────────────────────────────────────┘
```

### Simulator Controls (Mode 2)

```
┌─────────────────────────────────────────────┐
│ ▶ Pause   Speed: [1x ▼]   ━━━━●━━━━━━ 2:34  │
├─────────────────────────────────────────────┤
│                                             │
│              MAP CANVAS                     │
│                                             │
│   ○ ~~particle~~> ●                         │
│                                             │
└─────────────────────────────────────────────┘
```

## Arc Rendering Technical Approach

### Bezier Curve Calculation

```typescript
interface ShareArc {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  intentEventId: string;
  completionEventId: string;
  childToken: string;
  eoaId: string;
  eoaColor: string;
}

function calculateArcPath(arc: ShareArc): string {
  const { origin, destination } = arc;
  
  // Calculate midpoint
  const midLat = (origin.lat + destination.lat) / 2;
  const midLng = (origin.lng + destination.lng) / 2;
  
  // Calculate distance for curvature
  const distance = Math.sqrt(
    Math.pow(destination.lat - origin.lat, 2) + 
    Math.pow(destination.lng - origin.lng, 2)
  );
  
  // Control point offset (perpendicular to line, proportional to distance)
  const curvature = distance * 0.3;
  const angle = Math.atan2(destination.lat - origin.lat, destination.lng - origin.lng);
  const controlLat = midLat + curvature * Math.cos(angle + Math.PI / 2);
  const controlLng = midLng + curvature * Math.sin(angle + Math.PI / 2);
  
  return `M ${origin.lng} ${origin.lat} Q ${controlLng} ${controlLat} ${destination.lng} ${destination.lat}`;
}
```

### Leaflet SVG Overlay

For static arcs on Leaflet (current Samizdat implementation):

```typescript
// Create SVG overlay for arcs
const svgOverlay = L.svg({ interactive: true }).addTo(map);
const svg = d3.select(map.getPanes().overlayPane).select('svg');
const g = svg.append('g').attr('class', 'share-arcs');

// Render arcs
arcs.forEach(arc => {
  const path = g.append('path')
    .attr('d', calculateArcPath(arc))
    .attr('stroke', arc.eoaColor)
    .attr('stroke-width', 2)
    .attr('fill', 'none')
    .attr('opacity', 0.6)
    .on('mouseenter', () => highlightChain(arc))
    .on('mouseleave', () => unhighlightChain(arc));
});
```

## Edge Cases

### Single Share, Multiple Completions

One share intent can result in multiple completions if:
- User added multiple recipients to SMS/email (group message)
- Same link was forwarded by recipient

**Handling:** Render multiple arcs from same origin point, each to different destination.

### Completion Without Intent Location

Share event may lack geolocation data.

**Handling:** Skip arc rendering, but still count in metrics. Consider fallback to token's root location.

### Same Location (Local Share)

Origin and destination in same ZIP code.

**Handling:** Render small circular arc or highlight the point differently.

### Cross-Border Shares

Shares that cross international boundaries.

**Handling:** Arcs work regardless of distance. Consider Great Circle path for very long distances.

## Metrics & Reporting

### Share Flow Statistics (potential addition to Viewport Activity Report)

| Metric | Definition |
|--------|------------|
| Share Intents (Visible) | Share events within current viewport |
| Share Completions (Visible) | L01+ views within current viewport |
| Conversion Rate | Completions / Intents |
| Avg Distance | Average geographic distance of share arcs |
| Furthest Share | Maximum distance single share traveled |

## Implementation Phases

### Phase 1: Static Arcs (MVP)
- [ ] Query share intent → completion pairs
- [ ] Render Bezier arcs on Samizdat map
- [ ] Add "Show Share Flow" toggle
- [ ] Hover interaction for arc highlighting
- [ ] Respect existing EoA and time filters

### Phase 2: Arc Interactions
- [ ] Click popup with share details
- [ ] Highlight full share chain (L00 → L01 → L02 → L03)
- [ ] Filter arcs by channel (SMS vs Email)

### Phase 3: Animated Flow (Simulator)
- [ ] Particle animation system
- [ ] Time-based replay controls
- [ ] Speed adjustment
- [ ] Timeline scrubber

### Phase 4: Analytics Integration
- [ ] Share flow metrics in Viewport Activity Report
- [ ] Export share flow data
- [ ] Share distance histogram

## Dependencies

- Existing: Leaflet map, EoA color coding, time filters, viewport tracking
- New: D3.js or SVG overlay for arc rendering (Leaflet-compatible)

## Open Questions

1. Should arcs be bidirectional if someone shares back to original region?
2. How to handle L02/L03 chains — show full chain or just immediate parent→child?
3. Should arc thickness indicate multiple completions from same intent?
4. Performance threshold: at what point do we switch to aggregate heatmap?

---

*Document created: December 2024*
*Status: Specification — Not Yet Implemented*
