import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { EventStoryPanel } from "@/components/EventStoryPanel";

// Fix Leaflet default icon paths
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface SamizdatMapProps {
  eoaIds: string[];
}

interface EventPoint {
  eventId: string;
  eoaId: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  occurredAt: string;
  utmMedium: string;
  // New fields for chain visualization
  token: string;
  rootToken: string;
  parentToken: string | null;
  level: number;
}

interface ZipAggregate {
  zipCode: string;
  latitude: number;
  longitude: number;
  total: number;
  byMedium: Record<string, number>;
}

interface ViewportStats {
  medium: string;
  label: string;
  total: number;
  visible: number;
  offscreen: number;
  color: string;
}

// L00 event with spawn count for overview mode
interface L00EventWithCount {
  event: EventPoint;
  spawnCount: number;
  rootToken: string;
}

// Time window options for "time since go-live" filter
type TimeWindow = "0-1d" | "1-3d" | "3-5d" | "5-7d" | "all";

// View mode for the map
type ViewMode = "overview" | "chain";

const TIME_WINDOW_OPTIONS: { value: TimeWindow; label: string; minMs: number; maxMs: number }[] = [
  { value: "0-1d", label: "0–1 day", minMs: 0, maxMs: 24 * 60 * 60 * 1000 },
  { value: "1-3d", label: "1–3 days", minMs: 24 * 60 * 60 * 1000, maxMs: 3 * 24 * 60 * 60 * 1000 },
  { value: "3-5d", label: "3–5 days", minMs: 3 * 24 * 60 * 60 * 1000, maxMs: 5 * 24 * 60 * 60 * 1000 },
  { value: "5-7d", label: "5–7 days", minMs: 5 * 24 * 60 * 60 * 1000, maxMs: 7 * 24 * 60 * 60 * 1000 },
  { value: "all", label: "All (since go-live)", minMs: 0, maxMs: Infinity },
];

// Colors by share medium (utm_medium)
const MEDIUM_COLORS: Record<string, string> = {
  qr: "#000099",   // QR code - dark blue
  em: "#0066ff",   // email - medium blue
  sms: "#00cc66",  // text/SMS - green
  tx: "#00cc66",   // text alternate code - green
  fb: "#1877f2",   // Facebook - FB blue
  bs: "#0085ff",   // BlueSky - sky blue
};

const MEDIUM_LABELS: Record<string, string> = {
  qr: "QR Code",
  em: "Email",
  sms: "Text (SMS)",
  tx: "Text (SMS)",
  fb: "Facebook",
  bs: "BlueSky",
};

// Colors by level for chain mode
const LEVEL_COLORS: Record<number, string> = {
  0: "#3b82f6", // L00 - blue
  1: "#22c55e", // L01 - green
  2: "#f97316", // L02 - orange
  3: "#ef4444", // L03 - red
};

// Color scale for spawn count (virality heat)
const getSpawnCountColor = (count: number): string => {
  if (count === 0) return "#94a3b8"; // gray - no spawns
  if (count <= 5) return "#93c5fd"; // light blue
  if (count <= 20) return "#3b82f6"; // blue
  if (count <= 50) return "#f97316"; // orange
  return "#ef4444"; // red - hot
};

const DEFAULT_COLOR = "#64748b"; // slate-500

// Create chronological sequence numbers for all events
const createSequenceNumbers = (eventPoints: EventPoint[]): Map<string, number> => {
  const sorted = [...eventPoints].sort((a, b) => 
    new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );
  const seqMap = new Map<string, number>();
  sorted.forEach((event, index) => {
    seqMap.set(event.eventId, index + 1); // 1-based numbering
  });
  return seqMap;
};

