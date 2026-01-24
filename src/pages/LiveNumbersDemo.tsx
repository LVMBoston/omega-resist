import { useRef, useState } from "react";
import testSlideImage from "@/assets/test-live-numbers-slide.png";
import { InteractiveSlideOverlay } from "@/components/InteractiveSlideOverlay";
import { Hotspot } from "@/types/viralTemplates";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

/**
 * Demo page for Live Numbers Overlay (Phase 1 Mockup)
 * Shows a test slide with hardcoded live_number hotspots
 * Includes interactive sliders to adjust position
 */
export default function LiveNumbersDemo() {
  const navigate = useNavigate();
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Editable position state
  const [x, setX] = useState(26);
  const [y, setY] = useState(17.5);
  const [width, setWidth] = useState(14);
  const [height, setHeight] = useState(9);
  const [fontSize, setFontSize] = useState(56);
  const [fontFamily, setFontFamily] = useState("Calibri, sans-serif");
  const [fontWeight, setFontWeight] = useState("700");
  const [textColor, setTextColor] = useState("#1a1a1a");
  const [bgColor, setBgColor] = useState("#e8dcc8");
  const [displayValue, setDisplayValue] = useState("142");

  // Dynamic hotspots based on slider values
  const mockHotspots: Hotspot[] = [
    {
      id: "seeds-value",
      iconId: "live-number",
      type: "live_number",
      label: "Seeds Count",
      x,
      y,
      width,
      height,
      metricKey: "seeds",
      liveNumberStyle: {
        fontSize: `${fontSize}px`,
        fontWeight,
        color: textColor,
        backgroundColor: bgColor,
        textAlign: "center",
        fontFamily,
        padding: "4px",
      }
    }
  ];

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="bg-background/90 backdrop-blur-sm p-4 flex items-center gap-4 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="font-semibold">Live Numbers Demo</h1>
          <p className="text-sm text-muted-foreground">
            Phase 1 Mockup - Adjust position with sliders below
          </p>
        </div>
      </div>

      {/* Slide Preview */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative max-w-4xl w-full">
          <img
            ref={imageRef}
            src={testSlideImage}
            alt="Test slide with live numbers"
            className="w-full h-auto rounded-lg shadow-2xl"
            onLoad={() => setImageLoaded(true)}
          />
          
          {imageLoaded && (
            <InteractiveSlideOverlay
              hotspots={mockHotspots}
              deckSlug="demo"
              imageRef={imageRef}
              viralToken={null}
              mockMetricValue={displayValue}
            />
          )}
        </div>
      </div>

      {/* Position Controls */}
      <div className="bg-background/90 backdrop-blur-sm p-4 border-t border-border">
        <div className="max-w-4xl mx-auto space-y-4">
          <h2 className="font-semibold">Position Controls</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
            {/* X Position */}
            <div className="space-y-2">
              <Label className="text-xs">X: {x.toFixed(1)}%</Label>
              <Slider
                value={[x]}
                onValueChange={([val]) => setX(val)}
                min={0}
                max={100}
                step={0.5}
              />
            </div>
            
            {/* Y Position */}
            <div className="space-y-2">
              <Label className="text-xs">Y: {y.toFixed(1)}%</Label>
              <Slider
                value={[y]}
                onValueChange={([val]) => setY(val)}
                min={0}
                max={100}
                step={0.5}
              />
            </div>
            
            {/* Width */}
            <div className="space-y-2">
              <Label className="text-xs">Width: {width.toFixed(1)}%</Label>
              <Slider
                value={[width]}
                onValueChange={([val]) => setWidth(val)}
                min={1}
                max={50}
                step={0.5}
              />
            </div>
            
            {/* Height */}
            <div className="space-y-2">
              <Label className="text-xs">Height: {height.toFixed(1)}%</Label>
              <Slider
                value={[height]}
                onValueChange={([val]) => setHeight(val)}
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
                onValueChange={([val]) => setFontSize(val)}
                min={12}
                max={120}
                step={1}
              />
            </div>
            
            {/* Font Family */}
            <div className="space-y-2">
              <Label className="text-xs">Font</Label>
              <Select value={fontFamily} onValueChange={setFontFamily}>
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
              <Select value={fontWeight} onValueChange={setFontWeight}>
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
                  onChange={(e) => setTextColor(e.target.value)}
                  placeholder="#1a1a1a"
                  className="h-8 text-xs font-mono flex-1"
                />
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="h-8 w-8 rounded border border-input cursor-pointer"
                />
              </div>
            </div>

            {/* Background Color */}
            <div className="space-y-2">
              <Label className="text-xs">BG Color</Label>
              <div className="flex gap-1">
                <Input
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  placeholder="#e8dcc8"
                  className="h-8 text-xs font-mono flex-1"
                />
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-8 w-8 rounded border border-input cursor-pointer"
                />
              </div>
            </div>
            
            {/* Display Value */}
            <div className="space-y-2">
              <Label className="text-xs">Value</Label>
              <Input
                value={displayValue}
                onChange={(e) => setDisplayValue(e.target.value)}
                className="h-8"
              />
            </div>
          </div>

          {/* Copy Config */}
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-1">Current config (copy for use):</p>
            <code className="text-xs bg-muted px-2 py-1 rounded break-all">
              x: {x}, y: {y}, width: {width}, height: {height}, fontSize: "{fontSize}px", fontWeight: "{fontWeight}", fontFamily: "{fontFamily}", color: "{textColor}", backgroundColor: "{bgColor}"
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}