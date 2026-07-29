import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Hotspot, ChartConfig } from "@/types/viralTemplates";
import { LEVEL_COLORS } from "@/hooks/useChartData";
import { SliderWithButtons } from "@/components/ui/slider-with-buttons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChartCalibrationControlsProps {
  hotspot: Hotspot;
  onUpdate: (updates: Partial<Hotspot>) => void;
}

const DATA_SOURCE_OPTIONS: { value: NonNullable<ChartConfig["dataSource"]>; label: string }[] = [
  { value: "cumulative_opens_by_level", label: "Cumulative opens by level" },
  { value: "opens_per_period", label: "Opens per period" },
  { value: "shares_per_period", label: "Shares per period" },
  { value: "unique_viewers_per_period", label: "Unique viewers per period" },
  { value: "new_l00_seeds_per_period", label: "New L00 seeds per period" },
];

export function ChartCalibrationControls({
  hotspot,
  onUpdate,
}: ChartCalibrationControlsProps) {
  const config: ChartConfig = hotspot.chartConfig || {
    chartType: "stacked_bar",
    dataSource: "cumulative_opens_by_level",
    showXAxis: true,
    showYAxis: false,
  };

  const updateConfig = (configUpdates: Partial<ChartConfig>) => {
    onUpdate({
      chartConfig: { ...config, ...configUpdates },
    });
  };

  const dataSource = config.dataSource || "cumulative_opens_by_level";
  const timeBucket = config.timeBucket || "week";
  const yScale = config.yScale || "linear";
  const yFormat = config.yFormat || "integer";
  const backgroundColor = config.backgroundColor || "#ffffff";

  return (
    <div className="space-y-3">
      {/* Row 1: Data series & axis format controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2 col-span-2">
          <Label className="text-xs">Data series</Label>
          <Select
            value={dataSource}
            onValueChange={(v) =>
              updateConfig({ dataSource: v as ChartConfig["dataSource"] })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATA_SOURCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Time bucket</Label>
          <Select
            value={timeBucket}
            onValueChange={(v) =>
              updateConfig({ timeBucket: v as ChartConfig["timeBucket"] })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day" className="text-xs">Day</SelectItem>
              <SelectItem value="week" className="text-xs">Week</SelectItem>
              <SelectItem value="month" className="text-xs">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label className="text-xs">Y scale</Label>
            <Select
              value={yScale}
              onValueChange={(v) =>
                updateConfig({ yScale: v as ChartConfig["yScale"] })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear" className="text-xs">Linear</SelectItem>
                <SelectItem value="log" className="text-xs">Log</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Y format</Label>
            <Select
              value={yFormat}
              onValueChange={(v) =>
                updateConfig({ yFormat: v as ChartConfig["yFormat"] })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="integer" className="text-xs">Integer</SelectItem>
                <SelectItem value="compact" className="text-xs">Compact (1.2k)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Row 2: X | Y */}
      <div className="grid grid-cols-2 gap-3">
        <SliderWithButtons label="X" value={hotspot.x} onChange={(v) => onUpdate({ x: v })} min={0} max={100} step={0.5} fineStep={0.1} />
        <SliderWithButtons label="Y" value={hotspot.y} onChange={(v) => onUpdate({ y: v })} min={0} max={100} step={0.5} fineStep={0.1} />
      </div>

      {/* Row 3: W | H | Z */}
      <div className="grid grid-cols-3 gap-3">
        <SliderWithButtons label="W" value={hotspot.width} onChange={(v) => onUpdate({ width: v })} min={5} max={100} step={0.5} fineStep={0.1} />
        <SliderWithButtons label="H" value={hotspot.height} onChange={(v) => onUpdate({ height: v })} min={5} max={100} step={0.5} fineStep={0.1} />
        <SliderWithButtons label="Z" value={hotspot.zIndex ?? 1} onChange={(v) => onUpdate({ zIndex: v })} min={0} max={9} step={1} fineStep={1} />
      </div>

      {/* Row 4: Axis toggles */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2">
          <Label className="text-xs cursor-pointer">Show X Axis</Label>
          <Switch
            checked={config.showXAxis !== false}
            onCheckedChange={(checked) => updateConfig({ showXAxis: checked })}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2">
          <Label className="text-xs cursor-pointer">Show Y Axis</Label>
          <Switch
            checked={config.showYAxis === true}
            onCheckedChange={(checked) => updateConfig({ showYAxis: checked })}
          />
        </div>
      </div>

      {/* Row 5: Background color */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2">
          <Label className="text-xs">Background</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-6 w-8 cursor-pointer rounded border border-input bg-background p-0"
              value={backgroundColor}
              onChange={(e) => updateConfig({ backgroundColor: e.target.value })}
            />
            <input
              type="text"
              className="h-6 w-20 rounded border border-input bg-background px-1 text-xs"
              value={backgroundColor}
              onChange={(e) => updateConfig({ backgroundColor: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Color legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs pt-2 border-t border-border">
        <span className="text-muted-foreground">Colors:</span>
        {Object.entries(LEVEL_COLORS).map(([level, color]) => (
          <span key={level} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            {level}
          </span>
        ))}
      </div>
    </div>
  );
}
