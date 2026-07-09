/**
 * Single source of truth for classifying token_lineage rows into
 * orphan / broadcast / chain buckets. Both the metric layer
 * (`campaignStoryInputs.ts`) and the XLSX exporter
 * (`src/lib/exportCampaignXlsx.ts`) must import from this file — never
 * open-code the predicate a second time. See
 * docs/decisions/campaign-story/2026-07-08_campaign-story-v2_feature-doc_lovable.md
 * for why the definitions have to agree.
 *
 * Row shape: whatever the caller has, so long as it exposes `token`,
 * `parent_token`, and `true_depth`. Typed `any` because this module is
 * imported by both the browser and Deno runtimes.
 */

export type LineageLane = "broadcast" | "chain" | "orphan";

/**
 * True when a token is a legacy orphan (parent hard-deleted). Base L00
 * template rows also have `parent_token IS NULL` but are NOT orphans —
 * they are distinguished by the `l00-` id prefix set by `mint_l00`.
 */
export function isOrphanRow(row: any): boolean {
  if (row?.parent_token != null) return false;
  const token: string = row?.token ?? "";
  return !(typeof token === "string" && token.startsWith("l00-"));
}

/**
 * Classify a lineage row into broadcast (Lane A, true_depth = 0) /
 * chain (Lane B, true_depth ≥ 1) / orphan. Orphan check runs first, so
 * a null/edge `true_depth` on an orphan can never leak into a lane.
 */
export function classifyLane(row: any): LineageLane {
  if (isOrphanRow(row)) return "orphan";
  const depth = Number(row?.true_depth ?? 0);
  if (depth === 0) return "broadcast";
  return "chain";
}
