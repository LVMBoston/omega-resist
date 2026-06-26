// Re-export of the canonical shared formatter. Source-of-truth lives in
// `supabase/functions/_shared/render/campaignStory.ts` so the Supabase
// edge-function bundler can ship it. The client (Vite) imports it from
// here for ergonomic `@/shared/render/...` paths.
export {
  formatCampaignStory,
  type CampaignStoryInput,
} from "../../../supabase/functions/_shared/render/campaignStory";
