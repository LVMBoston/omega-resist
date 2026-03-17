# Omega Platform — Feature Catalog

**Last Updated**: March 17, 2026  
**Purpose**: Comprehensive background reference covering all platform capabilities, intended for partners, prospective organizer teams, and technical collaborators.

---

## What Omega Does

*Omega exists because peer-to-peer sharing is the most trusted form of political communication — and until now, it has been completely unmeasurable.*

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

*Content is the vehicle for viral distribution. Without a flexible, low-friction way to build and deploy shareable slide decks, organizers can't get material into supporters' hands fast enough to match the pace of a campaign.*

### Deck System

*Decks are the atomic unit of distribution — every QR code, every share link, every email blast points to a deck. The system must make it trivially easy for non-technical organizers to assemble and update decks without developer involvement.*

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

*Static slides inform; interactive slides activate. The ability to embed share buttons, live metrics, and maps directly into slides transforms passive viewers into active distributors — this is the mechanism that turns a single scan into a viral chain.*

Any slide can become interactive. The unified slide architecture auto-classifies slides based on their hotspot content:

| Template Type | Hotspot Content | Use Case |
|---------------|----------------|----------|
| `interactive_share` | Action hotspots only (SMS, email, link) | "Spread the word" call-to-action slides |
| `stats_page` | Data hotspots only (live numbers, charts, maps) | Live campaign dashboard slides |
| `hybrid` | Both action and data hotspots | Combined stats + share slides |
| `display_only` | Static display hotspots (text, images) | Informational overlays |

**Auto-promote / auto-demote**: Adding hotspots to a plain image slide automatically promotes it to `spread-word` type. Removing all hotspots demotes it back to `image`. No manual type switching required.

### Hotspot Types

*Hotspots are the interactive building blocks that make slides actionable. Each type serves a distinct engagement purpose — from triggering trackable shares (the core viral mechanism) to displaying live campaign data that motivates supporters to keep sharing.*

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

*Video is the highest-engagement content format in mobile-first organizing. Dedicated video slides let campaigns embed explainer videos, testimonials, or rally footage directly in the share flow without requiring viewers to leave the deck.*

Full slides can also be dedicated Vimeo players (distinct from Vimeo hotspots within interactive slides). These display a poster image with a play button; tapping starts inline playback with sound toggle. Navigation away pauses the video.

---

## 2. Distribution & Viral Tracking

*This is Omega's core differentiator. No other platform in the political technology space tracks peer-to-peer content sharing with per-person, per-generation, per-location attribution. This section describes the infrastructure that makes invisible sharing visible.*

### Token Hierarchy

*Tokens are the backbone of Omega's attribution model. The parent-child chain structure is what allows the platform to answer questions no other tool can: "Who shared this? How far did it travel? Where did it land?" Without this hierarchy, viral sharing is a black box.*

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

*Campaigns don't distribute content through a single channel — they use QR codes at rallies, email blasts to lists, and SMS to phone banks. Tracking which channel produced which results is essential for allocating field resources and understanding which distribution strategies actually drive viral spread.*

L00 tokens are not limited to QR codes. Organizations can distribute the same content through three channels, and the marker on the map reflects the channel used:

| Channel | Trigger | Marker Shape |
|---------|---------|-------------|
| QR code scan | Physical poster, flyer, or display | ● Circle |
| Email blast | Organization sends link via email | ◻ Square |
| SMS blast | Organization sends link via text | △ Triangle |

All three produce L00-level tokens. The channel is recorded in `utm_medium` and visualized through marker shape on the map.

### Event Logging

*Every event record is a data point in the viral chain. Without comprehensive, append-only event logging, the platform cannot reconstruct the timeline of how content moved through a community — the fundamental question Omega exists to answer.*

Every interaction generates an event record with:
- Token identity and chain position
- Timestamp
- IP-based geolocation (city, region, country, zip code, lat/lon)
- User agent
- UTM parameter snapshot
- Location source (GPS, IP, or unknown)

Events are logged via a `SECURITY DEFINER` database function that bypasses row-level security for append-only writes, ensuring public deck viewers can log events without authentication.

### Geolocation Pipeline

*Geography is the third dimension of viral tracking (alongside time and attribution). Knowing where content lands — down to the zip code — lets campaigns understand whether their message is reaching target districts, crossing geographic boundaries, or staying local. This pipeline resolves location from whatever signal is available.*

1. **GPS** (browser Geolocation API) — most accurate but often denied on mobile
2. **IP fallback** (via `geoip` edge function using ipapi) — resolves to approximate lat/lon
3. **Reverse geocode** — maps lat/lon to nearest US zip code via `zip_codes` table (42K+ entries)

Known limitation: Mobile carrier IPs can resolve to the carrier's regional hub rather than the user's physical location.

---

## 3. Campaign Orchestration

*Campaigns are the organizational backbone that connects content (decks) to distribution points (events and actions) to analytics. Without structured campaign orchestration, organizers would have no way to attribute results to specific field activities or compare performance across events.*

