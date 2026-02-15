
# Timeline Playback for Samizdat Map

## Overview

Replace the discrete "Time since go-live" bucket buttons with a continuous timeline slider and animation playback system. This enables recording time-lapse videos of a campaign's geographic reach, showing events appearing progressively on the map from go-live to present.

## User Experience

The current five discrete buttons ("0-1 day", "1-3 days", etc.) will be replaced with a continuous slider and playback controls inside the same "Time since go-live" accordion section:

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

- **Slider**: Dragging moves through campaign time from go-live to "Now". The map shows all events that occurred up to the slider's point (cumulative).
- **Play/Pause**: Auto-advances the slider from current position to the end.
- **Speed selector**: Controls animation speed (1x, 2x, 5x, 10x).
- **Reset**: Jumps slider back to start (time = 0).
- **Running counter**: Shows "Events: visible / total" so viewers see the scale.
- The "Activity by Share Medium" table and all other map features continue to work -- they read from the same filtered event list.

## Technical Plan

### File 1: `src/lib/dateUtils.ts`

Add a new `formatElapsedTime` helper:

```typescript
/**
 * Format elapsed milliseconds as compact label.
 * Examples: "0m", "45m", "2h 15m", "1d 3h", "7d"
 */
export const formatElapsedTime = (ms: number): string => {
  if (ms < 0) return "0m";
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  const remMinutes = minutes % 60;

  if (days > 0 && remHours > 0) return `${days}d ${remHours}h`;
  if (days > 0) return `${days}d`;
  if (hours > 0 && remMinutes > 0) return `${hours}h ${remMinutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
};
```

### File 2: `src/components/SamizdatMap.tsx`

#### State changes

Remove:
- `TimeWindow` type and `TIME_WINDOW_OPTIONS` constant
- `timeWindow` state variable

Add:
- `timelinePosition: number` (0 to 1, default 1.0 meaning "show all")
- `isPlaying: boolean` (default false)
- `playbackSpeed: number` (default 1)

#### Computed values (memoized)

- `goLiveTime`: earliest value from `eoaStartDates` (already computed)
- `latestEventTime`: latest `occurredAt` across all `eventPoints`
- `totalDurationMs`: `latestEventTime - goLiveTime`
- `currentCutoffMs`: `goLiveTime + (totalDurationMs * timelinePosition)`

#### Filter logic replacement

Replace all time-window bucket filtering in `filteredEventPoints` and `timeFilteredEvents` with:

```typescript
// Cumulative: show all events from go-live up to the slider position
const cutoffTime = goLiveTime + (totalDurationMs * timelinePosition);
filtered = filtered.filter(event =>
  parseNaiveDate(event.occurredAt).getTime() <= cutoffTime
);
```

Extract the existing naive date parsing (lines 312-333) into a small reusable helper to avoid duplication.

#### Animation loop

```typescript
useEffect(() => {
  if (!isPlaying) return;
  let rafId: number;
  let lastTime: number | null = null;

  const step = (timestamp: number) => {
    if (lastTime !== null) {
      const deltaMs = timestamp - lastTime;
      // Map real-time to campaign-time fraction
      const fraction = (deltaMs * playbackSpeed) / (totalDurationMs || 1);
      // Clamp: advance but don't exceed 30s real-time for full playthrough at 1x
      const scaledFraction = (deltaMs / 30000) * playbackSpeed;
      setTimelinePosition(prev => {
        const next = prev + scaledFraction;
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return next;
      });
    }
    lastTime = timestamp;
    rafId = requestAnimationFrame(step);
  };

  rafId = requestAnimationFrame(step);
  return () => cancelAnimationFrame(rafId);
}, [isPlaying, playbackSpeed, totalDurationMs]);
```

The animation is designed so a full playthrough at 1x takes ~30 seconds of real time regardless of campaign duration, making it suitable for video recording.

#### UI replacement

Replace the button group in the "Time since go-live" accordion (lines 1208-1221) with:

1. **Control row**: Reset button, Play/Pause button, Speed selector (four small buttons: 1x/2x/5x/10x)
2. **Slider row**: Radix Slider from 0 to 1 with step 0.001
3. **Info row**: Elapsed time label (using `formatElapsedTime`) and event counter ("Events: N / M")

### File 3: `docs/investigations/hotspot/2026-02-15_timeline-playback-samizdat.md`

Create documentation recording the feature design and implementation rationale.

## Files Changed

| File | Change |
|------|--------|
| `docs/investigations/hotspot/2026-02-15_timeline-playback-samizdat.md` | New: feature documentation |
| `src/lib/dateUtils.ts` | Add `formatElapsedTime` helper |
| `src/components/SamizdatMap.tsx` | Replace bucket filter with timeline slider + playback controls |
