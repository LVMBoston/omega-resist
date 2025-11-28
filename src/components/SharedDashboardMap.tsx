import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

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
  levelFilter?: string;
}

export default function SharedDashboardMap({ geoData, levelFilter = "0,1,2,3" }: SharedDashboardMapProps) {
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(40); // 10-100 in steps of 10
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const resetToUSView = () => {
    if (map.current) {
      map.current.flyTo({
        center: [-98.5795, 39.8283], // Geographic center of USA
        zoom: 4,
        duration: 2000,
      });
      setZoomLevel(40);
    }
  };

  const handleZoomChange = (value: number[]) => {
    const newZoom = value[0];
    setZoomLevel(newZoom);
    if (map.current) {
      // Map slider value (10-100) to zoom level (3-12)
      const mapboxZoom = 2 + (newZoom / 10);
      map.current.setZoom(mapboxZoom);
    }
  };

  // Load Mapbox token from backend or localStorage
  useEffect(() => {
    const fetchToken = async () => {
      try {
        // Import supabase client
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error) throw error;
        
        if (data?.token) {
          setMapboxToken(data.token);
          localStorage.setItem("mapbox_token", data.token);
        } else {
          // Fallback to localStorage
          const savedToken = localStorage.getItem("mapbox_token");
          if (savedToken) {
            setMapboxToken(savedToken);
          }
        }
      } catch (err) {
        console.error("Error fetching Mapbox token:", err);
        // Fallback to localStorage
        const savedToken = localStorage.getItem("mapbox_token");
        if (savedToken) {
          setMapboxToken(savedToken);
        }
      }
    };
    
    fetchToken();
  }, []);

  const handleSaveToken = () => {
    if (tokenInput.trim()) {
      localStorage.setItem("mapbox_token", tokenInput.trim());
      setMapboxToken(tokenInput.trim());
      setTokenInput("");
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapboxToken || !mapContainer.current || map.current) return;

    try {
      mapboxgl.accessToken = mapboxToken;
      
      // Check if Mapbox GL is supported
      if (!mapboxgl.supported()) {
        console.error("Mapbox GL JS is not supported in this browser");
        setError("Your browser doesn't support Mapbox GL. Please try a different browser or enable WebGL 2.0 in Safari settings.");
        return;
      }

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/light-v11",
        zoom: 1,
        center: [0, 20],
        projection: "mercator" as any,
        // iOS Safari WebGL compatibility options
        preserveDrawingBuffer: true,
        failIfMajorPerformanceCaveat: false,
        antialias: false, // Reduce WebGL context load on iOS
      });

      // Disable scroll zoom to prevent unwanted zoom on scroll
      map.current.scrollZoom.disable();

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
  }, [geoData, levelFilter]);

  const updateMapData = () => {
    if (!map.current || !map.current.loaded() || geoData.length === 0) return;

    // Filter geoData by selected levels
    const activeLevels = levelFilter.split(',').map(Number);
    const visibleData = geoData.filter(point => activeLevels.includes(point.level));

    const geojson = {
      type: "FeatureCollection" as const,
      features: visibleData.map((point) => ({
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
      <div className="flex flex-col items-center justify-center h-96 gap-4 p-6 border rounded-lg">
        <AlertCircle className="w-8 h-8 text-muted-foreground" />
        <div className="text-center space-y-2">
          <p className="font-medium">Mapbox Token Required</p>
          <p className="text-sm text-muted-foreground">
            Enter your Mapbox public token to view the map.{" "}
            <a
              href="https://account.mapbox.com/access-tokens/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Get your token here
            </a>
          </p>
        </div>
        <div className="flex gap-2 w-full max-w-md">
          <Input
            type="text"
            placeholder="pk.eyJ1IjoieW91cnVzZXJuYW1lIi..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveToken()}
          />
          <Button onClick={handleSaveToken}>Save</Button>
        </div>
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
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden border">
      <div ref={mapContainer} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
      
      {/* U.S. View Reset Button and Zoom Control */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-3">
        <Button 
          onClick={resetToUSView}
          variant="secondary"
          size="sm"
          className="shadow-lg"
        >
          U.S. View
        </Button>
        
        <div className="bg-background/95 backdrop-blur-sm p-3 rounded-lg shadow-lg border">
          <div className="text-xs font-medium mb-2">Zoom Level: {zoomLevel}</div>
          <Slider
            value={[zoomLevel]}
            onValueChange={handleZoomChange}
            min={10}
            max={100}
            step={10}
            className="w-32"
          />
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-background/95 backdrop-blur-sm p-4 rounded-lg shadow-lg border">
        <div className="text-sm font-semibold mb-3">Map Legend</div>
        
        {/* Event Level Colors */}
        <div className="space-y-2 mb-4">
          <div className="text-xs font-medium mb-1.5">Event Level:</div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3b82f6' }}></div>
            <span>Level 0</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }}></div>
            <span>Level 1</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }}></div>
            <span>Level 2</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
            <span>Level 3</span>
          </div>
        </div>

        {/* Event Count Sizes */}
        <div className="space-y-2">
          <div className="text-xs font-medium mb-1.5">Event Count:</div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-primary"></div>
            <span>1-9 events</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            <span>10-49 events</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded-full bg-primary"></div>
            <span>50+ events</span>
          </div>
        </div>
      </div>
    </div>
  );
}
