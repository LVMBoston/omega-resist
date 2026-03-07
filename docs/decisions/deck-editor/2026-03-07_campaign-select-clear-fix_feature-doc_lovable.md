# Fix: Campaign Select "Clear selection" Not Working

**Status: Approved & Implemented**
**Date: 2026-03-07**

---

## 1. Root Cause

Radix UI `Select` ignores empty string values. Setting `campaignId` to `""` doesn't reset the displayed trigger text — it keeps showing the previously selected campaign.

## 2. Fix

Replaced the `__clear__` `SelectItem` hack with an explicit clear button next to the Select trigger. When clicked, it sets `campaignId` to `""` and Radix shows the placeholder.

### Changes in `src/components/DataTemplateEditor.tsx`

- a. Removed the `__clear__` `SelectItem` from inside `SelectContent`.
- b. Added a small "X" `Button variant="ghost"` next to the Select trigger (visible only when `campaignId` is set) that calls `setCampaignId("")`.
- c. Changed `Select value` to use `campaignId || undefined` so Radix shows the placeholder when cleared.
