import { Hotspot, MapConfig } from "@/types/viralTemplates";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Save, Trash2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface MapCalibrationControlsProps {
  hotspot: Hotspot;
  onUpdate: (updates: Partial<Hotspot>) => void;
  currentBounds?: { north: number; south: number; east: number; west: number } | null;
}

export function MapCalibrationControls({
  hotspot,
  onUpdate,
  currentBounds,
}: MapCalibrationControlsProps) {
  const mapConfig = hotspot.mapConfig || {
    mapStyle: "channel_colors" as const,
    showClustering: true,
  };

  const updateMapConfig = (updates: Partial<MapConfig>) => {
    onUpdate({
      mapConfig: {
        ...mapConfig,
        ...updates,
      },
    });
  };

  const handleSaveView = () => {
    if (currentBounds) {
      updateMapConfig({ savedBounds: currentBounds });
    }
  };

  const handleClearSavedView = () => {
    updateMapConfig({ savedBounds: undefined });
  };

  return (
    <div className="space-y-4">
      {/* Position Controls */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">X Position (%)</Label>
          <Slider
            value={[hotspot.x]}
            onValueChange={([v]) => onUpdate({ x: v })}
            min={0}
            max={80}
            step={0.5}
          />
          <span className="text-xs text-muted-foreground">{hotspot.x.toFixed(1)}%</span>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Y Position (%)</Label>
          <Slider
            value={[hotspot.y]}
            onValueChange={([v]) => onUpdate({ y: v })}
            min={0}
            max={80}
            step={0.5}
          />
          <span className="text-xs text-muted-foreground">{hotspot.y.toFixed(1)}%</span>
        </div>
      </div>

      {/* Size Controls */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Width (%)</Label>
          <Slider
            value={[hotspot.width]}
            onValueChange={([v]) => onUpdate({ width: v })}
            min={10}
            max={95}
            step={0.5}
          />
          <span className="text-xs text-muted-foreground">{hotspot.width.toFixed(1)}%</span>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Height (%)</Label>
          <Slider
            value={[hotspot.height]}
            onValueChange={([v]) => onUpdate({ height: v })}
            min={10}
            max={80}
            step={0.5}
          />
          <span className="text-xs text-muted-foreground">{hotspot.height.toFixed(1)}%</span>
        </div>
      </div>

      {/* Map Settings */}
      <div className="space-y-3 pt-2 border-t border-border">
        <h4 className="text-sm font-medium">Map Settings</h4>

        {/* Clustering Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="clustering" className="text-sm">
            Enable Clustering
          </Label>
          <Switch
            id="clustering"
            checked={mapConfig.showClustering}
            onCheckedChange={(checked) => updateMapConfig({ showClustering: checked })}
          />
        </div>

        {/* Save View Button */}
        <div className="space-y-2">
          <Label className="text-sm">Saved View</Label>
          {mapConfig.savedBounds ? (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                N: {mapConfig.savedBounds.north.toFixed(2)}° 
                S: {mapConfig.savedBounds.south.toFixed(2)}°
                <br />
                E: {mapConfig.savedBounds.east.toFixed(2)}° 
                W: {mapConfig.savedBounds.west.toFixed(2)}°
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveView}
                  disabled={!currentBounds}
                  className="flex-1 gap-1"
                >
                  <Save className="w-3 h-3" />
                  Update View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSavedView}
                  className="gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveView}
              disabled={!currentBounds}
              className="w-full gap-1"
            >
              <Save className="w-3 h-3" />
              Save Current View
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Saved view will be applied when the slide loads at runtime.
          </p>
        </div>
      </div>
    </div>
  );
}
