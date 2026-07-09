import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { computeCampaignStoryInputs } from "@/shared/render/campaignStoryInputs";
import { formatCampaignStory } from "@/shared/render/campaignStory";
import { classifyLane, isOrphanRow, type LineageLane } from "@/shared/render/lineageClassify";

/* ------------------------------------------------------------------ *
 * Consolidated Campaign XLSX export
 *
 * Single workbook, three tabs:
 *   1. Reference — human-readable guide + Campaign Story summary +
 *      rendered narrative + data-anomalies line.
 *   2. Events    — pure data (row 1 = headers, row 2+ = data).
 *   3. Tokens    — pure data (row 1 = headers, row 2+ = data).
 *
 * Every summary number on the Reference tab must be recomputable using
 * only the Events and Tokens tabs. Do not add a summary without adding
 * a raw column that supports its recomputation.
 *
 * Depth semantics come from `public.token_lineage.true_depth`
 * (un-clamped). Lane/orphan classification comes from
 * `@/shared/render/lineageClassify` — the same predicate the metric
 * layer uses; do NOT open-code a second copy here.
 * ------------------------------------------------------------------ */

type DataSource = "real" | "simulated" | "all";

function simFilter(builder: any, dataSource: DataSource) {
  if (dataSource === "real") return builder.eq("is_simulated", false);
  if (dataSource === "simulated") return builder.eq("is_simulated", true);
  return builder;
}

async function fetchAll<T = any>(build: (from: number, to: number) => any): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const out: T[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function autoWidth(rows: any[][]): { wch: number }[] {
  if (rows.length === 0) return [];
  const cols = rows[0].length;
  const widths: number[] = new Array(cols).fill(10);
  for (const r of rows) {
    for (let i = 0; i < cols; i++) {
      const len = r[i] == null ? 0 : String(r[i]).length;
      if (len > widths[i]) widths[i] = Math.min(len, 60);
    }
  }
  return widths.map((w) => ({ wch: w + 2 }));
}

function addTableSheet(
  wb: XLSX.WorkBook,
  name: string,
  headers: string[],
  rows: any[][],
) {
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = autoWidth(aoa);
  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, ws, name);
}

/* ------------------------------------------------------------------ *
 * Column dictionaries (used both to build the Reference guide and to
 * emit the raw-tab header rows). Names here are the single source of
 * truth for column order.
 * ------------------------------------------------------------------ */

const EVENT_COLUMNS: { column: string; description: string }[] = [
  { column: "event_id",        description: "url_events.id — unique id for this interaction." },
  { column: "token",           description: "The token that was interacted with (url_events.token)." },
  { column: "true_depth",      description: "Joined from public.token_lineage — un-clamped edge-walked depth of this token." },
  { column: "root_token",      description: "Joined from public.token_lineage — the originating token of the lineage." },
  { column: "event_type",      description: "url_events.event_type: scan | view | share | refrig_generated | refrig_scanned." },
  { column: "occurred_at",     description: "url_events.occurred_at — when the event was recorded (UTC)." },
  { column: "location_source", description: "url_events.location_source: gps | ip | unknown." },
  { column: "zip_code",        description: "url_events.zip_code — resolved postal code (may be null)." },
  { column: "region",          description: "url_events.region — reverse-geocoded region/state. Required for the US-states summary to be recomputable." },
  { column: "country",         description: "url_events.country — reverse-geocoded country. Required for the international-countries summary to be recomputable." },
  { column: "is_simulated",    description: "TRUE when the event was created by the simulator." },
  { column: "lane",            description: "broadcast | chain | orphan — derived from the joined token via the shared classifier (orphan-first). Lane A recomputes as distinct tokens with true_depth = 0; Lane A view-event count is a separate diagnostic, not the headline. Lane B shares recomputes as distinct tokens with true_depth >= 1; Lane B viewers is a smaller number (distinct chain tokens with at least one view event) — surfaced separately in the completion-gap block." },
];

