import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  startOfWeek,
  startOfMonth,
  startOfDay,
  format,
  parseISO,
  addDays,
  addMonths,
  isBefore,
} from "date-fns";
import type {
  ChartDataSource,
  ChartTimeBucket,
} from "@/types/viralTemplates";

/**
 * Normalized chart point. `series` is a sparse map keyed by series name
 * (e.g. "L00_seeds", "L01", or "seeds"). The renderer reads `seriesKeys`
 * to know which bars to stack.
 */
export interface ChartPoint {
  bucket: string;          // display label e.g. "W04" or "Feb 12" or "Feb"
  bucketStart: Date;
  [key: string]: any;      // series values flattened for Recharts
}

export interface ChartDataResult {
  points: ChartPoint[];
  seriesKeys: string[];
  seriesLabels: Record<string, string>;
}

interface UseChartDataResult {
  data: ChartPoint[];
  seriesKeys: string[];
  seriesLabels: Record<string, string>;
  loading: boolean;
  error: string | null;
  fetchChartData: (
    campaignCode: string,
    dataSource?: ChartDataSource,
    timeBucket?: ChartTimeBucket,
  ) => Promise<void>;
}

// Fixed color palette (HSL values for chart colors)
export const LEVEL_COLORS: Record<string, string> = {
  L00_seeds: "hsl(221, 83%, 35%)",   // Darker blue – seeds without spawns
  L00_spawns: "hsl(221, 83%, 65%)",  // Lighter blue – seeds with spawns
  L00: "hsl(221, 83%, 50%)",         // Generic L00 (when no seed/spawn split)
  L01: "hsl(142, 71%, 45%)",         // Green
  L02: "hsl(32, 95%, 44%)",          // Orange
  L03: "hsl(0, 72%, 51%)",           // Red
  seeds: "hsl(221, 83%, 50%)",       // New L00 seeds per period
};

const SERIES_LABELS: Record<string, string> = {
  L00_seeds: "Seeds",
  L00_spawns: "Sprouts",
  L00: "L00",
  L01: "L01",
  L02: "L02",
  L03: "L03+",
  seeds: "New Seeds",
};

// ---------- bucket helpers ----------

function bucketStart(d: Date, bucket: ChartTimeBucket): Date {
  if (bucket === "day") return startOfDay(d);
  if (bucket === "month") return startOfMonth(d);
  return startOfWeek(d, { weekStartsOn: 1 });
}

function bucketLabel(d: Date, bucket: ChartTimeBucket): string {
  if (bucket === "day") return format(d, "MMM d");
  if (bucket === "month") return format(d, "MMM");
  return `W${format(d, "ww")}`;
}

function advance(d: Date, bucket: ChartTimeBucket): Date {
  if (bucket === "day") return addDays(d, 1);
  if (bucket === "month") return addMonths(d, 1);
  return addDays(d, 7);
}

function buildEmptyBuckets(
  start: Date,
  end: Date,
  bucket: ChartTimeBucket,
): { start: Date; label: string }[] {
  const out: { start: Date; label: string }[] = [];
  let cur = bucketStart(start, bucket);
  const last = bucketStart(end, bucket);
  // safety: cap at 200 buckets to avoid runaway
  let i = 0;
  while (!isBefore(last, cur) && i < 200) {
    out.push({ start: new Date(cur), label: bucketLabel(cur, bucket) });
    cur = advance(cur, bucket);
    i++;
  }
  return out;
}

// ---------- main hook ----------

