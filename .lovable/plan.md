

# Plan: Create Documentation for Data Template Editor Refactor

## Overview

Create a single markdown file at `docs/PLAN_DataTemplateEditor_Refactor.md` that captures the current usability problems and the phased refactor recommendation before any code changes begin.

## Document Contents

The document will include:

1. **Problem Statement** -- describing the current vertical-stack layout issues (controls cut off on shorter screens, preview lost while scrolling, action buttons below the fold)

2. **Current Architecture** -- documenting the single-file structure (DataTemplateEditor.tsx, ~1005 lines), the two parent contexts (TemplateEditorPage full-page and DataTemplateDialog Sheet), and the key DOM dependencies (captureContainerRef for html2canvas, DraggableHotspotOverlay offset calculations)

3. **Proposed Changes (5 items)** -- the original user prompt items with per-item risk and value assessment

4. **Risk Register** -- dual-parent breakage, snapshot capture regression, drag-and-drop calibration offset changes, scope creep

5. **Phased Recommendation**
   - Phase 1 (approved): Split-view layout, sticky action bar, image-mode 60vh cap, responsive fallback to stacked on narrow screens
   - Deferred: Collapsible sections (low value), Smart Hotspot Management (high risk, separate follow-up)

6. **Verification Checklist** -- snapshot capture still works, hotspot drag positioning still accurate, both parent contexts render correctly, mobile/tablet fallback behaves

## File

- `docs/PLAN_DataTemplateEditor_Refactor.md` (new file)

## Technical Details

No code changes. Single new markdown file. Content is derived entirely from the assessment already discussed in chat.

