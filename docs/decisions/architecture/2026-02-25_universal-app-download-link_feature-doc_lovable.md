# Universal App Download Link

**Status**: Approved & Implemented  
**Date**: 2026-02-25

## Summary

Added an `app_download` hotspot type that detects the viewer's device (iOS/Android/Desktop) and redirects to the correct app store. Uses the Lucide `Smartphone` icon as a placeholder.

## Changes

### 1. Type System — `src/types/viralTemplates.ts`
- Added `'app_download'` to `HotspotActionType` union
- Added optional fields to `Hotspot`: `appStoreUrl`, `playStoreUrl`, `fallbackUrl`

### 2. Hotspot Editor — `src/components/FullResolutionHotspotEditor.tsx`
- Added `'app_download'` to `IconCategory` type and category list
- Added icon preset using Lucide `Smartphone` icon
- When selected hotspot is `app_download`, shows three URL inputs (iOS App Store, Google Play, Desktop Fallback) instead of the single URL field

### 3. Runtime Overlay — `src/components/InteractiveSlideOverlay.tsx`
- Added `handleAppDownload(hotspot)` with user-agent detection:
  - `/iPad|iPhone|iPod/` → `appStoreUrl`
  - `/android/i` → `playStoreUrl`
  - else → `fallbackUrl || appStoreUrl || playStoreUrl`
- Added `app_download` case to `getHotspotAction` and `getHotspotIcon`

## No Database Changes
Hotspot data lives in the existing `hotspots` JSONB column — no migration needed.

## Files Changed

| File | Change |
|------|--------|
| `src/types/viralTemplates.ts` | New type + fields |
| `src/components/FullResolutionHotspotEditor.tsx` | New category, preset, URL inputs |
| `src/components/InteractiveSlideOverlay.tsx` | Device detection + redirect |
