import { Pipette } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  { value: "neighborhoods", label: "Neighborhoods (zip codes)" },
  { value: "depth", label: "Max Depth" },
  { value: "l01_count", label: "L01 Count" },
  { value: "l02_count", label: "L02 Count" },
  { value: "l03_count", label: "L03 Count" },
  { value: "viral_coefficient", label: "Viral Coefficient" },
];

interface HotspotCalibrationControlsProps {
  hotspot: Hotspot;
  displayValue: string;
  onUpdate: (updates: Partial<Hotspot>) => void;
  onDisplayValueChange: (value: string) => void;
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
    <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-11 gap-4">
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

      {/* X Position */}
      <div className="space-y-2">
        <Label className="text-xs">X: {hotspot.x.toFixed(1)}%</Label>
        <Slider
          value={[hotspot.x]}
          onValueChange={([val]) => onUpdate({ x: val })}
          min={0}
          max={100}
          step={0.5}
        />
      </div>

      {/* Y Position */}
      <div className="space-y-2">
        <Label className="text-xs">Y: {hotspot.y.toFixed(1)}%</Label>
        <Slider
          value={[hotspot.y]}
          onValueChange={([val]) => onUpdate({ y: val })}
          min={0}
          max={100}
          step={0.5}
        />
      </div>

      {/* Width */}
      <div className="space-y-2">
        <Label className="text-xs">W: {hotspot.width.toFixed(1)}%</Label>
        <Slider
          value={[hotspot.width]}
          onValueChange={([val]) => onUpdate({ width: val })}
          min={1}
          max={50}
          step={0.5}
        />
      </div>

      {/* Height */}
      <div className="space-y-2">
        <Label className="text-xs">H: {hotspot.height.toFixed(1)}%</Label>
        <Slider
          value={[hotspot.height]}
          onValueChange={([val]) => onUpdate({ height: val })}
          min={1}
          max={50}
          step={0.5}
        />
      </div>

      {/* Font Size */}
      <div className="space-y-2">
        <Label className="text-xs">Size: {fontSize}px</Label>
        <Slider
          value={[fontSize]}
          onValueChange={([val]) => updateStyle({ fontSize: `${val}px` })}
          min={12}
          max={120}
          step={1}
        />
      </div>

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
