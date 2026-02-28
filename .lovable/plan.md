

# Chapter-Scoped Messaging Templates (with Wizard Forms)

**Status:** Draft -- pending approval
**Date:** 2026-02-28

---

## Summary

Message templates currently resolve from a single global tier (the `settings` table). This plan introduces a **Chapter-level override model** where a "Chapter" is a named grouping of EoAs sharing the same `mobilize_code` within a campaign. Resolution order:

```text
Chapter (mobilize_code) --> Campaign --> Global (settings table)
```

Four template slots are independently overridable at each tier: `email/l00_template`, `email/l01_template`, `sms/l00_template`, `sms/l01_template`.

The plan includes two streamlined wizard forms -- one for campaign creation and one for chapter creation -- so that setting up a campaign with chapters and messaging is as simple as filling out a single form per entity.

---

## 1. Database migration: `campaign_message_overrides` table

a. Create table `campaign_message_overrides`:
   - `id` uuid PK, default `gen_random_uuid()`
   - `campaign_id` uuid NOT NULL, FK to `campaigns.id` ON DELETE CASCADE
   - `mobilize_code` text, nullable (NULL = campaign-level; non-null = chapter-level)
   - `category` text NOT NULL (`'email'` or `'sms'`)
   - `key` text NOT NULL (`'l00_template'` or `'l01_template'`)
   - `value` jsonb NOT NULL
   - `created_at` timestamptz default `now()`
   - `updated_at` timestamptz default `now()`

b. Unique index using `COALESCE` for the nullable `mobilize_code`:
   ```sql
   CREATE UNIQUE INDEX uq_campaign_msg_override
     ON campaign_message_overrides (
       campaign_id,
       COALESCE(mobilize_code, '__campaign__'),
       category,
       key
     );
   ```

c. RLS policies:
   - Admin/manager: ALL (via `has_role`)
   - Public: SELECT (templates must be readable at share-time by unauthenticated viewers)

---

## 2. Database migration: `campaign_type` column on `campaigns`

A cheap, zero-risk hook for future campaign-type differentiation. No UI, no branching logic -- just a column that exists so the second campaign type can be added without a schema migration.

a. Add column:
   ```sql
   ALTER TABLE campaigns
     ADD COLUMN campaign_type text NOT NULL DEFAULT 'samizdat';
   ```

b. All 11 existing campaigns automatically receive `'samizdat'` via the default. No data migration needed.

c. No index required at this time (11 rows; will add when a second type is introduced and filtering matters).

d. **What this column does NOT do in this plan:**
   - No UI element exposes it (wizard hard-codes `'samizdat'` on insert)
   - No code branches on its value
   - No validation constraint beyond NOT NULL + default
   - The `campaign_message_overrides` and `resolve_message_template` logic are already type-agnostic and ignore this column entirely

e. **What this column enables later:**
   - A future plan can add a second value (e.g., `'phonebank'`, `'digital'`) and surface a campaign-type selector in the wizard's Step 1
   - Filtering, dashboards, and type-specific behavior can branch on it without a schema change
   - The cost of adding it now is one column with a default; the cost of adding it later is a migration plus backfill -- trivial either way, but doing it now is free

---

## 3. Database migration: `resolve_message_template` function

a. Single-COALESCE SQL function (STABLE SECURITY DEFINER):
   ```sql
   CREATE OR REPLACE FUNCTION resolve_message_template(
     p_campaign_id uuid,
     p_mobilize_code text,
     p_category text,
     p_key text
   ) RETURNS jsonb AS $$
   SELECT COALESCE(
     (SELECT value FROM campaign_message_overrides
      WHERE campaign_id = p_campaign_id
        AND mobilize_code = p_mobilize_code
        AND category = p_category AND key = p_key),
     (SELECT value FROM campaign_message_overrides
      WHERE campaign_id = p_campaign_id
        AND mobilize_code IS NULL
        AND category = p_category AND key = p_key),
     (SELECT value FROM settings
      WHERE category = p_category AND key = p_key)
   );
   $$ LANGUAGE sql STABLE SECURITY DEFINER;
   ```

