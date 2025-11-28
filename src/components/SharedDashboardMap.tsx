import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface GeographicPoint {
  latitude: number;
  longitude: number;
  city: string | null;
  region: string | null;
  country: string | null;
  level: number;
  event_count: number;
}

interface SharedDashboardMapProps {
  geoData: GeographicPoint[];
  levelFilter?: string;
}

export default function SharedDashboardMap({ geoData, levelFilter = "0,1,2,3" }: SharedDashboardMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(4);

  // Fix Leaflet default icon path
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = L.map(mapContainer.current, {
        center: [39.8283, -98.5795],
        zoom: zoomLevel,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
      }).addTo(map.current);

      markersLayer.current = L.layerGroup().addTo(map.current);

      map.current.on('zoomend', () => {
        if (map.current) {
          setZoomLevel(map.current.getZoom());
        }
      });

    } catch (err: any) {
      console.error("Error initializing map:", err);
      setError(`Failed to initialize map: ${err.message}`);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        markersLayer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current || !markersLayer.current) return;
    updateMapData();
  }, [geoData, levelFilter]);

  useEffect(() => {
    if (map.current) {
      map.current.setZoom(zoomLevel);
    }
  }, [zoomLevel]);

  const updateMapData = () => {
    if (!map.current || !markersLayer.current) return;

    markersLayer.current.clearLayers();

    const activeLevels = levelFilter.split(',').map(Number);
    const filteredData = geoData.filter(point => activeLevels.includes(point.level));

    if (filteredData.length === 0) return;

    filteredData.forEach((point) => {
      const getColorForLevel = (level: number) => {
        if (level === 0) return '#3b82f6';
        if (level === 1) return '#10b981';
        if (level === 2) return '#f59e0b';
        return '#ef4444';
      };

      const radius = Math.min(8 + (point.event_count * 2), 30);

      const circle = L.circleMarker([point.latitude, point.longitude], {
        radius: radius,
        fillColor: getColorForLevel(point.level),
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.6,
      });

      const popupContent = `
        <div style="min-width: 150px; font-family: system-ui, -apple-system, sans-serif;">
          <div style="font-weight: 600; margin-bottom: 4px;">${point.city || 'Unknown'}, ${point.region || ''}</div>
          <div style="font-size: 14px; line-height: 1.6;">
            <div><strong>Level:</strong> L${point.level < 10 ? '0' + point.level : point.level}</div>
            <div><strong>Events:</strong> ${point.event_count}</div>
          </div>
        </div>
      `;
      
      circle.bindPopup(popupContent);
      
      circle.on('mouseover', function() {
        this.setStyle({ fillOpacity: 0.9 });
      });
      circle.on('mouseout', function() {
        this.setStyle({ fillOpacity: 0.6 });
      });

      markersLayer.current!.addLayer(circle);
    });
  };

  const resetToUSView = () => {
    if (map.current) {
      map.current.flyTo([39.8283, -98.5795], 4);
      setZoomLevel(4);
    }
  };

  const handleZoomChange = (value: number[]) => {
    setZoomLevel(value[0]);
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!geoData || geoData.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        No geographic data available
      </Card>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-[600px] rounded" />
      
      <div className="absolute top-4 right-4 z-[1000] bg-background/90 p-3 rounded-md shadow space-y-3">
        <Button onClick={resetToUSView} size="sm" className="w-full">
          Reset View
        </Button>
        <div className="space-y-2">
          <label className="text-xs font-medium">Zoom: {zoomLevel}</label>
          <Slider
            value={[zoomLevel]}
            onValueChange={handleZoomChange}
            min={3}
            max={10}
            step={1}
            className="w-32"
          />
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-[1000] bg-background/90 p-3 rounded-md shadow space-y-2">
        <div className="text-sm font-semibold">Event Levels</div>
        <div className="flex items-center gap-2 text-xs">
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#3b82f6', border: '2px solid white' }}></div>
          <span>Level 0</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#10b981', border: '2px solid white' }}></div>
          <span>Level 1</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#f59e0b', border: '2px solid white' }}></div>
          <span>Level 2</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ef4444', border: '2px solid white' }}></div>
          <span>Level 3+</span>
        </div>
        <div className="pt-2 border-t text-xs text-muted-foreground">
          Circle size = event count
        </div>
      </div>
    </div>
  );
}
