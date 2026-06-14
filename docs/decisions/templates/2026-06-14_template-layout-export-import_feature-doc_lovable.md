# Template Layout Export / Import as JSON

Status: Approved & Implemented
Date: 2026-06-14

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
- Locked / derived action hotspots (they belong to the underlying slide, not the layout)

## 4. Import behavior
a. `.json` file picker on the target template's editor
b. Validate with zod against `schemaVersion`; reject with clear message if unsupported
c. Generate **fresh hotspot IDs** on import
d. Default = **Replace** existing data hotspots; checkbox for **Append instead of replace**
e. If `sourceAspectRatio` ≠ target ratio, show one-time dialog:
   - **Keep percentages as-is**
   - **Fit to target** (rescale x/y/width/height)
f. Locked action hotspots on the target are never touched

## 5. Stable identifiers, never ordinals
a. Metric bindings stored as `metricKey` strings (e.g. `"map_legend"`)
b. Same rule for chart types, map presets, color palettes — slug/id only
c. Unknown keys flag a single "Unknown metric" hotspot; rest import cleanly
d. Reordering the METRIC list later will **not** break older export files

## 6. UI
a. Two buttons in the `DataTemplateEditor` hotspot toolbar: **Export ⇩** and **Import ⇧**
b. Both disabled during capture/save
c. Export downloads `template-<slug>-<YYYYMMDD>.json`
d. Import opens a modal: file picker → validation summary → Replace/Append toggle → aspect-ratio dialog if needed → Apply

## 7. Implementation
- `src/lib/templateLayoutIO.ts` — `exportHotspotsToJson`, `parseHotspotsJson` (zod), `rescaleHotspots`, `withFreshIds`, `ratiosMatch`, `downloadJsonFile`, `makeExportFilename`
- `src/components/ImportLayoutDialog.tsx` — file picker, validation summary, replace/append toggle, rescale choice
- `src/components/DataTemplateEditor.tsx` — Export / Import buttons in hotspot toolbar, dialog mounted at root
- Purely client-side; no DB migrations, no edge functions

## 8. Out of scope
- Cross-account sharing / share-by-URL
- Importing the background image
- Validating metric bindings against a specific campaign's available data
- Bulk import of multiple templates at once
