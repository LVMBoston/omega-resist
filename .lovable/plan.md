

# Stabilize & Regroup HotspotCalibrationControls Layout

## Problem
Selecting "Manual Entry" conditionally inserts a Label textarea, shifting all controls below it. Controls are also not logically grouped.

## Plan

### 1. Always render the Label field (stable layout)
   a. Remove the `{isManualEntry && ...}` conditional. Always render the Label textarea in the same grid slot.
   b. When `metricKey !== "manual_entry"`, render it as `disabled` with `opacity-40` so the slot is occupied but visually muted.

### 2. Reorder into logical groups + 3-column row for Size/Weight/Font
   Switch the grid to this order:

   | Col 1 | Col 2 |
   |-------|-------|
   | **Metric** | **Label** (always present) |
   | **Size** ·· **Weight** ·· **Font** | ← 3-col row spanning full width |
   | **X** | **Y** |
   | **W** | **H** |
   | **H-Align** | **V-Align** |
   | **Text Color** | **BG Color** |
   | **Preview** | |

   a. Wrap Size, Weight, and Font in a single `col-span-2` container with an inner `grid grid-cols-3 gap-3`.
   b. Convert **Size** from `SliderWithButtons` to a simple number input (matching Weight/Font height) to fit the 3-col layout — or keep the slider but shrink it. Given the annotated image shows compact dropdowns, a small number input with stepper is cleaner.
   c. Move Font and Weight up from their current position (lines 179–211) into this row.
   d. Move X/Y before W/H (already the case).

### 3. File changed
   - `src/components/HotspotCalibrationControls.tsx` — layout reorder, always-render label, 3-col Size/Weight/Font row

### 4. Decision document
   - Archive to `docs/decisions/deck-editor/2026-04-07_hotspot-controls-stable-layout_feature-doc_lovable.md`

