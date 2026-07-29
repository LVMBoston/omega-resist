import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useChartData, LEVEL_COLORS } from "@/hooks/useChartData";
import { ChartConfig } from "@/types/viralTemplates";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { chartSeriesTitle } from "@/lib/chartTitles";

interface ChartHotspotRendererProps {
  campaignCode: string;
  config: ChartConfig;
  width: number;
  height: number;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function ChartHotspotRenderer({
  campaignCode,
  config,
  width,
  height,
}: ChartHotspotRendererProps) {
  const { data, seriesKeys, seriesLabels, loading, error, fetchChartData } = useChartData();
  const [campaignName, setCampaignName] = useState<string>("");

  const showXAxis = config.showXAxis !== false;
  const showYAxis = config.showYAxis === true;
  const dataSource = config.dataSource || "cumulative_opens_by_level";
  const timeBucket = config.timeBucket || "week";
  const yScale = config.yScale || "linear";
  const yFormat = config.yFormat || "integer";
  const seriesTitle = chartSeriesTitle(dataSource, timeBucket);
  const backgroundColor = config.backgroundColor || "#ffffff";

  useEffect(() => {
    if (campaignCode) {
      fetchChartData(campaignCode, dataSource, timeBucket);
    }
  }, [campaignCode, dataSource, timeBucket, fetchChartData]);

  useEffect(() => {
    let cancelled = false;
    if (!campaignCode) {
      setCampaignName("");
      return;
    }
    supabase
      .from("campaigns")
      .select("title")
      .eq("code", campaignCode)
      .maybeSingle()
      .then(({ data: row }) => {
        if (!cancelled) setCampaignName(row?.title || campaignCode);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignCode]);

  const titleBlock = (
    <div className="w-full text-center leading-tight px-1">
      <div className="font-bold text-foreground truncate" style={{ fontSize: 30 }}>
        {campaignName || campaignCode}
      </div>
      <div className="text-muted-foreground truncate" style={{ fontSize: 25 }}>
        {seriesTitle}
      </div>
    </div>
  );


  if (loading) {
    return (
      <div className="flex flex-col w-full h-full" style={{ backgroundColor }}>
        {titleBlock}
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="flex flex-col w-full h-full" style={{ backgroundColor }}>
        {titleBlock}
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
          {error || "No data"}
        </div>
      </div>
    );
  }

  // Log scale + zeros breaks Recharts — fall back to linear automatically
  const hasZero = data.some((d) =>
    seriesKeys.some((k) => (d as any)[k] === 0),
  );
  const effectiveScale = yScale === "log" && hasZero ? "linear" : yScale;

  const tickFormatter = (v: number) =>
    yFormat === "compact" ? formatCompact(v) : String(v);

  return (
    <div className="flex flex-col w-full h-full" style={{ backgroundColor }}>
      {titleBlock}
      <div className="flex-1 min-h-0">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: showXAxis ? 20 : 4 }}>

        {showXAxis && (
          <XAxis
            dataKey="bucket"
            tick={{ fill: "#666", fontSize: 10 }}
            axisLine={{ stroke: "#ccc" }}
            tickLine={{ stroke: "#ccc" }}
          />
        )}
        {showYAxis && (
          <YAxis
            scale={effectiveScale}
            domain={effectiveScale === "log" ? [1, "auto"] : [0, "auto"]}
            allowDataOverflow={false}
            tick={{ fill: "#666", fontSize: 10 }}
            axisLine={{ stroke: "#ccc" }}
            tickLine={{ stroke: "#ccc" }}
            tickFormatter={tickFormatter}
            width={36}
          />
        )}
        <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "2px" }} iconSize={8} />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(255,255,255,0.95)",
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontSize: "12px",
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          formatter={(value: number, name: string) => [
            yFormat === "compact" ? formatCompact(value) : value,
            name,
          ]}
        />
        {seriesKeys.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="levels"
            fill={LEVEL_COLORS[key] || "hsl(221, 83%, 50%)"}
            name={seriesLabels[key] || key}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
      </div>
    </div>
  );
}