export function useChartData(): UseChartDataResult {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [seriesKeys, setSeriesKeys] = useState<string[]>([]);
  const [seriesLabels, setSeriesLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChartData = useCallback(
    async (
      campaignCode: string,
      dataSource: ChartDataSource = "cumulative_opens_by_level",
      timeBucket: ChartTimeBucket = "week",
    ) => {
      if (!campaignCode.trim()) {
        setData([]);
        setSeriesKeys([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Official-start override
        const { data: campaignRow } = await supabase
          .from("campaigns")
          .select("official_start_at")
          .eq("code", campaignCode)
          .maybeSingle();
        const officialStart = (campaignRow as any)?.official_start_at as
          | string
          | null
          | undefined;

        // All tokens for this campaign
        const { data: tokens, error: tokensError } = await supabase
          .from("tokens")
          .select("token, level, minted_at, parent_token")
          .eq("utm_campaign", campaignCode)
          .is("deleted_at", null);

        if (tokensError) throw tokensError;
        if (!tokens || tokens.length === 0) {
          setData([]);
          setSeriesKeys([]);
          return;
        }

        const tokenLevelMap = new Map<string, number>();
        const tokenParentMap = new Map<string, string | null>();
        tokens.forEach((t) => {
          tokenLevelMap.set(t.token, t.level);
          tokenParentMap.set(t.token, t.parent_token);
        });

        // ---- NEW L00 SEEDS PER PERIOD: pure token-based, no events needed ----
        if (dataSource === "new_l00_seeds_per_period") {
          const seeds = tokens.filter((t) => t.level === 0);
          if (seeds.length === 0) {
            setData([]);
            setSeriesKeys([]);
            return;
          }
          const filtered = officialStart
            ? seeds.filter((t) => t.minted_at >= officialStart)
            : seeds;
          if (filtered.length === 0) {
            setData([]);
            setSeriesKeys([]);
            return;
          }
          const sorted = [...filtered].sort((a, b) =>
            a.minted_at.localeCompare(b.minted_at),
          );
          const startDate = parseISO(sorted[0].minted_at);
          const endDate = parseISO(sorted[sorted.length - 1].minted_at);
          const buckets = buildEmptyBuckets(startDate, endDate, timeBucket);
          const counts = new Map<string, number>();
          buckets.forEach((b) => counts.set(b.label, 0));
          sorted.forEach((t) => {
            const lbl = bucketLabel(
              bucketStart(parseISO(t.minted_at), timeBucket),
              timeBucket,
            );
            if (counts.has(lbl)) counts.set(lbl, (counts.get(lbl) || 0) + 1);
          });
          const points: ChartPoint[] = buckets.map((b) => ({
            bucket: b.label,
            bucketStart: b.start,
            seeds: counts.get(b.label) || 0,
          }));
          setData(points);
          setSeriesKeys(["seeds"]);
          setSeriesLabels({ seeds: SERIES_LABELS.seeds });
          return;
        }

        // ---- SHARES PER PERIOD: bucket mints (excluding L00 seeds) by parent level ----
        if (dataSource === "shares_per_period") {
          // A "share" = non-L0 token mint, grouped by parent's level (so L00->L01 mint shows under "L00")
          const shares = tokens.filter(
            (t) => t.level > 0 && t.parent_token,
          );
          const filtered = officialStart
            ? shares.filter((t) => t.minted_at >= officialStart)
            : shares;
          if (filtered.length === 0) {
            setData([]);
            setSeriesKeys([]);
            return;
          }
          const sorted = [...filtered].sort((a, b) =>
            a.minted_at.localeCompare(b.minted_at),
          );
          const startDate = parseISO(sorted[0].minted_at);
          const endDate = parseISO(sorted[sorted.length - 1].minted_at);
          const buckets = buildEmptyBuckets(startDate, endDate, timeBucket);
          // initialize per-bucket: { L00, L01, L02, L03 }
          const empty = () => ({ L00: 0, L01: 0, L02: 0, L03: 0 });
          const bucketMap = new Map<string, ReturnType<typeof empty>>();
          buckets.forEach((b) => bucketMap.set(b.label, empty()));
          sorted.forEach((t) => {
            const lbl = bucketLabel(
              bucketStart(parseISO(t.minted_at), timeBucket),
              timeBucket,
            );
            const parentLevel = tokenLevelMap.get(t.parent_token!) ?? 0;
            const key =
              `L0${Math.min(parentLevel, 3)}` as "L00" | "L01" | "L02" | "L03";
            const slot = bucketMap.get(lbl);
            if (slot) slot[key]++;
          });
          const points: ChartPoint[] = buckets.map((b) => ({
            bucket: b.label,
            bucketStart: b.start,
            ...bucketMap.get(b.label)!,
          }));
          const keys = ["L00", "L01", "L02", "L03"];
          setData(points);
          setSeriesKeys(keys);
          setSeriesLabels(
            Object.fromEntries(keys.map((k) => [k, SERIES_LABELS[k] || k])),
          );
          return;
        }

        // ---- Remaining sources all need view events ----
        const tokenStrings = tokens.map((t) => t.token);
        let eventsQuery = supabase
          .from("url_events")
          .select("token, occurred_at")
          .in("token", tokenStrings)
          .eq("event_type", "view")
          .is("deleted_at", null)
          .order("occurred_at", { ascending: true });
        if (officialStart) eventsQuery = eventsQuery.gte("occurred_at", officialStart);
        const { data: events, error: eventsError } = await eventsQuery;
        if (eventsError) throw eventsError;
        if (!events || events.length === 0) {
          setData([]);
          setSeriesKeys([]);
          return;
        }

        const startDate = parseISO(events[0].occurred_at);
        const endDate = parseISO(events[events.length - 1].occurred_at);
        const buckets = buildEmptyBuckets(startDate, endDate, timeBucket);

        // For cumulative_opens_by_level (and opens_per_period): split L00 into seeds/spawns
        const tokensWithViews = new Set(events.map((e) => e.token));
        const l00WithSpawns = new Set<string>();
        tokens.forEach((t) => {
          if (t.level >= 1 && t.parent_token && tokensWithViews.has(t.token)) {
            const parent = tokens.find((p) => p.token === t.parent_token);
            if (parent && parent.level === 0) l00WithSpawns.add(parent.token);
          }
        });

        const empty = () => ({
          L00_seeds: 0,
          L00_spawns: 0,
          L01: 0,
          L02: 0,
          L03: 0,
        });
        const bucketMap = new Map<string, ReturnType<typeof empty>>();
        buckets.forEach((b) => bucketMap.set(b.label, empty()));

        // For unique_viewers_per_period: track which tokens already counted in each bucket
        const seenPerBucket = new Map<string, Set<string>>();
        buckets.forEach((b) => seenPerBucket.set(b.label, new Set()));

        events.forEach((ev) => {
          const lbl = bucketLabel(
            bucketStart(parseISO(ev.occurred_at), timeBucket),
            timeBucket,
          );
          const slot = bucketMap.get(lbl);
          if (!slot) return;
          const level = tokenLevelMap.get(ev.token) ?? 0;

          if (dataSource === "unique_viewers_per_period") {
            const seen = seenPerBucket.get(lbl)!;
            if (seen.has(ev.token)) return;
            seen.add(ev.token);
          }

          if (level === 0) {
            if (l00WithSpawns.has(ev.token)) slot.L00_spawns++;
            else slot.L00_seeds++;
          } else {
            const k = `L0${Math.min(level, 3)}` as "L01" | "L02" | "L03";
            slot[k]++;
          }
        });

        const cumulative = dataSource === "cumulative_opens_by_level";
        let cs = 0, cp = 0, c1 = 0, c2 = 0, c3 = 0;
        const points: ChartPoint[] = buckets.map((b) => {
          const v = bucketMap.get(b.label)!;
          if (cumulative) {
            cs += v.L00_seeds;
            cp += v.L00_spawns;
            c1 += v.L01;
            c2 += v.L02;
            c3 += v.L03;
            return {
              bucket: b.label,
              bucketStart: b.start,
              L00_seeds: cs,
              L00_spawns: cp,
              L01: c1,
              L02: c2,
              L03: c3,
            };
          }
          return {
            bucket: b.label,
            bucketStart: b.start,
            L00_seeds: v.L00_seeds,
            L00_spawns: v.L00_spawns,
            L01: v.L01,
            L02: v.L02,
            L03: v.L03,
          };
        });

        const keys = ["L00_seeds", "L00_spawns", "L01", "L02", "L03"];
        setData(points);
        setSeriesKeys(keys);
        setSeriesLabels(
          Object.fromEntries(keys.map((k) => [k, SERIES_LABELS[k] || k])),
        );
      } catch (err) {
        console.error("useChartData error:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    data,
    seriesKeys,
    seriesLabels,
    loading,
    error,
    fetchChartData,
  };
}

// Back-compat type alias for any old import
export type WeeklyLevelData = ChartPoint;
