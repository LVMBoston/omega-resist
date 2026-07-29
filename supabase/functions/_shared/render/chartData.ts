// Canonical chart-series computation shared by the SSR snapshot renderer.
// Mirrors the client hook `src/hooks/useChartData.ts` so the baked SVG chart
// matches what the editor shows with Recharts.

export type ChartDataSource =
  | "cumulative_opens_by_level"
  | "opens_per_period"
  | "shares_per_period"
  | "unique_viewers_per_period"
  | "new_l00_seeds_per_period";

export type ChartTimeBucket = "day" | "week" | "month";

export interface ChartPoint {
  bucket: string;
  values: Record<string, number>;
}

export interface ChartSeriesResult {
  points: ChartPoint[];
  seriesKeys: string[];
  seriesLabels: Record<string, string>;
}

export const LEVEL_COLORS: Record<string, string> = {
  L00_seeds: "hsl(221, 83%, 35%)",
  L00_spawns: "hsl(221, 83%, 65%)",
  L00: "hsl(221, 83%, 50%)",
  L01: "hsl(142, 71%, 45%)",
  L02: "hsl(32, 95%, 44%)",
  L03: "hsl(0, 72%, 51%)",
  seeds: "hsl(221, 83%, 50%)",
};

export const SERIES_LABELS: Record<string, string> = {
  L00_seeds: "Seeds",
  L00_spawns: "Sprouts",
  L00: "L00",
  L01: "L01",
  L02: "L02",
  L03: "L03+",
  seeds: "New Seeds",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// ISO-style week start (Monday)
function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  const dow = (day.getUTCDay() + 6) % 7; // Mon = 0
  day.setUTCDate(day.getUTCDate() - dow);
  return day;
}

function isoWeekNumber(d: Date): number {
  const target = startOfDay(d);
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

export function bucketStart(d: Date, bucket: ChartTimeBucket): Date {
  if (bucket === "day") return startOfDay(d);
  if (bucket === "month") return startOfMonth(d);
  return startOfWeek(d);
}

export function bucketLabel(d: Date, bucket: ChartTimeBucket): string {
  if (bucket === "day") return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  if (bucket === "month") return MONTHS[d.getUTCMonth()];
  return `W${String(isoWeekNumber(d)).padStart(2, "0")}`;
}

function advance(d: Date, bucket: ChartTimeBucket): Date {
  const next = new Date(d.getTime());
  if (bucket === "day") next.setUTCDate(next.getUTCDate() + 1);
  else if (bucket === "month") next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

function buildEmptyBuckets(start: Date, end: Date, bucket: ChartTimeBucket) {
  const out: { start: Date; label: string }[] = [];
  let cur = bucketStart(start, bucket);
  const last = bucketStart(end, bucket);
  let i = 0;
  while (cur.getTime() <= last.getTime() && i < 200) {
    out.push({ start: new Date(cur.getTime()), label: bucketLabel(cur, bucket) });
    cur = advance(cur, bucket);
    i++;
  }
  return out;
}

export interface ChartTokenRow {
  token: string;
  level: number;
  minted_at: string;
  parent_token: string | null;
}

export interface ChartEventRow {
  token: string;
  occurred_at: string;
}

const EMPTY: ChartSeriesResult = { points: [], seriesKeys: [], seriesLabels: {} };

function labelsFor(keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, SERIES_LABELS[k] || k]));
}

/**
 * Compute stacked-bar chart series from raw tokens + view events.
 * Pure — callers supply already-fetched, campaign-scoped rows.
 */