b. Performance: three index-only sub-selects, under 1 ms at projected scale.

---

## 4. Impact on existing campaigns and EoAs

This section documents why the changes are purely additive and require zero data migration.

a. **No destructive schema changes to existing tables.** The `campaigns` table gains one column (`campaign_type`) with a default that auto-populates all existing rows. The `events_actions`, `tokens`, and `settings` tables are untouched.

b. **Zero-row starting state.** The new `campaign_message_overrides` table starts empty. With no override rows, `resolve_message_template` always falls through to Tier 3 (the global `settings` value) -- identical to current behavior.

c. **Existing tokens continue to work.** The 692 existing tokens across 11 campaigns will resolve the same global templates they use today. No token re-minting or URL changes required.

d. **Auto-discovery of chapters.** All 46 existing EoAs already have `mobilize_code` values populated. They will automatically appear as grouped chapter cards in the new Chapters tab without any manual migration step.

e. **UTM tracking unaffected.** Token minting, viral chain logic, `utm_content` construction, and event logging are completely outside the scope of this change.

f. **Opt-in granularity.** Overrides only take effect when explicitly created. Campaigns can remain on global defaults indefinitely, or adopt campaign-level overrides, or go further with chapter-level overrides -- all at the operator's discretion.

g. **UI change for campaign creation only.** The Campaign Wizard replaces the existing "Create New" dialog. The existing edit dialog for campaigns remains a simple form. Existing campaigns are managed through the same edit flow as before, plus the new Chapters tab.

---

## 5. Campaign Creation Wizard

Currently, campaign creation is a simple 3-field dialog (code, title, description) in `CampaignManager.tsx`. This will be replaced with a **multi-step wizard dialog**.

a. **Step 1 -- Campaign Identity** (existing fields, unchanged):
   - Code (text, regex-validated)
   - Title (text, required)
   - Description (textarea, optional)
   - `campaign_type` is hard-coded to `'samizdat'` on insert (no UI selector until a second type exists)

b. **Step 2 -- Campaign-Level Messaging (optional)**:
   - Four textarea fields for campaign-level template overrides (email L00, email L01, SMS L00, SMS L01)
   - Each shows the global default as placeholder text
   - All fields are optional -- leaving them blank means the global defaults apply
   - A "Skip" button advances to Step 3 without setting any overrides

c. **Step 3 -- Add First Chapter (optional)**:
   - Prompts: "Add your first chapter now, or skip and add chapters later."
   - If the user chooses to add one, the inline Chapter Creation Form (see Section 6) appears embedded in the wizard
   - A "Skip" button finalizes the campaign without chapters

d. On "Finish," the wizard:
   - Inserts the `campaigns` row (with `campaign_type = 'samizdat'`)
   - Upserts any campaign-level overrides into `campaign_message_overrides`
   - If a chapter was added, inserts the first EoA row(s) and any chapter-level overrides
   - Navigates to the Campaign Detail page

e. Implementation: A new component `CampaignWizard.tsx` replaces the existing inline dialog in `CampaignManager.tsx`. The existing edit dialog remains a simple form (no wizard needed for edits).

---

## 6. Chapter Creation Form (Wizard)

A streamlined form for adding a new chapter to an existing campaign, accessible from the Chapters tab and also embedded in the Campaign Creation Wizard (Step 3).

a. **Chapter Identity fields**:
   - Mobilize Code (text, required -- either fetched via Mobilize API or manually entered)
   - Site Name (text)
   - City (text)
   - State (text)
   - Zip Code (text)
   - Timezone (select)
   - Type (select: canvass, phone_bank, rally, other)
   - End Date/Time (datetime-local)

