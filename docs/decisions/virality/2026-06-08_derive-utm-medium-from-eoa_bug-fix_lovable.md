# Derive utm_medium from EoA instead of hard-coding "qr"

**Status: Approved & Implemented**
**Date: 2026-06-08**

## Problem (what the user saw)

Every L00 seed URL minted in the app embedded `utm_medium=qr`, even when the
event/action was clearly an email or SMS channel (e.g. `utm_id=email`,
`utm_content=…-email`). That made campaign-origin reporting wrong everywhere —
all opens looked like QR scans.

## Root cause

The `mint_l00` Postgres function accepts any string for `_utm_medium` and
defaults to `'qr'`. Every caller in the app hard-coded `utmMedium: "qr"` at
mint time. The DB wasn't the problem; the callers were.

## Fix

### 1. New helper

`src/lib/virality/deriveUtmMedium.ts` exports `deriveUtmMedium(eoa)` returning
one of `qr | em | sms | tx | social | p2p | fb | bs | li | x`. Resolution
order:

1. Exact-match keyword on `utm_id`.
2. Substring/word-boundary match for the same keywords.
3. Fallback `qr` so unclassifiable rows preserve prior behavior.

Covered by `src/lib/virality/deriveUtmMedium.test.ts` (Vitest), including real
samples pulled from production: `rs1-text`, `tst-mail`, `rsg1_qr`, etc.

### 2. Call sites updated

| File | Sites |
|------|-------|
| `src/pages/CampaignEoaManager.tsx` | single Generate, Generate All, Bulk Generate Selected |
| `src/pages/CampaignManager.tsx` | campaign deploy, per-deck deploy (fetches `utm_id` first) |
| `src/pages/DeckEditor.tsx` | post-edit redeploy; `affectedEoas` shape extended with `utm_id` |

### 3. Intentionally kept on `qr`

- `src/pages/RepointQrTool.tsx` — QR-specific tool by definition.
- `src/components/SimulatorControls.tsx`, `src/pages/Simulator.tsx` — synthetic
  test traffic; changing them would muddy fixture data.

### 4. UI affordance

The Campaign EoA Manager row shows a small `via <medium>` badge next to the
"Generate L00 Token" button (and surfaces it in the tooltip). This makes the
derived channel visible *before* mint, so mis-classified `utm_id` values can
be corrected first.

### 5. Back-fix for existing tokens

Migration adds two SQL functions:

- `derive_utm_medium(_utm_id text)` — server-side mirror of the TS helper.
- `recompute_l00_utm_medium(_campaign_code text DEFAULT NULL, _dry_run boolean DEFAULT true)` —
  admin/manager only. Returns one row per L00 whose stored medium differs from
  the derived medium: `token, eoa_id, utm_campaign, mobilize_code, utm_id,
  old_medium, new_medium, short_urls_updated, applied`.

When `_dry_run = false`, for each differing row it updates **in place**:

1. `tokens.utm_medium`
2. `tokens.full_url` — `utm_medium=…` query segment rewritten via `regexp_replace`.
3. `shortened_urls.full_url` — same rewrite for any short URL whose stored long
   URL contains `t=<token>`.

Token strings are **never** changed → lineage, parent/child chains, all
`url_events` history, printed QR codes, and existing short codes keep working.
Only `level = 0` rows are touched; viral shares (L01–L03) already have correct
mediums via `mint_share`.

### 6. UI for the back-fix

`src/components/RecomputeUtmMediumDialog.tsx` wired into the EoA Manager
toolbar as a "Fix channels" button (admin/manager). Always opens in dry-run
mode, shows a diff table, and only writes after explicit Apply. Re-runnable
and idempotent.

## Files

- new: `src/lib/virality/deriveUtmMedium.ts`
- new: `src/lib/virality/deriveUtmMedium.test.ts`
- new: `src/components/RecomputeUtmMediumDialog.tsx`
- edit: `src/pages/CampaignEoaManager.tsx`
- edit: `src/pages/CampaignManager.tsx`
- edit: `src/pages/DeckEditor.tsx`
- migration: `derive_utm_medium`, `recompute_l00_utm_medium`

## Recovery / operator instructions

1. On the affected campaign page, open **Fix channels** → **Preview changes**.
2. Review the diff. Any row with the wrong `utm_id` itself (e.g. unclassifiable
   slugs that fell back to `qr`) should have its `utm_id` corrected first.
3. Click **Apply**. Idempotent — safe to re-run after correcting EoA data.

## What did not change

- Database schema, RLS, or any token format.
- `mint_l00` / `mint_share` RPC signatures or behavior.
- Short URL codes (the `/r/abc123` strings) — only the resolved long URL is
  rewritten.
