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

## 3. Real-time map display overhaul

**Observation:** The Samizdat real-time map (`ActivityMap.tsx`) has several UX and narrative issues that degrade the organizer experience when monitoring live campaign activity.

**Deferred work:**
- a. Improve narrative: add contextual storytelling to the map (e.g., "First share in Chicago!", "Viral chain reached 3 levels deep") rather than raw dot clusters.
- b. Fix UI issues: panning the map snaps back — investigate `moveend` save/restore logic and Leaflet state conflicts causing the viewport to reset on interaction.
- c. Improve sequential listing of events in a chain: the current listing does not clearly show the chronological propagation path (L00 → L01 → L02) per `l00_instance`; add a chain-sequence view or overlay that visualizes parent/child relationships and event ordering.

---

## 4. Scope per-hotspot template inheritance with slide-level overrides

**Observation:** Today a slide either has its own `viral_slide_configs` row (which overrides the shared template entirely) or it has none (and renders the shared template verbatim). There is no middle ground. Once a slide is detached — including via Export/Import of a template's hotspots into a deck slide — future edits to the source template never propagate. The Thomas/Luttig deck Slide 5 hit this: its hotspot layout came from `links-landscape` via Export/Import, so it now carries all the manual `live_number` text and link URLs locally, with no link back to the template.

**Deferred work — scoping only, not implementation:**
- a. Define a per-hotspot override model: store slide-level overrides as a patch keyed by hotspot `id`, merged on top of the referenced template at render time.
- b. Decide which fields are overridable vs inherited (e.g. `manualHtml`, `url`, `liveNumberStyle` typically overridden; `iconId`, `type`, position usually inherited).
- c. Spec how Export/Import should record provenance (source template id) so an imported layout can opt into inheritance instead of becoming a hard fork.
- d. Identify all touch points: schema (`viral_slide_configs` or a new overrides table), editor (FullResolutionHotspotEditor — show "inherited from template" badges), DeckViewer renderer, and the SSR snapshot pipeline (`render-stats-snapshot`) — both renderers must stay at parity.
- e. Migration story for existing standalone per-slide rows (like Slide 5) that want to be retroactively re-linked to a template without losing manual edits.
- f. Produce a feature doc under `docs/decisions/templates/` before any implementation work.

**Related:** Slide 5 of `thomas-luttig` deck (per-slide config `754379ce-8871-4df0-bc02-e5201e9f19cc`, source template `links-landscape` `00474742-c45a-4166-80c4-5e99a03fae93`).

---

## 5. Remove campaign-switch crash diagnostics

**Observation:** Defensive guards (try/catch + explanatory comment) were added to the `DataTemplateEditor.tsx` campaign dropdown to investigate a blank-page → bounce-back bug. The actual fix is the `key={campaignId ? '__has__' : '__empty__'}` remount pattern, which prevents the mid-interaction Select remount that caused the crash. The try/catch wrapper and comment are no longer needed.

**Deferred work:**
- a. Create at least 3 new templates and switch the preview Campaign multiple times across different campaigns (including ICE OUT FOR GOOD). Confirm no crash, no bounce-back.
- b. Remove the explanatory comment block (`/* key only flips between … bounce back. */`) around line 764–766 of `src/components/DataTemplateEditor.tsx`.
- c. Remove the `try { … } catch (e) { console.error(...) }` wrapper around `setCampaignId(v)` in the `onValueChange` handler. Restore to a plain `onValueChange={(v) => setCampaignId(v)}`.
- d. Keep the `key={campaignId ? '__has__' : '__empty__'}` pattern intact.
- e. After removal, repeat the verification flow once to confirm no regression.
- f. Archive this entry under `docs/decisions/template-editor/<YYYY-MM-DD>_campaign-switch-crash-guard-removal_feature-doc_lovable.md` with `Status: Approved & Implemented`.

---

---

## 6. Direct PowerPoint (.pptx) import into Deck Builder

