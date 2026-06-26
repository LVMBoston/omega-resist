// Re-export of the canonical shared splitter. Source-of-truth lives in
// `supabase/functions/_shared/render/campaignStorySplit.ts` so the
// Supabase edge-function bundler can ship it.
export {
  splitCampaignStoryAtMidpoint,
  applyStorySegment,
  type StorySegment,
} from "../../../supabase/functions/_shared/render/campaignStorySplit";