### Campaign Hierarchy

*The three-tier hierarchy (Campaign → Chapter → EoA) mirrors how real-world organizing works: a statewide campaign has regional chapters, each running multiple events. This structure ensures analytics roll up correctly and messaging can be customized at any level.*

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

*EoAs are the point where digital tracking meets physical organizing. Each EoA represents a real-world moment — a rally, a canvass, a phone bank — and its associated QR codes and share links. This is where the viral chain begins.*

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

*The map is Omega's signature output — the visual proof that peer-to-peer sharing works. When a campaign director sees markers spreading across a state in real time, color-coded by viral generation and engagement state, it tells a story that no spreadsheet can. The map is also the primary artifact shared with donors and stakeholders.*

### Samizdat Map

*The three-dimensional encoding system (shape × fill × border) lets viewers decode distribution channel, viral depth, and engagement state at a glance. This density of information in a single marker is what makes the map useful for both real-time monitoring and post-campaign reporting.*

The primary visualization tool is a Leaflet-based interactive map that shows how content spreads geographically. Each marker encodes three independent dimensions of information:

| Dimension | Encoding | Values |
|-----------|----------|--------|
| **Shape** | Distribution channel | ● Circle = QR scan, ◻ Square = Email, △ Triangle = SMS |
| **Fill color** | Viral level | ⬛ Dark (#1e293b) = L00, 🟢 Green (#22c55e) = L01, 🟣 Purple (#a855f7) = L02, 🔴 Red (#ef4444) = L03 |
| **Border color** | Engagement state | White (#ffffff) = Opened, Amber (#f59e0b) = Share intent, Cyan (#06b6d4) = Share completed |

### Engagement State Lifecycle

*Share intent (amber) vs. share completed (cyan) is a critical distinction. A person who taps "Share via SMS" but never sends the message is still a meaningful signal — it indicates willingness to share even if the share didn't complete. This distinction lets campaigns measure both intent and follow-through, revealing where the sharing funnel leaks.*

1. **Opened** (white border): A person opens a link — marker appears at their location
2. **Share intent** (amber border): Person taps the Share button — a child token is minted. Note: the share may be abandoned (user closes SMS/email without sending). Intent is itself a meaningful signal.
3. **Share completed** (cyan border): The recipient opens the shared link — confirming the share was actually delivered and acted upon.

These states are derived retroactively from existing database relationships. No schema changes were needed — the system queries `tokens.parent_token` linkages and `url_events` view records.

### Map Features

*These features transform the map from a static display into an analytical tool. The timeline scrubber reveals propagation speed. Chain mode traces a single share chain end-to-end. The viewport report gives instant statistics for whatever geography the user is examining.*

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

*Snapshot compatibility is a hard requirement because the map must render identically in contexts where JavaScript doesn't run — email previews, social share cards, PDF reports. Animations would break these use cases.*

All visual states are static — no animations or pulsing indicators. This ensures compatibility with server-side snapshot rendering (Mapbox Static Images API captures a single frame).

---

## 5. Analytics & Reporting

*Analytics close the feedback loop. Organizers need to know — in hours, not weeks — whether a canvass produced shares, whether an email blast outperformed QR codes, and whether content reached the target geography. Without real-time analytics, campaigns can't adapt their field strategy mid-cycle.*

### Dashboards

*Each dashboard serves a different decision-maker at a different altitude. The Campaign Dashboard is the daily driver for field directors. Campaign Analytics is the cross-campaign view for strategists. The Activity Monitor is the real-time feed for war rooms on event day.*

| Dashboard | What It Shows | Access |
|-----------|---------------|--------|
| **Campaign Dashboard** | Events table, interactive map, virality tab, campaign narrative | Authenticated |
| **Campaign Analytics** | Cross-campaign funnel charts, viral coefficient trends | Authenticated |
| **Virality Dashboard** | Engagement by level, content performance tables | Authenticated |
| **Activity Monitor** | Real-time event stream with live map | Authenticated |

### Key Metrics

*These metrics are the language campaigns use to evaluate Omega's impact. The viral coefficient is the headline number — it answers "is our content actually spreading?" Everything else provides the context to explain why.*

| Metric | Definition |
|--------|-----------|
| **Viral Coefficient** | Average L01+ shares per L00 token |
| **Chain Depth** | Maximum share level reached in a campaign |
| **Geographic Reach** | Unique zip codes reached |
| **Scan-to-Share Conversion** | % of scans that result in shares |
| **Level Distribution** | Breakdown of tokens by L00/L01/L02/L03 |
| **Share Medium Mix** | Distribution across QR, SMS, Email channels |

### Campaign Narrative

*Numbers tell you what happened; narratives tell you what it means. The AI-generated narrative synthesizes metrics into plain-language summaries that organizers can paste into donor updates, board reports, and press materials without needing to interpret charts themselves.*

An AI-generated text summary of campaign performance, including:
- Duration and activity timeline
- Share medium breakdown
- Geographic origin and destination
- Propagation speed highlights
- Available as both a compact headline (for slide snapshots) and full story (for dashboard display)

### Data Export

*Campaigns operate in ecosystems of tools. Export capabilities ensure Omega's data can flow into grant reports, board presentations, and external analytics platforms without manual re-entry.*

- **PDF report** via `generate-campaign-pdf` edge function
- **CSV export** of campaign data
- **Shareable dashboard links** for external stakeholders

### Filtering

*Filtering is what makes dashboards useful at scale. A statewide campaign with 50 events and thousands of tokens is noise without filters. The ability to slice by campaign, geography, level, medium, and date range turns noise into signal.*

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

*Campaigns depend on donors, partners, and board members who rarely log into internal tools. Shareable dashboards let organizers send a live, interactive view of campaign results to external stakeholders — proving impact without requiring onboarding or credentials.*

### Shareable Dashboards

*Time-limited, revocable links balance transparency with security. Stakeholders get a compelling, self-service view of campaign performance. Organizers retain full control over access duration and can revoke links instantly if circumstances change.*

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

*Interactive slides with live data are powerful on a phone — but useless in an email preview, a social card, or a low-bandwidth environment. Server-side snapshot rendering ensures that every context where a slide might appear shows current, accurate data as a static image.*

### Snapshot System

*The snapshot pipeline is the bridge between dynamic, JavaScript-driven slides and the static image contexts where campaigns need their content to appear. Without it, a "live numbers" slide would show a blank rectangle in every email client and social platform.*

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

*The share message is the moment of conversion — when a supporter decides to forward content to their network. The words in that SMS or email determine whether the recipient opens the link. Giving campaigns granular control over messaging at every level of the hierarchy directly impacts viral spread.*

### Template Resolution

*The cascading override system (Chapter → Campaign → Global) means organizers can customize messaging for a specific rally without touching defaults for the rest of the campaign. This mirrors how real campaigns operate: different events have different audiences and need different framing.*

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

*Omega is a multi-user platform used by organizations with varied roles — from field coordinators minting QR codes to campaign directors reviewing analytics to external viewers checking dashboards. Role-based access ensures each user sees only what they need and can only do what they're authorized to do.*

### Roles

*The three-tier role model maps to real organizational structure: admins configure the platform, managers run field operations, and viewers (often external stakeholders or junior staff) consume reports without risk of accidental changes.*

| Role | Capabilities |
|------|-------------|
| **Admin** | Full access: campaigns, users, settings, all analytics |
| **Manager** | Mint L00 tokens, view analytics, manage assigned EoAs |
| **Viewer** | Read-only analytics and dashboard access |

### Tools

*These diagnostic and administrative tools exist because viral tracking systems are complex and things go wrong. A QR code might point to the wrong deck. Simulated data might need to be generated for a demo. Zip code data might need to be refreshed. These tools let administrators troubleshoot and maintain the platform without developer intervention.*

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

*Omega handles location data, IP addresses, and content distribution patterns for political organizations. The security model must protect this data from unauthorized access while still allowing public-facing features (deck viewing, event logging) to work without authentication. Getting this balance wrong could compromise organizer safety or supporter privacy.*

### Data Protection

*These measures implement defense-in-depth: RLS prevents unauthorized reads, SECURITY DEFINER functions allow controlled writes, IP auto-clearing minimizes retained PII, and time-limited share links ensure external access is always temporary and revocable.*

| Measure | Description |
|---------|-------------|
| **Row-Level Security (RLS)** | Every table has RLS policies controlling read/write by role |
| **SECURITY DEFINER functions** | Event logging runs with elevated permissions for append-only writes |
| **IP auto-clearing** | IP addresses are deleted from `url_events` once zip code is populated |
| **Time-limited share links** | External dashboard access expires automatically |
| **No anonymous signups** | Authentication requires email verification |

### Public vs. Protected Routes

*The public/protected boundary is a deliberate architectural decision. Decks must be public because they're the content being shared — requiring authentication would kill viral distribution. Everything else (campaign management, analytics, admin) is protected because it contains organizational strategy and supporter data.*

All campaign management, analytics, and admin pages require authentication. The following routes are public by design:

- **Deck viewer** (`/deck/:slug`) — the shareable content itself
- **Short URL redirects** (`/r/:code`, `/s/:code`) — link resolution
- **Shared dashboards** (`/shared/:shareCode`) — stakeholder views
- **Landing page** (`/landing`) — platform information

---

## 11. Public-Facing Routes

*These routes define Omega's public surface area — the only parts of the platform accessible without credentials. Each serves a specific purpose in the viral distribution chain or stakeholder communication flow.*

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

*The stack is chosen for speed of iteration (React + Vite), mobile-first rendering (Tailwind), real-time data (TanStack Query + Supabase), and geographic visualization (Leaflet). Every dependency serves a specific feature requirement.*

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
