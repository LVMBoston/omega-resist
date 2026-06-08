// Pure helpers for rendering manual-entry rich text to SVG.
// Extracted from index.ts so it can be:
//   1. Used by the edge function (Deno) for snapshot generation
//   2. Imported by the browser-side parity harness for side-by-side testing
//
// Keep this file dependency-free (no Deno or browser APIs).

export const MANUAL_HTML_MIN_SCALE = 0.4;
export const MANUAL_HTML_MAX_SCALE = 1.0;
export const MANUAL_HTML_STEP = 0.05;

export type ManualRun = { text: string; bold: boolean; italic: boolean };
export type ManualBlock = {
  kind: "paragraph" | "li_bullet" | "li_number";
  lines: ManualRun[][];
  align: "left" | "center" | "right";
  number?: number;
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function readAlign(attrs: string): "left" | "center" | "right" {
  const m = attrs.match(/text-align\s*:\s*(left|center|right)/i);
  return (m?.[1]?.toLowerCase() as "left" | "center" | "right") || "left";
}

export function parseInline(html: string): ManualRun[][] {
  const lineHtmls = html.split(/<br\s*\/?>/i);
  return lineHtmls.map((lineHtml) => {
    const runs: ManualRun[] = [];
    let i = 0;
    const stack: { bold: boolean; italic: boolean }[] = [
      { bold: false, italic: false },
    ];
    const peek = () => stack[stack.length - 1];
    let buf = "";
    const flush = () => {
      if (!buf) return;
      const s = peek();
      runs.push({ text: decodeEntities(buf), bold: s.bold, italic: s.italic });
      buf = "";
    };
    while (i < lineHtml.length) {
      if (lineHtml[i] === "<") {
        const end = lineHtml.indexOf(">", i);
        if (end < 0) break;
        const tag = lineHtml.slice(i + 1, end).toLowerCase();
        flush();
        if (tag === "strong" || tag === "b") {
          stack.push({ ...peek(), bold: true });
        } else if (tag === "em" || tag === "i") {
          stack.push({ ...peek(), italic: true });
        } else if (
          tag === "/strong" || tag === "/b" ||
          tag === "/em" || tag === "/i"
        ) {
          if (stack.length > 1) stack.pop();
        }
        i = end + 1;
      } else {
        buf += lineHtml[i];
        i++;
      }
    }
    flush();
    if (runs.length === 0) runs.push({ text: "", bold: false, italic: false });
    return runs;
  });
}

export function parseManualHtml(html: string): ManualBlock[] {
  const blocks: ManualBlock[] = [];
  const src = html.replace(/>\s+</g, "><").trim();
  const blockRe = /<(p|ul|ol)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(src)) !== null) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";
    const inner = m[3] || "";
    if (tag === "p") {
      blocks.push({
        kind: "paragraph",
        lines: parseInline(inner),
        align: readAlign(attrs),
      });
    } else if (tag === "ul" || tag === "ol") {
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let li: RegExpExecArray | null;
      let n = 1;
      while ((li = liRe.exec(inner)) !== null) {
        blocks.push({
          kind: tag === "ul" ? "li_bullet" : "li_number",
          lines: parseInline(li[1] || ""),
          align: "left",
          number: tag === "ol" ? n : undefined,
        });
        n++;
      }
    }
  }
  if (blocks.length === 0) {
    blocks.push({
      kind: "paragraph",
      lines: parseInline(src),
      align: "left",
    });
  }
  return blocks;
}

export function wrapRuns(runs: ManualRun[], maxChars: number): ManualRun[][] {
  const out: ManualRun[][] = [];
  let current: ManualRun[] = [];
  let currentLen = 0;
  const pushCurrent = () => {
    if (current.length > 0) {
      out.push(current);
      current = [];
      currentLen = 0;
    }
  };
  for (const run of runs) {
    const tokens = run.text.split(/(\s+)/);
    for (const tok of tokens) {
      if (!tok) continue;
      if (currentLen + tok.length > maxChars && currentLen > 0) {
        pushCurrent();
        if (/^\s+$/.test(tok)) continue;
      }
      current.push({ text: tok, bold: run.bold, italic: run.italic });
      currentLen += tok.length;
    }
  }
  pushCurrent();
  if (out.length === 0) out.push([{ text: "", bold: false, italic: false }]);
  return out;
}

