// Static stacked-bar chart renderer for the SSR snapshot.
// Produces an SVG fragment matching the editor's Recharts chart:
// stacked bars, optional Y axis with ticks, X axis labels, legend below.

import { LEVEL_COLORS, type ChartPoint } from "./chartData.ts";

export interface ChartRenderOptions {
  points: ChartPoint[];
  seriesKeys: string[];
  seriesLabels: Record<string, string>;
  x: number;
  y: number;
  width: number;
  height: number;
  showXAxis?: boolean;
  showYAxis?: boolean;
  yScale?: "linear" | "log";
  yFormat?: "integer" | "compact";
  /** Line 1 of the chart title (campaign name) */
  titleLine1?: string;
  /** Line 2 of the chart title (data series) */
  titleLine2?: string;
  /** Background fill behind the chart box. Defaults to white. */
  backgroundColor?: string;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTick(v: number, fmt: "integer" | "compact"): string {
  if (fmt === "compact") {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(Math.round(v));
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const steps = [1, 2, 2.5, 5, 10];
  for (const s of steps) {
    if (v <= s * base) return s * base;
  }
  return 10 * base;
}

/**
 * Render a stacked bar chart as an SVG fragment.
 * Returns "" when there is nothing to draw.
 */
export function renderChartSvg(opts: ChartRenderOptions): string {
  const {
    points,
    seriesKeys,
    seriesLabels,
    x,
    y,
    width,
    height,
    showXAxis = true,
    showYAxis = false,
    yScale = "linear",
    yFormat = "integer",
    titleLine1 = "",
    titleLine2 = "",
    backgroundColor = "#ffffff",
  } = opts;

  if (!points.length || !seriesKeys.length) return "";

  // Font sizes scale with the chart box so small hotspots stay legible.
  const fs = Math.max(9, Math.min(20, Math.round(height * 0.045)));
  const titleFs1 = 30;
  const titleFs2 = 25;
  const hasTitle = Boolean(titleLine1 || titleLine2);
  const titleH = hasTitle ? titleFs1 * 1.35 + titleFs2 * 1.4 : 0;

  const padTop = Math.round(height * 0.06) + titleH;
  const padBottom = (showXAxis ? fs * 2 : fs * 0.5) + fs * 2.2; // x labels + legend
  const padLeft = showYAxis ? fs * 3 : fs * 0.5;
  const padRight = fs;

  const plotW = Math.max(10, width - padLeft - padRight);
  const plotH = Math.max(10, height - padTop - padBottom);
  const plotX = x + padLeft;
  const plotY = y + padTop;

  const totals = points.map((p) =>
    seriesKeys.reduce((sum, k) => sum + (p.values[k] || 0), 0),
  );
  const rawMax = Math.max(1, ...totals);
  const maxVal = niceMax(rawMax);

  const scaleY = (v: number): number => {
    if (yScale === "log") {
      const lv = Math.log10(Math.max(1, v));
      const lm = Math.log10(Math.max(10, maxVal));
      return (lv / lm) * plotH;
    }
    return (v / maxVal) * plotH;
  };

  const slot = plotW / points.length;
  const barW = Math.max(2, slot * 0.65);

  let out = "";

  // Background panel behind the whole chart box
  if (backgroundColor && backgroundColor !== "none" && backgroundColor !== "transparent") {
    out += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${esc(backgroundColor)}"/>`;
  }

  // Two-line title: campaign name, then data series
  if (hasTitle) {
    const cxTitle = x + width / 2;
    if (titleLine1) {
      out += `<text x="${cxTitle}" y="${y + titleFs1 * 1.15}" font-family="Inter, sans-serif" font-size="${titleFs1}" font-weight="700" fill="#1e293b" text-anchor="middle">${esc(titleLine1)}</text>`;
    }
    if (titleLine2) {
      out += `<text x="${cxTitle}" y="${y + titleFs1 * 1.35 + titleFs2 * 1.1}" font-family="Inter, sans-serif" font-size="${titleFs2}" fill="#64748b" text-anchor="middle">${esc(titleLine2)}</text>`;
    }
  }


  // Y axis ticks + gridlines
  if (showYAxis) {
    const tickCount = 4;
    for (let i = 0; i <= tickCount; i++) {
      const val = (maxVal / tickCount) * i;
      const ty = plotY + plotH - scaleY(val);
      out +=
        `<line x1="${plotX}" y1="${ty}" x2="${plotX + plotW}" y2="${ty}" stroke="#e2e8f0" stroke-width="1"/>` +
        `<text x="${plotX - fs * 0.5}" y="${ty}" font-family="Inter, sans-serif" font-size="${fs}" fill="#64748b" text-anchor="end" dominant-baseline="middle">${esc(formatTick(val, yFormat))}</text>`;
    }
  }

  // Baseline
  out += `<line x1="${plotX}" y1="${plotY + plotH}" x2="${plotX + plotW}" y2="${plotY + plotH}" stroke="#cbd5e1" stroke-width="1"/>`;

  // Bars
  points.forEach((p, i) => {
    const cx = plotX + slot * i + slot / 2;
    let acc = 0;
    for (const key of seriesKeys) {
      const v = p.values[key] || 0;
      if (v <= 0) continue;
      const yTop = plotY + plotH - scaleY(acc + v);
      const yBottom = plotY + plotH - scaleY(acc);
      const h = Math.max(1, yBottom - yTop);
      out += `<rect x="${cx - barW / 2}" y="${yTop}" width="${barW}" height="${h}" fill="${LEVEL_COLORS[key] || "#64748b"}"/>`;
      acc += v;
    }
  });

  // X axis labels — thin out so they don't collide
  if (showXAxis) {
    const approxLabelW = fs * 3.2;
    const step = Math.max(1, Math.ceil(approxLabelW / slot));
    points.forEach((p, i) => {
      if (i % step !== 0) return;
      const cx = plotX + slot * i + slot / 2;
      out += `<text x="${cx}" y="${plotY + plotH + fs * 1.4}" font-family="Inter, sans-serif" font-size="${fs}" fill="#64748b" text-anchor="middle">${esc(p.bucket)}</text>`;
    });
  }

  // Legend
  const legendY = y + height - fs * 0.8;
  const box = fs * 0.85;
  const gap = fs * 0.9;
  const entries = seriesKeys.map((k) => ({
    key: k,
    label: seriesLabels[k] || k,
  }));
  const entryWidths = entries.map((e) => box + fs * 0.4 + e.label.length * fs * 0.55 + gap);
  const totalLegendW = entryWidths.reduce((a, b) => a + b, 0) - gap;
  let lx = x + (width - totalLegendW) / 2;
  entries.forEach((e, i) => {
    out +=
      `<rect x="${lx}" y="${legendY - box}" width="${box}" height="${box}" fill="${LEVEL_COLORS[e.key] || "#64748b"}" rx="1"/>` +
      `<text x="${lx + box + fs * 0.35}" y="${legendY}" font-family="Inter, sans-serif" font-size="${fs}" fill="#475569">${esc(e.label)}</text>`;
    lx += entryWidths[i];
  });

  return out;
}
