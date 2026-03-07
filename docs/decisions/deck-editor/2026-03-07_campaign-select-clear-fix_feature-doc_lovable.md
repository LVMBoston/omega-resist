# Fix: Campaign Select "Clear selection" Not Working

**Status: Approved & Implemented**
**Date: 2026-03-07**

---

## 1. Root Cause

Three issues combined to make "clear selection" non-functional:

- a. Radix UI `Select` ignores empty string values — the `__clear__` `SelectItem` hack didn't reset the trigger text.
- b. Setting `value={undefined}` made the Select uncontrolled, caching the old display.
- c. An auto-populate `useEffect` re-selected the campaign immediately after clearing.
- d. Stale `metricsMap` data repopulated `displayValues` even after clearing.

## 2. Fix (4 changes in `src/components/DataTemplateEditor.tsx`)

- a. Replaced the `__clear__` `SelectItem` with an explicit X `Button variant="ghost"` next to the Select trigger.
- b. Added `key={campaignId || '__empty__'}` on the `Select` to force remount when clearing.
- c. Added a `userClearedCampaign` ref — set to `true` on X click — to prevent the auto-populate `useEffect` from re-selecting.
- d. Added `setDisplayValues({})` when `campaignId` becomes empty, and guarded the `metricsMap` effect with `if (!campaignId) return`.

## 3. Browser-verified

Select campaign → click X → dropdown resets to placeholder, preview clears all metric values, map reverts to "Select Campaign".
