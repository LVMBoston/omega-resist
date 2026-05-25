# Backlog — Deferred Items

Status: Living document
Purpose: Track known issues and enhancements that are deliberately deferred (not bugs to fix immediately, not yet scheduled).

Items use numbered sections and lettered sub-items per project convention.

---

## 1. iOS SVG icon rendering inconsistency

**Observation:** Custom SVG asset icons (e.g. `src/assets/text-icon.svg` for SMS) render differently on iPhone Safari than on Mac. Currently mitigated by `InteractiveSlideOverlay.tsx` falling back to Lucide icons (MessageSquare, Mail, Share2, etc.) on iOS via UA detection.

**Deferred work:**
- a. Investigate why custom SVG assets fail to render visually on iOS Safari (HTTP 200, no `onError`, but no pixels).
- b. Decide between: (i) restyle Lucide iOS fallbacks to visually match the Mac Apple-style icons (green rounded square + white bubble for SMS, etc.) for cross-platform consistency, or (ii) fix the underlying SVG asset so iOS renders it natively and remove the Lucide fallback path.
- c. If (i) is chosen, update fallback icon styling in `InteractiveSlideOverlay.tsx`.
- d. If (ii) is chosen, inspect each affected SVG (viewBox, dimensions, embedded styles, `<use>` refs) and remove the UA-gated fallback.

**Related:** iOS fallback decision doc (2026-03-02).

---

## 2. Real-time map jittered coordinate rendering

**Observation:** Jittered coordinates (used to anonymize/spread out co-located markers on the Samizdat map) have remaining rendering items not yet implemented.

**Deferred work:** _To be filled in — capture the specific sub-items (e.g. jitter radius tuning per zoom level, deterministic seeding, cluster-aware jitter, jitter visibility in chain mode, animation of jittered positions, legend/tooltip clarification that the position is approximate) when this is picked up._

---

_Add new deferred items as new numbered sections below._
