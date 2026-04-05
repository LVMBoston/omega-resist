# Open Campaign Detail in New Browser Tab

**Date:** 2026-04-05  
**Status:** Approved & Implemented  
**Author:** lovable  
**Project Area:** campaigns  

## Summary

When a user clicks a campaign card on the Campaign Orchestration page (`/campaign-config`), the selected campaign's detail page opens in a **new browser tab** to the right. The campaign list remains in the current tab.

## Rationale

Previously, clicking a campaign card navigated within the same tab, which was confusing — users lost their place in the campaign list. Opening in a new tab keeps the list accessible and lets users work on a specific campaign without losing context.

## Changes

### 1. Card click opens new tab (`src/pages/CampaignManager.tsx`)

- Changed `onClick={() => navigate(...)}` to `onClick={() => window.open(..., '_blank'))` on campaign cards.

### 2. Wizard success opens new tab (`src/pages/CampaignManager.tsx`)

- Changed `CampaignWizard` `onSuccess` callback to use `window.open(..., '_blank')` so newly created campaigns also open in a new tab.

## What Does Not Change

- `CampaignDetail.tsx` — no modifications
- Route definitions in `App.tsx`
- Sidebar navigation
- Any other navigation patterns in the app

## Update — 2026-04-05

### Campaign Usage dialog on `/interactive-templates`

Extended the new-tab pattern to the "Campaigns using: {name}" dialog on the Interactive Template Repository page.

#### Change (`src/pages/InteractiveTemplates.tsx`)

- Made each campaign `Card` in the Campaign Usage dialog clickable with `onClick={() => window.open(\`/campaign/${campaign.id}\`, '_blank'))`
- Added `cursor-pointer` and `hover:bg-accent/50` styling for visual affordance.
- The dialog remains open in TAB-1; the selected campaign's detail page opens in TAB-2.