b. **Messaging fields** (collapsible, optional):
   - Four textarea fields for chapter-level overrides (email L00, email L01, SMS L00, SMS L01)
   - Placeholders show the resolved fallback (campaign override if set, else global)

c. **Auto-fill**: A "Fetch from Mobilize" button (same as existing EoaForm) pre-populates identity fields from the API.

d. On "Save," the form:
   - Inserts an `events_actions` row with the provided fields and `campaign_id`
   - Upserts any chapter-level overrides into `campaign_message_overrides` keyed by `mobilize_code`
   - Refreshes the chapter list

e. Implementation: `ChapterForm.tsx` -- a reusable component used both standalone (in the Chapters tab) and embedded (in the Campaign Wizard Step 3). It shares the same location-group fields as `EoaForm.tsx` but is purpose-built for chapter creation with messaging.

---

## 7. "Chapters" tab on Campaign Detail page

a. Add a third tab value `"chapters"` to `CampaignDetail.tsx`.

b. Component `CampaignChapters.tsx` with:

c. **Campaign-level overrides** (collapsible, at top):
   - Four textarea fields showing global defaults as placeholders
   - Save/Reset buttons upsert/delete rows with `mobilize_code = NULL`

d. **Chapter cards** (auto-discovered by grouping `events_actions` by `mobilize_code`):
   - Chapter name (mobilize_code + city/state of first EoA)
   - EoA count
   - Expandable override textareas with resolved fallback as placeholders
   - Save/Reset per chapter

e. **"Add Chapter" button** at the top opens the Chapter Creation Form (Section 6) in a dialog.

f. EoAs without a `mobilize_code` inherit campaign-level or global defaults only.

---

## 8. Runtime resolution: update `InteractiveSlideOverlay.tsx`

a. Replace the direct `settings` table fetch with calls to `resolve_message_template`.

b. Derive `campaign_id` and `mobilize_code` from the `viralToken`:
   - Look up the token's `eoa_id` from `tokens`
   - Join to `events_actions` for `campaign_id` and `mobilize_code`

c. Backward-compatible: no overrides = global default returned.

---

## 9. Template placeholder support

a. Existing: `{{link}}`.

b. New geographic placeholders substituted at share-time:
   - `{{city}}`, `{{state}}`, `{{site_name}}`

c. Values come from the same query that fetches `campaign_id`/`mobilize_code` (no extra round-trip).

d. If a placeholder's source value is null or empty, it is replaced with an empty string (no literal `{{city}}` visible to the recipient).

---

## 10. Clone support

a. Campaign clone (in `CampaignManager.tsx`) also copies all `campaign_message_overrides` rows, remapping `campaign_id`.

b. The cloned campaign inherits the source's `campaign_type` value (currently always `'samizdat'`).

---

## 11. What does NOT change

- Global Settings page (Email/SMS template tabs) remains the global default tier
- `EoaForm.tsx` continues to exist for editing individual EoA details (not messaging)
- Token minting, viral chain logic, UTM tracking untouched
- `settings` table schema unchanged
- Existing campaigns, EoAs, and tokens require no migration and behave identically until overrides are explicitly created

---

## 12. File inventory

| Action | File |
|--------|------|
| New | `src/components/CampaignWizard.tsx` (multi-step campaign creation) |
| New | `src/components/ChapterForm.tsx` (reusable chapter creation form) |
| New | `src/components/CampaignChapters.tsx` (Chapters tab UI) |
| New | DB migration (table, column, function, RLS) |
| New | `docs/decisions/messaging/2026-02-28_chapter-scoped-messaging_feature-doc_lovable.md` |
| Modified | `src/pages/CampaignManager.tsx` (replace create dialog with wizard; clone overrides) |
| Modified | `src/pages/CampaignDetail.tsx` (add Chapters tab) |
| Modified | `src/components/InteractiveSlideOverlay.tsx` (scoped template resolution) |

---

## 13. Implementation sequence

