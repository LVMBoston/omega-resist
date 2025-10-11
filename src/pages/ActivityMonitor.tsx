import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, MapPin, Smartphone } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

interface UrlEvent {
  id: string;
  token: string;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  utm_snapshot: any;
  occurred_at: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  zip_code: string | null;
  tokens?: {
    level: number;
    deck_slug: string;
    utm_campaign: string;
    eoa_id: string;
    events_actions?: {
      title: string;
      city: string;
      state: string;
    };
  };
}

export default function ActivityMonitor() {
  const [events, setEvents] = useState<UrlEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");

  useEffect(() => {
    fetchEvents();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('url_events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'url_events'
        },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventTypeFilter]);

  const fetchEvents = async () => {
    setLoading(true);
    
    let query = supabase
      .from("url_events")
      .select(`
        *,
        tokens!inner(
          level,
          deck_slug,
          utm_campaign,
          eoa_id,
          events_actions(
            title,
            city,
            state
          )
        )
      `)
      .order("occurred_at", { ascending: false })
      .limit(100);

    if (eventTypeFilter !== "all") {
      query = query.eq("event_type", eventTypeFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching events:", error);
    } else {
      setEvents((data || []) as UrlEvent[]);
    }
    
    setLoading(false);
  };

  const getEventBadgeColor = (eventType: string) => {
    switch (eventType) {
      case "scan": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "view": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "share": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      default: return "bg-muted";
    }
  };

  const getLevelBadge = (level: number) => {
    return `L${level.toString().padStart(2, '0')}`;
  };

  const parseUserAgent = (ua: string | null) => {
    if (!ua) return "Unknown Device";
    
    // Simple parsing - in production you'd use a library
    if (ua.includes("iPhone")) return "📱 iPhone";
    if (ua.includes("iPad")) return "📱 iPad";
    if (ua.includes("Android")) return "📱 Android";
    if (ua.includes("Mac")) return "💻 Mac";
    if (ua.includes("Windows")) return "💻 Windows";
    return "🖥️ " + ua.slice(0, 30) + "...";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="w-8 h-8" />
            Viral Activity Monitor
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time tracking of QR scans, views, and shares
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter events by type</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="scan">Scans Only</SelectItem>
                <SelectItem value="view">Views Only</SelectItem>
                <SelectItem value="share">Shares Only</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {events.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No events yet. Share your QR codes to start tracking activity!
              </CardContent>
            </Card>
          ) : (
            events.map((event) => (
              <Card key={event.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* Event Type & Level */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={getEventBadgeColor(event.event_type)}>
                          {event.event_type.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">
                          {getLevelBadge(event.tokens?.level || 0)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(event.occurred_at), "PPp")}
                        </span>
                      </div>

                      {/* Event Details */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">
                            {event.tokens?.events_actions?.title || "Unknown Event"}
                          </span>
                          {event.tokens?.events_actions?.city && (
                            <span className="text-sm text-muted-foreground">
                              • {event.tokens.events_actions.city}, {event.tokens.events_actions.state}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">
                            {parseUserAgent(event.user_agent)}
                          </span>
                        </div>

                        {/* Location Info */}
                        {(event.city || event.region || event.country) && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            <span>
                              {[event.city, event.region, event.country].filter(Boolean).join(', ')}
                              {event.zip_code && ` (${event.zip_code})`}
                            </span>
                          </div>
                        )}

                        {event.ip_address && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              IP: {event.ip_address}
                              {event.latitude && event.longitude && (
                                <> • Coords: {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}</>
                              )}
                            </span>
                          </div>
                        )}

                        {/* Token & Campaign Info */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Token: <code className="font-mono">{event.token}</code></span>
                          <span>Deck: <code className="font-mono">{event.tokens?.deck_slug}</code></span>
                          <span>Campaign: <code className="font-mono">{event.tokens?.utm_campaign}</code></span>
                        </div>

                        {/* UTM Snapshot */}
                        {event.utm_snapshot && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              View UTM Parameters
                            </summary>
                            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                              {JSON.stringify(event.utm_snapshot, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
