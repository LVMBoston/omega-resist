
# Plan: "Deploy Template to Campaigns" Feature

## Overview

Add a "Deploy to Campaigns" button in the Data Template Editor that triggers server-side snapshot rendering for all campaigns currently using the template. This complements the Phase 3 scheduled refresh by giving administrators immediate control after making template design changes.

---

## Architecture

```text
+---------------------------+
|  Data Template Editor     |
|  (DataTemplateEditor.tsx) |
+---------------------------+
            |
            | Click "Deploy to {N} Campaigns"
            v
+---------------------------+
|  New Edge Function:       |
|  deploy-template-snapshots|
+---------------------------+
            |
            | For each campaign using template
            v
+---------------------------+
|  Existing Edge Function:  |
|  render-stats-snapshot    |
+---------------------------+
            |
            v
+---------------------------+
|  slide-snapshots bucket   |
|  {template_id}/           |
|    snapshot-{campaign}.png|
+---------------------------+
```

---

## Data Relationship Discovery

The system already tracks template-to-campaign relationships through existing tables:

| Table | Role |
|-------|------|
| `viral_slide_configs` | Stores templates (template_id) |
| `slide_items` | Links templates to decks via `template_id` and `deck_slug` |
| `events_actions` | Links decks to campaigns via `assigned_deck_slug` and `campaign_id` |
| `campaigns` | Campaign details including `snapshot_enabled` flag |

The query to find all campaigns using a template:
```sql
SELECT DISTINCT c.id, c.code, c.title, c.snapshot_enabled
FROM campaigns c
JOIN events_actions ea ON ea.campaign_id = c.id
JOIN slide_items si ON si.deck_slug = ea.assigned_deck_slug
WHERE si.template_id = '{template_id}'
```

Current data shows templates are shared across campaigns:
- "Map Test 2" template is used by 4 campaigns
- "Samizdat Template-1" template is used by 3 campaigns

---

## Component 1: Campaign Count Query Hook

A new React Query hook that fetches campaigns using a specific template.

Location: `src/hooks/useTemplateCampaigns.ts`

Responsibilities:
- Query the template-to-campaign relationship
- Return campaign count and list
- Filter by `snapshot_enabled` status if desired
- Provide loading state for UI feedback

---

## Component 2: Deploy Button in Data Template Editor

Update `DataTemplateEditor.tsx` to add a "Deploy to {N} Campaigns" button.

UI Specifications:
- Position: In the action button row, next to "Server Refresh"
- Color: Purple/violet to distinguish from other actions
- Icon: `Rocket` or `Send` from lucide-react
- Label: Dynamic - shows campaign count (e.g., "Deploy to 4 Campaigns")
- Disabled state: When template is unsaved or no campaigns use it
- Loading state: Shows spinner during deployment

Behavior:
1. On click, call new `deploy-template-snapshots` edge function
2. Show progress toast with campaign count
3. On success, update `lastServerRefreshAt` for all campaigns
4. On error, show which campaigns failed

---

## Component 3: New Edge Function (`deploy-template-snapshots`)

A new orchestrator function that renders snapshots for all campaigns using a template.

Location: `supabase/functions/deploy-template-snapshots/index.ts`

Request Body:
```json
{
  "template_id": "uuid",
  "only_enabled": false  // Optional: only deploy to snapshot_enabled campaigns
}
```

Logic:
1. Query campaigns using the template (via slide_items + events_actions join)
2. For each campaign, call the render-stats-snapshot function internally
3. Collect results (success/failure for each campaign)
4. Return summary

Response:
```json
{
  "success": true,
  "campaigns_found": 4,
  "campaigns_rendered": 4,
  "campaigns_failed": 0,
  "results": [
    { "campaign_code": "res-sis", "status": "success", "public_url": "..." },
    { "campaign_code": "bugtest", "status": "success", "public_url": "..." }
  ]
}
```

---

## Component 4: Storage Path Update

The existing `render-stats-snapshot` function stores snapshots at `{template_id}/latest.png`, which overwrites when multiple campaigns use the same template.

Change Required:
- Update storage path to: `{template_id}/snapshot-{campaign_code}.png`
- Update `cached_snapshot_path` field accordingly
- Ensure frontend components read from the campaign-specific path

This change is necessary for both the Deploy feature and Phase 3 scheduled refresh.

---

## User Workflow

1. Admin opens Data Template Editor
2. Makes design changes (repositions hotspots, changes styling)
3. Clicks "Save Template" to persist changes
4. Sees "Deploy to 4 Campaigns" button become active
5. Clicks Deploy button
6. Sees toast: "Deploying snapshots to 4 campaigns..."
7. On success, sees: "Successfully deployed to 4 campaigns"
8. All campaign decks now show updated snapshot with new design

---

## Relationship to Phase 3 (Scheduled Refresh)

| Trigger | Purpose | When Used |
|---------|---------|-----------|
| Deploy Button | Immediate update after design changes | Admin edits template layout/styling |
| Scheduled Refresh | Automatic metric updates | Cron job when campaign has new activity |
| Server Refresh (existing) | Single campaign update | Testing/debugging single campaign |

The Deploy feature handles structural/design changes while the scheduled refresh handles ongoing metric freshness.

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Template not saved yet | Deploy button disabled with tooltip |
| No campaigns use template | Button shows "No campaigns using template" |
| Some campaigns fail rendering | Return partial success with details |
| Template has no stats_page type | Feature only available for Data templates |
| Concurrent deploys | Edge function processes sequentially to avoid overload |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/hooks/useTemplateCampaigns.ts` | Create - hook to fetch campaigns using a template |
| `src/components/DataTemplateEditor.tsx` | Modify - add Deploy button and logic |
| `supabase/functions/deploy-template-snapshots/index.ts` | Create - new orchestrator function |
| `supabase/functions/render-stats-snapshot/index.ts` | Modify - update storage path to include campaign code |
| `supabase/config.toml` | Modify - add deploy-template-snapshots function config |

---

## Future Enhancement: Activity-Based Refresh Integration

This Deploy feature can later be combined with Phase 3 to create the "watcher" behavior you described:

1. A scheduled job monitors `url_events` for new activity
2. When activity is detected for a campaign with `snapshot_enabled = true`, it triggers render-stats-snapshot
3. The Deploy button remains available for immediate design-change deployments
4. The "Latest Active" timestamp naturally updates as events flow in, serving as the activity indicator without needing explicit polling

This hybrid approach ensures:
- Design changes deploy immediately via Deploy button
- Metric updates happen automatically via scheduled refresh
- Quiet campaigns don't waste resources
- Active campaigns stay fresh
