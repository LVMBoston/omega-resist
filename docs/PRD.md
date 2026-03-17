# Product Requirements Document (PRD) — December 3, 2025
# Democracy Forge

**Version**: 2.0  
**Last Updated**: March 17, 2026  
**Document Owner**: [TBD]

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision & Goals](#3-product-vision--goals)
4. [User Personas](#4-user-personas)
5. [Core Features](#5-core-features)
6. [User Flows](#6-user-flows)
7. [Data Model](#7-data-model)
8. [Technical Architecture](#8-technical-architecture)
9. [Security & Access Control](#9-security--access-control)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Future Roadmap](#11-future-roadmap)
12. [Glossary](#12-glossary)

---

## 1. Executive Summary

**Democracy Forge** is a viral content distribution and analytics platform designed for political campaigns and civic engagement organizations. The platform enables users to create shareable presentation decks with embedded QR codes that track multi-level viral sharing (up to 4 levels: L00-L03), providing detailed analytics on content reach, engagement, and geographic distribution.

### Key Capabilities
- **Deck Management**: Create, import (Google Slides, PowerPoint), and manage presentation decks
- **Interactive Slide Templates**: Configurable viral slides with hotspots for actions (share via SMS, email, etc.)
- **Token-Based Viral Tracking**: Hierarchical token system (L00→L01→L02→L03) to track content sharing chains
- **Campaign & Event Orchestration**: Manage campaigns with associated Events/Actions (EoAs)
- **Real-Time Analytics**: Dashboards showing scans, views, shares, geographic heatmaps, and viral coefficients
- **Shareable Dashboards**: Generate time-limited public dashboard links for stakeholders

### Target Users
- Campaign managers overseeing political outreach
- Field organizers distributing content at events
- Data analysts reviewing engagement metrics
- External stakeholders viewing campaign performance

---

## 2. Problem Statement

Political campaigns and civic organizations struggle to:

1. **Track Content Virality**: Traditional QR codes and links don't reveal how content spreads person-to-person
2. **Measure Field Effectiveness**: No clear connection between field events and downstream engagement
3. **Optimize Distribution Channels**: Lack of data on which sharing methods (QR, SMS, email) drive most engagement
4. **Demonstrate Impact**: Difficulty showing stakeholders the reach and influence of campaign materials
5. **Coordinate Across Events**: Managing multiple events with different decks and tracking their individual performance

### Current State
Organizations use generic URL shorteners or basic QR generators that only track first-level clicks, losing visibility into viral spread and attribution.

### Desired State
A unified platform that mints trackable tokens at field events, captures multi-level sharing chains, and provides actionable analytics with full attribution to source events.

---

## 3. Product Vision & Goals

### Vision Statement
Empower civic organizations to understand and amplify how their message spreads through communities, enabling data-driven field operations and demonstrable impact reporting.

### Success Metrics (KPIs)

| Metric | Definition | Target |
|--------|------------|--------|
| **Viral Coefficient** | Average L01+ shares per L00 token | > 1.5 |
| **Chain Depth** | Average maximum share level reached | > L02 |
| **Geographic Reach** | Unique zip codes reached per campaign | Varies by campaign |
| **Event Attribution Rate** | % of all events traceable to source EoA | > 95% |
| **Dashboard Adoption** | % of campaigns with active shared dashboards | > 50% |
| **Scan-to-Share Conversion** | % of scans that result in shares | > 20% |

### Goals
1. **Q1**: Full deployment of token minting and event logging system
2. **Q2**: Launch shareable dashboards with geographic visualization
3. **Q3**: Real-time analytics with automated reporting
4. **Q4**: A/B testing capabilities for slide templates

---

## 4. User Personas

### 4.1 Campaign Manager (Admin)

**Role**: Oversees entire campaign operations

**Responsibilities**:
- Create and configure campaigns
- Assign decks to events/actions
- Monitor high-level analytics
- Share dashboards with stakeholders
- Manage user access and roles

**Pain Points**:
- Needs consolidated view across all events
- Requires export capabilities for reporting
- Must demonstrate ROI to donors

**Access Level**: Full admin privileges

---

### 4.2 Field Organizer (Manager)

**Role**: Executes ground operations at events

**Responsibilities**:
- Generate QR codes for specific events
- Distribute physical/digital materials
- Track event-specific performance
- Report on local engagement

**Pain Points**:
- Needs simple QR generation workflow
- Requires mobile-friendly interfaces
- Must work with intermittent connectivity

**Access Level**: Manager (can mint L00 tokens, view analytics)

---

### 4.3 Data Analyst (Viewer)

**Role**: Analyzes campaign performance

**Responsibilities**:
- Generate reports on viral metrics
- Identify high-performing content/events
- Recommend optimization strategies
- Monitor geographic distribution

**Pain Points**:
- Needs filtering and drill-down capabilities
- Requires data export for external analysis
- Must correlate multiple data dimensions

**Access Level**: Viewer (read-only analytics)

---

### 4.4 External Stakeholder

**Role**: Donor, partner, or board member

**Responsibilities**:
- Review campaign impact
- Make funding decisions
- Provide strategic guidance

**Pain Points**:
- Needs simple, visual dashboards
- No technical knowledge assumed
- Time-limited access appropriate

**Access Level**: Shared dashboard links only (no authentication required)

---

## 5. Core Features

### 5.1 Deck Management

**Description**: Create and manage presentation decks that can be shared and tracked.

| Capability | Status | Notes |
|------------|--------|-------|
| Create new deck | ✅ Implemented | Via Deck Management page |
| Import Google Slides | ✅ Implemented | Edge function `import-google-slides` |
| Import PowerPoint | ✅ Implemented | Edge function `import-powerpoint` |
| Reorder slides | ✅ Implemented | Drag-and-drop interface |
| Add/remove slides | ✅ Implemented | |
| Deck versioning | ✅ Implemented | `deck_versions` table |
| Assign deck to EoA | ✅ Implemented | Via Campaign Orchestration |

**Routes**: `/deck-management`, `/deck-builder`, `/deck-editor/:slug`

---

### 5.2 Interactive Slide Templates

**Description**: Configurable viral slides with interactive hotspots. The unified slide architecture auto-classifies slides by hotspot content on save.

| Capability | Status | Notes |
|------------|--------|-------|
| Upload background image | ✅ Implemented | Full resolution support |
| Define hotspot regions | ✅ Implemented | Visual editor with drag-drop |
| Configure hotspot actions | ✅ Implemented | SMS, Email, Link copy, Vimeo, App download, External link, Email links |
| Template library | ✅ Implemented | `viral_slide_configs` table |
| Preview templates | ✅ Implemented | |
| Auto-classify slide type | ✅ Implemented | Action → `interactive_share`, Data → `stats_page`, Both → `hybrid` |
| Auto-promote/demote slides | ✅ Implemented | Adding hotspots promotes image → spread-word; removing demotes back |
| Vimeo embed slides | ✅ Implemented | Inline player with mute toggle and swipe passthrough |
| Chart hotspots | ✅ Implemented | Stacked bar charts rendered in hotspot regions |
| Map hotspots | ✅ Implemented | Leaflet maps rendered in hotspot regions |
| Live number hotspots | ✅ Implemented | Real-time campaign metrics embedded in slides |
| Server-side snapshot rendering | ✅ Implemented | SVG/PNG via `render-stats-snapshot` edge function |

**Template Types**: `interactive_share`, `stats_page`, `hybrid`, `display_only`

**Routes**: `/interactive-templates`, `/template-editor/:id`

---

### 5.3 Token-Based Viral Tracking

**Description**: Hierarchical token system for tracking content sharing chains across QR, email, and SMS distribution channels.

| Capability | Status | Notes |
|------------|--------|-------|
| Mint L00 tokens | ✅ Implemented | `mint_l00()` function |
| L00 per-scan instantiation | ✅ Implemented | `instantiate_l00_token()` — unique instance per scan |
| L00 re-instantiation by zip | ✅ Implemented | `maybe_reinstantiate_l00()` — dedup for Actions, always new for Events |
| Mint share tokens (L01-L03) | ✅ Implemented | `mint_share()` function, capped at L03 |
| Log events (scan/view/share) | ✅ Implemented | `log_event()` SECURITY DEFINER function |
| Track parent/root chain | ✅ Implemented | `parent_token`, `root_token` fields |
| UTM parameter tracking | ✅ Implemented | Full UTM snapshot stored per event |
| Geolocation (IP-based) | ✅ Implemented | Via `geoip` edge function (ipapi) |
| Geolocation (GPS fallback) | ⚠️ Partial | Location source tracked; GPS often denied on mobile |
| Reverse geocode to zip | ✅ Implemented | `reverse-geocode` edge function + `get_nearest_zip_code()` |
| IP privacy auto-clear | ✅ Implemented | Trigger clears IP once zip code is populated |
| Multi-channel L00 distribution | ✅ Implemented | QR, email blast, SMS blast all produce L00 tokens |

**Token Hierarchy**:
```
L00 (Root) ─┬─ L01 (Share) ─┬─ L02 (Share) ── L03 (Share)
            │                └─ L02 (Share) ── L03 (Share)
            └─ L01 (Share) ─── L02 (Share) ── L03 (Share)
```

---

### 5.4 Campaign & Event Orchestration

**Description**: Manage campaigns with associated Events/Actions (EoAs).

| Capability | Status | Notes |
|------------|--------|-------|
| Create campaigns | ✅ Implemented | |
| Create EoAs (manual) | ✅ Implemented | |
| Import from Mobilize | ✅ Implemented | Edge function `fetch-mobilize-event` |
| Assign decks to EoAs | ✅ Implemented | |
| Generate QR codes | ✅ Implemented | With configurable defaults |
| Batch operations | ✅ Implemented | Multi-select EoA actions |

**Routes**: `/campaign-config`, `/campaign/:campaignId`

---

### 5.5 Analytics Dashboards

**Description**: Comprehensive analytics for campaign performance.

| Dashboard | Features | Route |
|-----------|----------|-------|
| **Campaign Analytics** | Funnel charts, viral coefficient trends | `/campaign-analytics` |
| **Campaign Dashboard** | Events table, map view, virality analytics | `/campaign-dashboard` |
| **Virality Dashboard** | Engagement by level, content performance | `/virality-dashboard` |
| **Activity Monitor** | Real-time event stream, map | `/activity-monitor` |

**Filtering Capabilities**:
- Campaign
- Event type (scan/view/share)
- Data source (live/simulated)
- Token level (L00-L03)
- Date range
- Geographic (city, state, zip)
- Share medium (QR, SMS, Email)

---

### 5.8 Share Flow Visualization (Samizdat Map)

**Description**: Geographic visualization of content spread using a 3-dimensional marker encoding system on Leaflet maps. No connecting arcs — geographic spread is shown organically through the appearance of new markers at recipient locations.

| Dimension | What It Encodes | Values |
|-----------|----------------|--------|
| **Shape** | Distribution channel | ● Circle (QR), ◻ Square (Email), △ Triangle (SMS) |
| **Fill color** | Viral level (hops from org) | ⬛ Dark `#1e293b` (L00), 🟢 Green `#22c55e` (L01), 🟣 Purple `#a855f7` (L02), 🔴 Red `#ef4444` (L03) |
| **Border color** | Engagement state | White `#ffffff` (opened), Amber `#f59e0b` (share intent), Cyan `#06b6d4` (share completed) |

**Engagement state lifecycle**:
1. Person opens link → marker appears with **white** border
2. Person taps Share → border changes to **amber** (child token minted)
3. Recipient opens shared link → sharer's border changes to **cyan**

| Capability | Status | Notes |
|------------|--------|-------|
| Multi-shape markers (QR/Email/SMS) | ✅ Implemented | Shape determined by `utm_medium` |
| Level-based fill colors | ✅ Implemented | Contrast-verified palette |
| 3-state engagement borders | ✅ Implemented | Retroactive — works with all existing data |
| Marker clustering | ✅ Implemented | Via leaflet.markercluster |
| Timeline playback | ✅ Implemented | Scrub through events over time |
| Chain mode | ✅ Implemented | Trace individual token chains |
| Viewport activity report | ✅ Implemented | Summary stats for visible markers |
| Fullscreen mode | ✅ Implemented | |
| Event story panel | ✅ Implemented | Narrative view of single event |
| Conversion rate in viewport report | ⬚ Planned | Completed shares / share intents |

**Design constraint**: All visual states are static (no animations) for compatibility with server-side snapshot rendering.

**Reference**: `docs/PRD_Share_Flow_Visualization.md`

---

### 5.6 Shareable Dashboards

**Description**: Generate time-limited public links for external stakeholders.

| Capability | Status | Notes |
|------------|--------|-------|
| Generate share links | ✅ Implemented | Unique share codes |
| Set expiration | ✅ Implemented | Configurable duration |
| Track view count | ✅ Implemented | |
| Deactivate links | ✅ Implemented | |
| Public map + analytics | ✅ Implemented | No auth required |

**Routes**: `/shared/:shareCode`

---

### 5.7 Admin & Settings

**Description**: System administration and configuration.

| Capability | Status | Notes |
|------------|--------|-------|
| User role management | ✅ Implemented | Admin/Manager/Viewer |
| QR code defaults | ✅ Implemented | Settings page |
| Zip code database | ✅ Implemented | US coverage |
| Simulator | ✅ Implemented | Generate test data |

**Routes**: `/admin`, `/settings`, `/simulator`

---

## 6. User Flows

### 6.1 Campaign Setup Flow

```
1. Campaign Manager creates new Campaign
   └── Sets title, code, description

2. Creates Events/Actions (EoAs)
   ├── Manual entry (title, location, dates)
   └── Import from Mobilize (via event ID)

3. Creates/Imports Deck
   ├── Build from scratch
   ├── Import Google Slides
   └── Import PowerPoint

4. Assigns Deck to EoAs
   └── Each EoA gets deck assignment

5. Generates QR Codes
   └── Mints L00 tokens for each EoA
```

### 6.2 Field Distribution Flow

```
1. Field Organizer accesses Campaign Orchestration
   └── Selects their assigned event

2. Generates QR Code
   └── L00 token minted with UTM parameters

3. Distributes QR (printed/displayed)
   └── Attendees scan QR code

4. Attendee scans → Views deck → Shares
   ├── Scan event logged (L00)
   ├── View event logged (L00)
   └── Share event creates L01 token

5. Share recipient views → Shares again
   └── Chain continues to L03 max
```

### 6.3 Analytics Review Flow

```
1. Analyst accesses Campaign Dashboard
   └── Selects filters (campaign, date range, etc.)

2. Reviews metrics
   ├── Events table (scans, views, shares)
   ├── Geographic map
   └── Trend charts

3. Drills into specific EoA
   └── Sees token chain and performance

4. Exports or shares dashboard
   ├── Generate shareable link
   └── Set expiration
```

---

## 7. Data Model

### Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────────┐     ┌──────────┐
│  campaigns  │────<│  events_actions │────<│  tokens  │
└─────────────┘     └─────────────────┘     └──────────┘
       │                    │                     │
       │                    │                     │
       ▼                    ▼                     ▼
┌──────────────────┐  ┌────────────┐      ┌─────────────┐
│ dashboard_shares │  │   decks    │      │ url_events  │
└──────────────────┘  └────────────┘      └─────────────┘
                           │
                           ▼
                    ┌──────────────┐     ┌─────────────────────┐
                    │ slide_items  │────>│ viral_slide_configs │
                    └──────────────┘     └─────────────────────┘
```

### Key Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `campaigns` | Campaign metadata | `code`, `title`, `description` |
| `events_actions` | Events or Actions (EoAs) | `utm_id`, `mobilize_code`, `campaign_id`, `assigned_deck_slug` |
| `decks` | Presentation decks | `slug`, `display_order` |
| `deck_versions` | Deck version history | `deck_slug`, `version`, `notes` |
| `slide_items` | Individual slides | `deck_slug`, `position`, `content_url`, `template_id` |
| `viral_slide_configs` | Interactive slide templates | `slug`, `hotspots`, `config` |
| `tokens` | L00-L03 tracking tokens | `token`, `level`, `parent_token`, `root_token`, `eoa_id` |
| `url_events` | Event log (scan/view/share) | `token`, `event_type`, `occurred_at`, `utm_snapshot` |
| `daily_aggregates` | Rollup metrics | `date`, `campaign_id`, `scans`, `views`, `shares` |
| `dashboard_shares` | Shareable dashboard links | `share_code`, `campaign_id`, `expires_at` |
| `user_roles` | Role-based access | `user_id`, `role` |
| `zip_codes` | US zip code geocoding | `zip_code`, `latitude`, `longitude`, `city`, `state_name` |

---

## 8. Technical Architecture

### Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **UI Components** | shadcn/ui, Tailwind CSS |
| **State Management** | TanStack Query (React Query) |
| **Routing** | React Router v6 |
| **Maps** | Leaflet (migrated from Mapbox due to iOS WebGL issues) |
| **Backend** | Lovable Cloud (Supabase) |
| **Database** | PostgreSQL |
| **Edge Functions** | Deno (Supabase Edge Functions) |
| **Auth** | Supabase Auth |

### Edge Functions

| Function | Purpose |
|----------|---------|
| `geoip` | IP-based geolocation lookup |
| `get-mapbox-token` | Secure Mapbox token retrieval |
| `import-google-slides` | Google Slides import |
| `import-powerpoint` | PowerPoint file import |
| `fetch-mobilize-event` | Mobilize API integration |
| `import-zip-codes` | Bulk zip code data import |

### Edge Functions

| Function | Purpose |
|----------|---------|
| `geoip` | IP-based geolocation lookup (via ipapi) |
| `reverse-geocode` | lat/lon → nearest zip code |
| `render-stats-snapshot` | SSR: generates SVG/PNG snapshots of stats slides |
| `refresh-all-snapshots` | Batch re-renders all campaign snapshots |
| `deploy-template-snapshots` | Deploy snapshots for specific templates |
| `get-mapbox-token` | (Legacy) Secure Mapbox token retrieval |
| `import-google-slides` | Google Slides import |
| `fetch-mobilize-event` | Mobilize API integration |
| `import-zip-codes` | Bulk zip code data import |
| `generate-campaign-pdf` | Export campaign data as PDF |

### Key Architectural Decisions

1. **Leaflet over Mapbox**: Migrated due to iOS Safari WebGL 2 incompatibility
2. **CartoDB Positron tiles**: Clean, minimal base map for data visualization
3. **Token hierarchy**: 4-level max (L00-L03) prevents infinite chains
4. **SECURITY DEFINER functions**: Event logging bypasses RLS for append-only writes
5. **Daily aggregates**: Materialized rollups for performant analytics queries
6. **IP privacy**: IPs auto-cleared from `url_events` once zip code is populated
7. **L00 instantiation**: Base L00 tokens are templates; each scan creates a unique instance
8. **Unified slide architecture**: Auto-detect slide type from hotspot content on save
9. **Static marker encoding**: No animations on map markers — must be snapshot-safe
10. **Chapter-scoped messaging**: Cascading template resolution (chapter → campaign → global)

---

## 9. Security & Access Control

### Role-Based Access Control (RBAC)

| Role | Capabilities |
|------|-------------|
| **Admin** | Full access: create campaigns, manage users, view all data, configure settings |
| **Manager** | Mint L00 tokens, view analytics, manage assigned EoAs |
| **Viewer** | Read-only access to analytics and dashboards |

### Row-Level Security (RLS) Policies

| Table | Read | Write | Notes |
|-------|------|-------|-------|
| `campaigns` | All authenticated | Admin only | |
| `events_actions` | All authenticated | Admin/Manager | |
| `tokens` | Anyone | Authenticated | Minting requires role check |
| `url_events` | Admin/Manager | Via `log_event()` only | SECURITY DEFINER |
| `daily_aggregates` | Anyone | Via `refresh_daily_aggregates()` | Read-only for users |
| `user_roles` | Own record / Admin sees all | Admin only | |

### Authentication

- Email/password authentication via Supabase Auth
- Auto-confirm enabled for development
- Session-based with JWT tokens

### Public Routes (No Auth Required)

- `/deck/:slug` - Deck viewer
- `/r/:code`, `/s/:code` - Short URL redirects
- `/shared/:shareCode` - Shared dashboards

---

## 10. Non-Functional Requirements

### Performance

| Metric | Target |
|--------|--------|
| Page load time | < 2 seconds |
| Dashboard query response | < 1 second |
| Event logging latency | < 200ms |
| Map rendering | < 1 second for 10K points |

### Scalability

- Designed for 100K+ events per campaign
- Daily aggregates prevent query performance degradation
- Clustered map markers for large datasets

### Availability

- 99.9% uptime target
- Backend auto-scales via Lovable Cloud

### Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions, including iOS)
- Edge (latest 2 versions)

### Mobile Support

- Responsive design for all screen sizes
- Touch-optimized interactive elements
- iOS Safari WebGL 1 compatible (Leaflet)

---

## 11. Future Roadmap

### Recently Completed (Q1 2026)

- [x] Server-side snapshot rendering for stats slides
- [x] Campaign narrative generation (AI-driven text summaries)
- [x] Vimeo slide type with inline player
- [x] Chapter-scoped messaging overrides
- [x] 3-state engagement border model on map markers
- [x] Multi-channel L00 distribution (QR/email/SMS blasts)
- [x] Unified slide architecture (auto-classify on save)
- [x] Contrast-verified marker palette
- [x] PDF campaign export

### Near-Term (Q2 2026)

- [ ] Conversion rate in viewport activity report
- [ ] Scheduled cron for `refresh_daily_aggregates()`
- [ ] Enhanced date range presets (last 7d, 30d, custom)
- [ ] Bulk EoA import from CSV

### Mid-Term (Q3-Q4 2026)

- [ ] Real-time dashboard updates (WebSocket/Realtime)
- [ ] A/B testing for slide templates
- [ ] Advanced geographic filtering (draw polygon)
- [ ] Push notifications for campaign milestones

### Long-Term (2027+)

- [ ] Machine learning for optimal distribution timing
- [ ] Integration with additional CRMs
- [ ] White-label capability
- [ ] Multi-language support

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **Campaign** | Top-level organizational unit containing multiple EoAs |
| **EoA (Event or Action)** | A specific event or action within a campaign (e.g., rally, canvass) |
| **Deck** | A presentation consisting of multiple slides |
| **Slide** | Individual page within a deck; can be static image or interactive template |
| **Token** | Unique 8-character identifier for tracking (e.g., `abc12345`) |
| **L00 (Root Token)** | First-level token minted at an EoA; origin of a sharing chain |
| **L01/L02/L03** | Share-level tokens; each represents one degree of viral spread |
| **Viral Coefficient** | Average number of shares generated per token at a given level |
| **Hotspot** | Interactive region on a slide that triggers an action |
| **UTM Parameters** | Tracking parameters (source, medium, campaign, content, id) |
| **Mobilize Code** | 6-character code from Mobilize integration or custom identifier |
| **RLS** | Row-Level Security; PostgreSQL feature for data access control |
| **SECURITY DEFINER** | PostgreSQL function that runs with creator's permissions |

---

## Appendix A: URL Structure

### Deck Viewer
```
/deck/{deck_slug}?t={token}&v_lvl={level}
```

### Short URLs
```
/r/{short_code}  →  Redirects to full URL
/s/{short_code}  →  Same as /r/
```

### Shared Dashboard
```
/shared/{share_code}
```

---

## Appendix B: UTM Parameter Reference

| Parameter | L00 Value | L01+ Value |
|-----------|-----------|------------|
| `utm_campaign` | Campaign code | Inherited |
| `utm_source` | `L00` | `L01`, `L02`, `L03` |
| `utm_medium` | `qr`, `sms`, `em`, `link` | Share method |
| `utm_content` | `{mobilize_code}-{utm_id}` | Inherited |
| `utm_id` | EoA identifier | Inherited |
| `t` | Token | Token |
| `p` | — | Parent token |
| `v_lvl` | `00` | `01`, `02`, `03` |

---

*Document generated from codebase analysis. Last updated: March 17, 2026*