const TOKEN_COLUMNS: { column: string; description: string }[] = [
  { column: "token",                description: "Unique token id. Base L00 tokens are the QR/link template (e.g. l00-<mobilize>-<utmid>); per-scan L00 instances append :xxxxxx." },
  { column: "stored_level",         description: "`tokens.level` at mint time (0–3, clamped by mint_share)." },
  { column: "true_depth",           description: "Edge-walked depth from token_lineage. Un-clamped; per-scan L00 instance edges contribute 0, every other edge contributes 1." },
  { column: "level_depth_mismatch", description: "TRUE when stored_level != true_depth (a stored level was clamped or is otherwise stale)." },
  { column: "parent_token",         description: "The token this token was minted from. NULL for base L00 rows and orphans." },
  { column: "root_token",           description: "The originating token of this lineage." },
  { column: "is_seed",              description: "TRUE when parent_token IS NULL. Also TRUE for orphans — combine with is_orphan to distinguish base L00 templates from severed lineages." },
  { column: "is_orphan",            description: "Parent token was hard-deleted; lineage severed; excluded from both lane counts. Same predicate the metric layer uses." },
  { column: "is_simulated",         description: "TRUE when created by the simulator." },
  { column: "minted_via",           description: "Derived origin: mint_l00 (base template / seed) | instantiate_l00_token / maybe_reinstantiate_l00 (per-scan L00 instance) | mint_share." },
  { column: "created_at",           description: "tokens.minted_at — when the token row was created." },
  { column: "eoa_id",               description: "Event/Action id this token was minted for." },
  { column: "utm_medium",           description: "Channel recorded on the token row (qr/em/sms/social/…)." },
  { column: "utm_content",          description: "Snapshot of mobilize_code + utm_id at mint. Useful for isolating test-tagged rows (utm_content containing 'test')." },
  { column: "utm_campaign",         description: "Campaign code this token belongs to." },
  { column: "engagement_state",     description: "Mirrors the campaign map marker border: none / intent (orange) / completed (cyan). intent = has any child; completed = a child has a view event; else none." },
];

/* ------------------------------------------------------------------ *
 * Reference-tab construction
 * ------------------------------------------------------------------ */

interface ReferenceContext {
  campaignId: string;
  campaignCode: string;
  dataSource: DataSource;
  inputs: any;
  narrative: string;
  tokenRowCount: number;
  eventRowCount: number;
  recomputed: {
    seeds: number;
    broadcastOpensFromEvents: number;
    chainShares: number;
    chainViewersFromEvents: number;
    completedShares: number;
    views: number;
    zipCount: number;
    stateCount: number;
    internationalCountryCount: number;
    maxDepth: number;
    orphanCount: number;
    lastShareAt: string | null;
  };
}

function fmtPct(n: number | null, num?: number, den?: number): string {
  if (n == null) return "n/a (no chain shares)";
  const pct = `${(n * 100).toFixed(1)}%`;
  if (num != null && den != null) return `${pct} (${num}/${den})`;
  return pct;
}

