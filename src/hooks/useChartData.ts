import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, format, parseISO, differenceInWeeks } from "date-fns";

export interface WeeklyLevelData {
  week: string;        // ISO week label e.g. "W04"
  weekStart: Date;
  L00_seeds: number;   // L00 tokens without engaged spawns
  L00_spawns: number;  // L00 tokens with at least one viewed child
  L01: number;
  L02: number;
  L03: number;
}

interface UseChartDataResult {
  data: WeeklyLevelData[];
  loading: boolean;
  error: string | null;
  fetchChartData: (campaignCode: string) => Promise<void>;
}

// Fixed level color palette (HSL values for chart colors)
export const LEVEL_COLORS = {
  L00_seeds: "hsl(221, 83%, 35%)",   // Darker blue – seeds without spawns
  L00_spawns: "hsl(221, 83%, 65%)",  // Lighter blue – seeds with spawns
  L01: "hsl(142, 71%, 45%)",         // Green
  L02: "hsl(32, 95%, 44%)",          // Orange
  L03: "hsl(0, 72%, 51%)",           // Red
};

export function useChartData(): UseChartDataResult {
  const [data, setData] = useState<WeeklyLevelData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChartData = useCallback(async (campaignCode: string) => {
    if (!campaignCode.trim()) {
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch campaign for official_start_at override
      const { data: campaignRow } = await supabase
        .from("campaigns")
        .select("official_start_at")
        .eq("code", campaignCode)
        .maybeSingle();
      const officialStart = (campaignRow as any)?.official_start_at as string | null | undefined;

      // Get tokens for this campaign
      const { data: tokens, error: tokensError } = await supabase
        .from("tokens")
        .select("token, level, minted_at, parent_token")
        .eq("utm_campaign", campaignCode)
        .is("deleted_at", null);

      if (tokensError) throw tokensError;

      if (!tokens || tokens.length === 0) {
        setData([]);
        return;
      }

      const tokenStrings = tokens.map((t) => t.token);

      // Get view events for these tokens (respect official_start_at)
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
        return;
      }

      // Create token -> level lookup
      const tokenLevelMap = new Map<string, number>();
      tokens.forEach((t) => tokenLevelMap.set(t.token, t.level));

      // Determine which L00 tokens have spawns (L01 children with views)
      const tokensWithViews = new Set(events.map((e) => e.token));
      const l00WithSpawns = new Set<string>();
      tokens.forEach((t) => {
        if (t.level >= 1 && t.parent_token && tokensWithViews.has(t.token)) {
          // This child has been viewed — mark its parent as a spawn-bearing seed
          const parent = tokens.find((p) => p.token === t.parent_token);
          if (parent && parent.level === 0) {
            l00WithSpawns.add(parent.token);
          }
        }
      });

      // Find the campaign start (earliest event)
      const startDate = parseISO(events[0].occurred_at);
      const startWeek = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday

      // Find latest event
      const endDate = parseISO(events[events.length - 1].occurred_at);
      const totalWeeks = Math.max(1, differenceInWeeks(endDate, startWeek) + 1);

      // Initialize weekly buckets
      const weeklyData: Map<string, { weekStart: Date; L00_seeds: number; L00_spawns: number; L01: number; L02: number; L03: number }> = new Map();
      
      for (let i = 0; i < totalWeeks; i++) {
        const weekStart = new Date(startWeek);
        weekStart.setDate(weekStart.getDate() + i * 7);
        const weekLabel = `W${format(weekStart, "ww")}`;
        weeklyData.set(weekLabel, { weekStart, L00_seeds: 0, L00_spawns: 0, L01: 0, L02: 0, L03: 0 });
      }

      // Count events per week per level
      events.forEach((event) => {
        const eventDate = parseISO(event.occurred_at);
        const eventWeek = startOfWeek(eventDate, { weekStartsOn: 1 });
        const weekLabel = `W${format(eventWeek, "ww")}`;
        
        const level = tokenLevelMap.get(event.token) ?? 0;
        const weekData = weeklyData.get(weekLabel);
        if (!weekData) return;

        if (level === 0) {
          if (l00WithSpawns.has(event.token)) {
            weekData.L00_spawns++;
          } else {
            weekData.L00_seeds++;
          }
        } else {
          const levelKey = `L0${Math.min(level, 3)}` as "L01" | "L02" | "L03";
          weekData[levelKey]++;
        }
      });

      // Convert to cumulative data
      const sortedWeeks = Array.from(weeklyData.entries())
        .sort((a, b) => a[1].weekStart.getTime() - b[1].weekStart.getTime());

      let cumSeeds = 0, cumSpawns = 0, cumL01 = 0, cumL02 = 0, cumL03 = 0;
      const cumulativeData: WeeklyLevelData[] = sortedWeeks.map(([week, counts]) => {
        cumSeeds += counts.L00_seeds;
        cumSpawns += counts.L00_spawns;
        cumL01 += counts.L01;
        cumL02 += counts.L02;
        cumL03 += counts.L03;
        return {
          week,
          weekStart: counts.weekStart,
          L00_seeds: cumSeeds,
          L00_spawns: cumSpawns,
          L01: cumL01,
          L02: cumL02,
          L03: cumL03,
        };
      });

      setData(cumulativeData);
    } catch (err) {
      console.error("useChartData error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchChartData };
}
