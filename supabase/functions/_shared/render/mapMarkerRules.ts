// Canonical marker-style rules for campaign map dots, shared between the
// live editor (`MapHotspotRenderer.tsx`) and the SSR renderer
// (`render-stats-snapshot/index.ts`). Keeping a single source of truth here
// guarantees the snapshot SVG matches what the user sees in-app.
//
// Color is keyed by `utm_medium`. Stroke color flips when a marker has
// downstream spawns (its token has children) — this is how viewers see the
// "this seed propagated" cue both live and in renders.

export type RGB = [number, number, number];

/** Hex color string per utm_medium (live editor / SVG fill). */
export const MEDIUM_COLORS: Record<string, string> = {
  qr: "#000099",  // QR code — navy
  em: "#0066ff",  // email — medium blue
  sms: "#99ccff", // SMS — light blue
  tx: "#99ccff",  // text alternate — light blue
};

/** Same palette as `MEDIUM_COLORS`, expressed as RGB tuples for SSR pixel ops. */
export const MEDIUM_COLORS_RGB: Record<string, RGB> = {
  qr: [0x00, 0x00, 0x99],
  em: [0x00, 0x66, 0xff],
  sms: [0x99, 0xcc, 0xff],
  tx: [0x99, 0xcc, 0xff],
};

/** Slate-500 — used when utm_medium is unknown or missing. */
export const DEFAULT_COLOR = "#64748b";
export const DEFAULT_COLOR_RGB: RGB = [0x64, 0x74, 0x8b];

/** Stroke that signals a marker has at least one downstream spawn. */
export const SPAWN_STROKE = "#22c55e";
export const SPAWN_STROKE_RGB: RGB = [0x22, 0xc5, 0x5e];

/** Default stroke for markers with no spawns. */
export const DEFAULT_STROKE = "#ffffff";
export const DEFAULT_STROKE_RGB: RGB = [0xff, 0xff, 0xff];

/** Resolve fill color for a given utm_medium, falling back to slate. */
export function resolveMarkerFill(utmMedium: string | null | undefined): string {
  if (!utmMedium) return DEFAULT_COLOR;
  return MEDIUM_COLORS[utmMedium] ?? DEFAULT_COLOR;
}

export function resolveMarkerFillRgb(utmMedium: string | null | undefined): RGB {
  if (!utmMedium) return DEFAULT_COLOR_RGB;
  return MEDIUM_COLORS_RGB[utmMedium] ?? DEFAULT_COLOR_RGB;
}

/** Resolve stroke color given spawn state. */
export function resolveMarkerStroke(hasSpawns: boolean): string {
  return hasSpawns ? SPAWN_STROKE : DEFAULT_STROKE;
}

export function resolveMarkerStrokeRgb(hasSpawns: boolean): RGB {
  return hasSpawns ? SPAWN_STROKE_RGB : DEFAULT_STROKE_RGB;
}