function buildReferenceAoa(ctx: ReferenceContext): any[][] {
  const { campaignCode, dataSource, inputs, narrative, tokenRowCount, eventRowCount, recomputed } = ctx;
  const aoa: any[][] = [];

  // ── Header block
  aoa.push(["Campaign XLSX export"]);
  aoa.push([`Campaign code: ${campaignCode}`]);
  aoa.push([`Data source: ${dataSource}`]);
  aoa.push([`Generated: ${new Date().toISOString()}`]);
  aoa.push([`Rows on Tokens tab: ${tokenRowCount}`]);
  aoa.push([`Rows on Events tab: ${eventRowCount}`]);
  aoa.push([]);

  // ── Block A — Events guide
  aoa.push(["Block A — Events guide"]);
  aoa.push(['One row = one recorded interaction against one token at one moment. Not deduplicated. Not per person.']);
  aoa.push([]);
  aoa.push(["Column", "Description"]);
  for (const c of EVENT_COLUMNS) aoa.push([c.column, c.description]);
  aoa.push([]);

  // ── Block B — Tokens guide
  aoa.push(["Block B — Tokens guide"]);
  aoa.push(["One row = one token."]);
  aoa.push([]);
  aoa.push(["Column", "Description"]);
  for (const c of TOKEN_COLUMNS) aoa.push([c.column, c.description]);
  aoa.push([]);

  // ── Block C — Campaign Story summary
  aoa.push(["Block C — Campaign Story summary"]);
  aoa.push(["Every metric is shown even when zero. Recompute from the Events and Tokens tabs using the recipe in the last column."]);
  aoa.push([]);
  aoa.push(["Metric", "Value", "Source", "How to recompute from raw tabs"]);

  const seedsMetric = recomputed.seeds;
  const broadcastOpens = inputs.broadcastOpens ?? 0;
  const chainShares = recomputed.chainShares;
  const chainViewers = recomputed.chainViewersFromEvents;
  const completedShares = recomputed.completedShares;
  const conversionRate = chainShares > 0 ? completedShares / chainShares : null;

  aoa.push([
    "Seeds",
    seedsMetric,
    "Tokens tab",
    "Count Tokens where true_depth = 0 and is_orphan = FALSE and parent_token IS NULL (base L00 templates).",
  ]);
  aoa.push([
    "Broadcast opens (Lane A) — opens, not people",
    inputs.broadcastOpens ?? 0,
    "Events tab",
    "Count Events where lane = 'broadcast' and event_type = 'view'.",
  ]);
  aoa.push([
    "Chain shares (Lane B)",
    chainShares,
    "Tokens tab",
    "Count Tokens where true_depth >= 1 and is_orphan = FALSE.",
  ]);
  aoa.push([
    "Chain viewers (Lane B) — approximate unique viewers",
    chainViewers,
    "Events tab",
    "Count Events where lane = 'chain' and event_type = 'view'.",
  ]);
  aoa.push([
    "Completed shares",
    completedShares,
    "Tokens tab",
    "Count chain-share Tokens (true_depth >= 1, not orphan) whose engagement_state = 'completed'.",
  ]);
  aoa.push([
    "Conversion rate (completed / chain shares)",
    fmtPct(conversionRate, completedShares, chainShares),
    "Tokens tab",
    "Divide completed shares by chain shares. Denominator includes abandoned shares — a minted share link is indistinguishable from an unsent one.",
  ]);
  aoa.push([
    "Any-hop completion rate (blended)",
    fmtPct(
      inputs.anyHopCompletionRate ?? null,
      inputs.anyHopCompletionNumerator,
      inputs.anyHopCompletionDenominator,
    ),
    "Tokens tab",
    "Fraction of chain-share tokens that produced any child (parent_token IN chain-share tokens).",
  ]);
  aoa.push([
    "Views (all lanes)",
    recomputed.views,
    "Events tab",
    "Count Events where event_type = 'view'.",
  ]);
  aoa.push([
    "Zip codes opened in",
    recomputed.zipCount,
    "Events tab",
    "Distinct non-empty zip_code in Events. Label as 'opened in,' not 'distributed to.'",
  ]);
  aoa.push([
    "US states opened in",
    recomputed.stateCount,
    "Events tab",
    "Distinct non-empty region in Events where country = 'United States'.",
  ]);
  aoa.push([
    "International countries",
    recomputed.internationalCountryCount,
    "Events tab",
    "Distinct non-empty country in Events where country != 'United States'.",
  ]);
  aoa.push([
    "Max chain depth",
    recomputed.maxDepth,
    "Tokens tab",
    "MAX(true_depth) over Tokens (all rows; orphans are 0/absent).",
  ]);
  aoa.push([
    "Orphan count (anomaly, excluded from lanes)",
    recomputed.orphanCount,
    "Tokens tab",
    "Count Tokens where is_orphan = TRUE.",
  ]);
  aoa.push([
    "Last share",
    recomputed.lastShareAt ?? "(none)",
    "Tokens tab",
    "MAX(created_at) over Tokens where true_depth >= 1 and is_orphan = FALSE.",
  ]);
  aoa.push([]);

  // ── Per-hop conversion breakdown (also recomputable from Tokens tab).
  aoa.push(["Per-hop conversion (starts at 1→2 by design; 0→1 is broadcast conversion, reported above)"]);
  aoa.push(["From depth", "To depth", "From count", "To count", "Rate"]);
  const hops = (inputs.perHopConversion || []) as any[];
  if (hops.length === 0) aoa.push(["(none)", "", 0, 0, "0.0%"]);
  for (const h of hops) {
    aoa.push([h.from, h.to, h.fromCount, h.toCount, `${(h.rate * 100).toFixed(1)}%`]);
  }
  aoa.push([]);

  // ── Depth histogram
  aoa.push(["Depth histogram (true_depth, non-orphan)"]);
  aoa.push(["Depth", "Token count"]);
  const hist = (inputs.depthHistogram || []) as any[];
  if (hist.length === 0) aoa.push(["(none)", 0]);
  for (const h of hist) aoa.push([h.depth, h.count]);
  aoa.push([]);

  // ── Data anomalies line — always present
  aoa.push(["Data anomalies"]);
  aoa.push([
    `${recomputed.orphanCount} orphan L1+ tokens with no parent — legacy, excluded from lane counts.`,
  ]);
  aoa.push([]);

  // ── Recompute cross-check
  const broadcastMatch = recomputed.broadcastOpensFromEvents === (inputs.broadcastOpens ?? 0);
  const chainViewersMatch = recomputed.chainViewersFromEvents === (inputs.chainViewers ?? 0);
  const orphanMatch = recomputed.orphanCount === (inputs.orphanCount ?? 0);
  aoa.push(["Metric-layer vs recomputed-from-raw cross-check"]);
  aoa.push(["Metric", "Metric layer", "Recomputed from raw tabs", "Match?"]);
  aoa.push(["Broadcast opens (Lane A views)", inputs.broadcastOpens ?? 0, recomputed.broadcastOpensFromEvents, broadcastMatch ? "OK" : "MISMATCH"]);
  aoa.push(["Chain viewers (Lane B views)",   inputs.chainViewers ?? 0,   recomputed.chainViewersFromEvents,   chainViewersMatch ? "OK" : "MISMATCH"]);
  aoa.push(["Orphan tokens",                   inputs.orphanCount ?? 0,    recomputed.orphanCount,              orphanMatch ? "OK" : "MISMATCH"]);
  aoa.push([]);

  // ── Rendered narrative paragraph
  aoa.push(["Campaign Story (rendered narrative)"]);
  const paragraphs = narrative.split("\n");
  for (const p of paragraphs) aoa.push([p]);

  return aoa;
}

