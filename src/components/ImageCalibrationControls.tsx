import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Hotspot } from "@/types/viralTemplates";
import { SliderWithButtons } from "@/components/ui/slider-with-buttons";
import { ImageIcon } from "lucide-react";

interface ImageCalibrationControlsProps {
  hotspot: Hotspot;
  onUpdate: (updates: Partial<Hotspot>) => void;
  /** width/height of the editor canvas in pixels — needed to lock visual aspect ratio in % space. */
  canvasAspectRatio: number;
  /** Re-arm paste mode so the user can swap in a new image. */
  onReplaceImage?: () => void;
}

/**
 * Image hotspot controls. Width/height are locked to the image's natural
 * aspect ratio: changing one slider auto-recomputes the other. Because the
 * stored values are percentages of the slide canvas (not pixels), we have to
 * multiply by the canvas aspect ratio to translate "pixel aspect ratio" into
 * "percentage aspect ratio".
 */
export function ImageCalibrationControls({
  hotspot,
  onUpdate,
  canvasAspectRatio,
  onReplaceImage,
}: ImageCalibrationControlsProps) {
  const imageRatio = hotspot.imageNaturalRatio || 1; // pixel w/h
  // H% = W% * canvasAspectRatio / imageRatio
  const heightFromWidth = (w: number) =>
    Math.max(1, Math.min(100, (w * canvasAspectRatio) / imageRatio));
  const widthFromHeight = (h: number) =>
    Math.max(1, Math.min(100, (h * imageRatio) / canvasAspectRatio));

  const handleWidth = (w: number) => {
    const newW = Math.max(1, Math.min(100, w));
    const newH = heightFromWidth(newW);
    onUpdate({
      width: newW,
      height: newH,
      // Clamp position so it stays in bounds.
      x: Math.min(hotspot.x, 100 - newW),
      y: Math.min(hotspot.y, 100 - newH),
    });
  };

  const handleHeight = (h: number) => {
    const newH = Math.max(1, Math.min(100, h));
    const newW = widthFromHeight(newH);
    onUpdate({
      width: newW,
      height: newH,
      x: Math.min(hotspot.x, 100 - newW),
      y: Math.min(hotspot.y, 100 - newH),
    });
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-8 gap-4">
      {/* Image preview / replace */}
      <div className="space-y-2 col-span-2">
        <Label className="text-xs">Image</Label>
        <div className="flex items-center gap-2">
          {hotspot.imageSrc ? (
            <img
              src={hotspot.imageSrc}
              alt="Hotspot"
              className="h-10 w-10 object-contain rounded border bg-muted"
            />
          ) : (
            <div className="h-10 w-10 flex items-center justify-center rounded border bg-muted">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          {onReplaceImage && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onReplaceImage}
            >
              Replace
            </Button>
          )}
        </div>
      </div>

      {/* X Position */}
      <SliderWithButtons
        label="X"
        value={hotspot.x}
        onChange={(val) => onUpdate({ x: Math.max(0, Math.min(100 - hotspot.width, val)) })}
        min={0}
        max={100}
        step={0.5}
        fineStep={0.1}
      />

      {/* Y Position */}
      <SliderWithButtons
        label="Y"
        value={hotspot.y}
        onChange={(val) => onUpdate({ y: Math.max(0, Math.min(100 - hotspot.height, val)) })}
        min={0}
        max={100}
        step={0.5}
        fineStep={0.1}
      />

      {/* Width (locked to ratio) */}
      <SliderWithButtons
        label="W"
        value={hotspot.width}
        onChange={handleWidth}
        min={1}
        max={100}
        step={0.5}
        fineStep={0.1}
      />

      {/* Height (locked to ratio) */}
      <SliderWithButtons
        label="H"
        value={hotspot.height}
        onChange={handleHeight}
        min={1}
        max={100}
        step={0.5}
        fineStep={0.1}
      />

      {/* Aspect ratio readout */}
      <div className="space-y-2">
        <Label className="text-xs">Aspect</Label>
        <div className="h-8 px-2 flex items-center bg-muted rounded text-xs whitespace-nowrap">
          {imageRatio.toFixed(2)} : 1
        </div>
      </div>

      <div className="col-span-full text-[10px] text-muted-foreground">
        Width and height are locked to the image's natural aspect ratio. Adjusting one updates the other automatically.
      </div>
    </div>
  );
}
