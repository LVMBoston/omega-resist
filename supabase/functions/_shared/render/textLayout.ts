// Shared text-layout helpers — single source of truth for word-wrap and
// vertical-alignment math used by the SSR snapshot renderer. The editor
// relies on CSS box layout (browser-native wrapping) and does not import
// these helpers directly, but the constants and algorithms are exported
// here so the parity harness can compare results and future shared code
// has one canonical implementation.
//
// Keep this file dependency-free (no Deno or browser APIs).

/** Width of an average glyph as a fraction of font size (Inter-ish). */
export const AVG_CHAR_WIDTH_RATIO = 0.52;
/** Line-height multiplier for standard hotspot text. */
export const LINE_HEIGHT_RATIO = 1.2;
/** Line-height multiplier for multi-paragraph "story" text. */
export const STORY_LINE_HEIGHT_RATIO = 1.25;

/** Greedy word wrap: never breaks a single word. */
export function wordWrap(text: string, maxChars: number): string[] {
  if (maxChars <= 0 || text.length <= maxChars) return [text];
  const words = text.split(" ");
  const result: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += " " + word;
    } else {
      result.push(current);
      current = word;
    }
  }
  if (current) result.push(current);
  return result;
}

/** Max characters that fit on one line for the given pixel width. */
export function maxCharsForWidth(
  pixelWidth: number,
  fontSize: number,
  ratio: number = AVG_CHAR_WIDTH_RATIO,
): number {
  const charWidth = fontSize * ratio;
  if (charWidth <= 0) return 1;
  return Math.max(1, Math.floor(pixelWidth / charWidth));
}

export type VAlign = "top" | "center" | "middle" | "bottom";

/** Normalize a raw verticalAlign string to top|center|bottom. */
export function normalizeVAlign(
  raw: string | undefined,
  fallback: "top" | "center" | "bottom" = "top",
): "top" | "center" | "bottom" {
  const v = (raw || fallback).toLowerCase();
  if (v === "bottom") return "bottom";
  if (v === "center" || v === "middle") return "center";
  if (v === "top") return "top";
  return fallback;
}

/**
 * Compute the y-offset to add to "top-aligned" content so it sits at the
 * desired vertical alignment within an outer box. Used by the story block
 * which lays out lines from the top and then shifts them.
 */
export function freeSpaceOffset(
  contentHeight: number,
  boxHeight: number,
  vAlign: "top" | "center" | "bottom",
): number {
  const free = Math.max(0, boxHeight - contentHeight);
  if (vAlign === "bottom") return free;
  if (vAlign === "center") return free / 2;
  return 0;
}

/**
 * Compute the y-coordinate for the FIRST baseline of a centered <tspan>
 * stack inside a hotspot bounding box. Mirrors SSR's standard-hotspot math.
 */
export function tspanStartY(
  boxY: number,
  boxHeight: number,
  fontSize: number,
  totalTextHeight: number,
  padInset: number,
  vAlign: "top" | "center" | "bottom",
): number {
  if (vAlign === "top") {
    return boxY + padInset + fontSize * 0.95;
  }
  if (vAlign === "bottom") {
    return boxY + boxHeight - padInset - totalTextHeight + fontSize * 0.85;
  }
  return boxY + (boxHeight - totalTextHeight) / 2 + fontSize * 0.85;
}
