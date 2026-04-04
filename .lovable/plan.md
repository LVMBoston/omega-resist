

# Change Legend Background to Light Yellow

## What
Change the legend container's background from the current semi-transparent white (`bg-background/95`) to a light yellow so the white "Opened" engagement border is clearly visible against the background.

## How

**File**: `src/components/SamizdatMap.tsx`

1a. On line 1564, replace `bg-background/95` with an inline `backgroundColor` style of light yellow (e.g., `#fefce8` — Tailwind's `yellow-50` equivalent in HSL/hex).

Since the project memory requires HSL-only via CSS variables, and there's no semantic yellow token defined, the pragmatic approach is to use an inline style `backgroundColor: "hsl(55, 92%, 95%)"` (equivalent to `yellow-50`) on the legend container div. This keeps it consistent with the HSL-only rule while providing the needed contrast for the white border.

**Single line change** — line 1564:
```
// Before
<div className="bg-background/95 backdrop-blur-sm rounded-md px-2.5 py-1.5 shadow-md border border-border">

// After
<div className="backdrop-blur-sm rounded-md px-2.5 py-1.5 shadow-md border border-border" style={{ backgroundColor: "hsla(55, 92%, 95%, 0.95)" }}>
```

