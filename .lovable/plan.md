

# Open Campaign Detail in New Browser Tab

## Summary

When a user clicks a campaign card (e.g., BUGTEST) on the Campaign Orchestration page, the campaign's detail page (`/campaign/{id}`) opens in a **new browser tab** to the right — not the full campaign list. The current tab stays on Campaign Orchestration.

## Changes

### 1. Card click opens new tab (`src/pages/CampaignManager.tsx`)

a. Line ~812: Change `onClick={() => navigate(\`/campaign/${campaign.id}\`)}` to `onClick={() => window.open(\`/campaign/${campaign.id}\`, '_blank')}`

b. Line ~1090: Change wizard `onSuccess` callback from `navigate(\`/campaign/${campaignId}\`)` to `window.open(\`/campaign/${campaignId}\`, '_blank')` — after creating a campaign, its detail opens in a new tab while the list stays.

### 2. Decision document

a. Create `docs/decisions/campaigns/2026-04-05_campaign-detail-new-tab_feature-doc_lovable.md` recording the UX change.

## Files Changed

- `src/pages/CampaignManager.tsx` — two `navigate()` calls → `window.open(..., '_blank')`
- `docs/decisions/campaigns/2026-04-05_campaign-detail-new-tab_feature-doc_lovable.md` — new

## What Does Not Change

- `CampaignDetail.tsx` — no modifications
- Route definitions in `App.tsx`
- Sidebar navigation

