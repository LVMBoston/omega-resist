// Canvas-sizing helpers for the snapshot renderer.
// Extracted from index.ts so the regression-critical aspect-ratio
// logic can be unit-tested without booting the edge function.

export const DEFAULT_CANVAS_WIDTH = 1920;
export const DEFAULT_CANVAS_HEIGHT = 1080;
export const MAX_CANVAS_SIDE = 1920;

export interface CanvasSize {
  width: number;
  height: number;
}

/**
 * Derive snapshot canvas dimensions from the background image's natural
 * size. The longest side is capped at MAX_CANVAS_SIDE so the resulting
 * SVG stays a reasonable size. Aspect ratio is preserved exactly —
 * this is what guarantees landscape templates render landscape and
 * portrait templates render portrait (regression: 2026-06-07).
 */
export function deriveCanvasFromImage(
  imageWidth: number,
  imageHeight: number,
  maxSide: number = MAX_CANVAS_SIDE,
): CanvasSize {
  if (!isFinite(imageWidth) || !isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
    return { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT };
  }
  const scale = Math.min(1, maxSide / Math.max(imageWidth, imageHeight));
  return {
    width: Math.round(imageWidth * scale),
    height: Math.round(imageHeight * scale),
  };
}

/**
 * Default canvas for solid-background templates that have no image to
 * sample from. Landscape 16:9 matches the default deck orientation.
 */
export function defaultSolidCanvas(): CanvasSize {
  return { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT };
}
