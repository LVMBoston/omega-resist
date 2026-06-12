import { Pipette } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Hotspot, LiveMetricKey } from "@/types/viralTemplates";
import { SliderWithButtons } from "@/components/ui/slider-with-buttons";
import { ManualEntryEditor } from "@/components/ManualEntryEditor";
import { plainTextToManualHtml } from "@/lib/manualEntryHtml";

// Common fonts available on most systems
const FONT_OPTIONS = [
  { value: "Calibri, sans-serif", label: "Calibri" },
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
  { value: "manual_entry", label: "✏️ Manual Entry" },
  { value: "seeds", label: "Seeds (L00 count)" },
  { value: "seeds_with_spawns", label: "Seeds with Spawns" },
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
  { value: "current_date", label: "Current Date" },
  { value: "current_time", label: "Current Time" },
  { value: "earliest_active", label: "Earliest Active" },
  { value: "latest_active", label: "Latest Active" },
  { value: "last_updated", label: "🕐 Last Updated" },
  { value: "campaign_story", label: "📖 Campaign Story" },
  { value: "campaign_description", label: "📝 Campaign Description" },
  { value: "tz_offset_note", label: "🕐 TZ Offset Note" },
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

  const fontSize = parseInt(style.fontSize || "25") || 25;
  const fontWeight = style.fontWeight || "700";
  const fontFamily = style.fontFamily || "Calibri, sans-serif";
  const textColor = style.color || "#1a1a1a";
  const bgColor = style.backgroundColor || "#e8dcc8";
  const textAlign = style.textAlign || "center";
  const verticalAlign = style.verticalAlign || "center";

  const isManualEntry = hotspot.metricKey === "manual_entry";

  return (
    <div className="space-y-3">
      {/* Row 1: Metric | Label */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Metric</Label>
          <Select
            value={hotspot.metricKey || undefined}
            onValueChange={(val) => onUpdate({ metricKey: val as LiveMetricKey })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select Metric" />
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

        <div className={`space-y-2 ${!isManualEntry ? "opacity-40 pointer-events-none" : ""}`}>
          <Label className="text-xs">Label</Label>
          {isManualEntry ? (
            <ManualEntryEditor
              key={`manual-html-${hotspot.id}`}
              html={hotspot.manualHtml || plainTextToManualHtml(hotspot.manualLabel || "")}
              onChange={(html, plain) => onUpdate({ manualHtml: html, manualLabel: plain })}
            />
          ) : (
            <div className="h-16 rounded-md border border-input bg-background px-3 py-2 text-xs text-muted-foreground">
              Select Manual Entry to edit text
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Size | Weight | Font (3-col) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Size</Label>
          <Input
            type="number"
            value={fontSize}
            onChange={(e) => updateStyle({ fontSize: `${parseInt(e.target.value) || 12}px` })}
            min={12}
            max={120}
            className="h-8 text-xs font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Weight</Label>
          <Select value={fontWeight} onValueChange={(val) => updateStyle({ fontWeight: val })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="400" className="text-xs">Normal</SelectItem>
              <SelectItem value="500" className="text-xs">Medium</SelectItem>
              <SelectItem value="600" className="text-xs">Semi</SelectItem>
              <SelectItem value="700" className="text-xs">Bold</SelectItem>
              <SelectItem value="800" className="text-xs">Extra</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
      </div>

      {/* Row 3: X | Y */}
      <div className="grid grid-cols-2 gap-3">
        <SliderWithButtons
          label="X"
          value={hotspot.x}
          onChange={(val) => onUpdate({ x: val })}
          min={0}
          max={100}
          step={0.5}
          fineStep={0.1}
        />
        <SliderWithButtons
          label="Y"
          value={hotspot.y}
          onChange={(val) => onUpdate({ y: val })}
          min={0}
          max={100}
          step={0.5}
          fineStep={0.1}
        />
      </div>

      {/* Row 4: W | H | Z */}
      <div className="grid grid-cols-3 gap-3">
        <SliderWithButtons
          label="W"
          value={hotspot.width}
          onChange={(val) => onUpdate({ width: val })}
          min={1}
          max={100}
          step={0.5}
          fineStep={0.1}
        />
        <SliderWithButtons
          label="H"
          value={hotspot.height}
          onChange={(val) => onUpdate({ height: val })}
          min={1}
          max={100}
          step={0.5}
          fineStep={0.1}
        />
        <SliderWithButtons
          label="Z"
          value={hotspot.zIndex ?? 1}
          onChange={(val) => onUpdate({ zIndex: val })}
          min={0}
          max={99}
          step={1}
          fineStep={1}
        />
      </div>

      {/* Row 5: H-Align | V-Align */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">H-Align</Label>
          <Select value={textAlign} onValueChange={(val) => updateStyle({ textAlign: val as 'left' | 'center' | 'right' })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left" className="text-xs">Left</SelectItem>
              <SelectItem value="center" className="text-xs">Center</SelectItem>
              <SelectItem value="right" className="text-xs">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">V-Align</Label>
          <Select value={verticalAlign} onValueChange={(val) => updateStyle({ verticalAlign: val as 'top' | 'center' | 'bottom' })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top" className="text-xs">Top</SelectItem>
              <SelectItem value="center" className="text-xs">Center</SelectItem>
              <SelectItem value="bottom" className="text-xs">Bottom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Clip overflow toggle — hides text that extends past the box */}
      <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2">
        <div className="space-y-0.5">
          <Label className="text-xs cursor-pointer" htmlFor={`clip-overflow-${hotspot.id}`}>
            Clip text to box
          </Label>
          <p className="text-[10px] text-muted-foreground leading-tight">
            When on, text that doesn't fit is hidden. Turn off to let text spill outside the box.
          </p>
        </div>
        <Switch
          id={`clip-overflow-${hotspot.id}`}
          checked={style.clipOverflow !== false}
          onCheckedChange={(checked) => updateStyle({ clipOverflow: checked })}
        />
      </div>

      {/* Row 6: Text Color | BG Color */}
      <div className="grid grid-cols-2 gap-3">
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
      </div>

      {/* Row 7: Preview */}
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
