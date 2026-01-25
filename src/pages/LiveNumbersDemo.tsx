import { useRef, useState, useCallback } from "react";
import statsPageMockup from "@/assets/stats-page-mockup.png";
import { Hotspot } from "@/types/viralTemplates";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2, Copy, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HotspotCalibrationControls } from "@/components/HotspotCalibrationControls";
import { DraggableHotspotOverlay } from "@/components/DraggableHotspotOverlay";
import { toast } from "sonner";

// Default hotspot template
const createDefaultHotspot = (index: number): Hotspot => ({
  id: `hotspot-${index}`,
  iconId: "live-number",
  type: "live_number",
  label: `Hotspot ${index + 1}`,
  x: 20 + (index % 4) * 15,
  y: 20 + Math.floor(index / 4) * 15,
  width: 14,
  height: 9,
  metricKey: "seeds",
  liveNumberStyle: {
    fontSize: "56px",
    fontWeight: "700",
    color: "#1a1a1a",
    backgroundColor: "#e8dcc8",
    textAlign: "center",
    fontFamily: "Calibri, sans-serif",
    padding: "4px",
  },
});

/**
 * Demo page for Live Numbers Overlay (Phase 0.5 Multi-Hotspot Calibration)
 * Supports multiple hotspots with selector chips and JSON export
 */
export default function LiveNumbersDemo() {
  const navigate = useNavigate();
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Multi-hotspot state
  const [hotspots, setHotspots] = useState<Hotspot[]>([createDefaultHotspot(0)]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [displayValues, setDisplayValues] = useState<Record<string, string>>({
    "hotspot-0": "142",
  });

  const activeHotspot = hotspots[activeIndex];

  // Update a hotspot by index
  const updateHotspot = useCallback((index: number, updates: Partial<Hotspot>) => {
    setHotspots((prev) =>
      prev.map((h, i) => (i === index ? { ...h, ...updates } : h))
    );
  }, []);

  // Add a new hotspot, inheriting style from the active hotspot
  const addHotspot = useCallback(() => {
    const newIndex = hotspots.length;
    const baseHotspot = createDefaultHotspot(newIndex);
    
    // Inherit styling and dimensions from the active hotspot if one exists
    if (activeHotspot) {
      baseHotspot.width = activeHotspot.width;
      baseHotspot.height = activeHotspot.height;
      if (activeHotspot.liveNumberStyle) {
        baseHotspot.liveNumberStyle = { ...activeHotspot.liveNumberStyle };
      }
    }
    
    setHotspots((prev) => [...prev, baseHotspot]);
    setDisplayValues((prev) => ({ ...prev, [baseHotspot.id]: "0" }));
    setActiveIndex(newIndex);
  }, [hotspots.length, activeHotspot]);

  // Remove the active hotspot
  const removeHotspot = useCallback(() => {
    if (hotspots.length <= 1) {
      toast.error("Cannot remove the last hotspot");
      return;
    }
    const removedId = hotspots[activeIndex].id;
    setHotspots((prev) => prev.filter((_, i) => i !== activeIndex));
    setDisplayValues((prev) => {
      const { [removedId]: _, ...rest } = prev;
      return rest;
    });
    setActiveIndex((prev) => Math.max(0, prev - 1));
  }, [hotspots, activeIndex]);

  // Update display value for active hotspot
  const updateDisplayValue = useCallback(
    (value: string) => {
      if (activeHotspot) {
        setDisplayValues((prev) => ({ ...prev, [activeHotspot.id]: value }));
      }
    },
    [activeHotspot]
  );

  // Export configuration as JSON
  const exportConfig = useCallback(() => {
    const config = {
      slideImage: "test-live-numbers-slide.png",
      hotspots: hotspots.map((h) => ({
        id: h.id,
        metricKey: h.metricKey,
        x: h.x,
        y: h.y,
        width: h.width,
        height: h.height,
        liveNumberStyle: h.liveNumberStyle,
      })),
    };
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    setCopied(true);
    toast.success("Configuration copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }, [hotspots]);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="bg-background/90 backdrop-blur-sm p-4 flex items-center gap-4 border-b border-border">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="font-semibold">Live Numbers Calibration</h1>
          <p className="text-sm text-muted-foreground">
            Phase 0.5 — Multi-hotspot positioning for Stats Page
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={exportConfig}
          className="gap-2"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy Config"}
        </Button>
      </div>

      {/* Slide Preview */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative max-w-4xl w-full">
          <img
            ref={imageRef}
            src={statsPageMockup}
            alt="Test slide with live numbers"
            className="w-full h-auto rounded-lg shadow-2xl"
            onLoad={() => setImageLoaded(true)}
          />

          {imageLoaded && (
            <DraggableHotspotOverlay
              hotspots={hotspots}
              activeIndex={activeIndex}
              imageRef={imageRef}
              displayValues={displayValues}
              onUpdateHotspot={updateHotspot}
              onSelectHotspot={setActiveIndex}
            />
          )}
        </div>
      </div>

      {/* Controls Panel */}
      <div className="bg-background/90 backdrop-blur-sm p-4 border-t border-border">
        <div className="max-w-5xl mx-auto space-y-4">
          {/* Hotspot Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">
              Hotspots:
            </span>
            {hotspots.map((h, i) => (
              <Button
                key={h.id}
                variant={i === activeIndex ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveIndex(i)}
                className="min-w-[40px]"
              >
                {i + 1}
                {h.metricKey && (
                  <span className="ml-1 text-xs opacity-70">
                    ({h.metricKey})
                  </span>
                )}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addHotspot}
              className="gap-1"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={removeHotspot}
              disabled={hotspots.length <= 1}
              className="gap-1 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </Button>
          </div>

          {/* Active Hotspot Controls */}
          {activeHotspot && (
            <HotspotCalibrationControls
              hotspot={activeHotspot}
              displayValue={displayValues[activeHotspot.id] || "0"}
              onUpdate={(updates) => updateHotspot(activeIndex, updates)}
              onDisplayValueChange={updateDisplayValue}
            />
          )}

          {/* Config Preview */}
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-1">
              Active hotspot config:
            </p>
            <code className="text-xs bg-muted px-2 py-1 rounded break-all block max-h-20 overflow-auto">
              {activeHotspot &&
                `{ metricKey: "${activeHotspot.metricKey}", x: ${activeHotspot.x.toFixed(1)}, y: ${activeHotspot.y.toFixed(1)}, w: ${activeHotspot.width.toFixed(1)}, h: ${activeHotspot.height.toFixed(1)} }`}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
