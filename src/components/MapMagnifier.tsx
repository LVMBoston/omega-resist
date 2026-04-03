import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const MAGNIFICATION_PRESETS: Record<number, { size: number }> = {
  2: { size: 180 },
  3: { size: 260 },
  4: { size: 340 },
};

// Engagement border colors (mirrors SamizdatMap)
type EngagementState = "none" | "intent" | "completed";

const ENGAGEMENT_BORDER_COLORS: Record<EngagementState, string> = {
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

type EoaShape = "circle" | "square" | "triangle";

const getShareMediumShape = (utmMedium: string): EoaShape => {
  if (!utmMedium) return "circle";
  const medium = utmMedium.toLowerCase();
  if (medium === "qr") return "circle";
  if (medium === "em") return "square";
  if (medium === "sms") return "triangle";
  return "circle";
};

const getShapeSVG = (shape: EoaShape, fillColor: string, size: number, engagementState: EngagementState = "none"): string => {
  const strokeWidth = 2;
  const halfStroke = strokeWidth / 2;
  const strokeColor = ENGAGEMENT_BORDER_COLORS[engagementState];

  switch (shape) {
    case "square":
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${halfStroke}" y="${halfStroke}" width="${size - strokeWidth}" height="${size - strokeWidth}" 
          fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" rx="2"/>
      </svg>`;
    case "triangle": {
      const cx = size / 2;
      const topY = halfStroke;
      const bottomY = size - halfStroke;
      const leftX = halfStroke;
      const rightX = size - halfStroke;
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <polygon points="${cx},${topY} ${rightX},${bottomY} ${leftX},${bottomY}" 
          fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
      </svg>`;
    }
    case "circle":
    default: {
      const r = (size / 2) - halfStroke;
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" 
          fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
      </svg>`;
    }
  }
};

export interface LoupeEventPoint {
  eventId: string;
  latitude: number;
  longitude: number;
  level: number;
  engagementState: string;
  utmMedium: string;
  occurredAt?: string;
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

  // Build sequence numbers (chronological order)
  const sequenceNumbers = useMemo(() => {
    if (!displayEvents.length) return new Map<string, number>();
    const sorted = [...displayEvents].sort((a, b) => {
      const tA = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
      const tB = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
      return tA - tB;
    });
    const seqMap = new Map<string, number>();
    sorted.forEach((event, index) => {
      seqMap.set(event.eventId, index + 1);
    });
    return seqMap;
  }, [displayEvents]);

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
      map.setZoom(parentZoom + magnification, { animate: false });
    };

    syncZoom();
    parentMap.on("zoom", syncZoom);
    return () => { parentMap.off("zoom", syncZoom); };
  }, [parentMap, magnification]);

  // Sync event markers to the loupe map using full SVG shapes
  useEffect(() => {
    const map = loupeMapRef.current;
    if (!map) return;

    if (markersLayerRef.current) {
      map.removeLayer(markersLayerRef.current);
    }

    const layerGroup = L.layerGroup();

    // Group events by location for jitter
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
      const shape = getShareMediumShape(event.utmMedium);
      const engagement = (event.engagementState || "none") as EngagementState;
      const markerSize = 16;
      const shapeSVG = getShapeSVG(shape, fillColor, markerSize, engagement);
      const levelLabel = `L${String(event.level).padStart(2, '0')}`;
      const seqNum = sequenceNumbers.get(event.eventId);

      const icon = L.divIcon({
        html: `
          <div style="position:relative;">
            <div style="
              width: ${markerSize}px;
              height: ${markerSize}px;
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
            ">${shapeSVG}</div>
            ${seqNum ? `
            <div style="
              position: absolute;
              top: -10px;
              left: 12px;
              background: #1e293b;
              color: white;
              font-size: 9px;
              font-weight: 600;
              min-width: 16px;
              height: 16px;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0 3px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              font-family: system-ui;
            ">${seqNum}</div>
            ` : ''}
            <div style="
              position: absolute;
              top: ${markerSize}px;
              left: -3px;
              font-size: 8px;
              color: ${fillColor};
              font-weight: 700;
              font-family: system-ui;
              text-shadow: 0 0 2px white, 0 0 2px white;
            ">${levelLabel}</div>
          </div>
        `,
        className: "samizdat-event-icon",
        iconSize: L.point(seqNum ? 32 : 16, 28),
        iconAnchor: L.point(8, 8),
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
  }, [displayEvents, sequenceNumbers]);

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
