# Claude Context — Democracy Forge (omega-resist)

> **Last updated**: 2026-03-17  
> **Purpose**: Drop this file into Claude's context at the start of each working session.

---

## 1. Project Overview

**Democracy Forge** (deployed at `omega-resist.lovable.app`) is a viral content distribution and analytics platform for political campaigns and civic organizations. It enables:

- **Deck Management**: Upload/arrange slide decks (image sequences) that are deployed as shareable web presentations
- **Token-Based Viral Tracking**: A 4-level hierarchy (L00→L03) tracks how content spreads person-to-person via QR codes, SMS, and email
- **Real-Time Analytics**: Dashboards show geographic spread (Leaflet maps), engagement funnels, viral coefficients, and chain depth
- **Server-Side Snapshots**: Edge functions render stats-page slides as SVG/PNG for embedding in decks without client-side JS
- **Campaign Orchestration**: Campaigns contain Events/Actions (EoAs), each with unique tokens and messaging templates

### Key Terminology
| Term | Meaning |
|------|---------|
| **Campaign** | Top-level container (e.g., "ICE OUT FOR GOOD V2", code: `ice-takedown`) |
| **EoA** | Event or Action — a specific distribution point within a campaign |
| **Deck** | A slug-identified slide presentation (e.g., `falmouth-preview`) |
| **Token** | Unique tracking identifier, levels L00 (seed/root) → L03 (3rd-gen share) |
| **L00 Instance** | Per-scan unique copy of a base L00 token (format: `l00-{code}:{suffix}`) |
| **Mobilize Code** | 6-char identifier linking an EoA to its QR/distribution context |
| **Chapter** | Group of EoAs sharing the same `mobilize_code` within a campaign |
| **Samizdat** | Internal name for the viral distribution mechanism |
| **Engagement State** | Border color encoding on map markers: opened (white), share intent (amber), share completed (cyan) |

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| State | React Query (TanStack) + React Router v6 |
| Backend | Supabase (via Lovable Cloud) — Postgres + Auth + Edge Functions + Storage |
| Maps | Leaflet + leaflet.markercluster (migrated from Mapbox) |
| Charts | Recharts |
| Drag & Drop | @dnd-kit |
| PDF/Export | jspdf, html2canvas |
| QR | qrcode.react |
| Video | @vimeo/player |

---

## 3. File & Folder Structure

