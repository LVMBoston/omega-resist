

# Fix: iOS Not Rendering Custom Hotspot Icons (Email Links, External Link)

**Date:** 2026-03-02

## 1. Problem

On iOS Safari, the custom PNG icons for `external_link` (yellow/blue arrow) and `email_links` (green envelope+chain) hotspot types render as invisible or broken images in the live deck viewer. The `<img>` tags load bundled Vite asset URLs but iOS Safari either:
- a. Serves a stale cached version from service worker or browser cache (the hashed asset filenames changed when icons were recently replaced)
- b. Silently fails to load the `<img>` and shows nothing — no `onError` fallback exists

The Text and Email icons (also custom PNGs) work because they've been stable longer and are already in iOS's cache.

## 2. Root Cause Analysis

In `InteractiveSlideOverlay.tsx`, the `getHotspotIcon()` function renders custom icons as:
```jsx
<img src={externalLinkIcon} alt="External Link" style={{ ... }} />
```
There is **no `onError` handler** on any `<img>` tag. When iOS Safari fails to load the image (cache miss, stale hash, network issue), the image is invisible with no fallback.

## 3. Fix (Two Parts)

### 3a. Add `onError` fallback to all custom PNG `<img>` icons

In `getHotspotIcon()`, add an `onError` handler to every `<img>` element that swaps in a visible Lucide SVG fallback icon when the PNG fails to load. This ensures the button is always visible and tappable.

**File:** `src/components/InteractiveSlideOverlay.tsx`

For each `<img>` case in the switch (`sms-ios`, `email-ios`, `social-share`, `link-icon`, `play-button`, `email-links`), wrap in a small component or add `onError` that replaces the `<img>` with a known-good SVG icon:

```tsx
case "link-icon":
  return iconWrapper(
    <img 
      src={externalLinkIcon} 
      alt="External Link" 
      style={{ ...imgStyle, filter: 'drop-shadow(...)' }}
      onError={(e) => {
        // Replace broken image with Lucide fallback
        e.currentTarget.style.display = 'none';
        e.currentTarget.parentElement?.appendChild(
          /* render ExternalLink SVG fallback */
        );
      }}
    />
  );
```

A cleaner React approach: use a small `FallbackImg` component with `useState` that flips to a Lucide icon on error.

### 3b. Add cache-busting query parameter to custom icon URLs

Append a build-time version hash or static cache-buster to the `src` attribute to bypass stale iOS caches:

```tsx
<img src={`${externalLinkIcon}?v=2`} ... />
```

This forces iOS Safari to treat the asset URL as new even if a prior version is cached.

## 4. Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `src/components/InteractiveSlideOverlay.tsx` | Create a `FallbackImg` helper component; replace all 6 `<img>` cases in `getHotspotIcon()` with `<FallbackImg>` that shows a Lucide SVG fallback on error; add `?v=2` cache-buster to src URLs |

## 5. No Database or Schema Changes

All fixes are client-side rendering only.

## 6. Testing

- a. Clear iOS Safari cache, open a deck with external_link and email_links hotspots
- b. Verify custom PNG icons render (yellow/blue arrow for links, green envelope for email links)
- c. Simulate image load failure (temporarily break the asset path) — verify Lucide fallback icons appear instead of invisible buttons
- d. Verify existing icons (Text, Email, Social, Play) are unaffected

