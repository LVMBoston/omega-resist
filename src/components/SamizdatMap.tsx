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
  eoaId: string | null;
}

interface ZipCoordinate {
  zip_code: string;
  latitude: number;
  longitude: number;
}

const SamizdatMap = ({ eoaId }: SamizdatMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [zipCoordinates, setZipCoordinates] = useState<ZipCoordinate[]>([]);

  // Fetch ZIP coordinates for events associated with this EoA
  useEffect(() => {
    const fetchZipData = async () => {
      if (!eoaId) {
        setZipCoordinates([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Step 1: Get tokens for this EoA
      const { data: tokens, error: tokensError } = await supabase
        .from("tokens")
        .select("token")
        .eq("eoa_id", eoaId)
        .eq("is_simulated", false);

      if (tokensError || !tokens?.length) {
        console.log("No tokens found for EoA:", eoaId);
        setZipCoordinates([]);
        setLoading(false);
        return;
      }

      const tokenList = tokens.map((t) => t.token);

      // Step 2: Get unique zip_codes from url_events for these tokens
      const { data: events, error: eventsError } = await supabase
        .from("url_events")
        .select("zip_code")
        .in("token", tokenList)
        .eq("is_simulated", false)
        .not("zip_code", "is", null);

      if (eventsError || !events?.length) {
        console.log("No events with zip codes found");
        setLoading(false);
        return;
      }

      // Get unique ZIP codes
      const uniqueZips = [...new Set(events.map((e) => e.zip_code).filter(Boolean))] as string[];

      if (!uniqueZips.length) {
        setLoading(false);
        return;
      }

      // Step 3: Get coordinates for those ZIPs
      const { data: zipData, error: zipError } = await supabase
        .from("zip_codes")
        .select("zip_code, latitude, longitude")
        .in("zip_code", uniqueZips);

      if (zipError) {
        console.error("Error fetching zip coordinates:", zipError);
        setLoading(false);
        return;
      }

      setZipCoordinates(zipData || []);
      setLoading(false);
    };

    fetchZipData();
  }, [eoaId]);

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

  // Update markers when data changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers
    zipCoordinates.forEach((zip) => {
      const marker = L.circleMarker([zip.latitude, zip.longitude], {
        radius: 6,
        fillColor: "#64748b", // slate-500
        color: "#475569", // slate-600
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7,
      }).addTo(mapRef.current!);

      markersRef.current.push(marker);
    });

    // Fit bounds if we have markers
    if (zipCoordinates.length > 0) {
      const bounds = L.latLngBounds(
        zipCoordinates.map((z) => [z.latitude, z.longitude] as [number, number])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [zipCoordinates]);

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden border border-border">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" />
      {!loading && zipCoordinates.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <p className="text-muted-foreground">No ZIP code data available for this campaign</p>
        </div>
      )}
    </div>
  );
};

export default SamizdatMap;
