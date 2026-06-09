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
  // Strip dangerous tags AND their inner contents (script/style/iframe).
  // This mirrors the editor's DOMPurify behavior so a `<script>alert(1)</script>`
  // inside manualHtml does not leak its inner text into the rendered output.
  let cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "");
  const src = cleaned.replace(/>\s+</g, "><").trim();
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

// =============================================================================
// Real text measurement — Inter advance-width table (units per em = 1000).
// Source: opentype.js readout of Inter Regular & Bold, sampled across the ASCII
// range plus common punctuation/whitespace. Italic uses the same advances as
// Regular (Inter italics are obliqued, advance widths match).
//
// This replaces the old `fontSize × 0.55` uniform estimate, which broke per-line
// at the wrong word and made the SSR wrap one word earlier than the editor.
// =============================================================================

// Advance widths for Inter Regular, in 1000-unit em.
const INTER_REG: Record<string, number> = {
  " ":261,"!":274,"\"":409,"#":636,"$":580,"%":775,"&":659,"'":234,
  "(":350,")":350,"*":482,"+":579,",":237,"-":343,".":237,"/":336,
  "0":580,"1":580,"2":580,"3":580,"4":580,"5":580,"6":580,"7":580,"8":580,"9":580,
  ":":261,";":261,"<":579,"=":579,">":579,"?":476,"@":815,
  "A":691,"B":669,"C":666,"D":722,"E":606,"F":584,"G":720,"H":738,"I":314,
  "J":448,"K":659,"L":565,"M":865,"N":752,"O":753,"P":633,"Q":753,"R":657,
  "S":608,"T":614,"U":719,"V":664,"W":946,"X":664,"Y":636,"Z":619,
  "[":350,"\\":336,"]":350,"^":482,"_":500,"`":500,
  "a":549,"b":586,"c":506,"d":586,"e":559,"f":361,"g":586,"h":576,"i":257,
  "j":257,"k":521,"l":257,"m":895,"n":576,"o":583,"p":586,"q":586,"r":361,
  "s":479,"t":361,"u":576,"v":520,"w":797,"x":520,"y":520,"z":478,
  "{":350,"|":237,"}":350,"~":579,
};

// Bold runs ~4% wider than regular for Inter; cheaper than a second table.
const BOLD_MULT = 1.04;
// Em-dash, en-dash, smart quotes, NBSP, ellipsis — handled explicitly.
const SPECIAL: Record<string, number> = {
  "\u00A0":261,"\u2010":343,"\u2013":500,"\u2014":1000,
  "\u2018":234,"\u2019":234,"\u201C":409,"\u201D":409,"\u2026":711,
};

/** Pixel advance for one char at the given fontSize, with bold widening. */
function charAdvancePx(ch: string, fontSize: number, bold: boolean): number {
  const em = INTER_REG[ch] ?? SPECIAL[ch] ?? 580; // unknown → average lowercase
  return (em / 1000) * fontSize * (bold ? BOLD_MULT : 1);
}

/** Measure a run of text in pixels at fontSize. */
export function measureTextPx(text: string, fontSize: number, bold: boolean): number {
  let w = 0;
  for (const ch of text) w += charAdvancePx(ch, fontSize, bold);
  return w;
}

/**
 * Wrap by real pixel width. `tokens` are split on whitespace; each
 * non-whitespace token plus its following single space is the wrap unit.
 *
 * This is now the wrap function used by `renderManualHtml`. The old
 * char-count wrap (`wrapRuns`) is kept below for the geo regression tests
 * but is not exercised by the production path.
 */
export function wrapRunsByWidth(
  runs: ManualRun[],
  maxWidthPx: number,
  fontSize: number,
): ManualRun[][] {
  const out: ManualRun[][] = [];
  let current: ManualRun[] = [];
  let currentW = 0;
  const pushCurrent = () => {
    if (current.length > 0) { out.push(current); current = []; currentW = 0; }
  };
  for (const run of runs) {
    const tokens = run.text.split(/(\s+)/);
    for (const tok of tokens) {
      if (!tok) continue;
      const tokW = measureTextPx(tok, fontSize, run.bold);
      // Token bigger than the line itself → break by character to mirror the
      // editor's `word-break: break-word` behavior.
      if (tokW > maxWidthPx && !/^\s+$/.test(tok)) {
        // Flush whatever is on the current line first.
        if (currentW > 0) pushCurrent();
        let buf = "";
        let bufW = 0;
        for (const ch of tok) {
          const cw = charAdvancePx(ch, fontSize, run.bold);
          if (bufW + cw > maxWidthPx && buf.length > 0) {
            current.push({ text: buf, bold: run.bold, italic: run.italic });
            pushCurrent();
            buf = ""; bufW = 0;
          }
          buf += ch; bufW += cw;
        }
        if (buf) { current.push({ text: buf, bold: run.bold, italic: run.italic }); currentW = bufW; }
        continue;
      }
      if (currentW + tokW > maxWidthPx && currentW > 0) {
        pushCurrent();
        if (/^\s+$/.test(tok)) continue;
      }
      current.push({ text: tok, bold: run.bold, italic: run.italic });
      currentW += tokW;
    }
  }
  pushCurrent();
  if (out.length === 0) out.push([{ text: "", bold: false, italic: false }]);
  return out;
}

