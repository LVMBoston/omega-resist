

## Plan: Add oEmbed Video URL Validation with Thumbnail Preview

### What it does
When a user enters a YouTube or Vimeo URL in the hotspot editor, the system calls the platform's public oEmbed endpoint to fetch the video's title and thumbnail. A small preview card appears below the URL input confirming the video is valid and embeddable — no publishing required.

### Changes

**1. Create `src/lib/oEmbedValidation.ts`** (new file)
   a. Export `fetchOEmbed(url: string): Promise<{ title: string; thumbnailUrl: string; provider: string } | null>`
   b. Detect provider from URL using existing patterns (`youtube.com`, `youtu.be`, `vimeo.com`)
   c. Call the public oEmbed JSON endpoints (no API key needed):
      - YouTube: `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      - Vimeo: `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`
   d. Return parsed `{ title, thumbnailUrl, provider }` or `null` on error
   e. Use a simple `fetch` with a 5-second timeout; catch errors gracefully

**2. Update `src/components/FullResolutionHotspotEditor.tsx`**
   a. Add state: `oEmbedResult` (title + thumbnail + provider | null), `oEmbedLoading` (boolean), `oEmbedError` (string | null)
   b. Add a debounced `useEffect` (800ms) that triggers `fetchOEmbed` whenever `selectedHotspotData.url` changes and the hotspot type is `vimeo` or `youtube`
   c. Below the URL `<Input>` (line ~757), render a preview card:
      - **Loading**: small spinner + "Validating…"
      - **Success**: thumbnail image (120px wide), video title text, provider badge
      - **Error**: red text "Could not validate this URL — check that it's a valid YouTube or Vimeo link"
   d. Replace the "Test URL" button section (lines 777-796) for video types: keep the button but add a green checkmark icon when oEmbed succeeded, indicating the URL is confirmed embeddable

**3. No backend or database changes required**
   - oEmbed endpoints are public, CORS-friendly, and require no API keys

### Backward compatibility
- No schema changes; purely a UI enhancement in the editor
- Existing `external_link` URLs are unaffected (oEmbed only fires for video types)

### Decision doc
- Save as new file: `docs/decisions/deck-editor/2026-04-06_oembed-video-validation_feature-doc_lovable.md`

