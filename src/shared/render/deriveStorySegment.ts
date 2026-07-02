// Re-export of the Deno-hosted implementation so both the editor and the SSR
// snapshot renderer share one source of truth. See
// `supabase/functions/_shared/render/deriveStorySegment.ts`.
export {
  deriveEffectiveStorySegment,
  type StoryHotspotLike,
  type StorySegment,
} from "../../../supabase/functions/_shared/render/deriveStorySegment";
