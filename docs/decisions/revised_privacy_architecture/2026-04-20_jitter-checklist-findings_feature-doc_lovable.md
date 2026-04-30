---
Status: Approved & Archived (findings only — implementation pending)
Date: 2026-04-20 15:34
Topic: revised_privacy_architecture
Source: chat upload (Revised_Security_Architecture.md)
---

# Findings: OQ-6, OQ-7, and a new critical bug — plus P1.0a CHECK constraint

> Archived from chat per Decision Log Rule. This document records unresolved
> jitter-implementation checklist items and open questions captured on
> 2026-04-20. No code changes were made in this turn — findings only.

## 1. Active checklist updates (closing prior items)

a. **P2.2 (IP purge audit)** — record as **Verified & Closed**. Zero rows in `url_events` had both `ip_address` and `zip_code`.
b. **OQ-4 (eoa_type plumbing)** — record as **Resolved**. `events_actions.type` is reachable inside `log_event` PL/pgSQL via JOIN through `tokens.eoa_id`. No client changes needed for the jitter gate.

## 2. OQ-6 — EoA type immutability: NOT ENFORCED. Fix needed before P1.3.

a. **Database layer:** `events_actions.type` is a plain `text NOT NULL` column. No CHECK constraint, no trigger, no immutability protection. RLS policy `Anyone can manage events_actions` allows unrestricted updates by anyone — including unauthenticated users.
b. **Application UI:** `src/components/EoaForm.tsx` lines 357–369 exposes a Type `<Select>` with options `event` and `action`. Unlike `mobilize_code`, `utm_id`, and `assigned_deck_slug` (which carry `disabled={hasMintedToken}` guards on lines 241, 290, etc.), the Type select has **no lock guard**. An admin can change the type after tokens and events exist.
c. **Existing trigger contrast:** `invalidate_tokens_on_critical_change` already wipes tokens when `mobilize_code`, `assigned_deck_slug`, or `utm_id` change — but `type` is **not** in that list.
d. **Consequence for jitter:** Exactly the silent-inconsistency scenario described. An EoA created as `action`, jittered into `url_events` for months, then flipped to `event` would leave historical rows jittered while future rows are not. The map would show two visually different distributions for the same EoA with no flag.
e. **Fix needed before P1.3 ships:** Yes. Either (i) add `type` to `invalidate_tokens_on_critical_change` (consistent with sibling fields, but destructive — wipes tokens), or (ii) add a dedicated trigger blocking `type` updates entirely once any token exists for the EoA, with a clear error. **Recommend option (ii)** plus a UI lock on the Select when `hasMintedToken` is true.

## 3. NEW critical finding — case mismatch in `maybe_reinstantiate_l00`

a. **What was found:** DB stores type values as lowercase `'event'` / `'action'` (verified: 27 rows each). The `maybe_reinstantiate_l00` RPC at the line `IF _eoa_type = 'Event' THEN` compares against capitalized `'Event'`. The comparison **never matches**.
b. **Effect today:** Every EoA — including those the user designated "Event" — falls through to the Action-type ZIP-deduplication branch. The "every scan = unique person" Event behavior is silently dead code.
c. **Effect on OQ-4 conclusion:** The plan to gate jitter inside `log_event` with `IF _eoa_type != 'Event' THEN [jitter]` would suffer the same bug — every EoA would be treated as Action and jittered, including real Events. The `log_event` function would need to compare lowercase `'action'` (or normalize with `lower()`).
d. **Add to the active checklist as a separate task:** **P0.x** — Audit and normalize EoA type case across DB, RPCs (`maybe_reinstantiate_l00` and any future jitter gate), and UI. Decide on a single canonical case (recommend lowercase to match existing data, no migration needed) and apply it everywhere.

## 4. OQ-7 — Log scrubbing audit. Complete violation list.

Edge functions audited (per `EdgeFunctionHealth.tsx`): `geoip`, `reverse-geocode`, `get-mapbox-token`, `fetch-mobilize-event`, `render-stats-snapshot`, `deploy-template-snapshots`, `generate-campaign-pdf`, `import-zip-codes`, `import-google-slides`, `oembed-proxy`, `refresh-all-snapshots`.