```
├── CLAUDE_CONTEXT.md          ← You are here
├── docs/                      ← Decision logs, PRDs, investigation notes
│   ├── PRD.md                 ← Master product requirements
│   ├── decisions/             ← Approved feature plans (dated markdown)
│   └── investigations/        ← Bug reports and findings
├── public/
│   └── data/us-zip-codes.xlsx ← Zip code reference data
├── src/
│   ├── App.tsx                ← Root router + layout (sidebar + protected routes)
│   ├── main.tsx               ← React entry point
│   ├── index.css              ← Tailwind config + CSS custom properties
│   ├── contexts/
│   │   └── AuthContext.tsx     ← Supabase auth provider + role checking
│   ├── pages/                 ← Route-level components
│   │   ├── CampaignManager.tsx    ← Campaign CRUD, drag-sort, clone, deploy status
│   │   ├── CampaignDashboard.tsx  ← Multi-tab analytics (events table, map, virality)
│   │   ├── CampaignDetail.tsx     ← Single campaign config (EoAs, chapters, snapshots)
│   │   ├── CampaignEoaManager.tsx ← Bulk EoA management
│   │   ├── CampaignAnalytics.tsx  ← Cross-campaign analytics
│   │   ├── DeckEditor.tsx         ← Slide arrangement + hotspot editing per deck
│   │   ├── DeckViewer.tsx         ← Public deck viewer (no auth required)
│   │   ├── DeckBuilder.tsx        ← Create new decks
│   │   ├── DeckManagement.tsx     ← Deck listing + bulk operations
│   │   ├── InteractiveTemplates.tsx ← Template gallery (share/stats/hybrid/display)
│   │   ├── TemplateEditorPage.tsx ← Full-res hotspot editor for a single template
│   │   ├── SharedDashboard.tsx    ← Public shareable dashboard (via share code)
│   │   ├── ShortUrlRedirect.tsx   ← /r/:code → full URL redirect + event logging
│   │   ├── Simulator.tsx          ← Generate synthetic token/event data
│   │   ├── ViralityDashboard.tsx  ← Viral coefficient + chain analytics
│   │   ├── Settings.tsx           ← Global app settings (messaging templates, etc.)
│   │   ├── Admin.tsx              ← User role management
│   │   ├── Auth.tsx               ← Login/signup
│   │   └── (debug pages)         ← GeoipTest, MapDebugTest, EdgeFunctionHealth, etc.
│   ├── components/
│   │   ├── ui/                    ← shadcn/ui primitives (button, dialog, table, etc.)
│   │   ├── virality/              ← Chart components (AmplificationChart, FunnelChart, etc.)
│   │   ├── AppSidebar.tsx         ← Navigation sidebar
│   │   ├── ProtectedRoute.tsx     ← Role-gated route wrapper
│   │   ├── FullResolutionHotspotEditor.tsx ← Drag-drop hotspot placement on slides
│   │   ├── InteractiveShareSlide.tsx ← Runtime: renders share hotspots (SMS/email/social)
│   │   ├── StatsPageSlide.tsx     ← Runtime: renders live metric hotspots
│   │   ├── HybridSlide.tsx        ← Runtime: data + action hotspots combined
│   │   ├── ChartHotspotRenderer.tsx ← Renders stacked bar charts in hotspot regions
│   │   ├── MapHotspotRenderer.tsx ← Renders Leaflet maps in hotspot regions
│   │   ├── VimeoSlide.tsx         ← Inline Vimeo player hotspot
│   │   ├── CampaignWizard.tsx     ← 3-step new campaign dialog
│   │   ├── CampaignChapters.tsx   ← Chapter-level messaging overrides
│   │   ├── CampaignSnapshotSettings.tsx ← SSR snapshot config per campaign
│   │   ├── EoaForm.tsx            ← Event/Action create/edit form
│   │   ├── EventStoryDialog.tsx   ← Narrative view of a single event's journey
│   │   ├── SamizdatMap.tsx        ← Leaflet map for EoA distribution visualization
│   │   └── SharedDashboardMap.tsx ← Public-facing Leaflet map
│   ├── hooks/
│   │   ├── useLiveMetrics.ts      ← Fetches & computes all live campaign metrics
│   │   ├── useChartData.ts        ← Weekly cumulative chart data by level
│   │   ├── useSettings.ts         ← Global settings from Supabase
│   │   ├── useTemplateCampaigns.ts ← Campaign associations for templates
│   │   └── useColumnVisibility.ts ← Persisted table column prefs
│   ├── lib/
│   │   ├── virality/
│   │   │   ├── mint.ts            ← Token minting (L00, shares), geolocation, event logging
│   │   │   ├── queries.ts         ← Token chain, metrics, campaign aggregates
│   │   │   ├── shortener.ts       ← URL shortening via Supabase RPC
│   │   │   ├── analytics.ts       ← Viral coefficient, funnel, engagement calculations
│   │   │   ├── simulator.ts       ← Synthetic data generation logic
│   │   │   └── README.md          ← Detailed system documentation
│   │   ├── campaignNarrative.ts   ← Generates text narrative from campaign data
│   │   ├── snapshotCapture.ts     ← Client-side snapshot utilities
│   │   ├── hotspotValidation.ts   ← Validates hotspot configurations
│   │   └── utils.ts               ← Tailwind merge helper
│   ├── types/
│   │   └── viralTemplates.ts      ← TypeScript types for templates, hotspots, configs
│   └── integrations/supabase/
│       ├── client.ts              ← Auto-generated Supabase client (DO NOT EDIT)
│       └── types.ts               ← Auto-generated DB types (DO NOT EDIT)
├── supabase/
│   ├── config.toml                ← Supabase project config (DO NOT EDIT)
│   ├── migrations/                ← SQL migrations (read-only in Lovable)
│   └── functions/                 ← Edge Functions (auto-deployed)
│       ├── geoip/                 ← IP → lat/lon via ipapi service
│       ├── reverse-geocode/       ← lat/lon → zip code via zip_codes table
│       ├── render-stats-snapshot/ ← SSR: generates SVG snapshots of stats slides
│       ├── refresh-all-snapshots/ ← Batch re-renders all campaign snapshots
│       ├── deploy-template-snapshots/ ← Deploy snapshots for specific templates
│       ├── fetch-mobilize-event/  ← Sync EoA data from Mobilize API
│       ├── generate-campaign-pdf/ ← Export campaign data as PDF
│       ├── get-mapbox-token/      ← (Legacy) Mapbox token provider
│       ├── import-google-slides/  ← Import slides from Google Slides
│       └── import-zip-codes/      ← Bulk import zip code reference data
```

