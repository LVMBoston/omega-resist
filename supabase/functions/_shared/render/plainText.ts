/**
 * Plain-text hotspot renderer — single source of truth for live_number /
 * label / plain story hotspots. The SSR snapshot pipeline and the parity
 * harness both call this so word-wrap, vertical-alignment, padding, and
 * clip-overflow can never drift between them.
 *
 * Pure logic only — produces an SVG string fragment. No Deno / DOM APIs.
 *
 * Extracted 2026-06-26 from inline code in
 * `supabase/functions/render-stats-snapshot/index.ts` (standard-hotspot
 * branch).
 */

import {
  wordWrap,
  maxCharsForWidth,
  normalizeVAlign,
  tspanStartY,
  LINE_HEIGHT_RATIO,
} from "./textLayout.ts";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface PlainTextBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlainTextStyle {
  fontSize: number;
  fontWeight: string | number;
  color: string;
  textAlign: "left" | "center" | "right";
  verticalAlign: string | undefined;
  fontFamily: string;
  paddingPx: number;
  clipOverflow: boolean;
}

/**
 * Render plain (non-HTML) text inside a hotspot box. Returns an SVG fragment
 * — no <svg> root, so the caller can inline it next to other hotspots.
 *
 * A unique `clipIdPrefix` is required when clipOverflow is true so multiple
 * fragments inside one document don't collide on clipPath ids. Pass a stable
 * value (e.g. hotspot index) so the output is deterministic for snapshot tests.
 */
export function renderPlainTextSvg(
  text: string,
  box: PlainTextBox,
  style: PlainTextStyle,
  clipIdPrefix = "hs",
): string {
  const { x, y, w, h } = box;
  const padInset = style.paddingPx;
  const wrapInset = Math.max(padInset, 4);

  let textAnchor: "start" | "middle" | "end" = "middle";
  let textX = x + w / 2;
  if (style.textAlign === "left") {
    textAnchor = "start";
    textX = x + padInset;
  } else if (style.textAlign === "right") {
    textAnchor = "end";
    textX = x + w - padInset;
  }

  const maxCharsPerLine = maxCharsForWidth(w - wrapInset * 2, style.fontSize);
  const rawLines = String(text ?? "").split("\n");
  const lines: string[] = [];
  for (const rl of rawLines) {
    if (rl.length === 0) {
      lines.push("");
    } else {
      for (const wl of wordWrap(rl, maxCharsPerLine)) lines.push(wl);
    }
  }

  const lineHeight = style.fontSize * LINE_HEIGHT_RATIO;
  const totalTextHeight = lineHeight * lines.length;

  const startY = tspanStartY(
    y,
    h,
    style.fontSize,
    totalTextHeight,
    padInset,
    normalizeVAlign(style.verticalAlign, "center"),
  );

  let svg = "";
  if (style.clipOverflow) {
    const clipId = `clip-${clipIdPrefix}`;
    svg += `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs>`;
    svg += `<g clip-path="url(#${clipId})">`;
  }
  svg += `<text font-family="${escapeXml(style.fontFamily)}" font-size="${style.fontSize}" font-weight="${escapeXml(String(style.fontWeight))}" fill="${escapeXml(style.color)}" text-anchor="${textAnchor}">`;
  lines.forEach((line, i) => {
    svg += `<tspan x="${textX}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`;
  });
  svg += `</text>`;
  if (style.clipOverflow) svg += `</g>`;
  return svg;
}
