import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";

interface ViralCoefficientChartProps {
  kFactor: number;
}

export function ViralCoefficientChart({ kFactor }: ViralCoefficientChartProps) {
  // Create a simple visualization showing current K-factor
  const data = [
    { position: 0, value: 0 },
    { position: 1, value: kFactor },
  ];

  const chartConfig = {
    value: {
      label: "K-Factor",
      color: kFactor >= 1 ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Viral Coefficient (K-Factor)</CardTitle>
        <CardDescription>
          K &gt; 1 indicates viral growth | K &lt; 1 indicates decay
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="position" hide />
              <YAxis domain={[0, Math.max(2, kFactor + 0.5)]} />
              <ReferenceLine
                y={1}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                label={{ value: "K=1 (Breakeven)", position: "right" }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartConfig.value.color}
                fill={chartConfig.value.color}
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
        <div className="mt-4 text-center">
          <div className="text-3xl font-bold">K = {kFactor.toFixed(3)}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {kFactor >= 1 ? (
              <span className="text-green-600 dark:text-green-400">✓ Viral Growth</span>
            ) : (
              <span className="text-yellow-600 dark:text-yellow-400">⚠ Sub-viral</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