export interface RenderBox { x: number; y: number; w: number; h: number }
export interface RenderStyle {
  baseFontSize: number;
  color: string;
  align: "left" | "center" | "right";
  bg?: string;
  verticalAlign?: "top" | "middle" | "bottom";
  fontFamily?: string;
}

/** Returns SVG fragment string (no <svg> wrapper). */
export function renderManualHtml(
  html: string,
  box: RenderBox,
  style: RenderStyle,
): string {
  const blocks = parseManualHtml(html);
  const padding = 10;
  const innerW = box.w - padding * 2;
  const fontFamily = style.fontFamily || "Inter, sans-serif";

  let chosenScale = 1.0;
  let chosenLayout:
    | { lines: { runs: ManualRun[]; x: number; y: number; bullet?: string }[]; totalH: number }
    | null = null;

  for (let scale = 1.0; scale >= MANUAL_HTML_MIN_SCALE - 1e-6; scale -= MANUAL_HTML_STEP) {
    const fs = style.baseFontSize * scale;
    const charW = fs * 0.55;
    const lineH = fs * 1.3;
    const paraGap = fs * 0.4;
    const bulletIndent = fs * 1.4;

    const placed: { runs: ManualRun[]; x: number; y: number; bullet?: string }[] = [];
    let cursorY = padding + fs;
    for (const block of blocks) {
      const isList = block.kind !== "paragraph";
      const availW = innerW - (isList ? bulletIndent : 0);
      const maxChars = Math.max(4, Math.floor(availW / charW));
      for (let li = 0; li < block.lines.length; li++) {
        const visualLines = wrapRuns(block.lines[li], maxChars);
        for (let vi = 0; vi < visualLines.length; vi++) {
          const runs = visualLines[vi];
          let lineX: number;
          const baseX = padding + (isList ? bulletIndent : 0);
          if (block.align === "center") lineX = box.w / 2;
          else if (block.align === "right") lineX = box.w - padding;
          else lineX = baseX;
          const bullet =
            vi === 0 && isList
              ? block.kind === "li_bullet"
                ? "•"
                : `${block.number}.`
              : undefined;
          placed.push({ runs, x: lineX, y: cursorY, bullet });
          cursorY += lineH;
        }
      }
      cursorY += paraGap;
    }
    const totalH = cursorY;
    if (totalH <= box.h - padding || scale <= MANUAL_HTML_MIN_SCALE + 1e-6) {
      chosenScale = scale;
      chosenLayout = { lines: placed, totalH };
      break;
    }
  }

  if (!chosenLayout) return "";

  const vAlign = style.verticalAlign || "top";
  const freeSpace = Math.max(0, box.h - chosenLayout.totalH);
  const yOffset =
    vAlign === "middle" ? freeSpace / 2 : vAlign === "bottom" ? freeSpace : 0;
  if (yOffset > 0) for (const ln of chosenLayout.lines) ln.y += yOffset;

  const fs = style.baseFontSize * chosenScale;
  let svg = "";
  if (style.bg && style.bg !== "transparent") {
    svg += `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${escapeXml(style.bg)}" rx="2"/>`;
  }
  const clipId = `clip-mh-${Math.random().toString(36).slice(2, 8)}`;
  svg += `<defs><clipPath id="${clipId}"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"/></clipPath></defs>`;
  svg += `<g clip-path="url(#${clipId})">`;

  for (const line of chosenLayout.lines) {
    const anchor =
      line.x === box.w / 2 ? "middle" : line.x >= box.w - 1 ? "end" : "start";
    const absX = box.x + line.x;
    const absY = box.y + line.y;

    if (line.bullet) {
      const bulletX = box.x + 10;
      svg += `<text x="${bulletX}" y="${absY}" font-family="${fontFamily}" font-size="${fs}" fill="${escapeXml(style.color)}" text-anchor="start">${escapeXml(line.bullet)}</text>`;
    }

    svg += `<text x="${absX}" y="${absY}" font-family="${fontFamily}" font-size="${fs}" fill="${escapeXml(style.color)}" text-anchor="${anchor}">`;
    for (const run of line.runs) {
      const weight = run.bold ? "bold" : "normal";
      const fstyle = run.italic ? "italic" : "normal";
      svg += `<tspan font-weight="${weight}" font-style="${fstyle}">${escapeXml(run.text)}</tspan>`;
    }
    svg += `</text>`;
  }

  svg += `</g>`;
  return svg;
}
