/**
 * Hotspot default styles — single source of truth for the Deck Editor
 * (`StatsPageSlide.tsx`, `HybridSlide.tsx`) and the SSR snapshot renderer
 * (`supabase/functions/render-stats-snapshot/index.ts`).
 *
 * See `./README.md`. Pure logic only — no Supabase, no DOM, no Deno APIs.
 *
 * History:
 *   2026-06-26 — Extracted from inline literals on both sides. Defaults
 *   chosen to match the editor's prior behavior (StatsPageSlide /
 *   HybridSlide). The SSR previously defaulted padding to 0 for story
 *   hotspots; we adopt the editor's 12px to remove a known divergence.
 */

export interface LiveNumberStyle {
  fontSize?: string | number;
  fontWeight?: string | number;
  color?: string;
  backgroundColor?: string;
  textAlign?: string;
  verticalAlign?: string;
  fontFamily?: string;
  padding?: string | number;
  borderRadius?: string | number;
  clipOverflow?: boolean;
}

export const HOTSPOT_DEFAULTS = {
  /** Plain live-number / metric / story hotspots. */
  liveNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
    backgroundColor: "transparent",
    textAlign: "center" as const,
    fontFamily: "system-ui, -apple-system, sans-serif",
    paddingPx: 0,
    borderRadiusPx: 0,
    clipOverflow: true,
  },
  /** Overrides applied when the value is multi-line / a campaign story. */
  story: {
    textAlign: "left" as const,
    verticalAlign: "top" as const,
    paddingPx: 12,
    lineHeight: 1.25,
  },
  /** Manual-HTML (rich-text) hotspot defaults. */
  manualHtml: {
    fontWeight: "400",
    textAlign: "left" as const,
    verticalAlign: "top" as const,
  },
  /** Map-legend hotspot defaults. */
  mapLegend: {
    fontWeight: "600",
    paddingPx: 8,
    fontFamily: "Inter, system-ui, sans-serif",
  },
} as const;

export type ResolvedTextStyle = {
  /** Numeric px. */
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor: string;
  textAlign: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  fontFamily: string;
  paddingPx: number;
  borderRadiusPx: number;
  clipOverflow: boolean;
  /** Only set for story (multi-line) hotspots. */
  lineHeight?: number;
};

function toNumeric(v: unknown, fallback: number): number {
  if (v == null) return fallback;
  const n = parseInt(String(v), 10);
  return isNaN(n) ? fallback : n;
}

/**
 * Resolve a live_number hotspot's raw `liveNumberStyle` into a fully-defaulted
 * style object. Both the Deck Editor and the SSR renderer call this so they
 * cannot drift on default font size, weight, color, alignment, or padding.
 */
export function resolveLiveNumberStyle(
  raw: LiveNumberStyle | undefined,
  ctx: { isStory: boolean }
): ResolvedTextStyle {
  const style = raw || {};
  const d = HOTSPOT_DEFAULTS.liveNumber;
  const s = HOTSPOT_DEFAULTS.story;

  const vAlignRaw = String(
    style.verticalAlign ?? (ctx.isStory ? s.verticalAlign : "center")
  ).toLowerCase();
  const verticalAlign: ResolvedTextStyle["verticalAlign"] =
    vAlignRaw === "center" || vAlignRaw === "middle"
      ? "middle"
      : vAlignRaw === "bottom"
        ? "bottom"
        : "top";

  const textAlignRaw = String(
    style.textAlign ?? (ctx.isStory ? s.textAlign : d.textAlign)
  ).toLowerCase();
  const textAlign: ResolvedTextStyle["textAlign"] =
    textAlignRaw === "left" || textAlignRaw === "right"
      ? (textAlignRaw as "left" | "right")
      : "center";

  // Padding: story default 12px when caller didn't set one.
  const paddingPx =
    style.padding == null
      ? ctx.isStory
        ? s.paddingPx
        : d.paddingPx
      : toNumeric(style.padding, d.paddingPx);

  return {
    fontSize: toNumeric(style.fontSize, d.fontSize),
    fontWeight: String(style.fontWeight ?? d.fontWeight),
    color: style.color || d.color,
    backgroundColor: style.backgroundColor || d.backgroundColor,
    textAlign,
    verticalAlign,
    fontFamily: style.fontFamily || d.fontFamily,
    paddingPx,
    borderRadiusPx: toNumeric(style.borderRadius, d.borderRadiusPx),
    clipOverflow: style.clipOverflow !== false,
    lineHeight: ctx.isStory ? s.lineHeight : undefined,
  };
}
