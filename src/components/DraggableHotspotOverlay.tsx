import { useRef, useCallback, useState } from "react";
import { Hotspot } from "@/types/viralTemplates";
import { Pencil, Move, BarChart3, MapIcon, Lock, Unlock, Mail, MessageSquare, Share2, ExternalLink, Plus, Minus } from "lucide-react";
import { LEVEL_COLORS } from "@/hooks/useChartData";
import { ChartHotspotRenderer } from "@/components/ChartHotspotRenderer";
import { MapHotspotRenderer, MapControls } from "@/components/MapHotspotRenderer";
import { hasManualHtmlContent, sanitizeManualHtml } from "@/lib/manualEntryHtml";

const LOCKED_HOTSPOT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sms: MessageSquare,
  email: Mail,
  social: Share2,
  external_link: ExternalLink,
};

interface DraggableHotspotOverlayProps {
  hotspots: Hotspot[];
  activeIndex: number;
  imageRef: React.RefObject<HTMLImageElement>;
  displayValues: Record<string, string>;
  onUpdateHotspot: (index: number, updates: Partial<Hotspot>) => void;
  onSelectHotspot: (index: number) => void;
  campaignCode?: string;
  lockedHotspots?: Hotspot[];
  onMapBoundsChange?: (hotspotId: string, bounds: { north: number; south: number; east: number; west: number }) => void;
  onMapControlsReady?: (hotspotId: string, controls: MapControls) => void;
  onMapZoomChange?: (hotspotId: string, zoom: number) => void;
}