**Observation:** The Deck Builder already supports importing slide images via ZIP archives and multi-file selection, plus direct Google Slides import via a connected service account. However, there is no direct `.pptx` upload path. Organizers who receive a PowerPoint file (e.g., from a colleague, from a OneDrive share link, or from PowerPoint's own export) must currently export slides as PNG images first, then ZIP or multi-select those images into the Deck Builder.

A `supabase/functions/import-powerpoint` edge function is already scaffolded in `config.toml` but has no implementation or UI wiring.

**Workaround today (option a):**
- In PowerPoint: File → Export → PNG → Save All Slides.
- In Deck Builder: Use the existing "Image Files" tab (multi-select) or ZIP import. Slides are auto-sorted via natural numeric ordering.

**Deferred work:**
- a. **Direct `.pptx` upload (option b):** Build a "PPTX File" tab in the New Deck / Import flow that accepts a downloaded `.pptx` file, renders each slide to an image (client-side via a library like `pptx2html`/`pptxjs`, or server-side via the existing edge function scaffold), and creates deck slides automatically. Must handle slide ordering, aspect ratio detection, and image compression consistent with the existing import pipeline.
- b. **OneDrive link import (option c):** Wire up a Microsoft OneDrive connector so an organizer can paste a `1drv.ms` or `sharepoint.com` share link. The system would fetch the `.pptx` via Microsoft Graph API, then run the same render pipeline as (a). This requires a Lovable workspace connector for Microsoft/OneDrive and OAuth consent.
- c. **Decide scope:** Evaluate whether (a) alone is sufficient, or if (c) is needed for the primary user workflow. OneDrive share links are common in campaign environments where designers distribute drafts via shared folders.
- d. **Edge function implementation:** Write the body of `supabase/functions/import-powerpoint` if server-side rendering is chosen; otherwise implement client-side `.pptx` parsing.
- e. **UI wiring:** Add the new import tab to the deck creation / import screen, reuse existing natural-sort and re-import purge logic from the ZIP/Image import path.
- f. **Before implementation, produce a feature doc under `docs/decisions/deck-editor/` with `Status: Approved & Implemented` once built.**

**Related:** `supabase/config.toml` line 15 (`[functions.import-powerpoint]`); existing Google Slides import at `supabase/functions/import-google-slides/`.

---

_Add new deferred items as new numbered sections below._

---

## 7. Revisit EoA input form (UTM ID and medium derivation UX)

**Observation:** The form used to create and edit Events/Actions (EoAs) presents the UTM ID and derived medium in ways that confuse organizers. The UTM ID field determines the share channel badge (`via em`, `via sms`, `via qr`), but there is no inline guidance explaining which tokens map to which medium. Organizers enter values like `sv-em-1` expecting an email EoA and see `via qr` because the token does not match exact-keyword or word-boundary rules. The correction path (editing UTM ID, then using Fix channels to rewrite stored URLs) is not obvious.

**Deferred work:**
- a. Evaluate whether the form should show a live preview of the derived medium badge next to the UTM ID input so organizers know what they are creating before saving.
- b. Consider adding a helper tooltip or inline hint listing the keyword tokens that map to each medium (e.g., `em`, `email`, `mail` → email; `sms`, `tx`, `text` → SMS; `qr`, `qrcode` → QR).
- c. Review whether the Mobilize Code / Zip Code selector and UTM ID field layout makes the relationship between Event Code, UTM ID, and medium clear enough.
- d. Decide if the form should warn when a UTM ID will fall back to `qr` because no keyword matched, or if the fallback logic itself should be adjusted.
  - e. Archive any design decision under `docs/decisions/eoa/` once scoped.

---

## 8. PWA fullscreen / "Add to Home Screen" support

**Observation:** When decks are viewed on iOS Safari, the top browser chrome (address bar and bottom toolbar) reduce usable screen area. A previous discussion explored a pseudo-fullscreen approach (collapsing the URL bar via scroll tricks), but the risks (persistent bottom toolbar, fragile behavior, content clipping) outweigh the benefit. The better path is a Progressive Web App (PWA) with `display: standalone`, letting users launch the deck from a home-screen icon in true fullscreen.

**Deferred work:**
  - a. Create a web app manifest (`manifest.webmanifest`) with `display: "standalone"`, app name, short name, theme color, background color, and icon entries.
  - b. Add iOS-specific meta tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`) and `apple-touch-icon` links in the app's HTML head.
  - c. Generate or supply app icons in required sizes for the manifest and iOS touch icon.
  - d. Add a contextual hint (e.g., a toast or inline banner) on iOS Safari explaining how to tap **Share → Add to Home Screen** to install the app.
  - e. Ensure the PWA `start_url` and `scope` encompass both public deck viewer routes (`/s/:deckId`) and the main app so installed launches land correctly.
  - f. Before implementation, review the built-in PWA skill rules (manifest-only vs offline service worker scope) and decide whether this item needs offline caching or strictly installability/home-screen behavior.
  - g. Archive the design decision under `docs/decisions/pwa/` once scoped.

**Related:** Discussion deferred on 2026-06-26. No app code changes yet.

---

## 10. Official start cutoff — follow-up polish

**Observation:** 2026-06-26 we shipped a campaign-level `official_start_at` override. When set, events occurring before that moment are excluded from headline metrics, the deck map (`MapHotspotRenderer` + `get_campaign_map_events` RPC), narratives (`campaignNarrative.ts`), `useLiveMetrics`, `useChartData`, and the SSR snapshot renderer (`render-stats-snapshot`). The default (NULL) preserves the previous behavior of starting at the first event. The control lives on the campaign summary card in `CampaignDetail.tsx`.

**Deferred work:**
  - a. Surface a visible **Pre-launch / test** counter on the Campaign Dashboard (number of events excluded by the cutoff) so admins can sanity-check the cutoff.
  - b. Apply the cutoff to the admin-internal `SamizdatMap` view-events queries (currently still shows pre-launch test data so operators can debug).
  - c. Apply the cutoff to `CampaignDashboard.fetchEvents` and the analytics RPCs (viral coefficient, conversion funnel, amplification, engagement, cycle time) for full reporting consistency.
  - d. Consider a per-EoA override on top of the campaign-level default for cases where one EoA launches earlier than the rest.
  - e. Add an "Official start" badge to the Campaign Dashboard header when the override is set.
  - f. Archive a design decision under `docs/decisions/reporting-start/`.