a. `supabase/functions/geoip/index.ts` — emits IP and precise coordinates:
- L24: `console.log('📍 Getting geolocation for IP:', ip)` — **emits raw IP**.
- L28: `console.log('📍 Local/unknown IP, returning null geolocation')` — safe (no PII).
- L55: `console.log('📍 Geolocation data:', geoData)` — **emits full ipapi.co payload including precise lat/lng, postal, city**.
- L73: `console.log('📍 Enhancing US location with local zip code data:', geoData.postal)` — **emits zip code**.
- L84: `console.log('📍 Enhanced with local data:', localZipData)` — **emits precise lat/lng + city + state**.
- L101–107: `console.log('🌍 Non-US location - rounding coordinates:', { original: { lat, lng }, rounded: ... })` — **emits original precise lat/lng before rounding**.

b. `supabase/functions/reverse-geocode/index.ts` — emits coordinates and zip:
- L31: `console.log('🗺️ Reverse geocoding coordinates:', { latitude, longitude })` — **emits precise lat/lng from request**.
- L53: `console.log('🗺️ Nominatim response:', nominatimData)` — **emits Nominatim payload incl. address, postcode, lat/lng**.
- L87–93: `console.log('🗺️ Found nearest zip code from database:', { zip_code, city, state, zip_lat, zip_lon })` — **emits zip + zip centroid coordinates**.
- L98: city fallback (low risk).
- L102: region fallback (low risk).
- L114: distance only (low risk).
- L116: safe.
- L133: `console.log('🗺️ Final parsed location:', result)` — **emits final zip + city + region + display_name**.

c. `supabase/functions/generate-campaign-pdf/index.ts` — counts only, but one line worth noting:
- L169: count only (safe).
- L249: writes coordinates to the **PDF output**, not console. Out of scope for log scrubbing but worth flagging separately as it persists EoA-site coordinates in the generated report. Not a violation of the log rule.

d. `supabase/functions/render-stats-snapshot/index.ts` — no precise lat/lng in console logs. Coordinates appear only inside `pinOverlay` URL construction (sent to Mapbox), not logged. Safe.

e. `supabase/functions/import-zip-codes/index.ts` — logs counts and progress only. Safe.

f. `supabase/functions/fetch-mobilize-event/index.ts` — logs full Mobilize API response at L48. Mobilize event data includes venue address, postal_code, lat/lng. **Violation** — emits event venue PII.
- L27: URL log — safe.
- L37: error text — safe.
- L48: `console.log('Mobilize API response:', data)` — **emits venue address, postal, lat/lng**.

g. `supabase/functions/import-google-slides/index.ts` — no coordinate/IP/zip logs. Safe.

h. `get-mapbox-token`, `oembed-proxy`, `deploy-template-snapshots`, `refresh-all-snapshots` — no coordinate/IP/zip logs found.

**Summary of violations to scrub (single approval task):**
- `geoip/index.ts`: lines 24, 55, 73, 84, 101–107.
- `reverse-geocode/index.ts`: lines 31, 53, 87–93, 133.
- `fetch-mobilize-event/index.ts`: line 48.

## 5. P1.0a — CHECK constraint on `events_actions.type` (recorded, not yet implemented)

a. **What it does:** Adds `CHECK (type IN ('event', 'action'))` to `events_actions.type`.
b. **Why P1.0a (prerequisite for P1.3):** The jitter gate must be able to trust that `type` holds one of two known values; otherwise an unexpected value (typo, future enum drift) silently misroutes events.
c. **Case decision required first:** Per finding §3, decide canonical case (recommend lowercase to match existing data and avoid a data migration) before writing the constraint. Constraint values must match the canonical case.
d. **Status:** Recorded in checklist. **Not implemented.** Awaiting approval as part of the next implementation batch.

## 6. Files affected by recording these findings

