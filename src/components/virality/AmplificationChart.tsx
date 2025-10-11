import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { AmplificationData } from "@/lib/virality/analytics";

interface AmplificationChartProps {
  data: AmplificationData[];
}

export function AmplificationChart({ data }: AmplificationChartProps) {
  const chartData = data.map((d) => ({
    level: `L${d.level.toString().padStart(2, "0")}`,
    tokens: d.token_count,
    branching: d.branching_factor,
  }));

  const chartConfig = {
    tokens: {
      label: "Tokens",
      color: "hsl(var(--chart-1))",
    },
    branching: {
      label: "Branching Factor",
      color: "hsl(var(--chart-2))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Amplification by Level</CardTitle>
        <CardDescription>Token distribution and branching factor</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="level" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                yAxisId="left"
                dataKey="tokens"
                fill="var(--color-tokens)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          {data.map((d) => (
            <div key={d.level} className="flex justify-between p-2 rounded bg-muted">
              <span className="font-medium">L{d.level.toString().padStart(2, "0")}:</span>
              <span className="text-muted-foreground">
                {d.branching_factor.toFixed(2)}x branching
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
