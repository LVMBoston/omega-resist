# Data Template Editor Refactor — Test Protocol

> **Status:** Pre-refactor baseline capture  
> **Date:** 2026-02-13  
> **Related:** `docs/PLAN_DataTemplateEditor_Refactor.md`

---

## 1. Purpose

Automated layout testing is infeasible in jsdom (no `getBoundingClientRect`, no `clientWidth`).
Instead, we use a **reference-snapshot comparison** protocol:

1. Open a canonical template in the editor **before** the refactor.
2. Capture a browser screenshot as the **baseline**.
3. After the refactor, open the same template and capture again.
4. Visually compare: hotspot positions, button visibility, preview fidelity.

---

## 2. Reference Templates

Two templates cover the critical surface area:

| Template | ID | Background | Hotspot count | Why |
|----------|----|-----------|:------------:|-----|
| **Samizdat Template-1** | `42485454-62e3-402a-8266-21de7bedc852` | Image (JPEG) | 15 | Dense number hotspots across full slide; exercises font scaling, position accuracy, and overflow handling. |
| **World-Map** | `006fb714-78f9-49dd-aa16-bffe87327bef` | Solid color (`solid:#040458`) | varies | Validates solid-color rendering path and the alternate `<div>` background renderer. |

> **Note — Map hotspots:** The Phase 1 layout refactor does not touch `MapHotspotRenderer` internals (tile loading, marker clustering, viewport persistence). Map hotspot coordinate calculations depend only on the hotspot container's percentage positioning, which is already covered by the two baselines above. No dedicated map-template baseline is required; if a working map template is created later, it can be added as an optional regression check.

---

## 3. Verification Steps (per template)

### 3.1 Full-Page Route (`/template-editor/:id`)

| # | Check | Pass criteria |
|---|-------|--------------|
| 1 | **All hotspots visible** | Every hotspot from the fixture is rendered in the preview pane with correct metric labels. |
| 2 | **Hotspot positions match** | Hotspots appear at the same visual locations as the pre-refactor baseline screenshot. No offset drift. |
| 3 | **Action buttons visible** | "Save & Capture" and "Deploy to Campaigns" buttons are visible without scrolling on a 1080p viewport. |
| 4 | **Save & Capture works** | Clicking "Save & Capture" produces a PNG in the `slide-snapshots` bucket. Compare to the pre-refactor PNG at the same path. |
| 5 | **Preview aspect ratio** | The 9:16 preview maintains correct proportions (not stretched or squashed). |
| 6 | **Controls scrollable** | The left controls panel (post-refactor) scrolls independently of the preview. |

### 3.2 Sheet Dialog (DataTemplateDialog)

| # | Check | Pass criteria |
|---|-------|--------------|
| 1 | **Opens correctly** | Clicking "Edit" on the template row opens the Sheet with the editor populated. |
| 2 | **Hotspots match full-page** | Same hotspot positions as the full-page route. |
| 3 | **Save & Capture works** | Produces a valid snapshot PNG from within the Sheet context. |
| 4 | **Responsive fallback** | At viewport < 1024px, the editor falls back to stacked layout (no horizontal cramping). |

### 3.3 Solid-Color Template

| # | Check | Pass criteria |
|---|-------|--------------|
| 1 | **Background renders** | The solid-color `<div>` fills the preview area with the correct hex color (`#040458`). |
| 2 | **Hotspots positioned** | Hotspots render at correct percentage positions over the solid background. |
| 3 | **Save & Capture** | Note: client-side capture has a known limitation in solid-color mode (see `memory/bugs`). Server-side SVG render is the canonical path. |

---

## 4. Pre-Refactor Baseline Captures

Screenshots will be stored as browser tool artifacts during the pre-refactor verification pass.

### Capture checklist:
- [x] Full-page route with Samizdat Template-1 at 1920×1080 ✅ (captured 2026-02-13)
- [x] Full-page route with World-Map (solid color) at 1920×1080 ✅ (captured 2026-02-13)
- [ ] Sheet dialog with Samizdat Template-1 at 1920×1080 (deferred — requires navigating to /interactive-templates and opening edit sheet)
- [x] Full-page route at 768×1024 (tablet) ✅ (captured 2026-02-13)

---

## 5. Post-Refactor Comparison

After Phase 1 implementation:

1. Re-capture all four screenshots above.
2. Compare hotspot positions visually against baselines.
3. Run "Save & Capture" on Samizdat Template-1 and download the resulting PNG.
4. Compare the new PNG against the pre-refactor PNG stored at:
   `slide-snapshots/42485454-62e3-402a-8266-21de7bedc852/latest.png`

Any hotspot position shift > ~2% or missing UI elements constitutes a regression.
