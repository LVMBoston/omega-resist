# Timeline Playback for Samizdat Map

**Date**: 2026-02-15
**Status**: Implemented

## Problem

The Samizdat map tab on `/campaign-dashboard` had discrete "Time since go-live" bucket buttons (0–1 day, 1–3 days, etc.) that showed events within fixed time windows. This was useful for analysis but didn't support the key use case: **recording time-lapse videos** of a campaign's geographic reach spreading from go-live to present.

## Solution

Replaced the bucket buttons with a continuous timeline slider and animation playback system:

### UI Controls
- **Slider**: Continuous position from 0 (go-live) to 1 (latest event), with cumulative event display
- **Play/Pause**: Auto-advances slider using `requestAnimationFrame`
- **Speed selector**: 1x, 2x, 5x, 10x (1x = ~30 seconds real-time for full playthrough)
- **Reset**: Returns slider to position 0
- **Running counter**: "Events: visible / total"

### Architecture

```text
+-----------------------------------------------+
| Time since go-live                         [-] |
|                                                |
|  [|<<]  [> Play]  Speed: [1x] [2x] [5x] [10x]|
|                                                |
|  Go-live |======O-----------| Now              |
|           2d 6h          Events: 47 / 312      |
+-----------------------------------------------+
```

### Key Design Decisions

1. **Cumulative, not windowed**: Slider shows ALL events from go-live up to the slider position, not events within a moving window. This matches the mental model of "campaign reach growing over time."

2. **30-second normalization**: A full 1x playthrough always takes ~30 seconds of real time regardless of campaign duration (1 day or 30 days). This makes recordings predictable and professional.

3. **Naive date parsing**: Reuses the `parseNaiveDate` helper from `dateUtils.ts` to parse floating local time strings without timezone conversion, consistent with the rest of the application.

4. **Downstream compatibility**: The slider position simply replaces the time-window filter. All downstream features (markers, clustering, chain filtering, channel filtering, viewport stats, Event Story Panel) continue to work unchanged.

5. **Ease-in animation curve**: The playback rate follows `rate(t) = 0.25 + 1.5t`, where `t` is the current timeline position. This makes early events appear slowly (0.25x at start) and accelerates through the campaign's later stages (1.75x at end). The integral over [0,1] equals 1.0, preserving the ~30-second total playthrough. This creates a cinematic effect where individual seed events are visible early on, then the viral spread visually "explodes."

## Files Changed

| File | Change |
|------|--------|
| `src/lib/dateUtils.ts` | Added `parseNaiveDate` and `formatElapsedTime` helpers |
| `src/components/SamizdatMap.tsx` | Replaced bucket filter with timeline slider + playback controls |

## Removed Code

- `TimeWindow` type
- `TIME_WINDOW_OPTIONS` constant
- `timeWindow` state variable
- Discrete button group UI in the "Time since go-live" accordion
- Duplicated naive date parsing logic (replaced with shared `parseNaiveDate`)
