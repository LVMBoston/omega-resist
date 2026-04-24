## 1. Current answer

a. No: the Campaign Story currently does not apply to simulated data.

b. `src/lib/campaignNarrative.ts` hard-filters narrative queries with `is_simulated = false`, so the Story button always reports real data only, even when the dashboard is set to `Simulated Only`.

c. The dashboard currently allows `Both`, and several analytics helpers support a mixed mode. That can make the visible table/map and Story disagree, which is the confusion you are seeing.

## 2. Goal

a. Campaign Story should work for either real data or simulated data.

b. The story must clearly label which dataset it is using.

c. The dashboard should no longer offer a combined `Both` data-source option.

 d. If a campaign has both real and simulated data, the user should explicitly choose `Real Only` or `Simulated Only` before generating a Story.

e. Add a documented follow-up note that the snapshot rendering tool also needs the same clarity around real vs simulated data.

## 3. Dashboard data-source cleanup

a. Remove `Both` from the Campaign Visibility data-source selector.

b. Treat any existing URL or saved localStorage value of `dataSource=both` as an invalid legacy value and normalize it to `real` unless the user explicitly selects simulated.

c. Keep only these choices visible:
   - `Real Only`
   - `Simulated Only`

 d. Pass the active data-source selection into the Campaign Story button so story generation matches the user’s current dashboard context.

## 4. Story behavior when both datasets exist

a. Add lightweight counts for real and simulated campaign events/tokens so the Story dialog knows whether both datasets exist.

b. If both real and simulated data exist and no explicit source has been chosen for the Story, show a short choice prompt in the Story dialog:
   - `Use Real Data`
   - `Use Simulated Data`

c. In the Campaign Dashboard flow, the current filter will usually provide the explicit choice automatically. The prompt is a safety net for any other Story entry points or old URLs.

d. Do not generate a mixed story.

## 5. Narrative data changes

a. Update `fetchNarrativeData` to accept `dataSource: "real" | "simulated"`.

b. Replace all hardcoded `.eq("is_simulated", false)` story filters with the selected source:
   - `real` maps to `is_simulated = false`
   - `simulated` maps to `is_simulated = true`

c. Avoid the current `get_campaign_stats` RPC for Story level counts because it is intentionally real-only. Query token level counts directly with the selected simulation filter so simulated stories can be accurate.

d. Keep all existing data-integrity guards: no fabricated placeholders, no empty sections rendered as fake data, and no mixed real/simulated metrics.

## 6. Clear visual indication

a. Add a dataset label near the top of the Story dialog, for example:
   - `Dataset: Real data`
   - `Dataset: Simulated data`

b. Add the same label into copied/downloaded story text so exported markdown is not ambiguous.

c. For simulated stories, add a clear first-screen note such as: `Simulation report — not real field activity.`

## 7. Snapshot tool note

a. Add a note to the snapshot decision/docs area that `render-stats-snapshot` currently needs the same real-vs-simulated treatment.

b. The note will explicitly flag that snapshot metrics and the `campaign_story` hotspot should not silently mix or silently default in a way that conflicts with dashboard filtering.

c. I will not change snapshot rendering behavior in this pass unless you approve a broader snapshot-tool update next.

## 8. Decision log

a. Append this approved plan as a new `## Update — 2026-04-24` section to the existing campaign story decision document:
   `docs/decisions/campaign-story/2026-02-27_fix-campaign-story-metrics_feature-doc_lovable.md`

b. Preserve all prior content intact.

c. Mark the update as `Status: Approved & Implemented` after implementation.

 d. This approved plan updates the existing campaign story metrics plan, not a new standalone plan.

## 9. Verification

a. Verify that the Campaign Visibility data-source selector no longer shows `Both`.

b. Verify that old `dataSource=both` URLs are normalized and do not leave the dashboard in a mixed state.

c. Verify a real Campaign Story uses only `is_simulated = false` rows and is labeled as real.

d. Verify a simulated Campaign Story uses only `is_simulated = true` rows and is labeled as simulated.

e. Verify that copy/download preserve the dataset label.

f. Use browser testing to confirm the Story dialog selection/label behavior is visible and understandable.