# Data Template Editor — UX Refactor Plan

> **Status:** Planning (no code changes yet)  
> **Date:** 2026-02-13  
> **Component:** `src/components/DataTemplateEditor.tsx` (~1 005 lines)

---

## 1. Problem Statement

The Data Template Editor currently renders all of its content—metadata fields, hotspot controls, the 9:16 slide preview, and action buttons—in a **single vertical stack** inside a scrollable container. This creates three compounding usability problems:

| # | Issue | Impact |
|---|-------|--------|
| 1 | **Controls cut off on shorter screens** | On viewports ≤ 900 px tall (most laptops), the hotspot calibration sliders and the slide preview extend well below the fold. Users must scroll repeatedly between the controls they are adjusting and the preview that shows the result. |
| 2 | **Preview lost while scrolling** | Once the user scrolls down to fine-tune a hotspot's position or style, the slide preview scrolls out of view—eliminating visual feedback at the moment it matters most. |
| 3 | **Action buttons below the fold** | "Create Template," "Save & Capture," and "Deploy to Campaigns" sit at the very bottom of the stack. Users who have added multiple hotspots may not even realize these buttons exist without scrolling past all controls. |

Together these issues slow down template authoring, increase the chance of unsaved work, and make the editor feel unfinished compared to the rest of the application.

---

## 2. Current Architecture

### 2.1 File Structure

The entire editor lives in a single file:

```
src/components/DataTemplateEditor.tsx   (~1 005 lines)
```

It contains:
- State management for metadata, hotspots, image upload, campaign preview, and snapshot capture.
- All form controls (name, slug, description, image URL, background-color picker, campaign selector, hotspot add/remove/calibrate).
- The 9:16 preview pane with `DraggableHotspotOverlay`, `ChartHotspotRenderer`, and `MapHotspotRenderer`.
- Action buttons (Create / Save & Capture / Deploy).

### 2.2 Dual Parent Contexts

The editor is mounted by **two different parents**, each providing a different layout shell:

| Parent | File | Layout |
|--------|------|--------|
| **Full-page route** | `src/pages/TemplateEditorPage.tsx` | `h-screen flex flex-col` with a header; editor sits in `flex-1 min-h-0 overflow-hidden`. |
| **Sheet dialog** | `src/components/DataTemplateDialog.tsx` | Radix Sheet (`side="right"`, `w-[90vw]`); editor sits in `flex-1 min-h-0 overflow-y-auto`. |

Any layout changes must work correctly in **both** containers.

### 2.3 Key DOM Dependencies

| Dependency | Why It Matters |
|------------|---------------|
| `captureContainerRef` | Used by `html2canvas` (via `captureTemplateSnapshot`) to generate client-side snapshot PNGs. The ref must wrap exactly the 9:16 preview area—nothing more, nothing less—or captures will be blank or include extraneous UI. |
| `DraggableHotspotOverlay` offsets | Hotspot drag-and-drop coordinates are calculated relative to the overlay's bounding rect. Changing the DOM hierarchy (e.g., wrapping in a new flex container) can shift `getBoundingClientRect()` values and break drag accuracy. |
| `imageContainerRef` | Used to measure the rendered image dimensions for responsive font scaling (`scaledFontSize` logic). Must remain a direct ancestor of the hotspot overlay. |

---

## 3. Proposed Changes — Assessment

The five items from the original prompt, with risk and value ratings:

| # | Change | Value | Risk | Notes |
|---|--------|:-----:|:----:|-------|
| 1 | **Split-View Layout** — Left: scrollable controls. Right: sticky preview. | ★★★★★ | Medium | Core UX win. Requires restructuring the flex layout while preserving `captureContainerRef` and overlay offsets. |
| 2 | **Sticky Action Bar** — Pin Save / Deploy buttons in a fixed footer. | ★★★★ | Low | Simple CSS change; biggest risk is z-index stacking in the Sheet parent. |
| 3 | **Image-Mode 60 vh Cap** — Constrain the 9:16 preview height so controls remain visible. | ★★★ | Low | Already partially implemented; needs consistent enforcement across both parents. |
| 4 | **Collapsible Sections** — Accordion-style grouping for metadata vs. hotspot controls. | ★★ | Low | Nice-to-have, but the split-view already solves the scrolling problem. Adds accordion state management overhead. |
| 5 | **Smart Hotspot Management** — Popover-based per-hotspot editing instead of inline controls. | ★★★★ | High | Requires significant refactor of hotspot calibration controls, changes event flow for drag-and-drop, and introduces new popover positioning logic. Best as a separate follow-up. |

