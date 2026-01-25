import { Pipette, ChevronUp, ChevronDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hotspot, LiveMetricKey } from "@/types/viralTemplates";

// Common fonts available on most systems
const FONT_OPTIONS = [
  { value: "Calibri, sans-serif", label: "Calibri (Body)" },
  { value: "'Arial', sans-serif", label: "Arial" },
  { value: "'Helvetica Neue', Helvetica, sans-serif", label: "Helvetica" },
  { value: "'Georgia', serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Verdana', sans-serif", label: "Verdana" },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet MS" },
  { value: "system-ui, -apple-system, sans-serif", label: "System UI" },
];

// All available metric keys for the dropdown
const METRIC_OPTIONS: { value: LiveMetricKey; label: string }[] = [
  { value: "seeds", label: "Seeds (L00 count)" },
  { value: "shares", label: "Shares (L01+ count)" },
  { value: "opens", label: "Opens (total views)" },
  { value: "opens_us", label: "Opens US" },
  { value: "opens_intl", label: "Opens Intl" },
  { value: "opens_qr", label: "Opens QR" },
  { value: "opens_text", label: "Opens Text" },
  { value: "opens_mail", label: "Opens Mail" },
  { value: "neighborhoods", label: "Neighborhoods (zip codes)" },
  { value: "depth", label: "Max Depth" },
  { value: "l01_count", label: "L01 Count" },
  { value: "l02_count", label: "L02 Count" },
  { value: "l03_count", label: "L03 Count" },
  { value: "viral_coefficient", label: "Viral Coefficient" },
  { value: "campaign_name", label: "Campaign Name" },
  { value: "start_date", label: "Start Date" },
  { value: "current_date", label: "Current Date" },
  { value: "start_time", label: "Start Time" },
  { value: "current_time", label: "Current Time" },
];

interface HotspotCalibrationControlsProps {
  hotspot: Hotspot;
  displayValue: string;
  onUpdate: (updates: Partial<Hotspot>) => void;
  onDisplayValueChange: (value: string) => void;
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
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-6 p-0"
            onClick={increment}
            tabIndex={-1}
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-6 p-0"
            onClick={decrement}
            tabIndex={-1}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function HotspotCalibrationControls({
  hotspot,
  displayValue,
  onUpdate,
  onDisplayValueChange,
}: HotspotCalibrationControlsProps) {
  const style = hotspot.liveNumberStyle || {};

  const updateStyle = (styleUpdates: Partial<typeof style>) => {
    onUpdate({
      liveNumberStyle: { ...style, ...styleUpdates },
    });
  };

  // Parse numeric values from style strings
  const fontSize = parseInt(style.fontSize || "56") || 56;
  const fontWeight = style.fontWeight || "700";
  const fontFamily = style.fontFamily || "Calibri, sans-serif";
  const textColor = style.color || "#1a1a1a";
  const bgColor = style.backgroundColor || "#e8dcc8";

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-11 gap-4">
      {/* Metric Key */}
      <div className="space-y-2">
        <Label className="text-xs">Metric</Label>
        <Select 
          value={hotspot.metricKey || "seeds"} 
          onValueChange={(val) => onUpdate({ metricKey: val as LiveMetricKey })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METRIC_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Font Size - moved next to Metric */}
      <SliderWithButtons
        label="Size"
        value={fontSize}
        onChange={(val) => updateStyle({ fontSize: `${Math.round(val)}px` })}
        min={12}
        max={120}
        step={1}
        fineStep={1}
        unit="px"
      />

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
        min={1}
        max={50}
        step={0.5}
        fineStep={0.1}
      />

      {/* Height */}
      <SliderWithButtons
        label="H"
        value={hotspot.height}
        onChange={(val) => onUpdate({ height: val })}
        min={1}
        max={50}
        step={0.5}
        fineStep={0.1}
      />

      {/* Font Family */}
      <div className="space-y-2">
        <Label className="text-xs">Font</Label>
        <Select value={fontFamily} onValueChange={(val) => updateStyle({ fontFamily: val })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((font) => (
              <SelectItem key={font.value} value={font.value} className="text-xs">
                {font.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Font Weight */}
      <div className="space-y-2">
        <Label className="text-xs">Weight</Label>
        <Select value={fontWeight} onValueChange={(val) => updateStyle({ fontWeight: val })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="400" className="text-xs">Normal</SelectItem>
            <SelectItem value="500" className="text-xs">Medium</SelectItem>
            <SelectItem value="600" className="text-xs">Semibold</SelectItem>
            <SelectItem value="700" className="text-xs">Bold</SelectItem>
            <SelectItem value="800" className="text-xs">Extra Bold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Text Color */}
      <div className="space-y-2">
        <Label className="text-xs">Text Color</Label>
        <div className="flex gap-1">
          <Input
            value={textColor}
            onChange={(e) => updateStyle({ color: e.target.value })}
            placeholder="#1a1a1a"
            className="h-8 text-xs font-mono flex-1"
          />
          <div className="relative h-8 w-8">
            <input
              type="color"
              value={textColor}
              onChange={(e) => updateStyle({ color: e.target.value })}
              className="absolute inset-0 h-8 w-8 rounded border border-input cursor-pointer opacity-0"
            />
            <div
              className="h-8 w-8 rounded border border-input flex items-center justify-center pointer-events-none"
              style={{ backgroundColor: textColor }}
            >
              <Pipette className="w-4 h-4 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Background Color */}
      <div className="space-y-2">
        <Label className="text-xs">BG Color</Label>
        <div className="flex gap-1">
          <Input
            value={bgColor}
            onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
            placeholder="#e8dcc8"
            className="h-8 text-xs font-mono flex-1"
          />
          <div className="relative h-8 w-8">
            <input
              type="color"
              value={bgColor}
              onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
              className="absolute inset-0 h-8 w-8 rounded border border-input cursor-pointer opacity-0"
            />
            <div
              className="h-8 w-8 rounded border border-input flex items-center justify-center pointer-events-none"
              style={{ backgroundColor: bgColor }}
            >
              <Pipette className="w-4 h-4 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Display Value */}
      <div className="space-y-2">
        <Label className="text-xs">Preview</Label>
        <Input
          value={displayValue}
          onChange={(e) => onDisplayValueChange(e.target.value)}
          className="h-8"
          placeholder="142"
        />
      </div>
    </div>
  );
}
