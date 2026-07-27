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