---

## 4. Risk Register

| Risk | Severity | Mitigation |
|------|:--------:|------------|
| **Dual-parent breakage** | High | Test the refactored editor in both `TemplateEditorPage` (full-page) and `DataTemplateDialog` (Sheet) after every layout change. Use responsive fallback to single-column on narrow viewports (Sheet on small screens). |
| **Snapshot capture regression** | High | Verify `captureContainerRef` still wraps only the preview area. Run "Save & Capture" in both parents and confirm the resulting PNG matches the visible preview. Check both image-URL and solid-color modes. |
| **Drag-and-drop calibration offset shift** | Medium | After DOM restructuring, verify that dragging a hotspot to a known coordinate (e.g., top-left corner) produces the expected `x: 0, y: 0` values. Regression-test with at least one chart and one map hotspot. |
| **Scope creep** | Medium | Strictly limit Phase 1 to layout changes. Do not refactor hotspot state management, metrics hooks, or snapshot logic in the same PR. |
| **Solid-color mode interaction** | Low | Solid-color backgrounds use a pseudo-URL (`solid:#hex`). Ensure the split-view handles the `<div>` background renderer identically to the `<img>` renderer. |

---

## 5. Phased Recommendation

### Phase 1 — Layout Refactor (approved)

**Scope:** Items 1 + 2 + 3 from above.

1. **Split-view layout** — Restructure the editor into a two-column flex layout:
   - **Left column (scrollable):** Metadata fields, hotspot list, calibration controls, campaign selector.
   - **Right column (sticky):** 9:16 slide preview with `DraggableHotspotOverlay`.
   - On viewports narrower than `1024px` (e.g., Sheet on tablets), fall back to the current stacked layout.

2. **Sticky action bar** — Move "Create Template" / "Save & Capture" / "Deploy to Campaigns" into a fixed-position footer bar that is always visible, regardless of scroll position.

3. **Image-mode 60 vh cap** — Enforce `max-h-[60vh]` on the preview container in image mode, with `object-contain` on the background image, so the preview never pushes controls out of view.

4. **Responsive fallback** — Below the breakpoint, revert to single-column vertical stack (current behavior) to avoid horizontal cramping.

### Deferred

| Item | Reason |
|------|--------|
| Collapsible Sections (#4) | Low incremental value once split-view is in place. Can be added later if the controls panel grows further. |
| Smart Hotspot Management (#5) | High risk of breaking drag calibration and snapshot capture. Should be scoped as a separate follow-up with its own verification plan. |

---

## 6. Verification Checklist

After Phase 1 is implemented, **all** of the following must pass before the refactor is considered complete:

- [ ] **Snapshot capture (image mode):** "Save & Capture" in `TemplateEditorPage` produces a correct PNG matching the visible preview.
- [ ] **Snapshot capture (solid-color mode):** Same test with a `solid:#` background.
- [ ] **Snapshot capture in Sheet:** "Save & Capture" works identically when the editor is opened via `DataTemplateDialog`.
- [ ] **Hotspot drag accuracy:** Drag a number hotspot to a known visual position; confirm saved `x`/`y` values are correct. Repeat for chart and map hotspots.
- [ ] **Both parents render correctly:** Open the editor via the full-page route (`/template-editor/:id`) and via the Sheet dialog. Confirm layout, scrolling, and button visibility in both.
- [ ] **Mobile / tablet fallback:** Resize the viewport below 1024 px. Confirm the editor falls back to stacked layout without layout breakage.
- [ ] **Campaign preview:** Select a campaign from the dropdown; confirm live metrics populate in the preview. Clear the selection; confirm fallback behavior.
- [ ] **Deploy to Campaigns:** With a campaign-linked template, confirm the deploy dialog still opens and functions.
