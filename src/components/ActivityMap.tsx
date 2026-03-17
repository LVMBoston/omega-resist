import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { format } from "date-fns";

interface UrlEvent {
  id: string;
  token: string;
  event_type: string;
  occurred_at: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  tokens?: {
    level: number;
    deck_slug: string;
    utm_campaign: string;
  };
}

interface ActivityMapProps {
  eventTypeFilter: string;
}

export default function ActivityMap({ eventTypeFilter }: ActivityMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markerClusterGroup = useRef<L.MarkerClusterGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<UrlEvent[]>([]);
  const [loading, setLoading] = useState(true);

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
      const savedPosition = localStorage.getItem('activityMapPosition');
      let center: [number, number] = [39.8283, -98.5795];
      let zoom = 4;

      if (savedPosition) {
        try {
          const parsed = JSON.parse(savedPosition);
          center = [parsed.center[1], parsed.center[0]];
          zoom = parsed.zoom;
        } catch (e) {
          console.warn("Failed to parse saved position:", e);
        }
      }

      map.current = L.map(mapContainer.current, {
        center,
        zoom,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
      }).addTo(map.current);

      markerClusterGroup.current = L.markerClusterGroup({
        chunkedLoading: true,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
      });
      
      map.current.addLayer(markerClusterGroup.current);

      map.current.on("moveend", () => {
        if (!map.current) return;
        const center = map.current.getCenter();
        const zoom = map.current.getZoom();
        localStorage.setItem('activityMapPosition', JSON.stringify({
          center: [center.lng, center.lat],
          zoom
        }));
      });

      setMapReady(true);
    } catch (err: any) {
      console.error("Error initializing map:", err);
      setError(`Failed to initialize map: ${err.message}`);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        markerClusterGroup.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    fetchEvents();
  }, [eventTypeFilter, mapReady]);

  useEffect(() => {
    if (!mapReady) return;

    const channel = supabase
      .channel('url_events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'url_events',
        },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mapReady, eventTypeFilter]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("url_events")
        .select(`
          *,
          tokens(
            level,
            deck_slug,
            utm_campaign
          )
        `)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("occurred_at", { ascending: false })
        .limit(500);

      if (eventTypeFilter !== "all") {
        query = query.eq("event_type", eventTypeFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching events:", error);
        setError(`Failed to fetch events: ${error.message}`);
        return;
      }

      const eventsData = (data || []) as UrlEvent[];
      setEvents(eventsData);
      updateMapData(eventsData);
    } catch (err: any) {
      console.error("Error in fetchEvents:", err);
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateMapData = (eventsData: UrlEvent[]) => {
    if (!map.current || !markerClusterGroup.current) return;

    markerClusterGroup.current.clearLayers();

    eventsData.forEach((event) => {
      if (event.latitude && event.longitude) {
        const level = event.tokens?.level || 0;
        
        const iconColor = level === 0 ? '#1e293b' : level === 1 ? '#22c55e' : level === 2 ? '#a855f7' : '#ef4444';
        const iconHtml = `
          <div style="
            background-color: ${iconColor};
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 0 4px rgba(0,0,0,0.4);
          "></div>
        `;
        
        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-marker',
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        const marker = L.marker([event.latitude, event.longitude], {
          icon: customIcon,
        });

        const eventColor = event.event_type === "scan" ? "#3b82f6" : event.event_type === "view" ? "#10b981" : "#a855f7";

        const popupContent = `
          <div style="min-width: 250px; font-family: system-ui, -apple-system, sans-serif;">
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
              <span style="display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; background-color: ${eventColor}20; color: ${eventColor};">
                ${event.event_type.toUpperCase()}
              </span>
              <span style="display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; border: 1px solid #ddd;">
                L${level < 10 ? '0' + level : level}
              </span>
            </div>
            <div style="font-size: 14px; line-height: 1.6;">
              ${event.city ? `<div><strong>Location:</strong> ${event.city}, ${event.region}</div>` : ''}
              <div><strong>Time:</strong> ${format(new Date(event.occurred_at), "PPp")}</div>
              <div><strong>Deck:</strong> <code style="font-size: 12px;">${event.tokens?.deck_slug || 'N/A'}</code></div>
              <div><strong>Token:</strong> <code style="font-size: 12px;">${event.token}</code></div>
            </div>
          </div>
        `;
        
        marker.bindPopup(popupContent);
        markerClusterGroup.current!.addLayer(marker);
      }
    });
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="relative w-full h-full">
      {loading && (
        <div className="absolute top-4 right-4 z-[1000] bg-background/90 px-3 py-2 rounded-md shadow">
          Loading events...
        </div>
      )}
      {!loading && events.length === 0 && (
        <div className="absolute top-4 right-4 z-[1000] bg-background/90 px-3 py-2 rounded-md shadow">
          No events with location data
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full min-h-[400px] rounded" />
      
      <div className="absolute bottom-4 left-4 z-[1000] bg-background/90 p-3 rounded-md shadow space-y-2">
        <div className="text-sm font-semibold">Event Levels</div>
        <div className="flex items-center gap-2 text-xs">
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#1e293b', border: '2px solid white' }}></div>
          <span>L00 (Origin)</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#22c55e', border: '2px solid white' }}></div>
          <span>L01</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#a855f7', border: '2px solid white' }}></div>
          <span>L02</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444', border: '2px solid white' }}></div>
          <span>L03</span>
        </div>
      </div>
    </Card>
  );
}
