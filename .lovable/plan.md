## Goal

Make the Campaign Visibility page header match the Event Manager pattern: show which campaign you're looking at, and drop the confusing campaign dropdown in the top-right.

## 1. Header changes (`src/pages/CampaignDashboard.tsx`, lines ~825–867)

a. Add a breadcrumb above the heading: **Campaign Orchestration** (link to `/campaign-config`) > **{campaign title}**, using the same `Breadcrumb` components as the Event Manager page (`CampaignDetail.tsx`).

b. Under the "Campaign Visibility" heading and its "Real-time viral tracking and analytics" subtitle, add the campaign identity line: campaign title (bold, prominent) with `utm_campaign: {code}` beneath it — same shape as the Event Manager header.

c. Remove the campaign `Select` dropdown and its loading spinner from the top-right of the header. The campaign is then determined purely by the URL (`?campaign=…&campaignId=…`), as set when you navigate in from Campaign Orchestration.

d. Keep the existing "Official start" and "Pre-launch / test excluded" badges exactly where they are.

## 2. Behavior after removing the dropdown

a. The page already reads the campaign from the URL and falls back to the last-used campaign in local storage, then the first campaign. That fallback stays, so landing on `/campaign-dashboard` with no parameters still resolves to a campaign rather than a blank page.

b. Switching campaigns is done by going back to Campaign Orchestration and entering the campaign from there — which the new breadcrumb makes a one-click trip.

c. While the campaign list is still loading, the title area shows the campaign code (or a neutral placeholder) rather than flashing empty.

## 3. Technical notes

- Only `src/pages/CampaignDashboard.tsx` changes. No data-fetch, filter, tab, or metric logic is touched; the `campaigns` query is still needed to resolve the title from the code.
- Unused imports (`Select` pieces, `Loader2`) are removed only if nothing else on the page uses them.
- Verification: browser check on `/campaign-dashboard?campaign=sv-paris-postcards&…` confirming the breadcrumb, title, and `utm_campaign` line render and the dropdown is gone.

## 4. Decision log

This is a new decision document: `docs/decisions/campaigns/2026-07-27_campaign-visibility-header-context_feature-doc_lovable.md`, marked `Status: Approved & Implemented`. It does not update an existing plan.

## What does not change

- Tabs (Scheduler, Real-time Map, Events Listing, Simulator)
- Filters bar, simulation controls, level checkboxes
- Any metric, export, or map behavior
