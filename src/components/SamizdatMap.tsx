import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
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

// Time window options for "time since go-live" filter
type TimeWindow = "0-1d" | "1-3d" | "3-5d" | "5-7d" | "all";

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

const DEFAULT_COLOR = "#64748b"; // slate-500

const SamizdatMap = ({ eoaIds }: SamizdatMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
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

  // Store eoaNames in ref for cluster popup access
  const eoaNamesRef = useRef(eoaNames);
  eoaNamesRef.current = eoaNames;

  // Filter events based on selected time window
  const filteredEventPoints = useMemo(() => {
    if (timeWindow === "all") return eventPoints;

    const windowConfig = TIME_WINDOW_OPTIONS.find((w) => w.value === timeWindow);
    if (!windowConfig) return eventPoints;

    return eventPoints.filter((event) => {
      const startDateStr = eoaStartDates[event.eoaId];
      if (!startDateStr) return false; // No start date, exclude

      // Parse floating local time: extract wall-clock components directly
      const startMatch = startDateStr.match(/^(\d{4})-(\d{2})-(\d{2})T?(\d{2})?:?(\d{2})?:?(\d{2})?/);
      const eventMatch = event.occurredAt.match(/^(\d{4})-(\d{2})-(\d{2})T?(\d{2})?:?(\d{2})?:?(\d{2})?/);
      
      if (!startMatch || !eventMatch) return false;

      // Create dates from wall-clock components (treating them as local time for comparison)
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

  // Calculate viewport stats based on current map bounds (uses filtered events)
  const updateViewportStats = useCallback(() => {
    if (!mapRef.current || filteredEventPoints.length === 0) {
      setViewportStats([]);
      return;
    }

    const bounds = mapRef.current.getBounds();
    
    // Group events by utm_medium and count visible/total
    const statsMap: Record<string, { total: number; visible: number }> = {};

    filteredEventPoints.forEach((event) => {
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
  }, [filteredEventPoints]);

  // Fetch event-level data (no aggregation)
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

      // Step 2: Get tokens for selected EoAs (include utm_medium)
      const { data: tokens, error: tokensError } = await supabase
        .from("tokens")
        .select("token, eoa_id, utm_medium")
        .in("eoa_id", eoaIds)
        .eq("is_simulated", false);

      if (tokensError || !tokens?.length) {
        console.log("No tokens found for EoAs:", eoaIds);
        setEventPoints([]);
        setLoading(false);
        return;
      }

      const tokenList = tokens.map((t) => t.token);
      const tokenToEoa: Record<string, string> = {};
      const tokenToMedium: Record<string, string> = {};
      tokens.forEach((t) => {
        tokenToEoa[t.token] = t.eoa_id;
        tokenToMedium[t.token] = t.utm_medium || "unknown";
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

      // Step 5: Build event points, filtering by start_date (basic go-live filter)
      const points: EventPoint[] = [];
      events.forEach((event) => {
        const eoaId = tokenToEoa[event.token];
        const startDate = startDates[eoaId];
        const coords = zipCoords[event.zip_code!];

        // Skip if no coordinates for this ZIP
        if (!coords) return;

        // Filter: only include events after EoA start_date
        if (startDate && new Date(event.occurred_at) < new Date(startDate)) {
          return;
        }

        points.push({
          eventId: event.id,
          eoaId,
          zipCode: event.zip_code!,
          latitude: coords.lat,
          longitude: coords.lng,
          occurredAt: event.occurred_at,
          utmMedium: tokenToMedium[event.token] || "unknown",
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

  // Update viewport stats when filtered events change
  useEffect(() => {
    updateViewportStats();
  }, [filteredEventPoints, updateViewportStats]);

  // Update markers when filtered data or clustering toggle changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing cluster group if present
    if (clusterGroupRef.current) {
      mapRef.current.removeLayer(clusterGroupRef.current);
      clusterGroupRef.current = null;
    }

    if (filteredEventPoints.length === 0) return;

    // Create cluster group with custom icon creator
    const clusterGroup = L.markerClusterGroup({
      disableClusteringAtZoom: enableClustering ? undefined : 0, // Disable clustering when toggle is off
      maxClusterRadius: enableClustering ? 50 : 0,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        // Build medium breakdown for popup
        const markers = cluster.getAllChildMarkers();
        const mediumCounts: Record<string, number> = {};
        markers.forEach((m) => {
          const medium = (m as any).utmMedium || "unknown";
          mediumCounts[medium] = (mediumCounts[medium] || 0) + 1;
        });
        
        // Build breakdown HTML for popup
        const breakdownLines = Object.entries(mediumCounts)
          .map(([medium, cnt]) => {
            const label = MEDIUM_LABELS[medium] || medium;
            const color = MEDIUM_COLORS[medium] || DEFAULT_COLOR;
            return `<div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;"></span>${label}: ${cnt}</div>`;
          })
          .join("");
        
        const popupContent = `
          <div style="font-family:system-ui;font-size:13px;line-height:1.4;">
            <div style="font-weight:600;margin-bottom:4px;">Cluster: ${count} activations</div>
            <div style="border-top:1px solid #e2e8f0;padding-top:6px;">
              ${breakdownLines}
            </div>
          </div>
        `;
        
        // Store popup content on cluster for later binding
        (cluster as any).popupContent = popupContent;

        // Neutral, calm cluster styling
        return L.divIcon({
          html: `<div class="samizdat-cluster">${count}</div>`,
          className: "samizdat-cluster-icon",
          iconSize: L.point(40, 40),
        });
      },
    });

    // Add popup to clusters on click
    clusterGroup.on("clusterclick", (e: any) => {
      const cluster = e.layer;
      if (cluster.popupContent) {
        L.popup()
          .setLatLng(cluster.getLatLng())
          .setContent(cluster.popupContent)
          .openOn(mapRef.current!);
      }
    });

    // Add individual markers with colored divIcons based on utm_medium
    filteredEventPoints.forEach((event) => {
      const fillColor = MEDIUM_COLORS[event.utmMedium] || DEFAULT_COLOR;
      
      const dotIcon = L.divIcon({
        html: `<div style="
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${fillColor};
          border: 1px solid rgba(0,0,0,0.2);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        "></div>`,
        className: "samizdat-dot-icon",
        iconSize: L.point(12, 12),
        iconAnchor: L.point(6, 6),
      });

      const marker = L.marker([event.latitude, event.longitude], { icon: dotIcon });
      // Store utmMedium and eventId for reference
      (marker as any).utmMedium = event.utmMedium;
      (marker as any).eventId = event.eventId;
      
      // Add click handler to open Event Story dialog
      marker.on('click', () => {
        setSelectedEventId(event.eventId);
      });
      
      clusterGroup.addLayer(marker);
    });

    clusterGroupRef.current = clusterGroup;
    mapRef.current.addLayer(clusterGroup);

    // User controls zoom - no auto-fitting
  }, [filteredEventPoints, enableClustering]);

  // ZIP count overlay markers (uses filtered events)
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing ZIP count markers
    zipMarkersRef.current.forEach((marker) => marker.remove());
    zipMarkersRef.current = [];

    if (!showZipCounts || filteredEventPoints.length === 0) return;

    // Aggregate filtered events by ZIP code
    const zipAggregates: Record<string, ZipAggregate> = {};
    filteredEventPoints.forEach((event) => {
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
          <div style="margin-bottom:6px;">Activations: ${agg.total}</div>
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
  }, [showZipCounts, filteredEventPoints]);

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

        {/* Viewport Activity Report - by share medium */}
        {viewportStats.length > 0 && (
          <AccordionItem value="viewport-report" className="rounded-lg border border-border bg-card">
            <AccordionTrigger className="text-sm font-medium px-4 py-3 hover:no-underline">
              Activity by Share Channel
            </AccordionTrigger>
            <AccordionContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Channel</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Visible</TableHead>
                    <TableHead className="text-right">Offscreen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewportStats.map((stat) => (
                    <TableRow key={stat.medium}>
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
          {/* Map controls */}
          <div className="absolute top-3 right-3 z-[1000] bg-background/90 backdrop-blur-sm rounded-md px-3 py-2 flex flex-col gap-2 shadow-sm border border-border">
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
            .samizdat-dot-icon {
              background: transparent !important;
              border: none !important;
              cursor: pointer;
              transition: transform 0.15s ease;
            }
            .samizdat-dot-icon:hover {
              transform: scale(1.3);
            }
            .samizdat-dot-icon > div {
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