const SamizdatMap = ({ eoaIds }: SamizdatMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const zipMarkersRef = useRef<L.Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventPoints, setEventPoints] = useState<EventPoint[]>([]);
  const [eoaNames, setEoaNames] = useState<Record<string, string>>({});
  const [eoaStartDates, setEoaStartDates] = useState<Record<string, string>>({});
  const [showZipCounts, setShowZipCounts] = useState(false);
  const [enableClustering, setEnableClustering] = useState(true);
  const [viewportStats, setViewportStats] = useState<ViewportStats[]>([]);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [enabledChannels, setEnabledChannels] = useState<Set<string>>(new Set(["qr", "em", "sms", "tx", "fb", "bs"]));
  
  // New state for L00 Overview / Chain drill-down
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [selectedRootToken, setSelectedRootToken] = useState<string | null>(null);

  // Toggle a channel on/off
  const toggleChannel = (medium: string) => {
    setEnabledChannels(prev => {
      const next = new Set(prev);
      if (next.has(medium)) {
        next.delete(medium);
      } else {
        next.add(medium);
      }
      return next;
    });
  };

  // Store eoaNames in ref for cluster popup access
  const eoaNamesRef = useRef(eoaNames);
  eoaNamesRef.current = eoaNames;

  // Filter events based on selected time window and enabled channels
  const filteredEventPoints = useMemo(() => {
    let filtered = eventPoints;

    // Filter by enabled channels
    filtered = filtered.filter(event => enabledChannels.has(event.utmMedium));

    // Filter by time window
    if (timeWindow !== "all") {
      const windowConfig = TIME_WINDOW_OPTIONS.find((w) => w.value === timeWindow);
      if (windowConfig) {
        filtered = filtered.filter((event) => {
          const startDateStr = eoaStartDates[event.eoaId];
          if (!startDateStr) return false;

          const startMatch = startDateStr.match(/^(\d{4})-(\d{2})-(\d{2})T?(\d{2})?:?(\d{2})?:?(\d{2})?/);
          const eventMatch = event.occurredAt.match(/^(\d{4})-(\d{2})-(\d{2})T?(\d{2})?:?(\d{2})?:?(\d{2})?/);
          
          if (!startMatch || !eventMatch) return false;

          const startDate = new Date(
            parseInt(startMatch[1]),
            parseInt(startMatch[2]) - 1,
            parseInt(startMatch[3]),
            parseInt(startMatch[4] || "0"),
            parseInt(startMatch[5] || "0"),
            parseInt(startMatch[6] || "0")
          );
          const eventDate = new Date(
            parseInt(eventMatch[1]),
            parseInt(eventMatch[2]) - 1,
            parseInt(eventMatch[3]),
            parseInt(eventMatch[4] || "0"),
            parseInt(eventMatch[5] || "0"),
            parseInt(eventMatch[6] || "0")
          );

          const diffMs = eventDate.getTime() - startDate.getTime();
          return diffMs >= windowConfig.minMs && diffMs < windowConfig.maxMs;
        });
      }
    }

    return filtered;
  }, [eventPoints, timeWindow, eoaStartDates, enabledChannels]);

  // L00 events with spawn counts for overview mode
  const l00EventsWithCounts = useMemo((): L00EventWithCount[] => {
    // Group by rootToken to get first L00 event and count spawns
    const rootMap = new Map<string, { l00Event: EventPoint | null; spawnCount: number }>();
    
    filteredEventPoints.forEach(ep => {
      if (!rootMap.has(ep.rootToken)) {
        rootMap.set(ep.rootToken, { l00Event: null, spawnCount: 0 });
      }
      const entry = rootMap.get(ep.rootToken)!;
      
      if (ep.level === 0) {
        // Take first L00 event by time
        if (!entry.l00Event || new Date(ep.occurredAt) < new Date(entry.l00Event.occurredAt)) {
          entry.l00Event = ep;
        }
      } else {
        // Count L01+ as spawns
        entry.spawnCount++;
      }
    });
    
    // Convert to array, only include entries with an L00 event
    const result: L00EventWithCount[] = [];
    rootMap.forEach((entry, rootToken) => {
      if (entry.l00Event) {
        result.push({
          event: entry.l00Event,
          spawnCount: entry.spawnCount,
          rootToken,
        });
      }
    });
    
    return result;
  }, [filteredEventPoints]);

  // Chain events for drill-down mode
  const chainEvents = useMemo((): EventPoint[] => {
    if (!selectedRootToken) return [];
    return filteredEventPoints.filter(ep => ep.rootToken === selectedRootToken);
  }, [filteredEventPoints, selectedRootToken]);

  // Calculate viewport stats based on all time-filtered events (before channel filter)
  // This ensures unchecked channels still show in the table
  const timeFilteredEvents = useMemo(() => {
    if (timeWindow === "all") return eventPoints;

    const windowConfig = TIME_WINDOW_OPTIONS.find((w) => w.value === timeWindow);
    if (!windowConfig) return eventPoints;

    return eventPoints.filter((event) => {
      const startDateStr = eoaStartDates[event.eoaId];
      if (!startDateStr) return false;

      const startMatch = startDateStr.match(/^(\d{4})-(\d{2})-(\d{2})T?(\d{2})?:?(\d{2})?:?(\d{2})?/);
      const eventMatch = event.occurredAt.match(/^(\d{4})-(\d{2})-(\d{2})T?(\d{2})?:?(\d{2})?:?(\d{2})?/);
      
      if (!startMatch || !eventMatch) return false;

      const startDate = new Date(
        parseInt(startMatch[1]),
        parseInt(startMatch[2]) - 1,
        parseInt(startMatch[3]),
        parseInt(startMatch[4] || "0"),
        parseInt(startMatch[5] || "0"),
        parseInt(startMatch[6] || "0")
      );
      const eventDate = new Date(
        parseInt(eventMatch[1]),
        parseInt(eventMatch[2]) - 1,
        parseInt(eventMatch[3]),
        parseInt(eventMatch[4] || "0"),
        parseInt(eventMatch[5] || "0"),
        parseInt(eventMatch[6] || "0")
      );

      const diffMs = eventDate.getTime() - startDate.getTime();
      return diffMs >= windowConfig.minMs && diffMs < windowConfig.maxMs;
    });
  }, [eventPoints, timeWindow, eoaStartDates]);

  // Calculate viewport stats using time-filtered events (all channels)
  const updateViewportStats = useCallback(() => {
    if (!mapRef.current || timeFilteredEvents.length === 0) {
      setViewportStats([]);
      return;
    }

    const bounds = mapRef.current.getBounds();
    
    // Group events by utm_medium and count visible/total
    const statsMap: Record<string, { total: number; visible: number }> = {};

    timeFilteredEvents.forEach((event) => {
      const medium = event.utmMedium || "unknown";
      if (!statsMap[medium]) {
        statsMap[medium] = { total: 0, visible: 0 };
      }
      statsMap[medium].total++;
      
      // Check if point is within current viewport bounds
      if (bounds.contains([event.latitude, event.longitude])) {
        statsMap[medium].visible++;
      }
    });

    // Convert to array with labels and colors
    const stats: ViewportStats[] = Object.entries(statsMap)
      .filter(([_, counts]) => counts.total > 0)
      .map(([medium, counts]) => ({
        medium,
        label: MEDIUM_LABELS[medium] || medium,
        total: counts.total,
        visible: counts.visible,
        offscreen: counts.total - counts.visible,
        color: MEDIUM_COLORS[medium] || DEFAULT_COLOR,
      }))
      .sort((a, b) => b.total - a.total); // Sort by total count descending

    setViewportStats(stats);
  }, [timeFilteredEvents]);

  // Fetch event-level data with token chain info
  useEffect(() => {
    const fetchEventData = async () => {
      if (!eoaIds.length) {
        setEventPoints([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Step 1: Get EoA start dates and names
      const { data: eoas, error: eoasError } = await supabase
        .from("events_actions")
        .select("id, start_date, title")
        .in("id", eoaIds);

      if (eoasError || !eoas?.length) {
        console.log("No EoAs found:", eoaIds);
        setEventPoints([]);
        setLoading(false);
        return;
      }

      const startDates: Record<string, string> = {};
      const names: Record<string, string> = {};
      eoas.forEach((eoa) => {
        if (eoa.start_date) {
          startDates[eoa.id] = eoa.start_date;
        }
        names[eoa.id] = eoa.title || eoa.id.slice(0, 8);
      });
      setEoaNames(names);
      setEoaStartDates(startDates);

      // Step 2: Get tokens for selected EoAs (include chain fields)
      const { data: tokens, error: tokensError } = await supabase
        .from("tokens")
        .select("token, eoa_id, utm_medium, root_token, parent_token, level")
        .in("eoa_id", eoaIds)
        .eq("is_simulated", false);

      if (tokensError || !tokens?.length) {
        console.log("No tokens found for EoAs:", eoaIds);
        setEventPoints([]);
        setLoading(false);
        return;
      }

      const tokenList = tokens.map((t) => t.token);
      const tokenData: Record<string, { 
        eoaId: string; 
        utmMedium: string; 
        rootToken: string; 
        parentToken: string | null; 
        level: number 
      }> = {};
      tokens.forEach((t) => {
        tokenData[t.token] = {
          eoaId: t.eoa_id,
          utmMedium: t.utm_medium || "unknown",
          rootToken: t.root_token || t.token, // L00 tokens have themselves as root
          parentToken: t.parent_token,
          level: t.level,
        };
      });

      // Step 3: Get ALL view events (no deduplication)
      const { data: events, error: eventsError } = await supabase
        .from("url_events")
        .select("id, token, zip_code, occurred_at")
        .in("token", tokenList)
        .eq("event_type", "view")
        .eq("is_simulated", false)
        .not("zip_code", "is", null);

      if (eventsError || !events?.length) {
        console.log("No view events with zip codes found");
        setEventPoints([]);
        setLoading(false);
        return;
      }

      // Step 4: Get unique ZIP codes for coordinate lookup
      const uniqueZips = [...new Set(events.map((e) => e.zip_code).filter(Boolean))] as string[];

      const { data: zipData, error: zipError } = await supabase
        .from("zip_codes")
        .select("zip_code, latitude, longitude")
        .in("zip_code", uniqueZips);

      if (zipError || !zipData?.length) {
        console.error("Error fetching zip coordinates:", zipError);
        setEventPoints([]);
        setLoading(false);
        return;
      }

      const zipCoords: Record<string, { lat: number; lng: number }> = {};
      zipData.forEach((z) => {
        zipCoords[z.zip_code] = { lat: z.latitude, lng: z.longitude };
      });

      // Step 5: Build event points with chain info, filtering by start_date
      const points: EventPoint[] = [];
      events.forEach((event) => {
        const td = tokenData[event.token];
        if (!td) return;
        
        const startDate = startDates[td.eoaId];
        const coords = zipCoords[event.zip_code!];

        // Skip if no coordinates for this ZIP
        if (!coords) return;

        // Filter: only include events after EoA start_date
        if (startDate && new Date(event.occurred_at) < new Date(startDate)) {
          return;
        }

        points.push({
          eventId: event.id,
          eoaId: td.eoaId,
          zipCode: event.zip_code!,
          latitude: coords.lat,
          longitude: coords.lng,
          occurredAt: event.occurred_at,
          utmMedium: td.utmMedium,
          token: event.token,
          rootToken: td.rootToken,
          parentToken: td.parentToken,
          level: td.level,
        });
      });

      setEventPoints(points);
      setLoading(false);
    };

    fetchEventData();
  }, [eoaIds]);

  // Store updateViewportStats in a ref to avoid map recreation
  const updateViewportStatsRef = useRef(updateViewportStats);
  updateViewportStatsRef.current = updateViewportStats;

  // Initialize map - only once, no dependencies that would cause recreation
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [39.8283, -98.5795], // US center
      zoom: 4,
      zoomControl: true,
    });

    // CartoDB Positron tiles (light, minimal style)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Listen for map movement to update viewport stats (use ref to get latest callback)
    const handleMoveEnd = () => updateViewportStatsRef.current();
    mapRef.current.on("moveend", handleMoveEnd);
    mapRef.current.on("zoomend", handleMoveEnd);

    return () => {
      if (mapRef.current) {
        mapRef.current.off("moveend", handleMoveEnd);
        mapRef.current.off("zoomend", handleMoveEnd);
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Empty deps - map initializes once

  // Update viewport stats when time-filtered events change
  useEffect(() => {
    updateViewportStats();
  }, [timeFilteredEvents, updateViewportStats]);

  // Calculate sequence numbers for chain mode (chronological ordering)
  const chainSequenceNumbers = useMemo(() => {
    return createSequenceNumbers(chainEvents);
  }, [chainEvents]);

  // Handle back to overview
  const handleBackToOverview = useCallback(() => {
    setViewMode("overview");
    setSelectedRootToken(null);
    setSelectedEventId(null);
  }, []);

  // Handle L00 marker click - drill down into chain
  const handleL00Click = useCallback((rootToken: string) => {
    setSelectedRootToken(rootToken);
    setViewMode("chain");
    setSelectedEventId(null);
  }, []);

  // Update markers based on view mode
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing layers
    if (clusterGroupRef.current) {
      mapRef.current.removeLayer(clusterGroupRef.current);
      clusterGroupRef.current = null;
    }
    if (markersLayerRef.current) {
      mapRef.current.removeLayer(markersLayerRef.current);
      markersLayerRef.current = null;
    }

    if (viewMode === "overview") {
      // OVERVIEW MODE: Show L00 events colored by spawn count
      if (l00EventsWithCounts.length === 0) return;

      if (enableClustering) {
        // Use clustering for overview
        const clusterGroup = L.markerClusterGroup({
          maxClusterRadius: 50,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          iconCreateFunction: (cluster) => {
            const count = cluster.getChildCount();
            // Sum up spawn counts for popup
            const markers = cluster.getAllChildMarkers();
            let totalSpawns = 0;
            markers.forEach((m) => {
              totalSpawns += (m as any).spawnCount || 0;
            });
            
            const popupContent = `
              <div style="font-family:system-ui;font-size:13px;line-height:1.4;">
                <div style="font-weight:600;margin-bottom:4px;">${count} origin events</div>
                <div>Total spawns: ${totalSpawns}</div>
              </div>
            `;
            (cluster as any).popupContent = popupContent;

            return L.divIcon({
              html: `<div class="samizdat-cluster">${count}</div>`,
              className: "samizdat-cluster-icon",
              iconSize: L.point(40, 40),
            });
          },
        });

        clusterGroup.on("clusterclick", (e: any) => {
          const cluster = e.layer;
          if (cluster.popupContent) {
            L.popup()
              .setLatLng(cluster.getLatLng())
              .setContent(cluster.popupContent)
              .openOn(mapRef.current!);
          }
        });

        l00EventsWithCounts.forEach(({ event, spawnCount, rootToken }) => {
          const fillColor = getSpawnCountColor(spawnCount);
          
          const dotIcon = L.divIcon({
            html: `
              <div style="position:relative;">
                <div style="
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  background: ${fillColor};
                  border: 2px solid white;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                  cursor: pointer;
                "></div>
                ${spawnCount > 0 ? `
                <div style="
                  position: absolute;
                  top: -8px;
                  left: 12px;
                  background: #1e293b;
                  color: white;
                  font-size: 10px;
                  font-weight: 600;
                  min-width: 18px;
                  height: 18px;
                  border-radius: 9px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 0 4px;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                  font-family: system-ui;
                ">${spawnCount}</div>
                ` : ''}
              </div>
            `,
            className: "samizdat-l00-icon",
            iconSize: L.point(spawnCount > 0 ? 34 : 16, spawnCount > 0 ? 26 : 16),
            iconAnchor: L.point(8, 8),
          });

          const marker = L.marker([event.latitude, event.longitude], { icon: dotIcon });
          (marker as any).spawnCount = spawnCount;
          (marker as any).rootToken = rootToken;
          
          marker.on('click', () => {
            handleL00Click(rootToken);
          });
          
          clusterGroup.addLayer(marker);
        });

        clusterGroupRef.current = clusterGroup;
        mapRef.current.addLayer(clusterGroup);
      } else {
        // No clustering - show individual L00 markers
        const layerGroup = L.layerGroup();

        l00EventsWithCounts.forEach(({ event, spawnCount, rootToken }) => {
          const fillColor = getSpawnCountColor(spawnCount);
          
          const dotIcon = L.divIcon({
            html: `
              <div style="position:relative;">
                <div style="
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  background: ${fillColor};
                  border: 2px solid white;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                  cursor: pointer;
                "></div>
                ${spawnCount > 0 ? `
                <div style="
                  position: absolute;
                  top: -8px;
                  left: 12px;
                  background: #1e293b;
                  color: white;
                  font-size: 10px;
                  font-weight: 600;
                  min-width: 18px;
                  height: 18px;
                  border-radius: 9px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 0 4px;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                  font-family: system-ui;
                ">${spawnCount}</div>
                ` : ''}
              </div>
            `,
            className: "samizdat-l00-icon",
            iconSize: L.point(spawnCount > 0 ? 34 : 16, spawnCount > 0 ? 26 : 16),
            iconAnchor: L.point(8, 8),
          });

          const marker = L.marker([event.latitude, event.longitude], { icon: dotIcon });
          
          marker.on('click', () => {
            handleL00Click(rootToken);
          });
          
          layerGroup.addLayer(marker);
        });

        markersLayerRef.current = layerGroup;
        mapRef.current.addLayer(layerGroup);
      }
    } else {
      // CHAIN MODE: Show all events for selected chain, colored by level
      if (chainEvents.length === 0) return;

      const layerGroup = L.layerGroup();

      chainEvents.forEach((event) => {
        const fillColor = LEVEL_COLORS[event.level] || DEFAULT_COLOR;
        const seqNum = chainSequenceNumbers.get(event.eventId) || 0;
        const levelLabel = `L${String(event.level).padStart(2, '0')}`;
        
        const dotIcon = L.divIcon({
          html: `
            <div style="position:relative;">
              <div style="
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: ${fillColor};
                border: 2px solid white;
                box-shadow: 0 1px 4px rgba(0,0,0,0.3);
              "></div>
              <div style="
                position: absolute;
                top: -10px;
                left: 10px;
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
              <div style="
                position: absolute;
                top: 14px;
                left: -3px;
                font-size: 8px;
                color: ${fillColor};
                font-weight: 700;
                font-family: system-ui;
                text-shadow: 0 0 2px white, 0 0 2px white;
              ">${levelLabel}</div>
            </div>
          `,
          className: "samizdat-chain-icon",
          iconSize: L.point(30, 30),
          iconAnchor: L.point(7, 14),
        });

        const marker = L.marker([event.latitude, event.longitude], { icon: dotIcon });
        
        marker.on('click', () => {
          setSelectedEventId(event.eventId);
        });
        
        layerGroup.addLayer(marker);
      });

      markersLayerRef.current = layerGroup;
      mapRef.current.addLayer(layerGroup);
    }
  }, [viewMode, l00EventsWithCounts, chainEvents, chainSequenceNumbers, enableClustering, handleL00Click]);

  // ZIP count overlay markers (uses filtered events based on mode)
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing ZIP count markers
    zipMarkersRef.current.forEach((marker) => marker.remove());
    zipMarkersRef.current = [];

    const eventsToShow = viewMode === "overview" 
      ? l00EventsWithCounts.map(e => e.event)
      : chainEvents;

    if (!showZipCounts || eventsToShow.length === 0) return;

    // Aggregate events by ZIP code
    const zipAggregates: Record<string, ZipAggregate> = {};
    eventsToShow.forEach((event) => {
      if (!zipAggregates[event.zipCode]) {
        zipAggregates[event.zipCode] = {
          zipCode: event.zipCode,
          latitude: event.latitude,
          longitude: event.longitude,
          total: 0,
          byMedium: {},
        };
      }
      zipAggregates[event.zipCode].total++;
      zipAggregates[event.zipCode].byMedium[event.utmMedium] = 
        (zipAggregates[event.zipCode].byMedium[event.utmMedium] || 0) + 1;
    });

    // Create ZIP count markers with tooltips
    Object.values(zipAggregates).forEach((agg) => {
      // Build medium breakdown HTML
      const breakdownLines = Object.entries(agg.byMedium)
        .map(([medium, count]) => {
          const label = MEDIUM_LABELS[medium] || medium;
          const color = MEDIUM_COLORS[medium] || DEFAULT_COLOR;
          return `<div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;"></span>${label}: ${count}</div>`;
        })
        .join("");

      const tooltipContent = `
        <div style="font-family:system-ui;font-size:13px;line-height:1.4;">
          <div style="font-weight:600;margin-bottom:4px;">ZIP ${agg.zipCode}</div>
          <div style="margin-bottom:6px;">Events: ${agg.total}</div>
          <div style="border-top:1px solid #e2e8f0;padding-top:6px;">
            ${breakdownLines}
          </div>
        </div>
      `;

      // Create a DivIcon with the count number
      const countIcon = L.divIcon({
        className: "zip-count-marker",
        html: `<div style="
          background:#1e293b;
          color:white;
          border-radius:9999px;
          min-width:24px;
          height:24px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:11px;
          font-weight:600;
          padding:0 6px;
          box-shadow:0 2px 4px rgba(0,0,0,0.2);
          cursor:pointer;
        ">${agg.total}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([agg.latitude, agg.longitude], {
        icon: countIcon,
        zIndexOffset: 1000, // Above event markers
      }).addTo(mapRef.current!);

      marker.bindTooltip(tooltipContent, {
        permanent: false,
        direction: "top",
        offset: [0, -12],
        className: "zip-count-tooltip",
      });

      zipMarkersRef.current.push(marker);
    });
  }, [showZipCounts, viewMode, l00EventsWithCounts, chainEvents]);

  return (
    <div className="space-y-4">
      {/* Collapsible Controls */}
      <Accordion type="multiple" defaultValue={["time-filter"]} className="space-y-2">
        {/* Time since go-live filter */}
        <AccordionItem value="time-filter" className="rounded-lg border border-border bg-card px-4">
          <AccordionTrigger className="text-sm font-medium py-3 hover:no-underline">
            Time since go-live
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-2 pb-3">
              {TIME_WINDOW_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={timeWindow === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeWindow(option.value)}
                  className="text-xs"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Viewport Activity Report - by share medium with filter checkboxes */}
        {viewportStats.length > 0 && (
          <AccordionItem value="viewport-report" className="rounded-lg border border-border bg-card">
            <AccordionTrigger className="text-sm font-medium px-4 py-3 hover:no-underline">
              Activity by Share Channel
            </AccordionTrigger>
            <AccordionContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">Show</TableHead>
                    <TableHead className="w-[120px]">Channel</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Visible</TableHead>
                    <TableHead className="text-right">Offscreen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewportStats.map((stat) => (
                    <TableRow key={stat.medium}>
                      <TableCell>
                        <Checkbox
                          checked={enabledChannels.has(stat.medium)}
                          onCheckedChange={() => toggleChannel(stat.medium)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: stat.color }}
                          />
                          <span className="truncate">{stat.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{stat.total}</TableCell>
                      <TableCell className="text-right tabular-nums">{stat.visible}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {stat.offscreen}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Map + Panel container */}
      <div className="flex rounded-lg overflow-hidden border border-border" style={{ height: '600px' }}>
        {/* Map container - shrinks when panel is open */}
        <div className="relative flex-1 min-w-0">
          {/* Mode indicator and back button for chain mode */}
          {viewMode === "chain" && (
            <div className="absolute top-3 left-3 z-[1000] bg-background/95 backdrop-blur-sm rounded-md px-3 py-2 shadow-md border border-border">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToOverview}
                  className="h-7 px-2"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Overview
                </Button>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{chainEvents.length}</span> events in chain
                </div>
              </div>
              {/* Level legend */}
              <div className="flex gap-3 mt-2 pt-2 border-t border-border">
                {Object.entries(LEVEL_COLORS).map(([level, color]) => (
                  <div key={level} className="flex items-center gap-1.5 text-xs">
                    <span 
                      className="w-2.5 h-2.5 rounded-full" 
                      style={{ backgroundColor: color }}
                    />
                    <span>L{String(level).padStart(2, '0')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overview mode legend */}
          {viewMode === "overview" && l00EventsWithCounts.length > 0 && (
            <div className="absolute bottom-3 left-3 z-[1000] bg-background/95 backdrop-blur-sm rounded-md px-3 py-2 shadow-md border border-border">
              <div className="text-xs font-medium mb-2">Spawns from origin</div>
              <div className="flex gap-2">
                {[
                  { label: "0", color: getSpawnCountColor(0) },
                  { label: "1-5", color: getSpawnCountColor(3) },
                  { label: "6-20", color: getSpawnCountColor(10) },
                  { label: "21-50", color: getSpawnCountColor(30) },
                  { label: "51+", color: getSpawnCountColor(100) },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1 text-xs">
                    <span 
                      className="w-2.5 h-2.5 rounded-full" 
                      style={{ backgroundColor: color }}
                    />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Map controls */}
          <div className="absolute top-3 right-3 z-[1000] bg-background/90 backdrop-blur-sm rounded-md px-3 py-2 flex flex-col gap-2 shadow-sm border border-border">
            {viewMode === "overview" && (
              <div className="flex items-center gap-2">
                <Switch
                  id="clustering"
                  checked={enableClustering}
                  onCheckedChange={setEnableClustering}
                />
                <Label htmlFor="clustering" className="text-sm cursor-pointer">
                  Clustering
                </Label>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                id="zip-counts"
                checked={showZipCounts}
                onCheckedChange={setShowZipCounts}
              />
              <Label htmlFor="zip-counts" className="text-sm cursor-pointer">
                Show ZIP counts
              </Label>
            </div>
          </div>

          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <div ref={mapContainerRef} className="w-full h-full" />
          {!loading && filteredEventPoints.length === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
              <p className="text-muted-foreground">
                {eventPoints.length === 0 
                  ? "No activation events found for selected EoAs" 
                  : "No events in selected time window"}
              </p>
            </div>
          )}

          {/* Custom styles */}
          <style>{`
            .zip-count-tooltip {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 8px 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .zip-count-tooltip::before {
              border-top-color: #e2e8f0 !important;
            }
            /* Neutral cluster styling */
            .samizdat-cluster-icon {
              background: transparent !important;
            }
            .samizdat-cluster {
              width: 40px;
              height: 40px;
              background: #475569;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 13px;
              font-weight: 600;
              box-shadow: 0 2px 8px rgba(0,0,0,0.25);
              border: 2px solid rgba(255,255,255,0.3);
            }
            .samizdat-l00-icon,
            .samizdat-chain-icon {
              background: transparent !important;
              border: none !important;
              cursor: pointer;
              transition: transform 0.15s ease;
            }
            .samizdat-l00-icon:hover,
            .samizdat-chain-icon:hover {
              transform: scale(1.2);
            }
            .samizdat-l00-icon > div,
            .samizdat-chain-icon > div {
              cursor: pointer;
            }
            /* Override default markercluster styles */
            .marker-cluster-small,
            .marker-cluster-medium,
            .marker-cluster-large {
              background-color: rgba(71, 85, 105, 0.6) !important;
            }
            .marker-cluster-small div,
            .marker-cluster-medium div,
            .marker-cluster-large div {
              background-color: #475569 !important;
              color: white !important;
            }
          `}</style>
        </div>

        {/* Event Story Panel - inline, shrinks the map */}
        {selectedEventId && (
          <EventStoryPanel
            eventId={selectedEventId}
            onClose={() => setSelectedEventId(null)}
          />
        )}
      </div>
    </div>
  );
};

export default SamizdatMap;