/** @deprecated kept for backward compatibility with char-count callers. */
export function wrapRuns(runs: ManualRun[], maxChars: number): ManualRun[][] {
  const out: ManualRun[][] = [];
  let current: ManualRun[] = [];
  let currentLen = 0;
  const pushCurrent = () => {
    if (current.length > 0) { out.push(current); current = []; currentLen = 0; }
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
  // Match ManualEntryRenderer's contentStyle padding: "8px 10px"
  const padX = 10;
  const padY = 8;
  const innerW = box.w - padX * 2;
  const fontFamily = style.fontFamily || "Inter, sans-serif";

  let chosenScale = 1.0;
  let chosenLayout:
    | { lines: { runs: ManualRun[]; x: number; y: number; anchor: "start" | "middle" | "end"; bullet?: string }[]; totalH: number }
    | null = null;

  for (let scale = 1.0; scale >= MANUAL_HTML_MIN_SCALE - 1e-6; scale -= MANUAL_HTML_STEP) {
    const fs = style.baseFontSize * scale;
    // Match ManualEntryRenderer's lineHeight: 1.25
    const lineH = fs * 1.25;
    // Editor: <p> has margin-bottom: 0.4em; <li> has margin: 0. So only
    // paragraphs contribute an inter-block gap, and the last block has none
    // (p:last-child { margin-bottom: 0 }).
    const paraGap = fs * 0.4;
    const bulletIndent = fs * 1.4;

    const placed: { runs: ManualRun[]; x: number; y: number; anchor: "start" | "middle" | "end"; bullet?: string }[] = [];
    let cursorY = padY + fs;
    for (let bi = 0; bi < blocks.length; bi++) {
      const block = blocks[bi];
      const isList = block.kind !== "paragraph";
      const availW = innerW - (isList ? bulletIndent : 0);
      for (let li = 0; li < block.lines.length; li++) {
        const visualLines = wrapRunsByWidth(block.lines[li], availW, fs);
        for (let vi = 0; vi < visualLines.length; vi++) {
          const runs = visualLines[vi];
          let lineX: number;
          let anchor: "start" | "middle" | "end";
          const baseX = padX + (isList ? bulletIndent : 0);
          if (block.align === "center") { lineX = box.w / 2; anchor = "middle"; }
          else if (block.align === "right") { lineX = box.w - padX; anchor = "end"; }
          else { lineX = baseX; anchor = "start"; }
          const bullet =
            vi === 0 && isList
              ? block.kind === "li_bullet" ? "•" : `${block.number}.`
              : undefined;
          placed.push({ runs, x: lineX, y: cursorY, anchor, bullet });
          cursorY += lineH;
        }
      }
      // Only paragraphs add a trailing gap, and never after the very last block.
      const isLastBlock = bi === blocks.length - 1;
      const nextBlock = blocks[bi + 1];
      const crossesIntoNonList = !isList || (nextBlock && nextBlock.kind === "paragraph");
      if (!isLastBlock && !isList) {
        cursorY += paraGap;
      } else if (!isLastBlock && isList && crossesIntoNonList) {
        // Gap between a list and the following paragraph.
        cursorY += paraGap;
      }
    }
    // cursorY is one lineH past the last baseline; the last line's visual
    // bottom sits `lineH - fs` below that baseline. Net: subtract `fs` so the
    // content height matches the editor's CSS box (N * lineH + 2*padY).
    const totalH = cursorY - fs + padY;
    if (totalH <= box.h || scale <= MANUAL_HTML_MIN_SCALE + 1e-6) {
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
    const absX = box.x + line.x;
    const absY = box.y + line.y;

    if (line.bullet) {
      const bulletX = box.x + 10;
      svg += `<text x="${bulletX}" y="${absY}" font-family="${fontFamily}" font-size="${fs}" fill="${escapeXml(style.color)}" text-anchor="start">${escapeXml(line.bullet)}</text>`;
    }

    svg += `<text x="${absX}" y="${absY}" font-family="${fontFamily}" font-size="${fs}" fill="${escapeXml(style.color)}" text-anchor="${line.anchor}">`;
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
