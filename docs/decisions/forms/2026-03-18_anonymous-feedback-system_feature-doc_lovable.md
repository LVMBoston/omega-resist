# Anonymous Feedback System

**Status:** Approved — Implementation Pending
**Date:** 2026-03-18

---

## Overview

Add anonymous feedback collection triggered by `form_trigger` hotspots on interactive slides. Submitters see a clean 3-step form with no visible context. Token/campaign metadata is captured silently. Administrators view feedback via a new tab on Campaign Detail and a badge on campaign cards. Categories and tags are configurable via the Settings page.

---

## 1. Database Migration

### a. Table: `feedback_submissions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `category` | text NOT NULL | One of the configured categories |
| `tags` | jsonb | Array of selected tag strings |
| `message` | text NOT NULL | Min 10 chars, validated in RPC |
| `contact_email` | text | Optional, nullable |
| `page_url` | text | `window.location.href` |
| `user_agent` | text | `navigator.userAgent` |
| `campaign_code` | text | Silent — from token context |
| `campaign_title` | text | Silent |
| `eoa_id` | uuid | Silent |
| `eoa_title` | text | Silent |
| `mobilize_code` | text | Silent |
| `deck_slug` | text | Silent |
| `token` | text | Silent |
| `token_level` | integer | Silent |
| `l00_instance` | text | Silent |
| `created_at` | timestamptz | `now()` |

### b. RLS

- RLS enabled.
- Admin SELECT only: `has_role(auth.uid(), 'admin')`.
- No public SELECT/UPDATE/DELETE.

### c. RPC: `submit_feedback`

- SECURITY DEFINER, callable by `anon` and `authenticated`.
- Parameters: `_category text`, `_tags jsonb`, `_message text`, `_contact_email text`, `_page_url text`, `_user_agent text`, `_campaign_code text`, `_campaign_title text`, `_eoa_id uuid`, `_eoa_title text`, `_mobilize_code text`, `_deck_slug text`, `_token text`, `_token_level integer`, `_l00_instance text`.
- Validates: `_category` is one of allowed values (queried from `settings`), `_message` length ≥ 10.
- Inserts row, returns new `id`.

### d. RPC: `get_feedback_counts`

- SECURITY DEFINER, admin-only (checks `has_role`).
- Parameter: `_campaign_codes text[]`.
- Returns: `TABLE(campaign_code text, count bigint)`.

### e. Seed Data

Two rows in `settings` table:

| category | key | value | description |
|----------|-----|-------|-------------|
| `feedback` | `categories` | `["General Feedback", "Bug Report", "Feature Request", "Content Issue"]` | Feedback form category options |
| `feedback` | `tags` | `["Urgent", "Positive", "Confusing", "Offensive", "Accessibility"]` | Feedback form tag options |

---

## 2. Snapshot Renderer Fix

Add `"form_trigger"` to the `ACTION_TYPES` exclusion set in `supabase/functions/render-stats-snapshot/index.ts` so feedback hotspots are skipped during static SVG generation (same pattern as other non-visual action types).

---

## 3. FeedbackFormPopover Component

New file: `src/components/FeedbackFormPopover.tsx`

### a. Props

```typescript
interface FeedbackFormPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  viralToken: string | null;
  deckSlug: string;
  anchorPosition: { x: number; y: number }; // hotspot position
}
```

### b. 3-Step Flow

1. **Step 1 — Category & Tags**: Category (radio, required) + optional tags (checkboxes). Options loaded from `useSettings("feedback")` with hardcoded fallback array.
2. **Step 2 — Message & Email**: Textarea (min 10 chars, validated with zod) + optional email input. Back / Submit buttons.
3. **Step 3 — Confirmation**: "Thank you" message with auto-close after 3 seconds.

### c. Silent Context Resolution

On mount, resolve context from `viralToken`:
- Query `tokens` table for `token`, `level`, `l00_instance`, `eoa_id`, `deck_slug`, `utm_campaign`.
- Query `events_actions` for `title`, `mobilize_code`, `campaign_id`.
- Query `campaigns` for `title`, `code`.
- All nulls are acceptable (graceful degradation).

### d. Submission

Calls `supabase.rpc("submit_feedback", { ...formData, ...silentContext })`.
On network failure: inline error message + Retry button (no toast).

