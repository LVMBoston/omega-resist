

# Fix: Hotspot Editor Closes on Every Edit

## Problem

The `FullResolutionHotspotEditor` calls `onSave(hotspots)` on **every** change — add, drag, resize, delete, property update (lines 348, 360, 366). In the `DeckEditor`, `handleSaveHotspots` is wired as `onSave`, which:

1. **Closes the dialog** (`setHotspotEditorOpen(false)`, line 805) — this is the "bounce"
2. Shows "Hotspot changes staged" toast (line 806)
3. Triggers `handleCaptureThumbnail` (line 811), which fails with "No template config found" because nothing is persisted to the DB yet (line 752-754)

So placing a single SMS icon immediately closes the editor and fires a spurious thumbnail capture.

## Root Cause

`onSave` is used for **two purposes** that should be separate:
- **a.** Live sync (every edit should update internal state)
- **b.** Final commit (user explicitly says "I'm done editing")

## Solution

### 1. Split `onSave` into `onChange` + `onSave` in `FullResolutionHotspotEditor`

- **a.** Add a new `onChange?: (hotspots: Hotspot[]) => void` prop for live updates
- **b.** Keep `onSave` for the explicit "Save & Close" button (already exists in the editor UI)
- **c.** Replace all inline `onSave(updatedHotspots)` calls (lines 348, 360, 366, 909) with `onChange?.(updatedHotspots)` — these fire on add, update, delete, clear
- **d.** Wire the existing Save button to call `onSave(hotspots)` only on explicit user action

### 2. Update `DeckEditor.tsx` wiring

- **a.** Pass a lightweight `onChange` handler that updates `previewHotspots` state (for live preview) but does **not** close the dialog or trigger thumbnail capture
- **b.** Keep `handleSaveHotspots` as the `onSave` — it closes the dialog, stages changes, classifies the slide type, and triggers thumbnail capture
- **c.** Guard thumbnail capture: skip `handleCaptureThumbnail` when `configId` is absent (new slides that haven't been saved to DB yet) — replace the error toast with a silent skip or info log

### 3. Files changed

- `src/components/FullResolutionHotspotEditor.tsx` — add `onChange` prop; replace `onSave` calls with `onChange` in add/update/delete/clear; explicit Save button calls `onSave`
- `src/pages/DeckEditor.tsx` — pass both `onChange` and `onSave` to the editor; guard thumbnail capture

### 4. Decision doc

- **a.** Update existing doc: `docs/decisions/deck-editor/2026-04-06_data-hotspot-editor-integration_feature-doc_lovable.md` with a new `## Update — 2026-04-06` section documenting this fix