/* ------------------------------------------------------------------ *
 * Engagement-state computation (mirrors SamizdatMap border rules).
 * ------------------------------------------------------------------ */

type EngagementState = "none" | "intent" | "completed";

function computeEngagementStates(
  lineageRows: any[],
  viewedTokens: Set<string>,
): Map<string, EngagementState> {
  const childrenByParent = new Map<string, any[]>();
  for (const r of lineageRows) {
    if (!r.parent_token) continue;
    const arr = childrenByParent.get(r.parent_token) ?? [];
    arr.push(r);
    childrenByParent.set(r.parent_token, arr);
  }
  const state = new Map<string, EngagementState>();
  for (const r of lineageRows) {
    const children = childrenByParent.get(r.token) ?? [];
    if (children.length === 0) {
      state.set(r.token, "none");
      continue;
    }
    const anyViewed = children.some((c) => viewedTokens.has(c.token));
    state.set(r.token, anyViewed ? "completed" : "intent");
  }
  return state;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export async function exportCampaignXlsx(
  campaignId: string,
  campaignCode: string,
  dataSource: DataSource,
): Promise<{ tokens: number; events: number; filename: string }> {
  if (!campaignId) throw new Error("exportCampaignXlsx: campaignId is required");
  if (!campaignCode) throw new Error("exportCampaignXlsx: campaignCode is required");

  // ── Metric layer (Reference tab summary). Real vs simulated: the
  // metric layer is per-source; when the dashboard selector is set to
  // 'all', the honest label is 'real' — simulator noise stays isolated.
  const metricSource: "real" | "simulated" =
    dataSource === "simulated" ? "simulated" : "real";
  const inputs = await computeCampaignStoryInputs(supabase, {
    campaignCode,
    campaignId,
    dataSource: metricSource,
  });

  // ── Token lineage (paged; batched range() covers >1000 rows).
  const lineageRows = await fetchAll<any>((from, to) =>
    simFilter(
      supabase
        .from("token_lineage" as any)
        .select("*")
        .eq("utm_campaign", campaignCode)
        .order("created_at", { ascending: true })
        .range(from, to),
      dataSource,
    ),
  );

  // ── utm_content is on tokens (not on the token_lineage view). Fetch
  // it separately and join by token id so a reviewer can filter test
  // rows (utm_content containing 'test') without leaving the raw tab.
  const utmContentByToken = new Map<string, string | null>();
  const tokenList = lineageRows.map((r) => r.token);
  {
    const chunk = 500;
    for (let i = 0; i < tokenList.length; i += chunk) {
      const slice = tokenList.slice(i, i + chunk);
      if (slice.length === 0) break;
      const { data, error } = await supabase
        .from("tokens")
        .select("token, utm_content")
        .in("token", slice);
      if (error) throw error;
      for (const row of (data || []) as any[]) {
        utmContentByToken.set(row.token, row.utm_content ?? null);
      }
    }
  }

  // ── url_events for those tokens, batched. Region + country are
  // required so the states / international-countries summaries are
  // reproducible from Tab 2 alone.
  const events: any[] = [];
  {
    const chunk = 500;
    for (let i = 0; i < tokenList.length; i += chunk) {
      const slice = tokenList.slice(i, i + chunk);
      if (slice.length === 0) break;
      const rows = await fetchAll<any>((from, to) =>
        simFilter(
          supabase
            .from("url_events")
            .select("id, token, event_type, occurred_at, location_source, zip_code, region, country, is_simulated")
            .in("token", slice)
            .is("deleted_at", null)
            .order("occurred_at", { ascending: true })
            .range(from, to),
          dataSource,
        ),
      );
      events.push(...rows);
    }
  }

  // ── Classify and enrich.
  const lineageByToken = new Map(lineageRows.map((r) => [r.token, r]));
  const viewedTokens = new Set(
    events.filter((e) => e.event_type === "view").map((e) => e.token),
  );
  const engagement = computeEngagementStates(lineageRows, viewedTokens);
  const laneByToken = new Map<string, LineageLane>(
    lineageRows.map((r) => [r.token, classifyLane(r)]),
  );

  // ── Recomputed-from-raw metrics (drive the Reference cross-check
  // and the summary values that come from the Events tab).
  let broadcastOpensFromEvents = 0;
  let chainViewersFromEvents = 0;
  let views = 0;
  const zipSet = new Set<string>();
  const stateSet = new Set<string>();
  const intlCountrySet = new Set<string>();
  for (const e of events) {
    if (e.event_type === "view") views += 1;
    const lane = laneByToken.get(e.token) ?? "orphan";
    if (e.event_type === "view") {
      if (lane === "broadcast") broadcastOpensFromEvents += 1;
      else if (lane === "chain") chainViewersFromEvents += 1;
    }
    if (e.zip_code) zipSet.add(String(e.zip_code));
    if (e.country === "United States" && e.region) stateSet.add(String(e.region));
    if (e.country && e.country !== "United States") intlCountrySet.add(String(e.country));
  }

  // Tokens-tab recomputes.
  let seeds = 0;
  let chainShares = 0;
  let orphanCount = 0;
  let maxDepth = 0;
  let lastShareMs = -Infinity;
  let lastShareAt: string | null = null;
  let completedShares = 0;
  for (const r of lineageRows) {
    const depth = Number(r.true_depth ?? 0);
    if (depth > maxDepth) maxDepth = depth;
    if (isOrphanRow(r)) { orphanCount += 1; continue; }
    if (depth === 0 && r.parent_token == null) seeds += 1;
    if (depth >= 1) {
      chainShares += 1;
      if (engagement.get(r.token) === "completed") completedShares += 1;
      const t = new Date(r.created_at || 0).getTime();
      if (t > lastShareMs) { lastShareMs = t; lastShareAt = r.created_at ?? null; }
    }
  }

  // ── Rendered narrative paragraph (identical to the Campaign Story
  // hotspot text; a reviewer can eyeball narrative-vs-numbers here).
  const seedCountForStory = seeds;
  const narrative = formatCampaignStory({
    campaignTitle: inputs.campaignTitle,
    activeAnchorMs: new Date(inputs.campaignActiveAnchor).getTime(),
    nowMs: Date.now(),
    dataSource: metricSource,
    seedCount: seedCountForStory,
    intentCount: inputs.intentCount,
    viewCount: inputs.viewCount,
    zipCount: inputs.zipCount,
    stateCount: inputs.stateCount,
    internationalCountries: inputs.internationalCountries,
    maxDepth: inputs.maxDepth,
    propagationSpeed: inputs.propagationSpeed,
    shareMediums: inputs.shareMediums,
    lastShareAt: inputs.lastShareAt,
    speedOriginCity: inputs.speedOriginCity,
    speedDestCity: inputs.speedDestCity,
    broadcastOpens: inputs.broadcastOpens,
    chainViewers: inputs.chainViewers,
    orphanCount: inputs.orphanCount,
    anyHopCompletionRate: inputs.anyHopCompletionRate,
    anyHopCompletionNumerator: inputs.anyHopCompletionNumerator,
    anyHopCompletionDenominator: inputs.anyHopCompletionDenominator,
    longestChainIsLinear: inputs.longestChainIsLinear,
    singleCarrierTailHops: inputs.singleCarrierTailHops,
    longestChainTerminalUnopened: inputs.longestChainTerminalUnopened,
  } as any);

  // ── Build workbook.
  const wb = XLSX.utils.book_new();

  const refAoa = buildReferenceAoa({
    campaignId,
    campaignCode,
    dataSource,
    inputs,
    narrative,
    tokenRowCount: lineageRows.length,
    eventRowCount: events.length,
    recomputed: {
      seeds,
      broadcastOpensFromEvents,
      chainShares,
      chainViewersFromEvents,
      completedShares,
      views,
      zipCount: zipSet.size,
      stateCount: stateSet.size,
      internationalCountryCount: intlCountrySet.size,
      maxDepth,
      orphanCount,
      lastShareAt,
    },
  });
  const refWs = XLSX.utils.aoa_to_sheet(refAoa);
  refWs["!cols"] = [{ wch: 44 }, { wch: 22 }, { wch: 20 }, { wch: 90 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, refWs, "Reference");

  // ── Events tab (row 1 = headers).
  const eventHeaders = EVENT_COLUMNS.map((c) => c.column);
  const eventBody = events.map((e) => {
    const l = lineageByToken.get(e.token) || {};
    const lane = laneByToken.get(e.token) ?? "orphan";
    return [
      e.id,
      e.token,
      (l as any).true_depth ?? "",
      (l as any).root_token ?? "",
      e.event_type,
      e.occurred_at,
      e.location_source ?? "",
      e.zip_code ?? "",
      e.region ?? "",
      e.country ?? "",
      e.is_simulated,
      lane,
    ];
  });
  addTableSheet(wb, "Events", eventHeaders, eventBody);

  // ── Tokens tab (row 1 = headers).
  const tokenHeaders = TOKEN_COLUMNS.map((c) => c.column);
  const tokenBody = lineageRows.map((r) => {
    const lane = laneByToken.get(r.token) ?? "orphan";
    const enriched: Record<string, any> = {
      token: r.token,
      stored_level: r.stored_level ?? "",
      true_depth: r.true_depth ?? "",
      level_depth_mismatch: r.level_depth_mismatch ?? "",
      parent_token: r.parent_token ?? "",
      root_token: r.root_token ?? "",
      is_seed: r.is_seed ?? "",
      is_orphan: lane === "orphan",
      is_simulated: r.is_simulated,
      minted_via: r.minted_via ?? "",
      created_at: r.created_at ?? "",
      eoa_id: r.eoa_id ?? "",
      utm_medium: r.utm_medium ?? "",
      utm_content: utmContentByToken.get(r.token) ?? "",
      utm_campaign: r.utm_campaign ?? "",
      engagement_state: engagement.get(r.token) ?? "none",
    };
    return tokenHeaders.map((h) => enriched[h] ?? "");
  });
  addTableSheet(wb, "Tokens", tokenHeaders, tokenBody);

  const filename = `${campaignCode}-${format(new Date(), "yyyy-MM-dd-HHmm")}.xlsx`;
  XLSX.writeFile(wb, filename, { bookType: "xlsx" });
  return { tokens: lineageRows.length, events: events.length, filename };
}
