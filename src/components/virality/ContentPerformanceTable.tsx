import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ContentPerformance } from "@/lib/virality/analytics";

interface ContentPerformanceTableProps {
  data: ContentPerformance[];
}

export function ContentPerformanceTable({ data }: ContentPerformanceTableProps) {
  const getPerformanceColor = (value: number, max: number) => {
    const percentage = (value / max) * 100;
    if (percentage >= 75) return "text-green-600 dark:text-green-400 font-semibold";
    if (percentage >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-muted-foreground";
  };

  const maxScans = Math.max(...data.map((d) => d.scans), 1);
  const maxViews = Math.max(...data.map((d) => d.views), 1);
  const maxShares = Math.max(...data.map((d) => d.shares), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content Performance</CardTitle>
        <CardDescription>Metrics by utm_content parameter</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Content</TableHead>
              <TableHead className="text-right">Scans</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Shares</TableHead>
              <TableHead className="text-right">K-Factor</TableHead>
              <TableHead className="text-right">Share Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.utm_content}>
                <TableCell className="font-medium">{row.utm_content}</TableCell>
                <TableCell className={`text-right ${getPerformanceColor(row.scans, maxScans)}`}>
                  {row.scans.toLocaleString()}
                </TableCell>
                <TableCell className={`text-right ${getPerformanceColor(row.views, maxViews)}`}>
                  {row.views.toLocaleString()}
                </TableCell>
                <TableCell className={`text-right ${getPerformanceColor(row.shares, maxShares)}`}>
                  {row.shares.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {row.k_factor.toFixed(3)}
                </TableCell>
                <TableCell className="text-right">
                  {row.share_rate.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
