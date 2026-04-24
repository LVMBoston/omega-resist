import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, MapPin, Smartphone, Map, Eye, Share2, Scan } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import ActivityMap from "@/components/ActivityMap";
import { MetricCard } from "@/components/virality/MetricCard";

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
  is_simulated: boolean;
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

type DataSourceFilter = "real" | "simulated";

export default function ActivityMonitor() {
  const [events, setEvents] = useState<UrlEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [l00Filter, setL00Filter] = useState<string>("all");
  const [dataSourceFilter, setDataSourceFilter] = useState<DataSourceFilter>("real");
  const [l00Options, setL00Options] = useState<Array<{ eoa_id: string; mobilize_code: string; city: string; state: string }>>([]);

  useEffect(() => {
    fetchL00Options();
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
  }, [eventTypeFilter, l00Filter, dataSourceFilter]);

  const fetchL00Options = async () => {
    const { data, error } = await supabase
      .from("tokens")
      .select(`
        eoa_id,
        events_actions!inner(
          utm_id,
          city,
          state
        )
      `)
      .eq("level", 0);

    if (error) {
      console.error("Error fetching L00 options:", error);
      return;
    }

    if (!data) return;

    // Create unique list of L00 options using a plain object
    const optionsObj: Record<string, { eoa_id: string; mobilize_code: string; city: string; state: string }> = {};
    
    data.forEach((item: any) => {
      if (item.eoa_id && !optionsObj[item.eoa_id]) {
        optionsObj[item.eoa_id] = {
          eoa_id: item.eoa_id,
          mobilize_code: item.events_actions?.utm_id || "Unknown",
          city: item.events_actions?.city || "",
          state: item.events_actions?.state || "",
        };
      }
    });

    setL00Options(Object.values(optionsObj));
  };

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

    if (l00Filter !== "all") {
      query = query.eq("tokens.eoa_id", l00Filter);
    }

    // Filter by simulated status
    if (dataSourceFilter === "real") {
      query = query.eq("is_simulated", false);
    } else if (dataSourceFilter === "simulated") {
      query = query.eq("is_simulated", true);
    }
    // If "both", no filter applied

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

  // Calculate metrics
  const scansCount = events.filter(e => e.event_type === "scan").length;
  const viewsCount = events.filter(e => e.event_type === "view").length;
  const sharesCount = events.filter(e => e.event_type === "share").length;

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

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <MetricCard
            title="Scans"
            value={scansCount}
            format="number"
            status="good"
          />
          <MetricCard
            title="Views"
            value={viewsCount}
            format="number"
            status="neutral"
          />
          <MetricCard
            title="Shares"
            value={sharesCount}
            format="number"
            status="warning"
          />
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter events by type, L00 code, and data source</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Event Type</label>
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="scan">Scans Only</SelectItem>
                  <SelectItem value="view">Views Only</SelectItem>
                  <SelectItem value="share">Shares Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">L00 - Mobilize Code</label>
              <Select value={l00Filter} onValueChange={setL00Filter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All L00 Codes</SelectItem>
                  {l00Options.map((option) => (
                    <SelectItem key={option.eoa_id} value={option.eoa_id}>
                      {option.mobilize_code} - {option.city}, {option.state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Data Source</label>
              <Select value={dataSourceFilter} onValueChange={(v) => setDataSourceFilter(v as DataSourceFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="real">Real Data Only</SelectItem>
                  <SelectItem value="simulated">Simulated Data Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Event List
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-2">
              <Map className="w-4 h-4" />
              Map View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            {events.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No events yet. Share your QR codes to start tracking activity!
                </CardContent>
              </Card>
            ) : (
              events.map((event) => (
              <Card key={event.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1.5">
                      {/* Event Type & Level */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge className={getEventBadgeColor(event.event_type)}>
                          {event.event_type.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">
                          {getLevelBadge(event.tokens?.level || 0)}
                        </Badge>
                        {event.is_simulated && (
                          <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                            SIMULATED
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.occurred_at), "PPp")}
                        </span>
                      </div>

                      {/* Event Details */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-sm">
                            {event.tokens?.events_actions?.title || "Unknown Event"}
                          </span>
                          {event.tokens?.events_actions?.city && (
                            <span className="text-xs text-muted-foreground">
                              • {event.tokens.events_actions.city}, {event.tokens.events_actions.state}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Smartphone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs">
                            {parseUserAgent(event.user_agent)}
                          </span>
                        </div>

                        {/* Location Info */}
                        {(event.city || event.region || event.country) && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <MapPin className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                            <span>
                              {[event.city, event.region, event.country].filter(Boolean).join(', ')}
                              {event.zip_code && ` (${event.zip_code})`}
                            </span>
                          </div>
                        )}

                        {event.ip_address && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-muted-foreground">
                              IP: {event.ip_address}
                              {event.latitude && event.longitude && (
                                <> • Coords: {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}</>
                              )}
                            </span>
                          </div>
                        )}

                        {/* Token & Campaign Info */}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          <span>Token: <code className="font-mono">{event.token}</code></span>
                          <span>Deck: <code className="font-mono">{event.tokens?.deck_slug}</code></span>
                          <span>Campaign: <code className="font-mono">{event.tokens?.utm_campaign}</code></span>
                          {event.utm_snapshot?.utm_content && (
                            <span>
                              UTM Content:{' '}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <code className="font-mono bg-muted px-1 py-0.5 rounded cursor-help">
                                      {event.utm_snapshot.utm_content}
                                    </code>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1 text-xs">
                                      <div><strong>Mobilize Code:</strong> {event.utm_snapshot.utm_content.split('-')[0]}</div>
                                      <div><strong>UTM ID:</strong> {event.utm_snapshot.utm_content.split('-').slice(1).join('-')}</div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </span>
                          )}
                        </div>

                        {/* UTM Snapshot */}
                        {event.utm_snapshot && (
                          <details className="text-[10px]">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              View UTM Parameters
                            </summary>
                            <pre className="mt-1 p-1.5 bg-muted rounded text-[10px] overflow-x-auto">
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
          </TabsContent>

          <TabsContent value="map">
            <Card>
              <CardContent className="p-0">
                <ActivityMap eventTypeFilter={eventTypeFilter} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
