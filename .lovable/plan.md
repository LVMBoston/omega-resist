

# Plan: Fix Inverted "No Spawns" Toggle + Staleness Filter During Playback

## Diagnosis

The 48-hour staleness filter never activates because the toggle semantics are inverted:

1. **Parent dashboard** has checkbox "Show events having no spawns" — `checked=true` means "show all" (skip filter). Default: `searchParams.get("showNoSpawns") !== "false"` → defaults to `true` → filter OFF.
2. **Map switch** labeled "No Spawns" syncs from parent via `showNoSpawnsLocal`. When `showNoSpawnsLocal === true`, the filter on line 357 (`if (!showNoSpawnsLocal)`) is **skipped**.
3. **User expectation**: When the "No Spawns" toggle is ON, they expect stale no-spawn markers to be hidden. But the code does the opposite — ON means "show everything including no-spawn markers."

Both events at ZIP 98848 have `engagementState === "none"` (zero children confirmed in DB). The filter would correctly remove them after 48h **if it ran**, but the inverted toggle prevents it from ever executing.

## Changes

### 1. Fix the map toggle to match user intent
   a. In the staleness filter (line 357), change `if (!showNoSpawnsLocal)` to `if (showNoSpawnsLocal)` — when the "No Spawns" toggle is ON, the 48-hour filter should be ACTIVE.
   b. In the `stalenessTick` interval (line 268), change `if (showNoSpawnsLocal) return;` to `if (!showNoSpawnsLocal) return;` — only tick when filter is active.
   c. Update the map switch label from "No Spawns" to "Hide stale opens" for clarity.

### 2. Fix the parent dashboard checkbox to match
   a. In `CampaignDashboard.tsx` (line 189), review whether the default should change. Currently `showNoSpawns !== "false"` defaults to `true` (show all). This is correct as a default — users see everything until they opt in to filtering.
   b. Ensure the prop passed to `SamizdatMap` (`showNoSpawns={showNoSpawns}`) has consistent semantics with the map's internal toggle after the fix in step 1.
   c. Since the parent checkbox says "Show events having no spawns" (checked=show, unchecked=hide), and the map toggle is being renamed "Hide stale opens" (checked=hide, unchecked=show), the inversion should happen at the sync point: `setShowNoSpawnsLocal(!showNoSpawns)` on the `useEffect`, so that parent-checked (show all) → map-unchecked (don't hide) and parent-unchecked (hide) → map-checked (hide).

### 3. Unify the two timeline epoch computations
   a. The filter (line 343-345) computes `goLive` and `latestEvent` from channel-filtered events.
   b. The display (line 431-434) computes from all `eventPoints`.
   c. Change the filter to use the same `goLiveTime` and `totalDurationMs` from the display memo, ensuring the displayed date matches the actual cutoff used for staleness. This prevents a scenario where the displayed date says "Mar 30" but the filter reference time is actually "Mar 28."

### 4. Update decision document
   a. Append `## Update — 2026-04-03 (Staleness Toggle Fix)` section to `docs/decisions/deck-editor/2026-04-03_scan-location-timezone-display_feature-doc_lovable.md`.

## Files Modified
- `src/components/SamizdatMap.tsx` (steps 1, 3)
- `src/pages/CampaignDashboard.tsx` (step 2)
- `docs/decisions/deck-editor/2026-04-03_scan-location-timezone-display_feature-doc_lovable.md` (step 4)

## Verification
- a. Browser test: toggle "Hide stale opens" ON, play timeline past Mar 29 4:33 AM, confirm ZIP 98848 marker disappears.
- b. Browser test: toggle OFF, confirm marker persists through entire playback.
- c. Confirm parent dashboard checkbox and map toggle stay in sync.

