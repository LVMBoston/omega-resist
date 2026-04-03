

# Plan: Spawn Count on Intent/Completed Only + Keep Timeline at End

## Changes

### 1. Show spawn count only on intent/completed markers (line 1024)
a. Wrap the spawn count display with an engagement state check: only render when `event.engagementState !== 'none'`.
b. Current: always shows spawn count if > 0.
c. New: only shows on amber (intent) or cyan (completed) markers.

### 2. Keep Timeline control visible when animation completes (line 1416)
a. Current condition: `timelinePosition < 1` hides the timeline box when playback reaches the end.
b. Change to: remove the `timelinePosition < 1` guard so the box stays visible whenever `totalDurationMs > 0 && goLiveTime > 0`.
c. When `timelinePosition === 1`, the box will show the final timestamp, allowing the user to see events that haven't passed the 2-day threshold.

### 3. Update decision document
a. Append an `## Update — 2026-04-03` section to `docs/decisions/deck-editor/2026-04-03_scan-location-timezone-display_feature-doc_lovable.md` documenting both changes.

## Files Modified
- `src/components/SamizdatMap.tsx` (steps 1-2)
- `docs/decisions/deck-editor/2026-04-03_scan-location-timezone-display_feature-doc_lovable.md` (step 3)