export function DraggableHotspotOverlay({
  hotspots,
  activeIndex,
  imageRef,
  displayValues,
  onUpdateHotspot,
  onSelectHotspot,
  campaignCode,
  lockedHotspots = [],
  onMapBoundsChange,
  onMapControlsReady,
  onMapZoomChange,
}: DraggableHotspotOverlayProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [editModeIndex, setEditModeIndex] = useState<number | null>(null);
  const dragStartPos = useRef<{ x: number; y: number; hotspotX: number; hotspotY: number } | null>(null);
  const mapControlsRef = useRef<Record<string, MapControls>>({});

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
      className="absolute inset-0 overflow-visible"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Ghost overlays for locked hotspots (non-interactive) */}
      {lockedHotspots.map((hotspot) => {
        const IconComponent = LOCKED_HOTSPOT_ICONS[hotspot.type] || Lock;
        return (
          <div
            key={`locked-${hotspot.id}`}
            className="absolute pointer-events-none select-none opacity-40 z-[5] flex items-center justify-center"
            style={{
              left: `${hotspot.x}%`,
              top: `${hotspot.y}%`,
              width: `${hotspot.width}%`,
              height: `${hotspot.height}%`,
              border: "2px dashed rgba(168, 85, 247, 0.7)",
              borderRadius: "6px",
              backgroundColor: "rgba(168, 85, 247, 0.08)",
            }}
          >
            <div className="flex flex-col items-center gap-0.5">
              <Lock className="w-4 h-4 text-purple-500" />
              <IconComponent className="w-5 h-5 text-purple-500" />
              <span className="text-[10px] font-medium text-purple-600 uppercase tracking-wide">
                {hotspot.label || hotspot.type}
              </span>
            </div>
          </div>
        );
      })}

      {hotspots.map((hotspot, index) => {
        const style = hotspot.liveNumberStyle || {};
        const isActive = index === activeIndex;
        const isDragging = index === draggingIndex;
        const isEditMode = index === editModeIndex;
        const isManualEntry = hotspot.metricKey === "manual_entry";
        const isChart = hotspot.type === "chart";
        const isMap = hotspot.type === "map";

        // Map hotspot rendering
        if (isMap) {
          const mapConfig = hotspot.mapConfig || {
            mapStyle: 'channel_colors' as const,
            showClustering: false,
          };
          const isMapLocked = mapConfig.isLocked || false;
          
          // Calculate pixel dimensions based on image
          const imageBounds = imageRef.current?.getBoundingClientRect();
          const pixelWidth = imageBounds ? (hotspot.width / 100) * imageBounds.width : 200;
          const pixelHeight = imageBounds ? (hotspot.height / 100) * imageBounds.height : 150;
          
          return (
            <div
              key={hotspot.id}
              data-hotspot-overlay
              className={`absolute select-none transition-shadow overflow-hidden rounded-lg ${
                isActive ? "ring-2 ring-purple-500 ring-offset-2" : ""
              } ${isDragging ? "z-50 shadow-2xl cursor-move" : "z-10"}`}
              style={{
                left: `${hotspot.x}%`,
                top: `${hotspot.y}%`,
                width: `${hotspot.width}%`,
                height: `${hotspot.height}%`,
                border: isMapLocked ? "2px solid rgba(245, 158, 11, 0.7)" : "2px dashed rgba(168, 85, 247, 0.5)",
              }}
            >
              {/* Render live map if campaignCode is provided, otherwise show placeholder */}
              {campaignCode ? (
                <MapHotspotRenderer
                  campaignCode={campaignCode}
                  config={mapConfig}
                  width={pixelWidth}
                  height={pixelHeight}
                  isEditorMode={!isMapLocked}
                  onBoundsChange={!isMapLocked ? (bounds) => onMapBoundsChange?.(hotspot.id, bounds) : undefined}
                  onMapReady={(controls) => {
                    mapControlsRef.current[hotspot.id] = controls;
                    if (!isMapLocked) {
                      onMapControlsReady?.(hotspot.id, controls);
                    }
                  }}
                  onMapZoomChange={(zoom) => onMapZoomChange?.(hotspot.id, zoom)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-muted/50 text-purple-600">
                  <MapIcon className="w-8 h-8" />
                  <span className="text-xs font-medium">Map</span>
                  <span className="text-[10px] text-muted-foreground">Select Campaign</span>
                </div>
              )}

              {/* Lock toggle button in upper right corner */}
              <button 
                type="button"
                data-capture-hide
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onUpdateHotspot(index, {
                    mapConfig: {
                      ...mapConfig,
                      isLocked: !isMapLocked,
                    },
                  });
                }}
                className={`absolute top-0 right-0 w-7 h-7 flex items-center justify-center z-[1002] rounded-bl-lg cursor-pointer transition-colors ${
                  isMapLocked 
                    ? "bg-amber-500 text-white hover:bg-amber-600" 
                    : "bg-gray-500/60 text-white/80 hover:bg-gray-600"
                }`}
                title={isMapLocked ? "Click to unlock map (enable pan/zoom)" : "Click to lock map position"}
              >
                {isMapLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>

              {/* Fine zoom controls - only when unlocked */}
              {!isMapLocked && (
                <div className="absolute top-8 right-0 flex flex-col z-[1002]" data-capture-hide>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      mapControlsRef.current[hotspot.id]?.zoomIn(0.25);
                    }}
                    className="w-7 h-7 flex items-center justify-center bg-white/90 hover:bg-white text-gray-700 cursor-pointer border-b border-gray-200"
                    title="Zoom in (fine)"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      mapControlsRef.current[hotspot.id]?.zoomOut(0.25);
                    }}
                    className="w-7 h-7 flex items-center justify-center bg-white/90 hover:bg-white text-gray-700 cursor-pointer rounded-bl-lg"
                    title="Zoom out (fine)"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Drag handle - on the corner for map hotspots */}
              <div 
                data-capture-hide
                className="absolute top-0 left-0 w-8 h-8 bg-purple-500/80 rounded-br-lg flex items-center justify-center cursor-move z-[1002]"
                onMouseDown={(e) => handleMouseDown(e, index)}
                title="Drag to reposition"
              >
                <Move className="w-4 h-4 text-white" />
              </div>

              {/* Index badge - moved to bottom left to avoid confusion with resize handle */}
              <div
                data-capture-hide
                className={`absolute -bottom-3 -left-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-[1001] ${
                  isActive
                    ? "bg-purple-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {index + 1}
              </div>

              {/* Removed non-functional resize handle - use sliders in calibration panel for resizing */}
            </div>
          );
        }

        // Chart hotspot rendering
        if (isChart) {
          const chartConfig = hotspot.chartConfig || {
            chartType: 'stacked_bar',
            dataSource: 'cumulative_opens_by_level',
            showXAxis: true,
            showYAxis: false,
          };
          
          return (
            <div
              key={hotspot.id}
              data-hotspot-overlay
              className={`absolute flex items-center justify-center select-none transition-shadow cursor-move ${
                isActive ? "ring-2 ring-blue-500 ring-offset-2" : ""
              } ${isDragging ? "z-50 shadow-2xl" : "z-10"}`}
              style={{
                left: `${hotspot.x}%`,
                top: `${hotspot.y}%`,
                width: `${hotspot.width}%`,
                height: `${hotspot.height}%`,
                backgroundColor: "rgba(255,255,255,0.95)",
                border: "2px dashed rgba(59, 130, 246, 0.5)",
                borderRadius: "4px",
              }}
              onMouseDown={(e) => handleMouseDown(e, index)}
            >
              {/* Render actual chart if campaignCode is provided, otherwise show placeholder */}
              {campaignCode ? (
                <div className="w-full h-full p-1 pointer-events-none">
                  <ChartHotspotRenderer
                    campaignCode={campaignCode}
                    config={chartConfig}
                    width={100}
                    height={100}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1 text-blue-600">
                  <BarChart3 className="w-6 h-6" />
                  <span className="text-xs font-medium">Chart</span>
                  <span className="text-[10px] text-muted-foreground">Enter Campaign ID</span>
                  <div className="flex gap-1">
                    {Object.entries(LEVEL_COLORS).map(([level, color]) => (
                      <span
                        key={level}
                        className="w-2 h-4 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Index badge */}
              <div
                data-capture-hide
                className={`absolute -top-3 -left-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive
                    ? "bg-blue-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {index + 1}
              </div>

              {/* Resize handle indicator */}
              <div data-capture-hide className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500/50 rounded-tl opacity-0 hover:opacity-100 transition-opacity" />
            </div>
          );
        }

        // Live number hotspot rendering
        // Map alignment values to flexbox properties
        const justifyContent = 
          style.textAlign === 'left' ? 'flex-start' : 
          style.textAlign === 'right' ? 'flex-end' : 'center';
        const alignItems = 
          style.verticalAlign === 'top' ? 'flex-start' : 
          style.verticalAlign === 'bottom' ? 'flex-end' : 'center';

        // Calculate scaled font size based on image width
        // The original font sizes were designed for ~1080px width, so we scale accordingly
        const imageBounds = imageRef.current?.getBoundingClientRect();
        const baseWidth = 1080; // Reference width for calibration
        const scaleFactor = imageBounds ? imageBounds.width / baseWidth : 1;
        const baseFontSize = parseInt(style.fontSize || "25") || 25;
        const scaledFontSize = Math.max(8, Math.round(baseFontSize * scaleFactor));

        return (
          <div
            key={hotspot.id}
            data-hotspot-overlay
            className={`absolute select-none transition-shadow overflow-y-auto ${
              isEditMode ? "cursor-text" : "cursor-move"
            } ${isActive ? "ring-2 ring-primary ring-offset-2" : ""} ${
              isDragging ? "z-50 shadow-2xl" : "z-10"
            }`}
            style={{
              left: `${hotspot.x}%`,
              top: `${hotspot.y}%`,
              width: `${hotspot.width}%`,
              height: `${hotspot.height}%`,
              display: "flex",
              fontSize: `${scaledFontSize}px`,
              fontWeight: style.fontWeight || "700",
              color: style.color || "#1a1a1a",
              backgroundColor: style.backgroundColor || "#e8dcc8",
              justifyContent,
              alignItems,
              fontFamily: style.fontFamily || "Calibri, sans-serif",
              padding: style.padding || "4px",
              borderRadius: style.borderRadius || "0px",
            }}
            onMouseDown={(e) => handleMouseDown(e, index)}
          >
            {/* Editable input when in edit mode and manual entry */}
            {isEditMode && isManualEntry ? (
              <textarea
                value={hotspot.manualLabel || ""}
                onChange={(e) => onUpdateHotspot(index, { manualLabel: e.target.value })}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="w-full h-full bg-transparent border-none outline-none text-center resize-none"
                style={{
                  fontSize: "inherit",
                  fontWeight: "inherit",
                  color: "inherit",
                  fontFamily: "inherit",
                }}
                placeholder="Enter text..."
              />
            ) : isManualEntry && hasManualHtmlContent(hotspot.manualHtml) ? (
              <div
                className="manual-entry-box pointer-events-none w-full h-full overflow-hidden"
                style={{ textAlign: (style as any).textAlign || "left" }}
                dangerouslySetInnerHTML={{ __html: sanitizeManualHtml(hotspot.manualHtml || "") }}
              />
            ) : (
              <span className="pointer-events-none whitespace-pre-line">
                {isManualEntry ? (hotspot.manualLabel || "—") : (displayValues[hotspot.id] || "0")}
              </span>
            )}
            
            {/* Index badge */}
            <div
              data-capture-hide
              className={`absolute -top-3 -left-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {index + 1}
            </div>

            {/* Edit/Drag mode toggle - ALWAYS show for manual_entry hotspots */}
            {isManualEntry && (
              <button
                type="button"
                data-capture-hide
                onClick={(e) => toggleEditMode(e, index)}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs transition-colors z-50 shadow-md border border-border ${
                  isEditMode
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground hover:bg-muted"
                }`}
                title={isEditMode ? "Switch to drag mode" : "Switch to edit mode"}
              >
                {isEditMode ? <Move className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
              </button>
            )}

            {/* Resize handle indicator */}
            <div data-capture-hide className="absolute bottom-0 right-0 w-3 h-3 bg-primary/50 rounded-tl opacity-0 hover:opacity-100 transition-opacity" />
          </div>
        );
      })}
    </div>
  );
}
