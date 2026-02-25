

# Universal App Download Link -- Implementation Plan

**Status**: Planned
**Date**: 2026-02-25

## Summary

Add an `app_download` hotspot type that detects the viewer's device (iOS/Android/Desktop) and redirects to the correct app store. Uses the Lucide `Smartphone` icon as a placeholder.

## Changes

### 1. Type System -- `src/types/viralTemplates.ts`
- Add `'app_download'` to `HotspotActionType` union
- Add optional fields to `Hotspot`: `appStoreUrl?: string`, `playStoreUrl?: string`, `fallbackUrl?: string`

### 2. Hotspot Editor -- `src/components/FullResolutionHotspotEditor.tsx`
- Add `'app_download'` to `IconCategory` type and category list
- Add icon preset using Lucide `Smartphone` icon (rendered to canvas for thumbnail compatibility)
- When selected hotspot is `app_download`, show three URL inputs (iOS App Store, Google Play, Desktop Fallback) instead of the single URL field

### 3. Runtime Overlay -- `src/components/InteractiveSlideOverlay.tsx`
- Add `handleAppDownload(hotspot)` with user-agent detection:
  - `/iPad|iPhone|iPod/` --> `appStoreUrl`
  - `/android/i` --> `playStoreUrl`
  - else --> `fallbackUrl || appStoreUrl || playStoreUrl`
- Add `app_download` case to `getHotspotAction` and `getHotspotIcon`

### 4. Decision Document
- Save to `docs/decisions/architecture/2026-02-25_universal-app-download-link_feature-doc_lovable.md` with Status: Approved and Implemented

## No Database Changes
Hotspot data lives in the existing `hotspots` JSONB column -- no migration needed.

## Files Changed

| File | Change |
|------|--------|
| `src/types/viralTemplates.ts` | New type + fields |
| `src/components/FullResolutionHotspotEditor.tsx` | New category, preset, URL inputs |
| `src/components/InteractiveSlideOverlay.tsx` | Device detection + redirect |
| `docs/decisions/architecture/...` | Decision doc |

