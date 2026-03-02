

# Simplify External Link Label Handling

**Date:** 2026-03-02

## 1. Problem

External link hotspots have labels that serve a different purpose than other hotspot types -- they provide descriptive text for the "email all links" feature, not visible on-screen labels. However, the overlap detection in `hotspotValidation.ts` expands bounding boxes by 4% when a label is present, causing external links near other hotspots to fail the overlap check and block saving.

## 2. Changes

### 2a. Hide "Label Position" for `external_link` hotspots

In `src/components/FullResolutionHotspotEditor.tsx`, wrap the Label Position `RadioGroup` block (lines 709-727) in a condition that excludes `external_link`:

```
{selectedHotspotData.type !== "external_link" && (
  <div>
    <Label>Label Position</Label>
    ...RadioGroup...
  </div>
)}
```

### 2b. Add tooltip to the Label field for `external_link` hotspots

In the same file, wrap the existing Label `<Input>` (lines 636-645) with a `Tooltip` when the type is `external_link`. The tooltip text: *"If present, this label will appear in the bundled email message."*

### 2c. Exclude `external_link` labels from overlap expansion

In `src/lib/hotspotValidation.ts`, add an optional `type` field to the local `Hotspot` interface (line 1-9) and update `getExpandedBounds` (line 15-36) so that hotspots with `type === "external_link"` get `labelArea = 0` -- their labels are metadata only, not rendered on the slide, so they should not inflate the bounding box.

## 3. Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `src/components/FullResolutionHotspotEditor.tsx` | Hide Label Position for `external_link`; add Tooltip on Label field |
| 2 | `src/lib/hotspotValidation.ts` | Add optional `type` to interface; skip label expansion for `external_link` |

## 4. No Database Changes

All changes are UI and validation logic only.