---

## 4. Data Model

### Core Tables

#### `campaigns`
Top-level container. Fields: `id`, `code` (unique slug like `ice-takedown`), `title`, `description`, `campaign_type`, `snapshot_enabled`, `snapshot_interval_minutes`, `display_order`.

#### `events_actions` (EoAs)
Distribution points within a campaign. Fields: `id`, `campaign_id` (FK), `utm_id`, `type` (Event/Action), `mobilize_code` (6-char), `title`, `city`, `state`, `zip_code`, `timezone`, `assigned_deck_slug`, `utm_content`.

#### `tokens`
The viral tracking backbone. Fields: `token` (unique 8-char or `l00-{code}` format), `parent_token`, `root_token`, `level` (0-3), `eoa_id` (FK), `deck_slug`, `l00_instance`, `utm_*` fields, `full_url`, `is_simulated`, `deleted_at`, `minted_at`.

**Token hierarchy:**
```
L00 (base: l00-{mobilize_code}-{utm_id})
  └─ L00 instance (l00-{code}:{6-char-suffix})  ← one per physical scan
       └─ L01 (8-char random) ← first share
            └─ L02 ← second-gen share
                 └─ L03 ← third-gen share (cap)
```

#### `url_events`
Append-only event log. Fields: `id`, `token` (FK), `event_type` (scan/view/share), `occurred_at`, `ip_address`, `user_agent`, `latitude`, `longitude`, `city`, `region`, `country`, `country_code`, `zip_code`, `location_source` (gps/ip/unknown), `utm_snapshot`, `is_simulated`, `deleted_at`.

#### `decks`
Slide containers. Fields: `slug` (PK), `display_order`.

#### `slide_items`
Individual slides in a deck. Fields: `id`, `deck_slug` (FK), `position`, `type` (image/spread-word), `content_url`, `template_id` (FK to `viral_slide_configs`), `skip_deploy`, `media_url`.

#### `viral_slide_configs`
Template definitions for interactive/stats slides. Fields: `id`, `slug`, `name`, `template_type` (interactive_share/stats_page/hybrid/display_only), `image_url`, `hotspots` (JSONB array), `config` (JSONB), `deck_slug`, `slide_id`, `cached_snapshot_path`, `snapshot_rendered_at`.

#### `campaign_message_overrides`
Per-campaign or per-chapter messaging template overrides. Fields: `campaign_id`, `mobilize_code` (null = campaign-level), `category`, `key`, `value`.

#### Supporting Tables
- **`daily_aggregates`**: Rollup metrics by date/campaign/eoa/level (refreshed via `refresh_daily_aggregates()`)
- **`shortened_urls`**: URL shortener (`/r/:code` redirects)
- **`dashboard_shares`**: Shareable dashboard links (`/shared/:shareCode`)
- **`zip_codes`**: US zip code → lat/lon/city/state/timezone lookup (42k+ rows)
- **`user_roles`**: RBAC (admin/manager/viewer) via `has_role()` SECURITY DEFINER function
- **`deck_versions`** / **`deck_eoa_assignments`**: Version tracking and EoA↔deck linking
- **`l00_instance_corrections`**: Audit trail for L00 re-instantiation events
- **`settings`**: Global app settings (messaging templates, etc.)

### Key Database Functions
- `mint_l00(_eoa_id, _deck_slug, _utm_medium)` → mints root token
- `instantiate_l00_token(_base_token)` → creates per-scan instance
- `maybe_reinstantiate_l00(_instance_token, _current_zip_code)` → dedup by zip (Actions) or always new (Events)
- `mint_share(_parent_token, _utm_medium)` → mints L01-L03, capped at L03
- `log_event(_token, _event_type, ...)` → SECURITY DEFINER, rate-limited for L01+
- `get_campaign_stats(campaign_codes[])` → aggregated stats
- `lookup_token(_token)` → public token resolution
- `resolve_message_template(...)` → cascading template resolution (chapter → campaign → global)

