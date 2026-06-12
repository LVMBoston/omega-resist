import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Hotspot, ChartConfig } from "@/types/viralTemplates";
import { LEVEL_COLORS } from "@/hooks/useChartData";
import { SliderWithButtons } from "@/components/ui/slider-with-buttons";

interface ChartCalibrationControlsProps {
  hotspot: Hotspot;
  onUpdate: (updates: Partial<Hotspot>) => void;
}

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

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-8 gap-4">
      {/* Chart Type (readonly for now) */}
      <div className="space-y-2">
        <Label className="text-xs">Chart Type</Label>
        <div className="h-8 px-2 flex items-center bg-muted rounded text-xs">
          Stacked Bar
        </div>
      </div>

      {/* Data Source (readonly for now) */}
      <div className="space-y-2">
        <Label className="text-xs">Data</Label>
        <div className="h-8 px-2 flex items-center bg-muted rounded text-xs">
          Opens by Level
        </div>
      </div>

      {/* X Position */}
      <SliderWithButtons
        label="X"
        value={hotspot.x}
        onChange={(val) => onUpdate({ x: val })}
        min={0}
        max={100}
        step={0.5}
        fineStep={0.1}
      />

      {/* Y Position */}
      <SliderWithButtons
        label="Y"
        value={hotspot.y}
        onChange={(val) => onUpdate({ y: val })}
        min={0}
        max={100}
        step={0.5}
        fineStep={0.1}
      />

      {/* Width */}
      <SliderWithButtons
        label="W"
        value={hotspot.width}
        onChange={(val) => onUpdate({ width: val })}
        min={5}
        max={100}
        step={0.5}
        fineStep={0.1}
      />

      {/* Height */}
      <SliderWithButtons
        label="H"
        value={hotspot.height}
        onChange={(val) => onUpdate({ height: val })}
        min={5}
        max={60}
        step={0.5}
        fineStep={0.1}
      />

      {/* Z (stacking order) */}
      <SliderWithButtons
        label="Z"
        value={hotspot.zIndex ?? 1}
        onChange={(val) => onUpdate({ zIndex: val })}
        min={0}
        max={99}
        step={1}
        fineStep={1}
      />

      {/* Show X Axis */}
      <div className="space-y-2">
        <Label className="text-xs">X Axis</Label>
        <div className="h-8 flex items-center">
          <Switch
            checked={config.showXAxis !== false}
            onCheckedChange={(checked) => updateConfig({ showXAxis: checked })}
          />
        </div>
      </div>

      {/* Show Y Axis */}
      <div className="space-y-2">
        <Label className="text-xs">Y Axis</Label>
        <div className="h-8 flex items-center">
          <Switch
            checked={config.showYAxis === true}
            onCheckedChange={(checked) => updateConfig({ showYAxis: checked })}
          />
        </div>
      </div>

      {/* Color Legend */}
      <div className="col-span-full flex items-center gap-4 text-xs pt-2 border-t border-border">
        <span className="text-muted-foreground">Levels:</span>
        {Object.entries(LEVEL_COLORS).map(([level, color]) => (
          <span key={level} className="flex items-center gap-1">
            <span 
              className="w-3 h-3 rounded-sm" 
              style={{ backgroundColor: color }}
            />
            {level}
          </span>
        ))}
      </div>
    </div>
  );
}
