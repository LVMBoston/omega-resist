# Omega Platform — Feature Catalog

**Last Updated**: March 17, 2026  
**Purpose**: Comprehensive background reference covering all platform capabilities, intended for partners, prospective organizer teams, and technical collaborators.

---

## What Omega Does

Omega is a viral content distribution and analytics platform built for political campaigns and civic organizations. It solves a fundamental problem: when an organizer hands a flyer to a supporter who photographs it and texts it to a friend, that second hop — and every hop after it — is invisible. Omega makes the entire chain visible, measurable, and attributable.

The platform tracks content as it spreads person-to-person through up to four generations (L00 → L03), across QR codes, SMS, and email. Every share creates a new trackable token. Every open is logged with time, location, and attribution. The result is a real-time picture of how a message moves through a community — who carried it, how far it traveled, and where it landed.

---

## Table of Contents

1. [Content Management](#1-content-management)
2. [Distribution & Viral Tracking](#2-distribution--viral-tracking)
3. [Campaign Orchestration](#3-campaign-orchestration)
4. [Map Visualization](#4-map-visualization)
5. [Analytics & Reporting](#5-analytics--reporting)
6. [Stakeholder Sharing](#6-stakeholder-sharing)
7. [Server-Side Rendering](#7-server-side-rendering)
8. [Messaging System](#8-messaging-system)
9. [Administration](#9-administration)
10. [Security & Privacy](#10-security--privacy)
11. [Public-Facing Routes](#11-public-facing-routes)

---

## 1. Content Management

### Deck System

Decks are ordered sequences of slides that form a shareable web presentation. Each deck has a unique slug (e.g., `falmouth-preview`) and is viewable at a public URL without authentication.

| Capability | Description |
|------------|-------------|
| **Create decks** | Name a new deck and add slides via upload or import |
| **Import Google Slides** | Paste a Google Slides URL; each slide is extracted as an image |
| **Import PowerPoint/ZIP** | Upload `.pptx` or `.zip` archives of slide images |
| **Reorder slides** | Drag-and-drop slide arrangement |
| **Deck versioning** | Each deployment creates a version snapshot with optional notes |
| **Skip-deploy toggle** | Mark individual slides to exclude from the deployed version |
| **Bulk slide selection** | Select multiple slides for batch operations |

### Interactive Slide Templates

Any slide can become interactive. The unified slide architecture auto-classifies slides based on their hotspot content:

| Template Type | Hotspot Content | Use Case |
|---------------|----------------|----------|
| `interactive_share` | Action hotspots only (SMS, email, link) | "Spread the word" call-to-action slides |
| `stats_page` | Data hotspots only (live numbers, charts, maps) | Live campaign dashboard slides |
| `hybrid` | Both action and data hotspots | Combined stats + share slides |
| `display_only` | Static display hotspots (text, images) | Informational overlays |

**Auto-promote / auto-demote**: Adding hotspots to a plain image slide automatically promotes it to `spread-word` type. Removing all hotspots demotes it back to `image`. No manual type switching required.

### Hotspot Types

Hotspots are interactive regions placed on slide images via a visual drag-and-drop editor:

| Hotspot Type | What It Does |
|-------------|-------------|
| **SMS** | Opens the device's SMS app with a pre-filled message containing a trackable share link |
| **Email** | Opens the email client with pre-filled subject and body containing a trackable share link |
| **Social / Link copy** | Copies a trackable share link to clipboard |
| **External link** | Opens an arbitrary URL (with configurable label) |
| **Email links** | Displays a clickable email address |
| **App download** | Links to an app store listing |
| **Vimeo** | Embeds an inline Vimeo video player with mute toggle and swipe passthrough |
| **Live number** | Displays a real-time campaign metric (scans, shares, viral coefficient, etc.) |
| **Chart** | Renders a stacked bar chart from live campaign data |
| **Map** | Renders a Leaflet map showing campaign geographic activity |
| **Text** | Static text overlay |

### Vimeo Slide Type

Full slides can also be dedicated Vimeo players (distinct from Vimeo hotspots within interactive slides). These display a poster image with a play button; tapping starts inline playback with sound toggle. Navigation away pauses the video.

---

## 2. Distribution & Viral Tracking

### Token Hierarchy

Every piece of content interaction is tracked via tokens — unique identifiers that form a parent-child chain:

```
Organization distributes via QR / Email / SMS
    └─ L00 (root token) — one per distribution point
         └─ L00 Instance — one per physical scan/open
              └─ L01 (first share) — person shares via SMS/email
                   └─ L02 (second-gen share)
                        └─ L03 (third-gen share — cap)
```

**Key behaviors**:
- **L00 instantiation**: Base L00 tokens are templates. Each physical scan or email open creates a unique instance (`l00-{code}:{6-char-suffix}`), enabling per-person tracking from a single QR code.
- **Re-instantiation logic**: For Event-type EoAs (rallies, canvasses), every scan creates a new instance. For Action-type EoAs (ongoing), re-instantiation only occurs on zip code change (deduplication).
- **Level cap**: Chains stop at L03 to prevent infinite propagation.
- **Full UTM tracking**: Every token carries `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_id` for complete attribution.

### Multi-Channel L00 Distribution

L00 tokens are not limited to QR codes. Organizations can distribute the same content through three channels, and the marker on the map reflects the channel used:

| Channel | Trigger | Marker Shape |
|---------|---------|-------------|
| QR code scan | Physical poster, flyer, or display | ● Circle |
| Email blast | Organization sends link via email | ◻ Square |
| SMS blast | Organization sends link via text | △ Triangle |

All three produce L00-level tokens. The channel is recorded in `utm_medium` and visualized through marker shape on the map.

### Event Logging

Every interaction generates an event record with:
- Token identity and chain position
- Timestamp
- IP-based geolocation (city, region, country, zip code, lat/lon)
- User agent
- UTM parameter snapshot
- Location source (GPS, IP, or unknown)

Events are logged via a `SECURITY DEFINER` database function that bypasses row-level security for append-only writes, ensuring public deck viewers can log events without authentication.

### Geolocation Pipeline

1. **GPS** (browser Geolocation API) — most accurate but often denied on mobile
2. **IP fallback** (via `geoip` edge function using ipapi) — resolves to approximate lat/lon
3. **Reverse geocode** — maps lat/lon to nearest US zip code via `zip_codes` table (42K+ entries)

Known limitation: Mobile carrier IPs can resolve to the carrier's regional hub rather than the user's physical location.

---

## 3. Campaign Orchestration

### Campaign Hierarchy

```
Campaign (e.g., "ICE OUT FOR GOOD V2")
  ├── Chapter (group of EoAs sharing a mobilize_code)
  │     ├── EoA: "Falmouth Rally" (Event)
  │     ├── EoA: "Sandwich Canvass" (Event)
  │     └── EoA: "Cape Cod Online Push" (Action)
  └── Chapter (different mobilize_code)
        └── EoA: "Boston Phone Bank" (Action)
```

### Events & Actions (EoAs)

EoAs are the distribution points within a campaign. Each has:
- Title, type (Event or Action), location (city, state, zip), timezone
- A unique `utm_id` for attribution
- An optional `mobilize_code` linking to the Mobilize platform
- An assigned deck for content distribution
- Start/end dates

| Capability | Description |
|------------|-------------|
| **Manual EoA creation** | Full form with location, dates, and UTM configuration |
| **Mobilize import** | Fetch event details from Mobilize API by event ID |
| **Bulk operations** | Multi-select EoAs for batch deck assignment, deletion, etc. |
| **QR code generation** | Mint L00 tokens and generate QR codes per EoA |
| **Configurable QR defaults** | Organization-wide QR styling defaults |
| **Deck assignment** | Link any deck to any EoA |
| **Campaign cloning** | Duplicate a campaign with all its EoAs |
| **Drag-and-drop ordering** | Reorder campaigns and EoAs visually |

---

## 4. Map Visualization

### Samizdat Map

The primary visualization tool is a Leaflet-based interactive map that shows how content spreads geographically. Each marker encodes three independent dimensions of information:

| Dimension | Encoding | Values |
|-----------|----------|--------|
| **Shape** | Distribution channel | ● Circle = QR scan, ◻ Square = Email, △ Triangle = SMS |
| **Fill color** | Viral level | ⬛ Dark (#1e293b) = L00, 🟢 Green (#22c55e) = L01, 🟣 Purple (#a855f7) = L02, 🔴 Red (#ef4444) = L03 |
| **Border color** | Engagement state | White (#ffffff) = Opened, Amber (#f59e0b) = Share intent, Cyan (#06b6d4) = Share completed |

### Engagement State Lifecycle

1. **Opened** (white border): A person opens a link — marker appears at their location
2. **Share intent** (amber border): Person taps the Share button — a child token is minted. Note: the share may be abandoned (user closes SMS/email without sending). Intent is itself a meaningful signal.
3. **Share completed** (cyan border): The recipient opens the shared link — confirming the share was actually delivered and acted upon.

These states are derived retroactively from existing database relationships. No schema changes were needed — the system queries `tokens.parent_token` linkages and `url_events` view records.

### Map Features

| Feature | Description |
|---------|-------------|
| **Marker clustering** | Automatic grouping at zoom-out levels (via leaflet.markercluster) |
| **Timeline scrubber** | Filter markers by time range; watch the map populate chronologically |
| **Chain mode** | Select a single L00 instance and trace its entire share chain |
| **Viewport activity report** | Summary statistics for markers currently visible on screen |
| **Share medium filter** | Show only QR, SMS, or Email markers |
| **Fullscreen mode** | Expand map to full viewport |
| **Event story panel** | Sidebar narrative for a selected event |
| **ZIP code overlays** | Aggregate counts per zip code with tooltips |
| **Jitter for co-located markers** | Prevents markers at the same location from stacking invisibly |

### Design Constraint

All visual states are static — no animations or pulsing indicators. This ensures compatibility with server-side snapshot rendering (Mapbox Static Images API captures a single frame).

---

## 5. Analytics & Reporting

### Dashboards

| Dashboard | What It Shows | Access |
|-----------|---------------|--------|
| **Campaign Dashboard** | Events table, interactive map, virality tab, campaign narrative | Authenticated |
| **Campaign Analytics** | Cross-campaign funnel charts, viral coefficient trends | Authenticated |
| **Virality Dashboard** | Engagement by level, content performance tables | Authenticated |
| **Activity Monitor** | Real-time event stream with live map | Authenticated |

### Key Metrics

| Metric | Definition |
|--------|-----------|
| **Viral Coefficient** | Average L01+ shares per L00 token |
| **Chain Depth** | Maximum share level reached in a campaign |
| **Geographic Reach** | Unique zip codes reached |
| **Scan-to-Share Conversion** | % of scans that result in shares |
| **Level Distribution** | Breakdown of tokens by L00/L01/L02/L03 |
| **Share Medium Mix** | Distribution across QR, SMS, Email channels |

### Campaign Narrative

An AI-generated text summary of campaign performance, including:
- Duration and activity timeline
- Share medium breakdown
- Geographic origin and destination
- Propagation speed highlights
- Available as both a compact headline (for slide snapshots) and full story (for dashboard display)

### Data Export

- **PDF report** via `generate-campaign-pdf` edge function
- **CSV export** of campaign data
- **Shareable dashboard links** for external stakeholders

### Filtering

All dashboards support filtering by:
- Campaign
- Event type (scan, view, share)
- Data source (live vs. simulated)
- Token level (L00-L03)
- Date range
- Geography (city, state, zip)
- Share medium (QR, SMS, Email)

---

## 6. Stakeholder Sharing

### Shareable Dashboards

Generate time-limited public links for external stakeholders (donors, partners, board members):

| Feature | Description |
|---------|-------------|
| **Share code generation** | Unique codes for each shared dashboard |
| **Configurable expiration** | Set how long the link remains active |
| **View tracking** | Count how many times the link has been accessed |
| **Deactivation** | Revoke access at any time |
| **Public map + analytics** | No authentication required for viewers |

Route: `/shared/:shareCode`

---

## 7. Server-Side Rendering

### Snapshot System

Stats-page slides display live campaign data (numbers, charts, maps). To ensure these render correctly in all contexts — including email previews, social share cards, and low-powered devices — the platform renders snapshots server-side:

| Component | Description |
|-----------|-------------|
| **`render-stats-snapshot`** | Edge function that generates an SVG with embedded metrics, converts to PNG |
| **`refresh-all-snapshots`** | Batch re-renders snapshots for all enabled campaigns |
| **`deploy-template-snapshots`** | Renders snapshots for specific templates on deployment |
| **Per-campaign scheduling** | Campaigns can enable periodic snapshot refresh with configurable intervals |
| **Snapshot storage** | PNGs stored in the `slide-snapshots` bucket |

---

## 8. Messaging System

### Template Resolution

When a share hotspot fires (SMS or email), the message content is resolved through a cascading template system:

```
1. Chapter-level override (specific to a mobilize_code within a campaign)
   ↓ fallback
2. Campaign-level override (applies to all EoAs in the campaign)
   ↓ fallback
3. Global default (from settings table)
```

This allows organizations to customize share messages per event chapter while maintaining campaign-wide defaults.

| Feature | Description |
|---------|-------------|
| **Campaign message overrides** | Per-campaign SMS/email templates |
| **Chapter-scoped overrides** | Per-chapter templates that override campaign defaults |
| **Global defaults** | System-wide fallback templates |
| **Template variables** | Dynamic insertion of share URLs, campaign names, etc. |

---

## 9. Administration

### Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Full access: campaigns, users, settings, all analytics |
| **Manager** | Mint L00 tokens, view analytics, manage assigned EoAs |
| **Viewer** | Read-only analytics and dashboard access |

### Tools

| Tool | Purpose |
|------|---------|
| **Simulator** | Generate synthetic token/event data for testing and demos |
| **QR Debug Tool** | Inspect token chain and metadata for any QR code |
| **Repoint QR Tool** | Change the destination of an existing QR code |
| **Zip Code Importer** | Bulk import zip code reference data |
| **Edge Function Health** | Monitor edge function availability |
| **Settings** | Global app configuration (messaging templates, QR defaults) |
| **User management** | Assign roles (admin/manager/viewer) to users |

---

## 10. Security & Privacy

### Data Protection

| Measure | Description |
|---------|-------------|
| **Row-Level Security (RLS)** | Every table has RLS policies controlling read/write by role |
| **SECURITY DEFINER functions** | Event logging runs with elevated permissions for append-only writes |
| **IP auto-clearing** | IP addresses are deleted from `url_events` once zip code is populated |
| **Time-limited share links** | External dashboard access expires automatically |
| **No anonymous signups** | Authentication requires email verification |

### Public vs. Protected Routes

All campaign management, analytics, and admin pages require authentication. The following routes are public by design:

- **Deck viewer** (`/deck/:slug`) — the shareable content itself
- **Short URL redirects** (`/r/:code`, `/s/:code`) — link resolution
- **Shared dashboards** (`/shared/:shareCode`) — stakeholder views
- **Landing page** (`/landing`) — platform information

---

## 11. Public-Facing Routes

| Route | Purpose | Auth Required |
|-------|---------|--------------|
| `/deck/:slug` | View a slide deck | No |
| `/r/:code` | Short URL redirect + event logging | No |
| `/s/:code` | Short URL redirect (alias) | No |
| `/shared/:shareCode` | Shareable dashboard | No |
| `/landing` | Platform landing page | No |
| `/template-editor/:id` | Template editor | No |

---

## Technical Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| UI | shadcn/ui, Tailwind CSS |
| State | TanStack Query, React Router v6 |
| Maps | Leaflet + leaflet.markercluster |
| Charts | Recharts |
| Video | @vimeo/player |
| Backend | Lovable Cloud (PostgreSQL + Auth + Edge Functions + Storage) |
| QR | qrcode.react |
| PDF | jspdf, html2canvas |
| Drag & Drop | @dnd-kit |

---

*This document is a living reference. For implementation details, see `docs/PRD.md`. For AI context, see `docs/CLAUDE_CONTEXT.md`. For individual feature decisions, see `docs/decisions/`.*
