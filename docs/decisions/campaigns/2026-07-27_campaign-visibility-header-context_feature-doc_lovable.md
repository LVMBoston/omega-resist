# Campaign Visibility — Header Context

Status: Approved & Implemented
Date: 2026-07-27

## Problem

The Campaign Visibility page (`/campaign-dashboard`) showed a campaign `Select`
dropdown in the top-right whose trigger rendered a bare campaign title (e.g.
"BUGTEST-V2xy"). Users read it as a stray label rather than a control, and the
page gave no other indication of which campaign was being viewed.

## Decision

1. Removed the campaign dropdown from the header entirely. The campaign is
   determined by the URL (`?campaign=…&campaignId=…`), set when navigating in
   from Campaign Orchestration. Existing localStorage / first-campaign fallback
   logic is unchanged, so a bare `/campaign-dashboard` still resolves.
2. Added a breadcrumb: `Campaign Orchestration > {campaign title}`, matching the
   Event Manager (`CampaignDetail.tsx`) pattern. Switching campaigns is a
   one-click trip back through the breadcrumb.
3. Added a campaign identity block under the page heading: campaign title
   (semibold, `text-xl`) with `utm_campaign: {code}` beneath it.
4. Official start / pre-launch badges retained, now below the identity block.

## Scope

Only `src/pages/CampaignDashboard.tsx` changed — presentation only. No data
fetching, filter, tab, metric, export, or map behavior was touched. The
`campaigns` query remains because the title is still resolved from the code.

## Verification

Browser check on `/campaign-dashboard` confirmed the breadcrumb, campaign title,
and `utm_campaign` line render, and the dropdown is gone.

## Relationship to prior plans

New decision document. Does not update an existing plan.

## Update — 2026-07-27

### Problem with the first pass

The header kept "Campaign Visibility" as the big heading with the campaign name
demoted to a small line beneath it, and the page could show a campaign the user
was not working in (e.g. `BUGTEST-V2xy` after entering from Stoddard's European
Postcards), because campaign identity was restored from the stale
`campaign-dashboard-filters` localStorage blob.

### Changes

1. Header now matches Event Manager: a small uppercase "CAMPAIGN VISIBILITY"
   eyebrow, the campaign title as the `text-3xl` heading, and
   `utm_campaign: {code}` beneath it. Badges unchanged, below the block.
2. New shared helper `src/lib/activeCampaign.ts` records the campaign the user is
   working in (`active-campaign` in localStorage) and exposes
   `campaignDashboardUrl()`.
3. `CampaignDetail` writes the active campaign when a campaign is opened;
   `CampaignDashboard` writes it whenever a campaign is resolved from the URL.
4. The sidebar's Campaign Visibility link points at the active campaign.
5. Resolution order on `/campaign-dashboard` with no URL campaign:
   active campaign → saved dashboard filters → first campaign. Explicit URL
   parameters still win.
6. When `CampaignDashboard` is embedded inside Event Manager (`campaignId` prop),
   the breadcrumb and header block are suppressed to avoid duplication.

### Verification

Browser run with a deliberately stale `campaign-dashboard-filters` entry pointing
at another campaign: Campaign Orchestration → Stoddard's European Postcards →
sidebar "Campaign Visibility" landed on
`?campaign=sv-paris-postcards&campaignId=df252cd0…` with the heading
"Stoddard's European Postcards" and `utm_campaign: sv-paris-postcards`.
