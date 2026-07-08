
# Dynamic URL Payload Reference

## 1. Background

Today the payload structure is documented as a static image. It's already drifted from reality in six places (`L00` casing, `utm_medium` derivation, `utm_content` format on L00 vs L01+, `t=` includes `utm_id`, `p=` points at the L00 instance, no `m=` parameter). Any future change to `mint_l00` / `mint_share` will silently re-open the same gap.

A dynamic reference reads the same templates the minters use, so the diagram cannot drift.

Scope is a **read-only reference display**. It does not read a specific token from the DB — it renders the *template* for each level using literal placeholders for the parts generated at mint time (`{mobilize_code}`, `{utm_id}`, `{suffix}`, `{token}`, `{parent}`). This matches how the static graphic worked, just generated from code.

## 2. Where it lives

Add a new **"Visualize Generic Payload"** button in the Campaign EoA Manager toolbar (`src/pages/CampaignEoaManager.tsx`), placed to the right of the existing **Fix channels**, **Columns**, and **QR Code Defaults** buttons, matching their icon + label style.

Clicking it toggles a collapsible **URL Payload Reference** panel rendered directly beneath that toolbar row and above the EoA table. No dialog, no new route, no nav change. The panel remembers its open/closed state per session via component state only.

The panel is campaign-agnostic — it shows the generic template, not values from any specific EoA in the table.

## 3. What the panel renders

Five rows stacked vertically:

a. **L00 base** — pre-open, freshly minted seed
b. **L00 instance** — post-first-open, ZIP-scoped identity
c. **L01** — first viral share
d. **L02** — share of a share
e. **L03** — terminal share level

Each row shows the fully assembled URL with every query-string segment on its own line, monospaced, in a bordered card. Above each row: the level name and a one-line plain-English description.

## 4. Color-coded lineage

Each URL segment is wrapped in a `<span>` with a semantic class. Segments that carry the same value across levels share a color; segments that change get a new color where they change.

| Segment                | Behavior across levels                                | Color role      |
|------------------------|-------------------------------------------------------|-----------------|
| `utm_campaign`         | Same on all 5 rows                                    | `campaign`      |
| `utm_id`               | Same on all 5 rows                                    | `eoa`           |
| `utm_source=L00..L03`  | Changes every level                                   | `level`         |
| `utm_medium`           | Derived from `utm_id` on L00; chosen by sharer L01+   | `medium`        |
| `utm_content`          | Present on L00 only, dropped on L01+                  | `content`       |
| `t=` (self token)      | New value every level                                 | `self-token`    |
| `p=` (parent token)    | Absent on L00; = L00 instance on L01; = prior on L2/3 | `parent-token`  |
| `v_lvl`                | Changes every level                                   | `level`         |

Colors declared as HSL tokens in `src/index.css` per project rules — no hardcoded hex in components. A small legend row above the stack maps color to meaning.

## 5. Data source

Pure client-side render. No DB calls, no RPC. Templates are hand-mirrored from `mint_l00` and `mint_share` in a new module `src/lib/virality/payloadTemplates.ts`, exporting one function per level returning `{ segments: Array<{ key, value, colorRole }> }`. The panel component imports these and renders.

## 6. Keeping it honest

Add `src/lib/virality/payloadTemplates.test.ts` asserting each level's segments against a golden snapshot. A comment at the top of `payloadTemplates.ts` points at `mint_l00` and `mint_share` and asks the editor to update both together.

## 7. Files

- new: `src/lib/virality/payloadTemplates.ts`
- new: `src/lib/virality/payloadTemplates.test.ts`
- new: `src/components/PayloadReferencePanel.tsx`
- edit: `src/pages/CampaignEoaManager.tsx` — add **Visualize Generic Payload** toolbar button + mount the collapsible panel below the toolbar
- edit: `src/index.css` — add 7 HSL tokens for the color roles

## 8. What does not change

- No changes to `mint_l00`, `mint_share`, `tokens`, or any RPC.
- No changes to how URLs are actually generated at mint time.
- No token lookup, no live data, no per-row payload on EoA rows.
- The QR & Token Tools page (`QrDebugTool.tsx`) is untouched.

## 9. Decision log

On approval + implementation, archive this plan to `docs/decisions/virality/2026-07-08_dynamic-payload-reference_feature-doc_lovable.md` as a new plan (not an update to an existing one).
