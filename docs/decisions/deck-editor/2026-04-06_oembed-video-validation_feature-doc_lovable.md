# oEmbed Video URL Validation with Thumbnail Preview

**Status: Approved & Implemented**  
**Date: 2026-04-06**

## Problem

Users cannot test whether a YouTube or Vimeo URL is valid and embeddable without publishing the deck first. The Lovable preview iframe sandbox blocks video embeds, so there is no way to confirm a link works during editing.

## Solution

Add a client-side oEmbed validation step to the hotspot editor. When a user enters a YouTube or Vimeo URL, the system calls the platform's public oEmbed JSON endpoint (no API key required) and displays a small preview card with the video's title and thumbnail — confirming the URL is valid without needing to render the player.

## Changes

### 1. New file: `src/lib/oEmbedValidation.ts`
- `fetchOEmbed(url)` — detects provider, calls oEmbed endpoint, returns `{ title, thumbnailUrl, provider }` or `null`.
- `detectVideoProvider(url)` — returns `"youtube"`, `"vimeo"`, or `null`.
- 5-second fetch timeout with `AbortController`.

### 2. Updated: `src/components/FullResolutionHotspotEditor.tsx`
- Added `oEmbedResult`, `oEmbedLoading`, `oEmbedError` state.
- Debounced `useEffect` (800ms) triggers `fetchOEmbed` when the URL changes for `vimeo` or `youtube` hotspot types.
- Renders a preview card below the URL input: thumbnail (120px), title, provider badge.
- "Test URL" button shows a green checkmark when oEmbed validation succeeded.

## Backward Compatibility
- No schema or database changes.
- Only affects the editor UI for video-type hotspots.
- `external_link` hotspots are unaffected.
