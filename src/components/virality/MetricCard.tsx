import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: number;
  status?: "good" | "warning" | "bad" | "neutral";
  format?: "number" | "percentage" | "time";
}

export function MetricCard({
  title,
  value,
  description,
  trend,
  status = "neutral",
  format = "number",
}: MetricCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === "string") return val;
    
    if (format === "percentage") {
      return `${val.toFixed(1)}%`;
    } else if (format === "time") {
      if (val < 1) return `${(val * 60).toFixed(0)}m`;
      return `${val.toFixed(1)}h`;
    }
    return val.toLocaleString();
  };

  const getTrendIcon = () => {
    if (trend === undefined) return null;
    if (trend > 0) return <TrendingUp className="h-4 w-4" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getTrendColor = () => {
    if (trend === undefined) return "";
    if (trend > 0) return "text-green-600 dark:text-green-400";
    if (trend < 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  const getStatusColor = () => {
    switch (status) {
      case "good":
        return "border-blue-500/50 bg-blue-500/5";
      case "warning":
        return "border-purple-500/50 bg-purple-500/5";
      case "bad":
        return "border-red-500/50 bg-red-500/5";
      default:
        return "border-green-500/50 bg-green-500/5";
    }
  };

  return (
    <Card className={getStatusColor()}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div className="text-3xl font-bold">{formatValue(value)}</div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-sm ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{Math.abs(trend).toFixed(1)}%</span>
            </div>
          )}
        </div>
        {description && (
          <p className="mt-2 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
