
# Add Diagnostic Info to Server-Side Rendering Section

## What This Does
Below each Data Template card in the Server-Side Rendering section of `/campaign-dashboard`, display the resolved context for the currently selected campaign:

- **Current Campaign**: The campaign code (e.g., `bugtest-v2`)
- **Deck name (incl. instance)**: The deck slug and mobilize code from `events_actions` (e.g., `data-template-test / Z02556`)
- **viralToken**: A sample L00 token for that campaign+mobilize code (e.g., `l00-Z02556-qr`)
- **URL to view current PNG**: A clickable link to the snapshot image in storage (e.g., `https://wznilzguqjwvkysuleta.supabase.co/storage/v1/object/public/slide-snapshots/{templateId}/snapshot-{campaignCode}.png`)

## File Changed

**`src/components/CampaignSnapshotSettings.tsx`**

### 1. Expand the templates query
The existing query fetches all `stats_page` templates globally. We'll add a second query (or join) that, for the currently selected `campaignCode`, resolves:
- The deck slug and mobilize code via: `slide_items` (template_id -> deck_slug) then `events_actions` (assigned_deck_slug + campaign match)
- A sample L00 token via: `tokens` table filtered by `utm_campaign = campaignCode` and `level = 0`

### 2. Add a new query for per-template campaign context
For each template, query:
```
slide_items (template_id) -> events_actions (assigned_deck_slug, campaign) -> tokens (utm_campaign, level=0)
```
This will be a single query that joins `slide_items` to `events_actions` filtered by the current campaign, then grabs a sample token.

### 3. Render diagnostic block below each template card
Below the existing template name + status badge + Render button, add a small `text-xs text-muted-foreground` block showing:
```
Current Campaign: bugtest-v2
Deck name (incl. instance): data-template-test / Z02556  
viralToken: l00-Z02556-qr
URL to view current PNG: [clickable link]
```

The PNG URL follows the established pattern:
`{VITE_SUPABASE_URL}/storage/v1/object/public/slide-snapshots/{templateId}/snapshot-{campaignCode}.png`

### 4. Make the PNG URL a clickable link
The URL will be an `<a>` tag with `target="_blank"` so admins can open the snapshot directly in a new tab to visually verify it.

## Technical Details

- The `campaignCode` prop is already passed to `CampaignSnapshotSettings` -- we just need to use it more
- Add a `useQuery` that fetches `slide_items` joined with `events_actions` for the selected campaign, grouped by template_id
- For the token, query `tokens` table with `utm_campaign = campaignCode` and `level = 0`, limit 1 per mobilize_code
- The PNG URL is deterministic from `templateId` + `campaignCode`, no query needed
- All new UI is read-only diagnostic info -- no new mutations or state changes
