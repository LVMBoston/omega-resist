import { Hotspot, MapConfig } from "@/types/viralTemplates";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Save, Trash2, ZoomIn, ZoomOut, Move, Hand, Lock, Unlock } from "lucide-react";
import { SliderWithButtons } from "@/components/ui/slider-with-buttons";

interface MapCalibrationControlsProps {
  hotspot: Hotspot;
  onUpdate: (updates: Partial<Hotspot>) => void;
  currentBounds?: { north: number; south: number; east: number; west: number } | null;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetView?: () => void;
}

export function MapCalibrationControls({
  hotspot,
  onUpdate,
  currentBounds,
  onZoomIn,
  onZoomOut,
  onResetView,
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
      {/* Pan & Zoom Instructions */}
      <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Hand className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-purple-800 dark:text-purple-200">
              Position the Map View
            </p>
            <p className="text-purple-700 dark:text-purple-300 mt-1">
              Drag to pan, scroll to zoom, then click <strong>Save Current View</strong> to lock this position for runtime.
            </p>
          </div>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Zoom Controls</Label>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onZoomIn}
            className="flex-1 gap-1"
          >
            <ZoomIn className="w-4 h-4" />
            Zoom In
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onZoomOut}
            className="flex-1 gap-1"
          >
            <ZoomOut className="w-4 h-4" />
            Zoom Out
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onResetView}
            className="gap-1"
            title="Reset to default US view"
          >
            <Move className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Position Controls */}
      <div className="grid grid-cols-2 gap-4">
        <SliderWithButtons
          label="X"
          value={hotspot.x}
          onChange={(v) => onUpdate({ x: v })}
          min={0}
          max={80}
          step={0.5}
          fineStep={0.1}
        />
        <SliderWithButtons
          label="Y"
          value={hotspot.y}
          onChange={(v) => onUpdate({ y: v })}
          min={0}
          max={80}
          step={0.5}
          fineStep={0.1}
        />
      </div>

      {/* Size Controls */}
      <div className="grid grid-cols-2 gap-4">
        <SliderWithButtons
          label="W"
          value={hotspot.width}
          onChange={(v) => onUpdate({ width: v })}
          min={10}
          max={95}
          step={0.5}
          fineStep={0.1}
        />
        <SliderWithButtons
          label="H"
          value={hotspot.height}
          onChange={(v) => onUpdate({ height: v })}
          min={10}
          max={80}
          step={0.5}
          fineStep={0.1}
        />
      </div>

      {/* Map Settings */}
      <div className="space-y-3 pt-2 border-t border-border">
        <h4 className="text-sm font-medium">Map Settings</h4>

      {/* Lock Map Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="lock-map" className="text-sm flex items-center gap-2">
            {mapConfig.isLocked ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4" />}
            Lock Map Position
          </Label>
          <Switch
            id="lock-map"
            checked={mapConfig.isLocked || false}
            onCheckedChange={(checked) => updateMapConfig({ isLocked: checked })}
          />
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          When locked, pan/zoom controls are disabled to prevent accidental changes.
        </p>

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
              variant="default"
              size="sm"
              onClick={handleSaveView}
              disabled={!currentBounds}
              className="w-full gap-1 bg-purple-600 hover:bg-purple-700"
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
