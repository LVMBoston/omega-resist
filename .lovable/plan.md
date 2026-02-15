

# Add Ease-In Animation Curve to Timeline Playback

## Overview

Replace the linear animation advancement with an ease-in curve so playback starts slow (early seeds trickle in one by one) and gradually accelerates (campaign "explodes" as viral reach compounds). Total playthrough time stays ~30 seconds at 1x.

## Changes

### File 1: `src/components/SamizdatMap.tsx`

One-line change at line 393 inside the animation step function:

```typescript
// Before (linear):
const scaledFraction = (deltaMs / 30000) * playbackSpeed;

// After (ease-in):
const easeMultiplier = 0.25 + 1.5 * prev;
const scaledFraction = (deltaMs / 30000) * playbackSpeed * easeMultiplier;
```

The `prev` value is already available inside the `setTimelinePosition` updater callback (line 394). The easing formula `0.25 + 1.5 * t` integrates to 1.0 over `[0, 1]`, keeping total duration unchanged. At the start (t=0), rate is 0.25x (4x slower than linear). At the end (t=1), rate is 1.75x (nearly 2x faster than linear).

### File 2: `docs/investigations/hotspot/2026-02-15_timeline-playback-samizdat.md`

Add a new section after "Key Design Decisions" item 4 documenting the easing curve:

```markdown
5. **Ease-in animation curve**: The playback rate follows `rate(t) = 0.25 + 1.5t`, where `t` is the current timeline position. This makes early events appear slowly (0.25x at start) and accelerates through the campaign's later stages (1.75x at end). The integral over [0,1] equals 1.0, preserving the ~30-second total playthrough. This creates a cinematic effect where individual seed events are visible early on, then the viral spread visually "explodes."
```

## Files Changed

| File | Change |
|------|--------|
| `src/components/SamizdatMap.tsx` | Add ease-in multiplier to animation step |
| `docs/investigations/hotspot/2026-02-15_timeline-playback-samizdat.md` | Document easing curve design decision |
