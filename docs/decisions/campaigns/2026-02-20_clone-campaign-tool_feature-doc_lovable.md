# Clone Campaign Tool

- **Date**: 2026-02-20
- **Author**: Lovable
- **Project Area**: Campaigns
- **Related Feature**: Campaign Manager (`/campaigns`)

## Summary

The Clone Campaign Tool duplicates a campaign and all its associated Events/Actions (EoAs) into a new campaign with a generated code and title. It provides a fast way to set up a structurally identical campaign without re-entering EoA data.

## Context

Campaigns often share the same structure — identical EoAs with the same mobilize codes, deck assignments, and UTM configurations. Manually recreating these is tedious and error-prone. Cloning automates the structural copy while keeping the new campaign's analytics slate clean.

## How It Works

1. **Trigger** — user clicks "Clone" on a campaign card in the Campaign Manager.
2. **Defaults** — a confirmation dialog pre-fills:
   - **Code**: `{original-code}-clone`
   - **Title**: `{original-title} clone`
   - Both are editable before confirming.
3. **Campaign row insert** — a new row is inserted into `campaigns` with the clone code, title, and the original's `description`.
4. **EoA duplication** — all `events_actions` rows where `campaign_id = original.id` are fetched. For each row, a copy is inserted with:
   - `campaign_id` → new campaign's ID
   - `id`, `created_at`, `updated_at` → generated fresh by the database
   - All other fields preserved as-is: `type`, `title`, `description`, `utm_id`, `mobilize_id`, `mobilize_code`, `site_name`, `city`, `state`, `zip_code`, `timezone`, `assigned_deck_slug`, `start_date`, `end_date`, `utm_content`
5. **Refresh** — the campaign list reloads to show the new clone.

## What Is NOT Copied

| Data | Reason |
|------|--------|
| `tokens` | The clone starts with zero virality history |
| `shortened_urls` | New QR codes / short links must be minted separately |
| `url_events` / click data | Analytics belong to the original campaign |
| `daily_aggregates` | Derived data; will be generated as the clone accumulates activity |
| `deck_eoa_assignments` | Version-pinned assignments are not carried over |

## Validation

- The clone code is validated against the existing campaign code schema: lowercase letters, numbers, hyphens, and underscores only.
- If a code collision occurs, the insert will fail and the user is prompted to choose a different code.

## Schema Changes

None. The tool operates entirely within the existing `campaigns` and `events_actions` tables.

## References

- `src/pages/CampaignManager.tsx` — clone logic and UI (Clone button on campaign cards)
