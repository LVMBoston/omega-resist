import { useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useChartData, LEVEL_COLORS, WeeklyLevelData } from "@/hooks/useChartData";
import { ChartConfig } from "@/types/viralTemplates";
import { Loader2 } from "lucide-react";

interface ChartHotspotRendererProps {
  campaignCode: string;
  config: ChartConfig;
  width: number;
  height: number;
}

export function ChartHotspotRenderer({ 
  campaignCode, 
  config, 
  width, 
  height 
}: ChartHotspotRendererProps) {
  const { data, loading, error, fetchChartData } = useChartData();
  
  const showXAxis = config.showXAxis !== false;
  const showYAxis = config.showYAxis === true;

  useEffect(() => {
    if (campaignCode) {
      fetchChartData(campaignCode);
    }
  }, [campaignCode, fetchChartData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full text-muted-foreground text-xs">
        {error || "No data"}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: showXAxis ? 20 : 4 }}>
        {showXAxis && (
          <XAxis 
            dataKey="week" 
            tick={{ fill: "#666", fontSize: 10 }}
            axisLine={{ stroke: "#ccc" }}
            tickLine={{ stroke: "#ccc" }}
          />
        )}
        {showYAxis && (
          <YAxis 
            tick={{ fill: "#666", fontSize: 10 }}
            axisLine={{ stroke: "#ccc" }}
            tickLine={{ stroke: "#ccc" }}
            width={30}
          />
        )}
        <Legend 
          wrapperStyle={{ fontSize: "10px", paddingTop: "2px" }}
          iconSize={8}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "rgba(255,255,255,0.95)", 
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontSize: "12px"
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          formatter={(value: number, name: string) => [value, name]}
        />
        <Bar dataKey="L00_seeds" stackId="levels" fill={LEVEL_COLORS.L00_seeds} name="Seeds" />
        <Bar dataKey="L00_spawns" stackId="levels" fill="hsl(142, 71%, 45%)" name="Seeds w/ Spawns" />
        <Bar dataKey="L01" stackId="levels" fill={LEVEL_COLORS.L01} name="L01" />
        <Bar dataKey="L02" stackId="levels" fill={LEVEL_COLORS.L02} name="L02" />
        <Bar dataKey="L03" stackId="levels" fill={LEVEL_COLORS.L03} name="L03+" />
    </ResponsiveContainer>
  );
}
