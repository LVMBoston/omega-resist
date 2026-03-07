

# Fix: Campaign Select "Clear selection" Not Working

**Date:** 2026-03-07

---

## 1. Root Cause

Radix UI `Select` ignores empty string values. Setting `campaignId` to `""` doesn't reset the displayed trigger text — it keeps showing the previously selected campaign.

## 2. Fix

Replace the `__clear__` `SelectItem` hack with an explicit clear button next to the Select trigger. When clicked, it sets `campaignId` to `""` and also clears the metrics map.

### 2a. File: `src/components/DataTemplateEditor.tsx`

- a. Remove the `__clear__` `SelectItem` from inside `SelectContent`.
- b. Add a small "X" button next to the Select trigger (visible only when `campaignId` is set) that calls `setCampaignId("")`.
- c. Change `Select value` to use `campaignId || undefined` so Radix shows the placeholder when cleared.

### 3. Implementation Detail

```text
Before:  [Select with __clear__ item inside dropdown]
After:   [Select (value={campaignId || undefined})]  [X button]  [Refresh button]
```

The X button is a simple `Button variant="ghost"` with an X icon, conditionally rendered when `campaignId` is truthy.

