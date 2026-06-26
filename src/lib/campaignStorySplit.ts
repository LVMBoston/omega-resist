// Re-export of the shared splitter. The canonical implementation lives in
// src/shared/render/campaignStorySplit.ts and is imported by both the editor
// and the SSR snapshot renderer to guarantee parity.
export {
  splitCampaignStoryAtMidpoint,
  applyStorySegment,
  type StorySegment,
} from "@/shared/render/campaignStorySplit";
