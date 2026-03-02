# Fix: iOS Not Rendering Custom Hotspot Icons (Email Links, External Link)

**Status:** Approved & Implemented  
**Date:** 2026-03-02

## Problem

On iOS Safari, custom PNG icons for `external_link` and `email_links` hotspot types render as invisible/broken. No `onError` fallback existed on `<img>` tags.

## Fix (v1 — superseded)

1. **`FallbackImg` component** — wraps each custom PNG `<img>` with `useState`-based `onError` that swaps in a Lucide SVG fallback icon when the PNG fails to load.
2. **Cache-busting** — appends `?v=2` to all custom icon `src` URLs to bypass stale iOS Safari caches.

## Update — 2026-03-02

**Problem with v1:** iOS Safari loads PNGs with HTTP 200 but fails to render them visually. `onError` never fires, so the fallback SVG never appears.

**Fix (v2):**
1. Added `const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)` to detect iOS devices.
2. `FallbackImg` initializes `useState(isIOS)` — on iOS, the Lucide SVG renders immediately without attempting the PNG.
3. Removed `ICON_CACHE_BUSTER` (`?v=2`) — no longer needed since iOS skips PNGs entirely.
4. Desktop/Android still renders custom PNGs with `onError` fallback as safety net.

## Files Changed

| File | Change |
|------|--------|
| `src/components/InteractiveSlideOverlay.tsx` | Added `isIOS` const; `FallbackImg` defaults to fallback on iOS; removed `ICON_CACHE_BUSTER` |

## Fallback Mapping

| iconId | PNG Asset | Lucide Fallback |
|--------|-----------|-----------------|
| `sms-ios` | text-icon.svg | `MessageSquare` (green) |
| `email-ios` | mail-icon.png | `Mail` (green) |
| `social-share` | share-icon.png | `Share2` (green) |
| `link-icon` | external-link-icon.png | `Link2` (yellow) |
| `play-button` | play-button.png | `Play` (green) |
| `email-links` | email-links-icon.png | `MailPlus` (green) |
