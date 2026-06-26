// Re-export of the canonical shared hotspot defaults. Source-of-truth lives
// in `supabase/functions/_shared/render/hotspotDefaults.ts` so the Supabase
// edge-function bundler can ship it. The client (Vite) imports it from here
// for ergonomic `@/shared/render/...` paths.
export {
  HOTSPOT_DEFAULTS,
  resolveLiveNumberStyle,
  type LiveNumberStyle,
  type ResolvedTextStyle,
} from "../../../supabase/functions/_shared/render/hotspotDefaults";
