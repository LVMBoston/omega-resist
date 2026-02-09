

# Document: Data Integrity Hardening & Multi-Tenant Vision

## Goal
Create `docs/DATA_INTEGRITY_HARDENING.md` that serves as both a risk register and a design document for protecting campaign data integrity, framed within the planned evolution toward a multi-tenant chapter model.

## Document Structure

### Section 1: Problem Statement
- How administrator edits can silently corrupt campaign data
- Real example: duplicate mobilize_code across decks in BUGTEST campaign
- Real risk: campaign code change orphans all tokens
- CASCADE delete destroying viral lineage permanently

### Section 2: Current Risk Register
A table documenting every dangerous field and action across all forms:
- Campaign: `code` (unprotected), delete (cascade)
- EoA: `mobilize_code`, `utm_id`, `assigned_deck_slug` (partially protected via UI lock), delete (cascade, unprotected)
- Deck: delete (breaks existing token URLs, unprotected)
- Safe fields documented for completeness (title, description, metadata)

### Section 3: Hardening Plan
- Phase 1: Lock campaign code when tokens exist (UI + database trigger)
- Phase 2: Enhanced delete confirmations with token counts and type-to-confirm
- Phase 3: Partial unique constraint on `(campaign_id, mobilize_code)` to prevent deck ambiguity
- Phase 4: Visual conflict detection in EoA table

### Section 4: Multi-Tenant Evolution Context
- Current flat role model (`admin / manager / viewer`)
- Planned chapter-scoped model where mobilize_code/zipcode defines a tenant boundary
- How hardening decisions should be tenant-aware (e.g., constraints scoped to campaign, not global)
- Asset ownership: platform-provided libraries vs. chapter-created campaigns
- Campaign types beyond Samizdat

### Section 5: Future — Backup & Restore
- Placeholder section noting this will be designed separately
- Requirements: per-campaign export preserving token lineage
- Must handle cross-table relationships (tokens, url_events, EoAs)
- Building on existing `exportCampaignData.ts` foundation

## Technical Details

### Source Material
- Risk analysis from prior conversation (form-by-form audit)
- Database schema: `campaigns`, `tokens`, `url_events`, `events_actions` tables
- Existing protections in `EoaForm.tsx` (field locking logic)
- Existing gaps in `CampaignManager.tsx` (no code locking)
- Current role system in `user_roles` table

### File Created
- `docs/DATA_INTEGRITY_HARDENING.md` — single comprehensive document

### No Code Changes
This task creates documentation only. Implementation of the hardening measures will follow as a separate step after review.