export function computeChartSeries(args: {
  tokens: ChartTokenRow[];
  events: ChartEventRow[];
  dataSource: ChartDataSource;
  timeBucket: ChartTimeBucket;
  officialStart?: string | null;
}): ChartSeriesResult {
  const { tokens, events, dataSource, timeBucket, officialStart } = args;
  if (!tokens || tokens.length === 0) return EMPTY;

  const tokenLevelMap = new Map<string, number>();
  tokens.forEach((t) => tokenLevelMap.set(t.token, t.level));

  if (dataSource === "new_l00_seeds_per_period") {
    let seeds = tokens.filter((t) => t.level === 0 && t.minted_at);
    if (officialStart) seeds = seeds.filter((t) => t.minted_at >= officialStart);
    if (seeds.length === 0) return EMPTY;
    const sorted = [...seeds].sort((a, b) => a.minted_at.localeCompare(b.minted_at));
    const buckets = buildEmptyBuckets(
      new Date(sorted[0].minted_at),
      new Date(sorted[sorted.length - 1].minted_at),
      timeBucket,
    );
    const counts = new Map<string, number>();
    buckets.forEach((b) => counts.set(b.label, 0));
    sorted.forEach((t) => {
      const lbl = bucketLabel(bucketStart(new Date(t.minted_at), timeBucket), timeBucket);
      if (counts.has(lbl)) counts.set(lbl, (counts.get(lbl) || 0) + 1);
    });
    return {
      points: buckets.map((b) => ({ bucket: b.label, values: { seeds: counts.get(b.label) || 0 } })),
      seriesKeys: ["seeds"],
      seriesLabels: labelsFor(["seeds"]),
    };
  }

  if (dataSource === "shares_per_period") {
    let shares = tokens.filter((t) => t.level > 0 && t.parent_token && t.minted_at);
    if (officialStart) shares = shares.filter((t) => t.minted_at >= officialStart);
    if (shares.length === 0) return EMPTY;
    const sorted = [...shares].sort((a, b) => a.minted_at.localeCompare(b.minted_at));
    const buckets = buildEmptyBuckets(
      new Date(sorted[0].minted_at),
      new Date(sorted[sorted.length - 1].minted_at),
      timeBucket,
    );
    const keys = ["L00", "L01", "L02", "L03"];
    const bucketMap = new Map<string, Record<string, number>>();
    buckets.forEach((b) => bucketMap.set(b.label, { L00: 0, L01: 0, L02: 0, L03: 0 }));
    sorted.forEach((t) => {
      const lbl = bucketLabel(bucketStart(new Date(t.minted_at), timeBucket), timeBucket);
      const parentLevel = tokenLevelMap.get(t.parent_token!) ?? 0;
      const key = `L0${Math.min(parentLevel, 3)}`;
      const slot = bucketMap.get(lbl);
      if (slot) slot[key]++;
    });
    return {
      points: buckets.map((b) => ({ bucket: b.label, values: bucketMap.get(b.label)! })),
      seriesKeys: keys,
      seriesLabels: labelsFor(keys),
    };
  }

  // Remaining sources need view events
  let evts = (events || []).filter((e) => e.occurred_at);
  if (officialStart) evts = evts.filter((e) => e.occurred_at >= officialStart);
  if (evts.length === 0) return EMPTY;
  evts = [...evts].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  const buckets = buildEmptyBuckets(
    new Date(evts[0].occurred_at),
    new Date(evts[evts.length - 1].occurred_at),
    timeBucket,
  );

  const tokensWithViews = new Set(evts.map((e) => e.token));
  const l00WithSpawns = new Set<string>();
  const byToken = new Map<string, ChartTokenRow>(tokens.map((t) => [t.token, t]));
  tokens.forEach((t) => {
    if (t.level >= 1 && t.parent_token && tokensWithViews.has(t.token)) {
      const parent = byToken.get(t.parent_token);
      if (parent && parent.level === 0) l00WithSpawns.add(parent.token);
    }
  });

  const keys = ["L00_seeds", "L00_spawns", "L01", "L02", "L03"];
  const bucketMap = new Map<string, Record<string, number>>();
  buckets.forEach((b) =>
    bucketMap.set(b.label, { L00_seeds: 0, L00_spawns: 0, L01: 0, L02: 0, L03: 0 }),
  );
  const seenPerBucket = new Map<string, Set<string>>();
  buckets.forEach((b) => seenPerBucket.set(b.label, new Set()));

  evts.forEach((ev) => {
    const lbl = bucketLabel(bucketStart(new Date(ev.occurred_at), timeBucket), timeBucket);
    const slot = bucketMap.get(lbl);
    if (!slot) return;
    if (dataSource === "unique_viewers_per_period") {
      const seen = seenPerBucket.get(lbl)!;
      if (seen.has(ev.token)) return;
      seen.add(ev.token);
    }
    const level = tokenLevelMap.get(ev.token) ?? 0;
    if (level === 0) {
      if (l00WithSpawns.has(ev.token)) slot.L00_spawns++;
      else slot.L00_seeds++;
    } else {
      slot[`L0${Math.min(level, 3)}`]++;
    }
  });

  const cumulative = dataSource === "cumulative_opens_by_level";
  const running: Record<string, number> = { L00_seeds: 0, L00_spawns: 0, L01: 0, L02: 0, L03: 0 };
  const points: ChartPoint[] = buckets.map((b) => {
    const v = bucketMap.get(b.label)!;
    if (!cumulative) return { bucket: b.label, values: { ...v } };
    for (const k of keys) running[k] += v[k];
    return { bucket: b.label, values: { ...running } };
  });

  return { points, seriesKeys: keys, seriesLabels: labelsFor(keys) };
}

// --- Chart titles (mirror of src/lib/chartTitles.ts) ---

const BUCKET_WORD: Record<string, string> = { day: "day", week: "week", month: "month" };

const SOURCE_TITLES: Record<string, string> = {
  cumulative_opens_by_level: "Cumulative opens by level",
  opens_per_period: "Opens per {bucket}",
  shares_per_period: "Shares per {bucket}",
  unique_viewers_per_period: "Unique viewers per {bucket}",
  new_l00_seeds_per_period: "New seeds per {bucket}",
};

export function chartSeriesTitle(dataSource?: string, timeBucket?: string): string {
  const template = SOURCE_TITLES[dataSource || "cumulative_opens_by_level"] || "Chart";
  const bucket = BUCKET_WORD[timeBucket || "week"] || "period";
  return template.replace("{bucket}", bucket);
}
