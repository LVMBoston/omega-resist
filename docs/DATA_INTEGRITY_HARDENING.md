# Data Integrity Hardening & Multi-Tenant Vision

## 1. Problem Statement

Administrator edits to campaign configuration can silently corrupt tracking data. The system stores key identifiers (campaign code, UTM parameters, deck slug) inside tokens at mint time. These values are **never updated retroactively** — they become the permanent identity of every token in the viral chain. Changing the source field after minting orphans all existing tokens.

### Real-World Failure Modes

**Campaign code change orphans all tokens.**
Every token stores `utm_campaign = campaigns.code` at mint time. If an admin renames a campaign's code from `bugtest` to `bugtest-v2`, all existing tokens still carry `utm_campaign = "bugtest"`. Dashboard queries joining on `campaigns.code` return zero results. The campaign appears empty despite hundreds of minted tokens.

**Duplicate `mobilize_code` across decks creates metric ambiguity.**
In the BUGTEST campaign, the same `mobilize_code` was assigned to EoAs pointing at different decks. L00 tokens minted from these EoAs share the same UTM fingerprint but resolve to different content. Analytics cannot distinguish which deck drove engagement.

**CASCADE delete destroys viral lineage permanently.**
`tokens.eoa_id` has `ON DELETE CASCADE`. Deleting an EoA instantly and permanently destroys every token (L00 through L03), every `url_event` (scans, views, shares), and the entire parent→child lineage graph. Lovable Cloud does not provide point-in-time recovery. The data is gone.

**Deck deletion breaks existing URLs.**
Tokens store `deck_slug` at mint time. Deleting a deck does not delete tokens, but anyone scanning a QR code linked to that deck gets a 404.

---

## 2. Current Risk Register

### Dangerous Fields (change breaks existing tokens)

| Entity | Field | Risk | Current Protection |
|--------|-------|------|--------------------|
| Campaign | `code` | 🔴 CATASTROPHIC — orphans all tokens | ❌ None |
| EoA | `mobilize_code` | 🔴 CATASTROPHIC — breaks L00 token identity | 🔒 UI lock when tokens exist |
| EoA | `utm_id` | 🔴 CATASTROPHIC — breaks UTM attribution | 🔒 UI lock when tokens exist |
| EoA | `assigned_deck_slug` | 🟠 HIGH — new tokens go to different deck | 🔒 UI lock when tokens exist |

### Dangerous Actions (permanent data loss)

| Entity | Action | Risk | Current Protection |
|--------|--------|------|--------------------|
| EoA | Delete | 🔴 CATASTROPHIC — CASCADE destroys all tokens + events | ❌ Basic confirm dialog |
| Campaign | Delete | 🔴 CATASTROPHIC — CASCADE destroys all EoAs → tokens → events | ❌ Basic confirm dialog |
| Deck | Delete | 🟠 HIGH — existing token URLs return 404 | ❌ Basic confirm dialog |

### Safe Fields (change has no tracking impact)

| Entity | Fields | Notes |
|--------|--------|-------|
| Campaign | `title`, `description`, `display_order`, `snapshot_*` | Display/config only |
| EoA | `title`, `description`, `site_name`, `city`, `state`, `zip_code`, `timezone`, `type`, `end_date` | Metadata only; not embedded in tokens |
| Deck | `display_order` | Slug is immutable by convention |

### Existing Protections

The `EoaForm.tsx` component queries for tokens associated with the EoA. When `hasMintedToken = true`, the three critical fields (`mobilize_code`, `utm_id`, `assigned_deck_slug`) are rendered as disabled inputs with a Lock icon and an amber warning alert. This is **UI-only** — there is no database trigger or constraint preventing a direct API call from changing these values.

---

## 3. Hardening Plan

### Phase 1: Lock Campaign Code

**Goal**: Prevent `campaigns.code` from being changed once any token references it.

**UI**: In `CampaignManager.tsx`, query token count where `utm_campaign = campaign.code`. If > 0, disable the `code` input and show the same amber lock warning used in `EoaForm.tsx`.

**Database safety net**: Add a trigger on `campaigns` that raises an exception if `OLD.code != NEW.code` and tokens exist with `utm_campaign = OLD.code`.

```sql
CREATE FUNCTION prevent_campaign_code_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.code != NEW.code THEN
    IF EXISTS (SELECT 1 FROM tokens WHERE utm_campaign = OLD.code LIMIT 1) THEN
      RAISE EXCEPTION 'Cannot change campaign code: % tokens exist with utm_campaign = %',
        (SELECT COUNT(*) FROM tokens WHERE utm_campaign = OLD.code), OLD.code;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_campaign_code_change
BEFORE UPDATE ON campaigns
FOR EACH ROW EXECUTE FUNCTION prevent_campaign_code_change();
```

### Phase 2: Enhanced Delete Confirmations

**Goal**: Make destructive deletes impossible to perform accidentally.

For EoA and Campaign delete:
1. Query token count before showing the dialog.
2. If tokens > 0, display: _"This will permanently destroy {N} tokens and all associated tracking data. This cannot be undone."_
3. Require typing `DELETE` to confirm.
4. Consider offering "Archive" (soft delete via `deleted_at` timestamp) as an alternative.

For Deck delete:
1. Query tokens referencing this `deck_slug`.
2. If tokens exist, warn: _"{N} existing QR codes link to this deck. Deleting it will cause 404 errors for anyone who scans them."_

