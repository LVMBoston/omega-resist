import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UrlEvent {
  id: string;
  token: string;
  event_type: string;
  occurred_at: string;
  latitude: number;
  longitude: number;
  city: string | null;
  region: string | null;
  country: string | null;
  tokens?: {
    level: number;
    deck_slug: string;
    utm_campaign: string;
    events_actions?: {
      title: string;
      city: string;
      state: string;
    };
  };
}

interface ActivityMapProps {
  eventTypeFilter: string;
}

export default function ActivityMap({ eventTypeFilter }: ActivityMapProps) {
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [events, setEvents] = useState<UrlEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  // Fetch Mapbox token on mount
  useEffect(() => {
    console.log("ActivityMap mounted, fetching Mapbox token");
    fetchMapboxToken();
  }, []);

  // Initialize map when token is available
  useEffect(() => {
    if (!mapboxToken || !mapContainer.current || map.current) return;

    try {
      mapboxgl.accessToken = mapboxToken;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-98.5795, 39.8283], // Center of USA
        zoom: 4,
        projection: "mercator" as any,
      });

      // Add navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        "top-right"
      );

      // Wait for map to load before adding data
      map.current.on("load", () => {
        fetchEvents();
      });
    } catch (err) {
      console.error("Error initializing map:", err);
      setError("Failed to initialize map");
    }

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Fetch events and update map when filter changes
  useEffect(() => {
    if (map.current && map.current.loaded()) {
      fetchEvents();
    }
  }, [eventTypeFilter]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("map_events")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "url_events",
        },
        () => {
          if (map.current && map.current.loaded()) {
            fetchEvents();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventTypeFilter]);

  const fetchMapboxToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-mapbox-token");

      if (error) throw error;
      if (!data?.token) throw new Error("No token returned");

      setMapboxToken(data.token);
    } catch (err) {
      console.error("Error fetching Mapbox token:", err);
      setError("Failed to load map token");
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);

    try {
      let query = supabase
        .from("url_events")
        .select(
          `
          *,
          tokens(
            level,
            deck_slug,
            utm_campaign,
            eoa_id
          )
        `
        )
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("occurred_at", { ascending: false })
        .limit(500);

      if (eventTypeFilter !== "all") {
        query = query.eq("event_type", eventTypeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log("Fetched events for map:", data?.length);

      const eventsData = (data || []) as UrlEvent[];
      setEvents(eventsData);
      updateMapData(eventsData);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const updateMapData = (eventsData: UrlEvent[]) => {
    if (!map.current || !map.current.loaded()) return;

    // Convert events to GeoJSON
    const geojsonData: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: "FeatureCollection",
      features: eventsData.map((event) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [event.longitude, event.latitude],
        },
        properties: {
          id: event.id,
          token: event.token,
          eventType: event.event_type,
          level: event.tokens?.level || 0,
          occurredAt: event.occurred_at,
          city: event.city,
          region: event.region,
          country: event.country,
          deckSlug: event.tokens?.deck_slug,
          campaign: event.tokens?.utm_campaign,
        },
      })),
    };

    // Remove existing layers and source if they exist
    if (map.current.getLayer("unclustered-point")) {
      map.current.removeLayer("unclustered-point");
    }
    if (map.current.getLayer("cluster-count")) {
      map.current.removeLayer("cluster-count");
    }
    if (map.current.getLayer("clusters")) {
      map.current.removeLayer("clusters");
    }
    if (map.current.getSource("events")) {
      map.current.removeSource("events");
    }

    // Add source with clustering
    map.current.addSource("events", {
      type: "geojson",
      data: geojsonData,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });

    // Add cluster circles
    map.current.addLayer({
      id: "clusters",
      type: "circle",
      source: "events",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step",
          ["get", "point_count"],
          "#51bbd6",
          20,
          "#f1f075",
          50,
          "#f28cb1",
        ],
        "circle-radius": ["step", ["get", "point_count"], 20, 20, 30, 50, 40],
      },
    });

    // Add cluster count labels
    map.current.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "events",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 12,
      },
    });

    // Add unclustered points
    map.current.addLayer({
      id: "unclustered-point",
      type: "circle",
      source: "events",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": [
          "match",
          ["get", "eventType"],
          "scan",
          "#3b82f6",
          "view",
          "#10b981",
          "share",
          "#a855f7",
          "#6b7280",
        ],
        "circle-radius": 8,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });

    // Add click handlers
    map.current.on("click", "clusters", (e) => {
      if (!map.current) return;
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ["clusters"],
      });
      const clusterId = features[0].properties?.cluster_id;
      const source = map.current.getSource("events") as mapboxgl.GeoJSONSource;

      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || !map.current) return;

        const coordinates = (features[0].geometry as GeoJSON.Point).coordinates;
        map.current.easeTo({
          center: [coordinates[0], coordinates[1]],
          zoom: zoom || 10,
        });
      });
    });

    map.current.on("click", "unclustered-point", (e) => {
      if (!map.current || !e.features?.[0]) return;

      const coordinates = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];
      const props = e.features[0].properties;

      if (!props) return;

      const levelBadge = `L${props.level.toString().padStart(2, "0")}`;
      const eventColor =
        props.eventType === "scan"
          ? "#3b82f6"
          : props.eventType === "view"
          ? "#10b981"
          : "#a855f7";

      const popup = new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(
          `
          <div class="p-3 min-w-[250px]">
            <div class="flex items-center gap-2 mb-2">
              <span class="inline-flex items-center px-2 py-1 rounded text-xs font-semibold" style="background-color: ${eventColor}20; color: ${eventColor}">
                ${props.eventType.toUpperCase()}
              </span>
              <span class="inline-flex items-center px-2 py-1 rounded text-xs font-semibold border">
                ${levelBadge}
              </span>
            </div>
            <div class="space-y-1 text-sm">
              <div><strong>Location:</strong> ${props.city || "Unknown"}, ${props.region || ""}</div>
              <div><strong>Time:</strong> ${format(new Date(props.occurredAt), "PPp")}</div>
              <div><strong>Deck:</strong> <code class="text-xs">${props.deckSlug}</code></div>
              <div><strong>Token:</strong> <code class="text-xs">${props.token}</code></div>
            </div>
          </div>
        `
        )
        .addTo(map.current);
    });

    // Change cursor on hover
    map.current.on("mouseenter", "clusters", () => {
      if (map.current) map.current.getCanvas().style.cursor = "pointer";
    });
    map.current.on("mouseleave", "clusters", () => {
      if (map.current) map.current.getCanvas().style.cursor = "";
    });
    map.current.on("mouseenter", "unclustered-point", () => {
      if (map.current) map.current.getCanvas().style.cursor = "pointer";
    });
    map.current.on("mouseleave", "unclustered-point", () => {
      if (map.current) map.current.getCanvas().style.cursor = "";
    });
  };

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (loading && !map.current) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={mapContainer} className="w-full h-[600px] rounded-lg" />
      {loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading events...</span>
        </div>
      )}
      {!loading && events.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-background/90 backdrop-blur px-6 py-4 rounded-lg shadow-lg">
            <p className="text-muted-foreground">
              No events with location data yet. Start sharing to see activity on the map!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
