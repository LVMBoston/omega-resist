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

## Update — 2026-04-05 (2)

### Campaign summary card banner on CampaignDetail

Added a campaign summary card at the top of `/campaign/{id}` so users arriving from a new-tab click see the campaign identity (title, code, description) and key stats before the EoA/chapters/config tabs.

#### Change (`src/pages/CampaignDetail.tsx`)

- Replaced the bare `<h1>` heading with a `<Card>` that mirrors the campaign card style from `/campaign-config`.
- Card displays: title, `utm_campaign` code, description, EoA count badge, and live stats (data rows, viral depth, earliest/latest active) fetched via `get_campaign_stats` RPC.
- Tabs (Events/Actions, Chapters, Campaign Config) remain below the card unchanged.
- This gives users arriving from the Template Repository or Campaign Orchestration page a clear sense of which campaign they're working on before diving into details.

## Update — 2026-04-05 (3)

### Breadcrumb trails on DeckEditor and TemplateEditorPage

Extended the breadcrumb navigation pattern (established on `CampaignDetail`) to two additional detail pages for consistent hierarchy.

#### Changes

- **`src/pages/DeckEditor.tsx`**: Replaced the back-arrow button and `<h1>Editing Deck: {slug}</h1>` with a breadcrumb trail: **Deck Management** (`/deck-management`) > **{slug}**.
- **`src/pages/TemplateEditorPage.tsx`**: Replaced the back-arrow button and header title with a breadcrumb trail: **Template Repository** (`/interactive-templates`) > **{template name | "New Template"}**.
- Removed unused `ArrowLeft` icon imports from both files.
