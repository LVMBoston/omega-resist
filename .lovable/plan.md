

# Add Visible Debug Overlay to Data Template Snapshot Path

## Goal
Add a temporary, visible diagnostic banner on the StatsPageSlide so you can compare what each device (iPad vs iPhone) is resolving -- without needing to connect dev tools.

## What the overlay will show
A small semi-transparent banner at the top of the slide displaying:
- **Campaign code** resolved (e.g., `qr`, `bugtest`, `no-kings`)
- **Snapshot URL** being loaded (truncated)
- **Status**: "Loading snapshot...", "Snapshot loaded OK", or "SNAPSHOT 404 -- FELL BACK TO DYNAMIC"
- **Token** passed in (the `viralToken` prop)
- **Device** type detected (mobile/desktop)

## Where the changes go
**File: `src/components/StatsPageSlide.tsx`**

1. Add a new state variable `snapshotStatus` (string) to track: `"loading"`, `"ok"`, `"failed-fallback"`
2. In the snapshot `<img>` block (line 337-345):
   - Add an `onLoad` handler to set status to `"ok"`
   - Update the existing `onError` handler to also set status to `"failed-fallback"`
3. Render a small fixed-position debug banner at the top of the slide container showing the diagnostic fields listed above
4. The banner will appear on BOTH the snapshot path and the dynamic fallback path so you can immediately see which rendering mode each device chose

## How to use it
1. Scan the same QR code on both iPad and iPhone
2. Compare the debug banners -- specifically the **campaign code** and **snapshot status**
3. If the campaign codes differ, that confirms the non-deterministic `limit(1)` query is the root cause
4. If one shows "SNAPSHOT 404 -- FELL BACK TO DYNAMIC" while the other shows "Snapshot loaded OK", that confirms the snapshot path divergence

## Cleanup
This overlay is purely diagnostic. Once the root cause is confirmed, it will be removed.