a. Database migration: create `campaign_message_overrides` table, unique index, RLS, `resolve_message_template` function, and `campaign_type` column on `campaigns`.
b. Build `ChapterForm.tsx` (reusable chapter creation form with identity + messaging fields).
c. Build `CampaignWizard.tsx` (3-step: identity, campaign messaging, first chapter).
d. Wire wizard into `CampaignManager.tsx`, replacing the existing create dialog.
e. Build `CampaignChapters.tsx` with campaign-level overrides, chapter cards, and "Add Chapter" button.
f. Wire the Chapters tab into `CampaignDetail.tsx`.
g. Update `InteractiveSlideOverlay.tsx` for scoped template resolution and geographic placeholders.
h. Update clone logic in `CampaignManager.tsx` to copy overrides.
i. Write decision doc.

---

## 14. Test Plan

### 14A. Automated Tests (Lovable runs these during implementation)

#### 14A-1. Migration verification

a. Confirm `campaign_message_overrides` table exists with 8 correct columns via `information_schema.columns`.

b. Confirm unique index `uq_campaign_msg_override` exists via `pg_indexes`.

c. Confirm RLS is enabled and at least 2 policies exist (admin/manager ALL, public SELECT).

d. Confirm `campaign_type` column exists on `campaigns`:
   ```sql
   SELECT column_name, data_type, column_default, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'campaigns' AND column_name = 'campaign_type';
   ```
   Expected: `text`, default `'samizdat'`, NOT NULL.

e. Confirm all existing campaigns received the default:
   ```sql
   SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE campaign_type = 'samizdat') AS samizdat_count
   FROM campaigns;
   ```
   Expected: `total = samizdat_count`.

#### 14A-2. `resolve_message_template` -- 3-tier fallback

a. Seed: insert a campaign-level override (mobilize_code NULL) and a chapter-level override (mobilize_code = `'falmouth-ma'`).

b. **Tier 1**: call with `mobilize_code = 'falmouth-ma'` -- expect chapter override returned.

c. **Tier 2**: call with `mobilize_code = 'phoenix-az'` (no chapter row) -- expect campaign override returned.

d. **Tier 3**: call with a random `campaign_id` (no rows at all) -- expect global `settings` value returned.

e. Cleanup: delete seeded rows.

#### 14A-3. Backward compatibility of existing data

a. Pick an existing campaign ID. Call `resolve_message_template` with it and any `mobilize_code`. Confirm the result matches the global `settings` value (since no overrides exist yet).

b. Verify no rows exist in `campaign_message_overrides`:
   ```sql
   SELECT COUNT(*) FROM campaign_message_overrides;
   ```
   Expected: 0 (confirming purely additive, no auto-seeded data).

#### 14A-4. Campaign Wizard UI

a. Navigate to `/campaign-config`, click "Create Campaign".
b. Verify 3-step wizard renders.
c. Fill Step 1, advance. Verify Step 2 shows textareas with global defaults as placeholders.
d. Skip Steps 2 and 3. Verify campaign row inserted with `campaign_type = 'samizdat'` and zero override rows created.

#### 14A-5. Chapter Form + Chapters tab

a. Navigate to `/campaign/<id>`, click "Chapters" tab.
b. Click "Add Chapter", fill identity + SMS L00 override. Save.
c. Verify 1 override row created with correct `mobilize_code`.
d. Click "Reset to default". Verify override row deleted.

#### 14A-6. Existing EoA auto-discovery

a. Navigate to Chapters tab for a campaign with existing EoAs.
b. Verify chapter cards appear grouped by `mobilize_code` without any manual action.
c. Verify expanding a card shows empty override fields (no overrides exist yet) with global defaults as placeholders.

#### 14A-7. Runtime resolution in InteractiveSlideOverlay

a. Insert a chapter-level override for a known EoA's `mobilize_code`.
b. Open deck viewer with a token for that EoA.
c. Click SMS share. Verify pre-filled body matches the chapter override with placeholders substituted.
d. Clean up override row.

