import { z } from "zod";
import type { Hotspot } from "@/types/viralTemplates";

export const LAYOUT_SCHEMA_VERSION = 1;

const ACTION_TYPES = new Set(["sms", "email", "social", "external_link"]);

const hotspotSchema = z.object({
  id: z.string().optional(),
  iconId: z.string(),
  type: z.string(),
  label: z.string().default(""),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  zIndex: z.number().optional(),
  labelPosition: z.enum(["top", "bottom"]).optional(),
  metricKey: z.string().optional(),
  manualLabel: z.string().optional(),
  manualHtml: z.string().optional(),
  liveNumberStyle: z.record(z.any()).optional(),
  chartConfig: z.record(z.any()).optional(),
  mapConfig: z.record(z.any()).optional(),
  isTransparent: z.boolean().optional(),
  imageSrc: z.string().optional(),
  imageNaturalRatio: z.number().optional(),
}).passthrough();

export const layoutFileSchema = z.object({
  schemaVersion: z.number(),
  exportedAt: z.string().optional(),
  templateId: z.string().optional(),
  templateName: z.string().optional(),
  sourceAspectRatio: z.string().optional(),
  sourceImageWidth: z.number().optional(),
  sourceImageHeight: z.number().optional(),
  hotspots: z.array(hotspotSchema),
});

export type ParsedLayout = z.infer<typeof layoutFileSchema>;

export interface ExportMeta {
  templateId?: string;
  templateName?: string;
  sourceAspectRatio?: string;
  sourceImageWidth?: number;
  sourceImageHeight?: number;
}

export function exportHotspotsToJson(hotspots: Hotspot[], meta: ExportMeta): string {
  // Skip locked action hotspots — those belong to the underlying slide, not the layout
  const exportable = hotspots.filter((h) => !ACTION_TYPES.has(h.type));
  const payload = {
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    templateId: meta.templateId,
    templateName: meta.templateName,
    sourceAspectRatio: meta.sourceAspectRatio ?? "9:16",
    sourceImageWidth: meta.sourceImageWidth,
    sourceImageHeight: meta.sourceImageHeight,
    hotspots: exportable,
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadJsonFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function makeExportFilename(slug: string | undefined): string {
  const safeSlug = (slug || "template").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `template-${safeSlug}-${stamp}.json`;
}

export function parseHotspotsJson(raw: string): ParsedLayout {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("File is not valid JSON.");
  }
  const parsed = layoutFileSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("File does not match the expected template-layout format.");
  }
  if (parsed.data.schemaVersion !== LAYOUT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schemaVersion ${parsed.data.schemaVersion}. Expected ${LAYOUT_SCHEMA_VERSION}.`
    );
  }
  return parsed.data;
}

/**
 * Generate a fresh hotspot id while preserving everything else.
 */
export function withFreshIds(hotspots: ParsedLayout["hotspots"]): Hotspot[] {
  const now = Date.now();
  return hotspots.map((h, i) => ({
    ...(h as any),
    id: `import-${now}-${i}-${Math.random().toString(36).slice(2, 7)}`,
  })) as Hotspot[];
}

/** Parse "W:H" into a numeric ratio. Returns null if unparseable. */
function parseRatio(ar: string | undefined): number | null {
  if (!ar) return null;
  const m = ar.match(/^(\d+(?:\.\d+)?)\s*[:\/]\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  if (!w || !h) return null;
  return w / h;
}

/**
 * Rescale hotspot percentages from a source aspect ratio to a target aspect ratio.
 * Fits the source canvas inside the target canvas (preserves relative positions).
 */
export function rescaleHotspots(
  hotspots: Hotspot[],
  sourceAspectRatio: string | undefined,
  targetAspectRatio: string
): Hotspot[] {
  const src = parseRatio(sourceAspectRatio);
  const tgt = parseRatio(targetAspectRatio);
  if (!src || !tgt || Math.abs(src - tgt) < 0.001) return hotspots;

  // Treat target canvas as 100x100 percent units. Inscribe source canvas inside it.
  // If source is wider than target: source spans full width, height shrinks.
  // If source is taller: source spans full height, width shrinks.
  let scaleX: number;
  let scaleY: number;
  let offsetX: number;
  let offsetY: number;
  if (src > tgt) {
    scaleX = 1;
    scaleY = tgt / src;
    offsetX = 0;
    offsetY = (1 - scaleY) * 50;
  } else {
    scaleX = src / tgt;
    scaleY = 1;
    offsetX = (1 - scaleX) * 50;
    offsetY = 0;
  }

  return hotspots.map((h) => ({
    ...h,
    x: offsetX + h.x * scaleX,
    y: offsetY + h.y * scaleY,
    width: h.width * scaleX,
    height: h.height * scaleY,
  }));
}

export function ratiosMatch(a: string | undefined, b: string | undefined): boolean {
  const ra = parseRatio(a);
  const rb = parseRatio(b);
  if (ra == null || rb == null) return true; // unknown -> don't prompt
  return Math.abs(ra - rb) < 0.001;
}
