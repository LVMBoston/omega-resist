

# Email Links Hotspot Type (Revised)

**Status**: Proposed
**Date**: 2026-03-01

## Summary

Add an `email_links` hotspot type that collects all `external_link` URLs from sibling hotspots on the same slide and bundles them into a single device `mailto:` link. After the mail client opens, a toast reminds the viewer to share the deck with others via the existing SMS/email share hotspots.

The viral share link is **intentionally excluded** from the email body to avoid giving senders the impression that emailing resource links is a substitute for sharing the deck itself.

---

## 1. Type System Changes — `src/types/viralTemplates.ts`

a. Add `'email_links'` to the `HotspotActionType` union.

b. Add two optional fields to the `Hotspot` interface:
   - `emailLinksSubject?: string` — configurable subject line for the mailto (default: slide label or empty).
   - `emailLinksShowLabels?: boolean` — when true, display the label text visually on the hotspot at runtime (default `false`).

c. The previously proposed `emailLinksIncludeViralLink` field is **removed from the plan**. The viral share URL is never included in the email body.

## 2. Editor — `src/components/FullResolutionHotspotEditor.tsx`

a. Add `'email_links'` to the `IconCategory` type and the category/preset list. Use the Lucide `MailPlus` icon as the visual preset.

b. Set default dimensions and type: `{ type: 'email_links', width: 8, height: 8 }`.

c. When the selected hotspot is `email_links`, render two additional controls in the properties panel:
   - Text input: "Email Subject" (bound to `emailLinksSubject`).
   - Checkbox/switch: "Show label on slide" (bound to `emailLinksShowLabels`).

d. Enforce a constraint of one `email_links` hotspot per slide (multiples are redundant since it already captures all external links).

## 3. Calibration Controls — `src/components/HotspotCalibrationControls.tsx`

a. No changes required — the `email_links` hotspot does not use live-number metrics.

## 4. Runtime — `src/components/InteractiveSlideOverlay.tsx`

a. Add a `handleEmailLinks(hotspot)` function:
   1. Filter sibling hotspots for `type === 'external_link'` that have a non-empty `url`.
   2. Build the body as a numbered list. If the external-link hotspot has a `label`, format as `"1. Label: https://..."`, otherwise just `"1. https://..."`.
   3. Construct `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` and open it via `window.location.href`.
   4. After opening the mailto link, fire a toast: **"Don't forget to share this with people you trust!"** using the existing `useToast` hook with the default (non-destructive) variant and a 6-second duration.

b. Add `'email_links'` to `getHotspotAction()` mapping.

c. Add `'email_links'` to `getHotspotIcon()` mapping (use `MailPlus` icon).

d. When `emailLinksShowLabels` is true, render the hotspot label text visually on the overlay button (same pattern used by `live_number` display).

## 5. Validation — `src/lib/hotspotValidation.ts`

a. No changes needed. Standard bounding-box validation applies.

b. The one-per-slide constraint is enforced in the editor (section 2d).

## 6. Real-World Example — "What Can I Do?" Template

The existing template (slide 9 of `samizdat-deck-3`) has four `external_link` hotspots. Tapping the `email_links` hotspot opens the device mail client with:

### 6a. With labels

```text
Subject: Resources for Action

Body:
1. Find a Group: https://indivisible.org/get-involved/find-a-group/
2. No Kings: https://www.nokings.org/?SQF_SOURCE=50501
3. Fifty Fifty: https://www.fiftyfifty.one/
4. Letters from an American: https://heathercoxrichardson.substack.com/t/read
```

### 6b. Without labels

```text
Subject: Resources for Action

Body:
1. https://indivisible.org/get-involved/find-a-group/
2. https://www.nokings.org/?SQF_SOURCE=50501
3. https://www.fiftyfifty.one/
4. https://heathercoxrichardson.substack.com/t/read
```

### 6c. Post-action toast

After the mail client opens, a toast appears center-screen:

> "Don't forget to share this with people you trust!"

This nudges the viewer back to the SMS/email share hotspots on the same slide without conflating resource-sending with viral sharing.

## 7. Relationship to Cascading Email Templates

This feature is **orthogonal** to the cascading messaging template system (Chapter > Campaign > Global). The `email_links` hotspot constructs its own `mailto:` body from sibling external links and does not invoke `resolve_message_template` or any RPC. The existing `email` share hotspot continues to use the template cascade independently.

## 8. Documentation

a. Create `docs/decisions/hotspots/2026-03-01_email-links-hotspot_feature-doc_lovable.md` with status "Approved & Implemented" after implementation.

---

## No Database Changes

All configuration lives in the existing `hotspots` JSONB column — no migration required.

## Files Changed

| File | Change |
|------|--------|
| `src/types/viralTemplates.ts` | New action type + 2 optional fields |
| `src/components/FullResolutionHotspotEditor.tsx` | New category, preset, config inputs, one-per-slide guard |
| `src/components/InteractiveSlideOverlay.tsx` | `handleEmailLinks()`, icon/action mapping, label display, post-action toast |
| `docs/decisions/hotspots/2026-03-01_email-links-hotspot_feature-doc_lovable.md` | Decision log |

