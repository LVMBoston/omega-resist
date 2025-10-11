import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, MapPin, Smartphone, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import ActivityMap from "@/components/ActivityMap";
import { MetricCard } from "@/components/virality/MetricCard";
import { ViralCoefficientChart } from "@/components/virality/ViralCoefficientChart";
import { ConversionFunnelChart } from "@/components/virality/ConversionFunnelChart";
import { AmplificationChart } from "@/components/virality/AmplificationChart";
import { EngagementByLevelChart } from "@/components/virality/EngagementByLevelChart";
import { ContentPerformanceTable } from "@/components/virality/ContentPerformanceTable";
import SharedDashboardMap from "@/components/SharedDashboardMap";
import { SimulatorControls } from "@/components/SimulatorControls";
import {
  getViralCoefficient,
  getConversionFunnel,
  getAmplificationByLevel,
  getEngagementByLevel,
  getViralCycleTime,
  getTopPerformingContent,
  getGeographicSpread,
} from "@/lib/virality/analytics";

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

export default function CampaignDashboard() {
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [dataSourceFilter, setDataSourceFilter] = useState<"real" | "simulated" | "both">("real");
  const [events, setEvents] = useState<UrlEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Fetch campaigns
  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, code, title")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Set initial campaign
  useEffect(() => {
    if (!selectedCampaign && campaigns && campaigns.length > 0) {
      setSelectedCampaign(campaigns[0].code);
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaign]);

  // Fetch events when filters change
  useEffect(() => {
    if (selectedCampaign) {
      fetchEvents();
    }
  }, [selectedCampaign, eventTypeFilter, dataSourceFilter]);

  const fetchEvents = async () => {
    setEventsLoading(true);
    
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
      .eq("tokens.utm_campaign", selectedCampaign)
      .order("occurred_at", { ascending: false })
      .limit(50);

    if (eventTypeFilter !== "all") {
      query = query.eq("event_type", eventTypeFilter);
    }

    if (dataSourceFilter === "real") {
      query = query.eq("is_simulated", false);
    } else if (dataSourceFilter === "simulated") {
      query = query.eq("is_simulated", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching events:", error);
    } else {
      setEvents((data || []) as UrlEvent[]);
    }
    
    setEventsLoading(false);
  };

  // Fetch analytics data
  const { data: viralCoefficient } = useQuery({
    queryKey: ["viralCoefficient", selectedCampaign, dataSourceFilter],
    queryFn: () => getViralCoefficient(selectedCampaign, undefined, dataSourceFilter),
    enabled: !!selectedCampaign,
  });

  const { data: funnelData } = useQuery({
    queryKey: ["conversionFunnel", selectedCampaign, dataSourceFilter],
    queryFn: () => getConversionFunnel(selectedCampaign, undefined, dataSourceFilter),
    enabled: !!selectedCampaign,
  });

  const { data: amplificationData } = useQuery({
    queryKey: ["amplification", selectedCampaign, dataSourceFilter],
    queryFn: () => getAmplificationByLevel(selectedCampaign, dataSourceFilter),
    enabled: !!selectedCampaign,
  });

  const { data: engagementData } = useQuery({
    queryKey: ["engagement", selectedCampaign, dataSourceFilter],
    queryFn: () => getEngagementByLevel(selectedCampaign, undefined, dataSourceFilter),
    enabled: !!selectedCampaign,
  });

  const { data: cycleTimeData } = useQuery({
    queryKey: ["cycleTime", selectedCampaign, dataSourceFilter],
    queryFn: () => getViralCycleTime(selectedCampaign, dataSourceFilter),
    enabled: !!selectedCampaign,
  });

  const { data: contentData } = useQuery({
    queryKey: ["contentPerformance", selectedCampaign, dataSourceFilter],
    queryFn: () => getTopPerformingContent(selectedCampaign, "shares", dataSourceFilter),
    enabled: !!selectedCampaign,
  });

  const { data: geoData } = useQuery({
    queryKey: ["geographic", selectedCampaign, dataSourceFilter],
    queryFn: () => getGeographicSpread(selectedCampaign, undefined, dataSourceFilter),
    enabled: !!selectedCampaign,
  });

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
    if (ua.includes("iPhone")) return "📱 iPhone";
    if (ua.includes("iPad")) return "📱 iPad";
    if (ua.includes("Android")) return "📱 Android";
    if (ua.includes("Mac")) return "💻 Mac";
    if (ua.includes("Windows")) return "💻 Windows";
    return "🖥️ Device";
  };

  const avgCycleTime = cycleTimeData && cycleTimeData.length > 0
    ? cycleTimeData.reduce((sum, ct) => sum + ct.avg_hours, 0) / cycleTimeData.length
    : 0;

  const scansCount = events.filter(e => e.event_type === "scan").length;
  const viewsCount = events.filter(e => e.event_type === "view").length;
  const sharesCount = events.filter(e => e.event_type === "share").length;

  if (campaignsLoading) {
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
            <TrendingUp className="w-8 h-8" />
            Campaign Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive view of events, analytics, and geographic data
          </p>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="filters" className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-5">
            <TabsTrigger value="filters">Filters</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="simulator">Simulator</TabsTrigger>
          </TabsList>

          {/* Filters Tab - Single Source of Truth */}
          <TabsContent value="filters" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Configure Filters</CardTitle>
                <CardDescription>
                  These filters will apply across all tabs (Events, Map, Analytics)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Campaign</label>
                  <Select value={selectedCampaign} onValueChange={(code) => {
                    setSelectedCampaign(code);
                    const campaign = campaigns?.find(c => c.code === code);
                    if (campaign) setSelectedCampaignId(campaign.id);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns?.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.code}>
                          {campaign.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
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
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Data Source</label>
                  <Select value={dataSourceFilter} onValueChange={(v) => setDataSourceFilter(v as "real" | "simulated" | "both")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="real">Real Data Only</SelectItem>
                      <SelectItem value="simulated">Simulated Data Only</SelectItem>
                      <SelectItem value="both">Both Combined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Filter Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Current Selection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Campaign:</span>{" "}
                  <span className="text-muted-foreground">
                    {campaigns?.find(c => c.code === selectedCampaign)?.title || "None"}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-medium">Event Type:</span>{" "}
                  <span className="text-muted-foreground">{eventTypeFilter === "all" ? "All Events" : eventTypeFilter}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium">Data Source:</span>{" "}
                  <span className="text-muted-foreground">
                    {dataSourceFilter === "real" ? "Real Data Only" : dataSourceFilter === "simulated" ? "Simulated Data Only" : "Both Combined"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

            {eventsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : events.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No events found for the selected filters.
                </CardContent>
              </Card>
            ) : (
              events.map((event) => (
                <Card key={event.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1.5">
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

                          {(event.city || event.region || event.country) && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <MapPin className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                              <span>
                                {[event.city, event.region, event.country].filter(Boolean).join(', ')}
                              </span>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                            <span>Token: <code className="font-mono">{event.token}</code></span>
                            <span>Deck: <code className="font-mono">{event.tokens?.deck_slug}</code></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="map" className="mt-6">
            <SharedDashboardMap geoData={geoData || []} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6 mt-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Viral Coefficient"
                value={viralCoefficient?.k_factor.toFixed(2) || "0"}
                status={(viralCoefficient?.k_factor || 0) >= 1 ? "good" : "warning"}
              />
              <MetricCard
                title="Share Rate"
                value={(funnelData?.view_to_share_rate || 0).toFixed(1)}
                format="percentage"
                status={(funnelData?.view_to_share_rate || 0) >= 10 ? "good" : "neutral"}
              />
              <MetricCard
                title="Avg Cycle Time"
                value={avgCycleTime}
                format="time"
                status="neutral"
              />
              <MetricCard
                title="Total Reach"
                value={viralCoefficient?.unique_tokens || 0}
                status="good"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {viralCoefficient && (
                <ViralCoefficientChart kFactor={viralCoefficient.k_factor} />
              )}
              {amplificationData && <AmplificationChart data={amplificationData} />}
            </div>
            
            {engagementData && <EngagementByLevelChart data={engagementData} />}
            
            {funnelData && <ConversionFunnelChart data={funnelData} />}
            
            {contentData && <ContentPerformanceTable data={contentData} />}
          </TabsContent>

          <TabsContent value="simulator" className="mt-6">
            <SimulatorControls 
              campaignId={selectedCampaignId}
              onSimulationComplete={() => {
                if (dataSourceFilter === "real") {
                  setDataSourceFilter("both");
                }
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
