/**
 * Auto-derive the effective story segment for a `campaign_story` hotspot.
 *
 * Rule: when a slide contains exactly two `campaign_story` hotspots AND the
 * given hotspot's explicit segment is undefined or "full", split them by X
 * position — leftmost = "first" half, the other = "second" half.
 *
 * An explicit "first" or "second" setting on the hotspot always wins so the
 * old manual workflow keeps working.
 *
 * Shared by the editor (HybridSlide, StatsPageSlide, FullResolutionHotspot
 * Editor) and the SSR snapshot renderer so both agree on which half each
 * column shows. Pure logic — no Deno / DOM imports.
 */
export type StorySegment = "full" | "first" | "second";

export interface StoryHotspotLike {
  id: string;
  x: number;
  metricKey?: string;
  storySegment?: StorySegment;
}

export function deriveEffectiveStorySegment(
  hotspot: StoryHotspotLike,
  allHotspots: readonly StoryHotspotLike[],
): StorySegment {
  const explicit = hotspot.storySegment;
  if (explicit === "first" || explicit === "second") return explicit;

  const storyHotspots = allHotspots.filter(
    (h) => h.metricKey === "campaign_story",
  );
  if (storyHotspots.length !== 2) return "full";

  const sorted = [...storyHotspots].sort((a, b) => a.x - b.x);
  return sorted[0].id === hotspot.id ? "first" : "second";
}
