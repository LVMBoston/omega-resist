import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const MAGNIFICATION_PRESETS: Record<number, { zoom: number; size: number }> = {
  2: { zoom: 2, size: 180 },
  3: { zoom: 3, size: 260 },
  4: { zoom: 4, size: 340 },
};

interface MapMagnifierProps {
  parentMap: L.Map;
  containerRef: React.RefObject<HTMLDivElement>;
  onDeactivate: () => void;
}

export function MapMagnifier({ parentMap, containerRef, onDeactivate }: MapMagnifierProps) {
  const [magnification, setMagnification] = useState(2);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const loupeMapRef = useRef<L.Map | null>(null);
  const loupeContainerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const { size } = MAGNIFICATION_PRESETS[magnification];

  // Create hidden loupe map
  useEffect(() => {
    if (!loupeContainerRef.current) return;

    const map = L.map(loupeContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    });

    tileLayerRef.current = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 22,
      }
    ).addTo(map);

    loupeMapRef.current = map;

    return () => {
      map.remove();
      loupeMapRef.current = null;
    };
  }, []);

  // Sync loupe zoom when magnification or parent zoom changes
  useEffect(() => {
    const map = loupeMapRef.current;
    if (!map) return;

    const syncZoom = () => {
      const parentZoom = parentMap.getZoom();
      const extra = Math.log2(magnification);
      map.setZoom(parentZoom + extra, { animate: false });
    };

    syncZoom();
    parentMap.on("zoom", syncZoom);
    return () => { parentMap.off("zoom", syncZoom); };
  }, [parentMap, magnification]);

  // Track mouse position over the map container
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Only show loupe when cursor is inside the container
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      setCursorPos(null);
      return;
    }

    setCursorPos({ x: e.clientX, y: e.clientY });

    // Convert screen point to lat/lng and center the loupe map
    const containerPoint = parentMap.containerPointToLayerPoint([x, y]);
    const latlng = parentMap.layerPointToLatLng(containerPoint);
    loupeMapRef.current?.setView(latlng, loupeMapRef.current.getZoom(), { animate: false });
  }, [parentMap, containerRef]);

  const handleMouseLeave = useCallback(() => {
    setCursorPos(null);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [containerRef, handleMouseMove, handleMouseLeave]);

  // Keyboard: 2/3/4 to change magnification, Escape to exit
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDeactivate();
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 2 && num <= 4) {
        setMagnification(num);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onDeactivate]);

  // Invalidate loupe map size when size changes
  useEffect(() => {
    setTimeout(() => {
      loupeMapRef.current?.invalidateSize();
    }, 50);
  }, [size]);

  return (
    <>
      {/* Hidden container for the loupe Leaflet map — rendered offscreen but sized correctly */}
      <div
        ref={loupeContainerRef}
        style={{
          position: "fixed",
          left: -9999,
          top: -9999,
          width: size,
          height: size,
          zIndex: -1,
          visibility: "hidden",
        }}
      />

      {/* Visible loupe overlay — follows cursor */}
      {cursorPos && loupeContainerRef.current && (
        <div
          className="pointer-events-none"
          style={{
            position: "fixed",
            left: cursorPos.x - size / 2,
            top: cursorPos.y - size / 2,
            width: size,
            height: size,
            borderRadius: "50%",
            overflow: "hidden",
            border: "3px solid hsl(var(--primary))",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.2)",
            zIndex: 10000,
          }}
        >
          {/* Clone the loupe map tiles into this visible circle using canvas snapshot */}
          <LoupeCanvas loupeMap={loupeMapRef.current} size={size} cursorPos={cursorPos} />
          
          {/* Crosshair */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: 1,
              background: "rgba(0,0,0,0.2)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              width: 1,
              background: "rgba(0,0,0,0.2)",
              pointerEvents: "none",
            }}
          />

          {/* Magnification badge */}
          <div
            className="bg-primary text-primary-foreground"
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 4,
              padding: "1px 5px",
              lineHeight: "16px",
            }}
          >
            {magnification}×
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Renders the loupe map's tiles into a canvas that's displayed in the visible circle.
 * We use a polling approach to continuously grab the map container's rendering.
 */
function LoupeCanvas({
  loupeMap,
  size,
  cursorPos,
}: {
  loupeMap: L.Map | null;
  size: number;
  cursorPos: { x: number; y: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!loupeMap || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = size * (window.devicePixelRatio || 1);
    canvas.height = size * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    const draw = () => {
      const mapContainer = loupeMap.getContainer();
      // Get all tile images from the loupe map
      const tiles = mapContainer.querySelectorAll<HTMLImageElement>(".leaflet-tile");
      const pane = mapContainer.querySelector(".leaflet-map-pane") as HTMLElement | null;
      
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, size, size);

      if (pane) {
        const transform = pane.style.transform;
        const match = transform.match(/translate3d\((-?\d+)px,\s*(-?\d+)px/);
        const offsetX = match ? parseInt(match[1]) : 0;
        const offsetY = match ? parseInt(match[2]) : 0;

        tiles.forEach((tile) => {
          if (!tile.complete || tile.naturalWidth === 0) return;
          const tileContainer = tile.parentElement as HTMLElement;
          const tileTransform = tileContainer?.style.transform || tile.style.transform;
          const tileMatch = tileTransform.match(/translate3d\((-?\d+)px,\s*(-?\d+)px/);
          if (!tileMatch) return;

          const tx = parseInt(tileMatch[1]) + offsetX;
          const ty = parseInt(tileMatch[2]) + offsetY;
          
          try {
            ctx.drawImage(tile, tx, ty, tile.naturalWidth, tile.naturalHeight);
          } catch {
            // cross-origin tile, skip
          }
        });
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [loupeMap, size, cursorPos]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        display: "block",
      }}
    />
  );
}
