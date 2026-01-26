import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, format, parseISO, differenceInWeeks } from "date-fns";

export interface WeeklyLevelData {
  week: string;        // ISO week label e.g. "W04"
  weekStart: Date;
  L00: number;
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
  L00: "hsl(221, 83%, 53%)",  // Blue
  L01: "hsl(142, 71%, 45%)",  // Green
  L02: "hsl(32, 95%, 44%)",   // Orange
  L03: "hsl(0, 72%, 51%)",    // Red
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
      // Get tokens for this campaign
      const { data: tokens, error: tokensError } = await supabase
        .from("tokens")
        .select("token, level, minted_at")
        .eq("utm_campaign", campaignCode)
        .is("deleted_at", null);

      if (tokensError) throw tokensError;

      if (!tokens || tokens.length === 0) {
        setData([]);
        return;
      }

      const tokenStrings = tokens.map((t) => t.token);

      // Get view events for these tokens
      const { data: events, error: eventsError } = await supabase
        .from("url_events")
        .select("token, occurred_at")
        .in("token", tokenStrings)
        .eq("event_type", "view")
        .is("deleted_at", null)
        .order("occurred_at", { ascending: true });

      if (eventsError) throw eventsError;

      if (!events || events.length === 0) {
        setData([]);
        return;
      }

      // Create token -> level lookup
      const tokenLevelMap = new Map<string, number>();
      tokens.forEach((t) => tokenLevelMap.set(t.token, t.level));

      // Find the campaign start (earliest event)
      const startDate = parseISO(events[0].occurred_at);
      const startWeek = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday

      // Find latest event
      const endDate = parseISO(events[events.length - 1].occurred_at);
      const totalWeeks = Math.max(1, differenceInWeeks(endDate, startWeek) + 1);

      // Initialize weekly buckets
      const weeklyData: Map<string, { weekStart: Date; L00: number; L01: number; L02: number; L03: number }> = new Map();
      
      for (let i = 0; i < totalWeeks; i++) {
        const weekStart = new Date(startWeek);
        weekStart.setDate(weekStart.getDate() + i * 7);
        const weekLabel = `W${format(weekStart, "ww")}`;
        weeklyData.set(weekLabel, { weekStart, L00: 0, L01: 0, L02: 0, L03: 0 });
      }

      // Count events per week per level
      events.forEach((event) => {
        const eventDate = parseISO(event.occurred_at);
        const eventWeek = startOfWeek(eventDate, { weekStartsOn: 1 });
        const weekLabel = `W${format(eventWeek, "ww")}`;
        
        const level = tokenLevelMap.get(event.token) ?? 0;
        const levelKey = `L0${Math.min(level, 3)}` as "L00" | "L01" | "L02" | "L03";

        const weekData = weeklyData.get(weekLabel);
        if (weekData) {
          weekData[levelKey]++;
        }
      });

      // Convert to cumulative data
      const sortedWeeks = Array.from(weeklyData.entries())
        .sort((a, b) => a[1].weekStart.getTime() - b[1].weekStart.getTime());

      let cumL00 = 0, cumL01 = 0, cumL02 = 0, cumL03 = 0;
      const cumulativeData: WeeklyLevelData[] = sortedWeeks.map(([week, counts]) => {
        cumL00 += counts.L00;
        cumL01 += counts.L01;
        cumL02 += counts.L02;
        cumL03 += counts.L03;
        return {
          week,
          weekStart: counts.weekStart,
          L00: cumL00,
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
