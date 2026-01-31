# V-Align Control Insufficient Vertical Movement

**Date:** 2026-01-31  
**Author:** Lovable AI  
**Related Feature:** Data Template Editor (LNMH) - Hotspot Calibration  
**Project Area:** hotspot  
**Status:** Deferred for later investigation

## Summary

The V-Align (vertical alignment) control in the hotspot calibration panel does not produce noticeable vertical movement of text within its container. Users currently work around this by reducing font size to achieve acceptable visual appearance.

## Context

As part of the LNMH (Live Numbers/Map Hotspot) system, we added H-Align and V-Align controls to allow fine-grained positioning of live metric numbers within their background boxes. The goal was to center text both horizontally and vertically within the hotspot container.

## Implementation Details

### What Was Implemented

1. **Type Definition** (`src/types/viralTemplates.ts`):
   ```typescript
   verticalAlign?: 'top' | 'center' | 'bottom';
   ```

2. **Calibration Control** (`src/components/HotspotCalibrationControls.tsx`):
   - Added V-Align dropdown with options: Top, Center, Bottom
   - Value persists in `hotspot.liveNumberStyle.verticalAlign`

3. **Rendering Logic** (`src/components/DraggableHotspotOverlay.tsx`):
   ```typescript
   const alignItems = 
     style.verticalAlign === 'top' ? 'flex-start' : 
     style.verticalAlign === 'bottom' ? 'flex-end' : 'center';
   ```
   Applied via Flexbox `alignItems` property on the hotspot container.

### Expected Behavior

Changing V-Align from "Top" to "Center" to "Bottom" should visibly move the text content vertically within the hotspot's background box.

### Observed Behavior

The text position barely changes when toggling between V-Align options. The movement is imperceptible or negligible.

## Possible Causes (To Investigate)

1. **Container Height vs Content Height**: 
   - The hotspot container may be sized exactly to fit its content, leaving no vertical space for alignment to have effect
   - Flexbox `alignItems` only works when there's extra space in the cross-axis

2. **CSS Conflicts**:
   - Other styles (padding, line-height, font metrics) may be consuming available vertical space
   - The `overflow: visible` setting might affect layout calculations

3. **Font Metrics**:
   - Different fonts have different baseline/ascender/descender ratios
   - The Calibri font family may have specific metrics affecting vertical positioning

4. **Height Calculation**:
   - Hotspot height is calculated as percentage of container
   - If height exactly matches text height, no alignment movement possible

5. **Snapshot Rendering**:
   - Need to verify if the issue persists in html2canvas snapshots or is preview-only

## Current Workaround

Users can reduce font size to create more vertical space within the container, allowing the text to appear more centered visually.

## Recommended Investigation Steps

1. **Inspect computed styles**: Use browser DevTools to check actual container dimensions vs text dimensions
2. **Add debug borders**: Temporarily add visible borders to see exact container boundaries
3. **Test with fixed pixel heights**: Try setting explicit larger heights to confirm alignItems works with extra space
4. **Consider alternative approaches**:
   - CSS `line-height` manipulation
   - CSS `transform: translateY()` for pixel-level control
   - Padding-based vertical positioning
   - CSS Grid with `place-items` instead of Flexbox

## Files Involved

- `src/types/viralTemplates.ts` - Type definition
- `src/components/HotspotCalibrationControls.tsx` - UI control
- `src/components/DraggableHotspotOverlay.tsx` - Rendering logic
- `src/lib/snapshotCapture.ts` - Snapshot generation (for verification)

## References

- Related memory: `memory/ui/lnmh-fine-calibration-controls`
- H-Align control (working correctly) implemented in same commit