---

## 4. InteractiveSlideOverlay Wiring

In `src/components/InteractiveSlideOverlay.tsx`:

### a. State

Add `isFeedbackOpen` boolean state + `feedbackAnchor` position state.

### b. Hotspot Mapping

Map `form_trigger` hotspot type to a button that sets `isFeedbackOpen = true` and captures anchor position.

### c. Carousel Blocking

When `isFeedbackOpen`, disable carousel swiping (same pattern as existing Vimeo `isVideoOpen` logic).

### d. Render

Conditionally render `<FeedbackFormPopover>` when `isFeedbackOpen`.

---

## 5. Admin Reporting

### a. `CampaignFeedback.tsx`

New file: `src/components/CampaignFeedback.tsx`

- Props: `{ campaignId: string }`.
- Queries `feedback_submissions` filtered by campaign code (derived from campaign ID).
- Summary cards: count by category.
- Filterable/sortable table with columns: date, category, tags, message preview, email.
- Expand row to see full message + all silent context fields.
- CSV export button.

### b. CampaignDetail Tab

In `src/pages/CampaignDetail.tsx`:
- Add `"feedback"` to the `activeView` union type.
- Add a "Feedback" button in the tab bar.
- Render `<CampaignFeedback campaignId={campaignId} />` when active.

### c. CampaignManager Badge

In `src/pages/CampaignManager.tsx`:
- Call `supabase.rpc("get_feedback_counts", { _campaign_codes })` alongside existing stats.
- Show `MessageSquare` icon badge on campaign cards where count > 0.

---

## 6. Settings Page — Feedback Tab

### a. Location

New `TabsTrigger` value `"feedback"` in `src/pages/Settings.tsx`.

### b. UI

Chip-style list editors for both `categories` and `tags`:
- Each item rendered as a removable chip/badge.
- Text input + "Add" button to append new items.
- Save button per list (calls `updateSetting` from `useSettings`).

### c. Data Flow

- Reads from `useSettings("feedback")` hook.
- `FeedbackFormPopover` also reads from `useSettings("feedback")` with hardcoded fallback:
  ```typescript
  const categories = getSetting("feedback", "categories")?.value ??
    ["General Feedback", "Bug Report", "Feature Request", "Content Issue"];
  ```

### d. Future Cascade

The `campaign_message_overrides` table and `resolve_message_template` RPC already support per-campaign and per-chapter overrides with `(campaign_id, mobilize_code, category, key)`. In a future version, feedback categories/tags could be overridden per-campaign by inserting rows with `category = 'feedback'` and `key = 'categories'` or `'tags'`. This is architecturally supported but not built in v1.

---

## 7. Implementation Order

1. Database migration (table + RPCs + RLS + settings seed)
2. Snapshot renderer fix (one line addition)
3. `FeedbackFormPopover.tsx` + `InteractiveSlideOverlay` wiring
4. `CampaignFeedback.tsx` + CampaignDetail tab + CampaignManager badge
5. Settings "Feedback" tab

---

## 8. Test Plan

### a. Automated (AI verifies after each step)

1. `submit_feedback` RPC rejects messages < 10 chars.
2. `submit_feedback` RPC rejects invalid category values.
3. `get_feedback_counts` RPC returns correct counts and is admin-only.
4. RLS: anon user cannot SELECT from `feedback_submissions`.
5. Snapshot renderer `ACTION_TYPES` set includes `form_trigger`.

### b. Guided Tour (~5 min, user + AI)

1. Open deck with `?t=` token, swipe to slide with `form_trigger` hotspot.
2. Tap hotspot → overlay opens (no campaign/token context visible to user).
3. Attempt submit with short message → validation error shown.
4. Fill valid category + message → submit → confirmation step shown, auto-closes.
5. Check DB row: silent context columns (`campaign_code`, `eoa_id`, `token`, etc.) are populated.

### c. Admin UI Verification

1. Navigate to Campaign Detail → Feedback tab → table renders with submitted feedback.
2. Campaign Manager → card shows `MessageSquare` badge for campaigns with feedback.
3. Settings → Feedback tab → add/remove category → save → verify `FeedbackFormPopover` reflects change.
