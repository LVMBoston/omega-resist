
# Plan — Restore "Email all links" mailbox, then harmonize text rendering

## 1. Diagnosis

The mailbox you see in the Deck Editor is an **action hotspot** of type `email_links` — a clickable icon (`src/assets/email-links-icon.svg`) rendered live by `InteractiveSlideOverlay`. Clicking it builds a `mailto:` with all external-link hotspots on the slide (subject + numbered list) — that wiring already exists in `handleEmailLinks` (`InteractiveSlideOverlay.tsx:840`).

In the snapshot renderer (`supabase/functions/render-stats-snapshot/index.ts:781`), action hotspots are intentionally **excluded** from the SVG bake so they remain interactive client-side overlays:

```ts
const ACTION_TYPES = new Set(["sms", "email", "social", "external_link"]);
const textHotspots = hotspots.filter(h => !ACTION_TYPES.has(h.type) && h.type !== "chart" ...);
```

`email_links` is **missing from this set**, so the SSR treats it as a text hotspot. With no text content it bakes a blank/empty box where the mailbox should be, and that blank box covers/replaces what the live overlay would have drawn. Same root cause on PC and iOS — the snapshot is identical.

The runtime overlay (`InteractiveSlideOverlay`) already handles `email_links` correctly: it draws the mailbox icon, supports the optional label, and clicking it calls `handleEmailLinks(hotspot)` → opens `mailto:` with subject + numbered list of every `external_link` hotspot on the slide.

## 2. Part 1 — Restore the mailbox (do first)

a. **`supabase/functions/render-stats-snapshot/index.ts`** — add `"email_links"` to `ACTION_TYPES` so the snapshot skips baking it. The mailbox then comes from the live overlay on top of the snapshot.

b. **Redeploy `render-stats-snapshot`** and re-snapshot Slide 5 of `thomas-luttig` via the Server Refresh control.

c. **Verify in browser** at the preview URL on a desktop viewport:
   - Mailbox icon appears top-right of Slide 5.
   - Clicking it opens the OS mail composer with subject "Here are the links you requested…" (or the override `emailLinksSubject` if set) and the numbered link list in the body.
   - If `emailLinksShowLabels` is on, the small black caption pill appears under the icon.

d. **Verify on iOS** (user-driven): open `https://omega-resist.lovable.app/deck/thomas-luttig` Slide 5, tap the mailbox, confirm Mail composer opens with the same payload.

e. **No DB / no schema change.** No edits to the editor, overlay, or DeckViewer — those already work.

## 3. Part 2 — Harmonize text rendering (do after Part 1 is confirmed)

This is the larger investigation. Out of scope for this turn beyond noting the approach:

a. **Re-open the Parity Harness** (`src/pages/ParityHarness.tsx` at route `/parity-harness`) — already designed for side-by-side editor (`ManualEntryRenderer`) vs SSR (`renderManualHtml`) comparison across §2.1–§2.7 cases.

b. **Add new cases that mirror Slide 5's actual rendering**: the cream "LINKS" header pill and each cream link pill — centered horizontally, top-aligned vertically, in a wide short box on the noisy gray background. Slide 5's visible drift between editor and SSR (vertical centering vs top-justify on the longer pills) suggests `verticalAlign` + auto-shrink interaction is the divergence.

c. Once a failing case is reproduced in the harness, fix the divergence in **either** `ManualEntryRenderer` **or** `manualHtml.ts` so both algorithms agree.

d. Re-run the harness end-to-end to confirm parity across all sections.

Part 2 will be presented as its own plan once Part 1 is verified.

## 4. Files touched in this plan

| Part | File | Change |
|------|------|--------|
| 1a | `supabase/functions/render-stats-snapshot/index.ts` | Add `"email_links"` to the `ACTION_TYPES` set |

No DB migrations. No frontend edits.

## 5. Decision-log

This is a **new plan**. After implementation, archive as `docs/decisions/snapshots/2026-06-18_email-links-snapshot-passthrough_bug-fix_lovable.md` with `Status: Approved & Implemented`.