#### 14A-8. Clone support

a. Clone a campaign that has override rows.
b. Verify cloned campaign has the same count of override rows with the new `campaign_id`.
c. Verify cloned campaign has `campaign_type = 'samizdat'`.

---

### 14B. Manual Test Checklist (for the project owner)

#### Prerequisites
- [ ] Logged in as admin
- [ ] At least one campaign exists with EoAs that have `mobilize_code` set
- [ ] Global SMS/email templates exist in Settings

#### Campaign Wizard

- [ ] B-1. Go to Campaign Orchestration, click "Create Campaign"
- [ ] B-2. Confirm wizard shows Step 1 (code, title, description)
- [ ] B-3. Fill identity fields, click Next
- [ ] B-4. Confirm Step 2 shows 4 message override textareas with placeholder text matching the global defaults from Settings
- [ ] B-5. Enter a custom SMS L00 body (e.g., "You got this at {{city}}! Share: {{link}}")
- [ ] B-6. Click Next. Confirm Step 3 shows "Add your first chapter" option
- [ ] B-7. Click Skip. Confirm campaign is created
- [ ] B-8. Navigate to the new campaign's Chapters tab
- [ ] B-9. Confirm the campaign-level SMS L00 override shows your custom text (not the global default)

#### Chapter Creation

- [ ] B-10. On the Chapters tab, click "Add Chapter"
- [ ] B-11. Enter a mobilize_code (e.g., `falmouth-ma`), city (`Falmouth`), state (`MA`)
- [ ] B-12. Expand the messaging section. Confirm placeholders show the campaign-level override from B-5
- [ ] B-13. Enter a chapter-specific SMS L00 body (e.g., "Picked up on Cape Cod! Share: {{link}}")
- [ ] B-14. Save. Confirm the chapter card appears with "Falmouth, MA" and 1 EoA

#### Inheritance Verification

- [ ] B-15. Add a second chapter (`phoenix-az`, city: `Phoenix`, state: `AZ`) WITHOUT any message overrides
- [ ] B-16. Mint an L00 token for the `falmouth-ma` EoA
- [ ] B-17. Open the deck URL with that token. Click SMS share
- [ ] B-18. Confirm the SMS body says "Picked up on Cape Cod!" (chapter override)
- [ ] B-19. Mint an L00 token for the `phoenix-az` EoA
- [ ] B-20. Open the deck URL with that token. Click SMS share
- [ ] B-21. Confirm the SMS body says "You got this at Phoenix!" (campaign override with `{{city}}` substituted)
- [ ] B-22. Delete the campaign-level SMS L00 override (use "Reset to default" on Chapters tab)
- [ ] B-23. Open the `phoenix-az` deck URL again, click SMS share
- [ ] B-24. Confirm the SMS body now shows the global default from Settings

#### Existing Campaign Backward Compatibility

- [ ] B-25. Open any pre-existing campaign's Chapters tab
- [ ] B-26. Confirm existing EoAs appear as auto-discovered chapter cards (no manual setup needed)
- [ ] B-27. Confirm override fields are empty with global defaults shown as placeholders
- [ ] B-28. Open a pre-existing token's deck URL, click SMS share
- [ ] B-29. Confirm the share text matches the global default (unchanged from before the feature was deployed)

#### Clone

- [ ] B-30. Clone a campaign that has both campaign-level and chapter-level overrides
- [ ] B-31. Open the cloned campaign's Chapters tab
- [ ] B-32. Confirm overrides were copied to the clone

#### Edge Cases

- [ ] B-33. Create an EoA without a `mobilize_code`. Confirm it does NOT appear as a chapter card, and its share uses campaign-level or global defaults
- [ ] B-34. Enter `{{city}}` in a template for an EoA that has no city set. Confirm `{{city}}` is replaced with empty string (no literal `{{city}}` visible to the recipient)

