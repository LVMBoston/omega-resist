## Goal

Campaign Visibility should (1) lead with the campaign's name the way Event Manager does, and (2) show the campaign you were just working in, never a stale leftover like `BUGTEST-V2xy`.

## 1. Header, Event Manager style (`src/pages/CampaignDashboard.tsx`)

a. Breadcrumb stays: **Campaign Orchestration** > **{campaign title}**.

b. Big heading becomes the campaign title (`text-3xl font-bold`), e.g. "Stoddard's European Postcards", with `utm_campaign: sv-paris-postcards` directly beneath it in muted small text.

c. "Campaign Visibility" becomes a small uppercase muted label above the title (page-name eyebrow), and the "Real-time viral tracking and analytics" subtitle moves under it — or is dropped if it crowds the block.

d. Official start / pre-launch badges stay, below the identity block.

e. While campaigns are loading, show the campaign code (from the URL) rather than a blank or placeholder title.

## 2. Follow the campaign you came from

a. Introduce one "active campaign" record (id + code) written whenever you open a campaign context: entering Event Manager (`/campaign/:campaignId`) and entering Campaign Visibility with an explicit campaign in the URL.

b. The sidebar's **Campaign Visibility** link resolves to that active campaign, so clicking it from Stoddard's Event Manager lands on Stoddard's visibility page.

c. Ordering of resolution on `/campaign-dashboard` with no URL campaign: active campaign → previously saved dashboard filters → first campaign. Explicit URL parameters always win.

d. The existing `campaign-dashboard-filters` localStorage entry keeps doing its job for filter state; campaign identity moves to the new active-campaign record so a stale filter blob can no longer override the campaign you just opened.

## 3. Technical notes

- Files: `src/pages/CampaignDashboard.tsx` (header + resolution order), `src/pages/CampaignDetail.tsx` (record active campaign), `src/components/AppSidebar.tsx` (link carries the active campaign), plus a tiny shared helper for reading/writing the active campaign.
- No data-fetch, tab, filter, metric, map, or export logic changes.
- Verification: browser check — open Campaign Orchestration → Stoddard's European Postcards → click Campaign Visibility in the sidebar; screenshot must show "Stoddard's European Postcards" as the heading with `utm_campaign: sv-paris-postcards` beneath and the correct breadcrumb.

## 4. Decision log

Appends an `## Update — 2026-07-27` section to the existing `docs/decisions/campaigns/2026-07-27_campaign-visibility-header-context_feature-doc_lovable.md`. This updates that plan rather than creating a new one.

## What does not change

- Tabs, filters bar, simulation controls, level checkboxes
- Any metric, export, or map behavior
