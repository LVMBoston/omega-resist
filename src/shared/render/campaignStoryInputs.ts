// Re-export of the canonical shared campaign-story metric-input function.
// Source-of-truth lives in
// `supabase/functions/_shared/render/campaignStoryInputs.ts`
// so the Supabase edge-function bundler can ship it. Both the editor
// (via `src/lib/campaignNarrative.ts`) and the SSR snapshot renderer
// call the same function through this re-export chain to guarantee
// identical metric numbers (seeds, sprouts, views, zips, states, ...).
export {
  computeCampaignStoryInputs,
  type CampaignStoryInputResult,
  type CampaignStoryInputArgs,
  type NarrativeDataSource,
} from "../../../supabase/functions/_shared/render/campaignStoryInputs";
