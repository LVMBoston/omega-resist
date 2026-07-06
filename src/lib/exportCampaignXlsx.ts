import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

type DataSource = "real" | "simulated" | "all";

function simFilter(builder: any, dataSource: DataSource) {
  if (dataSource === "real") return builder.eq("is_simulated", false);
  if (dataSource === "simulated") return builder.eq("is_simulated", true);
  return builder;
}

/** Fetch every row in batches so we bypass Supabase's 1000-row default. */
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
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, ws, name);
}

function addOverviewSheet(
  wb: XLSX.WorkBook,
  title: string,
  narrative: string[],
  schema: { column: string; description: string }[],
  campaignCode: string,
  dataSource: DataSource,
  rowCount: number,
) {
  const aoa: any[][] = [];
  aoa.push([title]);
  aoa.push([`Campaign: ${campaignCode}`]);
  aoa.push([`Data source: ${dataSource}`]);
  aoa.push([`Rows in "Data" tab: ${rowCount}`]);
  aoa.push([`Generated: ${new Date().toISOString()}`]);
  aoa.push([]);
  aoa.push(["What one row represents"]);
  for (const line of narrative) aoa.push([line]);
  aoa.push([]);
  aoa.push(["Column dictionary"]);
  aoa.push(["Column", "Description"]);
  for (const row of schema) aoa.push([row.column, row.description]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 28 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(wb, ws, "Overview");
}

function download(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename, { bookType: "xlsx" });
}

/* ------------------------------------------------------------------ *
 * TOKEN export
 * ------------------------------------------------------------------ */

const TOKEN_SCHEMA: { column: string; description: string }[] = [
  { column: "token", description: "Unique token id. Base L00 tokens are the QR/link template (e.g. l00-<mobilize>-<utmid>); per-scan L00 instances append :xxxxxx." },
  { column: "stored_level", description: "The `level` column stored on the tokens row at mint time (0-3, clamped by mint_share)." },
  { column: "true_depth", description: "Depth computed by walking parent_token back to the root. Not clamped. Can exceed 3 where stored_level was capped." },
  { column: "level_depth_mismatch", description: "TRUE when stored_level != true_depth. Every row where this is TRUE means the stored level is wrong or clamped." },
  { column: "parent_token", description: "The token this token was minted off. NULL for base L00 rows." },
  { column: "root_token", description: "The originating token of this lineage. Equal to `token` for base L00 rows; for L00 instances, equal to the base L00 token." },
  { column: "is_seed", description: "TRUE when parent_token IS NULL. Identifies the base L00 template rows created by mint_l00." },
  { column: "is_simulated", description: "TRUE when the token was created by the simulator, not by a real scan/share." },
  { column: "minted_via", description: "Best-guess origin function. There is NO explicit `minted_via` column in the tokens table; this is derived from parent_token, level, and token shape (see Overview)." },
  { column: "created_at", description: "tokens.minted_at — when the token row was created." },
  { column: "eoa_id", description: "Event/Action id this token was minted for." },
  { column: "utm_medium", description: "Channel recorded on the token row (qr/em/sms/social/etc.)." },
  { column: "utm_campaign", description: "Campaign code this token belongs to." },
  { column: "deck_slug", description: "Deck the token pointed at when minted." },
  { column: "l00_instance", description: "For per-scan L00 instances, the token id of the instance (points to self). NULL on base L00 tokens and on L01+ children." },
];

const TOKEN_NARRATIVE = [
  "One row = one token in the tokens table (soft-deleted rows excluded).",
  "This sheet is a direct dump of the public.token_lineage database view, which walks parent_token -> root to compute true_depth and compares it against stored_level.",
  "Base L00 template tokens (created by mint_l00) and per-scan L00 instances (created by instantiate_l00_token / maybe_reinstantiate_l00) are both included. Distinguish them via is_seed and minted_via.",
  "No URL parsing was needed to build this file; every column comes from structured fields on tokens.",
];