### Phase 3: Unique Constraint on mobilize_code

**Goal**: Prevent the same `mobilize_code` from being assigned to multiple EoAs within a campaign, which creates metric ambiguity.

```sql
CREATE UNIQUE INDEX idx_unique_mobilize_code_per_campaign
ON events_actions (campaign_id, mobilize_code)
WHERE mobilize_code IS NOT NULL;
```

This is a partial unique index — it only applies when `mobilize_code` is not null, allowing EoAs without a mobilize code to coexist freely.

> **Pre-requisite (✅ completed 2026-02-20)**: The global `UNIQUE (mobilize_code, utm_id)` constraint was replaced with a campaign-scoped partial unique index:
> ```sql
> CREATE UNIQUE INDEX idx_unique_mobilize_utm_per_campaign
> ON events_actions (campaign_id, mobilize_code, utm_id)
> WHERE mobilize_code IS NOT NULL;
> ```
> This enables campaign cloning to preserve identical `utm_id` values across campaigns. See `docs/decisions/campaigns/2026-02-20_clone-campaign-tool_feature-doc_lovable.md`.

### Phase 4: Visual Conflict Detection

**Goal**: Surface `mobilize_code` conflicts in the EoA table before they cause problems.

In the EoA management table, highlight rows where `mobilize_code` is duplicated within the same campaign. Show a warning icon with tooltip explaining the conflict.

---

## 4. Multi-Tenant Evolution Context

### Current State: Flat Role Model

The system currently uses a single `user_roles` table with three roles:

| Role | Permissions |
|------|-------------|
| `admin` | Full CRUD on all entities |
| `manager` | CRUD on decks, slides, EoAs; read on campaigns |
| `viewer` | Read-only on most entities |

RLS policies use `has_role(auth.uid(), 'admin'::app_role)` — a global check with no scoping.

### Planned Evolution: Chapter-Scoped Tenancy

The platform will evolve to support multiple grassroots chapters, each identified by a geographic boundary (mobilize code / zip code). The envisioned model:

**Chapter**: A local organizing unit (e.g., a zip code region). Each chapter can:
- Create campaigns from platform-provided templates
- Customize decks using shared asset libraries
- View their own campaign analytics
- Cannot see or modify other chapters' data

**Platform**: The infrastructure layer that provides:
1. **Campaign types** — Samizdat (anonymous literature distribution) is the first; others will follow
2. **Asset libraries** — Curated slide decks, templates, and viral slide configs that chapters can fork
3. **Viral tracking infrastructure** — The token/event pipeline, privacy-first by design

### Impact on Hardening Design

All hardening constraints should be **scoped to campaign, not global**:
- The unique constraint on `mobilize_code` is per-campaign, not system-wide ✅
- Campaign code uniqueness is already global (it's a URL slug) and should remain so
- Delete protections check tokens within the campaign/EoA scope

Future RLS policies will shift from:
```sql
-- Current: flat role check
has_role(auth.uid(), 'admin'::app_role)
```

To a chapter-scoped model:
```sql
-- Future: chapter-scoped role check
has_chapter_role(auth.uid(), chapter_id, 'organizer'::chapter_role)
```

### Asset Ownership Model

| Asset Type | Owner | Chapter Access |
|------------|-------|----------------|
| Campaign types | Platform | Read-only |
| Slide libraries | Platform | Fork / customize |
| Campaigns | Chapter | Full CRUD within chapter |
| EoAs | Chapter | Full CRUD within chapter |
| Tokens | System | Read-only (minted by pipeline) |
| Analytics | System | Read within chapter scope |

### Campaign Types Beyond Samizdat

The Samizdat campaign type (anonymous literature distribution via QR → deck → viral share) is the first implementation. The platform is designed to support additional campaign types that share the same viral tracking infrastructure but differ in:
- Content format (not just slide decks)
- Distribution method (not just QR codes)
- Engagement model (not just view → share)

The token/event schema is intentionally generic to accommodate this evolution.

---

## 5. Future — Backup & Restore

> **Status**: Design placeholder. Implementation will follow as a separate effort after hardening is complete.

### Requirements

1. **Per-campaign export** that preserves:
   - All EoAs for the campaign
   - All tokens (L00 through L03) with parent/child relationships intact
   - All `url_events` with UTM snapshots
   - Viral lineage graph (`parent_token` → `root_token` chains)

2. **Cross-table relationship preservation**:
   - `tokens.eoa_id` → `events_actions.id`
   - `tokens.parent_token` → `tokens.token`
   - `tokens.root_token` → `tokens.token`
   - `url_events.token` → `tokens.token`

3. **Import/restore** must:
   - Re-create EoAs with new UUIDs but preserve token strings (since QR codes in the wild reference them)
   - Maintain the `parent_token` / `root_token` graph
   - Not trigger re-minting (see constraint: token-reminting-avoidance)

4. **Building on existing foundation**:
   - `src/lib/exportCampaignData.ts` already exports campaign data
   - Restore functionality needs a matching import pipeline
   - Consider JSON export format with embedded relationship map

### Non-Requirements (for now)
- Cross-campaign restore (tokens reference a single campaign)
- Incremental backup (full export per campaign is sufficient at current scale)
- Automated scheduled backups (manual trigger is acceptable initially)
