

# Complete Hybrid Template Implementation — Remaining Items

Three items were left unfinished from the approved plan. All are straightforward additions to files already modified.

## 1. Ghost overlay rendering for locked hotspots in `DraggableHotspotOverlay.tsx`

Add rendering of `lockedHotspots` passed from `DataTemplateEditor`. These appear as semi-transparent, non-interactive overlays showing where the Action template's share buttons sit. They use a grey/purple tint with a Lock icon and a label (e.g. "SMS", "Email") so the admin knows what space is reserved.

**Props change:** Add `lockedHotspots?: Hotspot[]` to the component's props interface.

**Rendering:** Before the editable hotspots loop, render each locked hotspot as a positioned `div` with:
- Same percentage-based positioning as regular hotspots
- `opacity-40`, dashed purple border, lock icon
- `pointer-events-none` so they cannot be clicked or dragged
- A small label badge showing the hotspot type

## 2. "Hybrid" filter tab in `InteractiveTemplates.tsx`

The tabs section currently has All / Action / Data. Add a fourth tab: **Hybrid** (purple-themed). Update the filtering logic so selecting "Hybrid" shows only `template_type === 'hybrid'` templates.

## 3. Split locked vs editable hotspots when editing an existing hybrid template

When `DataTemplateEditor` opens for an existing hybrid template (not a fresh promote), the `initialHotspots` from the database contain both action and data hotspots mixed together. On load, split them:
- Action types (`sms`, `email`, `social`, `external_link`) go into the `lockedHotspots` display layer
- Data types (`live_number`, `chart`, `map`, `manual_entry`) go into the editable hotspots state

This ensures re-editing a hybrid template preserves the locked/editable distinction without any extra database fields.

## Files Modified

| File | Change |
|---|---|
| `src/components/DraggableHotspotOverlay.tsx` | Add `lockedHotspots` prop, render ghost overlays |
| `src/pages/InteractiveTemplates.tsx` | Add "Hybrid" filter tab |
| `src/components/DataTemplateEditor.tsx` | Split action vs data hotspots from `initialHotspots` on load |

No new files. No database changes. No edge function changes.

