# Plan: Honest Campaign Story text + rendered diffs for review

## 1. Text fixes in `supabase/functions/_shared/render/campaignStory.ts`

a. **Remove "including return visits."** In the breadth paragraph, the clause after `viewCount !== broadcastOpens` becomes: `All told, the content generated N view events across every level.` No substitute wording — view-event person-ness is unknowable, so no distinct fact replaces it.

b. **Remove the "Fastest share" paragraph entirely.** Delete the `speedNarrative` construction block (lines ~139–156) and the `⚡ ${speedNarrative}` emit block (lines ~284–287). Rationale: the deepest chain is single-carrier persistence, so timing it advertises one person's solo thread as spread and contradicts the persistence paragraph above.

c. Leave `propagationSpeed`, `speedOriginCity`, `speedDestCity` in the `CampaignStoryInput` type unused for now. Ripping them out of the input layer is a separate cleanup.

## 2. Test updates in `src/shared/render/campaignStory.test.ts`

a. Drop the `"formats speed narrative with origin/destination cities"` test.
b. Adjust the breadth-line expectation to no longer assert the removed `return visits` clause.
c. Add a universal negative assertion on the default fixture: no rendered story contains the substring `return visit` (case-insensitive).
d. Add a universal negative assertion on the default fixture: no rendered story contains `Fastest share`.

## 3. Render-dump script for eyeball review

Add `scripts/dump-campaign-stories.ts`, runnable with `bunx tsx scripts/dump-campaign-stories.ts`. It:

a. Uses the service-role key (already in `SUPABASE_SERVICE_ROLE_KEY` sandbox env) to bypass RLS and get real geo, matching what an admin sees in-app.
b. Runs for the two campaign codes `nk3-invitation` and `rs-good-1`.
c. Writes rendered output to `/mnt/documents/campaign-stories/<code>.md` so both files show up as downloadable artifacts.
d. Prints the full text to stdout so the build-mode reply can paste it inline.

## 4. Verification (build mode)

a. `bunx vitest run src/shared/render/campaignStory.test.ts` — must pass, including the two new negative assertions.
b. Run the dump script; paste the full rendered text of both campaigns into the reply so you can read it directly. Visual check: no `return visit`, no `Fastest share`.
c. `rg -n "return visit|Fastest share" supabase/functions/_shared/render` — expect no hits.

## 5. Where you can see the renders after this ships

a. Editor: any campaign detail page rendering the Campaign Story hotspot.
b. `/parity-harness` — renders `formatCampaignStory` for all campaigns side-by-side.
c. Deck slides using `StatsPageSlide` / `HybridSlide` pick up the change after the next snapshot re-bake (SSR path uses the same formatter).
d. `/mnt/documents/campaign-stories/*.md` — the dump-script output attached to the build-mode reply.
e. `/fs/:token` public path — will also carry the fixed text if/when you use fridge sheets.

## What does NOT change this turn

- **Anon geo hole on `/fs/:token`.** Confirmed via grep: `FridgeStory.tsx` is the only anon-facing live caller of `computeCampaignStoryInputs`. All other renderers are admin/manager sessions or run under `service_role` (snapshot renderer). Since you are not currently using the fridge capability, no anonymous visitor is silently seeing zero geo today. The RPC-backed fix stays a follow-up until fridge sheets go live.
- `url_events` RLS — unchanged, admin/manager-only.
- Snapshot re-render trigger — public path is live via the editor; deck-slide snapshots refresh on the normal cron.
- `sproutCount` — already stripped in a previous turn.
- `speedOriginCity` / `speedDestCity` / `propagationSpeed` input plumbing — left in place, unused, for a follow-up cleanup.

## Decision-log archive

New plan → `docs/decisions/campaign-story/2026-07-08_honest-story-text_feature-doc_lovable.md` with `Status: Approved & Implemented` header. This is a **new plan**, not an update to an existing one (the closest prior is `2026-07-08_campaign-story-v2.1_feature-doc_lovable.md`, which established v2 structure; today's plan tightens two lines within that structure but is scoped narrowly enough to stand alone).
