import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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
}

// Non-evaluative, distinct colors for EoAs
const EOA_COLORS: Record<string, string> = {
  "81050b93-f0f7-4943-99ad-9becb622110f": "#3b82f6", // blue
  "681bb72e-b221-46e8-b9a8-baa8dd449195": "#8b5cf6", // purple
  "b5eaa8a9-2011-4173-a3b3-b666a15cc5b9": "#06b6d4", // cyan
  "69b036da-e620-4068-b2d7-49df6781b7a3": "#f59e0b", // amber
  "a1b2c3d4-e5f6-7890-abcd-ef1234567890": "#10b981", // emerald
};
const DEFAULT_COLOR = "#64748b"; // slate-500

const SamizdatMap = ({ eoaIds }: SamizdatMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventPoints, setEventPoints] = useState<EventPoint[]>([]);

  // Fetch event-level data (no aggregation)
  useEffect(() => {
    const fetchEventData = async () => {
      if (!eoaIds.length) {
        setEventPoints([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Step 1: Get EoA start dates
      const { data: eoas, error: eoasError } = await supabase
        .from("events_actions")
        .select("id, start_date")
        .in("id", eoaIds);

      if (eoasError || !eoas?.length) {
        console.log("No EoAs found:", eoaIds);
        setEventPoints([]);
        setLoading(false);
        return;
      }

      const eoaStartDates: Record<string, string | null> = {};
      eoas.forEach((eoa) => {
        eoaStartDates[eoa.id] = eoa.start_date;
      });

      // Step 2: Get tokens for selected EoAs
      const { data: tokens, error: tokensError } = await supabase
        .from("tokens")
        .select("token, eoa_id")
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
      tokens.forEach((t) => {
        tokenToEoa[t.token] = t.eoa_id;
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

      // Step 5: Build event points, filtering by start_date
      const points: EventPoint[] = [];
      events.forEach((event) => {
        const eoaId = tokenToEoa[event.token];
        const startDate = eoaStartDates[eoaId];
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
        });
      });

      setEventPoints(points);
      setLoading(false);
    };

    fetchEventData();
  }, [eoaIds]);

  // Initialize map
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

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when data changes - one marker per event
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add one marker per event point (no aggregation)
    eventPoints.forEach((event) => {
      const fillColor = EOA_COLORS[event.eoaId] || DEFAULT_COLOR;
      // Darken border slightly
      const borderColor = fillColor.replace(/^#/, "");
      const r = Math.max(0, parseInt(borderColor.slice(0, 2), 16) - 30);
      const g = Math.max(0, parseInt(borderColor.slice(2, 4), 16) - 30);
      const b = Math.max(0, parseInt(borderColor.slice(4, 6), 16) - 30);
      const darkerColor = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

      const marker = L.circleMarker([event.latitude, event.longitude], {
        radius: 6,
        fillColor,
        color: darkerColor,
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7,
      }).addTo(mapRef.current!);

      markersRef.current.push(marker);
    });

    // User controls zoom - no auto-fitting
  }, [eventPoints]);

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden border border-border">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" />
      {!loading && eventPoints.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <p className="text-muted-foreground">No activation events found for selected EoAs</p>
        </div>
      )}
    </div>
  );
};

export default SamizdatMap;
