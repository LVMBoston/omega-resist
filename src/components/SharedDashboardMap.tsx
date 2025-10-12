import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GeographicPoint {
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
  level: number;
  event_count: number;
}

interface SharedDashboardMapProps {
  geoData: GeographicPoint[];
}

export default function SharedDashboardMap({ geoData }: SharedDashboardMapProps) {
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-mapbox-token");
        if (error) throw error;
        setMapboxToken(data.token);
      } catch (err) {
        console.error("Error fetching Mapbox token:", err);
        setError("Failed to load map");
      }
    };
    fetchToken();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapboxToken || !mapContainer.current || map.current) return;

    try {
      mapboxgl.accessToken = mapboxToken;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/light-v11",
        zoom: 1,
        center: [0, 20],
        projection: "mercator" as any,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        "top-right"
      );

      map.current.on("load", () => {
        updateMapData();
      });
    } catch (err) {
      console.error("Error initializing map:", err);
      setError("Failed to initialize map");
    }

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Update map with geographic data
  useEffect(() => {
    if (map.current && map.current.loaded() && geoData.length > 0) {
      updateMapData();
    }
  }, [geoData]);

  const updateMapData = () => {
    if (!map.current || !map.current.loaded() || geoData.length === 0) return;

    const geojson = {
      type: "FeatureCollection" as const,
      features: geoData.map((point) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [point.longitude, point.latitude],
        },
        properties: {
          city: point.city,
          region: point.region,
          country: point.country,
          level: point.level,
          event_count: point.event_count,
        },
      })),
    };

    // Remove existing layers and source
    if (map.current.getLayer("points")) {
      map.current.removeLayer("points");
    }
    if (map.current.getSource("geographic-data")) {
      map.current.removeSource("geographic-data");
    }

    // Add source and layer
    map.current.addSource("geographic-data", {
      type: "geojson",
      data: geojson,
    });

    map.current.addLayer({
      id: "points",
      type: "circle",
      source: "geographic-data",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "event_count"],
          1, 6,
          10, 12,
          50, 18,
        ],
        "circle-color": [
          "interpolate",
          ["linear"],
          ["get", "level"],
          0, "#3b82f6",
          1, "#10b981",
          2, "#f59e0b",
          3, "#ef4444",
        ],
        "circle-opacity": 0.7,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });

    // Add click handler for popups
    map.current.on("click", "points", (e) => {
      if (!map.current || !e.features?.[0]) return;

      const { city, region, country, level, event_count } = e.features[0].properties as any;
      const coordinates = (e.features[0].geometry as any).coordinates.slice();

      const popup = new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(`
          <div class="p-2">
            <div class="font-bold">${city || "Unknown"}</div>
            <div class="text-sm text-muted-foreground">${region ? `${region}, ` : ""}${country || ""}</div>
            <div class="mt-2 text-sm">
              <div>Level: ${level}</div>
              <div>Events: ${event_count}</div>
            </div>
          </div>
        `)
        .addTo(map.current);
    });

    map.current.on("mouseenter", "points", () => {
      if (map.current) map.current.getCanvas().style.cursor = "pointer";
    });

    map.current.on("mouseleave", "points", () => {
      if (map.current) map.current.getCanvas().style.cursor = "";
    });

    // Fit bounds to show all points
    if (geoData.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      geoData.forEach((point) => {
        bounds.extend([point.longitude, point.latitude]);
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 10 });
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (geoData.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No geographic data available for this campaign yet.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="relative w-full h-96 rounded-lg overflow-hidden border">
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
}
