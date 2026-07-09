# Honest Campaign Story text

Status: Approved & Implemented
Date: 2026-07-08

## Scope

Strip two dishonest lines from the Campaign Story formatter that both
appeared in the rendered public-path output for `nk3-invitation`
(and every other campaign, since they were unconditional):

1. "including return visits" — appended to the view-events sentence
   in the BREADTH paragraph.
2. "Fastest share: …" — the `⚡` paragraph near the end.

Neither is knowable from the schema. The system has no person
identity and no return-visit dedup; the deepest chain in these
campaigns is single-carrier persistence, so timing it framed one
person's solo thread as viral spread.

## Changes

### 1. `supabase/functions/_shared/render/campaignStory.ts`

- BREADTH sentence now ends `…view events across every level.` No
  substitute wording — view-event person-ness is unknowable.
- `speedNarrative` construction block deleted, `⚡ ${speedNarrative}`
  emit block deleted.
- `propagationSpeed`, `speedOriginCity`, `speedDestCity` remain in
  `CampaignStoryInput` unused, for a follow-up cleanup that also
  rips them out of `computeCampaignStoryInputs`.

### 2. `src/shared/render/campaignStory.test.ts`

- Removed `"formats speed narrative with origin/destination cities"`.
- Added `"never emits the retired 'return visits' or 'Fastest share'
  phrasing"` — asserts case-insensitive absence of `return visit`,
  literal absence of `Fastest share`, and absence of the `⚡` glyph,
  including on a fixture with `propagationSpeed` populated.

### 3. `scripts/dump-campaign-stories.ts`

New. Renders the story for a fixed set of campaign codes and writes
each to `/mnt/documents/campaign-stories/<code>.md`. Uses the
admin session's access token via the anon client so RLS lets geo
through the same way the editor does.

## Anon geo path — deliberately NOT changed

`FridgeStory.tsx` (`/fs/:token`) is the only anon-facing live caller
of `computeCampaignStoryInputs`. `url_events` RLS is admin/manager
only for `SELECT`, so an anon visitor there would silently see zeros
for geo, zip, state, international, and view-event counts. Since the
fridge capability is not in use, no anon visitor is currently
affected. Closing the hole (a `SECURITY DEFINER` RPC that returns
just the aggregate counts) is a follow-up, gated on the fridge sheet
going live.

Other renderers are safe:

- Deck slides (`StatsPageSlide`, `HybridSlide`) render pre-baked
  snapshot text from `render-stats-snapshot`, which runs under
  `service_role`.
- Editor, `/parity-harness`, `exportCampaignXlsx` — admin/manager
  sessions.

## Verification

- `bunx vitest run src/shared/render/campaignStory.test.ts` → 11
  passed, including the two new negative assertions.
- `rg -n "return visit|Fastest share" supabase/functions/_shared/render
  src/shared/render` → only the negative-assertion test references
  the phrases.
- Rendered stories saved at
  `/mnt/documents/campaign-stories/nk3-invitation.md` and
  `/mnt/documents/campaign-stories/rs-good-1.md`. Both read clean.

## Where to see the fixed text

- Editor Campaign Story hotspot on any campaign.
- `/parity-harness`.
- `/mnt/documents/campaign-stories/*.md`.
- Deck slides using `StatsPageSlide` / `HybridSlide` after the next
  scheduled snapshot re-bake.
- `/fs/:token` — text will be correct if/when the fridge capability
  is used, subject to the anon-geo follow-up above.
