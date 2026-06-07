import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { supabase } from "@/integrations/supabase/client";
import { MapConfig } from "@/types/viralTemplates";
import { Lock, Hand, Loader2, MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Fix Leaflet default icon paths
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapHotspotRendererProps {
  campaignCode: string;
  config: MapConfig;
  width: number;  // pixels
  height: number; // pixels
  isEditorMode?: boolean;
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
  onMapReady?: (controls: MapControls) => void;
  onMapZoomChange?: (zoom: number) => void;
}

export interface MapControls {
  zoomIn: (delta?: number) => void;
  zoomOut: (delta?: number) => void;
  resetView: () => void;
  getZoom: () => number;
  getCenter: () => { lat: number; lng: number };
}


interface EventPoint {
  eventId: string;
  latitude: number;
  longitude: number;
  utmMedium: string;
  level: number;
  spawnCount?: number;
}

// Colors by share medium (utm_medium)
const MEDIUM_COLORS: Record<string, string> = {
  qr: "#000099",   // QR code - navy blue
  em: "#0066ff",   // email - medium blue
  sms: "#99ccff",  // text/SMS - light blue
  tx: "#99ccff",   // text alternate code - light blue
};

// Generate SVG for marker
const getMarkerSVG = (fillColor: string, size: number = 12, hasSpawns: boolean = false): string => {
  const strokeWidth = 2;
  const halfStroke = strokeWidth / 2;
  const strokeColor = hasSpawns ? "#22c55e" : "white";
  const r = (size / 2) - halfStroke;
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" 
      fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
  </svg>`;
};

const DEFAULT_COLOR = "#64748b"; // slate-500

// Resolve the CartoDB Positron tile URL based on label density preference.
// 'auto' hides labels on small displays (rendered width < 500px) and shows
// them otherwise. 'labels' / 'no_labels' force the choice.
function resolveTileUrl(
  labelDensity: 'auto' | 'labels' | 'no_labels' | undefined,
  width: number,
): string {
  const density = labelDensity ?? 'auto';
  const hideLabels =
    density === 'no_labels' || (density === 'auto' && width > 0 && width < 500);
  const slug = hideLabels ? 'light_nolabels' : 'light_all';
  return `https://{s}.basemaps.cartocdn.com/${slug}/{z}/{x}/{y}{r}.png`;
}

export function MapHotspotRenderer({
  campaignCode,
  config,
  width,
  height,
  isEditorMode = false,
  onBoundsChange,
  onMapReady,
  onMapZoomChange,
}: MapHotspotRendererProps) {

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [eventPoints, setEventPoints] = useState<EventPoint[]>([]);
  const [isInteractive, setIsInteractive] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  
  // Long-press detection
  const touchStartRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Store config in refs to avoid reinitializing the map
  const isEditorModeRef = useRef(isEditorMode);
  const savedBoundsRef = useRef(config.savedBounds);
  const showClusteringRef = useRef(config.showClustering ?? false);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Fetch event data for the campaign
  useEffect(() => {
    const fetchEvents = async () => {
      if (!campaignCode) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Get campaign ID from code
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("id")
          .eq("code", campaignCode)
          .maybeSingle();

        if (!campaign) {
          console.warn("MapHotspotRenderer: Campaign not found:", campaignCode);
          setLoading(false);
          return;
        }

        // Get EoAs for this campaign
        const { data: eoas } = await supabase
          .from("events_actions")
          .select("id")
          .eq("campaign_id", campaign.id);

        if (!eoas || eoas.length === 0) {
          setLoading(false);
          return;
        }

        const eoaIds = eoas.map((e) => e.id);

        // Get tokens for these EoAs
        const { data: tokens } = await supabase
          .from("tokens")
          .select("token, level, utm_medium")
          .in("eoa_id", eoaIds)
          .eq("is_simulated", false);

        if (!tokens || tokens.length === 0) {
          setLoading(false);
          return;
        }

        const tokenIds = tokens.map((t) => t.token);
        const tokenLookup = new Map(tokens.map((t) => [t.token, t]));

        // Get view events with coordinates
        const { data: events } = await supabase
          .from("url_events")
          .select("id, token, latitude, longitude, event_type")
          .in("token", tokenIds)
          .eq("event_type", "view")
          .eq("is_simulated", false)
          .not("latitude", "is", null)
          .not("longitude", "is", null);

        if (!events) {
          setLoading(false);
          return;
        }

        // Count spawns per L00 token
        const spawnCounts = new Map<string, number>();
        tokens.forEach((t) => {
          if (t.level === 0) {
            spawnCounts.set(t.token, 0);
          }
        });
        tokens.forEach((t) => {
          if (t.level > 0) {
            // This is a simplification - ideally we'd trace to root_token
            // For now, we'll mark L00s that have any children
          }
        });

        // Get spawn counts for L00 tokens
        const l00Tokens = tokens.filter((t) => t.level === 0).map((t) => t.token);
        if (l00Tokens.length > 0) {
          const { data: childTokens } = await supabase
            .from("tokens")
            .select("root_token")
            .in("root_token", l00Tokens)
            .gt("level", 0)
            .eq("is_simulated", false);

          if (childTokens) {
            childTokens.forEach((ct) => {
              if (ct.root_token) {
                spawnCounts.set(ct.root_token, (spawnCounts.get(ct.root_token) || 0) + 1);
              }
            });
          }
        }

        const points: EventPoint[] = events.map((e) => {
          const tokenData = tokenLookup.get(e.token);
          return {
            eventId: e.id,
            latitude: e.latitude!,
            longitude: e.longitude!,
            utmMedium: tokenData?.utm_medium || "qr",
            level: tokenData?.level || 0,
            spawnCount: spawnCounts.get(e.token) || 0,
          };
        });

        setEventPoints(points);
      } catch (error) {
        console.error("MapHotspotRenderer: Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [campaignCode]);

  // Update refs when config changes (without triggering map reinit)
  useEffect(() => {
    savedBoundsRef.current = config.savedBounds;
  }, [config.savedBounds]);
  
  useEffect(() => {
    isEditorModeRef.current = isEditorMode;
  }, [isEditorMode]);

  // Swap basemap tile layer when label density preference or rendered width
  // changes (auto mode hides labels on small displays).
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    const nextUrl = resolveTileUrl(config.labelDensity, width);
    const currentUrl = (tileLayerRef.current as any)._url as string | undefined;
    if (currentUrl === nextUrl) return;
    mapRef.current.removeLayer(tileLayerRef.current);
    const newLayer = L.tileLayer(nextUrl, { maxZoom: 19 }).addTo(mapRef.current);
    tileLayerRef.current = newLayer;
  }, [config.labelDensity, width]);

  // Initialize map ONCE - no dependencies to prevent reinit
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Use ref for initial editor mode value
    const initialEditorMode = isEditorModeRef.current;
    
    // In editor mode, enable interactivity by default
    const interactiveOptions = initialEditorMode ? {
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
    } : {
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    };

    const map = L.map(mapContainerRef.current, {
      center: [39.8283, -98.5795], // US center
      zoom: 4,
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0.1, // allow single-decimal fractional zoom (e.g. 4.1) for fine-tune buttons
      zoomDelta: 1,   // keep default +/- step at 1 for the main zoom buttons
      wheelPxPerZoomLevel: 60,
      ...interactiveOptions,
    });

    // CartoDB Positron tiles — initial URL respects labelDensity
    const tileLayer = L.tileLayer(resolveTileUrl(config.labelDensity, width), {
      maxZoom: 19,
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Apply saved bounds if configured (use ref for initial value)
    if (savedBoundsRef.current) {
      const { north, south, east, west } = savedBoundsRef.current;
      map.fitBounds([
        [south, west],
        [north, east],
      ]);
    }

    mapRef.current = map;

    // Always create BOTH layers - we'll toggle visibility
    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-slate-600 text-white text-xs font-bold border-2 border-white shadow-lg">${count}</div>`,
          className: "custom-cluster-icon",
          iconSize: L.point(32, 32),
        });
      },
    });
    clusterGroupRef.current = clusterGroup;
    
    const regularLayer = L.layerGroup();
    markersLayerRef.current = regularLayer;
    
    // Add BOTH layers to the map - they'll both have markers
    // The clustering toggle will just switch which one is visible
    map.addLayer(regularLayer);
    map.addLayer(clusterGroup);
    
    // Initially hide the clustering layer if not enabled
    if (!showClusteringRef.current) {
      map.removeLayer(clusterGroup);
    } else {
      map.removeLayer(regularLayer);
    }

    // Report bounds changes in editor mode
    if (initialEditorMode) {
      map.on("moveend", () => {
        // Use callback pattern to get fresh onBoundsChange
        const bounds = map.getBounds();
        // Store in a way that can be accessed
        (map as any)._lastBounds = {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        };
      });
    }

    // Force tile refresh after a short delay to ensure container is sized
    setTimeout(() => map.invalidateSize(), 50);
    setTimeout(() => map.invalidateSize(), 300);

    // Mark map as ready
    setMapReady(true);

    return () => {
      try {
        if (mapRef.current) {
          mapRef.current.off();
          if (mapContainerRef.current && mapContainerRef.current.parentNode) {
            mapRef.current.remove();
          }
        }
      } catch (e) {
        console.warn("MapHotspotRenderer: cleanup suppressed:", e);
      }
      mapRef.current = null;
      clusterGroupRef.current = null;
      markersLayerRef.current = null;
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - initialize ONCE only

  // Handle bounds change reporting when map moves
  useEffect(() => {
    if (!mapRef.current || !mapReady || !onBoundsChange) return;
    
    const map = mapRef.current;
    
    const handleMoveEnd = () => {
      const bounds = map.getBounds();
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    };
    
    // In editor mode, track all movements
    if (isEditorMode) {
      map.on("moveend", handleMoveEnd);
    }
    
    // Always report initial bounds (for capture mode too)
    setTimeout(handleMoveEnd, 100);
    
    return () => {
      if (isEditorMode) {
        map.off("moveend", handleMoveEnd);
      }
    };
  }, [mapReady, isEditorMode, onBoundsChange]);

  // Expose control functions (works in both editor and capture modes)
  useEffect(() => {
    if (!mapRef.current || !mapReady || !onMapReady) return;
    
    const map = mapRef.current;
    onMapReady({
      zoomIn: (delta = 1) => {
        const currentZoom = map.getZoom();
        map.setZoom(currentZoom + delta);
      },
      zoomOut: (delta = 1) => {
        const currentZoom = map.getZoom();
        map.setZoom(currentZoom - delta);
      },
      resetView: () => map.setView([39.8283, -98.5795], 4),
      getZoom: () => map.getZoom(),
    });
  }, [mapReady, onMapReady]);

  // Report zoom changes
  useEffect(() => {
    if (!mapRef.current || !mapReady || !onMapZoomChange) return;
    
    const map = mapRef.current;
    const handleZoom = () => onMapZoomChange(map.getZoom());
    
    // Report initial zoom
    handleZoom();
    
    map.on("zoomend", handleZoom);
    return () => { map.off("zoomend", handleZoom); };
  }, [mapReady, onMapZoomChange]);

  // Update map interactivity when isEditorMode changes (without reinit)
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    
    const map = mapRef.current;
    if (isEditorMode) {
      map.dragging.enable();
      map.touchZoom.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
    } else {
      map.dragging.disable();
      map.touchZoom.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
    }
  }, [isEditorMode, mapReady]);

  // Track whether bounds have been properly applied after a valid container size
  const boundsAppliedRef = useRef(false);

  // Invalidate map size when container dimensions change
  // On the FIRST valid resize, re-apply saved bounds to fix mobile initial render
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;
    map.invalidateSize();
    
    // Only re-apply saved bounds once (first time container has real dimensions)
    if (!boundsAppliedRef.current && width > 0 && height > 0 && savedBoundsRef.current) {
      boundsAppliedRef.current = true;
      const { north, south, east, west } = savedBoundsRef.current;
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
          mapRef.current.fitBounds([
            [south, west],
            [north, east],
          ]);
        }
      }, 50);
    }
  }, [width, height, mapReady]);

  // Toggle clustering layer without reinitializing the map
  useEffect(() => {
    if (!mapRef.current || !mapReady || !clusterGroupRef.current || !markersLayerRef.current) return;
    
    const map = mapRef.current;
    const clusterGroup = clusterGroupRef.current;
    const regularLayer = markersLayerRef.current;
    
    if (config.showClustering) {
      if (map.hasLayer(regularLayer)) map.removeLayer(regularLayer);
      if (!map.hasLayer(clusterGroup)) map.addLayer(clusterGroup);
    } else {
      if (map.hasLayer(clusterGroup)) map.removeLayer(clusterGroup);
      if (!map.hasLayer(regularLayer)) map.addLayer(regularLayer);
    }
  }, [config.showClustering, mapReady]);


  // Update map interactivity when runtime mode changes (separate from editor mode)
  useEffect(() => {
    if (!mapRef.current || !mapReady || isEditorMode) return;

    const map = mapRef.current;
    if (isInteractive) {
      map.dragging.enable();
      map.touchZoom.enable();
    } else {
      map.dragging.disable();
      map.touchZoom.disable();
    }
  }, [isInteractive, mapReady, isEditorMode]);

  // Render markers to BOTH layers (they swap visibility based on clustering toggle)
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const clusterGroup = clusterGroupRef.current;
    const regularLayer = markersLayerRef.current;
    
    if (!clusterGroup || !regularLayer) return;
    
    // Clear both layers
    clusterGroup.clearLayers();
    regularLayer.clearLayers();

    console.log(`MapHotspotRenderer: Rendering ${eventPoints.length} markers`);

    eventPoints.forEach((point) => {
      const color = MEDIUM_COLORS[point.utmMedium?.toLowerCase()] || DEFAULT_COLOR;
      const hasSpawns = (point.spawnCount || 0) > 0;
      const svgIcon = getMarkerSVG(color, 12, hasSpawns);

      const markerIcon = L.divIcon({
        html: svgIcon,
        className: "map-hotspot-marker",
        iconSize: L.point(12, 12),
        iconAnchor: L.point(6, 6),
      });

      // Add marker to both layers - only the active one will be visible
      const clusterMarker = L.marker([point.latitude, point.longitude], { icon: markerIcon });
      clusterGroup.addLayer(clusterMarker);
      
      const regularMarker = L.marker([point.latitude, point.longitude], { icon: markerIcon });
      regularLayer.addLayer(regularMarker);
    });
  }, [eventPoints, mapReady]);

  // Handle tap to zoom in
  const handleTap = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isInteractive || !mapRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      const map = mapRef.current;
      const container = mapContainerRef.current;
      if (!container) return;

      // Get tap position relative to map container
      let clientX: number, clientY: number;
      if ("touches" in e) {
        if (e.touches.length === 0) return;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const rect = container.getBoundingClientRect();
      const point = L.point(clientX - rect.left, clientY - rect.top);
      const latlng = map.containerPointToLatLng(point);

      // Zoom in one level centered on tap
      map.setView(latlng, map.getZoom() + 1);
    },
    [isInteractive]
  );

  // Handle long-press to zoom out
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isInteractive) return;

      const touch = e.touches[0];
      touchStartRef.current = {
        time: Date.now(),
        x: touch.clientX,
        y: touch.clientY,
      };

      longPressTimeoutRef.current = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.zoomOut();
        }
        touchStartRef.current = null;
      }, 500);
    },
    [isInteractive]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }

      // If it was a short tap, zoom in
      if (touchStartRef.current && Date.now() - touchStartRef.current.time < 500) {
        handleTap(e);
      }
      touchStartRef.current = null;
    },
    [handleTap]
  );

  const handleTouchMove = useCallback(() => {
    // Cancel long-press if user moves finger
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    touchStartRef.current = null;
  }, []);

  // Toggle interactive mode
  const toggleInteractive = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsInteractive((prev) => !prev);
  }, []);

  if (!campaignCode) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-muted/50 border-2 border-dashed border-muted-foreground/30 rounded-lg"
        style={{ width, height }}
      >
        <MapIcon className="w-8 h-8 text-muted-foreground mb-2" />
        <span className="text-sm text-muted-foreground">Select Campaign</span>
      </div>
    );
  }

  // In editor mode, always allow interaction
  const effectiveInteractive = isEditorMode || isInteractive;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg",
        effectiveInteractive && !isEditorMode && "ring-2 ring-blue-500"
      )}
      style={{ width, height }}
    >
      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ pointerEvents: effectiveInteractive ? "auto" : "none" }}
        onTouchStart={!isEditorMode ? handleTouchStart : undefined}
        onTouchEnd={!isEditorMode ? handleTouchEnd : undefined}
        onTouchMove={!isEditorMode ? handleTouchMove : undefined}
        onClick={!isEditorMode && effectiveInteractive ? handleTap : undefined}
      />

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Lock/Hand toggle button - only show in runtime mode, not editor */}
      {!isEditorMode && (
        <button
          type="button"
          onClick={toggleInteractive}
          className={cn(
            "absolute top-2 right-2 z-[1000] w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-colors",
            isInteractive
              ? "bg-blue-500 text-white"
              : "bg-white/90 text-muted-foreground hover:bg-white"
          )}
          title={isInteractive ? "Lock map (return to deck navigation)" : "Unlock map (enable pan/zoom)"}
        >
          {isInteractive ? <Hand className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
        </button>
      )}

      {/* Event count badge */}
      {eventPoints.length > 0 && (
        <div className="absolute bottom-2 left-2 z-[1000] px-2 py-1 bg-black/70 text-white text-xs rounded-full">
          {eventPoints.length} events
        </div>
      )}
    </div>
  );
}
