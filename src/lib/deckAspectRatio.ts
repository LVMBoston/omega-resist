import { supabase } from "@/integrations/supabase/client";

export type DeckOrientation = "landscape" | "portrait" | "square";

export interface DeckShape {
  aspectRatio: number; // width / height
  orientation: DeckOrientation;
}

/** ~2% relative tolerance accommodates 1404×783 (1.793) matching a 16:9 (1.778) deck. */
const DEFAULT_TOLERANCE_PCT = 2;

export function ratioToOrientation(r: number): DeckOrientation {
  if (Math.abs(r - 1) < 0.02) return "square";
  return r > 1 ? "landscape" : "portrait";
}

export function ratiosMatch(a: number, b: number, tolerancePct = DEFAULT_TOLERANCE_PCT): boolean {
  if (!a || !b) return false;
  const diff = Math.abs(a - b) / b;
  return diff * 100 <= tolerancePct;
}

export function loadImageDims(url: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    if (!url || url.startsWith("solid:")) return resolve(null);
    const lower = url.toLowerCase();
    if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")) return resolve(null);
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Race-load a list of candidate URLs; first that decodes wins. */
export async function probeFirstDims(urls: (string | null | undefined)[]): Promise<{ w: number; h: number } | null> {
  const seen = new Set<string>();
  for (const u of urls) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    const dims = await loadImageDims(u);
    if (dims && dims.w > 0 && dims.h > 0) return dims;
  }
  return null;
}

/** Persist aspect_ratio + orientation on a deck row. Safe to call repeatedly. */
export async function persistDeckShape(slug: string, shape: DeckShape): Promise<void> {
  await (supabase as any)
    .from("decks")
    .update({
      aspect_ratio: Number(shape.aspectRatio.toFixed(6)),
      orientation: shape.orientation,
    })
    .eq("slug", slug);
}

export function fetchDeckShape(slug: string): Promise<DeckShape | null> {
  return (supabase as any)
    .from("decks")
    .select("aspect_ratio, orientation")
    .eq("slug", slug)
    .maybeSingle()
    .then(({ data }: any) => {
      if (!data || data.aspect_ratio == null) return null;
      const r = Number(data.aspect_ratio);
      if (!isFinite(r) || r <= 0) return null;
      return {
        aspectRatio: r,
        orientation: (data.orientation as DeckOrientation) || ratioToOrientation(r),
      } as DeckShape;
    });
}