---

## 5. Architecture Decisions

1. **Geolocation pipeline**: GPS (browser) → fallback to IP (geoip edge function via ipapi) → reverse-geocode to nearest zip code. Known limitation: IP-based location reflects cell tower/ISP node, not physical position.

2. **L00 instantiation**: Base L00 tokens are templates; each physical scan creates an instance (`l00-code:suffix`). For Event-type EoAs, every scan = new instance. For Action-type, re-instantiation only on zip code change.

3. **Snapshot rendering**: Edge function `render-stats-snapshot` generates SVG with embedded metrics, converts to PNG, stores in `slide-snapshots` bucket. Campaigns can enable periodic refresh.

4. **Template types**: `interactive_share` (share buttons), `stats_page` (live metrics), `hybrid` (both), `display_only` (static), plus hotspot types: sms, email, social, external_link, live_number, chart, map, app_download, email_links, vimeo.

5. **RLS security**: All tables have RLS. `url_events` insert only via `log_event()` SECURITY DEFINER. Tokens viewable by anyone (for public deck viewing), but management requires admin/manager role.

6. **IP privacy**: IP addresses are cleared from `url_events` once zip code is populated (via trigger `clear_ip_when_zip_populated`).

---

## 6. Current State (as of 2026-03-05)

### Working
- Full campaign lifecycle: create → add EoAs → assign decks → mint L00 → deploy
- Viral token chain: L00 → L03 with proper parent/root tracking
- Public deck viewer with interactive share slides (SMS/email)
- Geolocation capture (GPS + IP fallback + zip code resolution)
- Leaflet-based activity maps with marker clustering
- Campaign dashboard with events table, map, virality analytics
- Server-side snapshot rendering for stats-page slides
- Campaign narrative generation (text summary of campaign metrics)
- URL shortener + QR code generation
- Simulator for synthetic data generation
- Shareable dashboards via time-limited share codes
- Chapter-scoped messaging overrides
- Drag-and-drop deck ordering and campaign ordering

### Known Issues
- **IP geolocation accuracy**: Mobile carrier IPs can resolve to wrong state entirely (e.g., Sandwich MA → Hot Springs AR). This is inherent to IP-based geolocation and not a bug per se.
- **Samizdat Template-1**: Has a broken `image_url` in storage, causes 500 errors during batch snapshot refresh. Needs image fix or template deletion.
- **GPS permission**: Many mobile browsers deny or timeout GPS, forcing IP fallback. No current mechanism to re-prompt or indicate to the user that location accuracy is degraded.

### Recent Work
- Campaign narrative formatting improvements (bold titles, emoji indents, word wrapping)
- Zip code fallback to city/region for geocoding
- L00 color split in charts (seeds vs spawns)
- Vimeo slide type support
- Email links hotspot type
- iOS icon fallback handling
- External link label handling improvements
- Chapter-scoped messaging system
- Bulk slide selection in deck editor

---

## 7. Public Routes (No Auth Required)

| Route | Purpose |
|-------|---------|
| `/deck/:slug` | Public deck viewer |
| `/r/:code` | Short URL redirect |
| `/s/:code` | (Alias for short URL) |
| `/shared/:shareCode` | Shareable dashboard |
| `/template-editor/:id` | Template editor |

All other routes require authentication and appropriate role (admin/manager/viewer).

---

## 8. Environment & Secrets

Edge functions have access to: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MAPBOX_PUBLIC_TOKEN`, `IPAPI_API_KEY`, `LOVABLE_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_KEY`.

Frontend `.env` (auto-managed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.

---

## 9. Conventions

- **Decision logs**: Saved to `docs/decisions/<topic>/<date>_<slug>_feature-doc_lovable.md` after each approved plan
- **Data integrity**: Never fabricate metrics or placeholder data in narratives/reports
- **Numbered plans**: All plan items use numbered sections (1, 2, 3) with lettered sub-items (a, b, c) for unambiguous reference
- **Semantic tokens**: UI uses Tailwind CSS custom properties from `index.css`, never raw color values in components
