# Export / Import Template Hotspot Layout as JSON

## 1. Goal
Let an editor save the **hotspot layout** of a Data Template to a `.json` file and re-apply it on a different template canvas. This is a layout-portability feature, not a full template clone.

## 2. What gets exported
a. Every **data hotspot** on the canvas (maps, live numbers, charts, etc.)
b. Per hotspot: `id`, `iconId`, `type`, `label`, `labelPosition`, `x`, `y`, `width`, `height`, `zIndex`
c. Per hotspot: type-specific config block — `mapConfig`, `liveNumberStyle`, `metricKey`, chart settings, etc.
d. Header block: `schemaVersion`, `exportedAt`, `templateId`, `templateName`, `sourceAspectRatio`, `sourceImageWidth`, `sourceImageHeight`

## 3. What does NOT get exported
- Background image
- Captured snapshot / thumbnail
- Deployment, EoA, or campaign bindings
- Database row IDs
- Locked / derived action hotspots (these belong to the underlying slide, not the layout)

## 4. Import behavior
a. `.json` file picker on the target template's editor
b. Validate with zod against `schemaVersion`; reject with a clear message if unsupported
c. Generate **fresh hotspot IDs** on import (never reuse exported IDs)
d. Default = **Replace** existing data hotspots; checkbox for **Append instead of replace**
e. If `sourceAspectRatio` ≠ target aspect ratio, show a one-time dialog:
   - **Keep percentages as-is** (hotspots may sit off-canvas)
   - **Fit to target** (rescale `x/y/width/height` to fit, preserving relative arrangement)
f. Locked action hotspots on the target are never touched

## 5. Stable identifiers, never ordinals
a. Metric bindings stored as `metricKey` strings (e.g. `"map_legend"`) — never as list position
b. Same rule for chart types, map presets, color palettes — slug/id only
c. If a key is renamed or removed, that one hotspot imports with an **"Unknown metric"** badge; the rest import cleanly
d. Reordering the METRIC list later will **not** break older export files

## 6. UI
a. Two buttons in the `DataTemplateEditor` toolbar: **Export ⇩** and **Import ⇧**
b. Both disabled during capture/save
c. Export downloads `template-<slug>-<YYYYMMDD>.json`
d. Import opens a modal: file picker → validation summary → Replace/Append toggle → aspect-ratio dialog if needed → Apply

## 7. Technical notes
- New module: `src/lib/templateLayoutIO.ts`
  - `exportHotspotsToJson(template, hotspots): Blob`
  - `parseHotspotsJson(raw): ParsedLayout` (zod-validated)
  - `rescaleHotspots(hotspots, sourceAR, targetAR): Hotspot[]`
- Purely client-side; no DB migrations, no edge functions, no backend changes
- Reuses the existing `Hotspot` type from the editor

## 8. Out of scope
- Cross-account sharing / share-by-URL
- Importing the background image
- Validating metric bindings against a specific campaign's available data
- Bulk import of multiple templates at once

## 9. Decision log
On approval + implementation, archive this plan to:
`docs/decisions/templates/2026-06-14_template-layout-export-import_feature-doc_lovable.md`
with `Status: Approved & Implemented`. This is a **new** plan (no prior decision doc to update).

---

# PENDING — Remove campaign-switch crash diagnostics

## P1. Trigger
After several successful Template creations with no crash when switching the **Live Data Preview → Campaign** dropdown, retire the defensive guards added to investigate the blank-page → bounce-back bug.

## P2. What to remove
File: `src/components/DataTemplateEditor.tsx` (around line 764–767)

a. The explanatory comment block on lines 764–766 (`/* key only flips between … bounce back. */`).
b. The `try { … } catch (e) { console.error(...) }` wrapper around `setCampaignId(v)` in the `onValueChange` handler. Restore to a plain `onValueChange={(v) => setCampaignId(v)}`.

## P3. What to KEEP
a. The `key={campaignId ? '__has__' : '__empty__'}` pattern — this is the actual fix. It only remounts the Select when toggling between "empty" and "has value", which is what prevents the mid-interaction remount that caused the crash.

## P4. Verification before removal
a. Create at least 3 new templates and switch the preview Campaign multiple times across different campaigns including ICE OUT FOR GOOD. No crash, no bounce-back.
b. After removal, repeat the same flow once to confirm no regression.

## P5. Decision-log follow-up
After removal, archive this entry under `docs/decisions/template-editor/<YYYY-MM-DD>_campaign-switch-crash-guard-removal_feature-doc_lovable.md` with `Status: Approved & Implemented`.
