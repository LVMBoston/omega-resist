# Landscape Carousel Snap & Fill Fix

**Status: Approved & Implemented**
**Date: 2026-06-05**

## Problem

On mobile in landscape:
1. Deck didn't visually fill the screen.
2. Swiping drifted/floated instead of snapping cleanly to the next slide.

## Root Causes

1. **Outer wrapper used `min-h-screen` (100vh).** On iOS landscape, 100vh exceeds 100dvh used by `<main>`, making the page taller than the visible area. Swipe gestures scrolled the outer page instead of advancing Embla.
2. **Embla never re-measured after `orientationchange`.** The reflow handler triggered layout reads but didn't call `carouselApi.reInit()`, leaving Embla with stale viewport math after rotation.
3. **Embla never re-measured after async orientation detection.** Embla initializes with the portrait container class; when `setOrientation('landscape')` fires later (after first image loads), Embla retains the old measurements.

## Fix (`src/pages/DeckViewer.tsx`)

1. Removed `min-h-screen` from the outer wrapper so it shrink-wraps `<main>` (which already uses `100dvh`).
2. Added `carouselApi?.reInit()` inside the `orientationchange` setTimeout; added `carouselApi` to the effect's deps.
3. Added a new `useEffect` keyed on `[carouselApi, orientation]` that calls `carouselApi.reInit()` whenever detected orientation changes.

## Follow-up (not implemented)

Consider persisting `orientation` on the deck record at creation time to skip async detection and eliminate the portrait-flash on first paint for landscape decks.
