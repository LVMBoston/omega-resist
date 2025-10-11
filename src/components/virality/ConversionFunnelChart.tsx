import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConversionFunnel } from "@/lib/virality/analytics";

interface ConversionFunnelChartProps {
  data: ConversionFunnel;
}

export function ConversionFunnelChart({ data }: ConversionFunnelChartProps) {
  const stages = [
    { name: "Scans", value: data.scans, percentage: 100 },
    { name: "Views", value: data.views, percentage: data.scan_to_view_rate },
    { name: "Shares", value: data.shares, percentage: data.view_to_share_rate },
  ];

  const maxValue = data.scans || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion Funnel</CardTitle>
        <CardDescription>User journey from scan to share</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const width = (stage.value / maxValue) * 100;
            const isLast = index === stages.length - 1;

            return (
              <div key={stage.name} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{stage.name}</span>
                  <span className="text-muted-foreground">
                    {stage.value.toLocaleString()}
                    {index > 0 && (
                      <span className="ml-2 text-xs">
                        ({stage.percentage.toFixed(1)}% conversion)
                      </span>
                    )}
                  </span>
                </div>
                <div className="relative h-12 bg-muted rounded overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                      isLast
                        ? "bg-gradient-to-r from-chart-2 to-chart-3"
                        : "bg-gradient-to-r from-chart-1 to-chart-2"
                    }`}
                    style={{ width: `${width}%` }}
                  >
                    <div className="flex items-center justify-center h-full text-sm font-semibold text-primary-foreground">
                      {width > 15 && `${width.toFixed(0)}%`}
                    </div>
                  </div>
                </div>
                {!isLast && (
                  <div className="flex justify-center">
                    <div className="text-xs text-muted-foreground">↓</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Conversion Rate</span>
            <span className="text-lg font-bold">
              {data.overall_conversion_rate.toFixed(2)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
