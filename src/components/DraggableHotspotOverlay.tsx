import { useRef, useCallback, useState } from "react";
import { Hotspot } from "@/types/viralTemplates";
import { Pencil, Move } from "lucide-react";

interface DraggableHotspotOverlayProps {
  hotspots: Hotspot[];
  activeIndex: number;
  imageRef: React.RefObject<HTMLImageElement>;
  displayValues: Record<string, string>;
  onUpdateHotspot: (index: number, updates: Partial<Hotspot>) => void;
  onSelectHotspot: (index: number) => void;
}

export function DraggableHotspotOverlay({
  hotspots,
  activeIndex,
  imageRef,
  displayValues,
  onUpdateHotspot,
  onSelectHotspot,
}: DraggableHotspotOverlayProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [editModeIndex, setEditModeIndex] = useState<number | null>(null);
  const dragStartPos = useRef<{ x: number; y: number; hotspotX: number; hotspotY: number } | null>(null);

  const getImageBounds = useCallback(() => {
    if (!imageRef.current) return null;
    return imageRef.current.getBoundingClientRect();
  }, [imageRef]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, index: number) => {
      // Don't start drag if in edit mode
      if (editModeIndex === index) return;
      
      e.preventDefault();
      const bounds = getImageBounds();
      if (!bounds) return;

      const hotspot = hotspots[index];
      dragStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        hotspotX: hotspot.x,
        hotspotY: hotspot.y,
      };
      setDraggingIndex(index);
      onSelectHotspot(index);
    },
    [hotspots, getImageBounds, onSelectHotspot, editModeIndex]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggingIndex === null || !dragStartPos.current) return;

      const bounds = getImageBounds();
      if (!bounds) return;

      const deltaX = e.clientX - dragStartPos.current.x;
      const deltaY = e.clientY - dragStartPos.current.y;

      // Convert pixel delta to percentage
      const deltaXPercent = (deltaX / bounds.width) * 100;
      const deltaYPercent = (deltaY / bounds.height) * 100;

      const newX = Math.max(0, Math.min(100, dragStartPos.current.hotspotX + deltaXPercent));
      const newY = Math.max(0, Math.min(100, dragStartPos.current.hotspotY + deltaYPercent));

      onUpdateHotspot(draggingIndex, { x: newX, y: newY });
    },
    [draggingIndex, getImageBounds, onUpdateHotspot]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingIndex(null);
    dragStartPos.current = null;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (draggingIndex !== null) {
      setDraggingIndex(null);
      dragStartPos.current = null;
    }
  }, [draggingIndex]);

  const toggleEditMode = useCallback((e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    setEditModeIndex(prev => prev === index ? null : index);
    onSelectHotspot(index);
  }, [onSelectHotspot]);

  return (
    <div
      className="absolute inset-0"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {hotspots.map((hotspot, index) => {
        const style = hotspot.liveNumberStyle || {};
        const isActive = index === activeIndex;
        const isDragging = index === draggingIndex;
        const isEditMode = index === editModeIndex;
        const isManualEntry = hotspot.metricKey === "manual_entry";

        return (
          <div
            key={hotspot.id}
            className={`absolute flex items-center justify-center select-none transition-shadow ${
              isEditMode ? "cursor-text" : "cursor-move"
            } ${isActive ? "ring-2 ring-primary ring-offset-2" : ""} ${
              isDragging ? "z-50 shadow-2xl" : "z-10"
            }`}
            style={{
              left: `${hotspot.x}%`,
              top: `${hotspot.y}%`,
              width: `${hotspot.width}%`,
              height: `${hotspot.height}%`,
              fontSize: style.fontSize || "56px",
              fontWeight: style.fontWeight || "700",
              color: style.color || "#1a1a1a",
              backgroundColor: style.backgroundColor || "#e8dcc8",
              textAlign: (style.textAlign as React.CSSProperties["textAlign"]) || "center",
              fontFamily: style.fontFamily || "Calibri, sans-serif",
              padding: style.padding || "4px",
              borderRadius: style.borderRadius || "0px",
            }}
            onMouseDown={(e) => handleMouseDown(e, index)}
          >
            {/* Editable input when in edit mode and manual entry */}
            {isEditMode && isManualEntry ? (
              <input
                type="text"
                value={hotspot.manualLabel || ""}
                onChange={(e) => onUpdateHotspot(index, { manualLabel: e.target.value })}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="w-full h-full bg-transparent border-none outline-none text-center"
                style={{
                  fontSize: "inherit",
                  fontWeight: "inherit",
                  color: "inherit",
                  fontFamily: "inherit",
                }}
                placeholder="Enter text..."
              />
            ) : (
              <span className="pointer-events-none">
                {displayValues[hotspot.id] || "0"}
              </span>
            )}
            
            {/* Index badge */}
            <div
              className={`absolute -top-3 -left-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {index + 1}
            </div>

            {/* Edit/Drag mode toggle - only show for manual_entry hotspots */}
            {isManualEntry && (
              <button
                type="button"
                onClick={(e) => toggleEditMode(e, index)}
                onMouseDown={(e) => e.stopPropagation()}
                className={`absolute -top-3 -right-3 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${
                  isEditMode
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                }`}
                title={isEditMode ? "Switch to drag mode" : "Switch to edit mode"}
              >
                {isEditMode ? <Move className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
              </button>
            )}

            {/* Resize handle indicator */}
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary/50 rounded-tl opacity-0 hover:opacity-100 transition-opacity" />
          </div>
        );
      })}
    </div>
  );
}
