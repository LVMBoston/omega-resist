

# Fixing Vertical Alignment Issue in html2canvas Snapshot Capture

## Problem Analysis

After multiple failed attempts to fix the vertical alignment issue, we've identified a fundamental problem with the current approach:

### Why Previous Attempts Failed

1. **CSS `transform: translateY(-3px)`** - `html2canvas` does not reliably apply CSS transforms when computing element positions
2. **`marginTop: '-4px'`** - Margins don't work on absolute-positioned elements using percentage-based `top`
3. **Modifying `style.top` percentage** - While this *should* work, the modification is happening *after* `html2canvas` has already computed the layout

### The Root Cause

The issue is **timing and reflow**:

```text
Current Flow:
                                                         
  2-second delay ──► Modify DOM styles ──► Call html2canvas() immediately
                                           ▲
                                           │
                           Browser may not have repainted yet
```

When we modify `element.style.top`, the browser schedules a reflow, but `html2canvas` may snapshot the DOM before the browser actually updates the layout.

---

## Solution: Force Browser Reflow Before Capture

We need to force the browser to synchronously recompute layout before `html2canvas` starts capturing. This is done by reading a layout property (like `offsetHeight`) after making style changes, which forces a synchronous reflow.

### Implementation Steps

**File: `src/lib/snapshotCapture.ts`**

1. After modifying the `style.top` values on hotspot elements, **force a browser reflow** by reading a layout property
2. Add a small `requestAnimationFrame` delay to ensure the paint cycle completes
3. Use a more aggressive offset value (~1%) since the current 0.5% appears insufficient

```text
New Flow:

  2-second delay ──► Modify DOM styles ──► Force reflow ──► Wait for rAF ──► html2canvas()
                                              │                  │
                              Read offsetHeight        Ensure paint completed
```

### Code Changes

```typescript
// After modifying styles, force browser to recompute layout
const hotspotElements = containerElement.querySelectorAll('[data-hotspot-overlay]');
const originalTops: string[] = [];
hotspotElements.forEach((el, i) => {
  const htmlEl = el as HTMLElement;
  originalTops[i] = htmlEl.style.top;
  const currentTop = parseFloat(htmlEl.style.top) || 0;
  htmlEl.style.top = `${currentTop - 1}%`;  // Increased from 0.5%
});

// CRITICAL: Force synchronous reflow
void containerElement.offsetHeight;

// Wait for browser paint cycle to complete
await new Promise((resolve) => requestAnimationFrame(resolve));
await new Promise((resolve) => setTimeout(resolve, 50)); // Extra safety margin

// Now call html2canvas - layout is guaranteed to be updated
const canvas = await html2canvas(containerElement, { ... });
```

---

## Alternative Approach (if reflow forcing doesn't work)

If the reflow approach fails, we should investigate whether `html2canvas` is capturing a **stale cached image** from the storage URL. The browser may be caching the old snapshot.

### Debugging Steps

1. Add a cache-busting query parameter to the snapshot URL when viewing
2. Check the `snapshot_rendered_at` timestamp vs the actual file modification time
3. Verify the console logs show the correct number of hotspots being modified

---

## Technical Details

| Change | File | Description |
|--------|------|-------------|
| Force reflow | `src/lib/snapshotCapture.ts` | Add `void containerElement.offsetHeight` after style modifications |
| Add rAF delay | `src/lib/snapshotCapture.ts` | Use `requestAnimationFrame` before capture |
| Increase offset | `src/lib/snapshotCapture.ts` | Change from -0.5% to -1% for more visible correction |
| Add logging | `src/lib/snapshotCapture.ts` | Log actual computed `top` values before/after modification |

---

## Expected Outcome

After implementation, the hotspots in the captured WebP snapshot should align with where they appear on screen in the live editor. The ~1% vertical offset (approximately 7-8px on a 700px container) should compensate for the html2canvas rendering discrepancy.

