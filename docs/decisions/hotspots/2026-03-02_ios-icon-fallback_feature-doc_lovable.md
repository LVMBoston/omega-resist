# Fix: iOS Not Rendering Custom Hotspot Icons (Email Links, External Link)

**Status:** Approved & Implemented  
**Date:** 2026-03-02

## Problem

On iOS Safari, custom PNG icons for `external_link` and `email_links` hotspot types render as invisible/broken. No `onError` fallback existed on `<img>` tags.

## Fix

1. **`FallbackImg` component** — wraps each custom PNG `<img>` with `useState`-based `onError` that swaps in a Lucide SVG fallback icon when the PNG fails to load.
2. **Cache-busting** — appends `?v=2` to all custom icon `src` URLs to bypass stale iOS Safari caches.

## Files Changed

| File | Change |
|------|--------|
| `src/components/InteractiveSlideOverlay.tsx` | Added `FallbackImg` component; replaced all 6 custom PNG `<img>` icons with `<FallbackImg>` + Lucide fallbacks; added `?v=2` cache-buster |

## Fallback Mapping

| iconId | PNG Asset | Lucide Fallback |
|--------|-----------|-----------------|
| `sms-ios` | text-icon.svg | `MessageSquare` (green) |
| `email-ios` | mail-icon.png | `Mail` (green) |
| `social-share` | share-icon.png | `Share2` (green) |
| `link-icon` | external-link-icon.png | `Link2` (yellow) |
| `play-button` | play-button.png | `Play` (green) |
| `email-links` | email-links-icon.png | `MailPlus` (green) |
