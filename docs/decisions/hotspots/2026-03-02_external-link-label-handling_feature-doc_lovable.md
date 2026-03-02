# Simplify External Link Label Handling

**Status:** Approved & Implemented  
**Date:** 2026-03-02

## Summary

External link hotspot labels serve as email metadata (used by the `email_links` hotspot to build the mailto body), not as visible on-screen labels. The overlap detection was expanding bounding boxes for these labels, blocking saves when external links were placed near other hotspots.

## Changes

| File | Change |
|------|--------|
| `src/components/FullResolutionHotspotEditor.tsx` | Hide Label Position radio for `external_link`; add ⓘ tooltip on Label field explaining email usage |
| `src/lib/hotspotValidation.ts` | Added optional `type` to Hotspot interface; `getExpandedBounds` skips label expansion for `external_link` |

## No Database Changes

All changes are UI and validation logic only.
