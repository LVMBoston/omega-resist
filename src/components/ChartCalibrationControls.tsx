import { ChevronUp, ChevronDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Hotspot, ChartConfig } from "@/types/viralTemplates";
import { LEVEL_COLORS } from "@/hooks/useChartData";

interface ChartCalibrationControlsProps {
  hotspot: Hotspot;
  onUpdate: (updates: Partial<Hotspot>) => void;
}

// Reusable slider with fine-tune buttons
interface SliderWithButtonsProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  step: number;
  fineStep?: number;
  unit?: string;
}

function SliderWithButtons({
  label,
  value,
  onChange,
  min,
  max,
  step,
  fineStep = 0.1,
  unit = "%",
}: SliderWithButtonsProps) {
  const increment = () => onChange(Math.min(max, value + fineStep));
  const decrement = () => onChange(Math.max(min, value - fineStep));

  return (
    <div className="space-y-2">
      <Label className="text-xs">
        {label}: {unit === "px" ? Math.round(value) : value.toFixed(1)}{unit}
      </Label>
      <div className="flex items-center gap-1">
        <Slider
          value={[value]}
          onValueChange={([val]) => onChange(val)}
          min={min}
          max={max}
          step={step}
          className="flex-1"
        />
        <div className="flex flex-col">
          <button
            type="button"
            className="h-4 w-6 p-0 flex items-center justify-center hover:bg-muted rounded"
            onClick={increment}
            tabIndex={-1}
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="h-4 w-6 p-0 flex items-center justify-center hover:bg-muted rounded"
            onClick={decrement}
            tabIndex={-1}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
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
        max={80}
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
