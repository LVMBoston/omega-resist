import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const MAGNIFICATION_PRESETS: Record<number, { size: number }> = {
  2: { size: 180 },
  3: { size: 260 },
  4: { size: 340 },
};

// Engagement border colors (mirrors SamizdatMap)
const ENGAGEMENT_BORDERS: Record<string, string> = {
  none: "#ffffff",
  intent: "#f59e0b",
  completed: "#06b6d4",
};

// Level fill colors (mirrors SamizdatMap)
const LEVEL_COLORS: Record<number, string> = {
  0: "#1e293b",
  1: "#22c55e",
  2: "#a855f7",
  3: "#ef4444",
};

const getLevelColor = (level: number): string => {
  if (level >= 3) return LEVEL_COLORS[3];
  return LEVEL_COLORS[level] || LEVEL_COLORS[0];
};

export interface LoupeEventPoint {
  eventId: string;
  latitude: number;
  longitude: number;
  level: number;
  engagementState: string;
  utmMedium: string;
}

interface MapMagnifierProps {
  parentMap: L.Map;
  containerRef: React.RefObject<HTMLDivElement>;
  onDeactivate: () => void;
  displayEvents: LoupeEventPoint[];
}

export function MapMagnifier({ parentMap, containerRef, onDeactivate, displayEvents }: MapMagnifierProps) {
  const [magnification, setMagnification] = useState(2);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const loupeMapRef = useRef<L.Map | null>(null);
  const loupeContainerRef = useRef<HTMLDivElement>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const { size } = MAGNIFICATION_PRESETS[magnification];

  // Create the loupe Leaflet map instance once
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

    L.tileLayer(
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

  // Keep loupe zoom synced with parent zoom + magnification offset
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

  // Sync event markers to the loupe map
  useEffect(() => {
    const map = loupeMapRef.current;
    if (!map) return;

    // Remove old markers
    if (markersLayerRef.current) {
      map.removeLayer(markersLayerRef.current);
    }

    const layerGroup = L.layerGroup();

    // Group events by location for jitter (same logic as parent)
    const locationGroups: Record<string, LoupeEventPoint[]> = {};
    displayEvents.forEach((event) => {
      const key = `${event.latitude.toFixed(4)}_${event.longitude.toFixed(4)}`;
      if (!locationGroups[key]) locationGroups[key] = [];
      locationGroups[key].push(event);
    });

    // Sort: lower levels first so higher levels render on top
    const sorted = [...displayEvents].sort((a, b) => a.level - b.level);

    sorted.forEach((event) => {
      const fillColor = getLevelColor(event.level);
      const borderColor = ENGAGEMENT_BORDERS[event.engagementState] || "#ffffff";
      const markerSize = 14;

      // Simple circle marker via divIcon (matches visual feel without full SVG shapes)
      const icon = L.divIcon({
        html: `<div style="
          width:${markerSize}px;height:${markerSize}px;
          border-radius:50%;
          background:${fillColor};
          border:2px solid ${borderColor};
          box-shadow:0 1px 3px rgba(0,0,0,0.3);
        "></div>`,
        className: "",
        iconSize: L.point(markerSize, markerSize),
        iconAnchor: L.point(markerSize / 2, markerSize / 2),
      });

      // Apply jitter for overlapping locations
      const locKey = `${event.latitude.toFixed(4)}_${event.longitude.toFixed(4)}`;
      const group = locationGroups[locKey] || [];
      let lat = event.latitude;
      let lng = event.longitude;

      if (group.length > 1) {
        const idx = group.findIndex(e => e.eventId === event.eventId);
        const jitterRadius = 0.0003;
        const angle = (2 * Math.PI * idx) / group.length;
        lat += jitterRadius * Math.sin(angle);
        lng += jitterRadius * Math.cos(angle);
      }

      const marker = L.marker([lat, lng], {
        icon,
        interactive: false,
        zIndexOffset: event.level * 100,
      });

      layerGroup.addLayer(marker);
    });

    markersLayerRef.current = layerGroup;
    map.addLayer(layerGroup);
  }, [displayEvents]);

  // Invalidate map size when the loupe size changes
  useEffect(() => {
    const timer = setTimeout(() => {
      loupeMapRef.current?.invalidateSize();
    }, 20);
    return () => clearTimeout(timer);
  }, [size]);

  // Track mouse over the map container → update cursor pos + loupe center
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      setCursorPos(null);
      return;
    }

    setCursorPos({ x: e.clientX, y: e.clientY });

    // Convert screen pixel → lat/lng → loupe center
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

  // Keyboard: 2/3/4 to switch magnification, Escape to exit
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

  const showLoupe = cursorPos !== null;

  return (
    <div
      style={{
        position: "fixed",
        left: showLoupe ? (cursorPos!.x - size / 2) : -9999,
        top: showLoupe ? (cursorPos!.y - size / 2) : -9999,
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        border: "3px solid hsl(var(--primary))",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.2)",
        zIndex: 10000,
        pointerEvents: "none",
      }}
    >
      {/* Actual Leaflet map container fills the circle */}
      <div
        ref={loupeContainerRef}
        style={{
          width: size,
          height: size,
        }}
      />

      {/* Crosshair overlay */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: 1,
          background: "rgba(0,0,0,0.15)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 1,
          background: "rgba(0,0,0,0.15)",
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
  );
}
