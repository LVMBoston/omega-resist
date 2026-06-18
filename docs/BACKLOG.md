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

_Add new deferred items as new numbered sections below._