a. `.lovable/plan.md` (active checklist) — update with:
- P2.2: Verified & Closed.
- OQ-4: Resolved (caveat: §3 case mismatch must be fixed for the jitter gate to work).
- OQ-6: Resolved as **finding only**. Fix is required before P1.3 — added as new task **P1.0b: enforce EoA type immutability** (DB trigger + UI lock).
- OQ-7: Resolved as audit. Scrubbing recorded as new task **P1.0c: scrub coordinate/IP/zip logs** with the line list from §4.
- **New finding — P0.x: normalize EoA type case** across DB data, `maybe_reinstantiate_l00`, future `log_event` jitter gate, and UI Select.
- **New task — P1.0a: CHECK constraint on** `events_actions.type` (depends on P0.x case decision).

b. No code changes in this turn — all read-only.

## 7. Decisions needed before any of these become implementation tasks

a. **Case canonicalization (P0.x):** lowercase (no data migration, fix RPCs and UI to lowercase) or capitalized (migrate 54 rows, leave RPC as-is, fix UI Select)? **Recommend lowercase.**
b. **OQ-6 fix approach (P1.0b):** trigger that *blocks* type changes on EoAs with existing tokens (recommended), or trigger that *invalidates tokens* when type changes (consistent with sibling fields but destructive)?
c. **OQ-7 scrubbing scope (P1.0c):** strip the offending log lines entirely, or replace with safe summaries (e.g., country-only, IP hash, "zip resolved")? **Recommend safe summaries** to preserve debuggability.
d. **P1.0a CHECK constraint:** approve as written once P0.x decides the canonical case?

## 8. Plan lineage

This plan **updates** the active jitter implementation checklist in `.lovable/plan.md`. Records two completed items (P2.2, OQ-4), three new findings (OQ-6 outcome, OQ-7 outcome, case-mismatch bug), and four new prerequisite tasks (P0.x case fix, P1.0a CHECK constraint, P1.0b type immutability, P1.0c log scrubbing). No new decision document until a Phase 1 chunk ships.

---

## Update — 2026-04-30

**Status: Approved & Implemented (partial — P0.x only)**

User decisions on the four open questions from §7, and the resulting implementation batch.

### 9. Decisions recorded

a. **§7a — Case canonicalization (P0.x):** **1a — lowercase canonical.** Fix RPC and UI; no data migration. Implemented via case-insensitive comparison (`lower(_eoa_type) = 'event'`) for forward-compatibility against any stray capitalized rows.
b. **§7d — P1.0a CHECK constraint:** **4b — defer.** Will ship with P1.3 (jitter) when ready, using the lowercase canonical from 9a.
c. **§7c — OQ-7 log scrubbing (P1.0c):** **3a — defer.** User is mid-test; scrubbing of `console.log` IP/lat/lng/zip lines in edge functions (`geoip`, `reverse-geocode`, others) is held until user signals testing complete. When run, will **strip offending lines entirely** (not replace with safe summaries) per user direction.
d. **§7b — OQ-6 (P1.0b, type immutability trigger):** **adopted as future work** (decision §7b option not re-asked this turn; remains open). Captured here so it is not forgotten — needs decision before P1.3 ships.
e. **§2a — Adoption of jitter checklist findings** as canonical reference: confirmed.

### 10. Implemented this turn

a. **P0.x — `maybe_reinstantiate_l00` case fix:** Function updated to use `lower(_eoa_type) = 'event'` instead of `= 'Event'`. Now correctly routes Event-type EoAs to per-scan re-instantiation regardless of stored case. Migration applied successfully.
b. **`EoaForm.tsx`:** No change required — verified the Select already emits lowercase `'event'` / `'action'`. Default value also lowercase.

### 11. Deferred (explicit, do not action without further approval)

a. **P1.0a** — CHECK constraint on `events_actions.type`. Bundle with P1.3.
b. **P1.0b** — EoA type immutability trigger. Awaiting §7b decision (block-vs-invalidate).
c. **P1.0c** — Edge-function log scrubbing. Awaiting user "testing complete" signal. Scope: strip lines (not summarize).

### 12. Plan lineage

This update appends to the same `revised_privacy_architecture` decision file. Records the user's approval of P0.x (1a) and adoption (2a), and the explicit deferral of P1.0a (4b) and P1.0c (3a). P1.0b remains an open question for the next round.
