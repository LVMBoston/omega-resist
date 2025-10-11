import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { EngagementByLevel } from "@/lib/virality/analytics";

interface EngagementByLevelChartProps {
  data: EngagementByLevel[];
}

export function EngagementByLevelChart({ data }: EngagementByLevelChartProps) {
  const chartData = data.map((d) => ({
    level: `L${d.level.toString().padStart(2, "0")}`,
    scans: d.scans,
    views: d.views,
    shares: d.shares,
  }));

  const chartConfig = {
    scans: {
      label: "Scans",
      color: "hsl(var(--chart-1))",
    },
    views: {
      label: "Views",
      color: "hsl(var(--chart-2))",
    },
    shares: {
      label: "Shares",
      color: "hsl(var(--chart-3))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagement by Level</CardTitle>
        <CardDescription>Activity breakdown across token levels</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="level" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Bar dataKey="scans" fill="var(--color-scans)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="views" fill="var(--color-views)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="shares" fill="var(--color-shares)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