export async function exportTokensXlsx(
  campaignCode: string,
  dataSource: DataSource,
) {
  const rows = await fetchAll<any>((from, to) =>
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

  if (rows.length === 0) throw new Error(`No tokens found for campaign ${campaignCode}`);

  const headers = TOKEN_SCHEMA.map((c) => c.column);
  const body = rows.map((r) => headers.map((h) => (r as any)[h] ?? ""));

  const wb = XLSX.utils.book_new();
  addOverviewSheet(
    wb,
    "Token export",
    TOKEN_NARRATIVE,
    TOKEN_SCHEMA,
    campaignCode,
    dataSource,
    rows.length,
  );
  addTableSheet(wb, "Tokens", headers, body);

  download(
    wb,
    `${campaignCode}-tokens-${format(new Date(), "yyyy-MM-dd-HHmm")}.xlsx`,
  );
  return rows.length;
}

/* ------------------------------------------------------------------ *
 * EVENT export
 * ------------------------------------------------------------------ */

const EVENT_SCHEMA: { column: string; description: string }[] = [
  { column: "event_id", description: "url_events.id — unique id for this open/interaction." },
  { column: "token", description: "The token that was opened, from url_events.token." },
  { column: "true_depth", description: "Joined from public.token_lineage — the walked depth of this token, not the stored level." },
  { column: "stored_level", description: "Joined from public.token_lineage — the level column stored on the token row." },
  { column: "root_token", description: "Joined from public.token_lineage — the root of this lineage." },
  { column: "event_type", description: "url_events.event_type: scan | view | share | refrig_generated | refrig_scanned." },
  { column: "occurred_at", description: "url_events.occurred_at — when the event was recorded (UTC)." },
  { column: "location_source", description: "url_events.location_source: gps | ip | unknown." },
  { column: "zip_code", description: "url_events.zip_code — resolved postal code (may be null)." },
  { column: "is_simulated", description: "TRUE when the event was created by the simulator." },
];

const EVENT_NARRATIVE = [
  "One row = one recorded interaction (url_events.event_type) against one token at one moment. It is NOT deduplicated per person or per device.",
  "There is no session id, device id, or hashed IP that identifies repeat opens by the same person. url_events.ip_address exists but is cleared as soon as the zip code is resolved (see clear_ip_when_zip_populated trigger), so it cannot be used as a stable identity. If we need repeat-visitor analysis we must add a new field; today the schema does not support it.",
  "All columns come from structured fields; no full_url decoding was performed.",
];

export async function exportEventsXlsx(
  campaignCode: string,
  dataSource: DataSource,
) {
  // 1. token_lineage for this campaign
  const lineage = await fetchAll<any>((from, to) =>
    simFilter(
      supabase
        .from("token_lineage" as any)
        .select("token, stored_level, true_depth, root_token")
        .eq("utm_campaign", campaignCode)
        .range(from, to),
      dataSource,
    ),
  );
  if (lineage.length === 0) throw new Error(`No tokens found for campaign ${campaignCode}`);

  const lineageByToken = new Map(lineage.map((l) => [l.token, l]));
  const tokenList = lineage.map((l) => l.token);

  // 2. events for those tokens, batched by token chunk of 500 to keep .in() sane
  const events: any[] = [];
  const chunk = 500;
  for (let i = 0; i < tokenList.length; i += chunk) {
    const slice = tokenList.slice(i, i + chunk);
    const rows = await fetchAll<any>((from, to) =>
      simFilter(
        supabase
          .from("url_events")
          .select("id, token, event_type, occurred_at, location_source, zip_code, is_simulated")
          .in("token", slice)
          .is("deleted_at", null)
          .order("occurred_at", { ascending: true })
          .range(from, to),
        dataSource,
      ),
    );
    events.push(...rows);
  }

  if (events.length === 0) throw new Error(`No events found for campaign ${campaignCode}`);

  const body = events.map((e) => {
    const l = lineageByToken.get(e.token) || {};
    return [
      e.id,
      e.token,
      (l as any).true_depth ?? "",
      (l as any).stored_level ?? "",
      (l as any).root_token ?? "",
      e.event_type,
      e.occurred_at,
      e.location_source ?? "",
      e.zip_code ?? "",
      e.is_simulated,
    ];
  });

  const wb = XLSX.utils.book_new();
  addOverviewSheet(
    wb,
    "Event export",
    EVENT_NARRATIVE,
    EVENT_SCHEMA,
    campaignCode,
    dataSource,
    events.length,
  );
  addTableSheet(wb, "Events", EVENT_SCHEMA.map((c) => c.column), body);
  addOmittedColumnsSheet(wb);

  download(
    wb,
    `${campaignCode}-events-${format(new Date(), "yyyy-MM-dd-HHmm")}.xlsx`,
  );
  return events.length;
}

/* ------------------------------------------------------------------ *
 * "What we left out" sheet — appended to the event export so it's
 * easy to see what other data is available.
 * ------------------------------------------------------------------ */

const OMITTED_TOKEN_COLS = [
  ["id", "Internal UUID primary key of the tokens row (token text is the business key)."],
  ["utm_id", "Placement id from Mobilize; part of the L00 template's identity."],
  ["utm_content", "Concatenated mobilize_code + utm_id snapshot at mint."],
  ["utm_source", "L00/L01/L02/L03 label string set at mint time."],
  ["full_url", "The complete deep-link URL. Not included because every field it encodes is already a structured column."],
  ["created_by", "auth.users.id that minted this token (null for public/scanner mints)."],
  ["deleted_at", "Soft-delete timestamp. Excluded rows are already filtered."],
  ["deck_version_at_mint", "Deck version string captured when the token was minted."],
];

const OMITTED_EVENT_COLS = [
  ["utm_snapshot", "JSONB copy of the utm params at the moment of the event; redundant with the token's stored utm_* columns but useful for auditing tampering."],
  ["ip_address", "Client IP. Auto-cleared once zip_code is resolved (trigger clear_ip_when_zip_populated). Not a stable identifier."],
  ["user_agent", "Raw UA string. Not a person identifier; can help distinguish iOS vs Android vs desktop share behavior."],
  ["latitude / longitude", "Precise coordinates when location_source='gps'. Excluded from event export for size; available in the URL export in exportCampaignData.ts."],
  ["city / region / country / country_code", "Reverse-geocoded location fields."],
  ["deleted_at", "Soft-delete timestamp. Excluded rows are already filtered out."],
];

function addOmittedColumnsSheet(wb: XLSX.WorkBook) {
  const aoa: any[][] = [];
  aoa.push(["Columns in tokens/url_events NOT in these exports"]);
  aoa.push([]);
  aoa.push(["tokens columns not exported"]);
  aoa.push(["Column", "Description"]);
  for (const [c, d] of OMITTED_TOKEN_COLS) aoa.push([c, d]);
  aoa.push([]);
  aoa.push(["url_events columns not exported"]);
  aoa.push(["Column", "Description"]);
  for (const [c, d] of OMITTED_EVENT_COLS) aoa.push([c, d]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 28 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(wb, ws, "What we left out");
}
